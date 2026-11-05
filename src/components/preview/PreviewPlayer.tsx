import React from 'react';
import { Cut } from '../../types';
import { formatDataUri } from '../../services/utils';

export interface PreviewPlayerProps {
  cut: Cut;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCuts?: number;
  showTelop: boolean;
  onToggleTelop: () => void;
  isRewriting?: boolean;
}

export const PreviewPlayer: React.FC<PreviewPlayerProps> = ({
  cut,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  currentIndex,
  totalCuts,
  showTelop,
  onToggleTelop,
  isRewriting = false
}) => {
  const startImageSrc = cut.imageBase64 ? formatDataUri(cut.imageBase64) : null;
  const rawText = (cut.telop?.fullText || cut.narrationJp || '').trim();

  return (
    <div className="flex-1 bg-black relative flex items-center justify-center p-3 sm:p-6 lg:p-10 min-h-0 overflow-hidden">
      <div className="relative h-full w-full flex items-center justify-center">
        {/* 前のカットへ移動 */}
        {hasPrev && onPrev && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onPrev(); }}
            className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-50 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/75 hover:bg-amber-500 hover:text-black border border-white/20 hover:border-amber-400 text-white backdrop-blur-md flex items-center justify-center transition-all shadow-2xl cursor-pointer hover:scale-110 active:scale-95 group"
            title="前のカットへ移動 (←)"
          >
            <span className="material-symbols-outlined text-[26px] sm:text-[30px] group-hover:-translate-x-0.5 transition-transform">chevron_left</span>
          </button>
        )}

        {/* 次のカットへ移動 */}
        {hasNext && onNext && (
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onNext(); }}
            className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-50 w-11 h-11 sm:w-13 sm:h-13 rounded-full bg-black/75 hover:bg-amber-500 hover:text-black border border-white/20 hover:border-amber-400 text-white backdrop-blur-md flex items-center justify-center transition-all shadow-2xl cursor-pointer hover:scale-110 active:scale-95 group"
            title="次のカットへ移動 (→)"
          >
            <span className="material-symbols-outlined text-[26px] sm:text-[30px] group-hover:translate-x-0.5 transition-transform">chevron_right</span>
          </button>
        )}

        {/* カット番号インジケーター */}
        {currentIndex !== undefined && totalCuts !== undefined && (
          <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-50 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-white/90 text-[11px] font-bold flex items-center gap-1.5 shadow-xl select-none">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            <span>Cut {currentIndex} / {totalCuts}</span>
          </div>
        )}

        <div className="relative h-full max-h-full aspect-square shadow-2xl rounded-2xl overflow-hidden border border-white/10 group bg-[#111] flex items-center justify-center">
          {startImageSrc ? (
            <div className="w-full h-full overflow-hidden flex items-center justify-center">
              <img src={startImageSrc} className="w-full h-full object-contain block" alt={`Cut ${cut.id}`} />
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-3 uppercase tracking-widest text-[11px] font-bold">
              Rendering Image...
            </div>
          )}

          {showTelop && rawText && (
            <div className="absolute bottom-[5%] left-0 w-full px-4 flex flex-col items-center pointer-events-none z-40">
              <div className="bg-black/75 backdrop-blur-md rounded-2xl px-5 py-2.5 max-w-[92%] shadow-xl border border-white/15 text-center">
                <span className="text-white font-black text-base sm:text-lg leading-snug tracking-wide drop-shadow">
                  {rawText}
                </span>
              </div>
            </div>
          )}

          <div className="absolute top-4 right-4 z-40 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={onToggleTelop}
              className={`w-10 h-10 rounded-full backdrop-blur-md border flex items-center justify-center transition-all cursor-pointer ${showTelop ? 'bg-amber-500 border-amber-400 text-black' : 'bg-black/60 border-white/20 text-white/40'}`}
              title="字幕表示切替"
            >
              <span className="material-symbols-outlined text-[20px]">{showTelop ? 'subtitles' : 'subtitles_off'}</span>
            </button>
          </div>

          {(isRewriting || cut.isGeneratingImage) && (
            <div className="absolute inset-0 bg-black/75 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-50 animate-in fade-in duration-200">
              <div className="w-12 h-12 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
              <span className="text-xs font-black text-amber-400 tracking-widest uppercase animate-pulse">
                {isRewriting ? '✨ 指示を反映中...' : '🎨 描画中...'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
