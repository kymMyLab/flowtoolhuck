import { ProductionPipelineContext, cleanupEpisodeMemory } from '../../types';
import { downloadZip, downloadManifestFile } from '../export/zipPackager';
import { SeriesManifest } from '../../types';

export interface FinalizeEpisodeOptions {
  unitLabel?: string;          // '話' | '曲' | '本'
  title?: string;
  manifest?: SeriesManifest | null;
  onDownloaded?: (blobUrl: string, filename: string, sizeStr: string) => void;
}

/**
 * ── 1話完結ライフサイクル共通モジュール ──
 * 各エピソードの画像作画が完了した直後に呼び出され、
 * 「完了確定 ➔ 即時自動ダウンロード(ZIP) ➔ 履歴保存＆メモリ解放」
 * を確実に1話単位で完結させてから次のエピソードへ進む。
 */
export async function finalizeAndProcessEpisode(
  ctx: ProductionPipelineContext,
  epId: number,
  options?: FinalizeEpisodeOptions
): Promise<void> {
  const { settings, addLog, isAbortedRef, episodesRef, setEpisodes, updateEpisode } = ctx;
  const unitLabel = options?.unitLabel || '話';
  
  if (isAbortedRef.current) return;

  const currentEp = episodesRef.current.find(e => Number(e.id) === Number(epId));
  if (!currentEp) return;
  const epTitle = options?.title || currentEp.titleJp || `第${epId}${unitLabel}`;

  // 完了フラグをセット
  updateEpisode(epId, {
    isGenerating: false,
    isBatchGeneratingVideos: false,
    isPreviewDone: true,
    isDone: true
  });
  episodesRef.current = episodesRef.current.map(e => Number(e.id) === Number(epId) ? {
    ...e,
    isGenerating: false,
    isBatchGeneratingVideos: false,
    isPreviewDone: true,
    isDone: true,
    cuts: e.cuts.map(c => ({ ...c, isGeneratingVideo: false }))
  } : e);
  setEpisodes(prev => prev.map(e => Number(e.id) === Number(epId) ? {
    ...e,
    isGenerating: false,
    isBatchGeneratingVideos: false,
    isPreviewDone: true,
    isDone: true,
    cuts: e.cuts.map(c => ({ ...c, isGeneratingVideo: false }))
  } : e));

  // ── ステップ 2: マニフェスト更新（シリーズ制作の場合） ──
  const manifest = options?.manifest || ctx.seriesManifestRef?.current;
  if (manifest) {
    manifest.completedEpisodeIds = Array.from(new Set([...(manifest.completedEpisodeIds || []), epId]));
    manifest.currentEpisodeId = epId + 1;
    if (ctx.setActiveSeriesManifest) {
      ctx.setActiveSeriesManifest({ ...manifest });
    }
    if (settings.autoDownload && !isAbortedRef.current) {
      try {
        await downloadManifestFile(manifest, addLog);
      } catch (_) {}
    }
  }

  // ── ステップ 3: 完了時自動ダウンロード（1話完結で即時ZIPダウンロード！） ──
  const freshEp = episodesRef.current.find(e => Number(e.id) === Number(epId)) || currentEp;
  if (settings.autoDownload && !isAbortedRef.current) {
    addLog(`📦 【第${epId}${unitLabel}】『${epTitle}』の完了時自動ダウンロード（ZIP生成）を実行中...`, 'process');
    const currentLogs = ctx.logsRef?.current || ((typeof window !== 'undefined' && (window as any).__STUDIO_LOGS__) || []);
    try {
      const res = await downloadZip(freshEp, addLog, manifest || undefined, currentLogs);
      if (res) {
        if (freshEp.packageZipBlobUrl) {
          try { URL.revokeObjectURL(freshEp.packageZipBlobUrl); } catch (_) {}
        }
        updateEpisode(epId, {
          packageZipBlobUrl: res.blobUrl,
          packageZipFilename: res.filename,
          packageZipSizeStr: res.sizeStr
        });
        if (options?.onDownloaded) {
          options.onDownloaded(res.blobUrl, res.filename, res.sizeStr);
        }
        addLog(`💾 【第${epId}${unitLabel}】『${epTitle}』のZIPパッケージ保存が完了しました（${res.sizeStr}）！`, 'success');
      }
    } catch (zipErr) {
      console.error(`Failed to auto-download zip for episode ${epId}:`, zipErr);
      addLog(`⚠️ 第${epId}${unitLabel}の自動ダウンロード中に一時的エラーが発生しました（後から個別DL可能です）`, 'warning');
    }
  }

  cleanupEpisodeMemory();
  addLog(`🏁 【第${epId}${unitLabel}】『${epTitle}』全パイプライン完結！次へ進みます。`, 'info');
}
