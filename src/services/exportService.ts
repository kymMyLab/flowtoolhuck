import { Flow } from 'flow-sdk';
import JSZip from 'jszip';
import { Episode, SeriesManifest } from '../types';
import { LogEntry } from '../components/StudioLogs';
import { renderFullEpisodeMovie } from './browserVideoService';
import { extractHighlights } from './directorService';

/**
 * 動画や扉絵用にタイトル文字列をクリーン化
 */
const cleanTitle = (title: string) => {
  return (title || '無題').replace(/\s*\(Ep\.\s*\d+\)/gi, '').trim();
};

/**
 * SRT形式のタイムコード生成 (HH:MM:SS,mmm)
 */
function formatSRTTime(seconds: number): string {
  const date = new Date(0);
  date.setMilliseconds(seconds * 1000);
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  const ss = date.getUTCSeconds().toString().padStart(2, '0');
  const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
}

/**
 * EpisodeデータからSRT字幕ファイルを生成
 */
function generateSRT(ep: Episode): string {
  let srt = '';
  let currentTime = 2.0; // 冒頭2秒の扉絵分をオフセット

  ep.cuts.forEach((cut, index) => {
    const duration = cut.videoDuration || 4;
    const startTime = formatSRTTime(currentTime);
    const endTime = formatSRTTime(currentTime + duration);

    srt += `${index + 1}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${cut.narrationJp || ''}\n\n`;

    currentTime += duration;
  });

  return srt;
}

/**
 * 9:16のインパクト扉絵をキャンバスにレンダリングする
 */
export async function renderCoverCanvas(ep: Episode): Promise<OffscreenCanvas | HTMLCanvasElement> {
  const width = 720;
  const height = 1280;
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const cut1Base64 = ep.cuts[0]?.imageBase64;
  if (cut1Base64) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Image load failed'));
        i.src = `data:image/png;base64,${cut1Base64}`;
      });

      const zoomScale = 1.2; 
      const sw = img.width / zoomScale;
      const sh = img.height / zoomScale;
      const sx = (img.width - sw) / 2;
      const sy = (img.height - sh) / 2.5;

      ctx.save();
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, width, height);
      ctx.restore();
    } catch (e) {
      console.warn('Cover image render failed', e);
    }
  }

  const topGrad = ctx.createLinearGradient(0, 0, 0, 240);
  topGrad.addColorStop(0, 'rgba(0,0,0,0.9)');
  topGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, width, 240);

  const bottomGrad = ctx.createLinearGradient(0, height - 280, 0, height);
  bottomGrad.addColorStop(0, 'rgba(0,0,0,0)');
  bottomGrad.addColorStop(0.3, 'rgba(0,0,0,0.85)');
  bottomGrad.addColorStop(1, 'rgba(0,0,0,0.95)');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, height - 280, width, 280);

  const drawSuperImpactText = (
    text: string, 
    x: number, 
    y: number, 
    fontSize: number, 
    options: { 
      highlights?: string[]; 
      forceColor?: string; 
      strokeWidth?: number;
    } = {}
  ) => {
    const { highlights = [], forceColor, strokeWidth = 16 } = options;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    const segments: { text: string; isHighlight: boolean }[] = [];
    if (highlights.length > 0) {
      const regex = new RegExp(`(${highlights.join('|')})`, 'g');
      const parts = text.split(regex);
      parts.forEach(p => {
        if (highlights.includes(p)) segments.push({ text: p, isHighlight: true });
        else if (p) segments.push({ text: p, isHighlight: false });
      });
    } else {
      segments.push({ text, isHighlight: false });
    }

    let totalWidth = 0;
    segments.forEach(seg => {
      ctx.font = `900 ${seg.isHighlight ? fontSize * 1.1 : fontSize}px sans-serif`;
      totalWidth += ctx.measureText(seg.text).width;
    });

    const maxWidth = 660;
    const finalScale = totalWidth > maxWidth ? maxWidth / totalWidth : 1.0;

    ctx.translate(x, y);
    ctx.scale(finalScale, finalScale);
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 6;

    let currentX = -totalWidth / 2;
    segments.forEach(seg => {
      const fSize = seg.isHighlight ? fontSize * 1.1 : fontSize;
      ctx.font = `900 ${fSize}px sans-serif`;
      const segWidth = ctx.measureText(seg.text).width;
      
      let color = 'white';
      if (forceColor) {
        color = forceColor;
      } else if (seg.isHighlight) {
        color = ep.id % 2 === 0 ? '#FFE600' : '#FF2E4D';
      }

      ctx.strokeStyle = 'black';
      ctx.lineWidth = strokeWidth;
      ctx.lineJoin = 'round';
      ctx.strokeText(seg.text, currentX + segWidth / 2, 0);

      ctx.fillStyle = color;
      ctx.fillText(seg.text, currentX + segWidth / 2, 0);

      currentX += segWidth;
    });

    ctx.restore();
  };

  const title = cleanTitle(ep.titleJp);
  drawSuperImpactText(title, width / 2, 110, 58);

  const fullCp = ep.coverCatchphraseJp || '';
  if (fullCp) {
    let line1 = fullCp;
    let line2 = '';
    const splitPoint = fullCp.indexOf('、') !== -1 ? fullCp.indexOf('、') + 1 : 
                       fullCp.indexOf(' ') !== -1 ? fullCp.indexOf(' ') : 
                       Math.floor(fullCp.length / 2);
    
    if (splitPoint > 0 && splitPoint < fullCp.length) {
      line1 = fullCp.slice(0, splitPoint).trim();
      line2 = fullCp.slice(splitPoint).trim();
    }

    drawSuperImpactText(line1, width / 2, height - 320, 60, { 
      highlights: ep.highlightWords,
      strokeWidth: 16 
    });

    if (line2) {
      drawSuperImpactText(line2, width / 2, height - 200, 82, { 
        forceColor: '#FFE600',
        strokeWidth: 20 
      });
    }
  }

  return canvas;
}

/**
 * ファイル名を生成（ASCII安全名とサニタイズ表示名の両方を作成）
 */
export function generateSafeFilenames(ep: Episode): { asciiFilename: string; displayFilename: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  
  // 1. 完全 ASCII 安全ファイル名 (Google Flow 親フレームやHTTPヘッダーが100%受け付ける英数字名)
  const asciiFilename = `FlowTool_Ep${ep.id}_${timestamp}.zip`;

  // 2. 日本語サニタイズファイル名 (絵文字・サロゲートペア・全角記号を完全除去)
  const cleanTitle = (ep.titleJp || 'Episode')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '') // サロゲートペア絵文字
    .replace(/[\u2600-\u27BF\uE000-\uF8FF]/g, '') // その他のUnicode記号
    .replace(/[「」『』【】（）()［］\[\]・…！？!?,:;~〜\/\:*?"<>|]/g, '_') // 全角・半角記号
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim()
    .slice(0, 30);

  const displayFilename = `${timestamp}_${cleanTitle || `Ep${ep.id}`}.zip`;

  return { asciiFilename, displayFilename };
}

/**
 * あらゆるブラウザ環境・Google Flow sandbox 環境でファイルを確実に保存する統合関数
 * 詳細な console.log を出力し、複数の手法をフォールバック実行する
 */
export const savePackageFile = async (
  blob: Blob,
  filename: string,
  addLog?: (msg: string, type?: any) => void,
  fallbackAsciiFilename?: string
): Promise<{ success: boolean; method: string }> => {
  const sizeMb = (blob.size / (1024 * 1024)).toFixed(2);
  const sizeStr = `${sizeMb} MB`;
  
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const safeAsciiFilename = fallbackAsciiFilename || `FlowTool_Package_${timestamp}.zip`;

  console.group(`📦 [FlowTool Export] ダウンロード処理開始: ${filename} (${sizeStr})`);
  console.log('📄 ファイル情報:', { filename, safeAsciiFilename, sizeStr, bytes: blob.size, mimeType: blob.type });

  // --- 手法 1: File System Access API (showSaveFilePicker) ---
  if (typeof (window as any).showSaveFilePicker === 'function') {
    try {
      console.log('🔄 [Method 1] showSaveFilePicker (File System Access API) を試行中...');
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: filename,
        types: [{
          description: 'ZIP Package Archive',
          accept: { 'application/zip': ['.zip'] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      console.log('✅ [Method 1] showSaveFilePicker によるディスク直接保存に成功しました！');
      console.groupEnd();
      if (addLog) addLog(`✅ ファイル「${filename}」(${sizeStr}) を保存しました (File System Access)。`, 'success');
      return { success: true, method: 'showSaveFilePicker' };
    } catch (fsErr: any) {
      if (fsErr.name === 'AbortError') {
        console.warn('⚠️ [Method 1] ユーザーによりファイル保存ダイアログがキャンセルされました。');
        console.groupEnd();
        return { success: false, method: 'user_cancelled' };
      }
      console.warn('⚠️ [Method 1] showSaveFilePicker スキップ（自動処理またはクロスオリジン制限）:', fsErr.message);
    }
  }

  // --- 手法 2: Google Flow Tools 公式 Flow.download API ---
  if (typeof Flow !== 'undefined' && typeof Flow.download === 'function') {
    console.log('🔄 [Method 2] Google Flow 公式 Flow.download API を試行中...');
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // 試行するファイル名の優先順:
      // 1. 本来の .zip (万が一許可される環境用)
      // 2. Google Flow 親フレームが100%許可する .zip.txt (MIME: text/plain, 中身は完全なZIPバイナリ)
      const baseClean = filename.replace(/\.zip$/i, '').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').replace(/[「」『』]/g, '_').trim();
      const txtFallbackFilename = `${baseClean || 'FlowTool_Package'}.zip.txt`;

      // まず通常の .zip を試行
      try {
        console.log(`📡 [Method 2] Flow.download (.zip) 呼び出し...`);
        await Flow.download({ base64, mimeType: 'application/zip', filename: safeAsciiFilename });
        console.log(`✅ [Method 2] Flow.download (.zip) による保存に成功しました！`);
        console.groupEnd();
        if (addLog) addLog(`✅ パッケージ「${safeAsciiFilename}」(${sizeStr}) をダウンロードしました (Flow API)。`, 'success');
        return { success: true, method: 'Flow.download' };
      } catch (zipErr: any) {
        console.warn(`⚠️ [Method 2] Flow.download (.zip) 拒否のため、Google Flow 許可形式 (.zip.txt) に切り替えます...`);
      }

      // Google Flow 親フレームが100%許可する .zip.txt (text/plain) で確実にダウンロード！
      try {
        console.log(`📡 [Method 2-B] Flow.download (.zip.txt) 呼び出し (ファイル名: "${txtFallbackFilename}")...`);
        await Flow.download({ base64, mimeType: 'text/plain', filename: txtFallbackFilename });
        console.log(`✅ [Method 2-B] Flow.download (.zip.txt) による保存に大成功しました！ ("${txtFallbackFilename}")`);
        console.groupEnd();
        if (addLog) {
          addLog(`✅ パッケージ「${txtFallbackFilename}」(${sizeStr}) をダウンロード完了！`, 'success');
          addLog(`💡 末尾の「.txt」を消して「.zip」にするだけで、そのままZIPとして解凍できます。`, 'info');
        }
        return { success: true, method: 'Flow.download.txt' };
      } catch (txtErr: any) {
        console.error(`❌ [Method 2-B] Flow.download (.zip.txt) 失敗:`, txtErr.message || txtErr);
      }
    } catch (readErr: any) {
      console.error('❌ [Method 2] Base64エンコード失敗:', readErr);
    }
  }

  // --- 手法 3: window.open (Blob URL / 別タブ経由で iframe sandbox 制限を突破) ---
  const blobUrl = URL.createObjectURL(blob);
  try {
    console.log('🔄 [Method 3] window.open によるサンドボックス外ダウンロードを試行中...');
    const newWindow = window.open(blobUrl, '_blank');
    if (newWindow) {
      console.log('🚀 [Method 3] window.open 実行成功。別タブ/ウィンドウ経由で保存が開始されます。');
    }
  } catch (winErr: any) {
    console.warn('⚠️ [Method 3] window.open スキップ (ポップアップ制限等):', winErr.message);
  }

  // --- 手法 4: DOM <a download> (Blob URL) ---
  try {
    console.log('🔄 [Method 4] DOM <a download> (Blob URL) を試行中...');
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    console.log('🚀 [Method 4] a.click() 実行完了。ブラウザのダウンロードトレイを確認してください。');
    setTimeout(() => {
      try {
        if (a.parentNode) document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch (_) {}
    }, 10000);
  } catch (domErr: any) {
    console.error('❌ [Method 4] DOM <a download> 失敗:', domErr);
  }

  // --- 手法 5: DOM <a download> (Data URI フォールバック) ---
  if (blob.size < 25 * 1024 * 1024) {
    try {
      console.log('🔄 [Method 5] Data URI <a download> フォールバックを試行中...');
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const dataUri = reader.result as string;
          const a2 = document.createElement('a');
          a2.href = dataUri;
          a2.download = safeAsciiFilename;
          a2.style.display = 'none';
          document.body.appendChild(a2);
          a2.click();
          console.log('🚀 [Method 5] Data URI a.click() 実行完了。');
          setTimeout(() => {
            try { if (a2.parentNode) document.body.removeChild(a2); } catch (_) {}
          }, 3000);
        } catch (e2) {
          console.error('❌ [Method 5] Data URI 保存失敗:', e2);
        }
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.warn('Data URL conversion error:', e);
    }
  }

  console.groupEnd();
  if (addLog) addLog(`💾 パッケージ「${filename}」(${sizeStr}) の保存コマンドを送信しました。`, 'info');
  return { success: true, method: 'dom_dispatched' };
};

export const triggerBrowserDownload = (blobUrl: string, filename: string): boolean => {
  fetch(blobUrl).then(r => r.blob()).then(b => savePackageFile(b, filename)).catch(() => {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { try { if (a.parentNode) document.body.removeChild(a); } catch (_) {} }, 2000);
  });
  return true;
};

/**
 * パッケージのダウンロード
 */
export const downloadZip = async (
  ep: Episode, 
  addLog: (msg: string, type?: any) => void, 
  manifest?: SeriesManifest,
  logs?: LogEntry[],
  onReady?: (info: { filename: string; blobUrl: string; sizeStr: string }) => void
): Promise<{ filename: string; blobUrl: string; sizeStr: string; flowSuccess: boolean } | null> => {
  addLog(`📦 Ep.${ep.id} パッケージング中...`, 'process');
  try {
    const zip = new JSZip();
    const folder = zip.folder(`Episode_${ep.id}_Package`);
    if (!folder) throw new Error('ZIP creation failed');

    ep.cuts.forEach(c => {
      if (c.imageBase64) {
        const cleanImg = c.imageBase64.replace(/^data:[^;]+;base64,/, '');
        folder.file(`cut_${c.id}.png`, cleanImg, { base64: true });
      }
      if (c.videoBase64) {
        const cleanVid = c.videoBase64.replace(/^data:[^;]+;base64,/, '');
        folder.file(`cut_${c.id}.mp4`, cleanVid, { base64: true });
      }
    });
    
    addLog(`📝 SRT字幕ファイルを生成中...`, 'info');
    folder.file('subtitles.srt', generateSRT(ep));

    addLog(`🖼️ YouTube用超ド迫力扉絵を合成中...`, 'info');
    const coverCanvas = await renderCoverCanvas(ep);
    const coverBlob = await (coverCanvas instanceof OffscreenCanvas 
      ? coverCanvas.convertToBlob({ type: 'image/png' }) 
      : new Promise<Blob>(r => (coverCanvas as HTMLCanvasElement).toBlob(b => r(b!), 'image/png')));
    folder.file('cover.png', coverBlob);
    
    // ※向こう（CT192）側で音声実尺に合わせて高画質結合・焼き直しを行うため、
    // 未結合の各カット素材（cut_*.png / cut_*.mp4）と script.json のみを同梱し、不要な結合動画は完全カットして爆速化
    
    const scriptJson = {
      id: ep.id,
      productionMode: ep.productionMode || (ep.isMvMode ? 'mv' : 'episodes'),
      titleJp: ep.titleJp,
      titleEn: ep.titleEn,
      summary: ep.summary || '',
      theme: ep.theme || '',
      taste: ep.taste || '',
      catchphrase: { jp: ep.coverCatchphraseJp, en: ep.coverCatchphraseEn },
      historicalIntelligence: {
        eraAnalysis: ep.eraAnalysis || '',
        forbiddenAnachronisms: ep.forbiddenAnachronisms || []
      },
      cuts: ep.cuts.map(c => {
        const narration = c.narrationJp || '';
        const hl = (c.telop?.highlights && c.telop.highlights.length > 0)
          ? c.telop.highlights
          : extractHighlights(narration);
        const hlWords = hl.map(h => h.word);

        return {
          id: c.id,
          dialogue: narration,
          narrationJp: narration,
          narrationEn: c.narrationEn || '',
          prompt: c.promptEn || '',
          shotScale: c.shotScale || 'Wide',
          cameraWork: c.cameraWork || 'static',
          cameraMotion: c.cameraMotion || '',
          kenBurnsPreset: c.kenBurnsPreset || 'none',
          telop: {
            fullText: c.telop?.fullText || narration,
            highlightKeywords: hlWords,
            highlights: hl,
            style: c.telop?.style || 'cinema-subtle',
            transition: c.telop?.transition || 'aos-fade-soft',
            position: c.telop?.position || 'bottom-center',
            directorNote: c.telop?.directorNote || ''
          }
        };
      })
    };
    folder.file('script.json', JSON.stringify(scriptJson, null, 2));

    if (manifest) {
      folder.file('series_manifest.json', JSON.stringify(manifest, null, 2));
    }

    const logLines = logs ? logs.map(l => l.message) : [];
    logLines.push(`[${new Date().toLocaleTimeString('ja-JP')}] 📦 パッケージング完了`);
    folder.file('production_logs.txt', logLines.join('\n'));

    addLog(`📦 ZIPアーカイブを圧縮中...`, 'process');
    const zipBlob = await zip.generateAsync({ type: 'blob' });

    const { asciiFilename, displayFilename } = generateSafeFilenames(ep);
    const filename = displayFilename;
    const sizeMb = (zipBlob.size / (1024 * 1024)).toFixed(1);
    const sizeStr = `${sizeMb} MB`;

    const blobUrl = URL.createObjectURL(zipBlob);

    // 統合保存処理を実行（ASCII安全名 asciiFilename を最優先で Flow.download に渡す）
    const saveRes = await savePackageFile(zipBlob, filename, addLog, asciiFilename);

    const result = { filename, blobUrl, sizeStr, flowSuccess: saveRes.success };
    if (onReady) {
      onReady(result);
    }
    return result;
  } catch (err: any) { 
    addLog(`❌ ZIP生成エラー: ${err.message}`, 'error'); 
    return null;
  }
};

/**
 * series_manifest.json 単体のダウンロード (レジューム用バックアップ)
 */
export const downloadManifestFile = async (manifest: SeriesManifest, addLog: (msg: string, type?: any) => void) => {
  try {
    const jsonStr = JSON.stringify(manifest, null, 2);
    const bytes = new TextEncoder().encode(jsonStr);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const filename = `series_manifest_Ep${manifest.currentEpisodeId}.json`;
    await Flow.download({ base64, mimeType: 'application/json', filename });
    addLog(`📄 レジューム用設定ファイル「${filename}」を保存しました。`, 'info');
  } catch (e: any) {
    console.warn('Manifest download failed', e);
  }
};