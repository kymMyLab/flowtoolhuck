import React, { useState, useRef, useEffect, useMemo } from 'react';
import { THEMES, resolveImageModel } from '../constants';
import { CastCharacter, SeriesEpisodePlan, SeriesManifest, ExpressionType } from '../types';
import { createDefaultCastCharacter, EXPRESSION_METAS } from '../services/castStorage';
import { Flow } from 'flow-sdk';
import { callWithRetry, safeJsonParse, formatErrorMessage } from '../services/utils';
import { buildGrandDesignPrompt } from '../services/directorService';
import { loadCustomTastes, CustomTasteMap } from '../services/tasteStorage';

export interface TurnaroundCandidate {
  id: string;
  tasteName: string;      // 例: 📜 レトロ淡彩アトリエ・極細線画
  tastePromptEn: string;  // 画風プロンプト
  name: string;           // 主人公名
  concept: string;        // 性格・世界観設定
  dnaPromptEn: string;    // 容姿DNA
  turnaroundBase64?: string;
  turnaroundMediaId?: string;
  status: 'idle' | 'generating_image' | 'completed' | 'error';
  errorMessage?: string;
  isUserSpecified?: boolean; // ユーザーが明示的に指定した画風か
}

// Comic Wizard 3-Step Flow:
// 1: 世界観選定＆画風5選・三面図
// 2: お友達・サブキャラ配役
// 3: 話数選択(1〜50話)＆起承転結プロット＆連載スタート

interface ComicCreationWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: string;
  currentTaste: string;
  onLaunchComicSeries: (payload: {
    theme: string;
    taste: string;
    protagonist: CastCharacter;
    subCharacters: CastCharacter[];
    manifest: SeriesManifest;
    totalEpisodes: number;
    cutsPerEpisode: number;
  }) => void;
  onAddLog: (msg: string, type?: any) => void;
}

export const ComicCreationWizardModal: React.FC<ComicCreationWizardModalProps> = ({
  isOpen,
  onClose,
  currentTheme,
  currentTaste,
  onLaunchComicSeries,
  onAddLog,
}) => {
  // ステップ管理: 1: 三面図 ➔ 2: サブキャラ ➔ 3: プロット＆連載スタート
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: 世界観テーマ
  const [selectedTheme, setSelectedTheme] = useState<string>(currentTheme || THEMES[0]);

  // Step 1: 画風選定モード ('ai_auto': 完全おまかせ, 'custom_pick': ユーザーが任意数指定)
  const [tasteMode, setTasteMode] = useState<'ai_auto' | 'custom_pick'>('ai_auto');
  const [availableTastes, setAvailableTastes] = useState<CustomTasteMap>({});
  const [selectedCustomTastes, setSelectedCustomTastes] = useState<string[]>([]);
  const [tasteSearchQuery, setTasteSearchQuery] = useState<string>('');

  // Step 1: 5つの画風＆主人公三面図候補
  const [candidates, setCandidates] = useState<TurnaroundCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [isBrainstormingCandidates, setIsBrainstormingCandidates] = useState(false);
  const [activeGeneratingIndex, setActiveGeneratingIndex] = useState<number | null>(null);

  // Step 2: サブキャラクター（お友達・相棒・宿敵）
  const [subCharacters, setSubCharacters] = useState<CastCharacter[]>([]);
  const [isGeneratingSubs, setIsGeneratingSubs] = useState(false);

  // Step 3: 起承転結ストーリー (1〜50話 & 1話カット数)
  const [episodeCount, setEpisodeCount] = useState<number>(4); // デフォルト4話（起承転結）
  const [cutsPerEpisode, setCutsPerEpisode] = useState<number>(30); // 12, 24, 30
  const [seriesTitle, setSeriesTitle] = useState<string>('');
  const [overallSynopsis, setOverallSynopsis] = useState<string>('');
  const [episodesPlan, setEpisodesPlan] = useState<SeriesEpisodePlan[]>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  // 画像拡大Lightbox用
  const [zoomImage, setZoomImage] = useState<{ base64: string; title: string } | null>(null);

  const isGeneratingRef = useRef(false);

  // カスタム画風のロード
  useEffect(() => {
    if (isOpen) {
      const loaded = loadCustomTastes();
      setAvailableTastes(loaded);
    }
  }, [isOpen]);

  // 検索フィルタリングされた画風一覧
  const filteredTasteKeys = useMemo(() => {
    const keys = Object.keys(availableTastes);
    if (!tasteSearchQuery.trim()) return keys;
    const q = tasteSearchQuery.toLowerCase();
    return keys.filter(k => k.toLowerCase().includes(q) || (availableTastes[k] || '').toLowerCase().includes(q));
  }, [availableTastes, tasteSearchQuery]);

  // 選択中の候補を取得
  const currentCandidate = candidates.find(c => c.id === selectedCandidateId) || candidates[0];

  // 表示用エピソードプラン：生成済みの場合のみepisodeCountに合わせてスライス
  const displayedEpisodes = useMemo(() => {
    if (episodesPlan.length === 0) return [];
    return episodesPlan.slice(0, episodeCount);
  }, [episodesPlan, episodeCount]);

  if (!isOpen) return null;

  // テーマをランダムに選定
  const handleRandomTheme = () => {
    const randomItem = THEMES[Math.floor(Math.random() * THEMES.length)];
    setSelectedTheme(randomItem);
    onAddLog(`🎲 世界観テーマをランダム選定しました: 「${randomItem}」`, 'info');
  };

  // 画風の選択・解除トグル (最大5個まで)
  const handleToggleTaste = (tasteKey: string) => {
    if (selectedCustomTastes.includes(tasteKey)) {
      setSelectedCustomTastes(prev => prev.filter(k => k !== tasteKey));
    } else {
      if (selectedCustomTastes.length >= 5) {
        onAddLog('⚠️ 画風は最大5個まで選択できます。不要なものを解除してから追加してください。', 'warning');
        return;
      }
      setSelectedCustomTastes(prev => [...prev, tasteKey]);
    }
  };

  // =========================================================================
  // Step 1: 世界観から最適な画風5選（または指定画風＋AI補完）をAI考案し三面図を一括作画
  // =========================================================================
  const handleGenerate5Candidates = async () => {
    if (isBrainstormingCandidates || isGeneratingRef.current) return;
    setIsBrainstormingCandidates(true);
    isGeneratingRef.current = true;

    const userPicksCount = selectedCustomTastes.length;
    const isCustomMode = tasteMode === 'custom_pick' && userPicksCount > 0;

    onAddLog(
      isCustomMode 
        ? `🎨 指定された画風（${userPicksCount}個: ${selectedCustomTastes.join(', ')}）を厳密反映し、計5体の【画風×主人公三面図】をAI考案中...`
        : `🧠 「${selectedTheme}」に最適な【画風5選 × 主人公三面図】をGeminiが自動考案中...`,
      'process'
    );

    try {
      // ユーザー指定画風のプロンプト指示文
      let customTastesInstruction = '';
      if (isCustomMode) {
        customTastesInstruction = `
【最重要: ユーザーが自ら指定した画風 (${userPicksCount}個)】:
${selectedCustomTastes.map((key, i) => `候補 ${i + 1} 枠: 「${key}」 (英語画風プロンプト: ${availableTastes[key] || 'masterpiece anime style'})`).join('\n')}

【厳守事項】:
出力する5個の候補のうち、最初の${userPicksCount}個は上記の指定された画風をそのまま「tasteName」および「tastePromptEn」に1文字も変えずに厳格に採用してください。
残りの${5 - userPicksCount}個の枠は、世界観テーマ「${selectedTheme}」に最高にマッチする全く異なる魅力的な画風をAIが考案して補完してください。
`;
      } else {
        customTastesInstruction = `
【画風選定の要件】:
世界観テーマ「${selectedTheme}」の歴史・情緒・空気感に最高にマッチする、全くアプローチの異なる魅力的な5種類の画風（例: 緻密線画、水彩淡彩、劇画調、モダンアニメ、レトロセル画など世界観に即した画風）をAIが自律考案してください。
`;
      }

      const prompt = `あなたは世界的大ヒット漫画を生み出す天才漫画編集長兼アートディレクターです。
以下の【世界観テーマ】に深く根ざした、全くアプローチの異なる【5種類の画風・テイスト】と、それぞれの画風を極限まで活かした魅力的な【主人公キャラクター案】を5組考案してください。

【世界観テーマ】: ${selectedTheme}
${customTastesInstruction}

【キャラクター考案の最重要ガイドライン】:
- 世界観テーマ「${selectedTheme}」のジャンル・空気感・情緒を忠実に尊重してください。
- 現代社会派・人間ドラマ・介護・日常系（例: 8050問題、老老介護、ブラック企業、家族愛、下町人情など）の場合：
  ★絶対に武器や魔法、サイバースーツ、ファンタジーの肩書（求道者、切り込み役、トリックスター等）を付けないでください！
  ★実在のリアルな職業や立場（例: 孤軍奮闘する長男、限界を迎えた介護従事者、見守る幼馴染、訪問看護師、心優しきケースワーカー等）として考案してください。
  ★画風も白黒劇画、淡彩水彩、細線画、ジブリ調の温もりある日常描写など、テーマの重みや哀愁、ぬくもりを表現できる画風にしてください。
- 歴史・時代劇の場合はその時代の身分・職業（町火消し、岡っ引き、看板娘など）、ファンタジー・バトルの場合のみ相応の戦士や魔法使いにしてください。

【出力要件】
以下のキーを持つ厳密なJSON形式（Markdownのコードブロックなし）で出力してください:
{
  "candidates": [
    {
      "id": "cand_1",
      "tasteName": "世界観にマッチする独創的画風名 (日本語)",
      "tastePromptEn": "Detailed English art style prompt matching the tasteName, masterpiece",
      "name": "主人公の名前 (立場・肩書)",
      "concept": "性格、信念、日常での立場や抱える葛藤（日本語2行程度）",
      "dnaPromptEn": "Detailed English character appearance prompt: gender, age, realistic hairstyle, expressive eyes, everyday or authentic clothing matching ${selectedTheme}"
    }
  ]
}`;

      let initialCandidates: TurnaroundCandidate[] = [];

      try {
        const res = await callWithRetry<any>(
          () => Flow.generate.text(prompt),
          (attempt, max, delay, err) => {
            onAddLog(`⚠️ [画風&キャラ考案] リトライ (${attempt}/${max}) ${Math.round(delay / 1000)}秒待機... (${formatErrorMessage(err)})`, 'warning');
          },
          5
        );
        const text = res?.text || (typeof res === 'string' ? res : '');
        const parsed = safeJsonParse<any>(text, null);
        let list: any[] = [];
        if (Array.isArray(parsed)) {
          list = parsed;
        } else if (parsed && Array.isArray(parsed.candidates)) {
          list = parsed.candidates;
        }

        if (list.length >= 3) {
          initialCandidates = list.map((item, idx) => {
            const isUserPick = isCustomMode && idx < selectedCustomTastes.length;
            const tasteName = isUserPick ? selectedCustomTastes[idx] : (item.tasteName || `画風案 ${idx + 1}`);
            const tastePromptEn = isUserPick ? (availableTastes[selectedCustomTastes[idx]] || item.tastePromptEn) : (item.tastePromptEn || 'anime style, masterpiece');
            return {
              id: item.id || `cand_${idx + 1}`,
              tasteName,
              tastePromptEn,
              name: item.name || `主人公 ${idx + 1}`,
              concept: item.concept || `${selectedTheme}の世界を生きる主人公`,
              dnaPromptEn: item.dnaPromptEn || `A striking authentic character matching ${selectedTheme}`,
              status: 'idle' as const,
              isUserSpecified: isUserPick,
            };
          });
        }
      } catch (textErr: any) {
        console.warn('[ComicWizard] Flow.generate.text failed, fallback to smart candidates:', textErr);
        onAddLog(`⚠️ AIテキスト考案が一時応答待ちのため、世界観「${selectedTheme}」に最適化した候補を動的構築して三面図作画を開始します`, 'warning');
      }

      // 候補が空の場合（エラー時含む）は、世界観テーマのジャンルに最適化した動的フォールバックを自動生成
      if (initialCandidates.length === 0) {
        const themeLower = selectedTheme.toLowerCase();
        const isSocialOrDaily = /介護|8050|年金|ブラック|社内|不倫|平成|昭和|日常|生活|孤独|社会|家族|就職/.test(selectedTheme);
        const isEdoOrHistorical = /江戸|幕末|新選組|大名|侍|武士|吉原|長屋|明治|大正/.test(selectedTheme);

        interface ArchetypeDef {
          name: string;
          concept: string;
          dna: string;
          tasteKey?: string;
        }

        let fallbackArchetypes: ArchetypeDef[] = [];

        if (isSocialOrDaily) {
          fallbackArchetypes = [
            {
              name: '孤軍奮闘する家族 (長男/当事者)',
              concept: '日々の葛藤と親への想いを抱え、現実と静かに向き合い続ける実直な主人公',
              dna: 'Japanese ordinary adult, tired yet gentle and determined eyes, simple modest casual clothes, realistic everyday life setting',
              tasteKey: '白黒劇画・超絶インクマンガ (Seinen manga realist ink)'
            },
            {
              name: '現場を支えるケアマネジャー',
              concept: '制度の限界に悩みながらも、利用者の尊厳を守るため奔走する温かい主人公',
              dna: 'Japanese care manager, kind empathetic expression, neat practical work clothes with cardigan, holding clipboard',
              tasteKey: 'ノスタルジック水彩・淡彩画 (Nostalgic watercolor drama)'
            },
            {
              name: '人生の哀愁を背負う老親',
              concept: '衰えゆく体と子への負い目に揺れながら、過去の誇りを胸に生きる主人公',
              dna: 'Elderly Japanese person, weathered gentle face with deep wrinkles, nostalgic demeanor, soft indoor attire',
              tasteKey: '📜 レトロ淡彩アトリエ・極細線画 (Nostalgic Faded Pastel Whisper-Line)'
            },
            {
              name: '街を駆ける福祉相談員',
              concept: '孤立した家庭を見過ごせず、粘り強く対話を重ねて希望を紡ぐ主人公',
              dna: 'Compassionate social worker, youthful focused gaze, durable practical outerwear, friendly approachable presence',
              tasteKey: 'スタジオジブリ風・日常温もり手描き (Ghibli nostalgic everyday slice-of-life)'
            },
            {
              name: '静かに見守る隣人・理解者',
              concept: '言葉少なに温かい差し入れや声をかけ、孤立を防ぐ地域の光となる主人公',
              dna: 'Friendly neighborhood resident, warm welcoming smile, cozy traditional home knitwear, calming aura',
              tasteKey: '劇場版フラットセル・夜景 (Cinematic flat cell night mood)'
            },
          ];
        } else if (isEdoOrHistorical) {
          fallbackArchetypes = [
            {
              name: '人情深き町職人',
              concept: '命を張った心意気と腕一本で仲間を支える江戸っ子気質の主人公',
              dna: 'Edo period craftsman, spirited confident smile, authentic hanten coat and headband, sturdy physique',
              tasteKey: '白黒劇画・超絶インクマンガ (Seinen manga realist ink)'
            },
            {
              name: '鋭い眼光の岡っ引き',
              concept: '事件の背後にある闇を暴くため十手を握る、信念と哀愁の主人公',
              dna: 'Edo period detective okappiki, sharp observant eyes, traditional kimono and haori, holding jitte',
              tasteKey: '📜 レトロ淡彩アトリエ・極細線画 (Nostalgic Faded Pastel Whisper-Line)'
            },
            {
              name: '刀を捨てた風来浪人',
              concept: '過去を隠し町人たちを陰から守る、飄々として情に厚い剣客',
              dna: 'Wandering ronin samurai, relaxed gentle expression, worn traveling kimono, straw hat',
              tasteKey: '浮世絵・木版画調 (Ukiyo-e woodblock print)'
            },
            {
              name: '長屋を照らす看板娘',
              concept: 'どんな困難にも負けず皆を元気づける、明るく聡明な主人公',
              dna: 'Edo period merchant girl, cheerful radiant smile, elegant retro patterned kimono, apron',
              tasteKey: 'ノスタルジック水彩・淡彩画 (Nostalgic watercolor drama)'
            },
            {
              name: '夜を駆ける義賊・調査官',
              concept: '弱者の涙をぬぐうため、夜の闇に紛れて悪事を暴く孤高の主人公',
              dna: 'Stealthy investigator, dark covert ninja-style travel clothing, vigilant resolute eyes',
              tasteKey: '劇場版フラットセル・夜景 (Cinematic flat cell night mood)'
            },
          ];
        } else {
          fallbackArchetypes = [
            {
              name: '熱き信念の探求者',
              concept: '強い正義感と不屈の闘志で道を切り開く情熱的な主人公',
              dna: 'Anime hero protagonist, fiery determined eyes, distinctive iconic adventurer outfit',
              tasteKey: '王道少年漫画・ダイナミック劇画 (Classic Shonen battle ink)'
            },
            {
              name: '冷静沈着な影の策士',
              concept: '知略と観察眼で危機を打開する孤高の実力派主人公',
              dna: 'Sharp intelligent anime strategist, calm penetrating gaze, sleek tailored attire',
              tasteKey: '白黒劇画・超絶インクマンガ (Seinen manga realist ink)'
            },
            {
              name: '運命を継ぐ癒やし手',
              concept: '秘められた力を宿し、人々を慈しみ導く心優しき主人公',
              dna: 'Gentle anime mystic, ethereal kind eyes, flowing ceremonial robes, warm presence',
              tasteKey: '📜 レトロ淡彩アトリエ・極細線画 (Nostalgic Faded Pastel Whisper-Line)'
            },
            {
              name: '歴戦の重厚な守護者',
              concept: '己の掟に従い大切な者を守り抜く歴戦の主人公',
              dna: 'Battle-hardened veteran, stalwart sturdy demeanor, rugged functional armor coat',
              tasteKey: 'ダークファンタジー・重厚厚塗り (Dark fantasy heavy painterly)'
            },
            {
              name: '機転のトリックスター',
              concept: '圧倒的な機転とスピードで常識を覆す快活な主人公',
              dna: 'Charismatic clever trickster, cheeky confident smirk, modern stylish agile outfit',
              tasteKey: 'サイバー・テクニカル・ブループリント (Cyber blueprint style)'
            },
          ];
        }

        const allTasteKeys = Object.keys(availableTastes);
        const shuffledTastes = [...allTasteKeys].sort(() => Math.random() - 0.5);

        initialCandidates = Array.from({ length: 5 }, (_, idx) => {
          const isUserPick = isCustomMode && idx < selectedCustomTastes.length;
          const arch = fallbackArchetypes[idx];
          let tasteName = '';
          let tastePromptEn = '';

          if (isUserPick) {
            tasteName = selectedCustomTastes[idx];
            tastePromptEn = availableTastes[tasteName] || 'anime masterpiece';
          } else if (arch.tasteKey && availableTastes[arch.tasteKey]) {
            tasteName = arch.tasteKey;
            tastePromptEn = availableTastes[tasteName];
          } else {
            tasteName = shuffledTastes[idx % shuffledTastes.length] || `画風案 ${idx + 1}`;
            tastePromptEn = availableTastes[tasteName] || 'anime masterpiece';
          }

          return {
            id: `cand_${idx + 1}`,
            tasteName,
            tastePromptEn,
            name: `${arch.name}`,
            concept: `${selectedTheme}の中で、${arch.concept}`,
            dnaPromptEn: `${arch.dna}, matching world setting of ${selectedTheme}`,
            status: 'idle' as const,
            isUserSpecified: isUserPick,
          };
        });
      }

      setCandidates(initialCandidates);
      setSelectedCandidateId(initialCandidates[0].id);
      setIsBrainstormingCandidates(false);
      onAddLog(`🎨 5組の画風・主人公設定が決定！三面図シート（16:9）を順次AI作画開始します...`, 'process');

      // 5体の三面図（16:9）を順次作画
      const modelDef = resolveImageModel();
      const safeModelName = modelDef?.name || '🍌 Nano Banana 2';
      const safeNegative = 'worst quality, normal quality, lowres, deformed, distorted, bad anatomy, bad hands, blurry, complex background, text, watermark';

      for (let i = 0; i < initialCandidates.length; i++) {
        const cand = initialCandidates[i];
        setActiveGeneratingIndex(i);

        setCandidates(prev => prev.map((c, idx) => idx === i ? { ...c, status: 'generating_image' } : c));
        onAddLog(`📐 [${i + 1}/5] 「${cand.tasteName}」×「${cand.name}」の三面図シートを作画中...`, 'process');

        const turnaroundPrompt = `${cand.dnaPromptEn}, anime character turnaround sheet, model sheet, three views, full body front view, full body side view, full body back view, clean plain white background, high-contrast crisp anime lineart, consistent clothing and proportions, masterpiece. Art style: ${cand.tastePromptEn}`;

        try {
          const imgRes = await callWithRetry<any>(
            () => Flow.generate.image({
              prompt: turnaroundPrompt,
              negativePrompt: safeNegative,
              aspectRatio: '16:9',
              modelDisplayName: safeModelName,
            }),
            (att, max, d, e) => {
              onAddLog(`⚠️ [${i + 1}/5] 作画リトライ (${att}/${max}) (理由: ${formatErrorMessage(e)})`, 'warning');
            },
            3
          );

          const base64 = imgRes?.base64 || imgRes?.image?.base64;
          const mediaId = imgRes?.mediaId || imgRes?.image?.mediaId;

          if (base64) {
            setCandidates(prev => prev.map((c, idx) => 
              idx === i ? { ...c, turnaroundBase64: base64, turnaroundMediaId: mediaId, status: 'completed' } : c
            ));
            onAddLog(`✨ [${i + 1}/5] 「${cand.name}」の三面図シートが完成！`, 'success');
          } else {
            throw new Error('画像データが取得できませんでした');
          }
        } catch (imgErr: any) {
          onAddLog(`⚠️ [${i + 1}/5] 三面図作画エラー: ${formatErrorMessage(imgErr)}`, 'warning');
          setCandidates(prev => prev.map((c, idx) => 
            idx === i ? { ...c, status: 'error', errorMessage: formatErrorMessage(imgErr) } : c
          ));
        }
      }

      onAddLog(`🎉 全5体の三面図シート作画が完了しました！お気に入りの1枚を選択してください。`, 'success');
    } catch (err: any) {
      onAddLog(`❌ 画風＆キャラクター考案エラー: ${formatErrorMessage(err)}`, 'error');
      setIsBrainstormingCandidates(false);
    } finally {
      setActiveGeneratingIndex(null);
      isGeneratingRef.current = false;
      setIsBrainstormingCandidates(false);
    }
  };

  // =========================================================================
  // Step 2 への決定＆遷移ハンドラー（三面図決定 ➔ お友達・サブキャラ配役へ）
  // =========================================================================
  const handleProceedToStep2 = (cand?: TurnaroundCandidate) => {
    const target = cand || currentCandidate;
    if (!target || !target.turnaroundBase64) {
      onAddLog(`⚠️ 三面図が完成しているキャラクターを1つ選択してください`, 'warning');
      return;
    }
    setSelectedCandidateId(target.id);
    setStep(2);
    onAddLog(`✨ 主人公「${target.name}」(${target.tasteName}) を選択しました！お友達・サブキャラ配役へ進みます。`, 'success');

    // まだサブキャラが考案されていない場合は自動で考案開始
    if (subCharacters.length === 0) {
      setTimeout(() => {
        handleGenerateSubCharacters(target);
      }, 150);
    }
  };

  // =========================================================================
  // Step 2: サブキャラ・お友達の自動配役（2〜3名）
  // =========================================================================
  const handleGenerateSubCharacters = async (targetCand?: TurnaroundCandidate) => {
    const target = targetCand || currentCandidate;
    if (!target) return;
    setIsGeneratingSubs(true);
    onAddLog(`👥 主人公「${target.name}」を取り巻くお友達・相棒・宿敵などサブキャラを自動考案中...`, 'process');

    const prompt = `あなたは一流の漫画編集者です。
漫画『${seriesTitle || target.name}』（主人公: 「${target.name}」）のストーリー展開を強力に引き立てる、
魅力的なサブキャラクター（お友達・相棒、ヒロイン、宿敵・ライバル）を【2〜3名】考案してください。

【世界観テーマ】: ${selectedTheme}
【画風テイスト】: ${target.tasteName}
【主人公】: ${target.name} (${target.concept})

【重要】世界観「${selectedTheme}」の日常・社会派・歴史などのジャンルに応じたリアリティを重視してください。

以下の厳密なJSON形式（Markdownコードブロックなし）で出力してください:
{
  "subCharacters": [
    {
      "name": "キャラクター名 (立場・肩書)",
      "role": "partner",
      "concept": "主人公との関係性・お友達・相棒としての役割（日本語2行）",
      "dnaPromptEn": "Detailed English character appearance prompt: gender, age, hair, eyes, distinct clothing matching ${selectedTheme}"
    },
    {
      "name": "キャラクター名 (立場・肩書)",
      "role": "antagonist",
      "concept": "主人公と対立する宿敵・ライバル・または対立する立場としての役割（日本語2行）",
      "dnaPromptEn": "Detailed English character appearance prompt: gender, age, hair, eyes, distinct clothing matching ${selectedTheme}"
    }
  ]
}`;

    try {
      const res = await callWithRetry<any>(
        () => Flow.generate.text(prompt),
        (attempt, max, delay, err) => {
          onAddLog(`⚠️ [サブキャラ考案] リトライ (${attempt}/${max}) ${Math.round(delay / 1000)}秒待機... (${formatErrorMessage(err)})`, 'warning');
        },
        5
      );
      const text = res?.text || (typeof res === 'string' ? res : '');
      const parsed = safeJsonParse<any>(text, null);
      let list: any[] = [];
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed && Array.isArray(parsed.subCharacters)) {
        list = parsed.subCharacters;
      }

      if (list.length > 0) {
        const chars: CastCharacter[] = list.map((item, idx) => {
          return createDefaultCastCharacter(
            `sub_char_${idx + 1}_${Date.now()}`,
            item.name,
            item.role || 'partner',
            item.dnaPromptEn
          );
        });
        setSubCharacters(chars);
        onAddLog(`✨ サブキャラクター${chars.length}名（お友達・相棒・宿敵）の配役が完了しました！`, 'success');
      } else {
        throw new Error('サブキャラクターの生成に失敗しました');
      }
    } catch (err: any) {
      onAddLog(`❌ サブキャラ考案エラー: ${formatErrorMessage(err)}`, 'error');
      // フォールバック
      const dummySubs: CastCharacter[] = [
        createDefaultCastCharacter(`sub_1_${Date.now()}`, '頼れる相棒・理解者', 'partner', `A trustworthy loyal companion and friend of ${target.name}, matching ${selectedTheme}`),
        createDefaultCastCharacter(`sub_2_${Date.now()}`, '宿命の好敵手・対立者', 'antagonist', `A compelling opposing figure to ${target.name}, sharp intense eyes matching ${selectedTheme}`)
      ];
      setSubCharacters(dummySubs);
    } finally {
      setIsGeneratingSubs(false);
    }
  };

  // 話数スライダー変更ハンドラー（勝手な自動生成はせず、値の変更のみ）
  const handleEpisodeCountChange = (newCount: number) => {
    const validCount = Math.max(1, Math.min(50, newCount));
    setEpisodeCount(validCount);
  };

  // Step 2 ➔ Step 3（話数＆全話プロット）へ進む
  const handleProceedToStep3 = () => {
    setStep(3);
    onAddLog(`📜 Step 3: 話数・カット割りを設定し、プロット生成を行ってください`, 'info');
  };

  // =========================================================================
  // Step 3: 選択した主人公三面図から起承転結（全1〜50話）ストーリー策定
  // =========================================================================
  const handleGenerateStoryPlan = async (targetCand?: TurnaroundCandidate, countToUse?: number) => {
    const target = targetCand || currentCandidate;
    if (!target) return;

    const count = countToUse || episodeCount;
    setIsGeneratingPlan(true);
    onAddLog(`📜 主人公「${target.name}」で【全${count}話】の起承転結ストーリー構成を構築中...`, 'process');

    const prompt = buildGrandDesignPrompt(
      count,
      '日本',
      selectedTheme,
      target.tasteName,
      true, // isMangaMode
      false, // isMvMode
      target.dnaPromptEn,
      target.name
    );

    try {
      const res = await callWithRetry<any>(
        () => Flow.generate.text(prompt),
        (attempt, max, delay, err) => {
          onAddLog(`⚠️ [全話プロット生成] リトライ (${attempt}/${max}) ${Math.round(delay / 1000)}秒待機... (${formatErrorMessage(err)})`, 'warning');
        },
        5
      );
      const text = res?.text || (typeof res === 'string' ? res : '');
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = safeJsonParse<any>(cleaned, null);

      if (parsed && Array.isArray(parsed.episodesPlan) && parsed.episodesPlan.length > 0) {
        setSeriesTitle(parsed.seriesTitle || `${target.name}伝`);
        setOverallSynopsis(parsed.overallSynopsis || '');
        
        // 指定話数 count に厳密に同期
        let adjustedPlan: SeriesEpisodePlan[] = parsed.episodesPlan;
        if (adjustedPlan.length > count) {
          adjustedPlan = adjustedPlan.slice(0, count);
        } else if (adjustedPlan.length < count) {
          const diff = count - adjustedPlan.length;
          const fillers: SeriesEpisodePlan[] = Array.from({ length: diff }, (_, idx) => {
            const epNum = adjustedPlan.length + idx + 1;
            return {
              epNumber: epNum,
              titleJp: `第${epNum}話 続く戦いと希望`,
              titleEn: `Episode ${epNum}`,
              summary: `${target.name}の壮大な冒険の第${epNum}話`
            };
          });
          adjustedPlan = [...adjustedPlan, ...fillers];
        }
        setEpisodesPlan(adjustedPlan);
        onAddLog(`🎉 コミック連載『${parsed.seriesTitle || target.name}』（全${adjustedPlan.length}話）の起承転結プロットが確定しました！`, 'success');
      } else {
        throw new Error('ストーリープロットの生成に失敗しました');
      }
    } catch (err: any) {
      onAddLog(`❌ 起承転結プロット生成エラー: ${formatErrorMessage(err)}`, 'error');
      // フォールバック
      const dummyPlan: SeriesEpisodePlan[] = Array.from({ length: count }, (_, i) => ({
        epNumber: i + 1,
        titleJp: `第${i + 1}話 ${i < Math.round(count * 0.25) ? '運命の幕開け' : i < Math.round(count * 0.55) ? '深まる謎と試練' : i < Math.round(count * 0.85) ? '最大の激突と転換' : '大団円と未来'}`,
        titleEn: `Episode ${i + 1} Arc`,
        summary: `主人公${target.name}が立ち向かう第${i + 1}話の試練と成長`
      }));
      setSeriesTitle(`${target.name}活劇録`);
      setOverallSynopsis(`${selectedTheme}の世界で${target.name}が仲間と共に織りなす全${count}話の大河ストーリー`);
      setEpisodesPlan(dummyPlan);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // =========================================================================
  // Step 3: コミック一冊分（30Cut × 1〜50話）の自動制作をローンチ！
  // =========================================================================
  const handleLaunch = () => {
    if (!currentCandidate) return;

    // 主人公の CastCharacter オブジェクトを構築
    const mainProtagonist = createDefaultCastCharacter(
      `protagonist_${Date.now()}`,
      currentCandidate.name,
      'protagonist',
      currentCandidate.dnaPromptEn
    );

    // 三面図を格納
    mainProtagonist.turnaroundBase64 = currentCandidate.turnaroundBase64;
    mainProtagonist.turnaroundMediaId = currentCandidate.turnaroundMediaId;
    mainProtagonist.turnaroundPromptEn = `${currentCandidate.dnaPromptEn}, turnaround sheet, art style: ${currentCandidate.tastePromptEn}`;
    mainProtagonist.avatarBase64 = currentCandidate.turnaroundBase64;

    // シリーズマニフェストを構築
    const manifest: SeriesManifest = {
      seriesTitle: seriesTitle || `${currentCandidate.name} 漫画連載`,
      totalEpisodes: episodeCount,
      currentEpisodeId: 1,
      completedEpisodeIds: [],
      overallSynopsis: overallSynopsis || `${selectedTheme}の世界を舞台にした${currentCandidate.name}の壮大な物語`,
      episodesPlan: displayedEpisodes.length > 0 ? displayedEpisodes : Array.from({ length: episodeCount }, (_, i) => ({
        epNumber: i + 1,
        titleJp: `第${i + 1}話`,
        titleEn: `Episode ${i + 1}`,
        summary: `${currentCandidate.name}の物語 第${i + 1}話`
      })),
      referenceAsset: currentCandidate.turnaroundBase64 ? {
        name: `${currentCandidate.name} (三面図マスター)`,
        base64: currentCandidate.turnaroundBase64,
        mimeType: 'image/png',
        characterDna: currentCandidate.dnaPromptEn,
        styleDna: currentCandidate.tastePromptEn
      } : undefined,
      settings: {
        theme: selectedTheme,
        taste: currentCandidate.tasteName,
        episodeCount: episodeCount,
        previewCutCount: cutsPerEpisode,
        isMangaMode: true,
        isMultiPanel: true,
      }
    };

    onLaunchComicSeries({
      theme: selectedTheme,
      taste: currentCandidate.tasteName,
      protagonist: mainProtagonist,
      subCharacters: subCharacters,
      manifest: manifest,
      totalEpisodes: episodeCount,
      cutsPerEpisode: cutsPerEpisode
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-5xl h-[92vh] bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden text-slate-800">
        
        {/* Modal Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-2xl">auto_stories</span>
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">コミック一冊分 自動プロデュース</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-extrabold shadow-sm">
                  COMIC WIZARD PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                世界観選定 ➔ 三面図 ➔ 起承転結の顔 ➔ サブキャラ配役 ➔ 1〜50話プロット ➔ 30Cut連載
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Step Progress Bar */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold shrink-0">
          {[
            { num: 1, label: '① 世界観＆三面図5選' },
            { num: 2, label: '② お友達・サブキャラ配役' },
            { num: 3, label: '③ 全話プロット＆連載開始' },
          ].map(s => {
            const isActive = step === s.num;
            const isPassed = step > s.num;
            return (
              <div 
                key={s.num} 
                className={`flex items-center gap-1.5 transition-colors ${
                  isActive ? 'text-indigo-600 font-extrabold' : isPassed ? 'text-emerald-600' : 'text-slate-400'
                }`}
              >
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${
                  isActive ? 'bg-indigo-600 text-white shadow-xs' : isPassed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-500'
                }`}>
                  {isPassed ? '✓' : s.num}
                </span>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>

        {/* Modal Main Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/50 flex flex-col gap-4">
          
          {/* ========================================================
              STEP 1: 世界観テーマ選定 ＆ 画風5選×三面図AI作画
             ======================================================== */}
          {step === 1 && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              
              {/* Guidance Box */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/80 p-3.5 rounded-xl flex items-start gap-3 text-indigo-950 shadow-2xs">
                <span className="material-symbols-outlined text-indigo-600 mt-0.5 text-xl">auto_fix_high</span>
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">世界観を選び、「三面図を一括AI作画」ボタンを押してください。</p>
                  <p className="text-indigo-700 mt-0.5">
                    基本は<strong>「AIおまかせ」</strong>で世界観に最適な5画風×三面図を自動作画しますが、<strong>「自分で画風を指定」</strong>で新画風「📜 レトロ淡彩アトリエ」など好きな画風を1〜5個ピンポイント指定することも可能です！
                  </p>
                </div>
              </div>

              {/* Theme Selector Section */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-amber-500">public</span>
                    世界観・テーマ (World Theme)
                  </label>
                  <button
                    onClick={handleRandomTheme}
                    className="px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">casino</span>
                    🎲 ランダムに選定
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={selectedTheme}
                    onChange={e => setSelectedTheme(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-semibold"
                  >
                    {THEMES.map((themeItem, idx) => (
                      <option key={idx} value={themeItem}>{themeItem}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Taste Selection Mode & Custom Picker */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-indigo-500">palette</span>
                    画風テイストの決定方法
                  </label>

                  {/* Mode Switch Tabs */}
                  <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setTasteMode('ai_auto')}
                      className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        tasteMode === 'ai_auto'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">casino</span>
                      🎲 AIおまかせ (世界観最適5選)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTasteMode('custom_pick')}
                      className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                        tasteMode === 'custom_pick'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">checklist</span>
                      🎯 自分で画風を指定 ({selectedCustomTastes.length}/5)
                    </button>
                  </div>
                </div>

                {/* Custom Pick Panel */}
                {tasteMode === 'custom_pick' && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2.5 animate-fadeIn">
                    <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
                      <span className="text-slate-600 font-bold">
                        好きな画風を <strong>1〜5個</strong> クリックして選択してください（指定画風が候補1から順に確実に採用されます）:
                      </span>
                      {selectedCustomTastes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedCustomTastes([])}
                          className="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
                        >
                          全選択解除
                        </button>
                      )}
                    </div>

                    {/* Selected Badges */}
                    {selectedCustomTastes.length > 0 && (
                      <div className="flex items-center flex-wrap gap-1.5 p-2 bg-white rounded-lg border border-indigo-100">
                        <span className="text-[10px] font-bold text-indigo-500 mr-1">指定中:</span>
                        {selectedCustomTastes.map((tKey, idx) => (
                          <span
                            key={tKey}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold shadow-2xs"
                          >
                            <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center font-black">
                              {idx + 1}
                            </span>
                            <span className="truncate max-w-[200px]">{tKey}</span>
                            <button
                              type="button"
                              onClick={() => handleToggleTaste(tKey)}
                              className="text-slate-400 hover:text-rose-600 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[13px]">close</span>
                            </button>
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Filter Input */}
                    <div className="relative">
                      <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 text-sm">search</span>
                      <input
                        type="text"
                        placeholder="画風名やキーワードで絞り込み（例: レトロ、線画、アトリエ、水彩...）"
                        value={tasteSearchQuery}
                        onChange={e => setTasteSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-800"
                      />
                    </div>

                    {/* Tastes Chips List */}
                    <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                      {filteredTasteKeys.map(tKey => {
                        const isSelected = selectedCustomTastes.includes(tKey);
                        return (
                          <button
                            key={tKey}
                            type="button"
                            onClick={() => handleToggleTaste(tKey)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all text-left flex items-center gap-1 cursor-pointer ${
                              isSelected
                                ? 'bg-indigo-600 text-white shadow-xs'
                                : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            <span className="material-symbols-outlined text-xs">
                              {isSelected ? 'check_circle' : 'palette'}
                            </span>
                            <span className="truncate max-w-[240px]">{tKey}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Primary Action Button: 5組の三面図を一括AI作画 */}
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleGenerate5Candidates}
                    disabled={isBrainstormingCandidates || activeGeneratingIndex !== null}
                    style={{ color: isBrainstormingCandidates || activeGeneratingIndex !== null ? '#475569' : '#ffffff' }}
                    className={`w-full py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all select-none ${
                      isBrainstormingCandidates || activeGeneratingIndex !== null
                        ? 'bg-slate-200 text-slate-600 border border-slate-300 shadow-none cursor-wait'
                        : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:brightness-110 active:brightness-95 text-white shadow-md hover:shadow-lg cursor-pointer'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-lg ${isBrainstormingCandidates || activeGeneratingIndex !== null ? 'animate-spin' : ''}`}>
                      {isBrainstormingCandidates || activeGeneratingIndex !== null ? 'autorenew' : 'palette'}
                    </span>
                    <span className="font-extrabold tracking-wide">
                      {isBrainstormingCandidates 
                        ? '最適な画風＆主人公設定をAI考案中...' 
                        : activeGeneratingIndex !== null 
                        ? `三面図を作画中 (${activeGeneratingIndex + 1}/5)...` 
                        : tasteMode === 'custom_pick' && selectedCustomTastes.length > 0
                        ? `🎨 指定した画風(${selectedCustomTastes.length}選)＋AI補完で三面図を作画！`
                        : '🎨 最適画風5選＆三面図を一括AI作画！'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Candidates 5 Cards Grid */}
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-indigo-500">grid_view</span>
                    画風テイスト ＆ 主人公三面図候補（5体中から1枚を選択）
                  </span>
                  {selectedCandidateId && (
                    <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                      ✓ 「{currentCandidate?.name}」を選択中
                    </span>
                  )}
                </div>

                {candidates.length === 0 ? (
                  <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center gap-2 text-slate-400">
                    <span className="material-symbols-outlined text-4xl text-slate-300">view_carousel</span>
                    <span className="text-xs font-bold text-slate-600">まだ候補が生成されていません</span>
                    <span className="text-[11px] text-slate-500">
                      上の「🎨 三面図を一括AI作画」ボタンを押すと、5種類の画風と主人公三面図が自動作画されます。
                    </span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                    {candidates.map((cand, idx) => {
                      const isSelected = cand.id === selectedCandidateId;
                      const hasImage = Boolean(cand.turnaroundBase64);
                      const isGenerating = cand.status === 'generating_image';

                      return (
                        <div
                          key={cand.id}
                          onClick={() => {
                            if (hasImage) {
                              setSelectedCandidateId(cand.id);
                            }
                          }}
                          className={`relative bg-white rounded-xl border-2 transition-all flex flex-col overflow-hidden shadow-2xs cursor-pointer ${
                            isSelected 
                              ? 'border-indigo-600 ring-2 ring-indigo-500/30 shadow-md' 
                              : hasImage 
                              ? 'border-slate-200 hover:border-indigo-300' 
                              : 'border-slate-200 opacity-80'
                          }`}
                        >
                          {/* User Specified Badge */}
                          {cand.isUserSpecified && (
                            <div className="absolute top-2 left-2 z-10 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
                              <span>🎯 指定画風</span>
                            </div>
                          )}

                          {/* Selected Badge */}
                          {isSelected && !cand.isUserSpecified && (
                            <div className="absolute top-2 left-2 z-10 bg-indigo-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
                              <span className="material-symbols-outlined text-[12px]">check</span>
                              <span>選択中</span>
                            </div>
                          )}

                          {/* Index Badge */}
                          <div className="absolute top-2 right-2 z-10 bg-slate-900/70 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                            候補 #{idx + 1}
                          </div>

                          {/* 16:9 Image Preview Box */}
                          <div className="relative aspect-video w-full bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100 group">
                            {cand.turnaroundBase64 ? (
                              <>
                                <img
                                  src={`data:image/png;base64,${cand.turnaroundBase64}`}
                                  alt={cand.name}
                                  className="w-full h-full object-cover"
                                />
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setZoomImage({
                                      base64: cand.turnaroundBase64!,
                                      title: `📐 ${cand.tasteName} - ${cand.name} (三面図シート)`
                                    });
                                  }}
                                  className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-slate-950/70 hover:bg-slate-950 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow-sm cursor-pointer"
                                  title="拡大表示"
                                >
                                  <span className="material-symbols-outlined text-xs">zoom_in</span>
                                  拡大
                                </button>
                              </>
                            ) : isGenerating ? (
                              <div className="flex flex-col items-center justify-center p-3 text-center gap-1 text-indigo-600">
                                <span className="material-symbols-outlined animate-spin text-2xl">autorenew</span>
                                <span className="text-[10px] font-bold">三面図を作画中...</span>
                              </div>
                            ) : cand.status === 'error' ? (
                              <div className="flex flex-col items-center justify-center p-3 text-center gap-1 text-rose-500">
                                <span className="material-symbols-outlined text-xl">error</span>
                                <span className="text-[10px]">作画エラー</span>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center p-3 text-center gap-1 text-slate-400">
                                <span className="material-symbols-outlined text-xl text-slate-300">hourglass_empty</span>
                                <span className="text-[10px]">作画待機中</span>
                              </div>
                            )}
                          </div>

                          {/* Candidate Info */}
                          <div className="p-3 flex flex-col gap-1.5 flex-1 justify-between">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 truncate" title={cand.tasteName}>
                                {cand.tasteName}
                              </span>
                              <h5 className="text-xs font-bold text-slate-900 truncate" title={cand.name}>
                                {cand.name}
                              </h5>
                              <p className="text-[11px] text-slate-500 leading-tight line-clamp-2" title={cand.concept}>
                                {cand.concept}
                              </p>
                            </div>

                            {/* Action Button inside card */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!hasImage) return;
                                handleProceedToStep2(cand);
                              }}
                              disabled={!hasImage}
                              className={`w-full py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer ${
                                isSelected 
                                  ? 'bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white animate-pulse' 
                                  : hasImage 
                                  ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200' 
                                  : 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <span>🚀 この主人公で決定し次へ ➔</span>
                                </>
                              ) : hasImage ? (
                                'このキャラを選択'
                              ) : (
                                '作画中...'
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          )}

          {/* ========================================================
              STEP 2: お友達・相棒・サブキャラ配役
             ======================================================== */}
          {step === 2 && currentCandidate && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              
              {/* Guidance Box */}
              <div className="bg-gradient-to-r from-emerald-50 to-indigo-50 border border-emerald-200/80 p-3.5 rounded-xl flex items-start gap-3 text-emerald-950 shadow-2xs">
                <span className="material-symbols-outlined text-emerald-600 mt-0.5 text-xl">group</span>
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">主人公「{currentCandidate.name}」を取り巻くお友達・サブキャラクターを配役します。</p>
                  <p className="text-emerald-700 mt-0.5">
                    物語に深みを与える「頼れる相棒・親友」「ヒロイン」「宿命のライバル」をAIが自動考案しました。漫画のコマ割りや掛け合いカットで活躍します。
                  </p>
                </div>
              </div>

              {/* Sub-Characters Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {subCharacters.map((sub, idx) => (
                  <div key={sub.id} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between gap-3 shadow-2xs">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          sub.role === 'partner' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-700 border border-red-200'
                        }`}>
                          {sub.role === 'partner' ? '🤝 相棒・お友達' : '⚔️ 宿敵・ライバル'}
                        </span>
                        <span className="text-[10px] text-slate-400">サブキャラ #{idx + 1}</span>
                      </div>
                      <h4 className="text-xs font-bold text-slate-900">{sub.name}</h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{sub.dnaPromptEn}</p>
                    </div>

                    <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-[10px] text-slate-500">
                      💡 主人公「{currentCandidate.name}」と同一画風・世界観で自動作画されます
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleGenerateSubCharacters()}
                  disabled={isGeneratingSubs}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-sm ${isGeneratingSubs ? 'animate-spin' : ''}`}>
                    {isGeneratingSubs ? 'autorenew' : 'shuffle'}
                  </span>
                  <span>サブキャラを再考案（リロール）</span>
                </button>
              </div>

            </div>
          )}

          {/* ========================================================
              STEP 3: 話数選択 (1〜50話) ＆ 起承転結プロット構築 ＆ 連載スタート
             ======================================================== */}
          {step === 3 && currentCandidate && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              
              {/* Volume & Cuts Guidance */}
              <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl flex items-start gap-3 text-amber-950 shadow-2xs">
                <span className="material-symbols-outlined text-amber-600 mt-0.5 text-xl">auto_stories</span>
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">制作ボリューム（話数・カット数）を設定し、全話プロットを確定します。</p>
                  <p className="text-amber-800 mt-0.5">
                    1話〜50話の自由連載に対応。各話<strong>【30Cut (コマ割り演出ON)】</strong>を標準とし、ボタン1つでコミック一冊分の連載を完全自動プロデュースします。
                  </p>
                </div>
              </div>

              {/* Episode & Cut Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-indigo-500">format_list_numbered</span>
                      連載話数 (Volume)
                    </label>
                    <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                      全 {episodeCount} 話
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="50"
                    value={episodeCount}
                    onChange={e => handleEpisodeCountChange(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold px-0.5">
                    <button type="button" onClick={() => handleEpisodeCountChange(1)} className={`hover:text-indigo-600 transition-colors cursor-pointer ${episodeCount === 1 ? 'text-indigo-600 font-black underline' : ''}`}>1話 (読切)</button>
                    <button type="button" onClick={() => handleEpisodeCountChange(2)} className={`hover:text-indigo-600 transition-colors cursor-pointer ${episodeCount === 2 ? 'text-indigo-600 font-black underline' : ''}`}>2話 (前後編)</button>
                    <button type="button" onClick={() => handleEpisodeCountChange(4)} className={`hover:text-indigo-600 transition-colors cursor-pointer ${episodeCount === 4 ? 'text-indigo-600 font-black underline' : ''}`}>4話 (起承転結)</button>
                    <button type="button" onClick={() => handleEpisodeCountChange(10)} className={`hover:text-indigo-600 transition-colors cursor-pointer ${episodeCount === 10 ? 'text-indigo-600 font-black underline' : ''}`}>10話</button>
                    <button type="button" onClick={() => handleEpisodeCountChange(20)} className={`hover:text-indigo-600 transition-colors cursor-pointer ${episodeCount === 20 ? 'text-indigo-600 font-black underline' : ''}`}>20話 (中編)</button>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-purple-500">movie</span>
                      1話あたりの作画カット数
                    </label>
                    <span className="text-xs font-extrabold text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                      {cutsPerEpisode} Cut (コマ割り演出ON)
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {[12, 24, 30].map(cnt => (
                      <button
                        key={cnt}
                        type="button"
                        onClick={() => setCutsPerEpisode(cnt)}
                        className={`py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                          cutsPerEpisode === cnt
                            ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {cnt} Cut {cnt === 30 ? '🔥 標準' : ''}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    ※ 1カット内に2〜5コマの変形マルチコマが自動配置されます。30Cut ＝ 約70〜100コマの重厚な漫画仕立てになります。
                  </span>
                </div>
              </div>

              {/* Series Plot Container */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-500 text-sm">history_edu</span>
                    <h4 className="text-xs font-bold text-slate-800">
                      シリーズ起承転結プロット {episodesPlan.length > 0 ? `(全 ${episodeCount} 話構成 / ${displayedEpisodes.length}話表示)` : `(全 ${episodeCount} 話設定中)`}
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGenerateStoryPlan(currentCandidate, episodeCount)}
                    disabled={isGeneratingPlan}
                    className={`px-4 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                      episodesPlan.length === 0
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:brightness-110 animate-pulse'
                        : 'bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700'
                    }`}
                  >
                    <span className={`material-symbols-outlined text-sm ${isGeneratingPlan ? 'animate-spin' : ''}`}>
                      {isGeneratingPlan ? 'autorenew' : (episodesPlan.length === 0 ? 'auto_awesome' : 'refresh')}
                    </span>
                    <span>
                      {isGeneratingPlan 
                        ? '全話プロット構築中...' 
                        : (episodesPlan.length === 0 
                            ? `✨ 全${episodeCount}話のプロットをAI生成する` 
                            : `🔄 全${episodeCount}話でプロット再生成`)}
                    </span>
                  </button>
                </div>

                {/* 話数変更時のリマインダー */}
                {episodesPlan.length > 0 && episodesPlan.length !== episodeCount && (
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between text-xs text-amber-800">
                    <span className="flex items-center gap-1.5 font-bold">
                      <span className="material-symbols-outlined text-amber-600 text-sm">warning</span>
                      話数が【全 {episodeCount} 話】に変更されました。最新プロットを再作成するには右上の「プロット再生成」を押してください。
                    </span>
                  </div>
                )}

                {seriesTitle && (
                  <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col gap-1">
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">確定連載タイトル</span>
                    <h3 className="text-sm font-black text-slate-900">『{seriesTitle}』</h3>
                    {overallSynopsis && (
                      <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{overallSynopsis}</p>
                    )}
                  </div>
                )}

                {/* Episodes Plan List or Placeholder Guide */}
                {episodesPlan.length === 0 ? (
                  <div className="py-8 px-4 bg-slate-50 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-center gap-2">
                    <span className="material-symbols-outlined text-3xl text-indigo-400">history_edu</span>
                    <p className="text-xs font-bold text-slate-700">プロットはまだ生成されていません</p>
                    <p className="text-[11px] text-slate-500 max-w-md">
                      上の設定で<strong>連載話数（全{episodeCount}話）</strong>と<strong>作画カット数（{cutsPerEpisode}Cut）</strong>を自由に決めた後、右上の<strong>「✨ 全{episodeCount}話のプロットをAI生成する」</strong>ボタンを押してください。
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                    {displayedEpisodes.map((ep) => (
                      <div key={ep.epNumber} className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200/80 flex items-start gap-2.5 transition-colors">
                        <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-black shrink-0 mt-0.5">
                          第 {ep.epNumber} 話
                        </span>
                        <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                          <span className="text-xs font-bold text-slate-800">{ep.titleJp}</span>
                          <p className="text-[11px] text-slate-500 leading-snug line-clamp-1">{ep.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* ========================================================
            FIXED MODAL FOOTER: 常に最下部に固定表示されるナビゲーション
           ======================================================== */}
        <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 shadow-lg z-20">
          {/* Left Info / Back Button */}
          <div>
            {step === 1 ? (
              currentCandidate && currentCandidate.turnaroundBase64 ? (
                <div className="flex items-center gap-3">
                  <img
                    src={`data:image/png;base64,${currentCandidate.turnaroundBase64}`}
                    alt="Current"
                    className="w-12 h-8 object-cover rounded border border-indigo-200 shrink-0"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span>選択中:</span>
                      <span className="text-indigo-600 font-extrabold">{currentCandidate.name}</span>
                    </span>
                    <span className="text-[11px] text-slate-500 truncate max-w-xs">{currentCandidate.tasteName}</span>
                  </div>
                </div>
              ) : (
                <span className="text-xs text-slate-400 font-medium">三面図を作画し、お気に入りのキャラクターを選んでください</span>
              )
            ) : (
              <button
                type="button"
                onClick={() => setStep(prev => Math.max(1, prev - 1) as any)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">arrow_back</span>
                <span>戻る</span>
              </button>
            )}
          </div>

          {/* Right Primary Action Button */}
          <div>
            {step === 1 && (
              <button
                type="button"
                onClick={() => handleProceedToStep2()}
                disabled={!currentCandidate || !currentCandidate.turnaroundBase64}
                style={{
                  color: !currentCandidate || !currentCandidate.turnaroundBase64 ? '#94a3b8' : '#ffffff'
                }}
                className={`px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all select-none ${
                  !currentCandidate || !currentCandidate.turnaroundBase64
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:brightness-110 active:brightness-95 text-white shadow-md hover:shadow-lg cursor-pointer transform hover:scale-102'
                }`}
              >
                <span>この主人公で決定し、お友達・サブキャラ配役へ</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleProceedToStep3}
                disabled={isGeneratingSubs}
                style={{
                  color: isGeneratingSubs ? '#94a3b8' : '#ffffff'
                }}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all select-none ${
                  isGeneratingSubs
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:brightness-110 active:brightness-95 text-white shadow-md hover:shadow-lg cursor-pointer'
                }`}
              >
                <span>次へ：全話プロット構築＆連載設定</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleLaunch}
                disabled={isGeneratingPlan || episodesPlan.length === 0}
                style={{
                  color: isGeneratingPlan || episodesPlan.length === 0 ? '#94a3b8' : '#ffffff'
                }}
                className={`px-7 py-3 rounded-xl text-xs font-black flex items-center gap-2 transition-all select-none ${
                  isGeneratingPlan || episodesPlan.length === 0
                    ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                    : 'bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:brightness-110 active:brightness-95 text-white shadow-lg hover:shadow-xl cursor-pointer transform hover:scale-102'
                }`}
                title={episodesPlan.length === 0 ? '先にプロットをAI生成してください' : '連載をスタート'}
              >
                <span className="material-symbols-outlined text-lg">rocket_launch</span>
                <span>
                  {episodesPlan.length === 0
                    ? `⚠️ 先にプロットを生成してください（${cutsPerEpisode}Cut × 全${episodeCount}話）`
                    : `🚀 コミック一冊分の自動制作をスタート！（${cutsPerEpisode}Cut × 全${episodeCount}話）`}
                </span>
              </button>
            )}
          </div>
        </div>

      </div>

      {/* 画像拡大Lightbox */}
      {zoomImage && (
        <div 
          className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fadeIn"
          onClick={() => setZoomImage(null)}
        >
          <div 
            className="relative max-w-[90vw] max-h-[90vh] flex flex-col items-center bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full px-4 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between text-white shrink-0">
              <span className="text-xs font-bold truncate max-w-md">{zoomImage.title}</span>
              <button
                onClick={() => setZoomImage(null)}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white cursor-pointer"
              >
                <span className="material-symbols-outlined text-sm">close</span>
              </button>
            </div>
            <div className="p-4 flex items-center justify-center">
              <img 
                src={`data:image/png;base64,${zoomImage.base64}`} 
                alt={zoomImage.title} 
                className="max-h-[75vh] max-w-full object-contain rounded-lg border border-slate-800"
              />
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
