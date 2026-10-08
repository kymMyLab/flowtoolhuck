import { Flow } from 'flow-sdk';
import JSZip from 'jszip';
import { Episode, SeriesManifest } from '../types';
import { LogEntry } from '../components/StudioLogs';
import { renderFullEpisodeMovie } from './browserVideoService';
import { extractHighlights, checkIsHistorical } from './directorService';

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
 * 世界観適応型 レイヤー合成インフォグラフィック扉絵（9:16特大ポスター）
 * Cut 1のキメ絵を下部に下げて配置し、上部に世界観（MV・江戸・雑学・漫才等）に応じた
 * インフォグラフィック看板プレートをドッキング合成する（物理的被りゼロ保証）
 */
export async function renderCoverCanvas(ep: Episode): Promise<OffscreenCanvas | HTMLCanvasElement> {
  const width = 1080;
  const height = 1920;
  const canvas = (typeof OffscreenCanvas !== 'undefined')
    ? new OffscreenCanvas(width, height)
    : document.createElement('canvas');
  if (!(canvas instanceof OffscreenCanvas)) {
    canvas.width = width;
    canvas.height = height;
  }
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
  if (!ctx) throw new Error('Canvas context failed');

  // 世界観・モード判定（江戸に拘らずどんな画風でも動的適応）
  const isMv = !!ep.isMvMode || (ep.titleJp || '').startsWith('🎵') || ep.productionMode === 'mv';
  const isHist = checkIsHistorical(ep.era, ep.theme);
  const mode = ep.productionMode || (isMv ? 'mv' : 'episodes');
  const combinedContext = `${ep.era || ''} ${ep.theme || ''} ${mode}`.toLowerCase();
  const isTrivia = mode === 'trivia' || combinedContext.includes('雑学') || combinedContext.includes('トリビア') || combinedContext.includes('科学') || combinedContext.includes('解説');
  const isManzai = mode === 'manzai' || combinedContext.includes('漫才') || combinedContext.includes('お笑い') || combinedContext.includes('寄席');
  const isCraft = mode === 'craft' || combinedContext.includes('職人') || combinedContext.includes('工芸');

  // 背景ベース色
  ctx.fillStyle = '#08080A';
  ctx.fillRect(0, 0, width, height);

  // 1. Cut 1の確定キメ絵（またはマスターアンカー）を下部に下げて配置
  const cut1Base64 = ep.masterAnchorBase64 || ep.cuts[0]?.imageBase64;
  const headerHeight = 520; // 看板専用エリア（上部約27%）

  if (cut1Base64) {
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.crossOrigin = "anonymous";
        i.onload = () => resolve(i);
        i.onerror = () => reject(new Error('Image load failed'));
        i.src = cut1Base64.startsWith('data:') ? cut1Base64 : `data:image/png;base64,${cut1Base64}`;
      });

      // 絵を下部（headerHeight から下）にゆったり配置
      // キャラクターの顔・頭部が看板と絶対に衝突しないように、オフセット配置
      const availableH = height - headerHeight + 100;
      const scale = Math.max(width / img.width, availableH / img.height);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const drawX = (width - drawW) / 2;
      const drawY = headerHeight - 40; // 看板の真下からスタート

      ctx.save();
      ctx.drawImage(img, drawX, drawY, drawW, drawH);
      ctx.restore();
    } catch (e) {
      console.warn('Cover image render failed', e);
    }
  }

  // 2. 看板とイラストの接合部（シャドウ＆フェードブレンド）
  const seamGrad = ctx.createLinearGradient(0, headerHeight - 60, 0, headerHeight + 120);
  seamGrad.addColorStop(0, 'rgba(0,0,0,0.85)');
  seamGrad.addColorStop(0.4, 'rgba(0,0,0,0.4)');
  seamGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = seamGrad;
  ctx.fillRect(0, headerHeight - 60, width, 180);

  // 3. 上部インフォグラフィック看板プレートの描画（上部 0 〜 headerHeight）
  // ── 世界観に応じた看板テーマパレット ──
  let plateBgGradient: CanvasGradient;
  let borderColor = '#E0A96D';
  let badgeText = '';
  let badgeBg = 'rgba(255,255,255,0.15)';
  let badgeColor = '#FFF';
  let titleColor = '#FFFFFF';
  let titleStroke = '#000000';
  let accentColor = '#FFE600';
  let subPlateBg = 'rgba(0,0,0,0.6)';

  if (isHist) {
    // 【江戸・歴史】和紙・墨・家紋調
    plateBgGradient = ctx.createLinearGradient(0, 0, 0, headerHeight);
    plateBgGradient.addColorStop(0, '#EAE0D0');
    plateBgGradient.addColorStop(0.9, '#D8CCA8');
    plateBgGradient.addColorStop(1, '#C8B992');
    borderColor = '#4A2E18';
    badgeText = ep.era ? `📜 ${ep.era} 秘録絵巻` : `📜 江戸秘録絵巻`;
    badgeBg = '#7A2021';
    badgeColor = '#FFF';
    titleColor = '#1A120B';
    titleStroke = '#FFFFFF';
    accentColor = '#8B2635';
    subPlateBg = '#5A3825';
  } else if (isMv) {
    // 【音楽・MV】サイバーネオン・デジタルシングル調
    plateBgGradient = ctx.createLinearGradient(0, 0, 0, headerHeight);
    plateBgGradient.addColorStop(0, '#060B12');
    plateBgGradient.addColorStop(0.7, '#0D1B2A');
    plateBgGradient.addColorStop(1, '#152538');
    borderColor = '#00E5FF';
    badgeText = `DIGITAL SINGLE RELEASE ▶▶ STEREO 03:45`;
    badgeBg = 'rgba(0, 229, 255, 0.2)';
    badgeColor = '#00E5FF';
    titleColor = '#FFFFFF';
    titleStroke = '#003B46';
    accentColor = '#00E5FF';
    subPlateBg = 'rgba(0, 229, 255, 0.15)';
  } else if (isTrivia) {
    // 【雑学・解説】ビジュアル特集マガジン調
    plateBgGradient = ctx.createLinearGradient(0, 0, 0, headerHeight);
    plateBgGradient.addColorStop(0, '#0F172A');
    plateBgGradient.addColorStop(0.8, '#1E293B');
    plateBgGradient.addColorStop(1, '#0F172A');
    borderColor = '#F59E0B';
    badgeText = `💡 衝撃の真相検証 SPECIAL FEATURE`;
    badgeBg = '#D97706';
    badgeColor = '#FFF';
    titleColor = '#FFFFFF';
    titleStroke = '#000000';
    accentColor = '#FBBF24';
    subPlateBg = 'rgba(245, 158, 11, 0.2)';
  } else if (isManzai) {
    // 【漫才・演芸】寄席興行看板調
    plateBgGradient = ctx.createLinearGradient(0, 0, 0, headerHeight);
    plateBgGradient.addColorStop(0, '#7F1D1D');
    plateBgGradient.addColorStop(0.8, '#991B1B');
    plateBgGradient.addColorStop(1, '#450A0A');
    borderColor = '#FDE047';
    badgeText = `🏮 特撰 寄席興行名演`;
    badgeBg = '#FDE047';
    badgeColor = '#7F1D1D';
    titleColor = '#FFFFFF';
    titleStroke = '#000000';
    accentColor = '#FEF08A';
    subPlateBg = 'rgba(0,0,0,0.5)';
  } else {
    // 【汎用・シネマティック】
    plateBgGradient = ctx.createLinearGradient(0, 0, 0, headerHeight);
    plateBgGradient.addColorStop(0, '#0F1117');
    plateBgGradient.addColorStop(0.8, '#181C24');
    plateBgGradient.addColorStop(1, '#0C0E14');
    borderColor = '#CBD5E1';
    badgeText = `🎬 OFFICIAL TEASER EDITION`;
    badgeBg = 'rgba(255, 255, 255, 0.15)';
    badgeColor = '#F8FAFC';
    titleColor = '#FFFFFF';
    titleStroke = '#000000';
    accentColor = '#38BDF8';
    subPlateBg = 'rgba(15, 23, 42, 0.7)';
  }

  // 看板プレート外枠（Y: 44 〜 headerHeight - 16, X: 36 〜 width - 36）
  const plateX = 36;
  const plateY = 44;
  const plateW = width - plateX * 2;
  const plateH = headerHeight - plateY - 16;
  const cornerR = 24;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.7)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 12;

  // 角丸四角形パス
  ctx.beginPath();
  ctx.roundRect(plateX, plateY, plateW, plateH, cornerR);
  ctx.fillStyle = plateBgGradient;
  ctx.fill();

  // 二重飾り枠線
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 6;
  ctx.stroke();

  ctx.beginPath();
  ctx.roundRect(plateX + 10, plateY + 10, plateW - 20, plateH - 20, cornerR - 6);
  ctx.strokeStyle = isHist ? 'rgba(74,46,24,0.4)' : 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // 4. 看板内のテキスト描画（絶対安全エリア: Y = 70 〜 headerHeight - 40）
  // (A) 最上部バッジ
  ctx.save();
  ctx.font = 'bold 28px "Outfit", "Zen Kaku Gothic New", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const badgeW = ctx.measureText(badgeText).width + 48;
  const badgeH = 46;
  const badgeX = width / 2;
  const badgeY = plateY + 45;

  ctx.beginPath();
  ctx.roundRect(badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 12);
  ctx.fillStyle = badgeBg;
  ctx.fill();
  ctx.fillStyle = badgeColor;
  ctx.fillText(badgeText, badgeX, badgeY + 2);
  ctx.restore();

  // (B) メインタイトル（超迫力・自動折り返し＆スケーリング）
  const rawTitle = cleanTitle(ep.titleJp);
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  let titleLines: string[] = [];
  if (rawTitle.length > 14) {
    const half = Math.ceil(rawTitle.length / 2);
    titleLines = [rawTitle.slice(0, half), rawTitle.slice(half)];
  } else {
    titleLines = [rawTitle];
  }

  const titleFontSize = titleLines.length > 1 ? 72 : 88;
  const titleLineH = titleFontSize * 1.15;
  const titleStartY = badgeY + 45 + (titleLines.length > 1 ? 40 : 55);

  titleLines.forEach((line, idx) => {
    const lineY = titleStartY + idx * titleLineH;
    ctx.font = `900 ${titleFontSize}px "Dela Gothic One", "Zen Kaku Gothic New", sans-serif`;

    const maxLineW = plateW - 60;
    const measuredW = ctx.measureText(line).width;
    const scale = measuredW > maxLineW ? maxLineW / measuredW : 1.0;

    ctx.save();
    ctx.translate(width / 2, lineY);
    ctx.scale(scale, 1.0);

    ctx.strokeStyle = titleStroke;
    ctx.lineWidth = 14;
    ctx.lineJoin = 'round';
    ctx.strokeText(line, 0, 0);

    ctx.fillStyle = titleColor;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;
    ctx.fillText(line, 0, 0);
    ctx.restore();
  });
  ctx.restore();

  // (C) キャッチコピー枠（タイトルの下）
  const catchphrase = ep.coverCatchphraseJp || '';
  if (catchphrase) {
    const cpY = plateY + plateH - 42;
    ctx.save();
    ctx.font = 'bold 32px "Zen Kaku Gothic New", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const cleanCp = `・${catchphrase.replace(/[・\s]/g, '・')}・`;
    const cpTextW = ctx.measureText(cleanCp).width + 40;
    const cpW = Math.min(plateW - 60, cpTextW);

    ctx.beginPath();
    ctx.roundRect(width / 2 - cpW / 2, cpY - 26, cpW, 52, 26);
    ctx.fillStyle = subPlateBg;
    ctx.fill();
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = accentColor;
    ctx.fillText(cleanCp, width / 2, cpY + 2);
    ctx.restore();
  }

  // 5. 下部装飾（映画・ポスター風のクレジットフッター帯）
  const footH = 100;
  const footGrad = ctx.createLinearGradient(0, height - footH, 0, height);
  footGrad.addColorStop(0, 'rgba(0,0,0,0)');
  footGrad.addColorStop(0.5, 'rgba(0,0,0,0.85)');
  footGrad.addColorStop(1, 'rgba(0,0,0,0.98)');
  ctx.fillStyle = footGrad;
  ctx.fillRect(0, height - footH, width, footH);

  ctx.save();
  ctx.font = 'bold 22px "Outfit", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('STUDIO PRO PRODUCTION  |  ULTRA DIRECT CINEMA', width / 2, height - 35);
  ctx.restore();

  return canvas;
}

/**
 * 扉絵をBase64文字列（PNG）として取得
 */
export async function renderCoverBase64(ep: Episode): Promise<string> {
  const canvas = await renderCoverCanvas(ep);
  if (canvas instanceof OffscreenCanvas) {
    const blob = await canvas.convertToBlob({ type: 'image/png' });
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        resolve(res.replace(/^data:image\/png;base64,/, ''));
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } else {
    return (canvas as HTMLCanvasElement).toDataURL('image/png').replace(/^data:image\/png;base64,/, '');
  }
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
        const cleanImg = c.imageBase64.replace(/^data:[^;]+;base64,/, '');
        folder.file(`cut_${c.id}.png`, cleanImg, { base64: true });
      }
      // After絵（Veo補間用 到達点フレーム）
      if (c.endFrameImageBase64) {
        const cleanEndImg = c.endFrameImageBase64.replace(/^data:[^;]+;base64,/, '');
        folder.file(`cut_${c.id}_after.png`, cleanEndImg, { base64: true });
      }
      // 生成動画
      if (c.videoBase64) {
        const cleanVid = c.videoBase64.replace(/^data:[^;]+;base64,/, '');
        folder.file(`cut_${c.id}.mp4`, cleanVid, { base64: true });
      }
      // Event loop breather to prevent UI freeze and allow GC during heavy batch exports
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    // 2. キャラクター基準マスターアセット（三面図、Cut 1マスターアンカー）
    const turnaroundBase64 = ep.characterTurnaroundBase64 || manifest?.referenceAsset?.base64;
    if (turnaroundBase64) {
      const cleanTurnaround = turnaroundBase64.replace(/^data:[^;]+;base64,/, '');
      folder.file('character_turnaround.png', cleanTurnaround, { base64: true });
    }
    if (ep.masterAnchorBase64) {
      const cleanMaster = ep.masterAnchorBase64.replace(/^data:[^;]+;base64,/, '');
      folder.file('master_anchor.png', cleanMaster, { base64: true });
    }
    
    addLog(`📝 SRT字幕ファイルを生成中...`, 'info');
    folder.file('subtitles.srt', generateSRT(ep));

    if (ep.coverBase64) {
      addLog(`🖼️ 世界観適応インフォグラフィック扉絵を格納中...`, 'info');
      const cleanCover = ep.coverBase64.replace(/^data:[^;]+;base64,/, '');
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
      titleJp: ep.titleJp,
      titleEn: ep.titleEn,
      summary: ep.summary || '',
      theme: ep.theme || '',
      taste: ep.taste || '',
      characterDna: ep.characterDna || '',
      catchphrase: { jp: ep.coverCatchphraseJp, en: ep.coverCatchphraseEn },
      hasTurnaround: !!ep.characterTurnaroundBase64,
      hasMasterAnchor: !!ep.masterAnchorBase64,
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

    // ログの完全収集: 引数 logs が渡されていない場合でも、グローバルログストアから取得
    const globalLogs = (typeof window !== 'undefined' && (window as any).__STUDIO_LOGS__) || [];
    const effectiveLogs: LogEntry[] = (logs && logs.length > 0) ? logs : globalLogs;
    const logLines = effectiveLogs.map(l => l.message);
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