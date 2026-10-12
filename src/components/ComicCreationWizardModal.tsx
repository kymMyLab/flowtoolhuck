import React, { useState, useRef, useEffect, useMemo } from 'react';
import { THEMES, THEME_CATEGORIES, resolveImageModel } from '../constants';
import { CastCharacter, SeriesEpisodePlan, SeriesManifest, ExpressionType, ProductionMode } from '../types';
import { createDefaultCastCharacter, EXPRESSION_METAS } from '../services/castStorage';
import { Flow } from 'flow-sdk';
import { callWithRetry, safeJsonParse, formatErrorMessage } from '../services/utils';
import { buildGrandDesignPrompt, cleanEpisodeTitle, cleanEpisodeTitleEn } from '../services/directorService';
import { loadCustomTastes, CustomTasteMap } from '../services/tasteStorage';
import { PRODUCTION_MODES_CONFIG, PRODUCTION_MODES_LIST } from '../config/studioDefinitions';
import {
  TurnaroundCandidate,
  ProduceSnapshot,
  brainstormProtagonistCandidates,
  generateCandidateTurnaroundImage,
  brainstormSubCharacters,
  brainstormStoryPlan
} from '../services/comicWizardService';
import { WizardStep1GenreTheme } from './wizard/WizardStep1GenreTheme';
import { WizardStep2SubCharacters } from './wizard/WizardStep2SubCharacters';
import { WizardStep3StoryPlan } from './wizard/WizardStep3StoryPlan';
import { WizardFooter } from './wizard/WizardFooter';
import { CastImageZoomModal } from './cast/CastImageZoomModal';

export type { TurnaroundCandidate, ProduceSnapshot };

// Produce Wizard 3-Step Flow:
// 1: 制作大枠(ジャンル)・世界観選定＆画風5選・三面図
// 2: お友達・サブキャラ配役
// 3: 話数選択(1〜50話)＆起承転結プロット＆連載スタート

interface ComicCreationWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode?: ProductionMode;
  currentTheme: string;
  currentTaste: string;
  onLaunchComicSeries: (payload: {
    productionMode: ProductionMode;
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
  currentMode = 'episodes',
  currentTheme,
  currentTaste,
  onLaunchComicSeries,
  onAddLog,
}) => {
  // ステップ管理: 1: 大枠＆三面図 ➔ 2: サブキャラ ➔ 3: プロット＆連載スタート
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // 制作大枠・ジャンル (Production Mode)
  const [productionMode, setProductionMode] = useState<ProductionMode>(currentMode || 'episodes');

  // モード定義の取得
  const currentModeConfig = useMemo(() => {
    return PRODUCTION_MODES_CONFIG[productionMode] || PRODUCTION_MODES_CONFIG.episodes;
  }, [productionMode]);

  // モードに応じたテーマ一覧（モード専用テーマがあれば優先、なければTHEMES）
  const activeThemesList = useMemo(() => {
    if (currentModeConfig.themes && currentModeConfig.themes.length > 0) {
      return currentModeConfig.themes;
    }
    return THEMES;
  }, [currentModeConfig]);

  // Step 1: 世界観テーマ
  const [selectedTheme, setSelectedTheme] = useState<string>(currentTheme || activeThemesList[0]);
  // カテゴリ絞り込みフィルタ ('all' または カテゴリ名)
  const [selectedThemeCategory, setSelectedThemeCategory] = useState<string>('all');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // モード変更ハンドラー（大枠選択時、テーマ・話数・カット数を自動連動）
  const handleModeChange = (newMode: ProductionMode) => {
    setProductionMode(newMode);
    const targetConfig = PRODUCTION_MODES_CONFIG[newMode] || PRODUCTION_MODES_CONFIG.episodes;
    
    // テーマの同期
    if (targetConfig.themes && targetConfig.themes.length > 0) {
      setSelectedTheme(targetConfig.themes[0]);
    } else if (!THEMES.includes(selectedTheme)) {
      setSelectedTheme(THEMES[0]);
    }

    // デフォルト話数・カット数の同期
    if (newMode === 'mv') {
      setEpisodeCount(1);
      setCutsPerEpisode(12);
    } else if (newMode === 'manga') {
      setEpisodeCount(1);
      setCutsPerEpisode(24);
    } else if (newMode === 'trivia' || newMode === 'quotes' || newMode === 'craft') {
      setEpisodeCount(1);
      setCutsPerEpisode(5);
    } else if (newMode === 'folklore') {
      setEpisodeCount(1);
      setCutsPerEpisode(12);
    } else {
      // episodes 等
      setEpisodeCount(4);
      setCutsPerEpisode(12);
    }

    onAddLog(`🎬 制作大枠を【${targetConfig.label}】に設定しました（${targetConfig.desc}）`, 'info');
  };

  // プロデュース設定をJSONとしてダウンロード保存
  const handleExportSnapshot = () => {
    try {
      const snapshot: ProduceSnapshot = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        productionMode,
        selectedTheme,
        tasteMode,
        selectedCustomTastes,
        candidates,
        selectedCandidateId,
        subCharacters,
        episodeCount,
        cutsPerEpisode,
        seriesTitle,
        overallSynopsis,
        episodesPlan,
        step,
      };
      const filename = `produce_plan_${(seriesTitle || selectedTheme.slice(0, 15)).replace(/[\s/\\?%*:|"<>]/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onAddLog(`💾 プロデュース設定JSONをダウンロード保存しました: 「${filename}」`, 'info');
    } catch (err: any) {
      onAddLog(`❌ JSON保存に失敗しました: ${err?.message || err}`, 'error');
    }
  };

  // プロデュース設定JSONをファイルから読み込んで復元
  const handleImportSnapshot = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed: Partial<ProduceSnapshot> = JSON.parse(text);
        if (parsed.productionMode) setProductionMode(parsed.productionMode);
        if (parsed.selectedTheme) setSelectedTheme(parsed.selectedTheme);
        if (parsed.tasteMode) setTasteMode(parsed.tasteMode);
        if (Array.isArray(parsed.selectedCustomTastes)) setSelectedCustomTastes(parsed.selectedCustomTastes);
        if (Array.isArray(parsed.candidates) && parsed.candidates.length > 0) {
          setCandidates(parsed.candidates);
          setSelectedCandidateId(parsed.selectedCandidateId || parsed.candidates[0].id);
        }
        if (Array.isArray(parsed.subCharacters)) setSubCharacters(parsed.subCharacters);
        if (typeof parsed.episodeCount === 'number') setEpisodeCount(parsed.episodeCount);
        if (typeof parsed.cutsPerEpisode === 'number') setCutsPerEpisode(parsed.cutsPerEpisode);
        if (parsed.seriesTitle) setSeriesTitle(parsed.seriesTitle);
        if (parsed.overallSynopsis) setOverallSynopsis(parsed.overallSynopsis);
        if (Array.isArray(parsed.episodesPlan)) setEpisodesPlan(parsed.episodesPlan);
        if (parsed.step && [1, 2, 3].includes(parsed.step)) setStep(parsed.step);
        onAddLog(`📂 プロデュース設定JSON「${file.name}」を正常に読み込み復元しました！`, 'info');
      } catch (err: any) {
        onAddLog(`❌ JSON読み込みに失敗しました: ${err?.message || err}`, 'error');
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

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

  // テーマをランダムに選定（選択中のモードに応じたテーマリストから選定）
  const handleRandomTheme = () => {
    const pool = activeThemesList.length > 0 ? activeThemesList : THEMES;
    const randomItem = pool[Math.floor(Math.random() * pool.length)];
    setSelectedTheme(randomItem);
    onAddLog(`🎲 【${currentModeConfig.label}】世界観テーマをランダム選定しました: 「${randomItem}」`, 'info');
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
        : `🧠 【${currentModeConfig.label}】「${selectedTheme}」に最適な【画風5選 × 主人公三面図】をGeminiが自動考案中...`,
      'process'
    );

    try {
      const initialCandidates = await brainstormProtagonistCandidates({
        productionMode,
        selectedTheme,
        tasteMode,
        selectedCustomTastes,
        availableTastes,
        currentModeConfig,
        onAddLog
      });

      setCandidates(initialCandidates);
      if (initialCandidates.length > 0) {
        setSelectedCandidateId(initialCandidates[0].id);
      }
      setIsBrainstormingCandidates(false);
      onAddLog('🎨 5組の画風・主人公設定が決定！三面図シート（16:9）を順次AI作画開始します...', 'process');

      for (let i = 0; i < initialCandidates.length; i++) {
        const cand = initialCandidates[i];
        setActiveGeneratingIndex(i);
        setCandidates(prev => prev.map((c, idx) => idx === i ? { ...c, status: 'generating_image' } : c));

        try {
          const { base64, mediaId } = await generateCandidateTurnaroundImage({
            candidate: cand,
            index: i,
            total: initialCandidates.length,
            onAddLog
          });

          setCandidates(prev => prev.map((c, idx) => 
            idx === i ? { ...c, turnaroundBase64: base64, turnaroundMediaId: mediaId, status: 'completed' } : c
          ));
          onAddLog(`✨ [${i + 1}/${initialCandidates.length}] 「${cand.name}」の三面図シートが完成！`, 'success');
        } catch (imgErr: any) {
          onAddLog(`⚠️ [${i + 1}/${initialCandidates.length}] 三面図作画エラー: ${formatErrorMessage(imgErr)}`, 'warning');
          setCandidates(prev => prev.map((c, idx) => 
            idx === i ? { ...c, status: 'error', errorMessage: formatErrorMessage(imgErr) } : c
          ));
        }
      }

      onAddLog('🎉 全5体の三面図シート作画が完了しました！お気に入りの1枚を選択してください。', 'success');
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
    try {
      const chars = await brainstormSubCharacters({
        productionMode,
        selectedTheme,
        seriesTitle,
        currentCandidate: target,
        currentModeConfig,
        onAddLog
      });
      setSubCharacters(chars);
    } finally {
      setIsGeneratingSubs(false);
    }
  };

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
  // Step 3: 選択した主人公三面図から起承転結ストーリー策定
  // =========================================================================
  const handleGenerateStoryPlan = async (targetCand?: TurnaroundCandidate, countToUse?: number) => {
    const target = targetCand || currentCandidate;
    if (!target) return;

    const count = countToUse || episodeCount;
    setIsGeneratingPlan(true);

    try {
      const { seriesTitle: newTitle, overallSynopsis: newSynopsis, episodesPlan: newPlan } = await brainstormStoryPlan({
        productionMode,
        selectedTheme,
        episodeCount: count,
        currentCandidate: target,
        currentModeConfig,
        onAddLog
      });
      setSeriesTitle(newTitle);
      setOverallSynopsis(newSynopsis);
      setEpisodesPlan(newPlan);
    } finally {
      setIsGeneratingPlan(false);
    }
  };

  // =========================================================================
  // Step 3: 自動制作の設計図を確定・ローンチ！
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
      seriesTitle: seriesTitle || (productionMode === 'mv' ? `${currentCandidate.name} MV Collection` : `${currentCandidate.name} 制作シリーズ`),
      totalEpisodes: episodeCount,
      currentEpisodeId: 1,
      completedEpisodeIds: [],
      overallSynopsis: overallSynopsis || `${selectedTheme}の世界を舞台にした${currentCandidate.name}の壮大な物語`,
      episodesPlan: displayedEpisodes.length > 0 ? displayedEpisodes : Array.from({ length: episodeCount }, (_, i) => ({
        epNumber: i + 1,
        titleJp: productionMode === 'mv' ? '心象の旋律' : '運命の序章',
        titleEn: productionMode === 'mv' ? 'Resonant Melody' : 'Prologue of Destiny',
        summary: `${currentCandidate.name}の物語`
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
        isMangaMode: productionMode === 'manga',
        isMultiPanel: productionMode === 'manga',
        productionMode: productionMode,
      }
    };

    onLaunchComicSeries({
      productionMode,
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
                <h3 className="text-base font-bold">作品プロデュース (大前提設定)</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-extrabold shadow-sm">
                  DIRECTION MASTER
                </span>
              </div>
              <p className="text-[11px] text-slate-300">
                世界観・主人公三面図・配役・全話プロットを事前に決定し、一貫した作品の方向性を確立します
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleImportSnapshot} 
              accept=".json" 
              className="hidden" 
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold flex items-center gap-1.5 transition-all border border-white/20 cursor-pointer shadow-2xs"
              title="以前ダウンロードしたプロデュース設定(JSON)を読み込んで復元"
            >
              <span className="material-symbols-outlined text-[16px]">file_upload</span>
              <span>JSON読込</span>
            </button>
            <button
              type="button"
              onClick={handleExportSnapshot}
              className="px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 transition-all border border-indigo-400/50 cursor-pointer shadow-2xs"
              title="現在のプロデュース設定（三面図・配役・プロット等）をJSONとしてダウンロード保存"
            >
              <span className="material-symbols-outlined text-[16px]">download</span>
              <span>JSON保存</span>
            </button>
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* Step Progress Bar */}
        <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs font-bold shrink-0">
          {[
            { num: 1, label: '① 制作大枠＆主人公三面図' },
            { num: 2, label: '② お友達・相棒配役' },
            { num: 3, label: '③ 話数・プロット＆方向性確定' },
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
          
          {step === 1 && (
            <WizardStep1GenreTheme
              productionMode={productionMode}
              currentModeConfig={currentModeConfig}
              onModeChange={handleModeChange}
              selectedTheme={selectedTheme}
              onThemeChange={setSelectedTheme}
              selectedThemeCategory={selectedThemeCategory}
              onThemeCategoryChange={setSelectedThemeCategory}
              onRandomTheme={handleRandomTheme}
              tasteMode={tasteMode}
              onTasteModeChange={setTasteMode}
              selectedCustomTastes={selectedCustomTastes}
              onToggleTaste={handleToggleTaste}
              onClearCustomTastes={() => setSelectedCustomTastes([])}
              tasteSearchQuery={tasteSearchQuery}
              onTasteSearchQueryChange={setTasteSearchQuery}
              filteredTasteKeys={filteredTasteKeys}
              onGenerateCandidates={handleGenerate5Candidates}
              isBrainstormingCandidates={isBrainstormingCandidates}
              activeGeneratingIndex={activeGeneratingIndex}
              candidates={candidates}
              selectedCandidateId={selectedCandidateId}
              currentCandidate={currentCandidate}
              onSelectCandidate={setSelectedCandidateId}
              onProceedToStep2={handleProceedToStep2}
              onZoomImage={setZoomImage}
            />
          )}

          {step === 2 && currentCandidate && (
            <WizardStep2SubCharacters
              currentCandidate={currentCandidate}
              subCharacters={subCharacters}
              isGeneratingSubs={isGeneratingSubs}
              onRerollSubCharacters={handleGenerateSubCharacters}
            />
          )}

          {step === 3 && currentCandidate && (
            <WizardStep3StoryPlan
              currentCandidate={currentCandidate}
              currentModeConfig={currentModeConfig}
              productionMode={productionMode}
              episodeCount={episodeCount}
              onEpisodeCountChange={handleEpisodeCountChange}
              cutsPerEpisode={cutsPerEpisode}
              onCutsPerEpisodeChange={setCutsPerEpisode}
              seriesTitle={seriesTitle}
              overallSynopsis={overallSynopsis}
              episodesPlan={episodesPlan}
              displayedEpisodes={displayedEpisodes}
              isGeneratingPlan={isGeneratingPlan}
              onGenerateStoryPlan={() => handleGenerateStoryPlan(currentCandidate, episodeCount)}
            />
          )}

        </div>

        <WizardFooter
          step={step}
          onSetStep={setStep}
          currentCandidate={currentCandidate}
          episodeCount={episodeCount}
          cutsPerEpisode={cutsPerEpisode}
          episodesPlan={episodesPlan}
          isGeneratingSubs={isGeneratingSubs}
          isGeneratingPlan={isGeneratingPlan}
          onProceedToStep2={() => handleProceedToStep2()}
          onProceedToStep3={handleProceedToStep3}
          onLaunch={handleLaunch}
        />

      </div>

      {/* 画像拡大Modal */}
      <CastImageZoomModal
        zoomImage={zoomImage}
        onClose={() => setZoomImage(null)}
      />

    </div>
  );
};
