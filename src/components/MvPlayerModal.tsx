import React, { useState, useEffect, useRef } from 'react';
import { Episode, Cut, EmoCropPoint } from '../types';
import { PillButton } from './StudioSidebar';
import { formatDataUri, formatVideoDataUri } from '../services/utils';
import { Flow } from 'flow-sdk';
interface MvPlayerModalProps {
  isOpen: boolean;
  ep: Episode;
  aspectRatio?: string;
  onClose: () => void;
}
export const MvPlayerModal: React.FC<MvPlayerModalProps> = ({ isOpen, ep, onClose }) => {
  const canvasWidth = 1280;
  const canvasHeight = 720;
  const isVertical = false;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(48); // 12 cuts * 4 sec = 48s default
  const [activeCutIndex, setActiveCutIndex] = useState(0);
  const [activeCropIndex, setActiveCropIndex] = useState(0);
  const [bassKickEnergy, setBassKickEnergy] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const imageElementsRef = useRef<Map<number, HTMLImageElement>>(new Map());
  const videoElementsRef = useRef<Map<number, HTMLVideoElement>>(new Map());
  // 画像および動画のプリロード
  useEffect(() => {
    if (!isOpen) return;
    const imgMap = new Map<number, HTMLImageElement>();
    const vidMap = new Map<number, HTMLVideoElement>();
    ep.cuts.forEach(cut => {
      if (cut.imageBase64) {
        const img = new Image();
        img.src = formatDataUri(cut.imageBase64);
        imgMap.set(cut.id, img);
      }
      if (cut.videoBase64) {
        const vid = document.createElement('video');
        vid.src = formatVideoDataUri(cut.videoBase64);
        vid.muted = true;
        vid.loop = true;
        vid.playsInline = true;
        vid.crossOrigin = 'anonymous';
        vid.preload = 'auto';
        vidMap.set(cut.id, vid);
      }
    });
    imageElementsRef.current = imgMap;
    videoElementsRef.current = vidMap;
    return () => {
      vidMap.forEach(vid => {
        try {
          vid.pause();
          vid.src = '';
        } catch {
          // ignore
        }
      });
      vidMap.clear();
    };
  }, [isOpen, ep.cuts]);
  // Web Audio API による低音キック解析
  const initAudio = () => {
    if (audioContextRef.current || !ep.songAudioBase64) return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      if (audioRef.current) {
        const source = ctx.createMediaElementSource(audioRef.current);
        source.connect(analyser);
        analyser.connect(ctx.destination);
      }
      audioContextRef.current = ctx;
      analyserRef.current = analyser;
    } catch (e) {
      console.warn('Web Audio init error:', e);
    }
  };
  const handlePlayToggle = async () => {
    if (!audioContextRef.current) initAudio();
    if (audioContextRef.current?.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        try {
          await audioRef.current.play();
          setIsPlaying(true);
        } catch (e) {
          console.warn('Audio play error:', e);
        }
      }
    } else {
      setIsPlaying(!isPlaying);
    }
  };
  // メインループ（60fps Canvas描画 ＆ 低音キックバウンス ＆ カメラワーク）
  useEffect(() => {
    if (!isOpen) return;
    let startTime = Date.now() - (currentTime * 1000);
    const cuts = ep.cuts || [];
    const cutCount = Math.max(1, cuts.length);
    const defaultCutDur = ep.cuts[0]?.videoDuration || 8;
    
    // 音声がある場合は audio.duration / cuts.length、音声がない場合は videoDuration (または 8)
    const audioDur = audioRef.current?.duration;
    const cutDur = (audioDur && audioDur > 0 && isFinite(audioDur))
      ? (audioDur / cutCount)
      : defaultCutDur;
    const totalDur = (audioDur && audioDur > 0 && isFinite(audioDur))
      ? audioDur
      : (cutCount * cutDur);
    setDuration(totalDur);
    const freqData = new Uint8Array(128);
    const loop = () => {
      let t = 0;
      if (audioRef.current && ep.songAudioBase64) {
        t = audioRef.current.currentTime;
      } else if (isPlaying) {
        t = (Date.now() - startTime) / 1000;
        if (t >= totalDur) {
          t = 0;
          startTime = Date.now();
        }
      } else {
        t = currentTime;
      }
      setCurrentTime(t);
      // 低音キック解析
      let kick = 0;
      if (analyserRef.current && isPlaying) {
        analyserRef.current.getByteFrequencyData(freqData);
        // 低音域 (20Hz〜150Hz: 最初の4〜8バンド)
        const bassSum = freqData[1] + freqData[2] + freqData[3] + freqData[4];
        const bassAvg = bassSum / 4;
        kick = bassAvg > 140 ? (bassAvg - 140) / 115 : 0;
      }
      setBassKickEnergy(kick);
      // 現在のカットおよびエモ切り抜きポイントを算出
      const cutIdx = Math.min(cuts.length - 1, Math.floor(t / cutDur));
      const cutProgress = (t % cutDur) / cutDur; // 0.0 to 1.0 within cut
      setActiveCutIndex(cutIdx);
      const curCut = cuts[cutIdx];
      const emoCrops = curCut?.emoCrops && curCut.emoCrops.length > 0
        ? curCut.emoCrops
        : [{
            id: 1,
            label: 'マスター全景',
            centerX: 0.5,
            centerY: 0.5,
            zoomScale: 1.05,
            panDirection: 'slow-zoom-in' as const,
            emoReason: 'マスターショット',
            isSafeFromArtifacts: true
          }];
      const cropInterval = cutDur / emoCrops.length;
      const cropSubIdx = Math.min(emoCrops.length - 1, Math.floor((t % cutDur) / cropInterval));
      setActiveCropIndex(cropSubIdx);
      const activeCrop = emoCrops[cropSubIdx];
      const cropProgress = ((t % cutDur) % cropInterval) / cropInterval;
      // ── Canvas描画 ──
      const canvas = canvasRef.current;
      if (canvas && curCut) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          const w = canvas.width;
          const h = canvas.height;
          // 背景クリア
          ctx.fillStyle = '#0a0c10';
          ctx.fillRect(0, 0, w, h);
          // 描画ソースの取得 (Veo動画が存在する場合は動画、なければ静止画像)
          const vid = videoElementsRef.current.get(curCut.id);
          const img = imageElementsRef.current.get(curCut.id);
          const hasVideo = vid && curCut.videoBase64;
          const isSourceReady = hasVideo ? (vid.readyState >= 2) : (img && img.complete);
          if (hasVideo && vid) {
            // シネマグラフ動画の再生とシーク同期
            const vidDur = curCut.videoDuration || 8;
            const targetVidTime = (t % cutDur) % vidDur;
            if (isPlaying && vid.paused) {
              vid.play().catch(() => {});
            } else if (!isPlaying && !vid.paused) {
              vid.pause();
            }
            if (Math.abs(vid.currentTime - targetVidTime) > 0.4) {
              vid.currentTime = targetVidTime;
            }
          }
          if (isSourceReady) {
            ctx.save();
            // 低音キックに同期した重心バウンス (最大 1.05倍のパンチ)
            const bounceScale = 1.0 + (kick * 0.04);
            const baseZoom = activeCrop.zoomScale || 1.1;
            // パン演出の計算
            let panOffsetX = 0;
            let panOffsetY = 0;
            if (activeCrop.panDirection === 'slow-pan-right') panOffsetX = (cropProgress - 0.5) * 0.08;
            else if (activeCrop.panDirection === 'slow-pan-left') panOffsetX = (0.5 - cropProgress) * 0.08;
            else if (activeCrop.panDirection === 'slow-tilt-up') panOffsetY = (0.5 - cropProgress) * 0.06;
            else if (activeCrop.panDirection === 'slow-zoom-in') panOffsetX = 0;
            const effectiveZoom = baseZoom * (1.0 + (cropProgress * 0.06)) * bounceScale;
            const targetCenterX = Math.max(0.1, Math.min(0.9, activeCrop.centerX + panOffsetX));
            const targetCenterY = Math.max(0.1, Math.min(0.9, activeCrop.centerY + panOffsetY));
            ctx.translate(w / 2, h / 2);
            ctx.scale(effectiveZoom, effectiveZoom);
            ctx.translate(-targetCenterX * w, -targetCenterY * h);
            if (hasVideo && vid) {
              ctx.drawImage(vid, 0, 0, w, h);
            } else if (img) {
              ctx.drawImage(img, 0, 0, w, h);
            }
            ctx.restore();
            // フィルムグレイン / Lo-Fi ビンテージ質感
            ctx.fillStyle = `rgba(255, 255, 255, ${0.02 + Math.random() * 0.02})`;
            ctx.fillRect(0, 0, w, h);
            // 歌詞テロップ描画
            const lyric = curCut.narrationJp || '';
            if (lyric) {
              ctx.save();
              ctx.shadowColor = 'rgba(0,0,0,0.8)';
              ctx.shadowBlur = 12;
              ctx.font = 'bold 24px "Zen Kaku Gothic New", sans-serif';
              ctx.textAlign = 'center';
              ctx.fillStyle = '#ffffff';
              // 背景に半透明黒ピル
              const textMetrics = ctx.measureText(lyric);
              const textW = textMetrics.width;
              ctx.fillStyle = 'rgba(10, 12, 16, 0.75)';
              ctx.beginPath();
              ctx.roundRect((w - textW) / 2 - 20, h - 70, textW + 40, 44, 12);
              ctx.fill();
              ctx.fillStyle = '#ffffff';
              ctx.fillText(lyric, w / 2, h - 40);
              ctx.restore();
            }
          }
        }
      }
      if (isPlaying) {
        animFrameRef.current = requestAnimationFrame(loop);
      }
    };
    animFrameRef.current = requestAnimationFrame(loop);
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isOpen, isPlaying, ep.cuts, ep.songAudioBase64]);
  // 60fps MP4/WebM 動画書き出し (MediaRecorder)
  const handleExportVideo = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setIsExporting(true);
    setExportProgress(5);
    try {
      const stream = canvas.captureStream(60);
      let combinedStream = stream;
      // 音声ストリームを統合
      if (audioRef.current && (audioRef.current as any).captureStream) {
        const audioStream = (audioRef.current as any).captureStream();
        combinedStream = new MediaStream([...stream.getVideoTracks(), ...audioStream.getAudioTracks()]);
      } else if (audioContextRef.current) {
        const dest = audioContextRef.current.createMediaStreamDestination();
        analyserRef.current?.connect(dest);
        combinedStream = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      }
      const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1') ? 'video/mp4' : 'video/webm';
      const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 8000000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = async () => {
        const fullBlob = new Blob(chunks, { type: mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const b64 = (reader.result as string).split(',')[1];
          const filename = `${ep.titleEn || 'LoFi_MV'}_AI_Emo_Cut.${mimeType === 'video/mp4' ? 'mp4' : 'webm'}`;
          await Flow.download({
            base64: b64,
            mimeType: mimeType as any,
            filename
          });
          setIsExporting(false);
        };
        reader.readAsDataURL(fullBlob);
      };
      recorder.start();
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        await audioRef.current.play();
      }
      setIsPlaying(true);
      const cutsCount = ep.cuts.length || 12;
      const totalExportMs = cutsCount * 4 * 1000;
      const progressInterval = setInterval(() => {
        setExportProgress(p => Math.min(95, p + 5));
      }, totalExportMs / 20);
      setTimeout(() => {
        clearInterval(progressInterval);
        recorder.stop();
        if (audioRef.current) audioRef.current.pause();
        setIsPlaying(false);
        setExportProgress(100);
      }, totalExportMs);
    } catch (err) {
      console.error('Video export error:', err);
      setIsExporting(false);
    }
  };
  if (!isOpen) return null;
  const currentCut = ep.cuts[activeCutIndex];
  const currentEmoCrop = currentCut?.emoCrops?.[activeCropIndex];
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-6 select-none bg-black/95 backdrop-blur-2xl">
      <div className="relative w-full max-w-[1100px] h-[92vh] bg-[#0c0e14] border border-purple-500/30 rounded-3xl overflow-hidden shadow-2xl flex flex-col">
        {/* ヘッダー */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-purple-950/80 via-[#12141f] to-indigo-950/80 border-b border-purple-500/20 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-purple-600/30 border border-purple-400 text-purple-200 flex items-center justify-center text-base">
              🎵
            </span>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-2">
                <span>{ep.songTitle || ep.titleJp || 'AI厳選切り抜き 音楽MV'}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-900/60 border border-purple-400/50 text-purple-200 font-bold">
                  60fps 重心バウンス
                </span>
              </h3>
              <p className="text-[10.5px] text-purple-300 font-mono">
                {currentEmoCrop ? `Cut #${currentCut?.id} [${currentEmoCrop.label} / ${currentEmoCrop.zoomScale}x] — ${currentEmoCrop.emoReason}` : '12Cut × Gemini動的エモ構図'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <PillButton
              variant="filled"
              className="bg-purple-600 hover:bg-purple-500 text-white font-bold h-8 px-3 text-xs shadow-md"
              onClick={handleExportVideo}
              disabled={isExporting}
              icon={<span className="material-symbols-outlined text-[16px]">{isExporting ? 'hourglass_top' : 'video_file'}</span>}
            >
              {isExporting ? `動画出力中 (${exportProgress}%)` : '🎬 60fps動画書き出し'}
            </PillButton>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 flex items-center justify-center transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg">close</span>
            </button>
          </div>
        </div>
        {/* プレビュービューポート */}
        <div className="flex-1 bg-black relative flex items-center justify-center min-h-0 overflow-hidden p-3 sm:p-6">
          <div className={`relative max-w-full max-h-full ${isVertical ? 'aspect-[9/16]' : 'aspect-video'} rounded-2xl overflow-hidden border border-purple-500/20 shadow-2xl flex items-center justify-center bg-[#06070a]`}>
            <canvas
              ref={canvasRef}
              width={canvasWidth}
              height={canvasHeight}
              className="w-full h-full object-contain block"
            />
            {/* 低音キックインジケーター */}
            {bassKickEnergy > 0.05 && (
              <div 
                className="absolute inset-0 pointer-events-none border-4 border-purple-500/40 rounded-2xl transition-opacity duration-75"
                style={{ opacity: bassKickEnergy }}
              />
            )}
          </div>
        </div>
        {/* 音声要素 (非表示) */}
        {ep.songAudioBase64 && (
          <audio
            ref={audioRef}
            src={`data:${ep.songAudioMimeType || 'audio/mp3'};base64,${ep.songAudioBase64}`}
            onLoadedMetadata={e => {
              const dur = (e.currentTarget as HTMLAudioElement).duration;
              if (dur && dur > 0 && isFinite(dur)) {
                setDuration(dur);
              }
            }}
            onEnded={() => setIsPlaying(false)}
          />
        )}
        {/* コントロールバー */}
        <div className="p-3 sm:p-4 bg-[#10121a] border-t border-purple-500/20 flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handlePlayToggle}
              className="w-10 h-10 rounded-full bg-purple-600 hover:bg-purple-500 text-white flex items-center justify-center shadow-lg transition-transform active:scale-95 cursor-pointer shrink-0"
            >
              <span className="material-symbols-outlined text-2xl">
                {isPlaying ? 'pause' : 'play_arrow'}
              </span>
            </button>
            <div className="flex-1 flex flex-col gap-1">
              <div className="flex items-center justify-between text-[11px] font-mono font-bold text-purple-300">
                <span>{Math.floor(currentTime / 60)}:{String(Math.floor(currentTime % 60)).padStart(2, '0')}</span>
                <span>Cut {activeCutIndex + 1} / {ep.cuts.length || 12}</span>
                <span>{Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}</span>
              </div>
              <input
                type="range"
                min={0}
                max={duration}
                step={0.1}
                value={currentTime}
                onChange={e => {
                  const val = parseFloat(e.target.value);
                  setCurrentTime(val);
                  if (audioRef.current) audioRef.current.currentTime = val;
                }}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

