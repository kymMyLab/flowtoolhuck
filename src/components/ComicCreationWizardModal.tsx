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

  // 制作大枠の選択肢一覧
  const AVAILABLE_PRODUCE_MODES: Array<{
    value: ProductionMode;
    label: string;
    icon: string;
    badge: string;
    desc: string;
  }> = [
    { value: 'episodes', label: '🎬 ドラマ連番', icon: 'movie', badge: '映画字幕', desc: '重厚なストーリー連載・長編大河ドラマ' },
    { value: 'mv', label: '🎵 音楽MV', icon: 'music_note', badge: '歌詞テロップ', desc: '楽曲連動・Ado風シネマティックMV' },
    { value: 'manga', label: '📖 短編マンガ', icon: 'auto_stories', badge: '漫画コマ割り', desc: 'フキダシ・効果音付きの読み切り漫画' },
    { value: 'trivia', label: '💡 雑学Shorts', icon: 'lightbulb', badge: 'TikTok特化', desc: '冒頭フック＆衝撃オチの解説動画' },
    { value: 'manzai', label: '🎙️ 漫才・掛け合い', icon: 'record_voice_over', badge: '演芸掛け合い', desc: 'テンポ良いボケ＆ツッコミの掛け合い劇' },
    { value: 'quotes', label: '📜 偉人・名言', icon: 'history_edu', badge: '格言・哲学', desc: '心に刺さる人生訓・厳粛な縦書き墨文字' },
    { value: 'folklore', label: '👻 怪異・未解決', icon: 'visibility', badge: '考察・ミステリー', desc: '背筋凍る怪奇譚・深紅ハイライト' },
    { value: 'craft', label: '🔨 職人技・伝統', icon: 'precision_manufacturing', badge: '至高の手仕事', desc: '神業ディテール・至高のドキュメンタリー' },
  ];

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
          
          {/* ========================================================
              STEP 1: 制作大枠選定 ＆ 世界観 ＆ 画風5選×三面図AI作画
             ======================================================== */}
          {step === 1 && (
            <div className="flex flex-col gap-4 animate-fadeIn">
              
              {/* Production Mode Selector Section (大枠選択) */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
                      <span className="material-symbols-outlined text-sm text-indigo-600">category</span>
                      ① 制作大枠・ジャンル (Production Mode)
                    </label>
                    <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60 font-bold">
                      ※ 選択したジャンルに合わせてテーマ・話数・AI演出が全自動で最適化されます
                    </span>
                  </div>
                  <div className="text-[11px] font-bold text-slate-500">
                    現在の大枠: <span className="text-indigo-600 font-extrabold">{currentModeConfig.label}</span>
                  </div>
                </div>

                {/* 大枠カード一覧 */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {AVAILABLE_PRODUCE_MODES.map((mode) => {
                    const isSelected = productionMode === mode.value;
                    return (
                      <button
                        key={mode.value}
                        type="button"
                        onClick={() => handleModeChange(mode.value)}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col gap-1 ${
                          isSelected
                            ? 'bg-gradient-to-br from-indigo-50/90 to-purple-50/90 border-indigo-500 ring-2 ring-indigo-500/30 shadow-xs'
                            : 'bg-slate-50/60 hover:bg-slate-100/80 border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-black flex items-center gap-1 text-slate-900">
                            <span className="material-symbols-outlined text-[16px] text-indigo-600">{mode.icon}</span>
                            {mode.label}
                          </span>
                          {isSelected && (
                            <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                              ✓
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-500 line-clamp-1 leading-snug">
                          {mode.desc}
                        </span>
                        <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700 font-bold w-fit mt-0.5">
                          {mode.badge}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Guidance Box */}
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200/80 p-3.5 rounded-xl flex items-start gap-3 text-indigo-950 shadow-2xs">
                <span className="material-symbols-outlined text-indigo-600 mt-0.5 text-xl">auto_fix_high</span>
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">制作大枠と世界観を選び、「三面図を一括AI作画」ボタンを押してください。</p>
                  <p className="text-indigo-700 mt-0.5">
                    基本は<strong>「AIおまかせ」</strong>で大枠に最適な5画風×三面図を自動作画しますが、<strong>「自分で画風を指定」</strong>で好きな画風を1〜5個ピンポイント指定することも可能です！
                    上部の<strong>「JSON保存」「JSON読込」</strong>で、設定内容をいつでもローカルにバックアップ・復元できます。
                  </p>
                </div>
              </div>

              {/* Theme Selector Section */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-amber-500">public</span>
                      {currentModeConfig.themeLabel || '世界観・テーマ'} ({currentModeConfig.label})
                    </label>
                    <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60 font-semibold">
                      ※ 選択した世界観から全話・全トラックの大河連載を展開可能
                    </span>
                  </div>
                  <button
                    onClick={handleRandomTheme}
                    className="px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm">casino</span>
                    🎲 ランダムに選定
                  </button>
                </div>

                {/* ジャンル区切りフィルタ・タブ */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
                  <button
                    type="button"
                    onClick={() => setSelectedThemeCategory('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                      selectedThemeCategory === 'all'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    すべて ({activeThemesList.length})
                  </button>
                  {/* ジャンル区切りフィルタ・タブ (ドラマ・通常時のみ表示、モード専用テーマがある時は専用バッジ) */}
                  {(!currentModeConfig.themes || currentModeConfig.themes.length === 0) ? (
                    THEME_CATEGORIES.map((cat, idx) => {
                      const isSelected = selectedThemeCategory === cat.category;
                      const shortLabel = cat.category.split(' ')[0] + ' ' + cat.category.split(' ')[1];
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedThemeCategory(cat.category)}
                          className={`px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                          }`}
                          title={cat.category}
                        >
                          {shortLabel} ({cat.items.length})
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
                      {currentModeConfig.label} に特化した厳選テーマ（全{currentModeConfig.themes.length}選）
                    </span>
                  )}
                </div>

                {/* 世界観ドロップダウン（モード固有テーマ または カテゴリ別テーマ） */}
                <div className="flex items-center gap-3">
                  <select
                    value={selectedTheme}
                    onChange={e => setSelectedTheme(e.target.value)}
                    className="flex-1 px-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold leading-relaxed cursor-pointer"
                  >
                    {currentModeConfig.themes && currentModeConfig.themes.length > 0 ? (
                      <optgroup label={`━━━ ${currentModeConfig.label} 厳選テーマ一覧 ━━━`} className="font-extrabold text-indigo-900 bg-slate-100 py-1">
                        {currentModeConfig.themes.map((themeItem, idx) => (
                          <option key={idx} value={themeItem} className="text-slate-800 bg-white font-medium py-1">
                            {themeItem}
                          </option>
                        ))}
                      </optgroup>
                    ) : (
                      THEME_CATEGORIES.filter(c => selectedThemeCategory === 'all' || selectedThemeCategory === c.category).map((cat, cIdx) => (
                        <optgroup key={cIdx} label={`━━━ ${cat.category} ━━━`} className="font-extrabold text-indigo-900 bg-slate-100 py-1">
                          {cat.items.map((themeItem, idx) => (
                            <option key={idx} value={themeItem} className="text-slate-800 bg-white font-medium py-1">
                              {themeItem}
                            </option>
                          ))}
                        </optgroup>
                      ))
                    )}
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
                <span className="material-symbols-outlined text-amber-600 mt-0.5 text-xl">tune</span>
                <div className="text-xs leading-relaxed">
                  <p className="font-bold">【{currentModeConfig.label}】制作ボリューム（{currentModeConfig.unit}数・カット数）を設定し、全体の構成プロットを確定します。</p>
                  <p className="text-amber-800 mt-0.5">
                    大枠「{currentModeConfig.label}」に沿った演出・テロップ（{currentModeConfig.telopNote}）で制作されます。
                  </p>
                </div>
              </div>

              {/* Episode & Cut Sliders */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-indigo-500">format_list_numbered</span>
                      制作ボリューム ({currentModeConfig.unit}数)
                    </label>
                    <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
                      全 {episodeCount} {currentModeConfig.unit}
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
                    <button type="button" onClick={() => handleEpisodeCountChange(1)} className={`hover:text-indigo-600 transition-colors cursor-pointer ${episodeCount === 1 ? 'text-indigo-600 font-black underline' : ''}`}>1{currentModeConfig.unit} {productionMode === 'mv' ? '(単曲)' : '(読切)'}</button>
                    <button type="button" onClick={() => handleEpisodeCountChange(2)} className={`hover:text-indigo-600 transition-colors cursor-pointer ${episodeCount === 2 ? 'text-indigo-600 font-black underline' : ''}`}>2{currentModeConfig.unit}</button>
                    <button type="button" onClick={() => handleEpisodeCountChange(4)} className={`hover:text-indigo-600 transition-colors cursor-pointer ${episodeCount === 4 ? 'text-indigo-600 font-black underline' : ''}`}>4{currentModeConfig.unit} {productionMode === 'mv' ? '(EP盤)' : '(起承転結)'}</button>
                    <button type="button" onClick={() => handleEpisodeCountChange(10)} className={`hover:text-indigo-600 transition-colors cursor-pointer ${episodeCount === 10 ? 'text-indigo-600 font-black underline' : ''}`}>10{currentModeConfig.unit}</button>
                    <button type="button" onClick={() => handleEpisodeCountChange(20)} className={`hover:text-indigo-600 transition-colors cursor-pointer ${episodeCount === 20 ? 'text-indigo-600 font-black underline' : ''}`}>20{currentModeConfig.unit}</button>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-2.5 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-sm text-purple-500">movie</span>
                      1{currentModeConfig.unit}あたりの作画カット数
                    </label>
                    <span className="text-xs font-extrabold text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
                      {cutsPerEpisode} Cut
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[5, 12, 24, 30].map(cnt => (
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
                        {cnt} Cut {cnt === (productionMode === 'mv' ? 12 : 30) ? '★' : ''}
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] text-slate-500 leading-tight">
                    ※ 大枠「{currentModeConfig.label}」の推奨カット数に合わせて設定できます。
                  </span>
                </div>
              </div>

              {/* Series Plot Container */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-2xs">
                <div className="flex items-center justify-between flex-wrap gap-2 min-h-[36px]">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-indigo-500 text-sm">history_edu</span>
                    <h4 className="text-xs font-bold text-slate-800">
                      シリーズ構成プロット {episodesPlan.length > 0 ? `(全 ${episodeCount} ${currentModeConfig.unit}構成 / ${displayedEpisodes.length}${currentModeConfig.unit}表示)` : `(全 ${episodeCount} ${currentModeConfig.unit}設定中)`}
                    </h4>
                  </div>

                  {/* プロット生成後のみ右上に「再生成」ボタンを1個だけ表示（未生成時は中央の特大ボタン1個に統一） */}
                  {episodesPlan.length > 0 && (
                    <button
                      type="button"
                      onClick={() => handleGenerateStoryPlan(currentCandidate, episodeCount)}
                      disabled={isGeneratingPlan}
                      className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer"
                    >
                      <span className={`material-symbols-outlined text-[15px] ${isGeneratingPlan ? 'animate-spin' : ''}`}>
                        {isGeneratingPlan ? 'autorenew' : 'refresh'}
                      </span>
                      <span>
                        {isGeneratingPlan ? '再構築中...' : `🔄 全${episodeCount}${currentModeConfig.unit}でプロット再生成`}
                      </span>
                    </button>
                  )}
                </div>

                {/* 話数変更時のリマインダー */}
                {episodesPlan.length > 0 && episodesPlan.length !== episodeCount && (
                  <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between text-xs text-amber-800">
                    <span className="flex items-center gap-1.5 font-bold">
                      <span className="material-symbols-outlined text-amber-600 text-sm">warning</span>
                      設定が【全 {episodeCount} {currentModeConfig.unit}】に変更されました。最新プロットを反映するには右上の「再生成」を押してください。
                    </span>
                  </div>
                )}

                {seriesTitle && (
                  <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col gap-1">
                    <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">確定タイトル</span>
                    <h3 className="text-sm font-black text-slate-900">『{seriesTitle}』</h3>
                    {overallSynopsis && (
                      <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{overallSynopsis}</p>
                    )}
                  </div>
                )}

                {/* Episodes Plan List or Placeholder Guide */}
                {episodesPlan.length === 0 ? (
                  <div className="py-8 px-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-center gap-3">
                    <span className="material-symbols-outlined text-4xl text-indigo-500">history_edu</span>
                    <div className="flex flex-col gap-1">
                      <p className="text-sm font-bold text-slate-800">プロットはまだ生成されていません</p>
                      <p className="text-xs text-slate-500 max-w-md">
                        上の設定で<strong>ボリューム（全{episodeCount}{currentModeConfig.unit}）</strong>と<strong>作画カット数（{cutsPerEpisode}Cut）</strong>を決めた後、下のボタンを押してください。
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleGenerateStoryPlan(currentCandidate, episodeCount)}
                      disabled={isGeneratingPlan}
                      style={{
                        backgroundColor: '#4f46e5',
                        color: '#ffffff'
                      }}
                      className="mt-1 px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                    >
                      <span className={`material-symbols-outlined text-base ${isGeneratingPlan ? 'animate-spin' : ''}`}>
                        {isGeneratingPlan ? 'autorenew' : 'auto_awesome'}
                      </span>
                      <span>
                        {isGeneratingPlan 
                          ? 'AIが全話プロットを構築中...' 
                          : `✨ 全${episodeCount}${currentModeConfig.unit}のプロットをAI生成する`}
                      </span>
                    </button>
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
              <div className="flex flex-col items-end gap-1.5">
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
                  title={episodesPlan.length === 0 ? '先にプロットをAI生成してください' : '大前提プロデュース設定を確定して画面を閉じます'}
                >
                  <span className="material-symbols-outlined text-lg">check_circle</span>
                  <span>
                    {episodesPlan.length === 0
                      ? `⚠️ 先にプロットを生成してください（${cutsPerEpisode}Cut × 全${episodeCount}話）`
                      : `✅ この設定を大前提として確定する（全${episodeCount}話 × ${cutsPerEpisode}Cut）`}
                  </span>
                </button>
                {episodesPlan.length > 0 && (
                  <span className="text-[10px] text-slate-500 font-medium">
                    ※ 確定するとモーダルが閉じます。サイドバーでアスペクト比や動画化を確認後、【③ 作成開始】を押してください。
                  </span>
                )}
              </div>
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
