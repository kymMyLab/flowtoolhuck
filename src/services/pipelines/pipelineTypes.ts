import { MutableRefObject, Dispatch, SetStateAction } from 'react';
import { Episode, Cut, GeneratorSettings, GenerationTask, SeriesManifest, VideoModelType } from '../../types';
import { LogEntry } from '../../components/StudioLogs';

export interface ProductionPipelineContext {
  settings: GeneratorSettings;
  addLog: (message: string, type?: LogEntry['type']) => void;
  logsRef?: MutableRefObject<LogEntry[] | undefined>;
  isAbortedRef: MutableRefObject<boolean>;
  episodesRef: MutableRefObject<Episode[]>;
  setEpisodes: Dispatch<SetStateAction<Episode[]>>;
  updateEpisode: (epId: number, data: Partial<Episode>) => void;
  runTasks: (tasks: GenerationTask[]) => Promise<void>;
  buildCutTasks: (ep: Episode, cuts: Cut[], styleKey?: string) => GenerationTask[];
  generateVideo: (epId: number, cutId: number, modelType: VideoModelType) => Promise<void>;
  handleBulkVideo: (epId: number) => Promise<void>;
  seriesManifestRef: MutableRefObject<SeriesManifest | null>;
  setActiveSeriesManifest: Dispatch<SetStateAction<SeriesManifest | null>>;
  activeReferenceRef: MutableRefObject<{
    mediaId: string;
    characterDna: string;
    styleDna: string;
    antiPoseNegative: string;
    eraNegative: string;
  } | null>;
  currentAssetRef: MutableRefObject<{ name: string; base64: string; mimeType: string } | null>;
}

export const SHORTS_CONFIG_MAP: Record<string, { label: string; unit: string; icon: string }> = {
  mv: { label: '音楽MV', unit: '曲', icon: '🎵' },
  trivia: { label: '衝撃雑学Shorts', unit: '本', icon: '💡' },
  quotes: { label: '偉人名言Shorts', unit: '本', icon: '📜' },
  folklore: { label: '怪異・未解決Shorts', unit: '本', icon: '👻' },
  craft: { label: '職人魂ショート', unit: '本', icon: '🏯' }
};

/**
 * 1話完了時のクリーンアップ処理（メモリリーク対策用）
 */
export function cleanupEpisodeMemory() {
  if (typeof window !== 'undefined' && (window as any).gc) {
    try { (window as any).gc(); } catch (e) {}
  }
}
