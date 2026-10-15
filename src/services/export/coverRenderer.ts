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
  // 9:16 縦型看板グラデーション
  vPanelStart: string;
  vPanelEnd: string;
  // 16:9 横型看板グラデーション
  hPanelStart: string;
  hPanelMid: string;
  hPanelEnd: string;
  // アクセントボーダー [start, mid, end]
  borderColors: [string, string, string];
  // キャッチコピーリボン [start, end]
  ribbonColors: [string, string];
  // バッジ文字色
  badgeColor: string;
}

export const COVER_PALETTES: Record<string, CoverPalette> = {
  // --- 🎵 MVモード用（セッションごとに上品に変奏） ---
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
  mv_sakura: {
    id: 'mv_sakura',
    name: 'Sakura Dream (桜花スプリング・淡紅ピンク)',
    genre: 'mv',
    vPanelStart: '#1A0A14',
    vPanelEnd: '#2E1024',
    hPanelStart: 'rgba(46, 16, 36, 0.98)',
    hPanelMid: 'rgba(26, 10, 20, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#F472B6', '#FB7185', '#FDE047'],
    ribbonColors: ['#DB2777', '#9D174D'],
    badgeColor: '#F9A8D4'
  },
  mv_gold: {
    id: 'mv_gold',
    name: 'Champagne Gold (黄金アンバー・琥珀)',
    genre: 'mv',
    vPanelStart: '#140F05',
    vPanelEnd: '#261C08',
    hPanelStart: 'rgba(38, 28, 8, 0.98)',
    hPanelMid: 'rgba(20, 15, 5, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#F59E0B', '#FBBF24', '#FEF08A'],
    ribbonColors: ['#D97706', '#92400E'],
    badgeColor: '#FDE047'
  },
  mv_midnight: {
    id: 'mv_midnight',
    name: 'Midnight Aurora (極夜オーロラ・深青＆紫)',
    genre: 'mv',
    vPanelStart: '#060B1C',
    vPanelEnd: '#101538',
    hPanelStart: 'rgba(16, 21, 56, 0.98)',
    hPanelMid: 'rgba(6, 11, 28, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#38BDF8', '#818CF8', '#C084FC'],
    ribbonColors: ['#2563EB', '#4F46E5'],
    badgeColor: '#818CF8'
  },
  mv_neon_lime: {
    id: 'mv_neon_lime',
    name: 'Acid Cyber Lime (電解ネオンライム・蛍光黄緑)',
    genre: 'mv',
    vPanelStart: '#0A1405',
    vPanelEnd: '#15290A',
    hPanelStart: 'rgba(21, 41, 10, 0.98)',
    hPanelMid: 'rgba(10, 20, 5, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#84CC16', '#A3E635', '#22C55E'],
    ribbonColors: ['#65A30D', '#3F6212'],
    badgeColor: '#BEF264'
  },
  mv_monochrome: {
    id: 'mv_monochrome',
    name: 'Monochrome Platinum (漆黒モノクローム・白銀)',
    genre: 'mv',
    vPanelStart: '#0A0A0C',
    vPanelEnd: '#18181C',
    hPanelStart: 'rgba(24, 24, 28, 0.98)',
    hPanelMid: 'rgba(10, 10, 12, 0.95)',
    hPanelEnd: 'rgba(5, 5, 6, 0.9)',
    borderColors: ['#F8FAFC', '#94A3B8', '#475569'],
    ribbonColors: ['#475569', '#1E293B'],
    badgeColor: '#E2E8F0'
  },
  mv_candy: {
    id: 'mv_candy',
    name: 'Candy Future (原宿フューチャー・ピンク＆シアン)',
    genre: 'mv',
    vPanelStart: '#140514',
    vPanelEnd: '#290A29',
    hPanelStart: 'rgba(41, 10, 41, 0.98)',
    hPanelMid: 'rgba(20, 5, 20, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#EC4899', '#06B6D4', '#F43F5E'],
    ribbonColors: ['#DB2777', '#0891B2'],
    badgeColor: '#F472B6'
  },
  mv_vintage: {
    id: 'mv_vintage',
    name: 'Vintage Lo-Fi (喫茶セピア・レトロ暖色)',
    genre: 'mv',
    vPanelStart: '#160E08',
    vPanelEnd: '#2A1A10',
    hPanelStart: 'rgba(42, 26, 16, 0.98)',
    hPanelMid: 'rgba(22, 14, 8, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#D97706', '#EA580C', '#A16207'],
    ribbonColors: ['#B45309', '#78350F'],
    badgeColor: '#FDBA74'
  },
  mv_cyber_magenta: {
    id: 'mv_cyber_magenta',
    name: 'Cyberpunk Neon (サイバーパンク・電脳マゼンタ)',
    genre: 'mv',
    vPanelStart: '#180518',
    vPanelEnd: '#300B30',
    hPanelStart: 'rgba(48, 11, 48, 0.98)',
    hPanelMid: 'rgba(24, 5, 24, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#FF007F', '#D946EF', '#06B6D4'],
    ribbonColors: ['#C026D3', '#701A75'],
    badgeColor: '#F472B6'
  },
  mv_abyss_aqua: {
    id: 'mv_abyss_aqua',
    name: 'Deep Ocean Aqua (深海アクア・透光マリン)',
    genre: 'mv',
    vPanelStart: '#04121A',
    vPanelEnd: '#092534',
    hPanelStart: 'rgba(9, 37, 52, 0.98)',
    hPanelMid: 'rgba(4, 18, 26, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#06B6D4', '#22D3EE', '#38BDF8'],
    ribbonColors: ['#0891B2', '#164E63'],
    badgeColor: '#67E8F9'
  },
  mv_sunset_amethyst: {
    id: 'mv_sunset_amethyst',
    name: 'Twilight Amethyst (夕映えアメジスト・暮色バイオレット)',
    genre: 'mv',
    vPanelStart: '#180B1A',
    vPanelEnd: '#2D1432',
    hPanelStart: 'rgba(45, 20, 50, 0.98)',
    hPanelMid: 'rgba(24, 11, 26, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#C084FC', '#F43F5E', '#FB923C'],
    ribbonColors: ['#9333EA', '#581C87'],
    badgeColor: '#E879F9'
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
  trivia_teal: {
    id: 'trivia_teal',
    name: 'サイエンスティール',
    genre: 'trivia',
    vPanelStart: '#031414',
    vPanelEnd: '#072626',
    hPanelStart: 'rgba(7, 38, 38, 0.98)',
    hPanelMid: 'rgba(3, 20, 20, 0.95)',
    hPanelEnd: 'rgba(8, 8, 10, 0.9)',
    borderColors: ['#14B8A6', '#2DD4BF', '#0F766E'],
    ribbonColors: ['#0D9488', '#115E59'],
    badgeColor: '#2DD4BF'
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
  const isTrivia = mode === 'trivia' || combinedContext.includes('雑学') || combinedContext.includes('トリビア') || combinedContext.includes('科学') || combinedContext.includes('解説');
  const isManzai = mode === 'manzai' || combinedContext.includes('漫才') || combinedContext.includes('お笑い') || combinedContext.includes('寄席');

  let candidates: CoverPalette[];
  if (isMv) {
    candidates = [
      COVER_PALETTES.mv_violet,
      COVER_PALETTES.mv_cyan,
      COVER_PALETTES.mv_amber,
      COVER_PALETTES.mv_emerald,
      COVER_PALETTES.mv_crimson
    ];
  } else if (isHist) {
    candidates = [
      COVER_PALETTES.hist_gold,
      COVER_PALETTES.hist_indigo,
      COVER_PALETTES.hist_vermilion
    ];
  } else if (isTrivia) {
    candidates = [
      COVER_PALETTES.trivia_blue,
      COVER_PALETTES.trivia_teal
    ];
  } else if (isManzai) {
    candidates = [
      COVER_PALETTES.manzai_crimson
    ];
  } else {
    candidates = [
      COVER_PALETTES.cinema_indigo,
      COVER_PALETTES.cinema_purple
    ];
  }

  const seed = `${ep.theme || ''}_${ep.taste || ''}_${ep.era || ''}`;
  const idx = simpleHash(seed) % candidates.length;
  return candidates[idx];
}

/**
 * カバー用の自然なタイトル改行分割ロジック（9:16縦型・16:9横型共通）
 * 括弧、コロン、スペース、単語境界を優先し、英単語の途中でぶつ切りになるのを防ぐ
 */
export function splitTitleForCover(
  rawTitle: string, 
  ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, 
  maxW: number
): string[] {
  if (ctx.measureText(rawTitle).width <= maxW) {
    return [rawTitle];
  }

  // 1. 括弧（丸括弧、角括弧、全角半角）の前で自然に分割できるか？
  const parenRegex = /[\s　]*([(\[（【].+)$/;
  const parenMatch = rawTitle.match(parenRegex);
  if (parenMatch && parenMatch.index && parenMatch.index > 0) {
    const mainPart = rawTitle.slice(0, parenMatch.index).trim();
    const subPart = parenMatch[0].trim();
    if (ctx.measureText(mainPart).width <= maxW && ctx.measureText(subPart).width <= maxW) {
      return [mainPart, subPart];
    }
  }

  // 2. コロン、ハイフン、スラッシュなどの区切り文字で分割
  const delims = [' - ', ' — ', ' : ', ': ', ' / ', '〜', '～'];
  for (const d of delims) {
    const idx = rawTitle.indexOf(d);
    if (idx > 0 && idx < rawTitle.length - 1) {
      const p1 = rawTitle.slice(0, idx).trim();
      const p2 = rawTitle.slice(idx).trim();
      if (ctx.measureText(p1).width <= maxW && ctx.measureText(p2).width <= maxW) {
        return [p1, p2];
      }
    }
  }

  // 3. 半角スペースなどの単語区切りで、1行目に収まる限界を探す（英単語途中で切れないように）
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
      if (l1 && l2 && ctx.measureText(l2).width <= maxW) {
        return [l1, l2];
      }
    }
  }

  // 4. 日本語文字列など単語区切りがない場合：maxWに収まる最大文字数で分割（ただし末尾が半角英字なら単語境界まで巻き戻す）
  let bestCut = 1;
  for (let i = 1; i <= rawTitle.length; i++) {
    const sub = rawTitle.slice(0, i);
    if (ctx.measureText(sub).width <= maxW) {
      bestCut = i;
    } else {
      break;
    }
  }
  if (bestCut < rawTitle.length && /[a-zA-Z0-9]/.test(rawTitle[bestCut]) && /[a-zA-Z0-9]/.test(rawTitle[bestCut - 1])) {
    const lastSpace = rawTitle.lastIndexOf(' ', bestCut);
    if (lastSpace > 0) {
      bestCut = lastSpace;
    }
  }

  const l1 = rawTitle.slice(0, bestCut).trim();
  const l2 = rawTitle.slice(bestCut).trim();
  return [l1, l2];
}

/**
 * 世界観適応型 レイヤー合成インフォグラフィック扉絵（9:16特大ポスター）
 * Cut 1のキメ絵を下部に下げて配置し、上部に世界観（MV・江戸・雑学・漫才等）に応じた
 * インフォグラフィック看板プレートをドッキング合成する（物理的被りゼロ保証）
 */
export async function renderCoverCanvas(ep: Episode): Promise<OffscreenCanvas | HTMLCanvasElement> {
  const width = 1080;
  const height = 1920;
  const canvas = (typeof OffscreenCanvas !== 'undefined')
    ? new OffscreenCanvas(width, height)
    : document.createElement('canvas');
  if (!(canvas instanceof OffscreenCanvas)) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) throw new Error('Canvas context failed');

  // 世界観・モード判定（江戸に拘らずどんな画風でも動的適応）
  const isMv = !!ep.isMvMode || (ep.titleJp || '').startsWith('🎵') || ep.productionMode === 'mv';
  const isHist = checkIsHistorical(ep.era, ep.theme);
  const mode = ep.productionMode || (isMv ? 'mv' : 'episodes');
  const combinedContext = `${ep.era || ''} ${ep.theme || ''} ${mode}`.toLowerCase();
  const isTrivia = mode === 'trivia' || combinedContext.includes('雑学') || combinedContext.includes('トリビア') || combinedContext.includes('科学') || combinedContext.includes('解説');
  const isManzai = mode === 'manzai' || combinedContext.includes('漫才') || combinedContext.includes('お笑い') || combinedContext.includes('寄席');
  const isCraft = mode === 'craft' || combinedContext.includes('職人') || combinedContext.includes('工芸');

  // 背景ベース色
  ctx.fillStyle = '#08080A';
  ctx.fillRect(0, 0, width, height);

  // 1. Cut 1の確定キメ絵（またはマスターアンカー）を下部に下げて配置
  const cut1Base64 = ep.masterAnchorBase64 || ep.cuts[0]?.imageBase64;
  const headerHeight = 520; // 看板専用エリア（上部約27%）

  if (cut1Base64) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Image load failed'));
        i.src = cut1Base64.startsWith('data:') ? cut1Base64 : `data:image/png;base64,${cut1Base64}`;
      });

      // 絵を下部（headerHeight から下）にゆったり配置
      // キャラクターの顔・頭部が看板と絶対に衝突しないように、オフセット配置
      const imgTargetY = headerHeight - 40; 
      const imgTargetH = height - imgTargetY;
      const imgScale = Math.max(width / img.width, imgTargetH / img.height);
      const scaledW = img.width * imgScale;
      const scaledH = img.height * imgScale;
      const imgOffsetX = (width - scaledW) / 2;
      const imgOffsetY = imgTargetY + (imgTargetH - scaledH) / 2;

      ctx.save();
      // 上部看板エリアと境界をぼかすグラデーションマスク
      ctx.drawImage(img, imgOffsetX, imgOffsetY, scaledW, scaledH);
      
      // 暗幕グラデーション（下部の安定化 ＆ 上部看板とのシームレス接続）
      const scrim = ctx.createLinearGradient(0, headerHeight - 80, 0, headerHeight + 120);
      scrim.addColorStop(0, '#08080A');
      scrim.addColorStop(0.5, 'rgba(8, 8, 10, 0.85)');
      scrim.addColorStop(1, 'rgba(8, 8, 10, 0)');
      ctx.fillStyle = scrim;
      ctx.fillRect(0, headerHeight - 80, width, 200);

      // 底部シネマシャドウ
      const bottomScrim = ctx.createLinearGradient(0, height - 250, 0, height);
      bottomScrim.addColorStop(0, 'rgba(8, 8, 10, 0)');
      bottomScrim.addColorStop(1, 'rgba(8, 8, 10, 0.95)');
      ctx.fillStyle = bottomScrim;
      ctx.fillRect(0, height - 250, width, 250);

      ctx.restore();
    } catch (e) {
      console.warn('Cover image render fallback', e);
    }
  }

  // 2. 最上部ヘッダー（特大インフォグラフィック看板プレート）
  ctx.save();
  const palette = resolveCoverPalette(ep);
  
  // 看板ベースプレート（グラスモーフィズム高級パネル）
  const panelGrad = ctx.createLinearGradient(0, 0, 0, headerHeight);
  panelGrad.addColorStop(0, palette.vPanelStart);
  panelGrad.addColorStop(1, palette.vPanelEnd);
  ctx.fillStyle = panelGrad;
  ctx.fillRect(0, 0, width, headerHeight);

  // 金・銀・ネオンの装飾アクセントボーダー（下部境界ライン）
  const borderGrad = ctx.createLinearGradient(0, 0, width, 0);
  borderGrad.addColorStop(0, palette.borderColors[0]);
  borderGrad.addColorStop(0.5, palette.borderColors[1]);
  borderGrad.addColorStop(1, palette.borderColors[2]);
  ctx.fillStyle = borderGrad;
  ctx.fillRect(0, headerHeight - 4, width, 4);

  // 3. 看板内テキストのレイアウト（超ド迫力・完全被りゼロ）
  
  // A. トップバッジ（話数 または ジャンルバッジ）
  const badgeY = 70;
  const epLabel = isMv 
    ? '🎵 OFFICIAL MUSIC VIDEO' 
    : isTrivia 
    ? '💡 歴史・雑学アカデミー' 
    : isManzai 
    ? '🎙️ 爆笑！上方・江戸寄席' 
    : isHist 
    ? `🏮 時代劇長編大作 [第${ep.id}幕]` 
    : `🎬 STUDIO PRO PRODUCTION [EPISODE ${ep.id}]`;

  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = palette.badgeColor;
  ctx.fillText(epLabel, width / 2, badgeY);

  // B. メインタイトル（超極太・大迫力2行折り返し対応）
  const cleanEpTitle = cleanTitle(ep.titleJp || '無題');
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 16;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 4;

  let titleFontSize = 68;
  if (cleanEpTitle.length > 18) titleFontSize = 54;
  if (cleanEpTitle.length > 26) titleFontSize = 46;
  ctx.font = `900 ${titleFontSize}px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif`;

  // タイトルが長い場合はスマート2行分割（括弧・単語境界・区切り記号を優先）
  const maxTitleWidth = width - 120;
  const titleLines = splitTitleForCover(cleanEpTitle, ctx, maxTitleWidth);
  if (titleLines.length === 1) {
    ctx.fillText(titleLines[0], width / 2, 200);
  } else {
    ctx.fillText(titleLines[0], width / 2, 175);
    ctx.fillText(titleLines[1], width / 2, 175 + titleFontSize + 12);
  }

  // C. 英語サブタイトル
  if (ep.titleEn) {
    ctx.font = '600 22px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.65)';
    ctx.shadowBlur = 4;
    ctx.fillText(ep.titleEn.toUpperCase(), width / 2, 275);
  }

  // D. キャッチコピー大型リボン（帯プレート）
  const catchphrase = ep.coverCatchphraseJp || ep.summary?.slice(0, 36) || '時代を駆け抜けた魂の物語';
  const ribbonY = 320;
  const ribbonH = 76;
  const ribbonW = width - 100;
  const ribbonX = (width - ribbonW) / 2;

  // リボン背景
  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 8;
  
  const ribbonGrad = ctx.createLinearGradient(ribbonX, ribbonY, ribbonX + ribbonW, ribbonY);
  ribbonGrad.addColorStop(0, palette.ribbonColors[0]);
  ribbonGrad.addColorStop(1, palette.ribbonColors[1]);
  ctx.fillStyle = ribbonGrad;
  
  // 角丸四角形
  const r = 16;
  ctx.beginPath();
  ctx.moveTo(ribbonX + r, ribbonY);
  ctx.lineTo(ribbonX + ribbonW - r, ribbonY);
  ctx.quadraticCurveTo(ribbonX + ribbonW, ribbonY, ribbonX + ribbonW, ribbonY + r);
  ctx.lineTo(ribbonX + ribbonW, ribbonY + ribbonH - r);
  ctx.quadraticCurveTo(ribbonX + ribbonW, ribbonY + ribbonH, ribbonX + ribbonW - r, ribbonY + ribbonH);
  ctx.lineTo(ribbonX + r, ribbonY + ribbonH);
  ctx.quadraticCurveTo(ribbonX, ribbonY + ribbonH, ribbonX, ribbonY + ribbonH - r);
  ctx.lineTo(ribbonX, ribbonY + r);
  ctx.quadraticCurveTo(ribbonX, ribbonY, ribbonX + r, ribbonY);
  ctx.closePath();
  ctx.fill();

  // リボン枠線
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.stroke();
  ctx.restore();

  // キャッチコピー文字
  ctx.font = 'bold 30px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
  ctx.shadowBlur = 8;
  ctx.fillText(`“ ${catchphrase} ”`, width / 2, ribbonY + 48);

  // E. メタデータタグ群（時代・テーマ・テイスト）
  const tagsY = 440;
  const tags: string[] = [];
  if (ep.era) tags.push(ep.era);
  if (ep.theme) tags.push(ep.theme);
  if (ep.taste) tags.push(ep.taste);
  if (isMv) tags.push('4K CINEMATIC MV');

  if (tags.length > 0) {
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    const tagString = tags.map(t => `#${t}`).join('   •   ');
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 4;
    ctx.fillText(tagString, width / 2, tagsY);
  }

  // 4. 最下部フッター（ブランド透かし ＆ 著作権表示）
  ctx.font = '600 18px monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.textAlign = 'center';
  ctx.fillText('STUDIO PRO PRODUCTION  |  ULTRA DIRECT CINEMA', width / 2, height - 35);
  ctx.restore();

  return canvas;
}

/**
 * 横型看板（16:9, 1920x1080）
 * YouTube通常動画サムネイル・Media Vault横型看板用
 * 左側にシネマインフォグラフィック看板、右側にキメ絵をシームレス融合配置
 */
export async function renderCoverCanvasHorizontal(ep: Episode): Promise<OffscreenCanvas | HTMLCanvasElement> {
  const width = 1920;
  const height = 1080;
  const canvas = (typeof OffscreenCanvas !== 'undefined')
    ? new OffscreenCanvas(width, height)
    : document.createElement('canvas');
  if (!(canvas instanceof OffscreenCanvas)) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) throw new Error('Canvas context failed');

  // 世界観・モード判定
  const isMv = !!ep.isMvMode || (ep.titleJp || '').startsWith('🎵') || ep.productionMode === 'mv';
  const isHist = checkIsHistorical(ep.era, ep.theme);
  const mode = ep.productionMode || (isMv ? 'mv' : 'episodes');
  const combinedContext = `${ep.era || ''} ${ep.theme || ''} ${mode}`.toLowerCase();
  const isTrivia = mode === 'trivia' || combinedContext.includes('雑学') || combinedContext.includes('トリビア') || combinedContext.includes('科学') || combinedContext.includes('解説');
  const isManzai = mode === 'manzai' || combinedContext.includes('漫才') || combinedContext.includes('お笑い') || combinedContext.includes('寄席');

  // 背景ベース色
  ctx.fillStyle = '#08080A';
  ctx.fillRect(0, 0, width, height);

  // 1. 右側：キメ絵（またはマスターアンカー）を配置
  const cut1Base64 = ep.masterAnchorBase64 || ep.cuts[0]?.imageBase64;
  const textPanelWidth = 840; // 左側文字エリア幅

  if (cut1Base64) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Image load failed'));
        i.src = cut1Base64.startsWith('data:') ? cut1Base64 : `data:image/png;base64,${cut1Base64}`;
      });

      const imgTargetX = 640;
      const imgTargetW = width - imgTargetX;
      const imgScale = Math.max(imgTargetW / img.width, height / img.height);
      const scaledW = img.width * imgScale;
      const scaledH = img.height * imgScale;
      const imgOffsetX = imgTargetX + (imgTargetW - scaledW) / 2;
      const imgOffsetY = (height - scaledH) / 2;

      ctx.save();
      ctx.drawImage(img, imgOffsetX, imgOffsetY, scaledW, scaledH);

      // 左側文字エリアとのブレンド暗幕グラデーション（右向きフェード）
      const leftFade = ctx.createLinearGradient(imgTargetX - 100, 0, imgTargetX + 450, 0);
      leftFade.addColorStop(0, '#08080A');
      leftFade.addColorStop(0.4, 'rgba(8, 8, 10, 0.92)');
      leftFade.addColorStop(0.8, 'rgba(8, 8, 10, 0.4)');
      leftFade.addColorStop(1, 'rgba(8, 8, 10, 0)');
      ctx.fillStyle = leftFade;
      ctx.fillRect(imgTargetX - 100, 0, 550, height);

      // 上下シネマシャドウ
      const topBottomScrim = ctx.createLinearGradient(0, 0, 0, 160);
      topBottomScrim.addColorStop(0, 'rgba(8, 8, 10, 0.85)');
      topBottomScrim.addColorStop(1, 'rgba(8, 8, 10, 0)');
      ctx.fillStyle = topBottomScrim;
      ctx.fillRect(imgTargetX, 0, imgTargetW, 160);

      const btmScrim = ctx.createLinearGradient(0, height - 160, 0, height);
      btmScrim.addColorStop(0, 'rgba(8, 8, 10, 0)');
      btmScrim.addColorStop(1, 'rgba(8, 8, 10, 0.85)');
      ctx.fillStyle = btmScrim;
      ctx.fillRect(imgTargetX, height - 160, imgTargetW, 160);

      ctx.restore();
    } catch (e) {
      console.warn('Horizontal cover image render fallback', e);
    }
  }

  // 2. 左側：高級看板プレート（背景グラデーション）
  ctx.save();
  const palette = resolveCoverPalette(ep);
  const panelGrad = ctx.createLinearGradient(0, 0, textPanelWidth, 0);
  panelGrad.addColorStop(0, palette.hPanelStart);
  panelGrad.addColorStop(0.8, palette.hPanelMid);
  panelGrad.addColorStop(1, palette.hPanelEnd);
  ctx.fillStyle = panelGrad;
  ctx.fillRect(0, 0, textPanelWidth, height);

  // 境界アクセントライン
  const lineGrad = ctx.createLinearGradient(0, 0, 0, height);
  lineGrad.addColorStop(0, palette.borderColors[0]);
  lineGrad.addColorStop(0.5, palette.borderColors[1]);
  lineGrad.addColorStop(1, palette.borderColors[2]);
  ctx.fillStyle = lineGrad;
  ctx.fillRect(textPanelWidth - 4, 0, 4, height);

  // 3. 左側タイポグラフィレイアウト
  const leftMargin = 80;

  // A. モード＆エピソードバッジ
  ctx.save();
  const badgeY = 110;
  const badgeText = isMv ? '🎵 CINEMATIC MUSIC VIDEO' : isHist ? '📜 HISTORICAL DRAMA' : isTrivia ? '💡 KNOWLEDGE SHORTS' : isManzai ? '🎙️ COMEDY MANZAI' : '🎬 EPISODIC CINEMA';
  ctx.font = '900 18px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
  ctx.fillStyle = palette.badgeColor;
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 8;
  ctx.fillText(badgeText, leftMargin, badgeY);

  const epBadgeText = `EPISODE ${String(ep.id).padStart(2, '0')}`;
  ctx.font = '800 16px monospace';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(`|   ${epBadgeText}`, leftMargin + ctx.measureText(badgeText).width + 20, badgeY);
  ctx.restore();

  // B. メインタイトル（特大・2行まで自動分割）
  ctx.save();
  const rawTitle = cleanTitle(ep.titleJp || '無題');
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;

  let titleFontSize = 64;
  if (rawTitle.length > 24) titleFontSize = 44;
  else if (rawTitle.length > 16) titleFontSize = 50;
  else if (rawTitle.length > 10) titleFontSize = 56;
  ctx.font = `900 ${titleFontSize}px "Hiragino Mincho ProN", "Yu Mincho", serif`;

  const maxTitleW = textPanelWidth - leftMargin - 60;
  const titleY = 240;

  // スマートタイトル分割（括弧・単語境界・区切り記号を優先して美しく改行）
  const titleLines = splitTitleForCover(rawTitle, ctx, maxTitleW);
  if (titleLines.length === 1) {
    ctx.fillText(titleLines[0], leftMargin, titleY);
  } else {
    ctx.fillText(titleLines[0], leftMargin, titleY - 20);
    ctx.fillText(titleLines[1], leftMargin, titleY + titleFontSize + 5);
  }
  ctx.restore();

  // C. キャッチコピーリボン
  const catchphrase = ep.coverCatchphraseJp || ep.summary || '';
  if (catchphrase) {
    ctx.save();
    const ribbonY = 460;
    const ribbonH = 70;
    const ribbonW = textPanelWidth - leftMargin - 60;

    const rGrad = ctx.createLinearGradient(leftMargin, ribbonY, leftMargin + ribbonW, ribbonY);
    rGrad.addColorStop(0, palette.ribbonColors[0]);
    rGrad.addColorStop(1, palette.ribbonColors[1]);
    ctx.fillStyle = rGrad;
    ctx.beginPath();
    ctx.roundRect(leftMargin, ribbonY, ribbonW, ribbonH, 14);
    ctx.fill();

    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.stroke();

    ctx.font = 'bold 24px "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 8;
    const cleanCatch = catchphrase.length > 28 ? catchphrase.slice(0, 27) + '…' : catchphrase;
    ctx.fillText(`“ ${cleanCatch} ”`, leftMargin + ribbonW / 2, ribbonY + 45);
    ctx.restore();
  }

  // D. メタデータタグ群（右側画像領域への突き抜けを完全防止）
  ctx.save();
  const tagsY = 620;
  const rawTags: string[] = [];
  if (ep.era) rawTags.push(ep.era);
  if (ep.theme) rawTags.push(ep.theme);
  if (ep.taste) rawTags.push(ep.taste);
  if (isMv) rawTags.push('4K CINEMATIC MV');

  // 長大なプロンプト補足（括弧やカンマ）をクリーンアップし、すっきりした商用ハッシュタグにする
  const cleanTags = rawTags.map(t => {
    const stripped = t.replace(/[\(（].*?[\)）]/g, '').trim();
    return stripped.length > 16 ? stripped.slice(0, 15) + '…' : stripped;
  }).filter(t => t.length > 0);

  if (cleanTags.length > 0) {
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.shadowBlur = 4;
    
    // maxTitleW を超えないよう動的に調整
    const maxTagW = textPanelWidth - leftMargin - 60;
    const separator = '   •   ';
    let tagString = cleanTags.map(t => `#${t}`).join(separator);
    
    while (ctx.measureText(tagString).width > maxTagW && cleanTags.length > 1) {
      cleanTags.pop();
      tagString = cleanTags.map(t => `#${t}`).join(separator);
    }
    if (ctx.measureText(tagString).width > maxTagW) {
      while (ctx.measureText(tagString).width > maxTagW && tagString.length > 5) {
        tagString = tagString.slice(0, -2) + '…';
      }
    }
    
    ctx.fillText(tagString, leftMargin, tagsY);
  }
  ctx.restore();

  // E. 最下部ブランド透かし
  ctx.save();
  ctx.font = '600 16px monospace';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.textAlign = 'left';
  ctx.fillText('STUDIO PRO PRODUCTION  |  16:9 MASTER COVER', leftMargin, height - 60);
  ctx.restore();

  return canvas;
}

/**
 * 扉絵（縦型 9:16）をBase64文字列（PNG）として取得
 */
export async function renderCoverBase64(ep: Episode): Promise<string> {
  const canvas = await renderCoverCanvas(ep);
  return canvasToBase64(canvas);
}

/**
 * 扉絵（横型 16:9）をBase64文字列（PNG）として取得
 */
export async function renderCoverBase64Horizontal(ep: Episode): Promise<string> {
  const canvas = await renderCoverCanvasHorizontal(ep);
  return canvasToBase64(canvas);
}

async function canvasToBase64(canvas: OffscreenCanvas | HTMLCanvasElement): Promise<string> {
  try {
    if (canvas instanceof OffscreenCanvas) {
      const blob = await canvas.convertToBlob({ type: 'image/png' });
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const res = reader.result as string;
          resolve(res.split('base64,').pop() || res);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } else {
      const res = (canvas as HTMLCanvasElement).toDataURL('image/png');
      return res.split('base64,').pop() || res;
    }
  } finally {
    if (canvas instanceof OffscreenCanvas) {
      const coverCtx = canvas.getContext('2d');
      if (coverCtx) coverCtx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    } else {
      const cvs = canvas as HTMLCanvasElement;
      const coverCtx = cvs.getContext('2d');
      if (coverCtx) coverCtx.clearRect(0, 0, cvs.width, cvs.height);
      cvs.width = 0;
      cvs.height = 0;
    }
  }
}

