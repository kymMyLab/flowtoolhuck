import { Flow } from 'flow-sdk';
import { 
  callWithRetry, 
  safeJsonParse, 
  formatDurationMs, 
  formatErrorMessage, 
  extractImageBase64, 
  extractMediaId 
} from './utils';
import { sanitizePromptForGoogleSafety } from './promptEngine';
import { SafeCharacter } from '../config/safeCharacters';
import { FactoryExportCut, FactoryExportPayload, downloadStoryFactoryZip } from './storyFactoryService';

export interface ScriptGenerationCut {
  cutNo: number;
  narrationJp: string;
  imagePromptEn: string;
  visualSummaryJp: string;
  isObjectOnly?: boolean;
}

export interface GeneratedStoryPlan {
  titleJp: string;
  titleEn: string;
  summaryJp: string;
  cuts: ScriptGenerationCut[];
}

// Banana 2 レート制限検知時に独立枠の Banana Pro へ自動昇格する共有フラグ
let hasRateLimitedBanana2 = false;

/**
 * 1. 既存の Flow.generate.text(string) + callWithRetry + safeJsonParse 仕組みを完全活用した24カット脚本生成
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
  onLog(`✍️ [第${episodeNo}話] 24カット起承転結シナリオをAI執筆中... (テーマ: ${theme})`, 'process');

  const prompt = `あなたはYouTube Shorts / Webtoon / ピクチャードラマの超一流クリエイティブディレクターです。
与えられたキャラクターとテーマに基づき、「視聴者を冒頭1秒で引き込み、24カットを通して息を呑むストーリーと結末」を持つ完全な24カット構成の台本を考案してください。

【キャラクター設定】
・主人公: ${character.nameJa}
・性格/口調: ${character.personality}
・外見DNA (全人物カットに必須): ${character.dnaPromptEn}

【作品テーマ】
${theme}

【画風・スタイル】
${tasteName} (${tastePromptEn})

【重要：コンプライアンス＆ガイドライン厳守事項】
1. 残虐な虐待描写や、${character.nameJa}自身が悪質な犯罪者・殺人鬼になる展開は絶対に禁止。
2. ホラーやサスペンス、謎解き、怪異との対峙はOKだが、過度なグロテスク描写は避けること。
3. Cut 6 と Cut 15 は、物語の象徴となる「小道具・風景のみの象徴インサートカット（人物なし: isObjectOnly: true）」にして映像的な緩急をつけること。
4. 起承転結（全24カット固定）：
   - Cut 01〜06【起】: 日常から非日常への入り口、引きの強い導入、違和感の発見
   - Cut 07〜12【承】: 深まる謎、探索・追走、手がかりの発見、事態の悪化
   - Cut 13〜18【転】: 最大の危機・怪異の急接近・真相の発覚・緊迫のクライマックス
   - Cut 19〜24【結】: 覚悟の脱出・決着・余韻・次の謎を予感させるラスト

Output ONLY valid JSON:
{
  "titleJp": "魅力的で短いエピソードタイトル（第○話などは含めない）",
  "titleEn": "English Episode Title",
  "summaryJp": "エピソードのあらすじ（80文字程度）",
  "cuts": [
    {
      "cutNo": 1,
      "isObjectOnly": false,
      "narrationJp": "${character.nameJa}の口調を守ったセリフ、または緊迫感あるナレーション（20〜35文字）",
      "visualSummaryJp": "シーンの情景説明（日本語）",
      "imagePromptEn": "Detailed English visual prompt including (${character.dnaPromptEn}), camera angle, lighting, background, and expression"
    }
  ]
}`;

  const rawRes = await callWithRetry<any>(
    () => {
      if (abortCheck()) throw new Error('ABORTED');
      // ★ 既存仕組みと同じ Flow.generate.text(string) 呼び出し
      return Flow.generate.text(prompt);
    },
    (att, max, delay, err, isSuper) => {
      const prefix = isSuper ? '🌙 [超指数バックオフ]' : '⚠️';
      onLog(`${prefix} 第${episodeNo}話 シナリオ生成リトライ (${att}/${max}) ${formatDurationMs(delay)}待機... (${formatErrorMessage(err)})`, 'warning');
    },
    { maxRetries: 5, superBackoff: true, abortCheck }
  );

  const plan = safeJsonParse<GeneratedStoryPlan>(rawRes?.text || rawRes, {} as GeneratedStoryPlan);

  if (!plan?.cuts || !Array.isArray(plan.cuts) || plan.cuts.length === 0) {
    throw new Error('シナリオJSONの解析に失敗しました。');
  }

  // 24カット固定の正規化
  while (plan.cuts.length < 24) {
    const nextNo = plan.cuts.length + 1;
    plan.cuts.push({
      cutNo: nextNo,
      isObjectOnly: false,
      narrationJp: `物語はさらなる深淵へと続いていくのだ…`,
      visualSummaryJp: `場面${nextNo}`,
      imagePromptEn: `${character.dnaPromptEn}, dramatic cinematic lighting, atmospheric background, masterpiece`
    });
  }
  plan.cuts = plan.cuts.slice(0, 24).map((c, idx) => ({
    ...c,
    cutNo: idx + 1,
    isObjectOnly: Boolean(c.isObjectOnly)
  }));

  onLog(`✅ [第${episodeNo}話] 脚本完成: 『${plan.titleJp}』 (全24カット確定)`, 'success');
  return plan;
}

/**
 * 2. 既存の画像生成エンジン仕組みを完全活用
 * - modelDisplayName ('🍌 Nano Banana 2' ➔ 429時に '🍌 Nano Banana Pro' へ自動昇格)
 * - referenceImageMediaIds (三面図の mediaId をバインドしてキャラの顔・服装を100%固定)
 * - セーフティブロック時のプロンプト自動浄化 (sanitizePromptForGoogleSafety)
 * - 超指数バックオフ (superBackoff: true)
 * - extractImageBase64 / extractMediaId による確実な抽出
 */
export async function generateFactoryImageWithExistingEngine(opts: {
  prompt: string;
  negativePrompt?: string;
  aspectRatio: '1:1' | '9:16' | '16:9';
  referenceMediaIds?: string[];
  label: string;
  onLog: (msg: string, type?: any) => void;
  abortCheck: () => boolean;
}): Promise<{ base64: string; mediaId?: string }> {
  const { prompt, negativePrompt, aspectRatio, referenceMediaIds, label, onLog, abortCheck } = opts;

  let safePrompt = prompt && /[a-zA-Z0-9]/.test(prompt) ? prompt : 'Cinematic anime illustration, masterpiece';
  if (aspectRatio === '1:1') {
    safePrompt += ', balanced centered 1:1 square composition, clean edge-to-edge artwork';
  }
  const defaultNegative = negativePrompt || 'photorealistic, realistic photo, 35mm photograph, DSLR, 3d render, subtitles, text, speech bubbles, watermark, signature, extra fingers, deformed anatomy';

  let lastErrStr = '';
  let attemptCount = 0;

  let res: any;
  try {
    res = await callWithRetry<any>(
      async () => {
        if (abortCheck()) throw new Error('ABORTED');
        attemptCount++;

        let currentModelName = hasRateLimitedBanana2 ? '🍌 Nano Banana Pro' : '🍌 Nano Banana 2';
        let currentPrompt = safePrompt;
        let currentNegative = defaultNegative;

        const isPolicyIssue = lastErrStr && (
          lastErrStr.includes('SAFETY') ||
          lastErrStr.includes('BLOCKED') ||
          lastErrStr.includes('ポリシー') ||
          lastErrStr.includes('POLICY')
        );

        if (isPolicyIssue) {
          currentPrompt = sanitizePromptForGoogleSafety(safePrompt).slice(0, 900);
          if (attemptCount >= 3) {
            currentModelName = '🍌 Nano Banana 2 Lite';
          }
        }

        return await Flow.generate.image({
          prompt: currentPrompt,
          negativePrompt: currentNegative,
          modelDisplayName: currentModelName,
          aspectRatio: aspectRatio as any,
          referenceImageMediaIds: referenceMediaIds && referenceMediaIds.length > 0 ? referenceMediaIds : undefined
        });
      },
      (att, max, delay, err, isSuper) => {
        const errMsg = formatErrorMessage(err);
        lastErrStr = errMsg;
        const waitStr = formatDurationMs(delay);
        const isRateLimit = errMsg.includes('使用量の上限') || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('403');

        if (isRateLimit && !hasRateLimitedBanana2) {
          hasRateLimitedBanana2 = true;
          onLog(`👑 ${label}: Banana 2の上限を検知！別枠クォータの「🍌 Nano Banana Pro」へ自動昇格して続行します！`, 'success');
        }

        if (isSuper) {
          onLog(`🌙 ${label}: [超指数バックオフ] サーバー高負荷のため ${waitStr}待機して自動再開します... (${errMsg})`, 'warning');
        } else {
          onLog(`⏳ ${label}: 画像生成リトライ (${att}/${max}) ${waitStr}後... (${errMsg})`, 'warning');
        }
      },
      {
        maxRetries: 5,
        timeoutMs: 90000,
        timeoutLabel: label,
        superBackoff: true,
        abortCheck
      }
    );
  } catch (firstErr: any) {
    if (abortCheck()) throw new Error('ABORTED');
    onLog(`🛡️ ${label}: 最終救済モード（安全化プロンプト＆Banana Pro）で再試行します...`, 'warning');
    const rescuePrompt = sanitizePromptForGoogleSafety(safePrompt).slice(0, 500);
    res = await Flow.generate.image({
      prompt: rescuePrompt,
      negativePrompt: defaultNegative,
      modelDisplayName: '🍌 Nano Banana Pro',
      aspectRatio: aspectRatio as any,
      referenceImageMediaIds: referenceMediaIds && referenceMediaIds.length > 0 ? referenceMediaIds : undefined
    });
  }

  let base64 = extractImageBase64(res);
  const mediaId = extractMediaId(res);

  if (!base64 && mediaId && typeof (Flow as any)?.media?.getBase64 === 'function') {
    try {
      const b64Res = await (Flow as any).media.getBase64(mediaId);
      base64 = extractImageBase64(b64Res);
    } catch (_) {}
  }

  if (!base64) {
    throw new Error(`${label} の画像データ抽出に失敗しました`);
  }

  return { base64, mediaId };
}

/**
 * 3. 1話完結パイプライン（三面図生成＆mediaIdバインド ➔ 扉絵2枚(9:16 & 16:9) ➔ 正方形24カット ➔ 自動ZIPダウンロード）
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
    cutsSoFar?: FactoryExportCut[];
  }) => void,
  abortCheck: () => boolean,
  existingTurnaround?: { base64: string; mediaId?: string }
): Promise<FactoryExportPayload & { turnaroundMediaId?: string }> {
  // --- Step 1: 24カット脚本生成 ---
  onProgress({ stage: 'シナリオ考案中 (Gemini)', completedCuts: 0, totalCuts: 24 });
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

  // --- Step 2: 主人公三面図マスター生成（characterTurnaroundMediaId の確立） ---
  let turnaroundBase64 = existingTurnaround?.base64;
  let turnaroundMediaId = existingTurnaround?.mediaId;

  if (!turnaroundBase64) {
    onLog(`🎨 [第${episodeNo}話] 360度キャラ一貫性を保証する「${character.nameJa}」三面図シートを作画中...`, 'process');
    onProgress({ stage: '三面図マスター作画中', completedCuts: 0, totalCuts: 24 });

    const turnaroundPrompt = `[MASTER ART STYLE: ${tastePromptEn}] ${character.turnaroundPromptEn}, character turnaround reference sheet showing front view, side view, and back view, clean solid background, no text, masterpiece`;
    const turnaroundRes = await generateFactoryImageWithExistingEngine({
      prompt: turnaroundPrompt,
      aspectRatio: '16:9',
      label: `Ep.${episodeNo} 三面図`,
      onLog,
      abortCheck
    });

    turnaroundBase64 = turnaroundRes.base64;
    turnaroundMediaId = turnaroundRes.mediaId;

    // もし mediaId が未取得なら Flow.upload で確実に発行して全カットにバインド可能にする
    if (turnaroundBase64 && !turnaroundMediaId) {
      try {
        const up = await Flow.upload({
          base64: turnaroundBase64,
          mimeType: 'image/png',
          name: `Turnaround_${character.id}_Ep${episodeNo}.png`
        });
        turnaroundMediaId = up?.mediaId;
      } catch (_) {}
    }

    onLog(`✨ 三面図マスター確定！(${turnaroundMediaId ? `Ref ID: ${turnaroundMediaId.slice(0, 8)}...` : 'Base64確立'}) 以降の全カットに参照バインドします。`, 'success');
    onProgress({
      stage: '三面図確定',
      completedCuts: 0,
      totalCuts: 24,
      currentCutImage: turnaroundBase64,
      currentNarration: `【三面図アンカー確定】${character.nameJa}（全24カットで容姿・衣装を固定）`
    });
  }

  const refIds = turnaroundMediaId ? [turnaroundMediaId] : undefined;

  // --- Step 3: ショート用扉絵(9:16) ＆ ロング用扉絵(16:9) の生成 ---
  onLog(`🖼️ [第${episodeNo}話] ショート用縦型扉絵（9:16）を作画中...`, 'process');
  onProgress({ stage: 'ショート用扉絵 (9:16) 作画中', completedCuts: 0, totalCuts: 24 });
  const coverShortsRes = await generateFactoryImageWithExistingEngine({
    prompt: `[MASTER ART STYLE: ${tastePromptEn}] Vertical 9:16 poster key visual for "${scriptPlan.titleEn || scriptPlan.titleJp}", featuring ${character.dnaPromptEn}, dramatic composition, upper third open for title, masterpiece`,
    aspectRatio: '9:16',
    referenceMediaIds: refIds,
    label: `Ep.${episodeNo} 縦扉絵(9:16)`,
    onLog,
    abortCheck
  });

  onLog(`🖼️ [第${episodeNo}話] ロング用横型扉絵（16:9）を作画中...`, 'process');
  onProgress({ stage: 'ロング用扉絵 (16:9) 作画中', completedCuts: 0, totalCuts: 24 });
  const coverLongRes = await generateFactoryImageWithExistingEngine({
    prompt: `[MASTER ART STYLE: ${tastePromptEn}] Widescreen 16:9 cinematic movie thumbnail key visual for "${scriptPlan.titleEn || scriptPlan.titleJp}", featuring ${character.dnaPromptEn}, high impact dramatic lighting, masterpiece`,
    aspectRatio: '16:9',
    referenceMediaIds: refIds,
    label: `Ep.${episodeNo} 横扉絵(16:9)`,
    onLog,
    abortCheck
  });

  // --- Step 4: 本編24カット（1:1 正方形）連続作画（三面図 referenceImageMediaIds バインド） ---
  const completedCuts: FactoryExportCut[] = [];

  for (let i = 0; i < scriptPlan.cuts.length; i++) {
    if (abortCheck()) throw new Error('ABORTED');
    const cut = scriptPlan.cuts[i];
    const cutPad = String(cut.cutNo).padStart(2, '0');

    onLog(`🎨 [第${episodeNo}話] Cut ${cutPad}/24 (1:1正方形) 作画中: 「${cut.narrationJp.slice(0, 22)}...」`, 'process');

    // 象徴オブジェクトカット(isObjectOnly)の時は人物参照を外し、人物カットの時は三面図MediaIdをバインド
    const cutRefIds = cut.isObjectOnly ? undefined : refIds;
    const subjectClause = cut.isObjectOnly
      ? 'symbolic still-life environment shot with NO humans, completely deserted'
      : `featuring protagonist (${character.dnaPromptEn})`;

    const fullCutPrompt = `[MASTER ART STYLE: ${tastePromptEn}] ${cut.imagePromptEn}, ${subjectClause}, 1:1 square format, masterpiece`;

    const imgRes = await generateFactoryImageWithExistingEngine({
      prompt: fullCutPrompt,
      aspectRatio: '1:1',
      referenceMediaIds: cutRefIds,
      label: `Ep.${episodeNo} Cut ${cutPad}`,
      onLog,
      abortCheck
    });

    completedCuts.push({
      cutNo: cut.cutNo,
      narrationJp: cut.narrationJp,
      imagePromptEn: fullCutPrompt,
      imageBase64: imgRes.base64
    });

    onProgress({
      stage: `本編24カット作画中 (${i + 1}/24)`,
      completedCuts: i + 1,
      totalCuts: 24,
      currentCutImage: imgRes.base64,
      currentNarration: cut.narrationJp,
      cutsSoFar: [...completedCuts]
    });
  }

  // --- Step 5: 既存の savePackageFile 仕組みでユニーク名ZIPを即時自動ダウンロード ---
  const payload: FactoryExportPayload & { turnaroundMediaId?: string } = {
    episodeNo,
    totalEpisodes,
    titleJp: scriptPlan.titleJp,
    titleEn: scriptPlan.titleEn,
    characterName: character.nameJa,
    characterCredit: character.speakerCredit,
    characterDna: character.dnaPromptEn,
    theme,
    taste: tasteName,
    summary: scriptPlan.summaryJp,
    turnaroundBase64,
    turnaroundMediaId,
    coverShortsBase64: coverShortsRes.base64,
    coverLongBase64: coverLongRes.base64,
    cuts: completedCuts
  };

  onProgress({ stage: 'ZIPパッケージ自動ダウンロード中...', completedCuts: 24, totalCuts: 24 });
  await downloadStoryFactoryZip(payload, onLog);

  return payload;
}
