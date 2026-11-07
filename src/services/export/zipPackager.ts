import { extractImageBase64 } from '../utils';
import { SAFE_CHARACTERS } from '../../constants';
import JSZip from 'jszip';
import { Episode, SeriesManifest, LogEntry } from '../../types';
import { extractHighlights } from '../directorService';
import { renderCoverCanvas, renderCoverCanvasHorizontal, renderCoverBase64, renderCoverBase64Horizontal } from './coverRenderer';

export { renderCoverBase64, renderCoverBase64Horizontal };

/**
 * 循環参照やDOMノード・クロスオリジンWindowを確実に排除する安全なJSON文字列化関数
 */
export const safeJsonStringify = (obj: any, indent = 2): string => {
  const seen = new WeakSet();
  const sanitizeValue = (val: any): any => {
    if (val === null || val === undefined) return val;
    if (typeof val === 'function' || typeof val === 'symbol') return undefined;
    if (typeof val !== 'object') return val;
    try {
      if (val === window || (typeof Window !== 'undefined' && val instanceof Window)) return undefined;
      if (typeof Event !== 'undefined' && val instanceof Event) return undefined;
      if (typeof val.nodeType === 'number' || val.$$typeof || val.nativeEvent) return undefined;
    } catch {
      return undefined;
    }
    if (seen.has(val)) return '[Circular]';
    seen.add(val);
    if (Array.isArray(val)) {
      return val.map(item => sanitizeValue(item));
    }
    const cleanObj: Record<string, any> = {};
    for (const k of Object.keys(val)) {
      try {
        const child = sanitizeValue(val[k]);
        if (child !== undefined) {
          cleanObj[k] = child;
        }
      } catch {
        // ignore
      }
    }
    return cleanObj;
  };
  try {
    return JSON.stringify(sanitizeValue(obj), null, indent);
  } catch (err) {
    console.warn('safeJsonStringify fallback:', err);
    return '{}';
  }
};

/**
 * ファイル名を生成（ASCII安全名とサニタイズ表示名の両方を作成）
 */
let fileSeqCounter = 0;
export function generateSafeFilenames(ep: Episode): { asciiFilename: string; displayFilename: string } {
  fileSeqCounter = (fileSeqCounter + 1) % 1000;
  const seq = String(fileSeqCounter).padStart(3, '0');
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}_${seq}`;
  
  // ★ 全カット描画完了（_full）か先行プレビュー（_preview）かを判定
  const cuts = ep.cuts || [];
  const readyCount = cuts.filter(c => !!(c.imageBase64 || (c as any).imageMediaId)).length;
  const isFull = cuts.length > 0 && readyCount >= cuts.length;
  const statusSuffix = isFull ? '_full' : '_preview';

  const asciiFilename = `FlowTool_Ep${ep.id}_${timestamp}${statusSuffix}.zip`;

  const cleanTitle = (ep.titleJp || 'Episode')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\u2600-\u27BF\uE000-\uF8FF]/g, '')
    .replace(/[「」『』【】（）()［］\[\]・…！？!?,:;~〜\/\:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim()
    .slice(0, 30);

  const displayFilename = `${timestamp}_${cleanTitle || `Ep${ep.id}`}${statusSuffix}.zip`;
  return { asciiFilename, displayFilename };
}

/**
 * あらゆるブラウザ環境・Google Flow sandbox 環境でファイルを確実に保存する統合関数
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

  // 手法 1: File System Access API
  if (typeof (window as any).showSaveFilePicker === 'function') {
    try {
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
      console.groupEnd();
      if (addLog) addLog(`✅ ファイル「${filename}」(${sizeStr}) を保存しました (File System Access)。`, 'success');
      return { success: true, method: 'showSaveFilePicker' };
    } catch (fsErr: any) {
      if (fsErr.name === 'AbortError') {
        console.groupEnd();
        return { success: false, method: 'user_cancelled' };
      }
    }
  }

  // 手法 2: Google Flow Tools 公式 Flow.download API (.zip -> .zip.txt 自動フォールバック)
  if (typeof Flow !== 'undefined' && typeof Flow.download === 'function') {
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const baseClean = filename.replace(/\.zip$/i, '').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').replace(/[「」『』]/g, '_').trim();
      const txtFallbackFilename = `${baseClean || 'FlowTool_Package'}.zip.txt`;

      try {
        await Flow.download({ base64, mimeType: 'application/zip', filename: safeAsciiFilename });
        console.groupEnd();
        if (addLog) addLog(`✅ パッケージ「${safeAsciiFilename}」(${sizeStr}) をダウンロードしました (Flow API)。`, 'success');
        return { success: true, method: 'Flow.download' };
      } catch (zipErr: any) {
        console.warn(`⚠️ [Method 2] Flow.download (.zip) 拒否のため、Google Flow 許可形式 (.zip.txt) に切り替えます...`);
      }

      try {
        await Flow.download({ base64, mimeType: 'text/plain', filename: txtFallbackFilename });
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

  // 手法 3: window.open (Blob URL)
  const blobUrl = URL.createObjectURL(blob);
  setTimeout(() => {
    try { URL.revokeObjectURL(blobUrl); } catch (_) {}
  }, 60000);

  try {
    const newWindow = window.open(blobUrl, '_blank');
    if (newWindow) {
      console.log('🚀 [Method 3] window.open 実行成功。別タブ/ウィンドウ経由で保存が開始されます。');
    }
  } catch (winErr: any) {
    console.warn('⚠️ [Method 3] window.open スキップ:', winErr.message);
  }

  // 手法 4: DOM <a download>
  try {
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      try {
        if (a.parentNode) document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch (_) {}
    }, 10000);
  } catch (domErr: any) {
    console.error('❌ [Method 4] DOM <a download> 失敗:', domErr);
  }

  console.groupEnd();
  if (addLog) addLog(`💾 パッケージ「${filename}」(${sizeStr}) の保存コマンドを送信しました。`, 'info');
  return { success: true, method: 'dom_dispatched' };
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

/**
 * 3者統合グランドマスター規格 (v2.1.0-FullProduction) 自動解決
 */
const POOLS_REGISTRY: Record<number, { name_ja: string; default_bpm: number; sound_texture: string }> = {
  10: { name_ja: 'エモーショナル・叙情', default_bpm: 85, sound_texture: 'acoustic, piano, sentimental strings' },
  20: { name_ja: '日常・青春・ポップ', default_bpm: 120, sound_texture: 'upbeat pop, acoustic guitar, bright synth' },
  30: { name_ja: '近未来・サイバー', default_bpm: 128, sound_texture: 'cyberpunk synthwave, electronic beat' },
  40: { name_ja: 'サスペンス・ノワール', default_bpm: 95, sound_texture: 'dark jazz, moody bass, cinematic tension' },
  50: { name_ja: '歴史・和風', default_bpm: 105, sound_texture: 'traditional japanese instruments, shamisen, koto' },
  60: { name_ja: '怪異・ホラー', default_bpm: 80, sound_texture: 'eerie ambient, dissonance, creepy soundscape' },
  70: { name_ja: 'ファンタジー・異世界', default_bpm: 115, sound_texture: 'orchestral fantasy, celtic folk flute' },
  80: { name_ja: 'バトル・熱血', default_bpm: 145, sound_texture: 'heavy rock, driving drums, electric guitar' },
  90: { name_ja: '超絶技巧・職人技', default_bpm: 110, sound_texture: 'focused ambient, rhythmic craftsman sounds' },
};

export function resolveMasterCategory(theme?: string, mode?: string) {
  const t = (theme || '').toLowerCase();
  const m = (mode || '').toLowerCase();

  let format_id: 'music_mv' | 'drama_manga' | 'trivia_shorts' = 'drama_manga';
  if (m === 'mv' || t.includes('mv') || t.includes('音楽') || t.includes('歌')) {
    format_id = 'music_mv';
  } else if (m === 'trivia' || t.includes('雑学') || t.includes('解説') || t.includes('shorts')) {
    format_id = 'trivia_shorts';
  } else {
    format_id = 'drama_manga';
  }

  let pool_code = 20;
  let style_code = 21;

  if (m === 'craft' || t.includes('職人') || t.includes('工芸') || t.includes('刀鍛冶') || t.includes('陶芸') || t.includes('手仕事') || t.includes('超絶技巧')) {
    pool_code = 90;
    style_code = 91;
  } else if (t.includes('バトル') || t.includes('熱血') || t.includes('格闘') || t.includes('ロック') || t.includes('勝負') || t.includes('対決')) {
    pool_code = 80;
    style_code = 81;
  } else if (t.includes('ファンタジー') || t.includes('異世界') || t.includes('古代遺跡') || t.includes('エルフ') || t.includes('魔法') || t.includes('神話')) {
    pool_code = 70;
    style_code = 71;
  } else if (m === 'folklore' || t.includes('怪異') || t.includes('狂気') || t.includes('ホラー') || t.includes('禁足地') || t.includes('廃村') || t.includes('未解決')) {
    pool_code = 60;
    style_code = 61;
  } else if (t.includes('江戸') || t.includes('大河') || t.includes('和風') || t.includes('城下町') || t.includes('武将') || t.includes('浮世絵') || t.includes('歴史')) {
    pool_code = 50;
    style_code = 51;
  } else if (t.includes('ノワール') || t.includes('探偵') || t.includes('裏路地') || t.includes('ダーク') || t.includes('サスペンス') || t.includes('紫煙')) {
    pool_code = 40;
    style_code = 41;
  } else if (t.includes('サイバー') || t.includes('近未来') || t.includes('電脳') || t.includes('ai') || t.includes('シンセ') || t.includes('ネオン')) {
    pool_code = 30;
    style_code = 31;
  } else if (t.includes('切ない') || t.includes('哀愁') || t.includes('別れ') || t.includes('雨宿り') || t.includes('夕暮れ') || t.includes('涙')) {
    pool_code = 10;
    style_code = 11;
  } else {
    pool_code = 20;
    style_code = format_id === 'trivia_shorts' ? 24 : 21;
  }

  const pool = POOLS_REGISTRY[pool_code] || POOLS_REGISTRY[20];
  return {
    pool_code,
    style_code,
    format_id,
    pool: {
      name_ja: pool.name_ja,
      audio_contract: {
        default_bpm: pool.default_bpm,
        sound_texture: pool.sound_texture
      }
    }
  };
}

/**
 * SRT形式のタイムコード生成 (HH:MM:SS,mmm)
 */
export function formatSRTTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "00:00:00,000";
  const date = new Date(0);
  date.setUTCMilliseconds(Math.floor(seconds * 1000));
  const hh = date.getUTCHours().toString().padStart(2, '0');
  const mm = date.getUTCMinutes().toString().padStart(2, '0');
  const ss = date.getUTCSeconds().toString().padStart(2, '0');
  const ms = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${hh}:${mm}:${ss},${ms}`;
}

/**
 * EpisodeデータからSRT字幕ファイルを生成
 */
export function generateSRT(ep: Episode): string {
  let srt = '';
  let currentTime = 2.0;

  ep.cuts.forEach((cut, index) => {
    let duration = Number(cut.videoDuration);
    if (isNaN(duration) || duration <= 0) {
      duration = Math.max(4, (cut.narrationJp?.length || 0) * 0.25);
    }
    const startTime = formatSRTTime(currentTime);
    const endTime = formatSRTTime(currentTime + duration);

    srt += `${index + 1}\n`;
    srt += `${startTime} --> ${endTime}\n`;
    srt += `${cut.narrationJp || ''}\n\n`;

    currentTime += duration;
  });

  return srt;
}

function cleanupCanvas(canvas: OffscreenCanvas | HTMLCanvasElement) {
  try {
    if (canvas instanceof OffscreenCanvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    } else {
      const cvs = canvas as HTMLCanvasElement;
      const ctx = cvs.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, cvs.width, cvs.height);
      cvs.width = 0;
      cvs.height = 0;
    }
  } catch (_) {}
}

/**
 * エピソード全体のアセットを同梱したZIPパッケージを作成・保存
 */
export const downloadZip = async (
  ep: Episode, 
  addLog: (msg: string, type?: any) => void, 
  manifest?: SeriesManifest,
  logs?: LogEntry[]
): Promise<{ filename: string; blobUrl: string; sizeStr: string; flowSuccess: boolean } | null> => {
  addLog(`📦 Ep.${ep.id} パッケージング中...`, 'process');
  try {
    const { asciiFilename, displayFilename } = generateSafeFilenames(ep);
    const uniquePackageFolderName = displayFilename.replace(/\.zip$/i, '');
    const zip = new JSZip();
    const folder = zip.folder(uniquePackageFolderName);
    if (!folder) throw new Error('ZIP creation failed');

    for (const c of ep.cuts) {
      const cutPad = String(c.id || 1).padStart(2, '0');
      if (c.imageBase64) {
        try {
          const extImg = extractImageBase64(c.imageBase64) || '';
          const cleanImg = typeof extImg === 'string' ? (extImg.split('base64,').pop() || extImg) : '';
          folder.file(`cut_${cutPad}.png`, cleanImg, { base64: true });
        } catch (e) {
          console.warn(`Failed to inject start image for cut ${c.id}:`, e);
        }
      }
      if (c.endFrameImageBase64) {
        try {
          const cleanEndImg = c.endFrameImageBase64.split('base64,').pop() || c.endFrameImageBase64;
          folder.file(`cut_${cutPad}_after.png`, cleanEndImg, { base64: true });
        } catch (e) {
          console.warn(`Failed to inject end frame image for cut ${c.id}:`, e);
        }
      }
      if (c.videoBase64) {
        try {
          const cleanVid = c.videoBase64.split('base64,').pop() || c.videoBase64;
          folder.file(`cut_${cutPad}.mp4`, cleanVid, { base64: true });
        } catch (e) {
          console.warn(`Failed to inject video for cut ${c.id}:`, e);
        }
      }
      await new Promise(resolve => setTimeout(resolve, 0));
    }

    const turnaroundBase64 = ep.characterTurnaroundBase64 || manifest?.referenceAsset?.base64;
    if (turnaroundBase64) {
      try {
        const extTurn = extractImageBase64(turnaroundBase64) || '';
        const cleanTurnaround = typeof extTurn === 'string' ? (extTurn.split('base64,').pop() || extTurn) : '';
        folder.file('character_turnaround.png', cleanTurnaround, { base64: true });
      } catch (e) {
        console.warn('Failed to inject turnaround asset:', e);
      }
    }
    if (ep.masterAnchorBase64) {
      try {
        const extMas = extractImageBase64(ep.masterAnchorBase64) || '';
        const cleanMaster = typeof extMas === 'string' ? (extMas.split('base64,').pop() || extMas) : '';
        folder.file('master_anchor.png', cleanMaster, { base64: true });
      } catch (e) {
        console.warn('Failed to inject master anchor asset:', e);
      }
    }
    
    addLog(`📝 SRT字幕ファイルを生成中...`, 'info');
    folder.file('subtitles.srt', generateSRT(ep));
    const charInfo = SAFE_CHARACTERS.find(ch => ch.id === ep.characterId);
    const creditLine = charInfo ? charInfo.speakerCredit : 'VOICEVOX:ずんだもん / 東北ずん子プロジェクト (SSS合同会社)';
    const scriptTxtLines = [
      `【タイトル】${ep.titleJp || ''}`,
      `【クレジット表記（概要欄用）】${creditLine}`,
      `【あらすじ】${ep.summary || ''}`,
      '',
      ...ep.cuts.map(c => `[Cut ${String(c.id).padStart(2, '0')}] ${c.narrationJp || ''}`)
    ].join('\n');
    folder.file('script.txt', scriptTxtLines);

    addLog(`🖼️ 看板画像（縦型 cover_v & 横型 cover_h）を合成中...`, 'info');
    if (ep.coverBase64) {
      const extCov = extractImageBase64(ep.coverBase64) || '';
      const cleanCover = typeof extCov === 'string' ? (extCov.split('base64,').pop() || extCov) : '';
      folder.file('cover_v.png', cleanCover, { base64: true });
      folder.file('cover.png', cleanCover, { base64: true });
    } else {
      const coverVCanvas = await renderCoverCanvas(ep);
      const vBlob = await (coverVCanvas instanceof OffscreenCanvas 
        ? coverVCanvas.convertToBlob({ type: 'image/png' }) 
        : new Promise<Blob>(r => (coverVCanvas as HTMLCanvasElement).toBlob(b => r(b!), 'image/png')));
      folder.file('cover_v.png', vBlob);
      folder.file('cover.png', vBlob);
      cleanupCanvas(coverVCanvas);
    }

    try {
      const coverHCanvas = await renderCoverCanvasHorizontal(ep);
      const hBlob = await (coverHCanvas instanceof OffscreenCanvas
        ? coverHCanvas.convertToBlob({ type: 'image/png' })
        : new Promise<Blob>(r => (coverHCanvas as HTMLCanvasElement).toBlob(b => r(b!), 'image/png')));
      folder.file('cover_h.png', hBlob);
      cleanupCanvas(coverHCanvas);
    } catch (e) {
      console.warn('Horizontal cover generation skipped:', e);
    }
    
    const masterCat = resolveMasterCategory(ep.theme, ep.productionMode);

    const VOICE_MAP: Record<string, string> = {
      zundamon: 'voicevox:3',   // ずんだもん (ノーマル)
      metan: 'voicevox:2',      // 四国めたん (ノーマル)
      tsumugi: 'voicevox:8',    // 春日部つむぎ
      himari: 'voicevox:14',    // 冥鳴ひまり
    };
    const resolvedVoiceName = VOICE_MAP[ep.characterId || ''] || 'voicevox:3';

    const scriptJson = {
      pool_code: masterCat.pool_code,
      style_code: masterCat.style_code,
      format_id: masterCat.format_id,
      category_name_ja: masterCat.pool.name_ja,
      default_bpm: masterCat.pool.audio_contract.default_bpm,
      sound_texture: masterCat.pool.audio_contract.sound_texture,

      title: ep.titleJp || ep.titleEn || '無題',
      episode_no: ep.id || 1,
      total_episodes: manifest?.totalEpisodes || 1,
      theme: ep.theme || '',
      voice_name: resolvedVoiceName,
      speaker: ep.characterId || 'zundamon',
      created_at: new Date().toISOString(),

      id: ep.id,
      productionMode: ep.productionMode || (ep.isMvMode ? 'mv' : 'episodes'),
      titleJp: ep.titleJp || '無題',
      titleEn: ep.titleEn || '',
      summary: ep.summary || '',
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
        const cutPad = String(c.id || 1).padStart(2, '0');

        return {
          cut_no: c.id || 1,
          duration_sec: c.duration || 3.0,
          duration: c.duration || 3.0,
          narration: narration,
          dialogue: narration,
          tts_text: narration,
          visual_prompt: c.promptEn || '',
          image_file: `cut_${cutPad}.png`,
          video_file: `cut_${cutPad}.mp4`,

          id: c.id || 1,
          cutNumber: c.id || 1,
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
        const enrichedManifest = {
          pool_code: masterCat.pool_code,
          style_code: masterCat.style_code,
          format_id: masterCat.format_id,
          category_name_ja: masterCat.pool.name_ja,
          default_bpm: masterCat.pool.audio_contract.default_bpm,
          sound_texture: masterCat.pool.audio_contract.sound_texture,
          ...manifest
        };
        folder.file('series_manifest.json', safeJsonStringify(enrichedManifest, 2));
      } catch (e: any) {
        console.warn('series_manifest.json serialization failed, skipping manifest file', e);
      }
    }

    const globalLogs = (typeof window !== 'undefined' && (window as any).__STUDIO_LOGS__) || [];
    const effectiveLogs: LogEntry[] = (logs && logs.length > 0) ? logs : globalLogs;
    const logLines = effectiveLogs.map(l => (typeof l.message === 'string' ? l.message : String(l.message || '')));
    logLines.push(`[${new Date().toLocaleTimeString('ja-JP')}] 📦 パッケージング完了`);
    folder.file('production_logs.txt', logLines.join('\n'));

    addLog(`📦 ZIPアーカイブを圧縮中...`, 'process');
    const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });

    const filename = displayFilename;
    const sizeMb = (zipBlob.size / (1024 * 1024)).toFixed(1);
    const sizeStr = `${sizeMb} MB`;

    const blobUrl = URL.createObjectURL(zipBlob);
    setTimeout(() => {
      try { URL.revokeObjectURL(blobUrl); } catch (_) {}
    }, 30000);

    const saveRes = await savePackageFile(zipBlob, filename, addLog, asciiFilename);
    return { filename, blobUrl, sizeStr, flowSuccess: saveRes.success };
  } catch (err: any) { 
    addLog(`❌ ZIP生成エラー: ${err.message}`, 'error'); 
    return null;
  }
};
