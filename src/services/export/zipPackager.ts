import JSZip from 'jszip';
import { Episode, SeriesManifest } from '../../types';
import { LogEntry } from '../../components/StudioLogs';
import { extractHighlights } from '../directorService';
import { generateSRT } from './srtGenerator';
import { renderCoverCanvas } from './coverRenderer';
import { generateSafeFilenames, savePackageFile, safeJsonStringify } from './fileDownloader';

/**
 * エピソード全体のアセット（各カット画像/動画、三面図、SRT字幕、扉絵、script.json、ログ）を同梱したZIPパッケージを作成・保存
 */
export const downloadZip = async (
  ep: Episode, 
  addLog: (msg: string, type?: any) => void, 
  manifest?: SeriesManifest,
  logs?: LogEntry[]
): Promise<{ filename: string; blobUrl: string; sizeStr: string; flowSuccess: boolean } | null> => {
  addLog(`📦 Ep.${ep.id} パッケージング中...`, 'process');
  try {
    const zip = new JSZip();
    const folder = zip.folder(`Episode_${ep.id}_Package`);
    if (!folder) throw new Error('ZIP creation failed');

    // 1. 各カット素材（Start絵、After絵/到達点フレーム、動画）をすべて同梱
    for (const c of ep.cuts) {
      // Start絵
      if (c.imageBase64) {
        try {
          const cleanImg = c.imageBase64.split('base64,').pop() || c.imageBase64;
          folder.file(`cut_${c.id}.png`, cleanImg, { base64: true });
        } catch (e) {
          console.warn(`Failed to inject start image for cut ${c.id}:`, e);
        }
      }
      // After絵（Veo補間用 到達点フレーム）
      if (c.endFrameImageBase64) {
        try {
          const cleanEndImg = c.endFrameImageBase64.split('base64,').pop() || c.endFrameImageBase64;
          folder.file(`cut_${c.id}_after.png`, cleanEndImg, { base64: true });
        } catch (e) {
          console.warn(`Failed to inject end frame image for cut ${c.id}:`, e);
        }
      }
      // 生成動画
      if (c.videoBase64) {
        try {
          const cleanVid = c.videoBase64.split('base64,').pop() || c.videoBase64;
          folder.file(`cut_${c.id}.mp4`, cleanVid, { base64: true });
        } catch (e) {
          console.warn(`Failed to inject video for cut ${c.id}:`, e);
        }
      }
      // Event loop breather to prevent UI freeze and allow GC during heavy batch exports
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // 2. キャラクター基準マスターアセット（三面図、Cut 1マスターアンカー）
    const turnaroundBase64 = ep.characterTurnaroundBase64 || manifest?.referenceAsset?.base64;
    if (turnaroundBase64) {
      try {
        const cleanTurnaround = turnaroundBase64.split('base64,').pop() || turnaroundBase64;
        folder.file('character_turnaround.png', cleanTurnaround, { base64: true });
      } catch (e) {
        console.warn('Failed to inject turnaround asset:', e);
      }
    }
    if (ep.masterAnchorBase64) {
      try {
        const cleanMaster = ep.masterAnchorBase64.split('base64,').pop() || ep.masterAnchorBase64;
        folder.file('master_anchor.png', cleanMaster, { base64: true });
      } catch (e) {
        console.warn('Failed to inject master anchor asset:', e);
      }
    }
    
    addLog(`📝 SRT字幕ファイルを生成中...`, 'info');
    folder.file('subtitles.srt', generateSRT(ep));

    if (ep.coverBase64) {
      addLog(`🖼️ 世界観適応インフォグラフィック扉絵を格納中...`, 'info');
      const cleanCover = ep.coverBase64.split('base64,').pop() || ep.coverBase64;
      folder.file('cover.png', cleanCover, { base64: true });
    } else {
      addLog(`🖼️ YouTube用超ド迫力扉絵を合成中...`, 'info');
      const coverCanvas = await renderCoverCanvas(ep);
      const coverBlob = await (coverCanvas instanceof OffscreenCanvas 
        ? coverCanvas.convertToBlob({ type: 'image/png' }) 
        : new Promise<Blob>(r => (coverCanvas as HTMLCanvasElement).toBlob(b => r(b!), 'image/png')));
      folder.file('cover.png', coverBlob);
      if (coverCanvas instanceof OffscreenCanvas) {
        const coverCtx = coverCanvas.getContext('2d');
        if (coverCtx) coverCtx.clearRect(0, 0, coverCanvas.width, coverCanvas.height);
        coverCanvas.width = 0;
        coverCanvas.height = 0;
      } else {
        const cvs = coverCanvas as HTMLCanvasElement;
        const coverCtx = cvs.getContext('2d');
        if (coverCtx) coverCtx.clearRect(0, 0, cvs.width, cvs.height);
        cvs.width = 0;
        cvs.height = 0;
      }
    }
    
    // ※未結合の各カット素材（cut_*.png / cut_*_after.png / cut_*.mp4）と完全版 script.json を同梱
    const scriptJson = {
      id: ep.id,
      productionMode: ep.productionMode || (ep.isMvMode ? 'mv' : 'episodes'),
      titleJp: ep.titleJp || '無題',
      titleEn: ep.titleEn || '',
      summary: ep.summary || '',
      theme: ep.theme || '',
      taste: ep.taste || '',
      characterDna: ep.characterDna || '',
      catchphrase: { jp: ep.coverCatchphraseJp || '', en: ep.coverCatchphraseEn || '' },
      hasTurnaround: !!ep.characterTurnaroundBase64,
      hasMasterAnchor: !!ep.masterAnchorBase64,
      historicalIntelligence: {
        eraAnalysis: ep.eraAnalysis || '',
        forbiddenAnachronisms: ep.forbiddenAnachronisms || []
      },
      cuts: ep.cuts.map(c => {
        const narration = c.narrationJp || '';

        let hl = c.telop?.highlights || [];
        if (!Array.isArray(hl) || hl.length === 0) {
            hl = extractHighlights(narration);
        }

        const safeHl = hl.map(h => ({
            word: h?.word || '',
            color: h?.color || '#FFE600',
            sizeScale: h?.sizeScale || 1.15
        })).filter(h => h.word.trim() !== '');

        const hlWords = safeHl.map(h => h.word);

        return {
          id: c.id || 1,
          dialogue: narration,
          narrationJp: narration,
          narrationEn: c.narrationEn || '',
          prompt: c.promptEn || '',
          startFramePromptEn: c.promptEn || '',
          endFramePromptEn: c.endFramePromptEn || '',
          veoMotionPrompt: c.veoMotionPrompt || '',
          isObjectOnly: !!c.isObjectOnly,
          panelLayout: c.panelLayout || 'single',
          focalPoint: c.focalPoint || null,
          compositionPrompt: c.compositionPrompt || '',
          shotScale: c.shotScale || 'Wide',
          cameraWork: c.cameraWork || 'static',
          cameraMotion: c.cameraMotion || '',
          kenBurnsPreset: c.kenBurnsPreset || 'none',
          hasStartImage: !!c.imageBase64,
          hasEndImage: !!c.endFrameImageBase64,
          hasVideo: !!c.videoBase64,
          videoModelUsed: c.videoModelUsed || '',
          telop: {
            fullText: c.telop?.fullText || narration,
            highlightKeywords: hlWords,
            highlights: safeHl,
            style: c.telop?.style || 'cinema-subtle',
            transition: c.telop?.transition || 'aos-fade-soft',
            position: c.telop?.position || 'bottom-center',
            directorNote: c.telop?.directorNote || ''
          }
        };
      })
    };

    try {
      folder.file('script.json', safeJsonStringify(scriptJson, 2));
    } catch (e: any) {
      folder.file('script.json', '{}');
    }

    if (manifest) {
      try {
        folder.file('series_manifest.json', safeJsonStringify(manifest, 2));
      } catch (e: any) {
        console.warn('series_manifest.json serialization failed, skipping manifest file', e);
      }
    }

    // ログの完全収集: 引数 logs が渡されていない場合でも、グローバルログストアから取得
    const globalLogs = (typeof window !== 'undefined' && (window as any).__STUDIO_LOGS__) || [];
    const effectiveLogs: LogEntry[] = (logs && logs.length > 0) ? logs : globalLogs;
    const logLines = effectiveLogs.map(l => (typeof l.message === 'string' ? l.message : String(l.message || '')));
    logLines.push(`[${new Date().toLocaleTimeString('ja-JP')}] 📦 パッケージング完了`);
    folder.file('production_logs.txt', logLines.join('\n'));

    addLog(`📦 ZIPアーカイブを圧縮中...`, 'process');
    // Using compression: 'STORE' to prevent massive memory spikes and crashes during large batch generation
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });

    const { asciiFilename, displayFilename } = generateSafeFilenames(ep);
    const filename = displayFilename;
    const sizeMb = (zipBlob.size / (1024 * 1024)).toFixed(1);
    const sizeStr = `${sizeMb} MB`;

    const blobUrl = URL.createObjectURL(zipBlob);
    setTimeout(() => {
      try { URL.revokeObjectURL(blobUrl); } catch (_) {}
    }, 30000); // 連続自動保存のため、30秒でメモリ解放

    // 統合保存処理を実行（ASCII安全名 asciiFilename を最優先で Flow.download に渡す）
    const saveRes = await savePackageFile(zipBlob, filename, addLog, asciiFilename);

    return { filename, blobUrl, sizeStr, flowSuccess: saveRes.success };
  } catch (err: any) { 
    addLog(`❌ ZIP生成エラー: ${err.message}`, 'error'); 
    return null;
  }
};
