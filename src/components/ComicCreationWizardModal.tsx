import React, { useState, useRef, useEffect, useMemo } from 'react';
import { THEMES, resolveImageModel } from '../constants';
import { CastCharacter, SeriesEpisodePlan, SeriesManifest } from '../types';
import { createDefaultCastCharacter } from '../services/castStorage';
import { Flow } from 'flow-sdk';
import { callWithRetry, safeJsonParse, formatErrorMessage } from '../services/utils';
import { buildGrandDesignPrompt } from '../services/directorService';
import { loadCustomTastes, CustomTasteMap } from '../services/tasteStorage';

export interface TurnaroundCandidate {
  id: string;
  tasteName: string;      // 例: 🏮 レトロ・ノワールサイバー劇画
  tastePromptEn: string;  // 画風プロンプト
  name: string;           // 主人公名
  concept: string;        // 性格・世界観設定
  dnaPromptEn: string;    // 容姿DNA
  turnaroundBase64?: string;
  turnaroundMediaId?: string;
  status: 'idle' | 'generating_image' | 'completed' | 'error';
  errorMessage?: string;
}

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
  // ステップ管理: 1: 世界観選定＆三面図5選, 2: 起承転結プロット(1〜50話), 3: サブキャラ配役, 4: 完了確認＆連載開始
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);

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

  // Step 2: 起承転結ストーリー (1〜50話 & 1話カット数)
  const [episodeCount, setEpisodeCount] = useState<number>(20); // 1〜50話
  const [cutsPerEpisode, setCutsPerEpisode] = useState<number>(30); // 12, 24, 30
  const [seriesTitle, setSeriesTitle] = useState<string>('');
  const [overallSynopsis, setOverallSynopsis] = useState<string>('');
  const [episodesPlan, setEpisodesPlan] = useState<SeriesEpisodePlan[]>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  // Step 3: サブキャラクター
  const [subCharacters, setSubCharacters] = useState<CastCharacter[]>([]);
  const [isGeneratingSubs, setIsGeneratingSubs] = useState(false);

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

  // 選択中の候補を取得
  const currentCandidate = candidates.find(c => c.id === selectedCandidateId) || candidates[0];

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
        ? `🎨 指定された画風（${userPicksCount}個）を反映し、計5体の【画風×主人公三面図】をAI考案中...`
        : `🧠 「${selectedTheme}」に最適な【画風5選 × 主人公三面図】をGeminiが自動考案中...`,
      'process'
    );

    try {
      // ユーザー指定画風のプロンプト指示文
      let customTastesInstruction = '';
    if (isCustomMode) {
      customTastesInstruction = `
【ユーザーが意図的に指定した画風 (${userPicksCount}個)】:
${selectedCustomTastes.map((key, i) => `${i + 1}. 「${key}」 (英語プロンプト例: ${availableTastes[key] || 'masterpiece anime style'})`).join('\n')}

【厳守事項】:
出力する5個の候補のうち、最初の${userPicksCount}個は上記の指定された画風をそのまま「tasteName」および「tastePromptEn」に厳密に採用してください。
残りの${5 - userPicksCount}個の枠は、世界観テーマ「${selectedTheme}」に最高にマッチする全く異なる魅力的な画風をAIが考案して補完してください。
`;
    }

    const prompt = `あなたは世界的人気漫画の編集長兼アートディレクターです。
以下の世界観テーマに最高にマッチする、全くアプローチの異なる【5種類の画風・テイスト】と、それぞれの画風を極限まで活かした魅力的な【主人公キャラクター案】を5組考案してください。

【世界観テーマ】: ${selectedTheme}
${customTastesInstruction}

【5組全体の多様性要件（被りのない多彩な画風・人物像）】
1. 王道少年漫画・ダイナミック劇画（迫力の太線、情熱的）
2. レトロノワール・シックなセル画風（重厚な影、スタイリッシュ）
3. エモーショナル水彩・ネオシティポップ（繊細、色彩豊か）
4. 重厚ダークファンタジー・緻密ペン画（精緻、耽美・退廃美）
5. 先進的サイバー・ポップアニメ（鮮烈、洗練された現代アニメ調）

以下の厳密なJSON配列形式（Markdownコードブロックなしの純粋なJSON配列）で出力してください:
[
  {
    "id": "cand_1",
    "tasteName": "🔥 王道少年熱血・ダイナミック劇画",
    "tastePromptEn": "dynamic shonen manga style, bold black ink lines, high contrast shadows, expressive energetic anime aesthetic, masterpiece",
    "name": "主人公の名前 (肩書)",
    "concept": "性格、信念、武器や特徴（日本語2行程度）",
    "dnaPromptEn": "Detailed English character appearance prompt: gender, age, facial features, striking eyes, expressive hairstyle, signature attire matching ${selectedTheme}"
  },
  {
    "id": "cand_2",
    "tasteName": "🏮 レトロ・ノワールセル画調",
    "tastePromptEn": "retro 90s anime cel shading, film grain, deep shadows, cinematic noir lighting, moody aesthetic, masterpiece",
    "name": "主人公の名前 (肩書)",
    "concept": "性格、信念、武器や特徴（日本語2行程度）",
    "dnaPromptEn": "Detailed English character appearance prompt: gender, age, facial features, striking eyes, expressive hairstyle, signature attire matching ${selectedTheme}"
  },
  {
    "id": "cand_3",
    "tasteName": "🎨 エモーショナル水彩・ネオシティ",
    "tastePromptEn": "soft watercolor anime style, pastel gradients, vibrant emotional rim lighting, clean delicate lines, masterpiece",
    "name": "主人公の名前 (肩書)",
    "concept": "性格、信念、武器や特徴（日本語2行程度）",
    "dnaPromptEn": "Detailed English character appearance prompt: gender, age, facial features, striking eyes, expressive hairstyle, signature attire matching ${selectedTheme}"
  },
  {
    "id": "cand_4",
    "tasteName": "⚔️ 重厚ダークファンタジー劇画",
    "tastePromptEn": "dark fantasy manga style, intricate cross-hatching lineart, grim atmospheric lighting, heavy contrast, masterpiece",
    "name": "主人公の名前 (肩書)",
    "concept": "性格、信念、武器や特徴（日本語2行程度）",
    "dnaPromptEn": "Detailed English character appearance prompt: gender, age, facial features, striking eyes, expressive hairstyle, signature attire matching ${selectedTheme}"
  },
  {
    "id": "cand_5",
    "tasteName": "✨ 先進的サイバー・スタイリッシュアニメ",
    "tastePromptEn": "futuristic modern anime key visual style, crisp sharp linework, vivid accents, sleek high-end anime aesthetic, masterpiece",
    "name": "主人公の名前 (肩書)",
    "concept": "性格、信念、武器や特徴（日本語2行程度）",
    "dnaPromptEn": "Detailed English character appearance prompt: gender, age, facial features, striking eyes, expressive hairstyle, signature attire matching ${selectedTheme}"
  }
]`;

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
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const list = safeJsonParse<any[]>(cleaned, []);

      if (Array.isArray(list) && list.length >= 3) {
        initialCandidates = list.map((item, idx) => ({
          id: item.id || `cand_${idx + 1}`,
          tasteName: item.tasteName || (isCustomMode && selectedCustomTastes[idx] ? selectedCustomTastes[idx] : `画風案 ${idx + 1}`),
          tastePromptEn: item.tastePromptEn || (isCustomMode && selectedCustomTastes[idx] ? availableTastes[selectedCustomTastes[idx]] : 'anime style, masterpiece'),
          name: item.name || `主人公 ${idx + 1}`,
          concept: item.concept || `${selectedTheme}の世界を駆ける主人公`,
          dnaPromptEn: item.dnaPromptEn || `A striking anime character matching ${selectedTheme}`,
          status: 'idle' as const,
        }));
      }
    } catch (textErr: any) {
      console.warn('[ComicWizard] Flow.generate.text failed, fallback to smart candidates:', textErr);
      onAddLog(`⚠️ AIテキスト考案が一時応答待ちのため、スマート規定候補（指定画風準拠）を自動適用して三面図作画を開始します`, 'warning');
    }

    // 候補が空の場合（エラー時含む）は、ユーザー指定画風を確実に反映したフォールバックを自動生成
    if (initialCandidates.length === 0) {
      initialCandidates = [
        {
          id: 'cand_1',
          tasteName: isCustomMode && selectedCustomTastes[0] ? selectedCustomTastes[0] : '🔥 王道少年熱血・ダイナミック劇画',
          tastePromptEn: isCustomMode && selectedCustomTastes[0] && availableTastes[selectedCustomTastes[0]] ? availableTastes[selectedCustomTastes[0]] : 'dynamic shonen manga style, bold black ink lines, high contrast shadows, expressive energetic anime aesthetic, masterpiece',
          name: '疾風の剣士 (熱血型)',
          concept: '不屈の闘志で困難を切り開く主人公。真っ直ぐな瞳と正義感を宿す。',
          dnaPromptEn: `A passionate young anime hero, fiery determined eyes, spiky hair, rugged stylish traveler attire matching ${selectedTheme}`,
          status: 'idle'
        },
        {
          id: 'cand_2',
          tasteName: isCustomMode && selectedCustomTastes[1] ? selectedCustomTastes[1] : '🏮 レトロ・ノワールセル画調',
          tastePromptEn: isCustomMode && selectedCustomTastes[1] && availableTastes[selectedCustomTastes[1]] ? availableTastes[selectedCustomTastes[1]] : 'retro 90s anime cel shading, film grain, deep shadows, cinematic noir lighting, moody aesthetic, masterpiece',
          name: '影の仕事人 (クール型)',
          concept: '冷静沈着に事件の裏を暴く孤高の主人公。コートと懐中時計がトレードマーク。',
          dnaPromptEn: `A cool analytical anime protagonist, sharp piercing eyes, dark flowing coat, mysterious aura matching ${selectedTheme}`,
          status: 'idle'
        },
        {
          id: 'cand_3',
          tasteName: isCustomMode && selectedCustomTastes[2] ? selectedCustomTastes[2] : '🎨 エモーショナル水彩・ネオシティ',
          tastePromptEn: isCustomMode && selectedCustomTastes[2] && availableTastes[selectedCustomTastes[2]] ? availableTastes[selectedCustomTastes[2]] : 'soft watercolor anime style, pastel gradients, vibrant emotional rim lighting, clean delicate lines, masterpiece',
          name: '奇跡の使い手 (神秘型)',
          concept: '隠された力を持ち、人々の心を救う主人公。透明感ある佇まい。',
          dnaPromptEn: `A delicate ethereal anime protagonist, expressive gentle eyes, soft pastel colored hair, ornate modern outfit matching ${selectedTheme}`,
          status: 'idle'
        },
        {
          id: 'cand_4',
          tasteName: isCustomMode && selectedCustomTastes[3] ? selectedCustomTastes[3] : '⚔️ 重厚ダークファンタジー劇画',
          tastePromptEn: isCustomMode && selectedCustomTastes[3] && availableTastes[selectedCustomTastes[3]] ? availableTastes[selectedCustomTastes[3]] : 'dark fantasy manga style, intricate cross-hatching lineart, grim atmospheric lighting, heavy contrast, masterpiece',
          name: '宿命の求道者 (重厚型)',
          concept: '重い宿命を背負いながら戦い続ける主人公。鍛え抜かれた肉体と歴戦の傷。',
          dnaPromptEn: `A battle-hardened anime warrior, intense scarred face, weathered mantle, armored details matching ${selectedTheme}`,
          status: 'idle'
        },
        {
          id: 'cand_5',
          tasteName: isCustomMode && selectedCustomTastes[4] ? selectedCustomTastes[4] : '✨ 先進的サイバー・スタイリッシュアニメ',
          tastePromptEn: isCustomMode && selectedCustomTastes[4] && availableTastes[selectedCustomTastes[4]] ? availableTastes[selectedCustomTastes[4]] : 'futuristic modern anime key visual style, crisp sharp linework, vivid accents, sleek high-end anime aesthetic, masterpiece',
          name: '電脳のトリックスター (スマート型)',
          concept: '圧倒的な機転とスピードで敵を翻弄する現代風主人公。ヘッドギアとバイザー。',
          dnaPromptEn: `A stylish sleek anime protagonist, radiant ruby irises, modern tailored jacket with glowing accents matching ${selectedTheme}`,
          status: 'idle'
        }
      ];
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
            2
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
  // Step 2 への決定＆遷移ハンドラー（直接キャラクターを渡して即遷移可能）
  // =========================================================================
  const handleProceedToStep2 = (cand?: TurnaroundCandidate) => {
    const target = cand || currentCandidate;
    if (!target || !target.turnaroundBase64) {
      onAddLog(`⚠️ 三面図が完成しているキャラクターを1つ選択してください`, 'warning');
      return;
    }
    setSelectedCandidateId(target.id);
    setStep(2);
    onAddLog(`✨ 主人公「${target.name}」(${target.tasteName}) で決定しました！全${episodeCount}話のストーリーを策定します。`, 'success');

    // まだプロットが策定されていなければ、自動で起承転結プロット生成をトリガー！
    if (episodesPlan.length === 0) {
      setTimeout(() => {
        handleGenerateStoryPlan(target);
      }, 200);
    }
  };

  // =========================================================================
  // Step 2: 選択した主人公三面図から起承転結（全1〜50話）ストーリー策定
  // =========================================================================
  const handleGenerateStoryPlan = async (overrideTarget?: TurnaroundCandidate) => {
    const target = overrideTarget || currentCandidate;
    if (!target) return;

    setIsGeneratingPlan(true);
    onAddLog(`📜 主人公「${target.name}」を軸に、全${episodeCount}話（各話${cutsPerEpisode}Cut）の起承転結ストーリーをAI策定中...`, 'process');

    const prompt = buildGrandDesignPrompt(
      episodeCount,
      '日本',
      selectedTheme,
      undefined,
      true, // isMangaMode
      false,
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
        setEpisodesPlan(parsed.episodesPlan);
        onAddLog(`🎉 コミック連載『${parsed.seriesTitle}』（全${parsed.episodesPlan.length}話）の起承転結プロットが確定しました！`, 'success');
      } else {
        throw new Error('ストーリープロットの生成に失敗しました');
      }
    } catch (err: any) {
      onAddLog(`❌ 起承転結プロット生成エラー: ${formatErrorMessage(err)}`, 'error');
      // フォールバック
      const dummyPlan: SeriesEpisodePlan[] = Array.from({ length: episodeCount }, (_, i) => ({
        epNumber: i + 1,
        titleJp: `第${i + 1}話 ${i < Math.round(episodeCount * 0.25) ? '運命の幕開け' : i < Math.round(episodeCount * 0.55) ? '深まる謎と試練' : i < Math.round(episodeCount * 0.85) ? '最大の激突と転換' : '大団円と未来'}`,
        titleEn: `Episode ${i + 1} Arc`,
        summary: `主人公${target.name}が立ち向かう第${i + 1}話の試練と成長`
      }));
      setSeriesTitle(`${target.name}活劇録`);
      setOverallSynopsis(`${selectedTheme}の世界で${target.name}が仲間と共に織りなす全${episodeCount}話の大河ストーリー`);
      setEpisodesPlan(dummyPlan);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // =========================================================================
  // Step 3: サブキャラ・お友達の自動配役（2〜3名）
  // =========================================================================
  const handleProceedToStep3 = async () => {
    if (episodesPlan.length === 0) {
      await handleGenerateStoryPlan();
    }
    setStep(3);
    // 自動でサブキャラ生成をトリガー
    if (subCharacters.length === 0) {
      handleGenerateSubCharacters();
    }
  };

  const handleGenerateSubCharacters = async () => {
    if (!currentCandidate) return;
    setIsGeneratingSubs(true);
    onAddLog(`👥 物語『${seriesTitle || currentCandidate.name}』を彩るお友達・相棒・宿敵などサブキャラを自動配役中...`, 'process');

    const prompt = `あなたは一流の漫画編集者です。
漫画『${seriesTitle || currentCandidate.name}』（全${episodeCount}話）のストーリー展開と主人公「${currentCandidate.name}」を強力に引き立てる、
魅力的なサブキャラクター（お友達・相棒、ヒロイン、宿敵・ライバル）を【2〜3名】考案してください。

【世界観テーマ】: ${selectedTheme}
【画風テイスト】: ${currentCandidate.tasteName}
【主人公】: ${currentCandidate.name} (${currentCandidate.concept})
【あらすじ】: ${overallSynopsis}

以下の厳密なJSON配列形式（Markdownコードブロックなしの純粋なJSON配列）で出力してください:
[
  {
    "name": "キャラクター名 (肩書)",
    "role": "partner",
    "concept": "主人公との関係性・お友達・相棒としての役割（日本語2行）",
    "dnaPromptEn": "Detailed English character appearance prompt: gender, age, hair, eyes, distinct clothing matching ${selectedTheme}"
  },
  {
    "name": "キャラクター名 (肩書)",
    "role": "antagonist",
    "concept": "主人公と対立する宿敵・ライバルとしての役割（日本語2行）",
    "dnaPromptEn": "Detailed English character appearance prompt: gender, age, hair, eyes, distinct clothing matching ${selectedTheme}"
  }
]`;

    try {
      const res = await callWithRetry<any>(
        () => Flow.generate.text(prompt),
        (attempt, max, delay, err) => {
          onAddLog(`⚠️ [サブキャラ考案] リトライ (${attempt}/${max}) ${Math.round(delay / 1000)}秒待機... (${formatErrorMessage(err)})`, 'warning');
        },
        5
      );
      const text = res?.text || (typeof res === 'string' ? res : '');
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const list = safeJsonParse<any[]>(cleaned, []);

      if (Array.isArray(list) && list.length > 0) {
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
        createDefaultCastCharacter(`sub_1_${Date.now()}`, '頼れる相棒・親友', 'partner', `A trustworthy loyal friend and companion of ${currentCandidate.name}, anime style`),
        createDefaultCastCharacter(`sub_2_${Date.now()}`, '宿命の好敵手', 'antagonist', `A fierce rival and antagonist opposing ${currentCandidate.name}, sharp intense eyes`)
      ];
      setSubCharacters(dummySubs);
    } finally {
      setIsGeneratingSubs(false);
    }
  };

  // =========================================================================
  // Step 4: コミック一冊分（30Cut × 1〜50話）の自動制作をローンチ！
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
    if (currentCandidate.turnaroundBase64) {
      mainProtagonist.turnaroundBase64 = currentCandidate.turnaroundBase64;
      mainProtagonist.turnaroundMediaId = currentCandidate.turnaroundMediaId || undefined;
      mainProtagonist.avatarBase64 = currentCandidate.turnaroundBase64;
    }

    const manifest: SeriesManifest = {
      seriesTitle: seriesTitle || `${currentCandidate.name}物語`,
      totalEpisodes: episodeCount,
      currentEpisodeId: 1,
      completedEpisodeIds: [],
      overallSynopsis: overallSynopsis,
      episodesPlan: episodesPlan,
      referenceAsset: currentCandidate.turnaroundBase64 ? {
        name: `${currentCandidate.name} [三面図マスター]`,
        base64: currentCandidate.turnaroundBase64,
        mimeType: 'image/png',
        characterDna: currentCandidate.dnaPromptEn,
        styleDna: currentCandidate.tastePromptEn,
      } : undefined,
    };

    onLaunchComicSeries({
      theme: selectedTheme,
      taste: currentCandidate.tasteName,
      protagonist: mainProtagonist,
      subCharacters,
      manifest,
      totalEpisodes: episodeCount,
      cutsPerEpisode: cutsPerEpisode, // 30Cut標準！
    });

    onAddLog(`🚀 コミック連載『${manifest.seriesTitle}』（全${episodeCount}話 × 各話${cutsPerEpisode}Cut = 計${episodeCount * cutsPerEpisode}Cut）の自動制作を開始しました！`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 material-symbols-outlined text-2xl">
              auto_stories
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold">コミック一冊分 自動プロデュース</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-slate-900 font-extrabold shadow-sm">
                  COMIC WIZARD PRO
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                世界観選定 ➔ 最適画風5選×三面図 ➔ 起承転結(1〜50話) ➔ サブキャラ配役 ➔ 30Cut連載
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
            { num: 1, label: '① 世界観 ＆ 画風5選・三面図' },
            { num: 2, label: '② 起承転結プロット (1〜50話)' },
            { num: 3, label: '③ お友達・サブキャラ配役' },
            { num: 4, label: '④ コミック連載スタート' },
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
              STEP 1: 世界観テーマ選定 ＆ 最適画風5選×三面図AI作画
             ======================================================== */}
          {step === 1 && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              
              {/* Guidance Box */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/80 p-3.5 rounded-xl flex items-start gap-3 text-indigo-950 shadow-2xs">
                <span className="material-symbols-outlined text-indigo-600 mt-0.5 text-xl">auto_fix_high</span>
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">世界観を選び、「三面図を一括AI作画」ボタンを押してください。</p>
                  <p className="text-indigo-700 mt-0.5">
                    基本は<strong>「AIおまかせ」</strong>で世界観に最適な5画風×三面図を自動作画しますが、<strong>「自分で画風を指定」</strong>で好きな画風を1〜5個ピンポイントで指定することも可能です！
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
                    className="px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs"
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
                      className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
                        tasteMode === 'ai_auto'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="material-symbols-outlined text-xs">casino</span>
                      🎲 AIおまかせ (最適5選)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTasteMode('custom_pick')}
                      className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all ${
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
                        好きな画風を <strong>1〜5個</strong> クリックして選択してください（残りはAIが世界観に合わせて自動補完します）:
                      </span>
                      {selectedCustomTastes.length > 0 && (
                        <button
                          type="button"
                          onClick={() => setSelectedCustomTastes([])}
                          className="text-[11px] text-rose-600 hover:underline font-bold"
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
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold"
                          >
                            <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center font-black">
                              {idx + 1}
                            </span>
                            <span className="truncate max-w-[160px]">{tKey}</span>
                            <button
                              type="button"
                              onClick={() => handleToggleTaste(tKey)}
                              className="text-slate-400 hover:text-rose-600"
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
                        placeholder="画風名やキーワードで絞り込み..."
                        value={tasteSearchQuery}
                        onChange={e => setTasteSearchQuery(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-800"
                      />
                    </div>

                    {/* Tastes Chips List */}
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                      {filteredTasteKeys.map(tKey => {
                        const isPicked = selectedCustomTastes.includes(tKey);
                        return (
                          <button
                            key={tKey}
                            type="button"
                            onClick={() => handleToggleTaste(tKey)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 ${
                              isPicked
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300'
                            }`}
                          >
                            {isPicked && <span className="material-symbols-outlined text-[13px]">check</span>}
                            <span>{tKey}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Main Action Trigger */}
                <div className="pt-2 border-t border-slate-100 flex justify-end">
                  <button
                    onClick={handleGenerate5Candidates}
                    disabled={isBrainstormingCandidates || activeGeneratingIndex !== null}
                    className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 hover:from-indigo-700 hover:to-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                  >
                    <span className={`material-symbols-outlined text-sm ${isBrainstormingCandidates || activeGeneratingIndex !== null ? 'animate-spin' : ''}`}>
                      {isBrainstormingCandidates || activeGeneratingIndex !== null ? 'autorenew' : 'palette'}
                    </span>
                    <span>
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
                          {/* Selected Badge */}
                          {isSelected && (
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
                                  className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-slate-950/70 hover:bg-slate-950 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow-sm"
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
                                // すでに選択されている場合、またはクリックされた時に即座に Step 2 に進む！
                                handleProceedToStep2(cand);
                              }}
                              disabled={!hasImage}
                              className={`w-full py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 shadow-2xs ${
                                isSelected 
                                  ? 'bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white animate-pulse' 
                                  : hasImage 
                                  ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200' 
                                  : 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'
                              }`}
                            >
                              {isSelected ? (
                                <>
                                  <span>🚀 決定して次へ ➔</span>
                                </>
                              ) : hasImage ? (
                                'このキャラで決定'
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
              STEP 2: 話数自由選択 (1〜50話) ＆ 起承転結プロット構築
             ======================================================== */}
          {step === 2 && currentCandidate && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              
              {/* Selected Protagonist Summary Header */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center gap-4 shadow-2xs">
                {currentCandidate.turnaroundBase64 && (
                  <img
                    src={`data:image/png;base64,${currentCandidate.turnaroundBase64}`}
                    alt={currentCandidate.name}
                    className="w-24 h-14 object-cover rounded-lg border border-slate-200 cursor-pointer shrink-0"
                    onClick={() => setZoomImage({ base64: currentCandidate.turnaroundBase64!, title: currentCandidate.name })}
                  />
                )}
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                      {currentCandidate.tasteName}
                    </span>
                    <span className="text-xs font-extrabold text-slate-800">
                      主人公: {currentCandidate.name}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">{currentCandidate.concept}</p>
                </div>
              </div>

              {/* Volume & Cuts Guidance */}
              <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl flex items-start gap-3 text-amber-950">
                <span className="material-symbols-outlined text-amber-600 mt-0.5 text-xl">help</span>
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">
                    💡 1カット＝漫画の「1ページ（2〜5コマ割り）」に相当します！
                  </p>
                  <p className="text-amber-800 mt-0.5">
                    <strong>30Cut</strong>は、月刊漫画誌の読み切りや第1話（約30ページ / 約60〜120コマ）に相当する<strong>本格的で読み応え満点な大ボリューム</strong>です。<br />
                    話数は「1話（読切）」〜「50話（長編大河）」まで自由にお選びいただけます。
                  </p>
                </div>
              </div>

              {/* Episode Count & Cuts Settings Box */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-4 shadow-2xs">
                
                {/* 1話〜50話 選択セクション */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-indigo-500">library_books</span>
                      連載話数: <span className="text-indigo-600 font-black text-sm">{episodeCount} 話</span>
                      <span className="text-slate-400 font-normal">
                        ({episodeCount === 1 ? '短編読切' : episodeCount <= 5 ? 'ミニ連載' : episodeCount <= 20 ? '単行本1冊分' : '大河長編大作'})
                      </span>
                    </label>

                    {/* 話数クイックプリセットボタン */}
                    <div className="flex items-center gap-1.5">
                      {[1, 3, 10, 20, 50].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setEpisodeCount(preset)}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-all border ${
                            episodeCount === preset
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                              : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {preset}話{preset === 1 ? '(読切)' : preset === 20 ? '(1冊分)' : preset === 50 ? '(大河)' : ''}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 話数スライダー & 数値入力 */}
                  <div className="flex items-center gap-4 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    <input
                      type="range"
                      min={1}
                      max={50}
                      value={episodeCount}
                      onChange={e => setEpisodeCount(Number(e.target.value))}
                      className="flex-1 accent-indigo-600 cursor-pointer"
                    />
                    <div className="flex items-center gap-1 shrink-0">
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={episodeCount}
                        onChange={e => setEpisodeCount(Math.min(50, Math.max(1, Number(e.target.value) || 1)))}
                        className="w-14 px-2 py-1 text-xs font-bold text-center border border-slate-300 rounded focus:outline-none focus:border-indigo-500 bg-white"
                      />
                      <span className="text-xs font-bold text-slate-600">話</span>
                    </div>
                  </div>
                </div>

                {/* 1話あたりのカット数選択 */}
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800">1話あたりのカット数 (ページ数):</span>
                    <span className="text-[11px] text-slate-500">※マルチパネル(2〜5コマ割)が適用されます</span>
                  </div>

                  <div className="flex items-center gap-2">
                    {[
                      { cuts: 12, label: '12Cut (短編・約12P)' },
                      { cuts: 24, label: '24Cut (標準・約24P)' },
                      { cuts: 30, label: '⭐ 30Cut (推奨・約30P)' },
                    ].map(cOpt => (
                      <button
                        key={cOpt.cuts}
                        type="button"
                        onClick={() => setCutsPerEpisode(cOpt.cuts)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          cutsPerEpisode === cOpt.cuts
                            ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {cOpt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* AIプロット策定トリガーボタン */}
                <button
                  type="button"
                  onClick={() => handleGenerateStoryPlan()}
                  disabled={isGeneratingPlan}
                  className="w-full py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-all"
                >
                  <span className={`material-symbols-outlined text-sm ${isGeneratingPlan ? 'animate-spin' : ''}`}>
                    {isGeneratingPlan ? 'autorenew' : 'psychology'}
                  </span>
                  <span>
                    {isGeneratingPlan 
                      ? `全${episodeCount}話の起承転結プロットをAI構築中...` 
                      : episodesPlan.length > 0 
                      ? `全${episodeCount}話の起承転結プロットを再構築する` 
                      : `📜 全${episodeCount}話の起承転結プロットをAI構築する`}
                  </span>
                </button>
              </div>

              {/* Episodes List Preview */}
              {episodesPlan.length > 0 && (
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-amber-500 text-sm">menu_book</span>
                      <h4 className="text-xs font-bold text-slate-900">{seriesTitle}</h4>
                    </div>
                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                      全{episodesPlan.length}話・起承転結プロット確定
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {overallSynopsis}
                  </p>

                  <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto pr-1">
                    {episodesPlan.map((p) => {
                      const actBadge = 
                        p.epNumber <= Math.max(1, Math.round(episodeCount * 0.25)) ? 'bg-emerald-100 text-emerald-800' :
                        p.epNumber <= Math.max(2, Math.round(episodeCount * 0.55)) ? 'bg-indigo-100 text-indigo-800' :
                        p.epNumber <= Math.max(3, Math.round(episodeCount * 0.85)) ? 'bg-rose-100 text-rose-800' :
                        'bg-amber-100 text-amber-800';
                      const actName = 
                        p.epNumber <= Math.max(1, Math.round(episodeCount * 0.25)) ? '起' :
                        p.epNumber <= Math.max(2, Math.round(episodeCount * 0.55)) ? '承' :
                        p.epNumber <= Math.max(3, Math.round(episodeCount * 0.85)) ? '転' : '結';

                      return (
                        <div key={p.epNumber} className="p-2 bg-slate-50 rounded-lg border border-slate-100 flex items-start gap-2.5">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-black shrink-0 ${actBadge}`}>
                            {actName} 第{p.epNumber}話
                          </span>
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <span className="text-xs font-bold text-slate-800 truncate">{p.titleJp}</span>
                            <span className="text-[11px] text-slate-500 leading-tight line-clamp-1">{p.summary}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>
          )}

          {/* ========================================================
              STEP 3: お友達・サブキャラクター自動配役
             ======================================================== */}
          {step === 3 && currentCandidate && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              
              <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl flex items-start gap-3 text-amber-950">
                <span className="material-symbols-outlined text-amber-600 mt-0.5 text-xl">group</span>
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">物語を彩る「お友達・相棒・ライバル」サブキャラクターを自動配役しました！</p>
                  <p className="text-amber-800 mt-0.5">
                    主人公との掛け合いを行い、全{episodeCount}話のコミック内で活躍します。
                  </p>
                </div>
              </div>

              {/* Cast Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {/* Main Protagonist Card */}
                <div className="bg-white p-3.5 rounded-xl border-2 border-indigo-500 flex flex-col gap-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 font-extrabold border border-indigo-300">
                      ★ 主人公
                    </span>
                    <span className="material-symbols-outlined text-indigo-500 text-sm">stars</span>
                  </div>
                  <h5 className="text-xs font-bold text-slate-900">{currentCandidate.name}</h5>
                  <p className="text-[11px] text-slate-500 leading-tight line-clamp-3">{currentCandidate.concept}</p>
                </div>

                {/* Sub Characters Cards */}
                {subCharacters.map((sub, idx) => {
                  const roleBadge = 
                    sub.role === 'partner' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                    sub.role === 'antagonist' ? 'bg-rose-100 text-rose-800 border-rose-200' :
                    'bg-slate-100 text-slate-700 border-slate-200';
                  const roleName = 
                    sub.role === 'partner' ? '🤝 相棒・お友達' :
                    sub.role === 'antagonist' ? '🔥 宿敵・ライバル' : '👥 サブキャスト';

                  return (
                    <div key={sub.id || idx} className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-col gap-2 shadow-2xs">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${roleBadge}`}>
                          {roleName}
                        </span>
                      </div>
                      <h5 className="text-xs font-bold text-slate-900">{sub.name}</h5>
                      <p className="text-[11px] text-slate-500 leading-tight line-clamp-3 font-mono">{sub.dnaPromptEn}</p>
                    </div>
                  );
                })}
              </div>

              {isGeneratingSubs && (
                <div className="p-4 bg-slate-100 rounded-xl flex items-center justify-center gap-2 text-indigo-600 text-xs font-bold">
                  <span className="material-symbols-outlined animate-spin text-sm">autorenew</span>
                  <span>サブキャラクターをAI配役中...</span>
                </div>
              )}

            </div>
          )}

          {/* ========================================================
              STEP 4: コミック連載スタート（最終確認）
             ======================================================== */}
          {step === 4 && currentCandidate && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              
              <div className="bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-purple-500/10 border border-indigo-200 p-4 rounded-xl flex flex-col gap-2 text-slate-800">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-xl">verified</span>
                  <h4 className="text-sm font-bold text-slate-900">コミック一冊分の自動プロデュース準備が完了しました！</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  下のボタンを押すと、既存のドラマ連番制作スタジオ上で、
                  <strong>漫画コマ割り（Multi-Panel）ON</strong>、<strong>1話{cutsPerEpisode}カット</strong>で全{episodeCount}話の連続コミック制作が自動スタートします。
                </p>
              </div>

              {/* Specification Summary Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col gap-3.5 shadow-xs">
                <h5 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">制作スペック概要</h5>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-bold">タイトル</span>
                    <span className="font-bold text-slate-900">{seriesTitle || `${currentCandidate.name}物語`}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-bold">世界観・テーマ</span>
                    <span className="font-bold text-slate-900 truncate" title={selectedTheme}>{selectedTheme}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-bold">決定した画風テイスト</span>
                    <span className="font-bold text-indigo-700 truncate" title={currentCandidate.tasteName}>{currentCandidate.tasteName}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-bold">総制作ボリューム</span>
                    <span className="font-extrabold text-indigo-600">全{episodeCount}話 × 各話{cutsPerEpisode}Cut (計{episodeCount * cutsPerEpisode}コマ)</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-bold">コマ割り演出</span>
                    <span className="font-extrabold text-purple-600">マンガ風コマ割り (Multi-Panel) ON</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-bold">登録キャスト</span>
                    <span className="font-bold text-slate-900">主人公 ＋ サブキャラ{subCharacters.length}名</span>
                  </div>
                </div>
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
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1"
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
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:from-emerald-700 hover:to-purple-700 disabled:opacity-40 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all transform hover:scale-102 cursor-pointer"
              >
                <span>この主人公で決定し、起承転結プロットへ (全1〜50話)</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleProceedToStep3}
                disabled={isGeneratingPlan}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
              >
                <span>次へ：お友達・サブキャラを自動配役</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={() => setStep(4)}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
              >
                <span>次へ：連載スタートの最終確認</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                onClick={handleLaunch}
                className="px-7 py-3 bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:from-emerald-700 hover:to-purple-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all transform hover:scale-102"
              >
                <span className="material-symbols-outlined text-lg">rocket_launch</span>
                <span>🚀 コミック一冊分の自動制作をスタート！</span>
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
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-white"
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
