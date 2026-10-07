import { Cut, Episode, KenBurnsPreset } from '../types';
import { Output, Mp4OutputFormat, BufferTarget, CanvasSource } from 'mediabunny';
import { renderCoverCanvas } from './exportService';
import { normalizeKenBurnsPreset, drawKenBurnsFrame } from './renderers/kenBurns';
import { 
  drawBakedSubtitles, 
  createCachedSubtitleCanvas, 
  renderKineticAdoLyrics, 
  renderStandardSubtitles, 
  splitIntoAdoWords 
} from './renderers/subtitles';

export {
  normalizeKenBurnsPreset,
  drawKenBurnsFrame,
  drawBakedSubtitles,
  createCachedSubtitleCanvas,
  renderKineticAdoLyrics,
  renderStandardSubtitles,
  splitIntoAdoWords
};

/**
 * エピソード内の全カットを1本に結合してMP4を出力する
 */
export async function renderFullEpisodeMovie(
  episode: Episode, 
  onProgress: (cutIndex: number, total: number) => void
): Promise<Blob> {
  await document.fonts.ready;

  const width = 720;
  const height = 1280;
  const fps = 30;
  const defaultCutDuration = 4;

  const outputCanvas = new OffscreenCanvas(width, height);
  const ctx = outputCanvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });

  const canvasSource = new CanvasSource(outputCanvas as any, {
    codec: 'avc',
    bitrate: 8000000, 
    frameRate: fps
  } as any);
  output.addVideoTrack(canvasSource);
  await output.start();

  let globalTime = 0;

  try {
    const coverCanvas = await renderCoverCanvas(episode);
    const coverFrames = 2 * fps;
    for (let f = 0; f < coverFrames; f++) {
      ctx.fillStyle = 'black';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(coverCanvas as any, 0, 0, width, height);
      await canvasSource.add(globalTime, 1 / fps);
      globalTime += 1 / fps;
    }
    if (coverCanvas instanceof OffscreenCanvas) {
      const coverCtx = coverCanvas.getContext('2d');
      if (coverCtx) coverCtx.clearRect(0, 0, coverCanvas.width, coverCanvas.height);
      coverCanvas.width = 0;
      coverCanvas.height = 0;
    } else {
      const cvs = coverCanvas as HTMLCanvasElement;
      const coverCtx = cvs.getContext('2d');
      if (coverCtx) coverCtx.clearRect(0, 0, cvs.width, cvs.height);
      cvs.width = 0;
      cvs.height = 0;
    }
  } catch (e) {
    console.error('Intro cover render failed', e);
  }

  for (let i = 0; i < episode.cuts.length; i++) {
    const cut = episode.cuts[i];
    onProgress(i + 1, episode.cuts.length);

    if (cut.videoBase64) {
      const video = document.createElement('video');
      video.src = `data:video/mp4;base64,${cut.videoBase64}`;
      video.muted = true;
      video.playsInline = true;
      video.style.position = 'absolute';
      video.style.opacity = '0';
      video.style.pointerEvents = 'none';
      video.style.width = '0';
      video.style.height = '0';
      document.body.appendChild(video);

      try {
        await new Promise<void>((resolve) => {
          let settled = false;
          const done = () => { if (!settled) { settled = true; resolve(); } };
          video.onloadeddata = done;
          video.onerror = done;
          setTimeout(done, 8000);
          video.load();
        });

        const duration = video.duration || defaultCutDuration;
        const frames = Math.floor(duration * fps);

        for (let f = 0; f < frames; f++) {
          const time = f / fps;
          video.currentTime = time;
          await new Promise(r => video.onseeked = r);
          
          ctx.fillStyle = 'black';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(video, 0, 0, width, height);
          drawBakedSubtitles(ctx, width, height, cut, time, duration, !!episode.isMvMode);
          
          await canvasSource.add(globalTime, 1 / fps);
          globalTime += 1 / fps;
        }
      } finally {
        // Video デコーダーおよびメモリを確実に解放（Chrome デコーダー上限対策）
        video.pause();
        video.removeAttribute('src');
        video.src = '';
        video.load();
        if (video.parentNode) {
          video.parentNode.removeChild(video);
        }
      }
    } else if (cut.imageBase64) {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const imgObj = new Image();
        imgObj.onload = () => resolve(imgObj);
        imgObj.onerror = reject;
        imgObj.src = `data:image/png;base64,${cut.imageBase64}`;
      });

      const duration = defaultCutDuration;
      const frames = duration * fps;

      // 静止画字幕の描画キャッシュ（MVキネティック以外の静的テロップの場合）
      const subtitleCache = (!episode.isMvMode && !cut.telop?.style?.startsWith('mv-'))
        ? createCachedSubtitleCanvas(width, height, cut)
        : null;

      for (let f = 0; f < frames; f++) {
        const progress = f / frames;
        ctx.fillStyle = 'black';
        ctx.fillRect(0, 0, width, height);
        
        drawKenBurnsFrame(ctx, img, width, height, cut.kenBurnsPreset || 'none', progress);
        
        if (subtitleCache) {
          ctx.drawImage(subtitleCache as any, 0, 0);
        } else {
          drawBakedSubtitles(ctx, width, height, cut, progress * duration, duration, !!episode.isMvMode);
        }
        
        await canvasSource.add(globalTime, 1 / fps);
        globalTime += 1 / fps;
      }
    }
  }

  canvasSource.close();
  await output.finalize();

  ctx.clearRect(0, 0, width, height);
  outputCanvas.width = 0;
  outputCanvas.height = 0;

  return new Blob([output.target.buffer!], { type: 'video/mp4' });
}

/**
 * 単一カットの Ken Burns 動画をレンダリングして Base64 文字列で返却
 */
export async function renderKenBurnsVideo(cut: Cut, durationSec: number = 4, isMvMode: boolean = false): Promise<string> {
  await document.fonts.ready;
  if (!cut.imageBase64) throw new Error('Image data missing');

  const width = 720;
  const height = 1280;
  const fps = 30;
  const totalFrames = durationSec * fps;

  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to create offscreen context');
  
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = `data:image/png;base64,${cut.imageBase64}`;
  });

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new BufferTarget(),
  });

  const canvasSource = new CanvasSource(canvas as any, { codec: 'avc', frameRate: fps } as any);
  output.addVideoTrack(canvasSource);
  await output.start();

  // 静止画字幕の描画キャッシュ（120フレーム中の再計算を完全ゼロ化）
  const subtitleCache = (!isMvMode && !cut.telop?.style?.startsWith('mv-'))
    ? createCachedSubtitleCanvas(width, height, cut)
    : null;

  for (let frame = 0; frame < totalFrames; frame++) {
    const progress = frame / totalFrames;
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, width, height);
    drawKenBurnsFrame(ctx, img, width, height, cut.kenBurnsPreset || 'none', progress);

    if (subtitleCache) {
      ctx.drawImage(subtitleCache as any, 0, 0);
    } else {
      drawBakedSubtitles(ctx, width, height, cut, frame / fps, durationSec, isMvMode);
    }

    await canvasSource.add(frame / fps, 1 / fps);
  }

  canvasSource.close();
  await output.finalize();

  ctx.clearRect(0, 0, width, height);
  canvas.width = 0;
  canvas.height = 0;

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(new Blob([output.target.buffer!], { type: 'video/mp4' }));
  });
}