import React, { useState, useRef } from 'react';
import { THEMES, TASTES, resolveImageModel } from '../constants';
import { CastCharacter, SeriesEpisodePlan, SeriesManifest, GeneratorSettings } from '../types';
import { createDefaultCastCharacter } from '../services/castStorage';
import { Flow } from 'flow-sdk';
import { callWithRetry, safeJsonParse, formatErrorMessage } from '../services/utils';
import { resolveTastePrompt } from '../services/tasteStorage';
import { buildGrandDesignPrompt } from '../services/directorService';

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
  // ステップ管理: 1: テーマ・画風, 2: 主人公三面図, 3: 起承転結, 4: サブキャラ, 5: 完了確認
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Step 1: 世界観テーマ & 画風
  const [selectedTheme, setSelectedTheme] = useState<string>(currentTheme || THEMES[0]);
  const [selectedTaste, setSelectedTaste] = useState<string>(currentTaste || Object.keys(TASTES)[0]);

  // Step 2: 主人公設定 & 三面図
  const [protagonistName, setProtagonistName] = useState<string>('主人公');
  const [protagonistConcept, setProtagonistConcept] = useState<string>('');
  const [protagonistDna, setProtagonistDna] = useState<string>('');
  const [turnaroundBase64, setTurnaroundBase64] = useState<string | null>(null);
  const [turnaroundMediaId, setTurnaroundMediaId] = useState<string | null>(null);
  const [isGeneratingProtagonistDna, setIsGeneratingProtagonistDna] = useState(false);
  const [isGeneratingTurnaround, setIsGeneratingTurnaround] = useState(false);

  // Step 3: 起承転結ストーリー (大河シリーズ設計図)
  const [episodeCount, setEpisodeCount] = useState<number>(20); // 20話 or 50話
  const [seriesTitle, setSeriesTitle] = useState<string>('');
  const [overallSynopsis, setOverallSynopsis] = useState<string>('');
  const [episodesPlan, setEpisodesPlan] = useState<SeriesEpisodePlan[]>([]);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);

  // Step 4: サブキャラクター
  const [subCharacters, setSubCharacters] = useState<CastCharacter[]>([]);
  const [isGeneratingSubs, setIsGeneratingSubs] = useState(false);

  // 画像ズーム用
  const [zoomImage, setZoomImage] = useState<{ base64: string; title: string } | null>(null);

  if (!isOpen) return null;

  // テーマをランダムに1つ選定
  const handleRandomTheme = () => {
    const randomItem = THEMES[Math.floor(Math.random() * THEMES.length)];
    setSelectedTheme(randomItem);
    onAddLog(`🎲 世界観テーマをランダム選定しました: 「${randomItem}」`, 'info');
  };

  // Step 1 -> 2: テーマと画風から主人公をAI自動考案
  const handleProceedToStep2 = async () => {
    setIsGeneratingProtagonistDna(true);
    onAddLog(`🧠 「${selectedTheme}」×「${selectedTaste.split(' ')[0]}」の主人公キャラクターをAI考案中...`, 'process');

    const rawTaste = resolveTastePrompt(selectedTaste);
    const prompt = `あなたは世界的人気漫画の編集長です。
以下の世界観テーマと画風テイストに最高にマッチする、読者を熱狂させる魅力的な「主人公キャラクター」を1名考案してください。

【世界観テーマ】: ${selectedTheme}
【画風テイスト】: ${selectedTaste} (${rawTaste})

以下の厳密なJSON形式（Markdownコードブロックなし）で出力してください:
{
  "name": "主人公の魅力的な名前 (肩書)",
  "concept": "主人公の性格、信念、武器、特徴（日本語2〜3行）",
  "dnaPromptEn": "Detailed English character appearance prompt: gender, age, facial features, distinctive eyes, expressive hairstyle, hair color, signature clothing matching the theme and taste, accessories"
}`;

    try {
      const res = await Flow.generate.text(prompt);
      const text = res?.text || (typeof res === 'string' ? res : '');
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = safeJsonParse<any>(cleaned, null);

      if (parsed && parsed.dnaPromptEn) {
        setProtagonistName(parsed.name || '主人公');
        setProtagonistConcept(parsed.concept || '');
        setProtagonistDna(parsed.dnaPromptEn);
        setStep(2);
        onAddLog(`✨ 主人公「${parsed.name}」の設定が完成しました！三面図を作画しましょう。`, 'success');
      } else {
        throw new Error('キャラクター設定の生成に失敗しました');
      }
    } catch (err: any) {
      onAddLog(`❌ 主人公考案エラー: ${formatErrorMessage(err)}`, 'error');
      // フォールバック
      setProtagonistName('主人公 (特務)');
      setProtagonistConcept(`${selectedTheme}の世界で生きる主人公`);
      setProtagonistDna(`A striking anime protagonist matching ${selectedTheme}, distinctive sharp eyes, stylish anime hairstyle, authentic detailed attire`);
      setStep(2);
    } finally {
      setIsGeneratingProtagonistDna(false);
    }
  };

  // Step 2: 主人公の三面図（16:9）AI作画
  const handleGenerateTurnaround = async () => {
    setIsGeneratingTurnaround(true);
    onAddLog(`📐 主人公「${protagonistName}」の三面図シート（正面・側面・背面 / 16:9）をAI作画中...`, 'process');

    const rawTaste = resolveTastePrompt(selectedTaste);
    const fullPrompt = `${protagonistDna}, anime character turnaround sheet, model sheet, three views, full body front view, full body side view, full body back view, clean plain white background, high-contrast crisp anime lineart, consistent clothing and proportions, masterpiece. Art style: ${rawTaste}`;
    const safeNegative = 'worst quality, normal quality, lowres, deformed, distorted, bad anatomy, bad hands, blurry, complex background, text, watermark';

    try {
      const modelDef = resolveImageModel();
      const safeModelName = modelDef?.name || '🍌 Nano Banana 2';

      const res = await callWithRetry<any>(
        () => Flow.generate.image({
          prompt: fullPrompt,
          negativePrompt: safeNegative,
          aspectRatio: '16:9',
          modelDisplayName: safeModelName,
        }),
        (attempt, max, delay, err) => {
          onAddLog(`⚠️ 三面図作画リトライ (${attempt}/${max}) ${Math.round(delay / 1000)}秒後... (理由: ${formatErrorMessage(err)})`, 'warning');
        },
        3
      );

      const base64 = res?.base64 || res?.image?.base64;
      const mediaId = res?.mediaId || res?.image?.mediaId;

      if (base64) {
        setTurnaroundBase64(base64);
        setTurnaroundMediaId(mediaId || null);
        onAddLog(`✨ 主人公「${protagonistName}」の三面図シートが完成しました！`, 'success');
      } else {
        throw new Error('三面図データが返却されませんでした');
      }
    } catch (err: any) {
      onAddLog(`❌ 三面図作画エラー: ${formatErrorMessage(err)}`, 'error');
    } finally {
      setIsGeneratingTurnaround(false);
    }
  };

  // Step 2 -> 3: 三面図から起承転結（全20話〜50話）ストーリー策定
  const handleGenerateStoryPlan = async () => {
    setIsGeneratingPlan(true);
    onAddLog(`📜 主人公「${protagonistName}」を軸に、全${episodeCount}話の起承転結ストーリーをAI策定中...`, 'process');

    const prompt = buildGrandDesignPrompt(
      episodeCount,
      '日本',
      selectedTheme,
      undefined,
      true, // isMangaMode
      false,
      protagonistDna,
      protagonistName
    );

    try {
      const res = await callWithRetry<any>(
        () => Flow.generate.text(prompt),
        undefined,
        4
      );
      const text = res?.text || (typeof res === 'string' ? res : '');
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = safeJsonParse<any>(cleaned, null);

      if (parsed && Array.isArray(parsed.episodesPlan) && parsed.episodesPlan.length > 0) {
        setSeriesTitle(parsed.seriesTitle || `${protagonistName}伝`);
        setOverallSynopsis(parsed.overallSynopsis || '');
        setEpisodesPlan(parsed.episodesPlan);
        setStep(3);
        onAddLog(`🎉 コミック連載『${parsed.seriesTitle}』（全${parsed.episodesPlan.length}話）の起承転結プロットが確定しました！`, 'success');
      } else {
        throw new Error('ストーリープロットの生成に失敗しました');
      }
    } catch (err: any) {
      onAddLog(`❌ 起承転結プロット生成エラー: ${formatErrorMessage(err)}`, 'error');
      // フォールバック
      const dummyPlan: SeriesEpisodePlan[] = Array.from({ length: episodeCount }, (_, i) => ({
        epNumber: i + 1,
        titleJp: `第${i + 1}話 ${i < 5 ? '波乱の胎動' : i < 12 ? '深まる謎と激突' : i < 17 ? '絶体絶命の決断' : '運命の結末'}`,
        titleEn: `Episode ${i + 1} Arc`,
        summary: `主人公${protagonistName}が立ち向かう第${i + 1}話の試練`
      }));
      setSeriesTitle(`${protagonistName}活劇録`);
      setOverallSynopsis(`${selectedTheme}の舞台で${protagonistName}が織りなす連続ストーリー`);
      setEpisodesPlan(dummyPlan);
      setStep(3);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // Step 3 -> 4: 起承転結に合わせてサブキャラ・お友達を自動生成（2〜3名）
  const handleGenerateSubCharacters = async () => {
    setIsGeneratingSubs(true);
    onAddLog(`👥 物語『${seriesTitle}』を彩る相棒・お友達・宿敵などサブキャラを自動配役中...`, 'process');

    const prompt = `あなたは一流の漫画編集者です。
漫画『${seriesTitle}』（全${episodeCount}話）のストーリー展開と主人公「${protagonistName}」を強力に引き立てる、
魅力的なサブキャラクター（お友達・相棒、ヒロイン、宿敵・ライバル）を【2〜3名】考案してください。

【世界観テーマ】: ${selectedTheme}
【主人公】: ${protagonistName} (${protagonistConcept})
【あらすじ】: ${overallSynopsis}

以下の厳密なJSON形式（Markdownコードブロックなし）で出力してください:
[
  {
    "name": "キャラクター名 (肩書)",
    "role": "partner" (または "antagonist" または "supporting"),
    "concept": "主人公との関係性・お友達・相棒・ライバルとしての役割（日本語2行）",
    "dnaPromptEn": "Detailed English character appearance prompt: gender, age, hair, eyes, distinct clothing matching ${selectedTheme}"
  }
]`;

    try {
      const res = await Flow.generate.text(prompt);
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
        setStep(4);
        onAddLog(`✨ サブキャラクター${chars.length}名の配役が完了しました！`, 'success');
      } else {
        throw new Error('サブキャラクターの生成に失敗しました');
      }
    } catch (err: any) {
      onAddLog(`❌ サブキャラ考案エラー: ${formatErrorMessage(err)}`, 'error');
      // フォールバック
      const dummySubs: CastCharacter[] = [
        createDefaultCastCharacter(`sub_1_${Date.now()}`, '相棒・友人', 'partner', `A trustworthy friend and companion of ${protagonistName}, anime style`),
        createDefaultCastCharacter(`sub_2_${Date.now()}`, '宿命のライバル', 'antagonist', `A fierce rival and antagonist opposing ${protagonistName}, intense gaze`)
      ];
      setSubCharacters(dummySubs);
      setStep(4);
    } finally {
      setIsGeneratingSubs(false);
    }
  };

  // Step 4 -> 5: 最終確認画面へ
  const handleProceedToFinalConfirm = () => {
    setStep(5);
  };

  // Step 5: コミック一冊分（30Cut × 20〜50話）の自動制作をローンチ！
  const handleLaunch = () => {
    // 主人公の CastCharacter オブジェクトを構築
    const mainProtagonist = createDefaultCastCharacter(
      `protagonist_${Date.now()}`,
      protagonistName,
      'protagonist',
      protagonistDna
    );
    if (turnaroundBase64) {
      mainProtagonist.turnaroundBase64 = turnaroundBase64;
      mainProtagonist.turnaroundMediaId = turnaroundMediaId || undefined;
      mainProtagonist.avatarBase64 = turnaroundBase64;
    }

    const manifest: SeriesManifest = {
      seriesTitle: seriesTitle || `${protagonistName}物語`,
      totalEpisodes: episodeCount,
      currentEpisodeId: 1,
      completedEpisodeIds: [],
      overallSynopsis: overallSynopsis,
      episodesPlan: episodesPlan,
      referenceAsset: turnaroundBase64 ? {
        name: `${protagonistName} [三面図マスター]`,
        base64: turnaroundBase64,
        mimeType: 'image/png',
        characterDna: protagonistDna,
        styleDna: resolveTastePrompt(selectedTaste),
      } : undefined,
    };

    onLaunchComicSeries({
      theme: selectedTheme,
      taste: selectedTaste,
      protagonist: mainProtagonist,
      subCharacters,
      manifest,
      totalEpisodes: episodeCount,
      cutsPerEpisode: 30, // 30Cut標準！
    });

    onAddLog(`🚀 コミック一冊分（全${episodeCount}話 × 30Cut）の全自動制作をローンチしました！`, 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-4xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-purple-950 text-white shrink-0">
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
              <p className="text-xs text-slate-300 mt-0.5">
                世界観選定 ➔ 三面図 ➔ 起承転結 ➔ サブキャラ配役 ➔ 30Cut連載（20〜50話）をボタンポチで一括プロデュース
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
            { num: 1, label: '① 世界観・画風' },
            { num: 2, label: '② 主人公三面図' },
            { num: 3, label: '③ 起承転結 (全話)' },
            { num: 4, label: '④ サブキャラ配役' },
            { num: 5, label: '⑤ コミック連載開始' },
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
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50/50 flex flex-col gap-5">
          
          {/* ========================================================
              STEP 1: 世界観テーマ & 画風の決定
             ======================================================== */}
          {step === 1 && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="bg-indigo-50/70 border border-indigo-200/80 p-4 rounded-xl flex items-start gap-3 text-indigo-900">
                <span className="material-symbols-outlined text-indigo-600 mt-0.5">help</span>
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">まずは「世界観・テーマ」と「画風」を決定します。</p>
                  <p className="text-indigo-700 mt-0.5">
                    既存の選べるテーマ一覧から選択できるほか、「🎲 ランダム選定」を押すとAIがテーマをランダムに一発決定します。
                  </p>
                </div>
              </div>

              {/* Theme Picker */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm text-amber-500">public</span>
                    世界観・テーマ (World Theme)
                  </label>
                  <button
                    onClick={handleRandomTheme}
                    className="px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1 transition-colors"
                  >
                    <span className="material-symbols-outlined text-sm">casino</span>
                    🎲 ランダム選定
                  </button>
                </div>

                <select
                  value={selectedTheme}
                  onChange={e => setSelectedTheme(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-semibold"
                >
                  {THEMES.map((themeItem, idx) => (
                    <option key={idx} value={themeItem}>{themeItem}</option>
                  ))}
                </select>
              </div>

              {/* Taste Picker */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-2xs">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-sm text-indigo-500">palette</span>
                  画風・テイスト (Visual Art Style)
                </label>
                <select
                  value={selectedTaste}
                  onChange={e => setSelectedTaste(e.target.value)}
                  className="w-full px-3 py-2.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-800 font-semibold"
                >
                  {Object.keys(TASTES).map((tKey) => (
                    <option key={tKey} value={tKey}>{tKey}</option>
                  ))}
                </select>
              </div>

              {/* Action Button */}
              <div className="flex justify-end mt-2">
                <button
                  onClick={handleProceedToStep2}
                  disabled={isGeneratingProtagonistDna}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                  <span className={`material-symbols-outlined text-sm ${isGeneratingProtagonistDna ? 'animate-spin' : ''}`}>
                    {isGeneratingProtagonistDna ? 'autorenew' : 'arrow_forward'}
                  </span>
                  <span>{isGeneratingProtagonistDna ? '主人公キャラクターをAI考案中...' : '次へ：主人公の三面図を準備する ➔'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              STEP 2: 画風に従って主人公三面図をAI作画
             ======================================================== */}
          {step === 2 && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="bg-emerald-50/70 border border-emerald-200/80 p-3.5 rounded-xl flex items-start gap-3 text-emerald-900">
                <span className="material-symbols-outlined text-emerald-600 mt-0.5">view_in_ar</span>
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">主人公の容姿プロンプトDNAを確認し、三面図（16:9）を作画します。</p>
                  <p className="text-emerald-700 mt-0.5">
                    「正面・側面・背面」の全身モデルシートが作画され、この後の全20〜50話の作画基準（Active DNA）となります。
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                {/* Left: Protagonist Profile */}
                <div className="md:col-span-6 bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-2xs">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700">主人公の名前 (肩書)</label>
                    <input
                      type="text"
                      value={protagonistName}
                      onChange={e => setProtagonistName(e.target.value)}
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-bold text-slate-800"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700">設定・キャラクター背景</label>
                    <textarea
                      rows={2}
                      value={protagonistConcept}
                      onChange={e => setProtagonistConcept(e.target.value)}
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-600 resize-none leading-relaxed"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold text-slate-700">容姿 DNA プロンプト (Base Appearance)</label>
                    <textarea
                      rows={3}
                      value={protagonistDna}
                      onChange={e => setProtagonistDna(e.target.value)}
                      className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 font-mono text-slate-600 resize-none leading-relaxed"
                    />
                  </div>
                </div>

                {/* Right: Turnaround Preview Box */}
                <div className="md:col-span-6 bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">三面図シートプレビュー (16:9)</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                      正面・側面・背面
                    </span>
                  </div>

                  <div 
                    className="relative aspect-video w-full rounded-lg bg-slate-100 overflow-hidden border border-slate-200 flex items-center justify-center group"
                  >
                    {turnaroundBase64 ? (
                      <>
                        <img 
                          src={`data:image/png;base64,${turnaroundBase64}`} 
                          alt="Turnaround" 
                          className="w-full h-full object-cover cursor-pointer"
                          onClick={() => setZoomImage({ base64: turnaroundBase64, title: `📐 主人公「${protagonistName}」三面図シート` })}
                        />
                        <div 
                          onClick={() => setZoomImage({ base64: turnaroundBase64, title: `📐 主人公「${protagonistName}」三面図シート` })}
                          className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer gap-1 text-white"
                        >
                          <span className="material-symbols-outlined text-xl">zoom_in</span>
                          <span className="text-xs font-bold">クリックで拡大</span>
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center text-center p-4 gap-1 text-slate-400">
                        <span className="material-symbols-outlined text-3xl text-slate-300">view_sidebar</span>
                        <span className="text-xs font-bold text-slate-600">三面図がまだありません</span>
                        <span className="text-[10px]">下のボタンを押してAI作画してください</span>
                      </div>
                    )}

                    {isGeneratingTurnaround && (
                      <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-2 z-10">
                        <span className="material-symbols-outlined animate-spin text-2xl text-emerald-400">autorenew</span>
                        <span className="text-xs font-bold">三面図をAI作画中 (16:9)...</span>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={handleGenerateTurnaround}
                    disabled={isGeneratingTurnaround}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs transition-all"
                  >
                    <span className={`material-symbols-outlined text-sm ${isGeneratingTurnaround ? 'animate-spin' : ''}`}>
                      {isGeneratingTurnaround ? 'autorenew' : 'palette'}
                    </span>
                    <span>{turnaroundBase64 ? '三面図を再作画する' : '📐 主人公の三面図をAI作画 (16:9)'}</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-between items-center mt-2">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  戻る
                </button>

                <button
                  onClick={handleGenerateStoryPlan}
                  disabled={isGeneratingPlan || !turnaroundBase64}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                  <span className={`material-symbols-outlined text-sm ${isGeneratingPlan ? 'animate-spin' : ''}`}>
                    {isGeneratingPlan ? 'autorenew' : 'arrow_forward'}
                  </span>
                  <span>{isGeneratingPlan ? '起承転結プロットをAI策定中...' : 'この三面図で決定し、起承転結プロットへ ➔'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              STEP 3: 起承転結ストーリー (大河シリーズ設計図)
             ======================================================== */}
          {step === 3 && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="bg-purple-50/70 border border-purple-200/80 p-3.5 rounded-xl flex items-start gap-3 text-purple-900">
                <span className="material-symbols-outlined text-purple-600 mt-0.5">auto_stories</span>
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">全{episodesPlan.length}話の起承転結ストーリーが策定されました！</p>
                  <p className="text-purple-700 mt-0.5">
                    「起（導入・出会い）」「承（事件・葛藤）」「転（衝撃の真相・対峙）」「結（大団円・余韻）」の完全連続プロットです。
                  </p>
                </div>
              </div>

              {/* Episode Count Picker & Title Card */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-2xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-amber-500">menu_book</span>
                    <h4 className="text-sm font-bold text-slate-900">{seriesTitle}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500 font-bold">話数:</span>
                    {[20, 50].map((num) => (
                      <button
                        key={num}
                        onClick={() => {
                          setEpisodeCount(num);
                          onAddLog(`📖 話数を全${num}話に変更しました。再策定ボタンを押してください。`, 'info');
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                          episodeCount === num 
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' 
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {num}話 ({num === 20 ? '単行本1冊' : '大作連載'})
                      </button>
                    ))}
                  </div>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {overallSynopsis}
                </p>
              </div>

              {/* Episodes List (Scrollable) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-2 shadow-2xs max-h-56 overflow-y-auto">
                <span className="text-xs font-bold text-slate-700">各話プロット一覧 (全{episodesPlan.length}話)</span>
                <div className="flex flex-col gap-2">
                  {episodesPlan.map((p) => {
                    const actBadge = 
                      p.epNumber <= Math.round(episodeCount * 0.25) ? 'bg-emerald-100 text-emerald-800' :
                      p.epNumber <= Math.round(episodeCount * 0.55) ? 'bg-indigo-100 text-indigo-800' :
                      p.epNumber <= Math.round(episodeCount * 0.85) ? 'bg-rose-100 text-rose-800' :
                      'bg-amber-100 text-amber-800';
                    const actName = 
                      p.epNumber <= Math.round(episodeCount * 0.25) ? '起' :
                      p.epNumber <= Math.round(episodeCount * 0.55) ? '承' :
                      p.epNumber <= Math.round(episodeCount * 0.85) ? '転' : '結';

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

              {/* Action Buttons */}
              <div className="flex justify-between items-center mt-2">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  戻る
                </button>

                <button
                  onClick={handleGenerateSubCharacters}
                  disabled={isGeneratingSubs}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                  <span className={`material-symbols-outlined text-sm ${isGeneratingSubs ? 'animate-spin' : ''}`}>
                    {isGeneratingSubs ? 'autorenew' : 'arrow_forward'}
                  </span>
                  <span>{isGeneratingSubs ? 'サブキャラ・お友達を配役中...' : '次へ：お友達・サブキャラを自動配役 ➔'}</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              STEP 4: サブキャラ・お友達の自動配役
             ======================================================== */}
          {step === 4 && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl flex items-start gap-3 text-amber-900">
                <span className="material-symbols-outlined text-amber-600 mt-0.5">group</span>
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">物語を盛り上げるサブキャラクター（お友達・相棒・ライバル）が配役されました！</p>
                  <p className="text-amber-700 mt-0.5">
                    主人公と掛け合いを行うキャストとして台帳に保存され、全エピソードの作画に反映されます。
                  </p>
                </div>
              </div>

              {/* Characters Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {/* Main Protagonist Card */}
                <div className="bg-white p-3.5 rounded-xl border-2 border-amber-400 flex flex-col gap-2 shadow-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-extrabold border border-amber-300">
                      ★ 主人公
                    </span>
                    <span className="material-symbols-outlined text-amber-500 text-sm">stars</span>
                  </div>
                  <h5 className="text-xs font-bold text-slate-900">{protagonistName}</h5>
                  <p className="text-[11px] text-slate-500 leading-tight line-clamp-3">{protagonistConcept}</p>
                </div>

                {/* Sub Characters Cards */}
                {subCharacters.map((sub, idx) => {
                  const roleBadge = 
                    sub.role === 'partner' ? 'bg-indigo-100 text-indigo-800 border-indigo-200' :
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

              {/* Action Buttons */}
              <div className="flex justify-between items-center mt-2">
                <button
                  onClick={() => setStep(3)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  戻る
                </button>

                <button
                  onClick={handleProceedToFinalConfirm}
                  className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                >
                  <span>次へ：連載スタートの最終確認 ➔</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================
              STEP 5: コミック連載スタート（最終確認）
             ======================================================== */}
          {step === 5 && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              <div className="bg-gradient-to-r from-emerald-500/10 via-indigo-500/10 to-purple-500/10 border border-indigo-200 p-4 rounded-xl flex flex-col gap-2 text-slate-800">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-indigo-600 text-xl">verified</span>
                  <h4 className="text-sm font-bold text-slate-900">コミック一冊分の全プロデュース準備が整いました！</h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  「🚀 コミック一冊分の自動制作をスタート！」をクリックすると、既存のドラマ連番UI上で、
                  <strong>漫画コマ割り（Multi-Panel）ON</strong>、<strong>1話30カット</strong>で全{episodeCount}話の連続コミック制作が自動開始されます。
                </p>
              </div>

              {/* Specification Summary Card */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 flex flex-col gap-3.5 shadow-xs">
                <h5 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider">制作スペック概要</h5>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-bold">タイトル</span>
                    <span className="font-bold text-slate-900">{seriesTitle}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-bold">世界観・テーマ</span>
                    <span className="font-bold text-slate-900 truncate" title={selectedTheme}>{selectedTheme}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-bold">画風テイスト</span>
                    <span className="font-bold text-slate-900 truncate" title={selectedTaste}>{selectedTaste.split(' ')[0]}</span>
                  </div>

                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 font-bold">総制作ボリューム</span>
                    <span className="font-extrabold text-indigo-600">全{episodeCount}話 × 各話30Cut (計{episodeCount * 30}コマ)</span>
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

              {/* Action Buttons */}
              <div className="flex justify-between items-center mt-2">
                <button
                  onClick={() => setStep(4)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors"
                >
                  戻る
                </button>

                <button
                  onClick={handleLaunch}
                  className="px-6 py-3 bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:from-emerald-700 hover:to-purple-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg transition-all transform hover:scale-102"
                >
                  <span className="material-symbols-outlined text-lg">rocket_launch</span>
                  <span>🚀 コミック一冊分の自動制作をスタート！</span>
                </button>
              </div>
            </div>
          )}

        </div>

      </div>

      {/* 画像拡大モーダル */}
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
              <span className="text-xs font-bold">{zoomImage.title}</span>
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
