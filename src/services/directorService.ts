import { SAFE_CHARACTERS } from '../config/safeCharacters';
import { Cut, GenerationTask, GeneratorSettings, KenBurnsPreset, FocalPoint } from '../types';
import { safeJsonParse, callWithRetry, formatDurationMs } from './utils';
import { 
  resolveRecommendedCameraWorkAndKenBurns, 
  resolveRecommendedTelopStaging 
} from '../config/studioDefinitions';
import { 
  buildDynamicAntiPreviousNegative, 
  getStoryboardPreset, 
  buildFinalCinematicPromptAndNegative, 
  isMvChorusCut,
  MV_ANTI_CAMERA_LOOK_NEGATIVE,
  PreviousShotContext 
} from './promptEngine';

export type { PreviousShotContext as PreviousShotInfo };

// ── テキスト整形・抽出ヘルパー群 ＆ 映画監督プロンプト生成群 ──
import {
  cleanEpisodeTitle,
  cleanEpisodeTitleEn,
  checkIsHistorical,
  extractHighlights,
  buildCharacterTurnaroundPrompt,
  buildCharacterScreeningPrompt,
  buildGrandDesignPrompt,
  buildNextEpisodePlanPrompt,
  buildCompactScriptPrompt,
  buildAdaptiveInfographicCoverPrompt,
  InfographicCoverPromptOptions
} from './directorPrompts';

export function sanitizeForYouTubeSafety(text: string): string {
  if (!text) return '';
  return text
    .replace(/[殺死血狂暴]/g, '★')
    .replace(/(死ね|殺す|血まみれ|狂気|虐殺)/g, '危険')
    .trim();
}

export {
  cleanEpisodeTitle,
  cleanEpisodeTitleEn,
  checkIsHistorical,
  extractHighlights,
  buildCharacterTurnaroundPrompt,
  buildCharacterScreeningPrompt,
  buildGrandDesignPrompt,
  buildNextEpisodePlanPrompt,
  buildCompactScriptPrompt,
  buildAdaptiveInfographicCoverPrompt
};
export type { InfographicCoverPromptOptions };

/**
 * 直前のカットの構図・ポーズ・アングルを排除するための動的ネガティブプロンプト
 * （promptEngine の定義駆動ロジックに委譲）
 */
export function buildAntiPreviousCompositionNegative(
  prevScale?: string,
  prevAngle?: string,
  prevPrompt?: string
): string {
  return buildDynamicAntiPreviousNegative({
    scale: prevScale,
    angle: prevAngle,
    prompt: prevPrompt,
  });
}

export const buildImagePromptAndNegative = buildFinalCinematicPromptAndNegative;

/**
 * カットごとの演出データ（構図、テロップ、ケンバーン効果）を決定
 */
export async function directShot(
  task: GenerationTask,
  settings: GeneratorSettings,
  _activeReference: any,
  previousShotInfo?: PreviousShotContext
): Promise<Partial<Cut>> {
  const { cutId, prompt } = task;

  const preset = getStoryboardPreset(cutId, settings.isMvMode, settings.isMangaMode);
  const recCw = resolveRecommendedCameraWorkAndKenBurns(
    cutId,
    settings.productionMode,
    settings.isMvMode,
    settings.isMangaMode
  );
  const kbPreset: KenBurnsPreset = recCw.recommendedKenBurns;
  const isAllowedEyeContact = settings.isMvMode && isMvChorusCut(cutId, 30);
  const isHistorical = checkIsHistorical(settings.era, settings.theme);

  const defaultTelop = resolveRecommendedTelopStaging(
    cutId, 
    settings.isMvMode, 
    isHistorical, 
    previousShotInfo?.telop,
    settings.productionMode
  );

  const effectiveScale = task.shotScale || preset.scale;
  const effectiveAngle = task.cinematicAngle || preset.angle;

  let antiPreviousNegative = buildDynamicAntiPreviousNegative(previousShotInfo, effectiveScale);
  if (settings.isMvMode && !isAllowedEyeContact) {
    antiPreviousNegative = antiPreviousNegative ? `${antiPreviousNegative}, ${MV_ANTI_CAMERA_LOOK_NEGATIVE}` : MV_ANTI_CAMERA_LOOK_NEGATIVE;
  }

  const hasCameraDirective = prompt.includes('[CAMERA DIRECTIVE:') || prompt.includes('[STRICT') || prompt.includes('[IRONCLAD');
  const finalPromptEn = hasCameraDirective ? prompt : `${effectiveAngle}. ${prompt}`;

  return {
    promptEn: finalPromptEn,
    negativePrompt: antiPreviousNegative,
    cameraWork: task.camera || recCw.id,
    cameraMotion: recCw.motionPrompt,
    cinematicAngle: effectiveAngle,
    shotScale: effectiveScale,
    kenBurnsPreset: kbPreset,
    telop: {
      fullText: '',
      style: defaultTelop.style,
      transition: defaultTelop.transition,
      position: defaultTelop.position,
      directorNote: defaultTelop.directorNote
    }
  };
}

export interface GenerateSafeScriptOptions {
  epId: number;
  currentPlan: {
    epNumber?: number;
    titleJp: string;
    titleEn: string;
    summary?: string;
  };
  country: string;
  theme: string;
  era?: string;
  isMangaMode?: boolean;
  isMvMode?: boolean;
  taste?: string;
  productionMode?: string;
  existingTitles?: string[];
  characterId?: string;
  targetCutCount?: number;
  superBackoff?: boolean;
  abortCheck?: () => boolean;
  addLog?: (msg: string, type?: 'info' | 'success' | 'warning' | 'error' | 'process') => void;
}

export interface SafeScriptResult {
  coverCatchphraseEn?: string;
  titleJp: string;
  titleEn: string;
  summary: string;
  characterDna?: string;
  eraAnalysisJp: string;
  forbiddenAnachronisms: string[];
  authenticAttireEn: string;
  forbiddenKeywordsEn: string;
  coverCatchphraseJp: string;
  highlightWords: string[];
  cuts: Array<{
    id: number;
    panelLayout?: Cut['panelLayout'];
    basicPlot: string;
    narrationJp: string;
    highlights?: string[];
    isObjectOnly?: boolean;
    focalPoint?: FocalPoint;
    compositionPrompt?: string;
    veoMotionPrompt?: string;
    endFramePlot?: string;
  }>;
}

export async function generateSafeEpisodeScript(opts: GenerateSafeScriptOptions): Promise<SafeScriptResult> {
  const {
    epId, currentPlan, country, theme, era, isMangaMode, isMvMode,
    taste, productionMode, existingTitles, characterId, targetCutCount, abortCheck, addLog
  } = opts;
  const fixedChar = (characterId && characterId !== 'auto') ? SAFE_CHARACTERS.find(c => c.id === characterId) : undefined;
  const fallbackDna = fixedChar
    ? fixedChar.dnaPromptEn
    : (isMvMode
      ? 'Consistent 19yo Japanese girl, soft wavy dark brown chin-length bob hair, gentle eyes, oversized cozy knit cardigan, sleek over-ear headphones'
      : 'Consistent single protagonist matching the world setting and narrative');

  // 初手から無駄な長文指示を削ぎ落とした軽量骨組みプロンプトを使用（1〜2秒で即座に通す）
  const scriptPrompt = buildCompactScriptPrompt(
    epId, currentPlan as any, country, theme, era, isMangaMode, isMvMode, taste, productionMode, existingTitles, characterId, targetCutCount
  );

  let scriptRes: any;
  const scriptStartTime = Date.now();
  let scriptHeartbeat: any = null;
  if (addLog) {
    scriptHeartbeat = setInterval(() => {
      const elapsed = Math.round((Date.now() - scriptStartTime) / 1000);
      addLog(`⏳ 【第${epId}話】AI思考＆執筆中...（${elapsed}秒経過: 場面展開・カット割りを生成中）`, 'process');
    }, 5000);
  }

  try {
    scriptRes = await callWithRetry<any>(
      () => Flow.generate.text(scriptPrompt),
      (attempt, max, delay, err) => {
        console.error(`[Script Retry ${attempt}/${max}]`, err);
        const waitStr = formatDurationMs(delay);
        if (addLog) {
          addLog(`⚠️ 第${epId}話 脚本リトライ (${attempt}/${max}) ${waitStr}後... (サーバー混雑検出)`, 'warning');
        }
      },
      {
        maxRetries: 2,
        superBackoff: false,
        abortCheck
      }
    );
    if (addLog) {
      const elapsed = ((Date.now() - scriptStartTime) / 1000).toFixed(1);
      addLog(`📥 【第${epId}話】AI脚本応答を受信（応答時間: ${elapsed}秒 / 演出解析中...）`, 'process');
    }
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.warn(`[Script Fallback for Episode ${epId}] API混雑のため安全構成フォールバックを適用:`, errMsg);
    if (addLog) addLog(`✨ 第${epId}話 サーバー混雑のため、世界観に最適化された安全構成脚本で即座に制作を開始します！`, 'process');
  } finally {
    if (scriptHeartbeat) clearInterval(scriptHeartbeat);
  }

  const effCutCount = targetCutCount && targetCutCount > 0 ? targetCutCount : (isMangaMode ? 24 : (isMvMode ? 30 : 12));

  if (!scriptRes) {
    return {
      titleJp: currentPlan.titleJp,
      titleEn: currentPlan.titleEn,
      summary: currentPlan.summary || `${currentPlan.titleJp}の世界観で紡がれる物語`,
      characterDna: fallbackDna,
      eraAnalysisJp: '歴史・文化と人情の情景。',
      forbiddenAnachronisms: ['時代にそぐわない現代物'],
      authenticAttireEn: 'Authentic costume matching setting',
      forbiddenKeywordsEn: 'modern items',
      coverCatchphraseJp: `${currentPlan.titleJp}`,
      highlightWords: ['光', '風'],
      cuts: Array.from({ length: effCutCount }, (_, j) => {
        const isObj = j === 5 || j === 8; // Cut 6 or Cut 9 as object/insert
        const defaultGrid = isObj ? 'center' : 'top-center';
        const defaultCoord: [number, number] = isObj ? [0.5, 0.5] : [0.5, 0.3];
        const defaultSubject = isObj ? 'symbolic_object' : 'character_face';
        const defaultBasicPlot = isObj
          ? `Close-up shot of an iconic atmospheric object matching ${theme}, completely deserted with no people, moody lighting`
          : `${fixedChar ? `${fixedChar.dnaPromptEn} in a ` : ''}cinematic high quality visual scene, ${theme}, scene ${j + 1} of ${currentPlan.titleEn}, atmospheric lighting`;

        return {
          id: j + 1,
          panelLayout: 'single',
          isObjectOnly: isObj,
          focalPoint: {
            grid: defaultGrid as any,
            normalizedCoord: defaultCoord,
            focalSubject: defaultSubject
          },
          compositionPrompt: isObj 
            ? 'Centered close-up still-life composition focusing on iconic object' 
            : 'Subject framed at upper-third, face positioned at top-center, rule of thirds',
          basicPlot: defaultBasicPlot,
          narrationJp: isMvMode ? `第${epId}曲 歌詞パート${j + 1}` : `第${epId}話 場面${j + 1}の情景`,
          highlights: []
        };
      })
    };
  }

  const parsed = safeJsonParse<any>(scriptRes.text, {
    titleJp: currentPlan.titleJp,
    titleEn: currentPlan.titleEn,
    summary: currentPlan.summary || `${currentPlan.titleJp}の物語`,
    eraAnalysisJp: '演出構図とテロップ連動。',
    forbiddenAnachronisms: ['過剰な劇的演出'],
    authenticAttireEn: 'Cinematic style attire',
    forbiddenKeywordsEn: 'explosive drama',
    coverCatchphraseJp: '心揺さぶる一瞬の物語。',
    highlightWords: ['光'],
    cuts: []
  });

  const rawCuts = Array.isArray(parsed.cuts) ? parsed.cuts : (Array.isArray(parsed.scenes) ? parsed.scenes : (Array.isArray(parsed) ? parsed : []));
  const targetLength = rawCuts.length >= 20 ? rawCuts.length : effCutCount;
  const normalizedCuts = Array.from({ length: targetLength }, (_, j) => {
    const cutData = rawCuts[j] || {};
    const rawNarration = cutData.narrationJp || cutData.narration || (isMvMode ? `歌詞${j + 1}` : `場面${j + 1}`);
    
    const isObj = cutData.isObjectOnly !== undefined 
      ? Boolean(cutData.isObjectOnly) 
      : (j === 5);

    const rawFocal = cutData.focalPoint || {};
    const grid = rawFocal.grid || (isObj ? 'center' : 'top-center');
    const coord: [number, number] = Array.isArray(rawFocal.normalizedCoord) && rawFocal.normalizedCoord.length === 2
      ? [Number(rawFocal.normalizedCoord[0]) || 0.5, Number(rawFocal.normalizedCoord[1]) || (isObj ? 0.5 : 0.3)]
      : (isObj ? [0.5, 0.5] : [0.5, 0.3]);
    const subject = rawFocal.focalSubject || (isObj ? 'symbolic_object' : 'character_face');
    const basicPlot = cutData.basicPlot || cutData.promptEn || cutData.prompt || `${fixedChar && !isObj ? `${fixedChar.dnaPromptEn}, ` : ''}Scene ${j + 1} of ${currentPlan.titleEn}`;

    return {
      id: j + 1,
      panelLayout: 'single',
      basicPlot,
      narrationJp: sanitizeForYouTubeSafety(rawNarration),
      highlights: cutData.highlights || parsed.highlightWords || [],
      isObjectOnly: isObj,
      focalPoint: {
        grid,
        normalizedCoord: coord,
        focalSubject: subject
      },
      compositionPrompt: cutData.compositionPrompt || (isObj 
        ? 'Centered still-life composition of prop/object, rule of thirds, completely empty of people' 
        : 'Subject framed at upper-third, face centered at top-center, rule of thirds composition'),
    };
  });

  return {
    titleJp: cleanEpisodeTitle(sanitizeForYouTubeSafety(parsed.titleJp || currentPlan.titleJp)),
    titleEn: cleanEpisodeTitleEn(parsed.titleEn || currentPlan.titleEn),
    summary: sanitizeForYouTubeSafety(parsed.summary || currentPlan.summary || ''),
    characterDna: fixedChar ? fixedChar.dnaPromptEn : (parsed.characterDna || fallbackDna),
    eraAnalysisJp: sanitizeForYouTubeSafety(parsed.eraAnalysisJp || ''),
    forbiddenAnachronisms: parsed.forbiddenAnachronisms || [],
    authenticAttireEn: parsed.authenticAttireEn || '',
    forbiddenKeywordsEn: parsed.forbiddenKeywordsEn || '',
    coverCatchphraseJp: cleanEpisodeTitle(sanitizeForYouTubeSafety(parsed.coverCatchphraseJp || currentPlan.titleJp)),
    coverCatchphraseEn: parsed.coverCatchphraseEn || '',
    highlightWords: parsed.highlightWords || [],
    cuts: normalizedCuts
  };
}


