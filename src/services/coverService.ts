import { Episode } from '../types';
/**
 * 動画や扉絵用にタイトル文字列をクリーン化
 */
export const cleanTitle = (title: string): string => {
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
  }
};
/**
 * AIが世界観に合わせて直接看板を描き込んだ9:16縦ロング扉絵イラストのBase64を取得
 */
export async function getCleanCoverBase64(ep: Episode): Promise<string | null> {
  const raw = ep.coverBase64 || ep.masterAnchorBase64 || ep.cuts?.[0]?.imageBase64;
  if (!raw) return null;
  return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
}
/**
 * AIが世界観に合わせて直接看板を描き込んだ16:9横型マスターカバー（横動画サムネイル）イラストのBase64を取得
 */
export async function getCleanCoverBase64Horizontal(ep: Episode): Promise<string | null> {
  const raw = ep.coverHorizontalBase64 || ep.masterAnchorBase64 || ep.cuts?.[0]?.imageBase64;
  if (!raw) return null;
  return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`;
}
/**
 * 縦型扉絵: 暗いフィルター合成を廃止し、生成イラストをそのまま返却
 */
export async function renderCoverBase64(ep: Episode): Promise<string> {
  const cleanUri = await getCleanCoverBase64(ep);
  if (cleanUri) return cleanUri;
  return '';
}
/**
 * 横型16:9マスターカバー: 暗いフィルターや2重文字描画を廃止し、生成された明るい16:9イラストをそのまま返却
 */
export async function renderCoverBase64Horizontal(ep: Episode): Promise<string> {
  const cleanUri = await getCleanCoverBase64Horizontal(ep);
  if (cleanUri) return cleanUri;
  // 16:9がまだ無ければ縦扉絵をフォールバック
  return await renderCoverBase64(ep);
}

