import JSZip from 'jszip';
import { savePackageFile, safeJsonStringify } from './export/fileDownloader';

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
  characterName: string;
  characterCredit: string;
  theme: string;
  taste: string;
  summary: string;
  turnaroundBase64?: string;
  coverShortsBase64?: string; // 9:16
  coverLongBase64?: string;   // 16:9
  cuts: FactoryExportCut[];
}

/**
 * ファイル名被りを100%根絶するユニークファイル名生成
 * 例: 20261104_231500_01_Ep1_zundamon_廃村の掟.zip
 */
export function generateFactoryUniqueZipName(payload: FactoryExportPayload): { filename: string; folderName: string } {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  
  // 秒単位の重複すら防ぐミリ秒サフィックス
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  
  const cleanChar = payload.characterName.replace(/[^a-zA-Z0-9\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g, '').slice(0, 10);
  const cleanTitle = (payload.titleJp || 'Episode')
    .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '')
    .replace(/[「」『』【】（）()［］\[\]・…！？!?,:;~〜\/\:*?"<>|]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 20);

  const baseIdentifier = `${timestamp}_${ms}_Ep${payload.episodeNo}_${cleanChar}_${cleanTitle}`;
  const folderName = `StoryFactory_${baseIdentifier}`;
  const filename = `${folderName}.zip`;

  return { filename, folderName };
}

/**
 * 24カット＋三面図＋扉絵2枚＋台本テキスト＋メタデータをZIPにまとめ自動保存
 */
export async function downloadStoryFactoryZip(
  payload: FactoryExportPayload,
  onLog?: (msg: string, type?: any) => void
): Promise<{ success: boolean; filename: string }> {
  const { filename, folderName } = generateFactoryUniqueZipName(payload);
  onLog?.(`📦 【自動ダウンロード】ZIPアーカイブ作成中: ${filename}`, 'process');

  const zip = new JSZip();
  const root = zip.folder(folderName) || zip;

  // 1. 三面図（キャラクターアンカー）
  if (payload.turnaroundBase64) {
    const raw = payload.turnaroundBase64.split('base64,').pop() || payload.turnaroundBase64;
    root.file('00_character_anchor.png', raw, { base64: true });
  }

  // 2. ショート用縦型扉絵 (9:16)
  if (payload.coverShortsBase64) {
    const raw = payload.coverShortsBase64.split('base64,').pop() || payload.coverShortsBase64;
    root.file('cover_shorts_9x16.png', raw, { base64: true });
  }

  // 3. ロング用横型扉絵 (16:9)
  if (payload.coverLongBase64) {
    const raw = payload.coverLongBase64.split('base64,').pop() || payload.coverLongBase64;
    root.file('cover_landscape_16x9.png', raw, { base64: true });
  }

  // 4. 本編24カット（1:1 正方形連番画像）
  for (const cut of payload.cuts) {
    const padNum = String(cut.cutNo).padStart(2, '0');
    if (cut.imageBase64) {
      const raw = cut.imageBase64.split('base64,').pop() || cut.imageBase64;
      root.file(`cut_${padNum}.png`, raw, { base64: true });
    }
  }

  // 5. 台本テキスト（人間がそのまま読める＆VOICEVOX/CapCutへコピペ用）
  let scriptTxt = `====================================================\n`;
  scriptTxt += `🎬 【作品名】${payload.titleJp} (第${payload.episodeNo}話 / 全${payload.totalEpisodes}話)\n`;
  scriptTxt += `🏷️ 【テーマ】${payload.theme}\n`;
  scriptTxt += `🎨 【画風】${payload.taste}\n`;
  scriptTxt += `👤 【主役】${payload.characterName}\n`;
  scriptTxt += `📜 【権利表記・クレジット】${payload.characterCredit}\n`;
  scriptTxt += `📝 【あらすじ】\n${payload.summary}\n`;
  scriptTxt += `====================================================\n\n`;
  scriptTxt += `【24カット台本・セリフ一覧】\n----------------------------------------------------\n`;

  payload.cuts.forEach(c => {
    const padNum = String(c.cutNo).padStart(2, '0');
    scriptTxt += `[Cut ${padNum}]\n`;
    scriptTxt += `セリフ/ナレーション: ${c.narrationJp}\n`;
    scriptTxt += `作画プロンプト: ${c.imagePromptEn}\n\n`;
  });

  root.file('script.txt', scriptTxt);

  // 6. システム連携用 JSON（Media Vault や自動レンダラー連携用）
  const metadataJson = {
    title: payload.titleJp,
    episode_no: payload.episodeNo,
    total_episodes: payload.totalEpisodes,
    theme: payload.theme,
    taste: payload.taste,
    character: {
      name: payload.characterName,
      credit: payload.characterCredit
    },
    summary: payload.summary,
    created_at: new Date().toISOString(),
    files: {
      turnaround: payload.turnaroundBase64 ? '00_character_anchor.png' : null,
      cover_shorts: payload.coverShortsBase64 ? 'cover_shorts_9x16.png' : null,
      cover_landscape: payload.coverLongBase64 ? 'cover_landscape_16x9.png' : null,
      cuts: payload.cuts.map(c => ({
        cut_no: c.cutNo,
        image_file: `cut_${String(c.cutNo).padStart(2, '0')}.png`,
        narration: c.narrationJp,
        prompt: c.imagePromptEn
      }))
    }
  };
  root.file('script.json', safeJsonStringify(metadataJson, 2));

  // 7. ZIP生成＆Google Flow / ブラウザ自動ダウンロード発火
  const zipBlob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  await savePackageFile(zipBlob, filename, onLog);
  onLog?.(`🎉 【自動ダウンロード完了】${filename} をダウンロードフォルダに保存しました！`, 'success');

  return { success: true, filename };
}
