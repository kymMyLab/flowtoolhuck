import { TASTES } from '../constants';

export function resolveTasteKey(tasteKeyOrId: string = ''): string {
  if (!tasteKeyOrId) return '';
  const trimmed = tasteKeyOrId.trim();
  if (TASTES[trimmed]) return trimmed;

  const lower = trimmed.toLowerCase();
  const partialKey = Object.keys(TASTES).find(
    k => k.split(' (')[0] === trimmed || k.toLowerCase().includes(lower)
  );
  return partialKey || trimmed;
}

export function resolveTastePrompt(tasteKey: string): string {
  if (!tasteKey) return '';
  const fullKey = resolveTasteKey(tasteKey);
  return TASTES[fullKey] || TASTES[tasteKey] || tasteKey;
}
