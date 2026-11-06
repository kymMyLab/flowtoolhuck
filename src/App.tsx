import React, { useState, useEffect, useCallback, useRef, Component, ErrorInfo, ReactNode } from 'react';
import { MediaPreviewModal } from './components/MediaPreviewModal';
import { StudioSidebar, FieldDropdown, FieldDropdownOption } from './components/StudioSidebar';
import { EpisodeSection } from './components/EpisodeSection';
import { Cut, GeneratorSettings, Episode, LogEntry } from './types';
import { THEMES, THEME_CATEGORIES, TASTES, IMAGE_MODELS } from './constants';
import { createLogMessage, initDB } from './services/utils';
import { downloadZip, savePackageFile } from './services/export/zipPackager';
import { useStudioProduction } from './services/useStudioProduction';
import { extractHighlights } from './services/directorService';

interface StudioHeaderProps {
  settings: GeneratorSettings;
  setSettings: React.Dispatch<React.SetStateAction<GeneratorSettings>>;
  isProducing: boolean;
  onStart: () => void;
  onAbort: () => void;
  activeSeriesManifest?: any;
  onResumeClick?: () => void;
  isWaitingForStart?: boolean;
}

const StudioHeader: React.FC<StudioHeaderProps> = ({
  settings, setSettings, isProducing, onStart, onAbort, activeSeriesManifest, onResumeClick, isWaitingForStart = false
}) => {
  const themeGroups = React.useMemo(() => {
    return THEME_CATEGORIES.map(c => ({ label: c.category, items: c.items }));
  }, []);

  const tasteOptions: FieldDropdownOption[] = React.useMemo(() => {
    return Object.keys(TASTES).map(k => ({
      value: k,
      label: k.split(' (')[0],
      sublabel: k.split(' (')[1]?.replace(')', '')
    }));
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2 shrink-0 z-40 relative shadow-sm flex-wrap">
      <div className="flex items-center gap-2 flex-wrap min-w-0">
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
            disabled={isProducing} 
            className="w-[200px]"
          />

          <div className="w-px h-5 bg-emerald-200/90 shrink-0" />

          <FieldDropdown 
            label="" 
            value={settings.taste} 
            options={tasteOptions} 
            onChange={v => setSettings(s => ({ ...s, taste: v }))} 
            disabled={isProducing} 
            className="w-[205px]"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {isProducing ? (
          <button 
            type="button"
            className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider animate-pulse shadow-md flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
            onClick={() => onAbort()}
          >
            <span className="material-symbols-outlined text-[18px]">stop_circle</span>
            <span>中止</span>
          </button>
        ) : (
          <button 
            type="button"
            disabled={isProducing}
            onClick={() => onStart()}
            className={`h-9 px-4 rounded-xl flex items-center gap-1.5 font-black text-xs uppercase tracking-wider transition-all select-none cursor-pointer shrink-0 whitespace-nowrap relative ${
              isWaitingForStart
                ? 'ring-4 ring-pink-400 ring-offset-2 animate-pulse shadow-[0_0_25px_rgba(236,72,153,0.8)] brightness-110 !bg-gradient-to-r !from-indigo-600 !via-purple-600 !to-pink-600 text-white hover:brightness-125 hover:scale-105 active:scale-95'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg active:scale-95'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isWaitingForStart ? 'play_arrow' : 'movie_edit'}
            </span>
            <span>作成開始</span>
          </button>
        )}

        {activeSeriesManifest && (
          <button 
            type="button" 
            disabled={isProducing}
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
    productionMode: 'episodes', country: '日本', theme: THEMES[0], taste: Object.keys(TASTES)[0], imageModel: IMAGE_MODELS[1].label, defaultVideoModel: '', videoRatio: 'none', episodeCount: 1, previewCutCount: 2, parallelCount: 2, autoVideo: false, autoDownload: true, superBackoff: true, isMvMode: false, aspectRatio: '1:1', characterId: 'zundamon',
    enableTurnaroundSheet: true, autoApproveTurnaround: true, enableObjectCut: true, enableEndFrames: false
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

  const resumeFileRef = useRef<HTMLInputElement>(null);
  const [previewingCutData, setPreviewingCutData] = useState<{ epId: number; cut: Cut } | null>(null);

  // マウント時にDevToolsコンソールへ準備完了バナーと制作構成を出力
  useEffect(() => {
    console.log(
      '%c🚀 [FlowTool Studio Pro] スタジオマウント完了！待機中 (Standby)',
      'background: linear-gradient(90deg, #2563eb, #7c3aed); color: #fff; font-weight: bold; font-size: 13px; padding: 4px 8px; border-radius: 4px;'
    );
    console.log(
      `🎬 制作プリセット: 【モード: ${settings.productionMode || '通常'}】 / 【テーマ: ${settings.theme}】 / 【画風: ${settings.taste}】 / 【全${settings.totalEpisodes || settings.episodeCount || 1}話】`
    );
    console.log('💡 ヘッダー右側の【作成開始】をクリックすると制作が始まります。進行ログはここにもリアルタイム出力されます。');
  }, []);

  const { episodes, setEpisodes, isProducing, startProduction, abortProduction, resumeSeries, activeSeriesManifest, handleGenerateRemaining, handleRerollTasteProduction, generateImage, generateInfographicCover, updateCut, updateEpisode } = useStudioProduction({ 
    settings, 
    addLog, 
    logs
  });

  const episodesRef = useRef(episodes);
  episodesRef.current = episodes;

  const handleRerollTaste = useCallback((epId: number) => {
    const ep = episodes.find(e => e.id === epId);
    if (!ep) return;
    const targetTaste = settings.taste;
    handleRerollTasteProduction(epId, targetTaste);
  }, [episodes, settings.taste, handleRerollTasteProduction]);

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
    initDB().catch(() => {});
    const styleId = 'studio-core-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `@import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@700;900&family=Outfit:wght@800;900&family=Montserrat:wght@800;900&family=Dela+Gothic+One&display=swap'); .no-wrap-row { display: flex; flex-direction: row; flex-wrap: nowrap; overflow-x: auto; scroll-behavior: smooth; } .dark-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; } .dark-scrollbar::-webkit-scrollbar-track { background: transparent; } .dark-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; } .dark-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; } @keyframes slideIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } } .animate-slide-in { animation: slideIn 0.3s ease-out forwards; } @keyframes dropdown-enter { from { opacity: 0; transform: scale(0.97) translateY(-4px); } to { opacity: 1; transform: scale(1) translateY(0); } } .animate-dropdown { animation: dropdown-enter 0.15s ease-out forwards; } .no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`;
      document.head.appendChild(style);
    }
  }, []);

  // 先行プレビュー枚数分（または各話のカット）の画像がまだ未生成であるかどうかを厳密に判定
  const hasPendingCuts = episodes.length > 0 && episodes.some(ep => {
    const targetCount = Math.min(settings.previewCutCount || 30, ep.cuts.length);
    const readyCount = ep.cuts.slice(0, targetCount).filter(c => !!(c.imageBase64 || c.imageMediaId)).length;
    return readyCount < targetCount;
  });
  // 待機中（光る状態）＝ 現在制作中ではなく、かつ未生成のカットが存在すること
  const isWaitingForStart = !isProducing && hasPendingCuts;


  return (
    <ErrorBoundary>
      <div className="flex flex-col h-screen w-screen bg-slate-50 text-slate-900 select-none overflow-hidden relative">
        
        <StudioHeader 
          settings={settings}
          setSettings={setSettings}
          isProducing={isProducing}
          onStart={startProduction}
          onAbort={abortProduction}
          activeSeriesManifest={activeSeriesManifest}
          onResumeClick={() => resumeFileRef.current?.click()}
          isWaitingForStart={isWaitingForStart}
        />
        <div className="flex flex-1 overflow-hidden relative">
          <StudioSidebar settings={settings} setSettings={setSettings} isProducing={isProducing} onAddLog={addLog} episodes={episodes} />
          
          <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-100 dark-scrollbar relative">
            <div className="max-w-[1300px] mx-auto flex flex-col gap-6">
              {episodes.map((ep, idx) => (
            <EpisodeSection 
              key={ep.internalId || `ep_${ep.id}_${idx}`} ep={ep} onGenerateRemaining={handleGenerateRemaining} onDownloadZip={handleDownloadZip} onPreviewCut={(eId, cut) => setPreviewingCutData({ epId: eId, cut })} onGenerateCover={generateInfographicCover} onRerollTaste={handleRerollTaste} onRetry={(eId, cId) => {
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
                  });
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
              });
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