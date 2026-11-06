import { Episode } from '../../types';
import { checkIsHistorical } from '../directorService';

/**
 * 動画や扉絵用にタイトル文字列をクリーン化
 */
export const cleanTitle = (title: string) => {
  return (title || '無題').replace(/\s*\(Ep\.\s*\d+\)/gi, '').trim();
};

export interface CoverPalette {
  id: string;
  name: string;
  genre: 'mv' | 'historical' | 'trivia' | 'manzai' | 'cinema';
  vPanelStart: string;
  vPanelEnd: string;
  hPanelStart: string;
  hPanelMid: string;
  hPanelEnd: string;
  borderColors: [string, string, string];
  ribbonColors: [string, string];
  badgeColor: string;
}

export const COVER_PALETTES: Record<string, CoverPalette> = {
  // --- 🎵 MVモード用 ---
  mv_violet: {
    id: 'mv_violet',
    name: 'Classic Violet (王道ネオン紫)',
    genre: 'mv',
    vPanelStart: '#0D0814',
    vPanelEnd: '#1A0E2E',
    hPanelStart: 'rgba(26, 14, 46, 0.98)',
    hPanelMid: 'rgba(13, 8, 20, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#FF0055', '#A855F7', '#00F0FF'],
    ribbonColors: ['#BE185D', '#6D28D9'],
    badgeColor: '#E879F9'
  },
  mv_cyan: {
    id: 'mv_cyan',
    name: 'Cyber Cyan (電脳シアン青)',
    genre: 'mv',
    vPanelStart: '#05131C',
    vPanelEnd: '#0C2236',
    hPanelStart: 'rgba(12, 34, 54, 0.98)',
    hPanelMid: 'rgba(6, 18, 28, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#00F0FF', '#0284C7', '#10B981'],
    ribbonColors: ['#0284C7', '#0D9488'],
    badgeColor: '#38BDF8'
  },
  mv_amber: {
    id: 'mv_amber',
    name: 'Sunset Twilight (夕暮れアンバー)',
    genre: 'mv',
    vPanelStart: '#180A0E',
    vPanelEnd: '#2E1218',
    hPanelStart: 'rgba(46, 18, 24, 0.98)',
    hPanelMid: 'rgba(24, 10, 14, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#F43F5E', '#F59E0B', '#FBBF24'],
    ribbonColors: ['#E11D48', '#D97706'],
    badgeColor: '#F472B6'
  },
  mv_emerald: {
    id: 'mv_emerald',
    name: 'Acid Matrix (電解エメラルド緑)',
    genre: 'mv',
    vPanelStart: '#06140D',
    vPanelEnd: '#0C291B',
    hPanelStart: 'rgba(12, 41, 27, 0.98)',
    hPanelMid: 'rgba(6, 20, 14, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#10B981', '#22C55E', '#84CC16'],
    ribbonColors: ['#059669', '#065F46'],
    badgeColor: '#4ADE80'
  },
  mv_crimson: {
    id: 'mv_crimson',
    name: 'Noir Ruby (真紅ノワール赤)',
    genre: 'mv',
    vPanelStart: '#14070A',
    vPanelEnd: '#260B12',
    hPanelStart: 'rgba(38, 11, 18, 0.98)',
    hPanelMid: 'rgba(18, 6, 9, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#EF4444', '#DC2626', '#B91C1C'],
    ribbonColors: ['#991B1B', '#450A0A'],
    badgeColor: '#FB7185'
  },
  // --- 🏮 時代劇・歴史用 ---
  hist_gold: {
    id: 'hist_gold',
    name: '元禄黄金 (蒔絵・本金箔)',
    genre: 'historical',
    vPanelStart: '#120A05',
    vPanelEnd: '#24140A',
    hPanelStart: 'rgba(36, 20, 10, 0.98)',
    hPanelMid: 'rgba(18, 10, 5, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#785A28', '#F59E0B', '#785A28'],
    ribbonColors: ['#B45309', '#78350F'],
    badgeColor: '#FBBF24'
  },
  hist_indigo: {
    id: 'hist_indigo',
    name: '深川藍染 (正藍・白金)',
    genre: 'historical',
    vPanelStart: '#070F1A',
    vPanelEnd: '#0E1D33',
    hPanelStart: 'rgba(14, 29, 51, 0.98)',
    hPanelMid: 'rgba(7, 15, 26, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#1E3A8A', '#60A5FA', '#E2E8F0'],
    ribbonColors: ['#1E40AF', '#172554'],
    badgeColor: '#93C5FD'
  },
  hist_vermilion: {
    id: 'hist_vermilion',
    name: '宮社朱塗 (丹紅・弁柄)',
    genre: 'historical',
    vPanelStart: '#180905',
    vPanelEnd: '#2E120A',
    hPanelStart: 'rgba(46, 18, 10, 0.98)',
    hPanelMid: 'rgba(24, 9, 5, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#991B1B', '#EA580C', '#78350F'],
    ribbonColors: ['#C2410C', '#7C2D12'],
    badgeColor: '#FB923C'
  },
  // --- 💡 雑学・解説用 ---
  trivia_blue: {
    id: 'trivia_blue',
    name: '知性アカデミーブルー',
    genre: 'trivia',
    vPanelStart: '#04101A',
    vPanelEnd: '#082033',
    hPanelStart: 'rgba(8, 32, 51, 0.98)',
    hPanelMid: 'rgba(4, 16, 26, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#0EA5E9', '#38BDF8', '#0284C7'],
    ribbonColors: ['#0369A1', '#0C4A6E'],
    badgeColor: '#38BDF8'
  },
  // --- 🎙️ 漫才用 ---
  manzai_crimson: {
    id: 'manzai_crimson',
    name: '寄席ローズレッド',
    genre: 'manzai',
    vPanelStart: '#1A0808',
    vPanelEnd: '#2E1010',
    hPanelStart: 'rgba(46, 16, 16, 0.98)',
    hPanelMid: 'rgba(26, 8, 8, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#DC2626', '#E11D48', '#991B1B'],
    ribbonColors: ['#B91C1C', '#881337'],
    badgeColor: '#FB7185'
  },
  // --- 🎬 通常シネマ用 ---
  cinema_indigo: {
    id: 'cinema_indigo',
    name: 'ロイヤルインディゴ',
    genre: 'cinema',
    vPanelStart: '#0D0D12',
    vPanelEnd: '#181822',
    hPanelStart: 'rgba(24, 24, 34, 0.98)',
    hPanelMid: 'rgba(13, 13, 18, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#E5E7EB', '#6366F1', '#E5E7EB'],
    ribbonColors: ['#4338CA', '#1E1B4B'],
    badgeColor: '#A5B4FC'
  },
  cinema_purple: {
    id: 'cinema_purple',
    name: 'ギャラクシーパープル',
    genre: 'cinema',
    vPanelStart: '#100A18',
    vPanelEnd: '#1E122E',
    hPanelStart: 'rgba(30, 18, 46, 0.98)',
    hPanelMid: 'rgba(16, 10, 24, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#6366F1', '#8B5CF6', '#EC4899'],
    ribbonColors: ['#6D28D9', '#4C1D95'],
    badgeColor: '#C084FC'
  }
};

export function getCoverPalettesForGenre(genre: string = 'mv'): CoverPalette[] {
  return Object.values(COVER_PALETTES).filter(p => p.genre === genre);
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function resolveCoverPalette(ep: Episode): CoverPalette {
  if (ep.coverThemeVariant && COVER_PALETTES[ep.coverThemeVariant]) {
    return COVER_PALETTES[ep.coverThemeVariant];
  }
  const isMv = !!ep.isMvMode || (ep.titleJp || '').startsWith('🎵') || ep.productionMode === 'mv';
  const isHist = checkIsHistorical(ep.era, ep.theme);
  const mode = ep.productionMode || (isMv ? 'mv' : 'episodes');
  const combinedContext = `${ep.era || ''} ${ep.theme || ''} ${mode}`.toLowerCase();
  const isTrivia = mode === 'trivia' || combinedContext.includes('雑学') || combinedContext.includes('解説');
  const isManzai = mode === 'manzai' || combinedContext.includes('漫才');

  let candidates: CoverPalette[];
  if (isMv) {
    candidates = [COVER_PALETTES.mv_violet, COVER_PALETTES.mv_cyan, COVER_PALETTES.mv_amber, COVER_PALETTES.mv_emerald, COVER_PALETTES.mv_crimson];
  } else if (isHist) {
    candidates = [COVER_PALETTES.hist_gold, COVER_PALETTES.hist_indigo, COVER_PALETTES.hist_vermilion];
  } else if (isTrivia) {
    candidates = [COVER_PALETTES.trivia_blue];
  } else if (isManzai) {
    candidates = [COVER_PALETTES.manzai_crimson];
  } else {
    candidates = [COVER_PALETTES.cinema_indigo, COVER_PALETTES.cinema_purple];
  }

  const seed = `${ep.theme || ''}_${ep.taste || ''}_${ep.era || ''}`;
  const idx = simpleHash(seed) % candidates.length;
  return candidates[idx];
}

export function splitTitleForCover(
  rawTitle: string, 
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, 
  maxW: number
): string[] {
  if (ctx.measureText(rawTitle).width <= maxW) return [rawTitle];

  const parenMatch = rawTitle.match(/[\s　]*([(\[（【].+)$/);
  if (parenMatch?.index && parenMatch.index > 0) {
    const mainPart = rawTitle.slice(0, parenMatch.index).trim();
    const subPart = parenMatch[0].trim();
    if (ctx.measureText(mainPart).width <= maxW && ctx.measureText(subPart).width <= maxW) {
      return [mainPart, subPart];
    }
  }

  for (const d of [' - ', ' — ', ' : ', ': ', ' / ', '〜', '～']) {
    const idx = rawTitle.indexOf(d);
    if (idx > 0 && idx < rawTitle.length - 1) {
      const p1 = rawTitle.slice(0, idx).trim();
      const p2 = rawTitle.slice(idx).trim();
      if (ctx.measureText(p1).width <= maxW && ctx.measureText(p2).width <= maxW) {
        return [p1, p2];
      }
    }
  }

  const words = rawTitle.split(/(\s+)/);
  if (words.length > 2) {
    let currentLine = '';
    let breakIdx = -1;
    for (let i = 0; i < words.length; i++) {
      const candidate = currentLine + words[i];
      if (ctx.measureText(candidate.trim()).width <= maxW) {
        currentLine = candidate;
      } else {
        breakIdx = i;
        break;
      }
    }
    if (breakIdx > 0) {
      const l1 = words.slice(0, breakIdx).join('').trim();
      const l2 = words.slice(breakIdx).join('').trim();
      if (l1 && l2 && ctx.measureText(l2).width <= maxW) return [l1, l2];
    }
  }

  let bestCut = 1;
  for (let i = 1; i <= rawTitle.length; i++) {
    const sub = rawTitle.slice(0, i);
    if (ctx.measureText(sub).width <= maxW) {
      bestCut = i;
    } else {
      break;
    }
  }
  return [rawTitle.slice(0, bestCut).trim(), rawTitle.slice(bestCut).trim()];
}

function loadImage(src: string): Promise<HTMLImageElement | ImageBitmap> {
  if (typeof Image === 'undefined') {
    return fetch(src).then(res => res.blob()).then(blob => createImageBitmap(blob));
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

/**
 * 9:16 縦型看板（1440x2560 2K超高精細）レンダリング
 */
export async function renderCoverCanvas(ep: Episode): Promise<OffscreenCanvas | HTMLCanvasElement> {
  const width = 1440;
  const height = 2560;
  const canvas = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(width, height) : document.createElement('canvas');
  if (!(canvas instanceof OffscreenCanvas)) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) throw new Error('Canvas context failed');

  const isMv = !!ep.isMvMode || (ep.titleJp || '').startsWith('🎵') || ep.productionMode === 'mv';
  const isHist = checkIsHistorical(ep.era, ep.theme);
  const palette = resolveCoverPalette(ep);

  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, width, height);

  const keyBase64 = ep.masterAnchorBase64 || ep.cuts?.[0]?.imageBase64;
  if (keyBase64) {
    try {
      const src = keyBase64.startsWith('data:') ? keyBase64 : `data:image/png;base64,${keyBase64}`;
      const img = await loadImage(src);
      const iw = (img as HTMLImageElement).width || (img as ImageBitmap).width;
      const ih = (img as HTMLImageElement).height || (img as ImageBitmap).height;
      const s = Math.max(width / iw, height / ih);
      const dw = iw * s;
      const dh = ih * s;
      const dx = (width - dw) / 2;
      const dy = (height - dh) / 2;
      ctx.drawImage(img as any, dx, dy, dw, dh);
    } catch (e) {
      console.warn('[CoverRenderer] Failed to load key visual:', e);
    }
  }

  // 映画的シネマグラデーション
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, 'rgba(5, 5, 8, 0.85)');
  bgGrad.addColorStop(0.35, 'rgba(5, 5, 8, 0.25)');
  bgGrad.addColorStop(0.65, 'rgba(5, 5, 8, 0.4)');
  bgGrad.addColorStop(1, 'rgba(5, 5, 8, 0.95)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // 看板パネルエリア
  const panelX = 80;
  const panelY = 120;
  const panelW = width - 160;
  const panelH = 540;

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 20;

  const panelGrad = ctx.createLinearGradient(panelX, panelY, panelX, panelY + panelH);
  panelGrad.addColorStop(0, palette.vPanelStart);
  panelGrad.addColorStop(1, palette.vPanelEnd);
  ctx.fillStyle = panelGrad;

  // 角丸四角形
  const r = 24;
  ctx.beginPath();
  ctx.moveTo(panelX + r, panelY);
  ctx.lineTo(panelX + panelW - r, panelY);
  ctx.arcTo(panelX + panelW, panelY, panelX + panelW, panelY + r, r);
  ctx.lineTo(panelX + panelW, panelY + panelH - r);
  ctx.arcTo(panelX + panelW, panelY + panelH, panelX + panelW - r, panelY + panelH, r);
  ctx.lineTo(panelX + r, panelY + panelH);
  ctx.arcTo(panelX, panelY + panelH, panelX, panelY + panelH - r, r);
  ctx.lineTo(panelX, panelY + r);
  ctx.arcTo(panelX, panelY, panelX + r, panelY, r);
  ctx.closePath();
  ctx.fill();

  // ボーダー線
  const borderGrad = ctx.createLinearGradient(panelX, panelY, panelX + panelW, panelY + panelH);
  borderGrad.addColorStop(0, palette.borderColors[0]);
  borderGrad.addColorStop(0.5, palette.borderColors[1]);
  borderGrad.addColorStop(1, palette.borderColors[2]);
  ctx.strokeStyle = borderGrad;
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  // 看板内テキスト
  const titleText = cleanTitle(ep.titleJp || '無題');
  ctx.save();
  ctx.textAlign = 'center';

  // バッジ
  const badgeText = isMv ? '🎵 ORIGINAL MUSIC VIDEO' : (isHist ? '🏮 時代劇シネマ' : '🎬 STUDIO PRO DIRECT');
  ctx.font = 'bold 36px sans-serif';
  ctx.fillStyle = palette.badgeColor;
  ctx.fillText(badgeText, width / 2, panelY + 90);

  // タイトル
  ctx.font = 'bold 76px sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 15;
  const lines = splitTitleForCover(titleText, ctx, panelW - 120);
  if (lines.length === 1) {
    ctx.fillText(lines[0], width / 2, panelY + 240);
  } else {
    ctx.fillText(lines[0], width / 2, panelY + 210);
    ctx.fillText(lines[1], width / 2, panelY + 310);
  }

  // サブタイトル / キャッチコピー
  const subText = ep.coverCatchphraseJp || ep.summary || '';
  if (subText) {
    ctx.font = 'bold 40px sans-serif';
    ctx.fillStyle = '#FDE047';
    ctx.shadowBlur = 10;
    const subClean = subText.length > 28 ? subText.slice(0, 27) + '…' : subText;
    ctx.fillText(subClean, width / 2, panelY + panelH - 80);
  }
  ctx.restore();

  return canvas;
}

/**
 * 16:9 横型看板（1920x1080）レンダリング
 */
export async function renderCoverCanvasHorizontal(ep: Episode): Promise<OffscreenCanvas | HTMLCanvasElement> {
  const width = 1920;
  const height = 1080;
  const canvas = (typeof OffscreenCanvas !== 'undefined') ? new OffscreenCanvas(width, height) : document.createElement('canvas');
  if (!(canvas instanceof OffscreenCanvas)) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) throw new Error('Canvas context failed');

  const palette = resolveCoverPalette(ep);
  ctx.fillStyle = '#0a0a0c';
  ctx.fillRect(0, 0, width, height);

  const keyBase64 = ep.masterAnchorBase64 || ep.cuts?.[0]?.imageBase64;
  if (keyBase64) {
    try {
      const src = keyBase64.startsWith('data:') ? keyBase64 : `data:image/png;base64,${keyBase64}`;
      const img = await loadImage(src);
      const iw = (img as HTMLImageElement).width || (img as ImageBitmap).width;
      const ih = (img as HTMLImageElement).height || (img as ImageBitmap).height;
      const s = Math.max(width / iw, height / ih);
      const dw = iw * s;
      const dh = ih * s;
      ctx.drawImage(img as any, (width - dw) / 2, (height - dh) / 2, dw, dh);
    } catch (e) {
      console.warn('[CoverRendererH] Failed to load key visual:', e);
    }
  }

  const hGrad = ctx.createLinearGradient(0, 0, width, 0);
  hGrad.addColorStop(0, palette.hPanelStart);
  hGrad.addColorStop(0.5, palette.hPanelMid);
  hGrad.addColorStop(1, palette.hPanelEnd);
  ctx.fillStyle = hGrad;
  ctx.fillRect(0, 0, width, height);

  const titleText = cleanTitle(ep.titleJp || '無題');
  ctx.save();
  ctx.textAlign = 'left';

  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = palette.badgeColor;
  ctx.fillText('FEATURE SPECIAL PRODUCTION', 120, 240);

  ctx.font = 'bold 72px sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 15;
  const lines = splitTitleForCover(titleText, ctx, 1000);
  if (lines.length === 1) {
    ctx.fillText(lines[0], 120, 360);
  } else {
    ctx.fillText(lines[0], 120, 330);
    ctx.fillText(lines[1], 120, 430);
  }

  const subText = ep.coverCatchphraseJp || ep.summary || '';
  if (subText) {
    ctx.font = 'bold 36px sans-serif';
    ctx.fillStyle = '#FDE047';
    ctx.fillText(subText.length > 35 ? subText.slice(0, 34) + '…' : subText, 120, 560);
  }
  ctx.restore();

  return canvas;
}

export async function renderCoverBase64(ep: Episode): Promise<string> {
  const canvas = await renderCoverCanvas(ep);
  if ('convertToBlob' in canvas) {
    const blob = await (canvas as OffscreenCanvas).convertToBlob({ type: 'image/jpeg', quality: 0.92 });
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }
  return (canvas as HTMLCanvasElement).toDataURL('image/jpeg', 0.92);
}

export async function renderCoverBase64Horizontal(ep: Episode): Promise<string> {
  const canvas = await renderCoverCanvasHorizontal(ep);
  if ('convertToBlob' in canvas) {
    const blob = await (canvas as OffscreenCanvas).convertToBlob({ type: 'image/jpeg', quality: 0.92 });
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });
  }
  return (canvas as HTMLCanvasElement).toDataURL('image/jpeg', 0.92);
}
