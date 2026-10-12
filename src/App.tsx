import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ConfirmationModal } from './components/Primitives';
import { MediaPreviewModal } from './components/MediaPreviewModal';
import { ArchiveDrawer } from './components/ArchiveDrawer';
import { StudioSidebar } from './components/StudioSidebar';
import { StudioHeader } from './components/StudioHeader';
import { EpisodeSection } from './components/EpisodeSection';
import { StudioLogs, LogEntry } from './components/StudioLogs';
import { Cut, GeneratorSettings, VideoModelType, Episode, ProductionMode } from './types';
import { THEMES, TASTES, IMAGE_MODELS, VIDEO_MODELS } from './constants';
import { createLogMessage } from './services/utils';
import { initDB, getAllStories, StoryRecord } from './services/db';
import { downloadZip, triggerBrowserDownload, savePackageFile } from './services/exportService';
import { useStudioProduction } from './services/useStudioProduction';
import { extractHighlights } from './services/directorService';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadCustomThemes } from './services/themeStorage';
import { loadCustomTastes } from './services/tasteStorage';

const ThemeEditorModal = React.lazy(() => import('./components/ThemeEditorModal').then(m => ({ default: m.ThemeEditorModal })));
const TasteEditorModal = React.lazy(() => import('./components/TasteEditorModal').then(m => ({ default: m.TasteEditorModal })));
const CastManagerModal = React.lazy(() => import('./components/CastManagerModal').then(m => ({ default: m.CastManagerModal })));
const ComicCreationWizardModal = React.lazy(() => import('./components/ComicCreationWizardModal').then(m => ({ default: m.ComicCreationWizardModal })));
import { MusicImportModal } from './components/music/MusicImportModal';
import { loadMangaProject, saveMangaProject } from './services/castStorage';
import { MangaProject, CastCharacter, ExpressionType, ReferenceAsset, SeriesManifest } from './types';
import { saveReferenceAsset } from './services/db';

export default function App() {
  const [settings, setSettings] = useState<GeneratorSettings>({
    productionMode: 'episodes', country: '日本', theme: THEMES[0], taste: Object.keys(TASTES)[0], imageModel: IMAGE_MODELS[1].label, defaultVideoModel: VIDEO_MODELS[0].label, videoRatio: '30%', episodeCount: 1, previewCutCount: 3, parallelCount: 2, autoVideo: false, autoDownload: false, superBackoff: false, isMvMode: false, isMultiPanel: false, aspectRatio: '1:1',
    enableTurnaroundSheet: true, autoApproveTurnaround: true, enableObjectCut: true, enableEndFrames: true
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);

  // ログ保持数を9999に拡大（1万行制限）＆グローバルストアに即時同期 ＆ DevToolsコンソールへもリアルタイム出力
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    // 開発者ツールコンソールへのリアルタイム出力（色分けバッジ付き）
    const colors: Record<string, string> = {
      info: '#3b82f6',
      process: '#8b5cf6',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444'
    };
    const color = colors[type] || '#3b82f6';
    const tag = `[FlowTool ${type.toUpperCase()}]`;
    const consoleFn = type === 'error' ? console.error : type === 'warning' ? console.warn : console.log;
    consoleFn(
      `%c${tag}%c ${message}`,
      `background: ${color}; color: #ffffff; font-weight: bold; padding: 2px 4px; border-radius: 3px; font-size: 10px;`,
      'color: inherit; font-size: 11px;'
    );

    setLogs(prev => {
      const next = [...prev.slice(-9999), { id: Math.random().toString(36).substr(2, 9), message: createLogMessage(message), type }];
      if (typeof window !== 'undefined') {
        (window as any).__STUDIO_LOGS__ = next;
      }
      return next;
    });
  }, []);

  const [stories, setStories] = useState<StoryRecord[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [isLogDrawerOpen, setIsLogDrawerOpen] = useState(false);
  const [customThemes, setCustomThemes] = useState(() => loadCustomThemes());
  const [customTastes, setCustomTastes] = useState(() => loadCustomTastes());
  const [isThemeEditorOpen, setIsThemeEditorOpen] = useState(false);
  const [isTasteEditorOpen, setIsTasteEditorOpen] = useState(false);
  const [mangaProject, setMangaProject] = useState<MangaProject>(() => loadMangaProject());
  const [isCastModalOpen, setIsCastModalOpen] = useState(false);
  const [isComicWizardOpen, setIsComicWizardOpen] = useState(false);
  const [isMusicImportOpen, setIsMusicImportOpen] = useState(false);
  const [injectedJsonText, setInjectedJsonText] = useState<string>('');
  const [isGlobalDragging, setIsGlobalDragging] = useState(false);
  const globalDragCounterRef = useRef(0);
  const resumeFileRef = useRef<HTMLInputElement>(null);
  const [previewingCutData, setPreviewingCutData] = useState<{ epId: number; cut: Cut } | null>(null);



  const handleUpdateMangaProject = useCallback((updated: MangaProject) => {
    setMangaProject(prev => {
      // 既存キャラの表情画像が消えないよう保護マージ
      const mergedChars = updated.characters.map(newChar => {
        const prevChar = prev.characters.find(c => c.id === newChar.id);
        if (!prevChar) return newChar;
        const mergedExpressions: any = { ...newChar.expressions };
        (Object.keys(prevChar.expressions) as ExpressionType[]).forEach(expKey => {
          if (!mergedExpressions[expKey]?.imageBase64 && prevChar.expressions[expKey]?.imageBase64) {
            mergedExpressions[expKey] = {
              ...mergedExpressions[expKey],
              imageBase64: prevChar.expressions[expKey].imageBase64,
              mediaId: prevChar.expressions[expKey].mediaId
            };
          }
        });
        return {
          ...newChar,
          avatarBase64: newChar.avatarBase64 || prevChar.avatarBase64,
          expressions: mergedExpressions
        };
      });
      const next: MangaProject = { ...updated, characters: mergedChars };
      saveMangaProject(next);
      return next;
    });
  }, []);

  const handleApplyCharacterToVault = useCallback(async (char: CastCharacter, expressionType: ExpressionType = 'neutral') => {
    const exp = char.expressions[expressionType] || char.expressions.neutral;
    const base64 = exp?.imageBase64 || char.avatarBase64;
    if (!base64) {
      addLog(`⚠️ 「${char.name}」にはまだ画像が登録されていません。先にAI作画またはアップロードを行ってください。`, 'warning');
      return;
    }

    const newAsset: ReferenceAsset = {
      name: `${char.name} [${exp?.label || '通常'}]`,
      base64: base64,
      mimeType: 'image/png',
      characterAnalysis: char.dnaPromptEn,
      styleAnalysis: exp?.promptModifierEn,
      createdAt: new Date().toISOString()
    };

    try {
      const id = await saveReferenceAsset(newAsset);
      setSettings(prev => ({ ...prev, selectedAssetId: id }));
      addLog(`✨ キャスト「${char.name}」を参照庫へ登録し、Active DNAとして同期しました！`, 'success');
    } catch (err: any) {
      addLog(`❌ 参照庫への登録に失敗しました: ${err.message}`, 'error');
    }
  }, [addLog]);

  // マウント時にDevToolsコンソールへ準備完了バナーと制作構成を出力
  useEffect(() => {
    console.log(
      '%c🚀 [FlowTool Studio Pro] スタジオマウント完了！待機中 (Standby)',
      'background: linear-gradient(90deg, #2563eb, #7c3aed); color: #fff; font-weight: bold; font-size: 13px; padding: 4px 8px; border-radius: 4px;'
    );
    console.log(
      `🎬 制作プリセット: 【モード: ${settings.productionMode || '通常'}】 / 【テーマ: ${settings.theme}】 / 【画風: ${settings.taste}】 / 【全${settings.totalEpisodes || settings.episodeCount || 1}話】`
    );
    console.log('💡 左サイドバーの【全自動プロデュース開始】または【シリーズレジューム】をクリックすると制作が始まります。進行ログはここにもリアルタイム出力されます。');
  }, []);

  const refreshStories = useCallback(async () => {
    const all = await getAllStories();
    setStories(all);
  }, []);

  const { episodes, setEpisodes, isProducing, startProduction, abortProduction, resumeSeries, activeSeriesManifest, handleGenerateRemaining, handleBulkVideo, handleBulkBrowserVideo, handleExportFullMovie, handleBulkRerollTelop, generateImage, generateEndFrame, generateInfographicCover, generateVideo, generateBrowserVideo, updateCut, updateEpisode, clearEpisodes } = useStudioProduction({ 
    settings, 
    addLog, 
    refreshStories,
    logs
  });

  const episodesRef = useRef(episodes);
  episodesRef.current = episodes;

  const handleDeployMusicEpisode = useCallback((ep: Episode) => {
    setEpisodes([ep]);
    setSettings(prev => ({
      ...prev,
      productionMode: 'mv',
      isMvMode: true,
      theme: ep.theme || prev.theme,
      taste: ep.taste || prev.taste,
      episodeCount: 1,
      totalEpisodes: 1
    }));
    addLog(`🎵 CT198楽曲「${ep.titleJp}」の12カット絵コンテを展開しました！（サビ30秒テロップ＆伏線小道具自動バインド済）`, 'success');
  }, [setEpisodes, setSettings, addLog]);

  const handleDeployBatchMusicEpisodes = useCallback((eps: Episode[]) => {
    setEpisodes(eps);
    setSettings(prev => ({
      ...prev,
      productionMode: 'mv',
      isMvMode: true,
      theme: eps[0]?.theme || prev.theme,
      taste: eps[0]?.taste || prev.taste,
      episodeCount: eps.length,
      totalEpisodes: eps.length
    }));
    addLog(`🎵 CT198楽曲 全${eps.length}曲の12カット絵コンテを一括展開しました！`, 'success');
  }, [setEpisodes, setSettings, addLog]);

  // ヘッダー等で画風（taste）が変更された際、画像未生成のエピソード群のtasteも即座に同期
  useEffect(() => {
    if (!settings.taste) return;
    setEpisodes(prev => {
      let changed = false;
      const next = prev.map(ep => {
        const hasImages = ep.cuts.some(c => !!(c.imageBase64 || c.imageMediaId));
        if (!hasImages && ep.taste !== settings.taste) {
          changed = true;
          return { ...ep, taste: settings.taste };
        }
        return ep;
      });
      return changed ? next : prev;
    });
  }, [settings.taste, setEpisodes]);

  // グローバル（コンソール）から全エピソードデータにいつでも直接アクセス・救出可能にする
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__STUDIO_EPISODES__ = episodes;
    }
  }, [episodes]);

  const handleLaunchComicSeries = useCallback(async (payload: {
    productionMode: ProductionMode;
    theme: string;
    taste: string;
    protagonist: CastCharacter;
    subCharacters: CastCharacter[];
    manifest: SeriesManifest;
    totalEpisodes: number;
    cutsPerEpisode: number;
  }) => {
    addLog(`🎯 大前提プロデュース設定を確定: 『${payload.manifest.seriesTitle}』(全${payload.totalEpisodes}話 × ${payload.cutsPerEpisode}Cut)`, 'success');

    // 1. キャスト台帳を更新
    const allCharacters = [payload.protagonist, ...payload.subCharacters];
    const newProject: MangaProject = {
      ...mangaProject,
      title: payload.manifest.seriesTitle,
      description: payload.manifest.overallSynopsis,
      characters: allCharacters,
      activeCharacterId: payload.protagonist.id,
      updatedAt: new Date().toISOString()
    };
    handleUpdateMangaProject(newProject);

    // 2. スタジオ設定を大枠仕様に自動同期（ドラマ連番 / 音楽MV / マンガ等）
    const effectiveSettingsUpdates: Partial<GeneratorSettings> = {
      productionMode: payload.productionMode,
      isMvMode: payload.productionMode === 'mv',
      isMangaMode: payload.productionMode === 'manga',
      isMultiPanel: payload.productionMode === 'manga',
      theme: payload.theme,
      taste: payload.taste,
      previewCutCount: payload.cutsPerEpisode,
      episodeCount: payload.totalEpisodes,
    };
    setSettings(prev => ({
      ...prev,
      ...effectiveSettingsUpdates
    }));

    // 3. シリーズ設計図を復元注入（主人公三面図をマスター参照画像としてセット）
    await resumeSeries(payload.manifest, (assetId) => {
      effectiveSettingsUpdates.selectedAssetId = assetId;
      setSettings(prev => ({ ...prev, selectedAssetId: assetId }));
    });

    // 4. ウィザードで「連載スタート」を押した後は、二度手間なく直ちに全自動で本編作画を開始！
    addLog(`🚀 【全自動連載スタート】『${payload.manifest.seriesTitle}』の本編作画を直ちに開始します！`, 'success');
    await startProduction(effectiveSettingsUpdates);
  }, [mangaProject, handleUpdateMangaProject, resumeSeries, addLog, startProduction]);

  const handleDownloadZip = useCallback(async (ep: Episode) => {
    const filename = ep.packageZipFilename || `Episode_${ep.id}_Package.zip`;
    console.log(`[FlowTool] 手動ダウンロードボタン押下: Ep.${ep.id} (${filename})`);

    // 1. すでに ZIP が生成済みの場合は、即座に savePackageFile をキック！（直接保存）
    if (ep.packageZipBlobUrl) {
      addLog(`💾 作成済みパッケージ「${filename}」を直接保存中...`, 'process');
      try {
        window.open(ep.packageZipBlobUrl, '_blank');
      } catch (_) {}

      try {
        const resp = await fetch(ep.packageZipBlobUrl);
        const blob = await resp.blob();
        await savePackageFile(blob, filename, addLog, `FlowTool_Ep${ep.id}_Package.zip`);
        return;
      } catch (err: any) {
        console.warn('[FlowTool] 作成済みBlob URLの取得失敗、再パッケージングを実行:', err);
      }
    }

    // 2. まだ ZIP が未生成（または失効）の場合は生成して即座に保存
    const res = await downloadZip(ep, addLog, activeSeriesManifest || undefined, logs);
    if (res) {
      updateEpisode(ep.id, {
        packageZipBlobUrl: res.blobUrl,
        packageZipFilename: res.filename,
        packageZipSizeStr: res.sizeStr
      });
    }
  }, [addLog, activeSeriesManifest, logs, updateEpisode]);

  const handleResumeSeries = useCallback(async (e: React.ChangeEvent<HTMLInputElement> | any) => {
    let manifest = e;
    if (e?.target?.files) {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        manifest = JSON.parse(text);
        if (!manifest.seriesTitle || !manifest.episodesPlan) {
          addLog('❌ 有効なシリーズ設定ファイル(JSON)ではありません。', 'error');
          return;
        }
      } catch (err: any) {
        addLog(`❌ JSON読み込み失敗: ${err.message}`, 'error');
        return;
      }
    }
    if (manifest.settings) {
      setSettings(prev => ({ ...prev, ...manifest.settings }));
    }
    await resumeSeries(manifest, (assetId: number) => {
      setSettings(prev => ({ ...prev, selectedAssetId: assetId }));
    });
  }, [resumeSeries, addLog]);

  // アプリ全体の全画面ドラッグ＆ドロップ監視（JSONファイルならいつでも即座に音楽インポーターまたはシリーズ/キャスト復元を自動起動）
  useEffect(() => {
    const handleGlobalDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      globalDragCounterRef.current += 1;
      setIsGlobalDragging(true);
      console.log('📥 [FlowTool D&D] dragenter検知', {
        types: Array.from(e.dataTransfer?.types || []),
        counter: globalDragCounterRef.current,
        target: (e.target as HTMLElement)?.tagName
      });
    };

    const handleGlobalDragLeave = (e: DragEvent) => {
      e.preventDefault();
      globalDragCounterRef.current -= 1;
      if (globalDragCounterRef.current <= 0) {
        globalDragCounterRef.current = 0;
        setIsGlobalDragging(false);
      }
      console.log('📤 [FlowTool D&D] dragleave', { counter: globalDragCounterRef.current });
    };

    const handleGlobalDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleGlobalDrop = async (e: DragEvent) => {
      e.preventDefault();
      setIsGlobalDragging(false);
      globalDragCounterRef.current = 0;

      const fileList = e.dataTransfer?.files;
      const file = fileList?.[0];

      console.log('🚀 [FlowTool D&D] 全画面ドロップ検知!!', {
        filesLength: fileList?.length || 0,
        fileName: file?.name,
        fileSize: file?.size,
        fileType: file?.type,
        dataTransferTypes: Array.from(e.dataTransfer?.types || [])
      });

      if (!file) {
        console.warn('⚠️ [FlowTool D&D] ドロップイベントが発生しましたが、files が空でした。', e.dataTransfer);
        return;
      }

      try {
        const text = await file.text();
        console.log(`📥 [FlowTool D&D] ファイル即座読み取り成功 (${text.length}文字)`);

        // JSONの中身をパースして自動仕分け
        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
        } catch (jsonErr: any) {
          console.warn('⚠️ [FlowTool D&D] JSON解析警告:', jsonErr);
        }

        // A. 連載シリーズ設定JSON (seriesTitle または episodesPlan)
        if (parsed && (parsed.seriesTitle || parsed.episodesPlan)) {
          addLog(`📂 連載シリーズ設定「${parsed.seriesTitle || file.name}」を復元します`, 'process');
          await handleResumeSeries(parsed);
          return;
        }

        // B. キャスト設定JSON (characters 配列)
        if (parsed && Array.isArray(parsed.characters) && parsed.characters.length > 0 && !parsed.tracks) {
          addLog(`🎭 キャスト設定「${parsed.title || file.name}」を復元します`, 'process');
          saveMangaProject(parsed);
          setMangaProject(parsed);
          alert(`✅ キャスト（${parsed.characters.length}人）を正常に復元しました！`);
          return;
        }

        // C. 楽曲メタデータ（またはその他JSON）
        // 音楽インポートモーダルを開き、テキストを直接注入！
        setInjectedJsonText(text);
        setIsMusicImportOpen(true);
        addLog(`🎵 楽曲メタデータ「${file.name}」(${Math.round(file.size / 1024)}KB) をインポーターへ展開しました！`, 'process');

      } catch (readErr: any) {
        console.error('❌ [FlowTool D&D] ファイル読み取り失敗:', readErr);
        addLog(`❌ ファイル読み取り失敗: ${readErr.message}`, 'error');
      }
    };

    window.addEventListener('dragenter', handleGlobalDragEnter);
    window.addEventListener('dragleave', handleGlobalDragLeave);
    window.addEventListener('dragover', handleGlobalDragOver);
    window.addEventListener('drop', handleGlobalDrop);

    document.addEventListener('dragover', handleGlobalDragOver);
    document.addEventListener('drop', handleGlobalDrop);

    return () => {
      window.removeEventListener('dragenter', handleGlobalDragEnter);
      window.removeEventListener('dragleave', handleGlobalDragLeave);
      window.removeEventListener('dragover', handleGlobalDragOver);
      window.removeEventListener('drop', handleGlobalDrop);
      document.removeEventListener('dragover', handleGlobalDragOver);
      document.removeEventListener('drop', handleGlobalDrop);
    };
  }, [addLog, handleResumeSeries]);

  const updateCutWrapped = useCallback((epId: number, cutId: number, updates: Partial<Cut>) => {
    // ナレーションが更新された場合はテロップテキストとハイライトも自動同期（演出設定は保持）
    let finalUpdates = { ...updates };
    if (updates.narrationJp !== undefined) {
      const highlights = extractHighlights(updates.narrationJp);
      const existingTelop = episodesRef.current.find(e => e.id === epId)?.cuts.find(c => c.id === cutId)?.telop;
      finalUpdates.telop = {
        fullText: updates.narrationJp,
        highlights: highlights,
        style: existingTelop?.style || 'mv-blur-slide',
        transition: existingTelop?.transition || 'blur-slide-left',
        position: existingTelop?.position || 'bottom-left',
        directorNote: existingTelop?.directorNote || ''
      };
    }
    updateCut(epId, cutId, finalUpdates);
    setPreviewingCutData(prev => (prev && prev.epId === epId && prev.cut.id === cutId) ? { ...prev, cut: { ...prev.cut, ...finalUpdates } } : prev);
  }, [updateCut]);

  useEffect(() => {
    initDB().then(refreshStories);
    const styleId = 'studio-core-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `@import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@700;900&family=Outfit:wght@800;900&family=Montserrat:wght@800;900&family=Dela+Gothic+One&display=swap'); .no-wrap-row { display: flex; flex-direction: row; flex-wrap: nowrap; overflow-x: auto; scroll-behavior: smooth; } .dark-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; } .dark-scrollbar::-webkit-scrollbar-track { background: transparent; } .dark-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; } .dark-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; } @keyframes slideIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } } .animate-slide-in { animation: slideIn 0.3s ease-out forwards; } @keyframes dropdown-enter { from { opacity: 0; transform: scale(0.97) translateY(-4px); } to { opacity: 1; transform: scale(1) translateY(0); } } .animate-dropdown { animation: dropdown-enter 0.15s ease-out forwards; } .no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`;
      document.head.appendChild(style);
    }
  }, [refreshStories]);

  // 先行プレビュー枚数分（または各話のカット）の画像がまだ未生成であるかどうかを厳密に判定
  const hasPendingCuts = episodes.length > 0 && episodes.some(ep => {
    const targetCount = Math.min(settings.previewCutCount || 12, ep.cuts.length);
    const readyCount = ep.cuts.slice(0, targetCount).filter(c => !!(c.imageBase64 || c.imageMediaId)).length;
    return readyCount < targetCount;
  });
  // 待機中（光る状態）＝ 現在制作中ではなく、かつ未生成のカットが存在すること
  const isWaitingForStart = !isProducing && hasPendingCuts;

  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900 select-none overflow-hidden relative">
        {/* 全画面 JSON ドロップゾーン オーバーレイ */}
        {isGlobalDragging && (
          <div className="absolute inset-0 z-[9999] bg-violet-950/85 backdrop-blur-md flex flex-col items-center justify-center pointer-events-none animate-fadeIn border-4 border-dashed border-violet-400 m-4 rounded-3xl shadow-2xl">
            <div className="w-24 h-24 rounded-full bg-violet-600/50 flex items-center justify-center mb-6 ring-8 ring-violet-400/30 animate-bounce">
              <span className="text-5xl">🎵</span>
            </div>
            <h2 className="text-3xl font-black text-white tracking-wider mb-3 drop-shadow">
              楽曲メタデータ (JSON) をドロップ
            </h2>
            <p className="text-violet-200 text-base font-bold bg-violet-900/60 px-6 py-2 rounded-full border border-violet-400/40">
              画面のどこに落としても即座にMV制作インポーターが起動します
            </p>
          </div>
        )}
        <StudioHeader 
          settings={settings}
          setSettings={setSettings}
          isProducing={isProducing}
          onStart={startProduction}
          onAbort={abortProduction}
          onClear={() => setIsTrashModalOpen(true)}
          onOpenArchive={() => setArchiveOpen(true)}
          onToggleLogs={() => setIsLogDrawerOpen(prev => !prev)}
          customThemes={customThemes}
          customTastes={customTastes}
          onOpenThemeEditor={() => setIsThemeEditorOpen(true)}
          onOpenTasteEditor={() => setIsTasteEditorOpen(true)}
          onOpenCastModal={() => setIsCastModalOpen(true)}
          onOpenComicWizard={() => setIsComicWizardOpen(true)}
          onOpenMusicImport={() => setIsMusicImportOpen(true)}
          castCount={mangaProject.characters.length}
          activeSeriesManifest={activeSeriesManifest}
          onResumeClick={() => resumeFileRef.current?.click()}
          isLogDrawerOpen={isLogDrawerOpen}
          isWaitingForStart={isWaitingForStart}
        />
        <div className="flex flex-1 overflow-hidden relative">
          <StudioSidebar settings={settings} setSettings={setSettings} isProducing={isProducing} onAddLog={addLog} />
          
          <div className="flex-1 overflow-y-auto p-8 bg-slate-100 dark-scrollbar relative">
        <div className="max-w-[1300px] mx-auto flex flex-col gap-12">


          {episodes.map(ep => (
            <EpisodeSection 
              key={ep.id} ep={ep} aspectRatio={settings.aspectRatio || '1:1'} onGenerateRemaining={handleGenerateRemaining} onBulkVideo={handleBulkVideo} onBulkBrowserVideo={handleBulkBrowserVideo} onExportFullMovie={handleExportFullMovie} onDownloadZip={handleDownloadZip} onAnimateRequest={generateVideo} onPreviewCut={(eId, cut) => setPreviewingCutData({ epId: eId, cut })} onUpdateCut={updateCutWrapped} onBulkRerollTelop={handleBulkRerollTelop} onGenerateCover={generateInfographicCover} onRetry={(type, eId, cId) => {
                const epFound = episodes.find(e => e.id === eId);
                const cutFound = epFound?.cuts.find(c => c.id === cId);
                if (type === 'image' && cutFound) {
                  const epTaste = epFound?.taste || cutFound.styleKeyUsed || settings.taste;
                  generateImage({ 
                    epId: eId, 
                    cutId: cId, 
                    prompt: cutFound.promptEn, 
                    negativePrompt: cutFound.negativePrompt, 
                    styleKey: epTaste, 
                    imageModel: settings.imageModel, 
                    isMvMode: epFound?.isMvMode,
                    isMultiPanel: settings.isMultiPanel,
                    panelLayout: cutFound.panelLayout,
                    eraAnalysis: epFound?.eraAnalysis, 
                    forbiddenAnachronisms: epFound?.forbiddenAnachronisms,
                    authenticAttireEn: epFound?.authenticAttireEn,
                    forbiddenKeywordsEn: epFound?.forbiddenKeywordsEn
                  });
                } else if (type === 'video' && cutFound) {
                  generateVideo(eId, cId, (cutFound.targetVideoModel === 'none' ? 'omni-flash' : cutFound.targetVideoModel) as VideoModelType);
                }
              }} 
            />
          ))}
          {episodes.length === 0 && <div className="h-[60vh] flex flex-col items-center justify-center opacity-20 gap-4"><span className="material-symbols-outlined text-[120px]">movie_edit</span><p className="text-xl font-black uppercase tracking-widest italic">Studio Ready</p></div>}
        </div>
      </div>

      {previewingCutData && (() => {
        const ep = episodes.find(e => e.id === previewingCutData.epId);
        const cuts = ep?.cuts || [];
        const currentIndex = cuts.findIndex(c => c.id === previewingCutData.cut.id);
        const activeCut = (currentIndex >= 0 ? cuts[currentIndex] : previewingCutData.cut);
        const hasPrev = currentIndex > 0;
        const hasNext = currentIndex >= 0 && currentIndex < cuts.length - 1;
        const handlePrev = hasPrev ? () => setPreviewingCutData({ epId: previewingCutData.epId, cut: cuts[currentIndex - 1] }) : undefined;
        const handleNext = hasNext ? () => setPreviewingCutData({ epId: previewingCutData.epId, cut: cuts[currentIndex + 1] }) : undefined;

        return (
          <MediaPreviewModal 
            isOpen={true} 
            cut={activeCut} 
            episodeId={previewingCutData.epId} 
            currentImageModel={settings.imageModel} 
            isMvMode={ep?.isMvMode ?? settings.isMvMode} 
            hasPrev={hasPrev}
            hasNext={hasNext}
            onPrev={handlePrev}
            onNext={handleNext}
            currentIndex={currentIndex >= 0 ? currentIndex + 1 : activeCut.id}
            totalCuts={cuts.length}
            onClose={() => setPreviewingCutData(null)} 
            onAnimate={m => generateVideo(previewingCutData.epId, activeCut.id, m)} 
            onBrowserAnimate={() => generateBrowserVideo(previewingCutData.epId, activeCut.id)} 
            onUpdateCut={updates => updateCutWrapped(previewingCutData.epId, activeCut.id, updates)} 
            onBulkRerollTelop={handleBulkRerollTelop}
            onRegenerateImage={(model, prompt, neg) => {
              const epTaste = ep?.taste || activeCut.styleKeyUsed || settings.taste;
              generateImage({ 
                epId: previewingCutData.epId, 
                cutId: activeCut.id, 
                prompt: prompt || activeCut.promptEn, 
                negativePrompt: neg || activeCut.negativePrompt, 
                styleKey: epTaste, 
                imageModel: model, 
                isMvMode: ep?.isMvMode,
                isMultiPanel: settings.isMultiPanel,
                panelLayout: activeCut.panelLayout,
                eraAnalysis: ep?.eraAnalysis, 
                forbiddenAnachronisms: ep?.forbiddenAnachronisms,
                authenticAttireEn: ep?.authenticAttireEn,
                forbiddenKeywordsEn: ep?.forbiddenKeywordsEn
              });
            }}
            onGenerateEndFrame={(epId, cutId, customPrompt) => generateEndFrame(epId, cutId, customPrompt)}
          />
        );
      })()}
          
          <StudioLogs 
            logs={logs} 
            onAddLog={addLog} 
            isProducing={isProducing} 
            isOpen={isLogDrawerOpen} 
            onClose={() => setIsLogDrawerOpen(false)} 
          />
        </div>
        <ArchiveDrawer isOpen={archiveOpen} onClose={() => setArchiveOpen(false)} stories={stories} onRemake={(s) => { setSettings(prev => ({ ...prev, country: s.country, era: s.era, theme: s.theme })); setArchiveOpen(false); }} />
        <ConfirmationModal isOpen={isTrashModalOpen} title="全消去" message="制作中のデータを消去します。" onConfirm={() => { clearEpisodes(); setIsTrashModalOpen(false); }} onCancel={() => setIsTrashModalOpen(false)} />
        <React.Suspense fallback={null}>
          <ThemeEditorModal 
            isOpen={isThemeEditorOpen} 
            onClose={() => setIsThemeEditorOpen(false)} 
            currentMode={settings.productionMode} 
            modeLabel={settings.productionMode} 
            onThemesUpdated={(updatedList) => {
              setCustomThemes(prev => ({ ...prev, [settings.productionMode]: updatedList }));
            }} 
          />
          <TasteEditorModal 
            isOpen={isTasteEditorOpen} 
            onClose={() => setIsTasteEditorOpen(false)} 
            onTastesUpdated={(updatedTastes) => {
              setCustomTastes(updatedTastes);
            }} 
          />
          <CastManagerModal
            isOpen={isCastModalOpen}
            onClose={() => setIsCastModalOpen(false)}
            project={mangaProject}
            onUpdateProject={handleUpdateMangaProject}
            onApplyCharacterToVault={handleApplyCharacterToVault}
            onAddLog={addLog}
            currentTaste={settings.taste}
            onOpenComicWizard={() => {
              setIsCastModalOpen(false);
              setIsComicWizardOpen(true);
            }}
          />
          <ComicCreationWizardModal
            isOpen={isComicWizardOpen}
            onClose={() => setIsComicWizardOpen(false)}
            currentMode={settings.productionMode}
            currentTheme={settings.theme}
            currentTaste={settings.taste}
            onLaunchComicSeries={handleLaunchComicSeries}
            onAddLog={addLog}
          />
        </React.Suspense>
        <MusicImportModal
          isOpen={isMusicImportOpen}
          initialJsonText={injectedJsonText}
          onClose={() => {
            setIsMusicImportOpen(false);
            setInjectedJsonText('');
          }}
          onDeployEpisode={handleDeployMusicEpisode}
          onDeployBatchEpisodes={handleDeployBatchMusicEpisodes}
        />
        <input type="file" accept=".json" ref={resumeFileRef} style={{ display: 'none' }} onChange={handleResumeSeries} />
      </div>
    </ErrorBoundary>
  );
}