import React, { useState, useEffect } from 'react';
import { Cut, VideoModelType } from '../types';
import { resolveRecommendedTelopStaging } from '../constants';
import { extractHighlights } from '../services/directorService';
import { PreviewPlayer } from './preview/PreviewPlayer';
import { CutEditorPanel } from './preview/CutEditorPanel';

export interface MediaPreviewModalProps {
  isOpen: boolean;
  cut: Cut;
  episodeId: number;
  currentImageModel?: string;
  isMvMode?: boolean;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCuts?: number;
  onClose: () => void;
  onAnimate: (m: VideoModelType) => void;
  onBrowserAnimate: () => void;
  onUpdateCut: (updates: Partial<Cut>) => void;
  onBulkRerollTelop?: (epId: number) => void;
  onRegenerateImage: (modelLabel: string, customPrompt?: string, customNeg?: string) => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  isOpen,
  cut,
  episodeId,
  currentImageModel,
  isMvMode,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  currentIndex,
  totalCuts,
  onClose,
  onAnimate,
  onBrowserAnimate,
  onUpdateCut,
  onBulkRerollTelop,
  onRegenerateImage
}) => {
  const [showTelop, setShowTelop] = useState(true);
  const [isRewriting, setIsRewriting] = useState(false);

  // キーボードショートカット (Escで閉じる、左右キーでカット移動)
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && onPrev) {
        onPrev();
      } else if (e.key === 'ArrowRight' && onNext) {
        onNext();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, onPrev, onNext]);

  // モーダル表示時、もし登録されたハイライトが本文に1つも合致していなければ自動修復
  useEffect(() => {
    if (!isOpen) return;
    const text = cut.telop?.fullText || cut.narrationJp || '';
    const highlights = cut.telop?.highlights || [];
    if (text) {
      const hasAnyMatch = highlights.some(h => h.word && text.includes(h.word));
      if (!hasAnyMatch) {
        const auto = extractHighlights(text);
        if (auto.length > 0) {
          const staging = resolveRecommendedTelopStaging(cut.id, isMvMode, false);
          onUpdateCut({
            telop: {
              fullText: text,
              highlights: auto,
              style: cut.telop?.style || staging.style,
              transition: cut.telop?.transition || staging.transition,
              position: cut.telop?.position || staging.position,
              directorNote: cut.telop?.directorNote || staging.directorNote
            }
          });
        }
      }
    }
  }, [isOpen, cut.id]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 select-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/98 backdrop-blur-xl" onClick={onClose} />

      {/* Modal Container */}
      <div className="relative w-full max-w-[1200px] h-[95vh] lg:h-[85vh] bg-[#0c0c0c] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row animate-in fade-in zoom-in-95 duration-200">
        {/* Left: Preview Player */}
        <PreviewPlayer
          cut={cut}
          hasPrev={hasPrev}
          hasNext={hasNext}
          onPrev={onPrev}
          onNext={onNext}
          currentIndex={currentIndex}
          totalCuts={totalCuts}
          showTelop={showTelop}
          onToggleTelop={() => setShowTelop(!showTelop)}
          isRewriting={isRewriting}
        />

        {/* Right: Cut Editor Panel */}
        <CutEditorPanel
          cut={cut}
          episodeId={episodeId}
          currentImageModel={currentImageModel}
          isMvMode={isMvMode}
          showTelop={showTelop}
          setShowTelop={setShowTelop}
          onClose={onClose}
          onUpdateCut={onUpdateCut}
          onBulkRerollTelop={onBulkRerollTelop}
          onRegenerateImage={onRegenerateImage}
          onAnimate={onAnimate}
          onBrowserAnimate={onBrowserAnimate}
          isRewriting={isRewriting}
          setIsRewriting={setIsRewriting}
        />
      </div>
    </div>
  );
};