import React from 'react';
import { Cut } from '../types';
import { formatDataUri } from '../services/utils';

interface CutCardProps {
  cut: Cut;
  episodeId: number;
  isMvMode?: boolean;
  aspectRatio?: '9:16' | '1:1' | '16:9';
  onPreviewCut: (epId: number, cutId: number) => void;
  onRetry?: (epId: number, cutId: number) => void;
}

export const CutCard: React.FC<CutCardProps> = React.memo(({ 
  cut, episodeId, isMvMode, aspectRatio = '1:1', onPreviewCut, onRetry 
}) => {
  const imageSrc = formatDataUri(cut.imageBase64 || (cut as any)?.image);

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRetry) onRetry(episodeId, cut.id);
  };

  const isSquare = aspectRatio === '1:1';
  const isLandscape = aspectRatio === '16:9';
  const cardWidthClass = isSquare ? 'w-[155px]' : (isLandscape ? 'w-[185px]' : 'w-[140px]');
  const aspectClass = isSquare ? 'aspect-square' : (isLandscape ? 'aspect-video' : 'aspect-[9/16]');

  return (
    <div 
      onClick={() => onPreviewCut(episodeId, cut.id)}
      className="flex-shrink-0 bg-white border border-[#333] hover:border-[#969696] rounded-xl overflow-hidden flex flex-col group transition-all relative shadow-lg cursor-pointer"
      style={{ width: isSquare ? 155 : isLandscape ? 185 : 140 }}
    >
      <div className={`relative ${aspectClass} bg-slate-200 flex items-center justify-center overflow-hidden`}>
        {imageSrc ? (
          <div className="w-full h-full overflow-hidden">
            <img 
              src={imageSrc} 
              alt={`Cut ${cut.id}`} 
              loading="eager"
              className="w-full h-full object-cover transition-opacity duration-300" 
              style={{ opacity: 1 }}
            />
          </div>
        ) : (cut.isGeneratingImage || cut.isDirecting) ? (
          <div className="flex flex-col items-center gap-1">
            <div className={`w-5 h-5 border border-t-white rounded-full animate-spin ${cut.isDirecting ? 'border-amber-500/20 border-t-amber-500' : 'border-slate-200'}`} />
            <span className="text-[8px] text-slate-500 tracking-widest uppercase animate-pulse">
              {cut.isDirecting ? 'Directing' : 'Drawing'}
            </span>
          </div>
        ) : cut.error ? (
          <div className="flex flex-col items-center gap-0.5 px-2 text-center max-w-full z-20">
            <span className="material-symbols-outlined text-red-500 text-[18px]">error</span>
            <span className="text-[8px] text-red-400 font-bold uppercase tracking-wider">Failed</span>
            <span className="text-[7px] text-red-300/90 line-clamp-2 max-w-[92%] leading-tight break-all font-mono" title={cut.error}>
              {cut.error}
            </span>
            {onRetry && (
              <button onClick={handleRetry} className="mt-1 bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 rounded px-2 py-0.5 text-[8px] font-bold transition-all cursor-pointer">Retry</button>
            )}
          </div>
        ) : (
          <span className="text-slate-900/10 text-[8px] tracking-widest uppercase">Standby</span>
        )}

        {/* 演出バッジ (Shot Scale & Object & Focal & Panel) */}
        <div className="absolute bottom-1.5 left-1.5 flex flex-wrap items-center gap-1 z-10 max-w-[95%] overflow-hidden">
          {cut.shotScale && (
            <div className="px-1.5 py-0.5 rounded-sm bg-amber-500 text-[7px] font-black text-black uppercase tracking-tighter shadow-lg shrink-0">
              {cut.shotScale}
            </div>
          )}
          {cut.isObjectOnly && (
            <div className="px-1.5 py-0.5 rounded-sm bg-emerald-600 text-[7px] font-black text-slate-900 uppercase tracking-tighter shadow-lg shrink-0" title="人物なし・物体/情景カット">
              📦 OBJ
            </div>
          )}
          {cut.focalPoint && (
            <div className="px-1.5 py-0.5 rounded-sm bg-cyan-800/80 border border-cyan-400/30 text-[7px] font-black text-cyan-200 uppercase tracking-tighter shadow-lg shrink-0">
              🎯 {cut.focalPoint.grid.replace('top-', 'T-').replace('bottom-', 'B-').replace('center', 'CTR').toUpperCase()}
            </div>
          )}
          {cut.panelLayout && cut.panelLayout !== 'single' && (
            <div className="px-1.5 py-0.5 rounded-sm bg-indigo-600/90 border border-indigo-400/30 text-[7px] font-black text-indigo-100 uppercase tracking-tighter shadow-lg shrink-0 flex items-center gap-0.5">
              <span>
                {cut.panelLayout === 'diagonal-slash' ? '⚔️ 斜め' :
                 cut.panelLayout === 'l-shaped' ? '📐 L字3コマ' :
                 cut.panelLayout === 'panoramic-split' ? '🌄 パノ+2' :
                 cut.panelLayout === 'inset-reaction' ? '🔍 枠入' :
                 cut.panelLayout === 'vertical-split' ? '▥ 縦2割' :
                 cut.panelLayout === 'split-2' ? '◫ 2分割' :
                 cut.panelLayout === 'split-3' ? '☰ 変形3' : '▦ コマ割'}
              </span>
            </div>
          )}
        </div>

        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10">
          <div className="px-1.5 py-0.5 rounded-sm bg-white/90 text-[8px] font-black text-slate-800 backdrop-blur-md border border-slate-200 flex items-center">
            C{cut.id.toString().padStart(2, '0')}
          </div>
        </div>
      </div>

      <div className="p-2 flex flex-col gap-1.5 bg-gradient-to-b from-[#1a1a1a] to-[#141414]">
        {isMvMode ? (
          <div className="flex items-center gap-1.5 h-[28px] overflow-hidden">
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/25 text-purple-300 font-black border border-purple-500/40 shrink-0 uppercase tracking-tighter">
              LYRIC
            </span>
            <p className="text-[10px] text-slate-900 font-bold line-clamp-2 leading-snug tracking-tight">
              {cut.narrationJp || "歌詞策定中..."}
            </p>
          </div>
        ) : (
          <p className="text-[10px] text-slate-700 font-medium line-clamp-2 leading-snug h-[28px]">
            {cut.narrationJp || "脚本策定中..."}
          </p>
        )}
      </div>
    </div>
  );
});
