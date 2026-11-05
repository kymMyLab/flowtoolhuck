import React, { useState, useEffect } from 'react';
import { Cut } from '../types';
import { PreviewPlayer } from './preview/PreviewPlayer';
import { CutEditorPanel } from './preview/CutEditorPanel';

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
  aspectRatio?: '9:16' | '1:1' | '16:9';
  onClose: () => void;
  onUpdateCut: (updates: Partial<Cut>) => void;
  onRegenerateImage: (modelLabel: string, customPrompt?: string, customNeg?: string) => void;
}

export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  isOpen,
  cut,
  episodeId,
  aspectRatio = '1:1',
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="absolute inset-0 bg-black/98 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-[1200px] h-[95vh] lg:h-[85vh] bg-[#0c0c0c] border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row animate-in fade-in zoom-in-95 duration-200">
        <PreviewPlayer
          cut={cut}
          aspectRatio={aspectRatio}
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
        <CutEditorPanel
          cut={cut}
          episodeId={episodeId}
          currentImageModel={currentImageModel}
          showTelop={showTelop}
          setShowTelop={setShowTelop}
          onClose={onClose}
          onUpdateCut={onUpdateCut}
          onRegenerateImage={onRegenerateImage}
          isRewriting={isRewriting}
          setIsRewriting={setIsRewriting}
        />
      </div>
    </div>
  );
};
