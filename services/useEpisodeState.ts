import { useState, useRef, useEffect, useCallback } from 'react';
import { Episode, Cut, SeriesManifest } from '../types';

export function useEpisodeState(addLog: (msg: string, type?: any) => void) {
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const episodesRef = useRef<Episode[]>([]);
  const [isProducing, setIsProducing] = useState(false);
  const isAbortedRef = useRef(false);
  const [activeSeriesManifest, setActiveSeriesManifest] = useState<SeriesManifest | null>(null);
  const seriesManifestRef = useRef<SeriesManifest | null>(null);

  useEffect(() => {
    episodesRef.current = episodes;
  }, [episodes]);

  const updateCut = useCallback((epId: number, cutId: number, updates: Partial<Cut>) => {
    // 1. 即座に episodesRef.current を同期更新（非同期ループ内の競合・古い参照を完全排除）
    episodesRef.current = episodesRef.current.map(ep =>
      ep.id === epId
        ? { ...ep, cuts: ep.cuts.map(c => c.id === cutId ? { ...c, ...updates } : c) }
        : ep
    );
    // 2. React state を更新して UI に即座に反映
    setEpisodes(prev => prev.map(ep =>
      ep.id === epId
        ? { ...ep, cuts: ep.cuts.map(c => c.id === cutId ? { ...c, ...updates } : c) }
        : ep
    ));
  }, []);

  const updateEpisode = useCallback((epId: number, updates: Partial<Episode>) => {
    // 1. 即座に episodesRef.current を同期更新
    episodesRef.current = episodesRef.current.map(ep =>
      ep.id === epId ? { ...ep, ...updates } : ep
    );
    // 2. React state を更新
    setEpisodes(prev => prev.map(ep =>
      ep.id === epId ? { ...ep, ...updates } : ep
    ));
  }, []);

  const clearEpisodes = useCallback(() => {
    episodesRef.current = [];
    setEpisodes([]);
    setActiveSeriesManifest(null);
    seriesManifestRef.current = null;
    addLog('🧹 制作データを全消去しました。', 'info');
  }, [addLog]);

  const abortProduction = useCallback(() => {
    isAbortedRef.current = true;
    setIsProducing(false);
    addLog('🛑 制作プロセスを中断しました。', 'warning');
  }, [addLog]);

  return {
    episodes,
    setEpisodes,
    episodesRef,
    isProducing,
    setIsProducing,
    isAbortedRef,
    activeSeriesManifest,
    setActiveSeriesManifest,
    seriesManifestRef,
    updateCut,
    updateEpisode,
    clearEpisodes,
    abortProduction
  };
}
