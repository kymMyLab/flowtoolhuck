import { KenBurnsPreset } from '../../types';

/**
 * ケンバーンズ効果の文字列をケバブケースに正規化（キャメルケースや旧表記との互換性を確保）
 */
export function normalizeKenBurnsPreset(preset?: string): KenBurnsPreset {
  if (!preset || preset === 'none') return 'none';
  const p = preset.toLowerCase().replace(/_/g, '-');
  if (p === 'zoomin' || p === 'zoom-in' || p === 'subtlezoom' || p === 'subtle-zoom') return 'zoom-in';
  if (p === 'zoomout' || p === 'zoom-out') return 'zoom-out';
  if (p === 'panleft' || p === 'pan-left') return 'pan-left';
  if (p === 'panright' || p === 'pan-right' || p === 'pandiagonal' || p === 'pan-diagonal') return 'pan-right';
  if (p === 'tiltup' || p === 'tilt-up') return 'tilt-up';
  if (p === 'tiltdown' || p === 'tilt-down') return 'tilt-down';
  return 'zoom-in';
}

/**
 * 静止画に対して Ken Burns アフェクトを計算してキャンバスに描画するヘルパー
 */
export function drawKenBurnsFrame(
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  img: HTMLImageElement | OffscreenCanvas | HTMLCanvasElement,
  width: number,
  height: number,
  preset: string,
  progress: number
) {
  const normPreset = normalizeKenBurnsPreset(preset);
  let scale = 1.0;
  let xOffset = 0;
  let yOffset = 0;

  if (normPreset === 'zoom-in') {
    scale = 1.0 + progress * 0.20;
    yOffset = -(height * 0.08 * progress); 
  } else if (normPreset === 'zoom-out') {
    scale = 1.20 - progress * 0.20;
    yOffset = -(height * 0.08 * (1 - progress));
  } else if (normPreset === 'pan-left') {
    scale = 1.15;
    xOffset = width * 0.05 - (progress * width * 0.1);
  } else if (normPreset === 'pan-right') {
    scale = 1.15;
    xOffset = -(width * 0.05) + (progress * width * 0.1);
  } else if (normPreset === 'tilt-up') {
    scale = 1.15;
    yOffset = height * 0.05 - (progress * height * 0.1);
  } else if (normPreset === 'tilt-down') {
    scale = 1.15;
    yOffset = -(height * 0.05) + (progress * height * 0.1);
  }

  const drawW = width * scale;
  const drawH = height * scale;
  const dx = (width - drawW) / 2 + xOffset;
  const dy = (height - drawH) / 2 + yOffset;

  ctx.drawImage(img as any, dx, dy, drawW, drawH);
}
