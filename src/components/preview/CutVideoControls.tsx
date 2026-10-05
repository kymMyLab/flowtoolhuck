import React, { useState } from 'react';
import { Cut, VideoModelType } from '../../types';
import { VIDEO_MODELS_REGISTRY, sanitizeFilename } from '../../constants';
import { SectionLabel, PillButton } from '../Primitives';
import { Flow } from 'flow-sdk';

interface CutVideoControlsProps {
  cut: Cut;
  episodeId: number;
  onAnimate: (m: VideoModelType) => void;
  onBrowserAnimate: () => void;
}

export const CutVideoControls: React.FC<CutVideoControlsProps> = ({
  cut,
  episodeId,
  onAnimate,
  onBrowserAnimate
}) => {
  const [downloadState, setDownloadState] = useState<'idle' | 'saving' | 'done'>('idle');

  const videoSrc = cut.videoBase64
    ? (cut.videoBase64.startsWith('data:') ? cut.videoBase64 : `data:video/mp4;base64,${cut.videoBase64}`)
    : null;

  const handleDownloadVideo = async () => {
    if (!cut.videoBase64) return;
    setDownloadState('saving');
    try {
      const b64Data = cut.videoBase64.startsWith('data:') ? cut.videoBase64.split(',')[1] : cut.videoBase64;
      const rawTitle = cut.scenePlot?.split('\n')[0] || `Cut${cut.id}`;
      const safeName = sanitizeFilename(rawTitle).slice(0, 30);
      const filename = `Ep${episodeId}_C${cut.id.toString().padStart(2, '0')}_${safeName}.mp4`;
      
      await Flow.download({ base64: b64Data, mimeType: 'video/mp4', filename });
      setDownloadState('done');
      setTimeout(() => setDownloadState('idle'), 3000);
    } catch (err) {
      console.error('Download failed', err);
      setDownloadState('idle');
    }
  };

  return (
    <div className="pt-6 border-t border-white/5 flex flex-col gap-4">
      <SectionLabel>動画生成</SectionLabel>
      <PillButton
        variant="filled"
        className="bg-amber-600 hover:bg-amber-500 text-white font-black h-[42px]"
        onClick={onBrowserAnimate}
        disabled={cut.isGeneratingVideo || !cut.imageBase64}
      >
        ⚡ ブラウザで即座に動画化 (0pt)
      </PillButton>
      
      <div className="grid grid-cols-2 gap-2">
        {VIDEO_MODELS_REGISTRY.slice(0, 2).map(m => {
          const isSelected = cut.targetVideoModel === m.id;
          const colorClass = m.id === 'omni-flash' ? 'bg-purple-600' : 'bg-blue-600';
          return (
            <PillButton 
              key={m.id}
              variant="filled" 
              className={`${colorClass} text-white font-black h-[40px] text-[10px] ${isSelected ? 'ring-2 ring-amber-400' : ''}`} 
              onClick={() => onAnimate(m.id)} 
              disabled={cut.isGeneratingVideo || (!cut.imageMediaId && !cut.imageBase64)}
            >
              🎬 {m.name} ({m.defaultDuration}s)
            </PillButton>
          );
        })}
      </div>
      {videoSrc && (
        <PillButton
          variant="outline"
          className="h-10 mt-2 border-amber-500/50 text-amber-500 font-black"
          onClick={handleDownloadVideo}
          disabled={downloadState !== 'idle'}
          icon={<span className="material-symbols-outlined text-[18px]">download</span>}
        >
          {downloadState === 'idle' ? '💾 保存 (MP4)' : '保存中...'}
        </PillButton>
      )}
    </div>
  );
};
