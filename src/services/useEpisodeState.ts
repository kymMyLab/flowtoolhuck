import { useState, useRef, useEffect, useCallback } from 'react';
import { Episode, Cut, SeriesManifest } from '../types';

export function useEpisodeState(addLog: (msg: string, type?: any) => void) {
  const [episodes, setEpisodes] = useState<Episode[]>(() => {
    if (typeof window !== 'undefined') {
      const existing = (window as any).__STUDIO_EPISODES__ || (window as any).__STUDIO_EPISODES_BACKUP__;
      if (Array.isArray(existing) && existing.length > 0) {
        return existing;
      }
    }
    return [];
  });
  const episodesRef = useRef<Episode[]>(episodes);
  const [isProducing, setIsProducing] = useState(false);
  const isAbortedRef = useRef(false);
  const [activeSeriesManifest, setActiveSeriesManifest] = useState<SeriesManifest | null>(() => {
    if (typeof window !== 'undefined') {
      return (window as any).__STUDIO_SERIES_MANIFEST__ || null;
    }
    return null;
  });
  const seriesManifestRef = useRef<SeriesManifest | null>(activeSeriesManifest);

  useEffect(() => {
    seriesManifestRef.current = activeSeriesManifest;
    if (typeof window !== 'undefined' && activeSeriesManifest) {
      (window as any).__STUDIO_SERIES_MANIFEST__ = activeSeriesManifest;
    }
  }, [activeSeriesManifest]);

  useEffect(() => {
    episodesRef.current = episodes;
    if (typeof window !== 'undefined' && episodes.length > 0) {
      (window as any).__STUDIO_EPISODES__ = episodes;
      (window as any).__STUDIO_EPISODES_BACKUP__ = episodes;
    }
  }, [episodes]);

  // 初回マウント時に既存セッションから復元された場合はログに通知
  useEffect(() => {
    if (episodes.length > 0) {
      addLog(`🔄 前回の制作セッションから全${episodes.length}話（生成済み動画・画像含む）を自動復元・維持しました！`, 'success');
    }
  }, []);

  const updateCut = useCallback((epId: number, cutId: number, updates: Partial<Cut>) => {
    const targetEpId = Number(epId);
    const targetCutId = Number(cutId);
    // 1. 即座に episodesRef.current を同期更新（非同期ループ内の競合・古い参照を完全排除）
    episodesRef.current = episodesRef.current.map(ep =>
      Number(ep.id) === targetEpId
        ? { ...ep, cuts: ep.cuts.map(c => Number(c.id) === targetCutId ? { ...c, ...updates } : c) }
        : ep
    );
    // 2. React state を更新して UI に即座に反映
    setEpisodes(prev => prev.map(ep =>
      Number(ep.id) === targetEpId
        ? { ...ep, cuts: ep.cuts.map(c => Number(c.id) === targetCutId ? { ...c, ...updates } : c) }
        : ep
    ));
  }, []);

  const updateEpisode = useCallback((epId: number, updates: Partial<Episode>) => {
    const targetEpId = Number(epId);
    // 1. 即座に episodesRef.current を同期更新
    episodesRef.current = episodesRef.current.map(ep =>
      Number(ep.id) === targetEpId ? { ...ep, ...updates } : ep
    );
    // 2. React state を更新
    setEpisodes(prev => prev.map(ep =>
      Number(ep.id) === targetEpId ? { ...ep, ...updates } : ep
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
