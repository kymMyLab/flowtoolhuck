import { 
  MV_THEMES, 
  TRIVIA_THEMES, 
  QUOTES_THEMES, 
  FOLKLORE_THEMES, 
  CRAFT_THEMES 
} from '../config/studioDefinitions';
import { THEMES } from '../constants';
import { ProductionMode } from '../types';

const STORAGE_KEY = 'flowtool_custom_themes_v1';

export type CustomThemeMap = Record<string, string[]>;

export const DEFAULT_THEME_MAP: CustomThemeMap = {
  mv: [...MV_THEMES],
  trivia: [...TRIVIA_THEMES],
  quotes: [...QUOTES_THEMES],
  folklore: [...FOLKLORE_THEMES],
  craft: [...CRAFT_THEMES],
  episodes: [...THEMES],
  'style-matrix': [...THEMES],
};

/**
 * localStorage からカスタムテーマを取得（無ければデフォルト値を返却）
 */
export function loadCustomThemes(): CustomThemeMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_THEME_MAP };
    const parsed = JSON.parse(raw);
    return {
      mv: Array.isArray(parsed.mv) && parsed.mv.length > 0 ? parsed.mv : [...MV_THEMES],
      trivia: Array.isArray(parsed.trivia) && parsed.trivia.length > 0 ? parsed.trivia : [...TRIVIA_THEMES],
      quotes: Array.isArray(parsed.quotes) && parsed.quotes.length > 0 ? parsed.quotes : [...QUOTES_THEMES],
      folklore: Array.isArray(parsed.folklore) && parsed.folklore.length > 0 ? parsed.folklore : [...FOLKLORE_THEMES],
      craft: Array.isArray(parsed.craft) && parsed.craft.length > 0 ? parsed.craft : [...CRAFT_THEMES],
      episodes: Array.isArray(parsed.episodes) && parsed.episodes.length > 0 ? parsed.episodes : [...THEMES],
      'style-matrix': Array.isArray(parsed['style-matrix']) && parsed['style-matrix'].length > 0 ? parsed['style-matrix'] : [...THEMES],
    };
  } catch (e) {
    console.warn('Failed to load custom themes from localStorage, fallback to defaults', e);
    return { ...DEFAULT_THEME_MAP };
  }
}

/**
 * 特定モードまたは全モードのテーマを localStorage に保存
 */
export function saveCustomThemes(themes: CustomThemeMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(themes));
  } catch (e) {
    console.error('Failed to save custom themes to localStorage', e);
  }
}

/**
 * 特定のモードのテーマを上書き保存
 */
export function saveModeThemes(mode: string, themeList: string[]): CustomThemeMap {
  const current = loadCustomThemes();
  const cleaned = themeList.map(t => t.trim()).filter(Boolean);
  const updated: CustomThemeMap = {
    ...current,
    [mode]: cleaned.length > 0 ? cleaned : (DEFAULT_THEME_MAP[mode] || [...THEMES])
  };
  saveCustomThemes(updated);
  return updated;
}

/**
 * デフォルトにリセット
 */
export function resetModeThemes(mode: string): CustomThemeMap {
  const current = loadCustomThemes();
  const updated: CustomThemeMap = {
    ...current,
    [mode]: [...(DEFAULT_THEME_MAP[mode] || [...THEMES])]
  };
  saveCustomThemes(updated);
  return updated;
}
