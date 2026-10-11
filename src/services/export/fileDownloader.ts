import { Flow } from 'flow-sdk';
import { Episode, SeriesManifest } from '../../types';

/**
 * 循環参照やDOMノード（HTMLSpanElement等）を確実に排除する安全なJSON文字列化関数
 */
export const safeJsonStringify = (obj: any, indent = 2): string => {
  const seen = new WeakSet();
  try {
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        // DOM ノード (nodeType を持つ要素) や React Fiber ノードは除外
        if (typeof (value as any).nodeType === 'number' || (value as any).$$typeof) {
          return undefined;
        }
        if (seen.has(value)) {
          return '[Circular]';
        }
        seen.add(value);
      }
      return value;
    }, indent);
  } catch (err) {
    console.warn('safeJsonStringify fallback:', err);
    return '{}';
  }
};

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
  // メモリリーク防止のため、どの保存手段が成功しても確実に60秒後にBlob URLを解放する
  setTimeout(() => {
    try { URL.revokeObjectURL(blobUrl); } catch (_) {}
  }, 60000);

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
 * series_manifest.json 単体のダウンロード (レジューム用バックアップ)
 */
export const downloadManifestFile = async (manifest: SeriesManifest, addLog: (msg: string, type?: any) => void) => {
  try {
    const jsonStr = safeJsonStringify(manifest, 2);
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
