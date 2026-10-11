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

// 起承転結の顔（喜怒哀楽・4表情）
export interface KishotenketsuFace {
  stage: 'ki' | 'sho' | 'ten' | 'ketsu';
  stageLabel: string;
  stageSub: string;
  expType: ExpressionType;
  promptModifierEn: string;
  base64?: string;
  mediaId?: string;
  status: 'idle' | 'generating' | 'completed' | 'error';
  errorMessage?: string;
}

const DEFAULT_FACES: KishotenketsuFace[] = [
  {
    stage: 'ki',
    stageLabel: '【起】通常・決意',
    stageSub: '物語の幕開け、普段の佇まい・真剣な眼差し',
    expType: 'neutral',
    promptModifierEn: 'neutral calm expression, steady confident resolute gaze, sharp facial features',
    status: 'idle'
  },
  {
    stage: 'sho',
    stageLabel: '【承】笑顔・希望',
    stageSub: '仲間との出会い、笑顔・希望に満ちた表情',
    expType: 'happy',
    promptModifierEn: 'bright gentle smile, warm happy eyes, cheerful friendly expression',
    status: 'idle'
  },
  {
    stage: 'ten',
    stageLabel: '【転】怒り・焦燥・激闘',
    stageSub: '最大の危機、強敵との対峙・気迫の叫び',
    expType: 'angry',
    promptModifierEn: 'intense angry expression, sharp piercing glare, furrowed brows, gritted teeth, fierce battle focus',
    status: 'idle'
  },
  {
    stage: 'ketsu',
    stageLabel: '【結】哀愁・感涙・大団円',
    stageSub: '試練を越えて、感涙・静かな微笑み・達成感',
    expType: 'sad',
    promptModifierEn: 'sorrowful melancholy expression with gentle touching smile, teary emotional eyes, poignant sadness and relief',
    status: 'idle'
  }
];

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
  // ステップ管理:
  // 1: 世界観選定＆画風5選・三面図
  // 2: 主人公の起承転結・喜怒哀楽の顔（表情作画）
  // 3: お友達・サブキャラ配役
  // 4: 話数選択(1〜50話)＆起承転結プロット＆連載スタート
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

  // Step 2: 主人公の起承転結・表情差分（4表情）
  const [protagonistFaces, setProtagonistFaces] = useState<KishotenketsuFace[]>(DEFAULT_FACES);
  const [isGeneratingFaces, setIsGeneratingFaces] = useState(false);
  const [activeGeneratingFaceIndex, setActiveGeneratingFaceIndex] = useState<number | null>(null);

  // Step 3: サブキャラクター（お友達・相棒・宿敵）
  const [subCharacters, setSubCharacters] = useState<CastCharacter[]>([]);
  const [isGeneratingSubs, setIsGeneratingSubs] = useState(false);

  // Step 4: 起承転結ストーリー (1〜50話 & 1話カット数)
  const [episodeCount, setEpisodeCount] = useState<number>(20); // 1〜50話
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

      const prompt = `あなたは世界的人気漫画の編集長兼アートディレクターです。
以下の世界観テーマに最高にマッチする、全くアプローチの異なる【5種類の画風・テイスト】と、それぞれの画風を極限まで活かした魅力的な【主人公キャラクター案】を5組考案してください。

【世界観テーマ】: ${selectedTheme}
${customTastesInstruction}

【出力要件】
世界観テーマ「${selectedTheme}」の魅力を多角的に引き出す5組の「画風×主人公」を考案してください。
以下の厳密なJSON配列形式（Markdownコードブロックなしの純粋なJSON配列）で出力してください:
[
  {
    "id": "cand_1",
    "tasteName": "世界観にマッチする独創的画風名 (日本語)",
    "tastePromptEn": "Detailed English art style prompt matching the tasteName, masterpiece",
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
          initialCandidates = list.map((item, idx) => {
            const isUserPick = isCustomMode && idx < selectedCustomTastes.length;
            const tasteName = isUserPick ? selectedCustomTastes[idx] : (item.tasteName || `画風案 ${idx + 1}`);
            const tastePromptEn = isUserPick ? (availableTastes[selectedCustomTastes[idx]] || item.tastePromptEn) : (item.tastePromptEn || 'anime style, masterpiece');
            return {
              id: item.id || `cand_${idx + 1}`,
              tasteName,
              tastePromptEn,
              name: item.name || `主人公 ${idx + 1}`,
              concept: item.concept || `${selectedTheme}の世界を駆ける主人公`,
              dnaPromptEn: item.dnaPromptEn || `A striking anime character matching ${selectedTheme}`,
              status: 'idle' as const,
              isUserSpecified: isUserPick,
            };
          });
        }
      } catch (textErr: any) {
        console.warn('[ComicWizard] Flow.generate.text failed, fallback to smart candidates:', textErr);
        onAddLog(`⚠️ AIテキスト考案が一時応答待ちのため、世界観「${selectedTheme}」に最適化した候補を動的構築して三面図作画を開始します`, 'warning');
      }

      // 候補が空の場合（エラー時含む）は、ユーザー指定画風またはテーマに合わせた動的フォールバックを自動生成
      if (initialCandidates.length === 0) {
        const allTasteKeys = Object.keys(availableTastes);
        const shuffledTastes = [...allTasteKeys].sort(() => Math.random() - 0.5);

        const fallbackArchetypes = [
          { name: '不屈の切り込み役', concept: '強い正義感と不屈の闘志で道を切り開く情熱的な主人公' },
          { name: '影の策士・調査官', concept: '冷静沈着に事件の真相を暴く孤高の主人公' },
          { name: '神秘の継承者', concept: '秘められた力を宿し、人々を癒やし導く心優しき主人公' },
          { name: '歴戦の重装求道者', concept: '己の掟に従い重い宿命と向き合う歴戦の主人公' },
          { name: '新時代のトリックスター', concept: '圧倒的な機転とスピードで常識を覆す現代風主人公' },
        ];

        initialCandidates = Array.from({ length: 5 }, (_, idx) => {
          const isUserPick = isCustomMode && idx < selectedCustomTastes.length;
          let tasteName = '';
          let tastePromptEn = '';

          if (isUserPick) {
            tasteName = selectedCustomTastes[idx];
            tastePromptEn = availableTastes[tasteName] || 'anime masterpiece';
          } else {
            tasteName = shuffledTastes[idx % shuffledTastes.length] || `画風案 ${idx + 1}`;
            tastePromptEn = availableTastes[tasteName] || 'anime masterpiece';
          }

          const arch = fallbackArchetypes[idx];
          return {
            id: `cand_${idx + 1}`,
            tasteName,
            tastePromptEn,
            name: `${arch.name}`,
            concept: `${selectedTheme}の世界で${arch.concept}`,
            dnaPromptEn: `A striking anime protagonist matching ${selectedTheme}, expressive determined eyes, detailed attire matching ${tasteName}`,
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
  // Step 2 への決定＆遷移ハンドラー（三面図決定 ➔ 起承転結の顔作画へ）
  // =========================================================================
  const handleProceedToStep2 = (cand?: TurnaroundCandidate) => {
    const target = cand || currentCandidate;
    if (!target || !target.turnaroundBase64) {
      onAddLog(`⚠️ 三面図が完成しているキャラクターを1つ選択してください`, 'warning');
      return;
    }
    setSelectedCandidateId(target.id);
    setStep(2);
    onAddLog(`✨ 主人公「${target.name}」(${target.tasteName}) を選択しました！起承転結（喜怒哀楽・4表情）を作画します。`, 'success');

    // まだ表情が作画されていない場合は自動で作画を開始！
    const hasAnyFace = protagonistFaces.some(f => Boolean(f.base64));
    if (!hasAnyFace) {
      setTimeout(() => {
        handleGenerateAllFaces(target);
      }, 200);
    }
  };

  // =========================================================================
  // Step 2: 主人公の起承転結・喜怒哀楽の顔（4表情）AI作画
  // =========================================================================
  const handleGenerateAllFaces = async (targetCand?: TurnaroundCandidate) => {
    const target = targetCand || currentCandidate;
    if (!target) return;

    setIsGeneratingFaces(true);
    onAddLog(`🎭 主人公「${target.name}」の起承転結（喜怒哀楽・4表情）を一括AI作画開始します...`, 'process');

    const modelDef = resolveImageModel();
    const safeModelName = modelDef?.name || '🍌 Nano Banana 2';
    const safeNegative = 'worst quality, normal quality, lowres, deformed, distorted, bad anatomy, bad hands, blurry, complex background, text, watermark';

    for (let i = 0; i < protagonistFaces.length; i++) {
      const face = protagonistFaces[i];
      setActiveGeneratingFaceIndex(i);
      setProtagonistFaces(prev => prev.map((f, idx) => idx === i ? { ...f, status: 'generating' } : f));
      onAddLog(`🎨 [${i + 1}/4] ${face.stageLabel} をAI作画中...`, 'process');

      // ポートレート構図（胸上アップ・表情強調）
      const portraitPrompt = `${target.dnaPromptEn}, anime character portrait, upper chest and face close-up, ${face.promptModifierEn}, facing camera, clean simple background, consistent facial features and hairstyle, masterpiece. Art style: ${target.tastePromptEn}`;

      try {
        const res = await callWithRetry<any>(
          () => Flow.generate.image({
            prompt: portraitPrompt,
            negativePrompt: safeNegative,
            aspectRatio: '1:1',
            modelDisplayName: safeModelName,
          }),
          (att, max, d, e) => {
            onAddLog(`⚠️ [${face.stageLabel}] 作画リトライ (${att}/${max}) (理由: ${formatErrorMessage(e)})`, 'warning');
          },
          3
        );

        const base64 = res?.base64 || res?.image?.base64;
        const mediaId = res?.mediaId || res?.image?.mediaId;

        if (base64) {
          setProtagonistFaces(prev => prev.map((f, idx) => 
            idx === i ? { ...f, base64, mediaId, status: 'completed' } : f
          ));
          onAddLog(`✅ [${i + 1}/4] ${face.stageLabel} の作画が完了！`, 'success');
        } else {
          throw new Error('画像データが取得できませんでした');
        }
      } catch (err: any) {
        onAddLog(`⚠️ [${face.stageLabel}] 作画エラー: ${formatErrorMessage(err)}`, 'warning');
        setProtagonistFaces(prev => prev.map((f, idx) => 
          idx === i ? { ...f, status: 'error', errorMessage: formatErrorMessage(err) } : f
        ));
      }
    }

    setActiveGeneratingFaceIndex(null);
    setIsGeneratingFaces(false);
    onAddLog(`🎉 主人公「${target.name}」の起承転結・4大表情差分がすべて整いました！`, 'success');
  };

  // 単一表情の再作画
  const handleGenerateSingleFace = async (index: number) => {
    const target = currentCandidate;
    if (!target) return;
    const face = protagonistFaces[index];
    if (!face) return;

    setProtagonistFaces(prev => prev.map((f, idx) => idx === index ? { ...f, status: 'generating' } : f));
    onAddLog(`🎨 ${face.stageLabel} を再作画中...`, 'process');

    const modelDef = resolveImageModel();
    const safeModelName = modelDef?.name || '🍌 Nano Banana 2';
    const safeNegative = 'worst quality, normal quality, lowres, deformed, distorted, bad anatomy, bad hands, blurry, complex background, text, watermark';
    const portraitPrompt = `${target.dnaPromptEn}, anime character portrait, upper chest and face close-up, ${face.promptModifierEn}, facing camera, clean simple background, consistent facial features and hairstyle, masterpiece. Art style: ${target.tastePromptEn}`;

    try {
      const res = await callWithRetry<any>(
        () => Flow.generate.image({
          prompt: portraitPrompt,
          negativePrompt: safeNegative,
          aspectRatio: '1:1',
          modelDisplayName: safeModelName,
        }),
        undefined,
        3
      );
      const base64 = res?.base64 || res?.image?.base64;
      const mediaId = res?.mediaId || res?.image?.mediaId;
      if (base64) {
        setProtagonistFaces(prev => prev.map((f, idx) => 
          idx === index ? { ...f, base64, mediaId, status: 'completed' } : f
        ));
        onAddLog(`✅ ${face.stageLabel} の再作画が完了！`, 'success');
      }
    } catch (err: any) {
      setProtagonistFaces(prev => prev.map((f, idx) => 
        idx === index ? { ...f, status: 'error', errorMessage: formatErrorMessage(err) } : f
      ));
    }
  };

  // Step 2 ➔ Step 3（お友達・サブキャラ配役）へ進む
  const handleProceedToStep3 = () => {
    setStep(3);
    onAddLog(`👥 お友達・サブキャラクターの配役へ進みます`, 'info');
    if (subCharacters.length === 0) {
      setTimeout(() => {
        handleGenerateSubCharacters();
      }, 200);
    }
  };

  // =========================================================================
  // Step 3: サブキャラ・お友達の自動配役（2〜3名）
  // =========================================================================
  const handleGenerateSubCharacters = async () => {
    if (!currentCandidate) return;
    setIsGeneratingSubs(true);
    onAddLog(`👥 物語を彩るお友達・相棒・宿敵などサブキャラを自動考案中...`, 'process');

    const prompt = `あなたは一流の漫画編集者です。
漫画『${seriesTitle || currentCandidate.name}』（主人公: 「${currentCandidate.name}」）のストーリー展開を強力に引き立てる、
魅力的なサブキャラクター（お友達・相棒、ヒロイン、宿敵・ライバル）を【2〜3名】考案してください。

【世界観テーマ】: ${selectedTheme}
【画風テイスト】: ${currentCandidate.tasteName}
【主人公】: ${currentCandidate.name} (${currentCandidate.concept})

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
        createDefaultCastCharacter(`sub_1_${Date.now()}`, '頼れる相棒・親友', 'partner', `A trustworthy loyal friend and companion of ${currentCandidate.name}, matching ${selectedTheme}`),
        createDefaultCastCharacter(`sub_2_${Date.now()}`, '宿命の好敵手', 'antagonist', `A fierce rival and antagonist opposing ${currentCandidate.name}, sharp intense eyes matching ${selectedTheme}`)
      ];
      setSubCharacters(dummySubs);
    } finally {
      setIsGeneratingSubs(false);
    }
  };

  // Step 3 ➔ Step 4（話数＆全話プロット）へ進む
  const handleProceedToStep4 = () => {
    setStep(4);
    onAddLog(`📜 全${episodeCount}話の起承転結ストーリー構成へ進みます`, 'info');
    if (episodesPlan.length === 0) {
      setTimeout(() => {
        handleGenerateStoryPlan(currentCandidate);
      }, 200);
    }
  };

  // =========================================================================
  // Step 4: 選択した主人公三面図から起承転結（全1〜50話）ストーリー策定
  // =========================================================================
  const handleGenerateStoryPlan = async (targetCand?: TurnaroundCandidate) => {
    const target = targetCand || currentCandidate;
    if (!target) return;

    setIsGeneratingPlan(true);
    onAddLog(`📜 主人公「${target.name}」で【全${episodeCount}話】の起承転結ストーリー構成を構築中...`, 'process');

    const prompt = buildGrandDesignPrompt(
      selectedTheme,
      target.tasteName,
      episodeCount,
      '日本',
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

    // 三面図を格納
    mainProtagonist.turnaroundBase64 = currentCandidate.turnaroundBase64;
    mainProtagonist.turnaroundMediaId = currentCandidate.turnaroundMediaId;
    mainProtagonist.turnaroundPromptEn = `${currentCandidate.dnaPromptEn}, turnaround sheet, art style: ${currentCandidate.tastePromptEn}`;

    // 起承転結の顔（喜怒哀楽）を表情差分として完全格納！
    const neutralFace = protagonistFaces.find(f => f.expType === 'neutral')?.base64;
    const happyFace = protagonistFaces.find(f => f.expType === 'happy')?.base64;
    const angryFace = protagonistFaces.find(f => f.expType === 'angry')?.base64;
    const sadFace = protagonistFaces.find(f => f.expType === 'sad')?.base64;

    mainProtagonist.avatarBase64 = neutralFace || currentCandidate.turnaroundBase64;
    if (neutralFace) mainProtagonist.expressions.neutral.imageBase64 = neutralFace;
    if (happyFace) mainProtagonist.expressions.happy.imageBase64 = happyFace;
    if (angryFace) mainProtagonist.expressions.angry.imageBase64 = angryFace;
    if (sadFace) mainProtagonist.expressions.sad.imageBase64 = sadFace;

    // シリーズマニフェストを構築
    const manifest: SeriesManifest = {
      seriesTitle: seriesTitle || `${currentCandidate.name} 漫画連載`,
      totalEpisodes: episodeCount,
      currentEpisodeId: 1,
      completedEpisodeIds: [],
      overallSynopsis: overallSynopsis || `${selectedTheme}の世界を舞台にした${currentCandidate.name}の壮大な物語`,
      episodesPlan: episodesPlan.length > 0 ? episodesPlan : Array.from({ length: episodeCount }, (_, i) => ({
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
            { num: 2, label: '② 起承転結・喜怒哀楽の顔' },
            { num: 3, label: '③ お友達・サブキャラ配役' },
            { num: 4, label: '④ 全話プロット＆連載開始' },
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
                    className="w-full py-3 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md transition-all cursor-pointer"
                  >
                    <span className={`material-symbols-outlined text-lg ${isBrainstormingCandidates || activeGeneratingIndex !== null ? 'animate-spin' : ''}`}>
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
                                  <span>🚀 決定して表情作画へ ➔</span>
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
              STEP 2: 主人公の起承転結・喜怒哀楽の顔（4表情作画）
             ======================================================== */}
          {step === 2 && currentCandidate && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              
              {/* Selected Protagonist Summary Header */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between gap-4 shadow-2xs flex-wrap">
                <div className="flex items-center gap-3">
                  {currentCandidate.turnaroundBase64 && (
                    <img
                      src={`data:image/png;base64,${currentCandidate.turnaroundBase64}`}
                      alt={currentCandidate.name}
                      className="w-24 h-14 object-cover rounded-lg border border-slate-200 cursor-pointer shrink-0"
                      onClick={() => setZoomImage({ base64: currentCandidate.turnaroundBase64!, title: currentCandidate.name })}
                    />
                  )}
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-bold border border-indigo-200">
                        {currentCandidate.tasteName}
                      </span>
                      <span className="text-xs font-extrabold text-slate-800">
                        主人公: {currentCandidate.name}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate max-w-md">{currentCandidate.concept}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleGenerateAllFaces()}
                  disabled={isGeneratingFaces}
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <span className={`material-symbols-outlined text-sm ${isGeneratingFaces ? 'animate-spin' : ''}`}>
                    {isGeneratingFaces ? 'autorenew' : 'auto_awesome'}
                  </span>
                  <span>{isGeneratingFaces ? '表情を作画中...' : '⚡ 4表情を一括再作画'}</span>
                </button>
              </div>

              {/* Guidance Box */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200/80 p-3.5 rounded-xl flex items-start gap-3 text-purple-950 shadow-2xs">
                <span className="material-symbols-outlined text-purple-600 mt-0.5 text-xl">mood</span>
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">主人公の【起承転結・喜怒哀楽の顔（4表情）】を生成します。</p>
                  <p className="text-purple-700 mt-0.5">
                    決定した三面図の容姿DNAと画風を忠実に維持したまま、物語の展開に応じた4つの主要表情（起・承・転・結）を作画します。各カット作画時にキャラクターの感情マスターとして自動適用されます。
                  </p>
                </div>
              </div>

              {/* 4 Faces Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {protagonistFaces.map((face, idx) => {
                  const isGeneratingThis = activeGeneratingFaceIndex === idx || face.status === 'generating';
                  const hasImage = Boolean(face.base64);

                  return (
                    <div
                      key={face.stage}
                      className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs flex flex-col justify-between"
                    >
                      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                        <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1">
                          <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                          {face.stageLabel}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">#{idx + 1}</span>
                      </div>

                      {/* 1:1 Portrait Image Box */}
                      <div className="relative aspect-square w-full bg-slate-100 flex items-center justify-center overflow-hidden group">
                        {hasImage ? (
                          <>
                            <img
                              src={`data:image/png;base64,${face.base64}`}
                              alt={face.stageLabel}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => setZoomImage({ base64: face.base64!, title: `${currentCandidate.name} - ${face.stageLabel}` })}
                                className="p-2 rounded-lg bg-white/90 text-slate-900 hover:bg-white text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-sm">zoom_in</span>
                                拡大
                              </button>
                              <button
                                type="button"
                                onClick={() => handleGenerateSingleFace(idx)}
                                disabled={isGeneratingFaces}
                                className="p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 text-xs font-bold flex items-center gap-1 shadow-sm cursor-pointer"
                              >
                                <span className="material-symbols-outlined text-sm">refresh</span>
                                再作画
                              </button>
                            </div>
                          </>
                        ) : isGeneratingThis ? (
                          <div className="flex flex-col items-center justify-center p-4 text-center gap-1.5 text-indigo-600">
                            <span className="material-symbols-outlined animate-spin text-3xl">autorenew</span>
                            <span className="text-xs font-bold">表情を作画中...</span>
                          </div>
                        ) : face.status === 'error' ? (
                          <div className="flex flex-col items-center justify-center p-4 text-center gap-1 text-rose-500">
                            <span className="material-symbols-outlined text-2xl">error</span>
                            <span className="text-xs">作画エラー</span>
                            <button
                              type="button"
                              onClick={() => handleGenerateSingleFace(idx)}
                              className="mt-1 px-2.5 py-1 rounded bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold cursor-pointer"
                            >
                              再試行
                            </button>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-4 text-center gap-1 text-slate-400">
                            <span className="material-symbols-outlined text-2xl text-slate-300">face</span>
                            <span className="text-[11px]">未作画</span>
                            <button
                              type="button"
                              onClick={() => handleGenerateSingleFace(idx)}
                              className="mt-1 px-2.5 py-1 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold cursor-pointer"
                            >
                              今すぐ作画
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="p-3 bg-slate-50/70 border-t border-slate-100 flex flex-col gap-1">
                        <p className="text-[11px] text-slate-600 leading-tight">{face.stageSub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          )}

          {/* ========================================================
              STEP 3: お友達・相棒・サブキャラ配役
             ======================================================== */}
          {step === 3 && currentCandidate && (
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

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerateSubCharacters}
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
              STEP 4: 話数選択 (1〜50話) ＆ 起承転結プロット構築 ＆ 連載スタート
             ======================================================== */}
          {step === 4 && currentCandidate && (
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
                    onChange={e => setEpisodeCount(Number(e.target.value))}
                    className="w-full accent-indigo-600"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-bold">
                    <span>1話 (読切短編)</span>
                    <span>10話</span>
                    <span>20話 (中編)</span>
                    <span>50話 (コミック大河大作)</span>
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
                      シリーズ起承転結プロット ({episodesPlan.length}話分)
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGenerateStoryPlan(currentCandidate)}
                    disabled={isGeneratingPlan}
                    className="px-3 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <span className={`material-symbols-outlined text-xs ${isGeneratingPlan ? 'animate-spin' : ''}`}>
                      {isGeneratingPlan ? 'autorenew' : 'refresh'}
                    </span>
                    <span>{isGeneratingPlan ? 'プロット再構築中...' : 'プロットを再生成'}</span>
                  </button>
                </div>

                {seriesTitle && (
                  <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col gap-1">
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">確定連載タイトル</span>
                    <h3 className="text-sm font-black text-slate-900">『{seriesTitle}』</h3>
                    {overallSynopsis && (
                      <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{overallSynopsis}</p>
                    )}
                  </div>
                )}

                {/* Episodes Plan List */}
                <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                  {episodesPlan.map((ep) => (
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
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:from-emerald-700 hover:to-purple-700 disabled:opacity-40 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all transform hover:scale-102 cursor-pointer"
              >
                <span>この主人公で決定し、起承転結の顔（喜怒哀楽）へ</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleProceedToStep3}
                disabled={isGeneratingFaces}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <span>次へ：お友達・サブキャラ配役</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            )}

            {step === 3 && (
              <button
                type="button"
                onClick={handleProceedToStep4}
                disabled={isGeneratingSubs}
                className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              >
                <span>次へ：全話プロット構築＆連載設定</span>
                <span className="material-symbols-outlined text-base">arrow_forward</span>
              </button>
            )}

            {step === 4 && (
              <button
                type="button"
                onClick={handleLaunch}
                disabled={isGeneratingPlan}
                className="px-7 py-3 bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:from-emerald-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all transform hover:scale-102 cursor-pointer"
              >
                <span className="material-symbols-outlined text-lg">rocket_launch</span>
                <span>🚀 コミック一冊分の自動制作をスタート！（30Cut × 全{episodeCount}話）</span>
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
