import React, { useState, useEffect, useCallback, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { MediaPreviewModal } from './components/MediaPreviewModal';
import { StudioSidebar, FieldDropdown, FieldDropdownOption } from './components/StudioSidebar';
import { EpisodeSection } from './components/EpisodeSection';
import { Cut, GeneratorSettings, Episode, LogEntry } from './types';
import { THEMES, THEME_CATEGORIES, TASTES, IMAGE_MODELS, RANDOM_SELECT_OPTION, SAFE_CHARACTERS } from './constants';
import { createLogMessage, initDB } from './services/utils';
import { downloadZip, savePackageFile } from './services/zipPackager';
import { useStudioProduction } from './services/useStudioProduction';
import { extractHighlights } from './services/directorService';
interface StudioHeaderProps {
  settings: GeneratorSettings;
  setSettings: React.Dispatch<React.SetStateAction<GeneratorSettings>>;
  isProducing: boolean;
  queuedSeriesCount?: number;
  onStart: () => void;
  onAbort: () => void;
  activeSeriesManifest?: any;
  onResumeClick?: () => void;
  isWaitingForStart?: boolean;
}
const StudioHeader: React.FC<StudioHeaderProps> = ({
  settings, setSettings, isProducing, queuedSeriesCount = 0, onStart, onAbort, activeSeriesManifest, onResumeClick, isWaitingForStart = false
}) => {
  const themeGroups = React.useMemo(() => {
    return [
      {
        label: 'ランダム抽選',
        items: [RANDOM_SELECT_OPTION]
      },
      ...THEME_CATEGORIES.map(c => ({ label: c.category, items: c.items }))
    ];
  }, []);
  const tasteOptions: FieldDropdownOption[] = React.useMemo(() => {
    return [
      {
        value: RANDOM_SELECT_OPTION,
        label: RANDOM_SELECT_OPTION,
        sublabel: '制作開始時に候補の中から自動でランダム抽選'
      },
      ...Object.keys(TASTES).map(k => ({
        value: k,
        label: k.split(' (')[0],
        sublabel: k.split(' (')[1]?.replace(')', '')
      }))
    ];
  }, []);
  return (
    <header className="bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-3 shrink-0 z-40 relative shadow-sm flex-wrap">
      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
        <div className="flex items-center gap-1.5 shrink-0 text-slate-800">
          <span className="material-symbols-outlined text-amber-500 text-xl">movie_edit</span>
          <h1 className="text-sm font-black italic tracking-tighter uppercase whitespace-nowrap">Studio Pro</h1>
        </div>
        <div className="flex items-center gap-1.5 p-1 bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-emerald-50/80 rounded-xl border border-emerald-300/80 shadow-2xs shrink-0 flex-wrap">
          <FieldDropdown 
            label="" 
            value={settings.theme} 
            groups={themeGroups}
            onChange={v => setSettings(s => ({ ...s, theme: v, era: v }))} 
            className="w-[195px]"
          />
          <div className="w-px h-5 bg-emerald-200/90 shrink-0" />
          <FieldDropdown 
            label="" 
            value={settings.taste} 
            options={tasteOptions} 
            onChange={v => setSettings(s => ({ ...s, taste: v }))} 
            className="w-[200px]"
          />
        </div>
        {/* トータル話数 ＆ トータルCut数の数値入力UI */}
        <div className="flex items-center gap-2 shrink-0 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 shadow-2xs">
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-slate-500">話数</span>
            <input 
              type="number" 
              min={1} 
              max={50}
              value={settings.episodeCount || 5}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1) {
                  setSettings(s => ({ ...s, episodeCount: Math.min(50, val) }));
                }
              }}
              className="w-12 h-6 px-1 text-center text-xs font-black text-indigo-700 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-[11px] font-bold text-slate-600">話</span>
          </div>
          <div className="w-px h-4 bg-slate-200 shrink-0" />
          <div className="flex items-center gap-1">
            <span className="text-[10px] font-bold text-slate-500">総Cut数</span>
            <input 
              type="number" 
              min={2} 
              max={100}
              value={settings.cutCount || 12}
              onChange={e => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 2) {
                  setSettings(s => ({ ...s, cutCount: Math.min(100, val) }));
                }
              }}
              className="w-12 h-6 px-1 text-center text-xs font-black text-indigo-700 bg-white border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <span className="text-[11px] font-bold text-slate-600">Cut</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {/* 制作中は赤の中止ボタンを表示 */}
        {isProducing && (
          <button 
            type="button"
            className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider shadow-md flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer transition-colors active:scale-95"
            onClick={() => onAbort()}
          >
            <span className="material-symbols-outlined text-[18px]">stop_circle</span>
            <span>中止</span>
          </button>
        )}
        {/* 作成開始 / 追加投入ボタン（制作中も常時クリック可能） */}
        <button 
          type="button"
          onClick={() => onStart()}
          className={`h-9 px-4 rounded-xl flex items-center gap-1.5 font-black text-xs uppercase tracking-wider transition-all select-none cursor-pointer shrink-0 whitespace-nowrap relative ${
            isProducing
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-md hover:shadow-lg active:scale-95'
              : isWaitingForStart
                ? 'ring-4 ring-pink-400 ring-offset-2 animate-pulse shadow-[0_0_25px_rgba(236,72,153,0.8)] brightness-110 !bg-gradient-to-r !from-indigo-600 !via-purple-600 !to-pink-600 text-white hover:brightness-125 hover:scale-105 active:scale-95'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg active:scale-95'
          }`}
        >
          <span className="material-symbols-outlined text-[18px]">
            {isProducing ? 'add_circle' : (isWaitingForStart ? 'play_arrow' : 'movie_edit')}
          </span>
          <span>
            {isProducing
              ? `追加投入${queuedSeriesCount ? ` (予約:${queuedSeriesCount})` : ''}`
              : '作成開始'}
          </span>
        </button>
        {activeSeriesManifest && !isProducing && (
          <button 
            type="button" 
            onClick={onResumeClick}
            className="h-9 px-2.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap cursor-pointer shadow-2xs"
            title="中断した連載制作を再開"
          >
            <span className="material-symbols-outlined text-[16px]">file_open</span>
            <span>再開</span>
          </button>
        )}
      </div>
    </header>
  );
};
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: Error | null }> {
  public state = { hasError: false, error: null };
  public static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  public componentDidCatch(error: Error, errorInfo: ErrorInfo) { console.error('Uncaught error:', error, errorInfo); }
  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-screen bg-slate-50 text-slate-900 select-none items-center justify-center p-8">
          <div className="bg-white p-8 rounded-2xl border border-red-200 max-w-[600px] w-full text-center">
            <span className="material-symbols-outlined text-red-500 text-6xl mb-4">error</span>
            <h1 className="text-2xl font-bold mb-4 text-red-500">予期せぬエラーが発生しました</h1>
            <p className="text-slate-600 mb-6 text-sm">再読み込みして再度お試しください。<br/>({String(this.state.error)})</p>
            <button onClick={() => window.location.reload()} className="px-6 py-2 bg-amber-500 hover:bg-amber-400 text-black font-bold rounded-full transition-all">再読み込み</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
export default function App() {
  const [settings, setSettings] = useState<GeneratorSettings>({
    productionMode: 'episodes', country: '日本', theme: RANDOM_SELECT_OPTION, taste: RANDOM_SELECT_OPTION, imageModel: IMAGE_MODELS[1]?.label || '🍌 Nano Banana 2.1', defaultVideoModel: '', videoRatio: 'none', episodeCount: 5, cutCount: 12, previewCutCount: 12, parallelCount: 2, autoVideo: false, autoDownload: true, superBackoff: true, isMvMode: false, aspectRatio: '1:1', characterId: 'random',
    enableTurnaroundSheet: true, autoApproveTurnaround: true, enableObjectCut: true, enableEndFrames: false
  });
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const formattedMessage = createLogMessage(message);
    setLogs(prev => {
      const next = [...prev.slice(-499), { 
        id: Math.random().toString(36).substr(2, 9), 
        message: formattedMessage, 
        type 
      }];
      if (typeof window !== 'undefined') {
        (window as any).__STUDIO_LOGS__ = next;
      }
      return next;
    });
  }, []);
  const resumeFileRef = useRef<HTMLInputElement>(null);
  const [previewingCutData, setPreviewingCutData] = useState<{ epId: number; cut: Cut } | null>(null);
  useEffect(() => {
    // 起動時の初期化
  }, []);
  const { 
    episodes, 
    setEpisodes, 
    isProducing, 
    queuedSeriesCount,
    startProduction, 
    abortProduction, 
    resumeSeries, 
    activeSeriesManifest, 
    handleGenerateRemaining, 
    handleRerollTasteProduction, 
    generateImage, 
    generateInfographicCover, 
    updateCut, 
    updateEpisode, 
    clearEpisodes 
  } = useStudioProduction({ 
    settings, 
    addLog, 
    logs
  });
  const episodesRef = useRef(episodes);
  episodesRef.current = episodes;
  const handleRerollTaste = useCallback((epId: number) => {
    const ep = episodes.find(e => e.id === epId);
    if (!ep) return;
    let targetTaste = settings.taste;
    if (!targetTaste || targetTaste === RANDOM_SELECT_OPTION) {
      const tasteKeys = Object.keys(TASTES);
      targetTaste = tasteKeys[Math.floor(Math.random() * tasteKeys.length)];
      setSettings(s => ({ ...s, taste: targetTaste }));
      addLog(`🎲 ランダム画風抽選: 【${targetTaste.split(' (')[0]}】に決定！`, 'success');
    }
    handleRerollTasteProduction(epId, targetTaste);
  }, [episodes, settings.taste, handleRerollTasteProduction, addLog]);
  useEffect(() => {
    if (!settings.taste || settings.taste === RANDOM_SELECT_OPTION) return;
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
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__STUDIO_EPISODES__ = episodes;
    }
  }, [episodes]);
  const handleDownloadZip = useCallback(async (ep: Episode) => {
    const filename = ep.packageZipFilename || `Episode_${ep.id}_Package.zip`;
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
        // Blob URLの取得失敗時はフォールバック
      }
    }
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
  const updateCutWrapped = useCallback((epId: number, cutId: number, updates: Partial<Cut>) => {
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
    initDB().catch(() => {});
    const styleId = 'studio-core-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `@import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@700;900&family=Outfit:wght@800;900&family=Montserrat:wght@800;900&family=Dela+Gothic+One&display=swap'); .no-wrap-row { display: flex; flex-direction: row; flex-wrap: nowrap; overflow-x: auto; scroll-behavior: smooth; } .dark-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; } .dark-scrollbar::-webkit-scrollbar-track { background: transparent; } .dark-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; } .dark-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; } @keyframes slideIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } } .animate-slide-in { animation: slideIn 0.3s ease-out forwards; } @keyframes dropdown-enter { from { opacity: 0; transform: scale(0.97) translateY(-4px); } to { opacity: 1; transform: scale(1) translateY(0); } } .animate-dropdown { animation: dropdown-enter 0.15s ease-out forwards; } .no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`;
      document.head.appendChild(style);
    }
  }, []);
  const hasPendingCuts = episodes.length > 0 && episodes.some(ep => {
    const targetCount = Math.min(settings.previewCutCount || 30, ep.cuts.length);
    const readyCount = ep.cuts.slice(0, targetCount).filter(c => !!(c.imageBase64 || c.imageMediaId)).length;
    return readyCount < targetCount;
  });
  const isWaitingForStart = !isProducing && hasPendingCuts;
  // 🎲 制作開始前のランダム解決ハンドラ（UIの「🎲 ランダム」選択状態は破壊せず、startProductionへ抽選結果のみを渡す）
  const handleStartProductionWithRandomCheck = useCallback(() => {
    let chosenTheme = settings.theme;
    let chosenTaste = settings.taste;
    let chosenChar = settings.characterId;
    const isThemeRandom = !chosenTheme || chosenTheme === RANDOM_SELECT_OPTION;
    const isTasteRandom = !chosenTaste || chosenTaste === RANDOM_SELECT_OPTION;
    const isCharRandom = !chosenChar || chosenChar === 'random';
    if (isThemeRandom) {
      chosenTheme = THEMES[Math.floor(Math.random() * THEMES.length)];
    }
    if (isTasteRandom) {
      const tasteKeys = Object.keys(TASTES);
      chosenTaste = tasteKeys[Math.floor(Math.random() * tasteKeys.length)];
    }
    if (isCharRandom) {
      const charIds = SAFE_CHARACTERS.map(c => c.id);
      chosenChar = charIds[Math.floor(Math.random() * charIds.length)];
      const foundChar = SAFE_CHARACTERS.find(c => c.id === chosenChar);
      addLog(`🎲 キャラクター自動選出: 【${foundChar?.icon || ''} ${foundChar?.nameJa || chosenChar}】で制作を開始します！`, 'success');
    }
    if (isThemeRandom || isTasteRandom) {
      const themeDisplay = chosenTheme.split('（')[0].trim();
      const tasteDisplay = chosenTaste.split(' (')[0].trim();
      addLog(`🎲 ランダム抽選: テーマ【${themeDisplay}】 / 画風【${tasteDisplay}】に決定！`, 'success');
    }
    startProduction({
      theme: chosenTheme,
      era: chosenTheme,
      taste: chosenTaste,
      characterId: chosenChar
    });
  }, [settings.theme, settings.taste, settings.characterId, addLog, startProduction]);
  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900 select-none overflow-hidden relative">
        <StudioHeader 
          settings={settings}
          setSettings={setSettings}
          isProducing={isProducing}
          queuedSeriesCount={queuedSeriesCount}
          onStart={handleStartProductionWithRandomCheck}
          onAbort={abortProduction}
          activeSeriesManifest={activeSeriesManifest}
          onResumeClick={() => resumeFileRef.current?.click()}
          isWaitingForStart={isWaitingForStart}
        />
        <div className="flex flex-1 overflow-hidden relative">
          <StudioSidebar 
            settings={settings} 
            setSettings={setSettings} 
            isProducing={isProducing} 
            onAbortProduction={abortProduction}
            episodes={episodes}
            onClearEpisodes={clearEpisodes}
            logs={logs}
          />
          
          {/* メインコンテンツ領域（横幅100%フル活用） */}
          <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark-scrollbar relative">
            <div className="w-full flex flex-col gap-5">
              {episodes.map((ep, idx) => (
                <EpisodeSection 
                  key={ep.internalId || `ep_${ep.id}_${idx}`} 
                  ep={ep} 
                  onGenerateRemaining={handleGenerateRemaining} 
                  onDownloadZip={handleDownloadZip} 
                  onPreviewCut={(eId, cut) => setPreviewingCutData({ epId: eId, cut })} 
                  onGenerateCover={generateInfographicCover} 
                  onRerollTaste={handleRerollTaste} 
                  onRetry={(eId, cId) => {
                    const epFound = episodes.find(e => e.id === eId);
                    const cutFound = epFound?.cuts.find(c => c.id === cId);
                    if (cutFound) {
                      const epTaste = epFound?.taste || cutFound.styleKeyUsed || settings.taste;
                      generateImage({ 
                        epId: eId, 
                        cutId: cId, 
                        prompt: cutFound.promptEn, 
                        negativePrompt: cutFound.negativePrompt, 
                        styleKey: epTaste, 
                        imageModel: settings.imageModel, 
                        isMvMode: epFound?.isMvMode,
                        eraAnalysis: epFound?.eraAnalysis, 
                        forbiddenAnachronisms: epFound?.forbiddenAnachronisms,
                        authenticAttireEn: epFound?.authenticAttireEn,
                        forbiddenKeywordsEn: epFound?.forbiddenKeywordsEn
                      }, true);
                    }
                  }} 
                />
              ))}
              {episodes.length === 0 && (
                <div className="h-[60vh] flex flex-col items-center justify-center opacity-20 gap-4">
                  <span className="material-symbols-outlined text-[120px]">movie_edit</span>
                  <p className="text-xl font-black uppercase tracking-widest italic">Studio Ready</p>
                </div>
              )}
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
                hasPrev={hasPrev}
                hasNext={hasNext}
                onPrev={handlePrev}
                onNext={handleNext}
                currentIndex={currentIndex >= 0 ? currentIndex + 1 : activeCut.id}
                totalCuts={cuts.length}
                onClose={() => setPreviewingCutData(null)} 
                onUpdateCut={updates => updateCutWrapped(previewingCutData.epId, activeCut.id, updates)} 
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
                    eraAnalysis: ep?.eraAnalysis, 
                    forbiddenAnachronisms: ep?.forbiddenAnachronisms,
                    authenticAttireEn: ep?.authenticAttireEn,
                    forbiddenKeywordsEn: ep?.forbiddenKeywordsEn
                  }, true);
                }}
              />
            );
          })()}
        </div>
        <input type="file" accept=".json" ref={resumeFileRef} style={{ display: 'none' }} onChange={handleResumeSeries} />
      </div>
    </ErrorBoundary>
  );
}

