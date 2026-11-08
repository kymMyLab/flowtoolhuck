import React, { useState, useEffect } from 'react';
import { Episode } from '../types';
import { renderCoverBase64, renderCoverBase64Horizontal, COVER_PALETTES, CoverPalette } from '../services/coverService';
import { Flow } from 'flow-sdk';
interface CoverPreviewModalProps {
  episode: Episode | null;
  onClose: () => void;
  onUpdateEpisodePalette?: (paletteId: string) => void;
}
export const CoverPreviewModal: React.FC<CoverPreviewModalProps> = ({
  episode,
  onClose,
  onUpdateEpisodePalette
}) => {
  const [orientation, setOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [renderedBase64, setRenderedBase64] = useState<string | null>(null);
  const [isRendering, setIsRendering] = useState<boolean>(false);
  const [selectedPaletteId, setSelectedPaletteId] = useState<string>(episode?.coverThemeVariant || 'cinema_indigo');
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'done' | 'error'>('idle');
  useEffect(() => {
    if (!episode) return;
    let isCancelled = false;
    const generateCover = async () => {
      setIsRendering(true);
      try {
        const epWithPalette = { ...episode, coverThemeVariant: selectedPaletteId };
        const b64 = orientation === 'vertical'
          ? await renderCoverBase64(epWithPalette)
          : await renderCoverBase64Horizontal(epWithPalette);
        if (!isCancelled) {
          setRenderedBase64(b64);
        }
      } catch (e) {
        console.error('Failed to render cover:', e);
      } finally {
        if (!isCancelled) {
          setIsRendering(false);
        }
      }
    };
    generateCover();
    return () => {
      isCancelled = true;
    };
  }, [episode, orientation, selectedPaletteId]);
  if (!episode) return null;
  const handlePaletteSelect = (palette: CoverPalette) => {
    setSelectedPaletteId(palette.id);
    if (onUpdateEpisodePalette) {
      onUpdateEpisodePalette(palette.id);
    }
  };
  const handleDownload = async () => {
    if (!renderedBase64) return;
    setDownloadState('downloading');
    try {
      const cleanBase64 = renderedBase64.includes(',') ? renderedBase64.split(',')[1] : renderedBase64;
      const filename = `cover_${episode.id}_${orientation}.jpg`;
      await Flow.download({
        base64: cleanBase64,
        mimeType: 'image/jpeg',
        filename,
      });
      setDownloadState('done');
      setTimeout(() => setDownloadState('idle'), 2000);
    } catch (err) {
      console.error('Cover download error:', err);
      setDownloadState('error');
      setTimeout(() => setDownloadState('idle'), 3000);
    }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* ヘッダー */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-400">art_track</span>
            <h2 className="text-sm font-semibold text-slate-100">
              インフォグラフィック看板 / 扉絵ジェネレーター
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        {/* コントロールバー */}
        <div className="p-3 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">アスペクト:</span>
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              <button
                onClick={() => setOrientation('vertical')}
                className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  orientation === 'vertical'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-sm">stay_current_portrait</span>
                9:16 (縦型Shorts)
              </button>
              <button
                onClick={() => setOrientation('horizontal')}
                className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  orientation === 'horizontal'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="material-symbols-outlined text-sm">stay_current_landscape</span>
                16:9 (横型シネマ)
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={!renderedBase64 || isRendering || downloadState !== 'idle'}
              className="px-3 py-1.5 rounded-md bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span className="material-symbols-outlined text-sm">
                {downloadState === 'downloading' ? 'hourglass_top' : downloadState === 'done' ? 'check' : 'download'}
              </span>
              {downloadState === 'downloading' ? 'ダウンロード中...' : downloadState === 'done' ? '完了 ✓' : '高解像度保存'}
            </button>
          </div>
        </div>
        {/* プレビュー本体 & パレットセレクター */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col md:flex-row gap-5 items-center justify-center bg-slate-950">
          <div className="flex-1 flex items-center justify-center min-h-[360px] w-full">
            {isRendering ? (
              <div className="flex flex-col items-center gap-2 text-indigo-400">
                <span className="material-symbols-outlined animate-spin text-3xl">progress_activity</span>
                <span className="text-xs font-mono">看板ポスターをレンダリング中...</span>
              </div>
            ) : renderedBase64 ? (
              <div className="relative group max-h-[60vh] flex items-center justify-center">
                <img
                  src={renderedBase64}
                  alt="Rendered Cover"
                  className={`rounded-xl shadow-2xl border border-slate-800 object-contain max-h-[60vh] ${
                    orientation === 'vertical' ? 'aspect-[9/16]' : 'aspect-video'
                  }`}
                />
              </div>
            ) : (
              <div className="text-slate-600 text-xs">プレビューの準備ができていません</div>
            )}
          </div>
          {/* 右サイド：パレット切り替え */}
          <div className="w-full md:w-64 flex flex-col gap-2 shrink-0 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-4">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              看板カラーパレット
            </label>
            <div className="space-y-1.5 max-h-[50vh] overflow-y-auto pr-1">
              {Object.values(COVER_PALETTES).map((pal) => {
                const isSelected = selectedPaletteId === pal.id;
                return (
                  <button
                    key={pal.id}
                    onClick={() => handlePaletteSelect(pal)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-all border text-xs ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500 text-white shadow-sm'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div
                      className="w-4 h-4 rounded-full border border-white/20 shrink-0"
                      style={{ background: pal.vPanelEnd }}
                    />
                    <div className="flex-1 truncate">
                      <div className="font-medium truncate">{pal.name}</div>
                      <div className="text-[10px] text-slate-500 capitalize">{pal.genre}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

