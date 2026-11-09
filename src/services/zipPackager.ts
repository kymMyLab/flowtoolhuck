import { extractImageBase64 } from './utils';
import JSZip from 'jszip';
import { Episode, SeriesManifest, LogEntry } from '../types';
import { renderCoverBase64, renderCoverBase64Horizontal } from './coverService';
import { SAFE_CHARACTERS } from '../constants';
import { Flow } from 'flow-sdk';
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
    return '{}';
  }
};
/**
 * 秒数を SRT タイムコード形式 (HH:MM:SS,mmm) に変換
 */
function formatSrtTime(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const millis = Math.floor((seconds % 1) * 1000);
  const pad = (n: number, z = 2) => String(n).padStart(z, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(millis, 3)}`;
}
/**
 * エピソードのカット一覧から標準 subtitles.srt を生成
 */
export function generateSrtContent(ep: Episode, cutDurationSeconds = 4): string {
  const cuts = ep.cuts || [];
  let srt = '';
  let currentTime = 0;
  for (let i = 0; i < cuts.length; i++) {
    const cut = cuts[i];
    const duration = cut.duration || cutDurationSeconds;
    const startTime = currentTime;
    const endTime = startTime + duration;
    currentTime = endTime;
    const text = cut.narrationJp || cut.scenePlot || `Cut ${cut.id}`;
    srt += `${i + 1}\n`;
    srt += `${formatSrtTime(startTime)} --> ${formatSrtTime(endTime)}\n`;
    srt += `${text.trim()}\n\n`;
  }
  return srt;
}
/**
 * ファイル名を生成（ASCII安全名とサニタイズ表示名の両方を作成）
 * ファイル名の先頭に主人公キャラクター名とシリーズ共通4桁ハッシュ（例: [ずんだもん]_A7F2_001_...）を付与
 * ファイル名先頭の3桁連番は実際のエピソード番号（ep.id）に基づく
 * 「小夜/SAYO」等のスラッシュはOSパス区切りとして誤認されないよう「_」に完全サニタイズ
 * 全カット画像が揃っている場合は「_full」、未生成カットがある場合は「_preview」を付与
 */
export function generateSafeFilenames(ep: Episode): { asciiFilename: string; displayFilename: string } {
  const charId = ep.characterId || 'zundamon';
  const foundChar = SAFE_CHARACTERS.find(c => c.id === charId);
  const rawCharNameJa = foundChar?.nameJa || (charId === 'zundamon' ? 'ずんだもん' : charId);
  // スラッシュ「/」や特殊記号をアンダースコアへ完全サニタイズ
  const safeCharNameJa = rawCharNameJa.replace(/[\/\\:*?"<>|]/g, '_').trim();
  const safeCharAscii = (foundChar?.id || charId).replace(/[\/\\:*?"<>|]/g, '_').trim();
  const hashChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let seriesHash = (ep as any).seriesHash || (typeof window !== 'undefined' ? (window as any).__STUDIO_SERIES_HASH__ : '');
  if (!seriesHash) {
    seriesHash = Array.from({ length: 4 }, () => hashChars[Math.floor(Math.random() * hashChars.length)]).join('');
    if (typeof window !== 'undefined') {
      (window as any).__STUDIO_SERIES_HASH__ = seriesHash;
    }
  }
  const charPrefix = `[${safeCharNameJa}]_${seriesHash}_`;
  const charAsciiPrefix = `[${safeCharAscii}]_${seriesHash}_`;
  const epNumStr = String(ep.id || 1).padStart(3, '0');
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  
  const cuts = ep.cuts || [];
  const isFull = cuts.length > 0 && cuts.every(c => !!(c.imageBase64 || c.imageMediaId));
  const completionSuffix = isFull ? '_full' : '_preview';
  const asciiFilename = `${charAsciiPrefix}Ep${epNumStr}_${timestamp}${completionSuffix}.zip`;
  const cleanTitle = (ep.titleJp || 'Episode')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\u2600-\u27BF\uE000-\uF8FF]/g, '')
    .replace(/[「」『』【】（）()［］\[\]・…！？!?,:;~〜\/\:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim()
    .slice(0, 30);
  const displayFilename = `${charPrefix}${epNumStr}_${timestamp}_${cleanTitle || `Ep${ep.id}`}${completionSuffix}.zip`;
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
      if (addLog) addLog(`✅ ファイル「${filename}」(${sizeStr}) を保存しました (File System Access)。`, 'success');
      return { success: true, method: 'showSaveFilePicker' };
    } catch (fsErr: any) {
      if (fsErr.name === 'AbortError') {
        return { success: false, method: 'user_cancelled' };
      }
    }
  }
  // 手法 2: Google Flow Tools 公式 Flow.download API (text/plain .zip.txt で直接ダウンロード)
  if (typeof Flow !== 'undefined' && typeof Flow.download === 'function') {
    try {
      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const baseClean = filename.replace(/\.zip$/i, '').replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '').replace(/[「」『』\/\\:*?"<>|]/g, '_').trim();
      const txtFallbackFilename = `${baseClean || 'FlowTool_Package'}.zip.txt`;
      await Flow.download({ base64, mimeType: 'text/plain', filename: txtFallbackFilename });
      if (addLog) {
        addLog(`✅ パッケージ「${txtFallbackFilename}」(${sizeStr}) をダウンロード完了！`, 'success');
      }
      return { success: true, method: 'Flow.download.txt' };
    } catch (_) {}
  }
  // 手法 3: DOM <a download>
  try {
    const blobUrl = URL.createObjectURL(blob);
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
  } catch (_) {}
  if (addLog) addLog(`💾 パッケージ「${filename}」(${sizeStr}) の保存コマンドを送信しました。`, 'info');
  return { success: true, method: 'dom_dispatched' };
};
/**
 * series_manifest.json 単体の自動ダウンロード（ZIP同梱のみ）
 */
export const downloadManifestFile = async (_manifest: SeriesManifest, _addLog: (msg: string, type?: any) => void) => {};
/**
 * エピソード全体を完全なZIPアーカイブ（画像・台本・メタデータ・cover_v.png・cover_h.png・script.json・subtitles.srt）としてパッケージ化
 */
export async function packageEpisodeToZip(
  ep: Episode,
  _settings: any,
  addLog: (msg: string, type?: any) => void,
  _logs: LogEntry[] = [],
  _allEpisodes: Episode[] = []
): Promise<{ blob: Blob; asciiFilename: string; displayFilename: string; base64Zip?: string }> {
  addLog(`📦 【第${ep.id}話】ZIPアーカイブの構築を開始します...`, 'process');
  const zip = new JSZip();
  const folder = zip.folder(`Episode_${ep.id}`) || zip;
  // 1. 各カット画像
  const cuts = ep.cuts || [];
  for (let i = 0; i < cuts.length; i++) {
    const cut = cuts[i];
    const cutNum = String(cut.id || i + 1).padStart(2, '0');
    if (cut.imageBase64) {
      const ext = extractImageBase64(cut.imageBase64) || cut.imageBase64;
      const clean = ext.split('base64,').pop() || ext;
      folder.file(`cut_${cutNum}.png`, clean, { base64: true });
    }
    if (cut.endFrameImageBase64) {
      const extEnd = extractImageBase64(cut.endFrameImageBase64) || cut.endFrameImageBase64;
      const cleanEnd = extEnd.split('base64,').pop() || extEnd;
      folder.file(`cut_${cutNum}_end.png`, cleanEnd, { base64: true });
    }
  }
  // 2. カバー画像の整理：cover_v.png（9:16縦）と cover_h.png（16:9横）
  const coverVRaw = ep.coverBase64 || ep.masterAnchorBase64 || ep.cuts?.[0]?.imageBase64;
  if (coverVRaw) {
    const cleanCoverV = coverVRaw.split('base64,').pop() || coverVRaw;
    folder.file('cover_v.png', cleanCoverV, { base64: true });
  }
  const coverHRaw = ep.coverHorizontalBase64 || ep.masterAnchorBase64 || ep.cuts?.[0]?.imageBase64;
  if (coverHRaw) {
    const cleanCoverH = coverHRaw.split('base64,').pop() || coverHRaw;
    folder.file('cover_h.png', cleanCoverH, { base64: true });
  }
  // 3. キャラクター三面図
  if (ep.characterTurnaroundBase64) {
    const cleanTurnaround = ep.characterTurnaroundBase64.split('base64,').pop() || ep.characterTurnaroundBase64;
    folder.file('character_turnaround.png', cleanTurnaround, { base64: true });
  }
  // 4. 台本テキスト (scenario.txt)
  let scriptText = `【作品タイトル】${ep.titleJp || '無題'}\n【英語タイトル】${ep.titleEn || ''}\n【テーマ】${ep.theme || ''}\n【時代・世界観】${ep.era || ''}\n\n`;
  for (let i = 0; i < cuts.length; i++) {
    const c = cuts[i];
    scriptText += `--- CUT ${c.id} ---\n`;
    scriptText += `【演出指示】${c.scenePlot || c.cleanAction || ''}\n`;
    scriptText += `【台詞・ナレーション】${c.narrationJp || ''}\n`;
    scriptText += `【英語プロンプト】${c.promptEn || ''}\n\n`;
  }
  folder.file('scenario.txt', scriptText);
  // 🎙️ VOICEVOX スピーカーID（voice_name）のメタデータ解決
  const VOICE_MAP: Record<string, string> = {
    zundamon: 'voicevox:3',   // ずんだもん (ノーマル)
    metan: 'voicevox:2',      // 四国めたん (ノーマル)
    tsumugi: 'voicevox:8',    // 春日部つむぎ
    himari: 'voicevox:14',    // 冥鳴ひまり
    sayo: 'voicevox:46',      // 小夜/SAYO (アナウンサー調)
    nurse_t: 'voicevox:47',   // ナースロボ＿タイプＴ (アンドロイド)
    usagi: 'voicevox:61',     // 中国うさぎ (妹・ビビり枠)
  };
  const resolvedVoiceName = VOICE_MAP[ep.characterId || ''] || 'voicevox:3';
  const resolvedSpeaker = ep.characterId || 'zundamon';
  // 5. 後段ツール・動画化スクリプト連携用 構造化スクリプト (script.json)
  const structuredScript = {
    episodeId: ep.id,
    titleJp: ep.titleJp,
    titleEn: ep.titleEn,
    summary: ep.summary,
    theme: ep.theme,
    era: ep.era,
    productionMode: ep.productionMode,
    characterDna: ep.characterDna,
    voice_name: resolvedVoiceName,
    speaker: resolvedSpeaker,
    cuts: cuts.map((c, idx) => ({
      cutNumber: c.id || idx + 1,
      narrationJp: c.narrationJp || '',
      scenePlot: c.scenePlot || c.cleanAction || '',
      promptEn: c.promptEn || '',
      shotScale: c.shotScale || '',
      cinematicAngle: c.cinematicAngle || '',
      isObjectOnly: Boolean(c.isObjectOnly),
      durationSeconds: c.duration || 4,
      telop: c.telop || { fullText: c.narrationJp || '' },
      cut_no: c.id || idx + 1,
      narration: c.narrationJp || '',
      dialogue: c.narrationJp || '',
      tts_text: c.narrationJp || '',
      visual_prompt: c.promptEn || '',
      duration: c.duration || 4
    }))
  };
  folder.file('script.json', safeJsonStringify(structuredScript, 2));
  // 6. 字幕ファイル (subtitles.srt)
  const srtContent = generateSrtContent(ep, 4);
  folder.file('subtitles.srt', srtContent);
  // 7. 設定メタデータ (series_manifest.json) を同梱
  const manifestData = {
    episodeId: ep.id,
    titleJp: ep.titleJp,
    titleEn: ep.titleEn,
    theme: ep.theme,
    era: ep.era,
    productionMode: ep.productionMode,
    cutsCount: cuts.length,
    characterDna: ep.characterDna,
    voice_name: resolvedVoiceName,
    speaker: resolvedSpeaker,
    createdAt: new Date().toISOString()
  };
  folder.file('series_manifest.json', safeJsonStringify(manifestData, 2));
  // 8. ZIPバイナリ生成
  addLog(`⚙️ ZIPアーカイブを圧縮中...`, 'process');
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const { asciiFilename, displayFilename } = generateSafeFilenames(ep);
  addLog(`✅ ZIPアーカイブの構築が完了しました（${(blob.size / 1024 / 1024).toFixed(2)} MB）`, 'success');
  return { blob, asciiFilename, displayFilename };
}
/**
 * エピソード全体のアセットを同梱したZIPパッケージを作成・ダウンロード保存
 */
export const downloadZip = async (
  ep: Episode, 
  addLog: (msg: string, type?: any) => void, 
  _manifest?: SeriesManifest,
  logs?: LogEntry[]
): Promise<{ filename: string; blobUrl: string; sizeStr: string; flowSuccess: boolean } | null> => {
  try {
    const { blob, asciiFilename, displayFilename } = await packageEpisodeToZip(ep, {}, addLog, logs);
    const result = await savePackageFile(blob, displayFilename, addLog, asciiFilename);
    const blobUrl = URL.createObjectURL(blob);
    return {
      filename: displayFilename,
      blobUrl,
      sizeStr: `${(blob.size / 1024 / 1024).toFixed(2)} MB`,
      flowSuccess: result.success
    };
  } catch (_) {
    return null;
  }
};

