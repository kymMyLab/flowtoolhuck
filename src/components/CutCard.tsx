import React from 'react';
import { Cut, VideoModelType, RecommendationModel } from '../types';
import { normalizeKenBurnsPreset } from '../services/browserVideoService';
import { VIDEO_MODELS_REGISTRY, resolveVideoModel } from '../config/studioDefinitions';

interface CutCardProps {
  cut: Cut;
  episodeId: number;
  isMvMode?: boolean;
  onAnimateRequest: (epId: number, cutId: number, modelType: VideoModelType) => void;
  onPreviewCut: (epId: number, cutId: number) => void;
  onUpdateSelection: (epId: number, cutId: number, isSelected: boolean) => void;
  onUpdateModel: (epId: number, cutId: number, model: RecommendationModel) => void;
  onRetry?: (type: 'image' | 'video', epId: number, cutId: number) => void;
}

export const CutCard: React.FC<CutCardProps> = React.memo(({ 
  cut, episodeId, isMvMode, onAnimateRequest, onPreviewCut, onUpdateSelection, onUpdateModel, onRetry 
}) => {
  const imageSrc = cut.imageBase64 ? (cut.imageBase64.startsWith('data:') ? cut.imageBase64 : `data:image/png;base64,${cut.imageBase64}`) : null;
  const videoSrc = cut.videoBase64 ? (cut.videoBase64.startsWith('data:') ? cut.videoBase64 : `data:video/mp4;base64,${cut.videoBase64}`) : null;

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onRetry) return;
    if (!cut.imageBase64) onRetry('image', episodeId, cut.id);
    else onRetry('video', episodeId, cut.id);
  };

  const handleToggleSelection = (e: React.MouseEvent) => {
    e.stopPropagation();
    onUpdateSelection(episodeId, cut.id, !cut.isSelectedForVideo);
  };

  const cycleModel = (e: React.MouseEvent) => {
    e.stopPropagation();
    // 定義レジストリから動的にモデルリストを構築（+ 'none'）
    const modelOptions: RecommendationModel[] = [
      ...VIDEO_MODELS_REGISTRY.map(m => m.id as RecommendationModel),
      'none'
    ];
    const currentIndex = modelOptions.indexOf(cut.targetVideoModel);
    const nextIndex = (currentIndex + 1) % modelOptions.length;
    const nextModel = modelOptions[nextIndex];
    onUpdateModel(episodeId, cut.id, nextModel);
    if (nextModel !== 'none') onUpdateSelection(episodeId, cut.id, true);
    else onUpdateSelection(episodeId, cut.id, false);
  };

  const getKenBurnsClass = () => {
    if (videoSrc || !imageSrc) return '';
    const preset = normalizeKenBurnsPreset(cut.kenBurnsPreset);
    if (preset === 'none') return '';
    return `studio-kb-${preset}`;
  };

  return (
    <div 
      onClick={() => onPreviewCut(episodeId, cut.id)}
      className={`flex-shrink-0 w-[140px] bg-[#1a1a1a] border rounded-xl overflow-hidden flex flex-col group transition-all relative shadow-lg cursor-pointer ${
        cut.isSelectedForVideo ? 'border-amber-500/50 shadow-amber-500/10' : 'border-[#333] hover:border-[#969696]'
      }`}
    >
      <div className="relative aspect-[9/16] bg-black flex items-center justify-center overflow-hidden">
        {videoSrc ? (
          <video src={videoSrc} className="w-full h-full object-cover" autoPlay loop muted playsInline />
        ) : imageSrc ? (
          <div className="w-full h-full overflow-hidden">
            <img 
              src={imageSrc} 
              alt={`Cut ${cut.id}`} 
              className={`w-full h-full object-cover animate-in fade-in duration-700 ${getKenBurnsClass()}`} 
            />
          </div>
        ) : (cut.isGeneratingImage || cut.isDirecting) ? (
          <div className="flex flex-col items-center gap-1">
            <div className={`w-5 h-5 border border-t-white rounded-full animate-spin ${cut.isDirecting ? 'border-amber-500/20 border-t-amber-500' : 'border-white/10'}`} />
            <span className="text-[8px] text-white/40 tracking-widest uppercase animate-pulse">
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
          <span className="text-white/10 text-[8px] tracking-widest uppercase">Standby</span>
        )}

        {/* 演出バッジ (Shot Scale & Ken Burns & Object & Focal) */}
        <div className="absolute bottom-1.5 left-1.5 flex flex-wrap items-center gap-1 z-10 max-w-[95%] overflow-hidden">
          {cut.shotScale && (
            <div className="px-1.5 py-0.5 rounded-sm bg-amber-500 text-[7px] font-black text-black uppercase tracking-tighter shadow-lg shrink-0">
              {cut.shotScale}
            </div>
          )}
          {cut.isObjectOnly && (
            <div className="px-1.5 py-0.5 rounded-sm bg-emerald-600 text-[7px] font-black text-white uppercase tracking-tighter shadow-lg shrink-0" title="人物なし・物体/情景カット">
              📦 OBJ
            </div>
          )}
          {cut.focalPoint && (
            <div className="px-1.5 py-0.5 rounded-sm bg-cyan-800/80 border border-cyan-400/30 text-[7px] font-black text-cyan-200 uppercase tracking-tighter shadow-lg shrink-0" title={`注視点: ${cut.focalPoint.focalSubject} (${cut.focalPoint.grid}) [${cut.focalPoint.normalizedCoord.join(',')}]`}>
              🎯 {cut.focalPoint.grid.replace('top-', 'T-').replace('bottom-', 'B-').replace('center', 'CTR').toUpperCase()}
            </div>
          )}
          {cut.kenBurnsPreset && cut.kenBurnsPreset !== 'none' && !videoSrc && (
            <div className="px-1.5 py-0.5 rounded-sm bg-black/75 backdrop-blur-md border border-white/20 text-[7px] font-bold text-white/90 uppercase tracking-tighter shadow-lg flex items-center gap-0.5 truncate shrink-0">
              <span className="material-symbols-outlined text-[8px] text-amber-400">videocam</span>
              <span>{cut.kenBurnsPreset.replace('-', ' ')}</span>
            </div>
          )}
        </div>



        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10">
          <div className="flex gap-1">
            <div 
              onClick={handleToggleSelection}
              className={`w-5 h-5 flex items-center justify-center rounded-sm backdrop-blur-md border transition-all ${
                cut.isSelectedForVideo 
                  ? 'bg-amber-500 border-amber-400 text-black shadow-lg shadow-amber-500/20' 
                  : 'bg-black/40 border-white/10 text-white/40 hover:bg-black/60'
              }`}
            >
              <span className="material-symbols-outlined text-[14px] font-bold">
                {cut.isSelectedForVideo ? 'check' : 'check_box_outline_blank'}
              </span>
            </div>
            <div className="px-1.5 py-0.5 rounded-sm bg-black/60 text-[8px] font-black text-white/90 backdrop-blur-md border border-white/10 flex items-center">
              C{cut.id.toString().padStart(2, '0')}
            </div>
          </div>
          
          <div 
            onClick={cycleModel}
            className={`px-1.5 py-0.5 rounded-sm text-[7px] font-black uppercase tracking-tighter backdrop-blur-md border transition-all ${
              cut.targetVideoModel === 'omni-flash' ? 'bg-purple-600/80 border-purple-400 text-white' :
              cut.targetVideoModel === 'veo-fast' ? 'bg-indigo-600/80 border-indigo-400 text-white' :
              cut.targetVideoModel === 'veo-lite' ? 'bg-blue-600/80 border-blue-400 text-white' :
              'bg-white/10 border-white/10 text-white/30'
            }`}
          >
            {cut.targetVideoModel === 'none' 
              ? 'Still Only' 
              : resolveVideoModel(cut.targetVideoModel).name.replace(' - ', ' ')}
          </div>
        </div>

        {cut.isQueued && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center">
             <div className="w-6 h-6 border border-amber-500/20 border-t-amber-500 rounded-full animate-spin" />
          </div>
        )}

        {cut.isGeneratingVideo && !videoSrc && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex flex-col items-center justify-center gap-2 z-20">
             <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
             <span className="text-[8px] text-white font-black animate-pulse uppercase">Baking Video</span>
          </div>
        )}
      </div>

      <div className="p-2 flex flex-col gap-1.5 bg-gradient-to-b from-[#1a1a1a] to-[#141414]">
        {isMvMode ? (
          <div className="flex items-center gap-1.5 h-[28px] overflow-hidden">
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-purple-500/25 text-purple-300 font-black border border-purple-500/40 shrink-0 uppercase tracking-tighter">
              LYRIC
            </span>
            <p className="text-[10px] text-white/95 font-bold line-clamp-2 leading-snug tracking-tight">
              {cut.narrationJp || "歌詞策定中..."}
            </p>
          </div>
        ) : (
          <p className="text-[10px] text-white/80 font-medium line-clamp-2 leading-snug h-[28px]">
            {cut.narrationJp || "脚本策定中..."}
          </p>
        )}
        
        <div className="flex items-center justify-between mt-auto pt-1 border-t border-white/5">
           <span className={`text-[7px] px-1 py-0.5 rounded-sm font-bold uppercase tracking-tighter ${cut.videoModelUsed ? 'bg-white/10 text-white/40' : 'text-white/10'}`}>
             {cut.videoModelUsed ? cut.videoModelUsed.replace('-', ' ') : cut.targetVideoModel !== 'none' ? 'READY' : 'STILL'}
           </span>
           <div className="flex gap-0.5">
              {cut.bgmMediaId && <span className="material-symbols-outlined text-[10px] text-blue-400/50">music_note</span>}
              {cut.voiceId && <span className="material-symbols-outlined text-[10px] text-amber-400/50">record_voice_over</span>}
           </div>
        </div>
      </div>
    </div>
  );
});