import JSZip from 'jszip';
import { savePackageFile, safeJsonStringify } from './export/fileDownloader';
import { resolveMasterCategory } from '../config/masterCategories';
import { extractHighlights } from './directorService';
import { extractImageBase64 } from './utils';

export interface FactoryExportCut {
  cutNo: number;
  narrationJp: string;
  imagePromptEn: string;
  imageBase64?: string;
}

export interface FactoryExportPayload {
  episodeNo: number;
  totalEpisodes: number;
  titleJp: string;
  titleEn?: string;
  characterName: string;
  characterCredit: string;
  characterDna?: string;
  theme: string;
  taste: string;
  summary: string;
  turnaroundBase64?: string;
  coverShortsBase64?: string; // 9:16
  coverLongBase64?: string;   // 16:9
  cuts: FactoryExportCut[];
}

// 同一秒内の複数ダウンロードでも100%衝突しない連番カウンタ
let downloadSequenceCounter = 0;

/**
 * 文字列でもオブジェクト({ base64, mediaId })でも絶対にエラーを出さずに純粋なbase64文字列を取り出す安全関数
 */
export function safeCleanBase64(input: any): string | null {
  const extracted = extractImageBase64(input);
  if (!extracted || typeof extracted !== 'string') return null;
  const raw = extracted.includes('base64,') ? extracted.split('base64,').pop() || '' : extracted;
  return raw.trim() || null;
}

/**
 * ファイル名被りを100%根絶するユニークファイル名生成
 * 例: 20261104_231500_001_Ep01_zundamon_廃村の掟.zip
 */
export function generateFactoryUniqueZipName(payload: FactoryExportPayload): {
  filename: string;
  asciiFilename: string;
  folderName: string;
} {
  downloadSequenceCounter = (downloadSequenceCounter + 1) % 1000;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const seqStr = String(downloadSequenceCounter).padStart(3, '0');
  const epStr = `Ep${pad(payload.episodeNo)}`;

  const cleanChar = payload.characterName
    .replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, '')
    .slice(0, 10);
  const cleanTitle = (payload.titleJp || 'Episode')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[\u2600-\u27BF\uE000-\uF8FF]/g, '')
    .replace(/[「」『』【】（）()［］\[\]・…！？!?,:;~〜\/\:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .trim()
    .slice(0, 24);

  const folderName = `${timestamp}_${seqStr}_${epStr}_${cleanChar}_${cleanTitle}`;
  const filename = `${folderName}.zip`;
  const asciiFilename = `FlowTool_${epStr}_${timestamp}_${seqStr}.zip`;

  return { filename, asciiFilename, folderName };
}

/**
 * SRT字幕生成（1カット3.5秒基準）
 */
function buildFactorySrt(cuts: FactoryExportCut[]): string {
  const fmt = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.round((sec % 1) * 1000);
    const p2 = (v: number) => String(v).padStart(2, '0');
    const p3 = (v: number) => String(v).padStart(3, '0');
    return `${p2(h)}:${p2(m)}:${p2(s)},${p3(ms)}`;
  };
  let cur = 0;
  return cuts
    .map((c, idx) => {
      const start = cur;
      const dur = 3.5;
      cur += dur;
      return `${idx + 1}\n${fmt(start)} --> ${fmt(cur)}\n${c.narrationJp || ''}\n`;
    })
    .join('\n');
}

/**
 * 既存の zipPackager.ts / fileDownloader.ts 規格を完全踏襲した自動ZIP生成＆保存
 */
export async function downloadStoryFactoryZip(
  payload: FactoryExportPayload,
  onLog?: (msg: string, type?: any) => void
): Promise<{ success: boolean; filename: string }> {
  const { filename, asciiFilename, folderName } = generateFactoryUniqueZipName(payload);
  onLog?.(`📦 【自動ダウンロード】ZIPパッケージ作成中: ${filename}`, 'process');

  const zip = new JSZip();
  const root = zip.folder(folderName) || zip;

  // 1. 三面図（既存互換 character_turnaround.png ＆ 00_character_anchor.png）
  const cleanTurnaround = safeCleanBase64(payload.turnaroundBase64);
  if (cleanTurnaround) {
    root.file('character_turnaround.png', cleanTurnaround, { base64: true });
    root.file('00_character_anchor.png', cleanTurnaround, { base64: true });
  }

  // 2. ショート用縦型扉絵 (9:16)（既存互換 cover_v.png / cover.png ＆ cover_shorts_9x16.png）
  const cleanCoverShorts = safeCleanBase64(payload.coverShortsBase64);
  if (cleanCoverShorts) {
    root.file('cover_v.png', cleanCoverShorts, { base64: true });
    root.file('cover.png', cleanCoverShorts, { base64: true });
    root.file('cover_shorts_9x16.png', cleanCoverShorts, { base64: true });
  }

  // 3. ロング用横型扉絵 (16:9)（既存互換 cover_h.png ＆ cover_landscape_16x9.png）
  const cleanCoverLong = safeCleanBase64(payload.coverLongBase64);
  if (cleanCoverLong) {
    root.file('cover_h.png', cleanCoverLong, { base64: true });
    root.file('cover_landscape_16x9.png', cleanCoverLong, { base64: true });
  }

  // 4. 本編24カット（1:1 正方形連番画像 cut_01.png 〜 cut_24.png）
  for (const cut of payload.cuts) {
    const padNum = String(cut.cutNo).padStart(2, '0');
    const cleanCutImg = safeCleanBase64(cut.imageBase64);
    if (cleanCutImg) {
      root.file(`cut_${padNum}.png`, cleanCutImg, { base64: true });
    }
    await new Promise(r => setTimeout(r, 0));
  }

  // 5. SRT字幕ファイル
  root.file('subtitles.srt', buildFactorySrt(payload.cuts));

  // 6. 人間用＆VOICEVOX/SNS概要欄コピペ用 台本テキスト
  let scriptTxt = `====================================================\n`;
  scriptTxt += `🎬 【作品名】${payload.titleJp} (第${payload.episodeNo}話 / 全${payload.totalEpisodes}話)\n`;
  scriptTxt += `🏷️ 【テーマ】${payload.theme}\n`;
  scriptTxt += `🎨 【画風】${payload.taste}\n`;
  scriptTxt += `👤 【主役】${payload.characterName}\n`;
  scriptTxt += `📜 【必須クレジット表記（概要欄コピペ用）】\n${payload.characterCredit}\n`;
  scriptTxt += `📝 【あらすじ】\n${payload.summary}\n`;
  scriptTxt += `====================================================\n\n`;
  scriptTxt += `【全24カット セリフ・ナレーション台本】\n----------------------------------------------------\n`;

  payload.cuts.forEach(c => {
    const padNum = String(c.cutNo).padStart(2, '0');
    scriptTxt += `[Cut ${padNum}] ${c.narrationJp}\n`;
  });

  root.file('script.txt', scriptTxt);

  // 7. 既存 zipPackager.ts / Media Vault 7100 完全互換の script.json
  const masterCat = resolveMasterCategory(payload.theme, 'episodes');
  const scriptJson = {
    pool_code: masterCat.pool_code,
    style_code: masterCat.style_code,
    format_id: masterCat.format_id,
    category_name_ja: masterCat.pool.name_ja,
    default_bpm: masterCat.pool.audio_contract.default_bpm,
    sound_texture: masterCat.pool.audio_contract.sound_texture,

    title: payload.titleJp,
    episode_no: payload.episodeNo,
    total_episodes: payload.totalEpisodes,
    theme: payload.theme,
    created_at: new Date().toISOString(),

    id: payload.episodeNo,
    productionMode: 'episodes',
    titleJp: payload.titleJp,
    titleEn: payload.titleEn || 'Story Factory Episode',
    summary: payload.summary,
    taste: payload.taste,
    characterName: payload.characterName,
    speakerCredit: payload.characterCredit,
    characterDna: payload.characterDna || '',
    hasTurnaround: !!cleanTurnaround,
    cuts: payload.cuts.map(c => {
      const cutPad = String(c.cutNo).padStart(2, '0');
      const hl = extractHighlights(c.narrationJp || '');
      return {
        cut_no: c.cutNo,
        duration_sec: 3.5,
        narration: c.narrationJp,
        image_file: `cut_${cutPad}.png`,
        id: c.cutNo,
        dialogue: c.narrationJp,
        narrationJp: c.narrationJp,
        promptEn: c.imagePromptEn,
        highlights: hl
      };
    })
  };
  root.file('script.json', safeJsonStringify(scriptJson, 2));

  // 8. 既存の savePackageFile (FileSystemAccess / Flow.download / .zip.txt / Blob fallback) で確実に保存
  const zipBlob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });
  await savePackageFile(zipBlob, filename, onLog, asciiFilename);

  return { success: true, filename };
}
