import { TASTES } from '../constants';

const STORAGE_KEY = 'flowtool_custom_tastes_v2';
const OLD_STORAGE_KEY = 'flowtool_custom_tastes_v1';

export type CustomTasteMap = Record<string, string>;

export const DEFAULT_TASTES: CustomTasteMap = { ...TASTES };

/**
 * localStorage からカスタム画風一覧を取得（無ければデフォルト値を返却）
 */
export function loadCustomTastes(): CustomTasteMap {
  try {
    // 旧キャッシュが存在すれば自動クリーンアップして新デフォルトへ移行
    if (localStorage.getItem(OLD_STORAGE_KEY)) {
      localStorage.removeItem(OLD_STORAGE_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TASTES, null, 2));
      return { ...DEFAULT_TASTES };
    }

    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_TASTES, null, 2));
      return { ...DEFAULT_TASTES };
    }
    const parsed = JSON.parse(raw);
    if (typeof parsed === 'object' && parsed !== null && Object.keys(parsed).length > 0) {
      return parsed;
    }
    return { ...DEFAULT_TASTES };
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
 * 指定されたキーから画風プロンプト文字列を解決
 */
export function resolveTastePrompt(tasteKey: string, customTastes?: CustomTasteMap): string {
  if (!tasteKey) return '';
  const map = customTastes || loadCustomTastes();
  return map[tasteKey] || TASTES[tasteKey] || tasteKey;
}
