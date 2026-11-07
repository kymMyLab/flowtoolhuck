import React, { useState, useEffect } from 'react';
import { Cut } from '../types';
import { formatDataUri, callWithRetry } from '../services/utils';
import { resolveImageModel } from '../constants';
import { TextInput, SectionLabel, PillButton } from './StudioSidebar';

export interface MediaPreviewModalProps {
  isOpen: boolean;
  cut: Cut;
  episodeId: number;
  currentImageModel?: string;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCuts?: number;
  onClose: () => void;
  onUpdateCut: (updates: Partial<Cut>) => void;
  onRegenerateImage: (modelLabel: string, customPrompt?: string, customNeg?: string) => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  isOpen,
  cut,
  currentImageModel,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  currentIndex,
  totalCuts,
  onClose,
  onUpdateCut,
  onRegenerateImage
}) => {
  const [showTelop, setShowTelop] = useState(true);
  const [isRewriting, setIsRewriting] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [aiWish, setAiWish] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && onPrev) onPrev();
      else if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, onPrev, onNext]);

  if (!isOpen) return null;

  const startImageSrc = cut.imageBase64 ? formatDataUri(cut.imageBase64) : null;
  const rawText = (cut.telop?.fullText || cut.narrationJp || '').trim();

  const handleAiWishRequest = async () => {
    if (!aiWish.trim() || isRewriting || cut.isGeneratingImage) return;
    setIsRewriting(true);
    try {
      const rewritePrompt = `Rewrite the image generation prompt based on: "${aiWish}". Original: ${cut.promptEn}. Output ONLY English prompt.`;
      const { text } = await callWithRetry<any>(
        () => Flow.generate.text(rewritePrompt, { systemInstruction: "Expert cinematic prompt engineer." }),
        undefined, 4
      );
      const refinedPrompt = (text || '').trim();
      if (refinedPrompt) {
        onUpdateCut({ promptEn: refinedPrompt });
        setAiWish('');
        onRegenerateImage(resolveImageModel(currentImageModel).label, refinedPrompt, cut.negativePrompt);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRewriting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="absolute inset-0 bg-black/98 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-[1200px] h-[95vh] lg:h-[85vh] bg-[#0c0c0c] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row animate-in fade-in zoom-in-95 duration-200">
        
        {/* ── 左側: プレイヤー表示 ── */}
        <div className="flex-1 bg-black relative flex items-center justify-center p-3 sm:p-6 lg:p-10 min-h-0 overflow-hidden">
          <div className="relative h-full w-full flex items-center justify-center">
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

            {currentIndex !== undefined && totalCuts !== undefined && (
              <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-50 px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/15 text-white/90 text-[11px] font-bold flex items-center gap-1.5 shadow-xl select-none">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                <span>Cut {currentIndex} / {totalCuts}</span>
              </div>
            )}

            <div className="relative h-full max-h-full aspect-square shadow-2xl rounded-2xl overflow-hidden border border-white/10 group bg-[#111] flex items-center justify-center">
              {startImageSrc ? (
                <div 
                  className={`w-full h-full overflow-hidden flex items-center justify-center cursor-zoom-in transition-all ${isZoomed ? 'cursor-zoom-out' : ''}`}
                  onClick={() => setIsZoomed(!isZoomed)}
                  title={isZoomed ? "クリックで縮小" : "クリックで原寸/拡大表示"}
                >
                  <img 
                    src={startImageSrc} 
                    className={`transition-transform duration-300 select-none ${
                      isZoomed ? 'scale-[1.8] cursor-zoom-out' : 'w-full h-full object-contain block'
                    }`} 
                    alt={`Cut ${cut.id}`} 
                  />
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
                  onClick={() => setShowTelop(!showTelop)}
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

        {/* ── 右側: エディターパネル ── */}
        <div className="w-full lg:w-[420px] h-[400px] lg:h-full bg-[#121212] border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col shadow-2xl shrink-0">
          <div className="p-4 lg:p-6 border-b border-white/5 flex items-center justify-between bg-[#151515]">
            <h3 className="text-lg lg:text-xl font-black italic tracking-tighter uppercase text-white">Cut Editor Pro</h3>
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors cursor-pointer">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 lg:p-6 flex flex-col gap-5 dark-scrollbar min-h-0 pb-14">
            {/* 構図・演出メタデータバッジ群 */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {cut.shotScale && (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                  {cut.shotScale}
                </span>
              )}
              {cut.cinematicAngle && (
                <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 text-[10px] font-bold border border-blue-500/30">
                  {cut.cinematicAngle}
                </span>
              )}
              {cut.focalPoint && (
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                  注視: {cut.focalPoint.focalSubject || cut.focalPoint.grid}
                </span>
              )}
              {cut.isObjectOnly && (
                <span className="px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold border border-purple-500/30">
                  OBJ専有
                </span>
              )}
            </div>

            <div className="flex flex-col gap-4">
              <TextInput label="ナレーション / セリフ (JP)" value={cut.narrationJp || ''} onChange={v => onUpdateCut({ narrationJp: v })} />
              <label className="flex items-center justify-between px-2 py-1.5 rounded-lg bg-white/5 border border-white/10 cursor-pointer select-none">
                <span className="text-xs font-medium text-white/80">プレビュー上に字幕を表示する</span>
                <input type="checkbox" checked={showTelop} onChange={e => setShowTelop(e.target.checked)} className="w-4 h-4 accent-amber-500 cursor-pointer" />
              </label>

              {/* ✨ AIへのおねがい */}
              <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
                <SectionLabel>✨ AIへのおねがい（プロンプト自動書き換え＆再描画）</SectionLabel>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={aiWish}
                    onChange={e => setAiWish(e.target.value)}
                    placeholder="例: 表情をもっと険しく..."
                    className="flex-1 bg-black/60 border border-white/15 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-amber-500/80 text-white placeholder:text-white/30"
                    onKeyDown={e => e.key === 'Enter' && handleAiWishRequest()}
                  />
                  <PillButton
                    variant="filled"
                    className="bg-amber-500 hover:bg-amber-400 text-black font-black h-8 px-4 text-xs"
                    onClick={handleAiWishRequest}
                    disabled={isRewriting || cut.isGeneratingImage || !aiWish.trim()}
                  >
                    反映
                  </PillButton>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white/70">画像プロンプト (EN)</span>
                  {cut.promptEn && (
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(cut.promptEn)}
                      className="text-[10px] text-amber-400 hover:text-amber-300 flex items-center gap-1 cursor-pointer transition-colors"
                      title="プロンプトをコピー"
                    >
                      <span className="material-symbols-outlined text-xs">content_copy</span>
                      <span>コピー</span>
                    </button>
                  )}
                </div>
                <textarea
                  value={cut.promptEn || ''}
                  onChange={e => onUpdateCut({ promptEn: e.target.value })}
                  rows={4}
                  className="w-full bg-black/50 border border-white/10 rounded-xl p-3 text-xs font-mono text-white/90 outline-none focus:border-amber-500/80 leading-relaxed resize-none"
                />
              </div>
            </div>
          </div>

          <div className="p-4 lg:p-6 bg-[#161616] border-t border-white/10 shrink-0 z-10">
            <PillButton 
              variant="solid" 
              className="w-full h-11 bg-white text-black font-black" 
              disabled={cut.isGeneratingImage || isRewriting} 
              onClick={() => onRegenerateImage(resolveImageModel(currentImageModel).label, cut.promptEn, cut.negativePrompt)} 
              icon={<span className="material-symbols-outlined">image</span>}
            >
              {cut.isGeneratingImage ? '描画中...' : '画像を再描画'}
            </PillButton>
          </div>
        </div>

      </div>
    </div>
  );
};
