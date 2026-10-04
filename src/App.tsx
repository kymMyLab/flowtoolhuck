import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ConfirmationModal } from './components/Primitives';
import { MediaPreviewModal } from './components/MediaPreviewModal';
import { ArchiveDrawer } from './components/ArchiveDrawer';
import { StudioSidebar } from './components/StudioSidebar';
import { EpisodeSection } from './components/EpisodeSection';
import { LogEntry } from './components/StudioLogs';
import { Cut, GeneratorSettings, VideoModelType, Episode } from './types';
import { THEMES, TASTES, IMAGE_MODELS, VIDEO_MODELS } from './constants';
import { createLogMessage } from './services/utils';
import { initDB, getAllStories, StoryRecord } from './services/db';
import { downloadZip, triggerBrowserDownload, savePackageFile } from './services/exportService';
import { useStudioProduction } from './services/useStudioProduction';
import { extractHighlights } from './services/directorService';

export default function App() {
  const [settings, setSettings] = useState<GeneratorSettings>({
    productionMode: 'episodes', country: '日本', theme: THEMES[0], taste: Object.keys(TASTES)[0], imageModel: IMAGE_MODELS[1].label, defaultVideoModel: VIDEO_MODELS[0].label, videoRatio: '30%', episodeCount: 1, previewCutCount: 3, parallelCount: 2, autoVideo: false, autoDownload: false, superBackoff: false, isMvMode: false, isMultiPanel: false
  });

  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [stories, setStories] = useState<StoryRecord[]>([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false);
  const [previewingCutData, setPreviewingCutData] = useState<{ epId: number; cut: Cut } | null>(null);

  // ログ保持数を9999に拡大（1万行制限）
  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev.slice(-9999), { id: Math.random().toString(36).substr(2, 9), message: createLogMessage(message), type }]);
  }, []);

  const refreshStories = useCallback(async () => {
    const all = await getAllStories();
    setStories(all);
  }, []);

  const { episodes, isProducing, startProduction, abortProduction, resumeSeries, activeSeriesManifest, handleGenerateRemaining, handleBulkVideo, handleBulkBrowserVideo, handleExportFullMovie, handleBulkRerollTelop, generateImage, generateVideo, generateBrowserVideo, updateCut, updateEpisode, clearEpisodes } = useStudioProduction({ 
    settings, 
    addLog, 
    refreshStories
  });

  const episodesRef = useRef(episodes);
  episodesRef.current = episodes;

  const handleDownloadZip = useCallback(async (ep: Episode) => {
    const filename = ep.packageZipFilename || `Episode_${ep.id}_Package.zip`;
    console.log(`[FlowTool] 手動ダウンロードボタン押下: Ep.${ep.id} (${filename})`);

    // 1. すでに ZIP が生成済みの場合は、即座に savePackageFile をキック！（詳細コンソールログ出力）
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

  const handleResumeSeries = useCallback(async (manifest: any) => {
    if (manifest.settings) {
      setSettings(prev => ({ ...prev, ...manifest.settings }));
    }
    await resumeSeries(manifest, (assetId: number) => {
      setSettings(prev => ({ ...prev, selectedAssetId: assetId }));
    });
  }, [resumeSeries]);

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
      style.textContent = `@import url('https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@700;900&family=Outfit:wght@800;900&family=Montserrat:wght@800;900&family=Dela+Gothic+One&display=swap'); .no-wrap-row { display: flex; flex-direction: row; flex-wrap: nowrap; overflow-x: auto; scroll-behavior: smooth; } .dark-scrollbar::-webkit-scrollbar { height: 6px; width: 6px; } .dark-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; } @keyframes slideIn { from { transform: translateY(10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } } .animate-slide-in { animation: slideIn 0.3s ease-out forwards; } @keyframes dropdown-enter { from { opacity: 0; transform: scale(0.95) translateY(-5px); } to { opacity: 1; transform: scale(1) translateY(0); } } .animate-dropdown { animation: dropdown-enter 0.15s ease-out forwards; } .no-scrollbar::-webkit-scrollbar { display: none; } .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }`;
      document.head.appendChild(style);
    }
  }, [refreshStories]);

  return (
    <div className="flex h-screen w-screen bg-[#0e0e0e] text-white select-none">
      <StudioSidebar settings={settings} setSettings={setSettings} isProducing={isProducing} onStart={startProduction} onAbort={abortProduction} onClear={() => setIsTrashModalOpen(true)} onOpenArchive={() => setArchiveOpen(true)} onResumeSeries={handleResumeSeries} activeSeriesManifest={activeSeriesManifest} logs={logs} onAddLog={addLog} />
      <div className="flex-1 overflow-y-auto p-8 bg-[#080808] dark-scrollbar">
        <div className="max-w-[1300px] mx-auto flex flex-col gap-16">
          {episodes.map(ep => (
            <EpisodeSection 
              key={ep.id} ep={ep} onGenerateRemaining={handleGenerateRemaining} onBulkVideo={handleBulkVideo} onBulkBrowserVideo={handleBulkBrowserVideo} onExportFullMovie={handleExportFullMovie} onDownloadZip={handleDownloadZip} onAnimateRequest={generateVideo} onPreviewCut={(eId, cut) => setPreviewingCutData({ epId: eId, cut })} onUpdateCut={updateCutWrapped} onBulkRerollTelop={handleBulkRerollTelop} onRetry={(type, eId, cId) => {
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
                  generateVideo(eId, cId, (cutFound.targetVideoModel === 'none' ? 'veo-lite' : cutFound.targetVideoModel) as VideoModelType);
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
          />
        );
      })()}
      <ArchiveDrawer isOpen={archiveOpen} onClose={() => setArchiveOpen(false)} stories={stories} onRemake={(s) => { setSettings(prev => ({ ...prev, country: s.country, era: s.era, theme: s.theme })); setArchiveOpen(false); }} />
      <ConfirmationModal isOpen={isTrashModalOpen} title="全消去" message="制作中のデータを消去します。" onConfirm={() => { clearEpisodes(); setIsTrashModalOpen(false); }} onCancel={() => setIsTrashModalOpen(false)} />
    </div>
  );
}