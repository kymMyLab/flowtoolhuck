import { TASTES } from '../constants';
import { TASTE_GALLERY_DATA } from '../config/tasteGalleryData';

const STORAGE_KEY = 'flowtool_custom_tastes_v12';
const OLD_STORAGE_KEYS = ['flowtool_custom_tastes_v11', 'flowtool_custom_tastes_v10', 'flowtool_custom_tastes_v9', 'flowtool_custom_tastes_v8', 'flowtool_custom_tastes_v7', 'flowtool_custom_tastes_v6', 'flowtool_custom_tastes_v5', 'flowtool_custom_tastes_v4', 'flowtool_custom_tastes_v3', 'flowtool_custom_tastes_v2', 'flowtool_custom_tastes_v1'];

const DEPRECATED_KEYS = [
  '🧪⚡ ネオ・バーチャル・ポップ (Neo Virtual Pop Anime)',
  '🎴 ネオ・エンブレム・カードアート (Modern High-End Anime Card Art)',
  '新海誠風・美麗光彩アニメ (Makoto Shinkai luminous anime)',
  'スタジオジブリ風・日常温もり手描き (Ghibli nostalgic everyday slice-of-life)'
];

export type CustomTasteMap = Record<string, string>;

export const DEFAULT_TASTES: CustomTasteMap = { ...TASTES };

function cleanTastes(rawMap: any): CustomTasteMap {
  const result: CustomTasteMap = { ...DEFAULT_TASTES };
  if (typeof rawMap === 'object' && rawMap !== null) {
    for (const [k, v] of Object.entries(rawMap)) {
      if (!DEPRECATED_KEYS.includes(k) && typeof v === 'string') {
        result[k] = v;
      }
    }
  }
  // デフォルトプリセットは最新版で上書き
  for (const [k, v] of Object.entries(DEFAULT_TASTES)) {
    result[k] = v;
  }
  for (const depKey of DEPRECATED_KEYS) {
    delete result[depKey];
  }
  return result;
}

/**
 * localStorage からカスタム画風一覧を取得（無ければデフォルト値を返却）
 */
export function loadCustomTastes(): CustomTasteMap {
  try {
    // 旧キャッシュが存在すれば新デフォルトとマージしてv12へ移行
    for (const oldKey of OLD_STORAGE_KEYS) {
      const oldRaw = localStorage.getItem(oldKey);
      if (oldRaw) {
        try {
          const oldParsed = JSON.parse(oldRaw);
          const cleaned = cleanTastes(oldParsed);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned, null, 2));
          localStorage.removeItem(oldKey);
          return cleaned;
        } catch (_) {}
        localStorage.removeItem(oldKey);
      }
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TASTES, null, 2));
      return { ...DEFAULT_TASTES };
    }
    const parsed = JSON.parse(raw);
    const cleaned = cleanTastes(parsed);
    return cleaned;
  } catch (e) {
    console.warn('Failed to load custom tastes from localStorage, fallback to defaults', e);
    return { ...DEFAULT_TASTES };
  }
}

/**
 * カスタム画風を localStorage に保存
 */
export function saveCustomTastes(tastes: CustomTasteMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tastes, null, 2));
  } catch (e) {
    console.error('Failed to save custom tastes to localStorage', e);
  }
}

/**
 * デフォルトの画風にリセット
 */
export function resetCustomTastes(): CustomTasteMap {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.error('Failed to reset custom tastes', e);
  }
  return { ...DEFAULT_TASTES };
}

/**
 * 短縮ID（例: cinematic_sky, city_pop, retro_witch）や部分名から正規の画風キー（TASTESのキー）を完全解決
 */
export function resolveTasteKey(tasteKeyOrId: string = ''): string {
  if (!tasteKeyOrId) return '';
  const trimmed = tasteKeyOrId.trim();

  // 1. すでにTASTESのキーと完全一致している場合
  if (TASTES[trimmed]) return trimmed;

  // 2. TASTE_GALLERY_DATA の id（例: cinematic_sky）または displayName と一致
  const galleryMatch = TASTE_GALLERY_DATA.find(
    t => t.id === trimmed || t.displayName === trimmed || t.tasteKey === trimmed
  );
  if (galleryMatch) return galleryMatch.tasteKey;

  // 3. 小文字・大文字無視の部分一致（例: 'cinematic', 'retro_witch', 'hokusai'）
  const lower = trimmed.toLowerCase();
  const partialGallery = TASTE_GALLERY_DATA.find(
    t => t.id.toLowerCase() === lower || t.tasteKey.toLowerCase().includes(lower)
  );
  if (partialGallery) return partialGallery.tasteKey;

  const partialKey = Object.keys(TASTES).find(k => k.toLowerCase().includes(lower));
  if (partialKey) return partialKey;

  return trimmed;
}

/**
 * 指定されたキーから画風プロンプト文字列を解決
 */
export function resolveTastePrompt(tasteKey: string, customTastes?: CustomTasteMap): string {
  if (!tasteKey) return '';
  const map = customTastes || loadCustomTastes();
  const fullKey = resolveTasteKey(tasteKey);

  return map[fullKey] || map[tasteKey] || TASTES[fullKey] || TASTES[tasteKey] || tasteKey;
}

