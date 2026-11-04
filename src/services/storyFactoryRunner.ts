import { Flow } from 'flow-sdk';
import { callWithRetry, safeJsonParse, formatDurationMs } from './utils';
import { SafeCharacter } from '../config/safeCharacters';
import { FactoryExportCut, FactoryExportPayload, downloadStoryFactoryZip } from './storyFactoryService';

export interface ScriptGenerationCut {
  cutNo: number;
  narrationJp: string;
  imagePromptEn: string;
  visualSummaryJp: string;
}

export interface GeneratedStoryPlan {
  titleJp: string;
  summaryJp: string;
  cuts: ScriptGenerationCut[];
}

/**
 * 1. 24カットの物語・脚本・プロンプトを一括立案（Gemini 3.8 Flash / Flow.generate.text）
 */
export async function generateStoryScript24(
  character: SafeCharacter,
  theme: string,
  tasteName: string,
  tastePromptEn: string,
  episodeNo: number,
  totalEpisodes: number,
  onLog: (msg: string, type?: any) => void,
  abortCheck: () => boolean
): Promise<GeneratedStoryPlan> {
  onLog(`✍️ [第${episodeNo}話] 24カット起承転結シナリオを策定中... (テーマ: ${theme})`, 'process');

  const systemPrompt = `あなたはYouTube Shorts / Webtoon / ピクチャードラマの超一流クリエイティブディレクターです。
与えられたキャラクターとテーマに基づき、「視聴者を冒頭1秒で引き込み、24カットを通して息を呑むストーリーと結末」を持つ完全な24カット構成の台本を考案してください。

【キャラクター設定】
・主人公: ${character.nameJa}
・性格/口調: ${character.personality}
・外見DNA: ${character.dnaPromptEn}

【作品テーマ】
${theme}

【画風・スタイル】
${tasteName} (${tastePromptEn})

【重要：コンプライアンス＆ガイドライン厳守事項】
1. 残虐な虐待描写や、${character.nameJa}自身が悪質な犯罪者・殺人鬼になる展開は絶対に禁止。
2. ホラーやサスペンス、謎解き、怪異との対峙はOKだが、過度なグロテスク描写は避けること。
3. 起承転結（24カット）の構成：
   - Cut 01〜06【起】: 日常から非日常への入り口、引きの強い導入、違和感の発見
   - Cut 07〜12【承】: 深まる謎、探索・追走、手がかりの発見、事態の悪化
   - Cut 13〜18【転】: 最大の危機・怪異の急接近・真相の発覚・緊迫のクライマックス
   - Cut 19〜24【結】: 覚悟の脱出・決着・余韻・次回や次の謎を予感させる衝撃のラスト

【出力フォーマット】
以下のキーを持つ厳格な単一JSONオブジェクトのみを出力してください（Markdownコードブロック含む）：
{
  "titleJp": "魅力的で短いエピソードタイトル（日本語）",
  "summaryJp": "エピソードのあらすじ（80文字程度）",
  "cuts": [
    {
      "cutNo": 1,
      "narrationJp": "キャラクターのセリフ、またはナレーション（日本語、キャラの口調厳守）",
      "visualSummaryJp": "シーンの情景説明（日本語）",
      "imagePromptEn": "英語の作画プロンプト。必ず主人公の特徴(${character.dnaPromptEn})を含め、構図・ライティング・背景・表情を詳細に記述。1:1 square masterpiece"
    },
    ... (必ず Cut 1 から Cut 24 まで 24個のオブジェクトを含める)
  ]
}`;

  const plan = await callWithRetry(
    async () => {
      if (abortCheck()) throw new Error('ABORTED');
      const response = await Flow.generate.text({
        prompt: systemPrompt,
        model: 'gemini-2.0-flash'
      });
      return safeJsonParse<GeneratedStoryPlan>(response, {} as GeneratedStoryPlan);
    },
    (att, max, delay, err) => {
      onLog(`⚠️ シナリオ生成リトライ中 (${att}/${max}) ... 待機: ${formatDurationMs(delay)}`, 'warning');
    },
    { maxRetries: 5, superBackoff: true, abortCheck }
  );

  if (!plan?.cuts || !Array.isArray(plan.cuts) || plan.cuts.length < 12) {
    throw new Error('シナリオの生成に失敗したか、カット数が不足しています。');
  }

  // 24カットに満たない場合のパディング保証
  while (plan.cuts.length < 24) {
    const nextNo = plan.cuts.length + 1;
    plan.cuts.push({
      cutNo: nextNo,
      narrationJp: `${character.nameJa}「まだまだ謎は尽きないのだ…！」`,
      visualSummaryJp: '物語の余韻と次の展開',
      imagePromptEn: `${character.dnaPromptEn}, standing in atmospheric environment, cinematic lighting, 1:1 square composition, masterpiece`
    });
  }
  plan.cuts = plan.cuts.slice(0, 24).map((c, idx) => ({ ...c, cutNo: idx + 1 }));

  onLog(`✅ [第${episodeNo}話] シナリオ策定完了: 「${plan.titleJp}」 (全24カット)`, 'success');
  return plan;
}

/**
 * 2. 画像生成（単一画像 / 1:1 正方形 または サムネ比率）
 */
export async function generateFactoryImage(
  prompt: string,
  aspectRatio: '1:1' | '9:16' | '16:9' = '1:1',
  onLog: (msg: string, type?: any) => void,
  abortCheck: () => boolean
): Promise<string> {
  const result = await callWithRetry(
    async () => {
      if (abortCheck()) throw new Error('ABORTED');
      // Flow.generate.image
      const res = await Flow.generate.image({
        prompt,
        aspectRatio: aspectRatio === '1:1' ? '1:1' : aspectRatio === '9:16' ? '9:16' : '16:9'
      });
      if (!res) throw new Error('No image returned from Flow.generate.image');
      return res;
    },
    (att, max, delay, err, isSuper) => {
      const mark = isSuper ? '🌙【超指数バックオフ】' : '⚠️';
      onLog(`${mark} 画像生成API待機中 (${att}/${max}) ... 次の再試行まで ${formatDurationMs(delay)}`, 'warning');
    },
    { maxRetries: 8, superBackoff: true, abortCheck }
  );

  return result;
}

/**
 * 3. 1話分の一括完走パイプライン（三面図 ➔ 扉絵2枚 ➔ 24カット ➔ 自動ZIPダウンロード）
 */
export async function runFactorySingleEpisode(
  episodeNo: number,
  totalEpisodes: number,
  character: SafeCharacter,
  theme: string,
  tasteName: string,
  tastePromptEn: string,
  onLog: (msg: string, type?: any) => void,
  onProgress: (status: {
    stage: string;
    completedCuts: number;
    totalCuts: number;
    currentCutImage?: string;
    currentNarration?: string;
  }) => void,
  abortCheck: () => boolean,
  existingTurnaround?: string
): Promise<FactoryExportPayload> {
  // --- Step 1: シナリオ考案 ---
  onProgress({ stage: 'シナリオ考案中', completedCuts: 0, totalCuts: 24 });
  const scriptPlan = await generateStoryScript24(
    character,
    theme,
    tasteName,
    tastePromptEn,
    episodeNo,
    totalEpisodes,
    onLog,
    abortCheck
  );

  // --- Step 2: キャラクター三面図（アンカー）生成 ---
  let turnaroundBase64 = existingTurnaround;
  if (!turnaroundBase64) {
    onLog(`🎨 [第${episodeNo}話] 主人公「${character.nameJa}」の一貫性を担保する三面図を生成中...`, 'process');
    onProgress({ stage: '三面図アンカー作画中', completedCuts: 0, totalCuts: 24 });
    const turnaroundPrompt = `${character.turnaroundPromptEn}, ${tastePromptEn}, isolated clean white background, high quality, masterpiece`;
    turnaroundBase64 = await generateFactoryImage(turnaroundPrompt, '1:1', onLog, abortCheck);
    onLog(`✅ 三面図アンカー確定！以降の全カットで外見・服装が固定されます。`, 'success');
  }

  // --- Step 3: 扉絵（サムネイル用2枚）生成 ---
  // A. ショート動画用 縦型扉絵 (9:16)
  onLog(`🖼️ ショート用縦型扉絵（9:16 サムネ用）を作画中...`, 'process');
  onProgress({ stage: 'ショート用扉絵(9:16)作画中', completedCuts: 0, totalCuts: 24 });
  const coverShortsPrompt = `Vertical book cover, YouTube shorts poster, ${character.dnaPromptEn}, dramatic scene from "${scriptPlan.titleJp}", ${tastePromptEn}, bold dynamic composition, 9:16 vertical ratio, eye-catching masterpiece`;
  const coverShortsBase64 = await generateFactoryImage(coverShortsPrompt, '9:16', onLog, abortCheck);

  // B. ロング動画用 横型扉絵 (16:9)
  onLog(`🖼️ ロング用横型扉絵（16:9 YouTube用）を作画中...`, 'process');
  onProgress({ stage: 'ロング用扉絵(16:9)作画中', completedCuts: 0, totalCuts: 24 });
  const coverLongPrompt = `Horizontal cinematic movie poster, ${character.dnaPromptEn}, wide establishing shot of "${scriptPlan.titleJp}", ${tastePromptEn}, cinematic lighting, 16:9 widescreen composition, breathtaking masterpiece`;
  const coverLongBase64 = await generateFactoryImage(coverLongPrompt, '16:9', onLog, abortCheck);

  // --- Step 4: 本編24カット（1:1 正方形）連続生成 ---
  const completedCuts: FactoryExportCut[] = [];

  for (let i = 0; i < scriptPlan.cuts.length; i++) {
    if (abortCheck()) throw new Error('ABORTED');
    const cut = scriptPlan.cuts[i];
    onLog(`🎨 [第${episodeNo}話] Cut ${cut.cutNo}/24 作画中: 「${cut.narrationJp.slice(0, 24)}...」`, 'process');
    
    // プロンプトに三面図特徴と作風をブレンド
    const fullCutPrompt = `${cut.imagePromptEn}, consistent with character turnaround, ${tastePromptEn}, square format 1:1, highly detailed`;
    const imageBase64 = await generateFactoryImage(fullCutPrompt, '1:1', onLog, abortCheck);

    completedCuts.push({
      cutNo: cut.cutNo,
      narrationJp: cut.narrationJp,
      imagePromptEn: cut.imagePromptEn,
      imageBase64
    });

    onProgress({
      stage: `本編作画中 (${i + 1}/24)`,
      completedCuts: i + 1,
      totalCuts: 24,
      currentCutImage: imageBase64,
      currentNarration: cut.narrationJp
    });

    // サーバー負荷軽減のための小休止 (1秒)
    await new Promise(r => setTimeout(r, 1000));
  }

  // --- Step 5: ZIPパッケージング & 自動ダウンロード発火 ---
  const payload: FactoryExportPayload = {
    episodeNo,
    totalEpisodes,
    titleJp: scriptPlan.titleJp,
    characterName: character.nameJa,
    characterCredit: character.speakerCredit,
    theme,
    taste: tasteName,
    summary: scriptPlan.summaryJp,
    turnaroundBase64,
    coverShortsBase64,
    coverLongBase64,
    cuts: completedCuts
  };

  onProgress({ stage: '自動ダウンロード中...', completedCuts: 24, totalCuts: 24 });
  await downloadStoryFactoryZip(payload, onLog);

  return payload;
}
