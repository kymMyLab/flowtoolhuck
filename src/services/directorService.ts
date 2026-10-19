import { Flow } from 'flow-sdk';
import { Cut, GenerationTask, GeneratorSettings, KenBurnsPreset, SeriesEpisodePlan, FocalPoint } from '../types';
import { IMAGE_MODELS, DEFAULT_ASPECT_RATIO, STRICT_STYLE_SUFFIX, TASTES } from '../constants';
import { resolveTastePrompt } from './tasteStorage';
import { safeJsonParse, callWithRetry, formatDurationMs } from './utils';
import { 
  getProductionModeConfig, 
  resolveCameraWork, 
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

// ── テキスト整形・抽出ヘルパー群 ──
import {
  cleanEpisodeTitle,
  cleanEpisodeTitleEn,
  checkIsHistorical,
  extractHighlights,
  buildLyricLines,
  sanitizeForYouTubeSafety,
  LyricSegment,
  LyricLine
} from './directorTextHelpers';

// ── 映画監督プロンプト生成群 ──
import {
  buildCharacterTurnaroundPrompt,
  buildCharacterScreeningPrompt,
  buildGrandDesignPrompt,
  buildNextEpisodePlanPrompt,
  buildScriptPrompt,
  buildCompactScriptPrompt,
  buildAdaptiveInfographicCoverPrompt,
  InfographicCoverPromptOptions
} from './directorPrompts';

export {
  cleanEpisodeTitle,
  cleanEpisodeTitleEn,
  checkIsHistorical,
  extractHighlights,
  buildLyricLines,
  sanitizeForYouTubeSafety,
  buildCharacterTurnaroundPrompt,
  buildCharacterScreeningPrompt,
  buildGrandDesignPrompt,
  buildNextEpisodePlanPrompt,
  buildScriptPrompt,
  buildCompactScriptPrompt,
  buildAdaptiveInfographicCoverPrompt
};
export type { LyricSegment, LyricLine, InfographicCoverPromptOptions };

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

/**
 * 8秒間のシネマティック・アクション進化ディレクティブを自律生成
 * Start絵のシチュエーション（PC/ベッド/窓/ヘッドホン/ドリンク等）を解析し、
 * 同一キャラクター・同一衣装・同一部屋・同一トーンを厳格に固定したまま、
 * 8秒後の生き生きとした到達点ポーズ・表情（endFramePlot）と、
 * それを繋ぐ8秒補間モーション指示（veoMotionPrompt）を決定する。
 */
export interface CinematicEvolution {
  endFramePlot: string;
  veoMotionPrompt: string;
}

export function resolveCinematicEndFrameAndMotion(options: {
  cutIndex: number; // 0 to 11
  basicPlot: string;
  isObjectOnly?: boolean;
  theme?: string;
  isMvMode?: boolean;
  isMangaMode?: boolean;
  existingEndPlot?: string;
  existingVeoMotion?: string;
}): CinematicEvolution {
  const { cutIndex, basicPlot, isObjectOnly, theme = '', existingEndPlot, existingVeoMotion } = options;

  // 既にGemini等から独自性のある endFramePlot が生成されている場合（basicPlot と完全一致ではなく、20文字以上）
  if (existingEndPlot && existingEndPlot.trim() !== basicPlot.trim() && existingEndPlot.length > 20 && existingVeoMotion) {
    return {
      endFramePlot: existingEndPlot.trim(),
      veoMotionPrompt: existingVeoMotion.trim()
    };
  }

  // 1. 物体・静物カット（Cut 6 または isObjectOnly）
  if (isObjectOnly || cutIndex === 5) {
    return {
      endFramePlot: `Relative to the start frame: camera circles in a 45-degree macro orbit around the scene, ambient light reflections sliding naturally across identical surfaces while keeping the same environment and props.`,
      veoMotionPrompt: 'Continuous 8-second macro curved orbit: [Beginning] camera starts framed close on the iconic focal object, [Midway] glides in a smooth 45-degree horizontal arc around the object, sweeping ambient reflections across its surface, [Finally] settling at a stylish three-quarter hero angle with shallow depth-of-field and zero object deformation.'
    };
  }

  // 2. 普遍的相対シネマティック指示（元絵に対して●●）
  // 【Beginning（初めに） ➔ Midway（途中で） ➔ Finally（最後に）】の3段時系列で中間の情景推移を明示
  // どんな世界観・人物でも100%通用し、空間歪み・溶け・ダブル人物を完全防止
  const universalDroneMotions: CinematicEvolution[] = [
    // Pattern 1: 180度リバースクレーンプルアウト（映画的切り返しショット）
    {
      endFramePlot: `Relative to the start frame: camera elevates and pulls back into a grand 180-degree reverse wide crane perspective, capturing the subject from the opposite angle within the expansive ambient environment, revealing the previously unseen opposite space while keeping identical character appearance, clothing, and atmosphere.`,
      veoMotionPrompt: 'Continuous 8-second reverse crane pullout: [Beginning] camera starts on the subject and begins rising while pivoting 180 degrees, [Midway] smoothly gliding backward high into the surrounding air revealing the lateral environment in continuous fluid parallax, [Finally] settling into a grand, cinematic wide counter-shot composition while keeping the subject and environment in perfect, coherent focus throughout.'
    },
    // Pattern 2: 俯瞰クレーン上昇（フロアと空間の幾何学）
    {
      endFramePlot: `Relative to the start frame: camera ascends into an overhead bird's-eye high angle looking down, revealing floor space and surroundings while keeping the same subject and relaxed posture.`,
      veoMotionPrompt: 'Continuous 8-second smooth crane ascent: [Beginning] camera starts at eye level with the subject, [Midway] ascends smoothly upward in a vertical arc, passing overhead ambient light fixtures and revealing the geometry of the surrounding floor, [Finally] gently settling into a breathtaking high-angle bird\'s-eye view looking down on the subject in perfect tranquil continuity.'
    },
    // Pattern 3: ドローン広角プルバック（引きの画角）
    {
      endFramePlot: `Relative to the start frame: camera pulls back in a graceful wide drone shot, revealing more of the atmospheric room while the same subject stays quietly centered.`,
      veoMotionPrompt: 'Continuous 8-second cinematic drone pullout: [Beginning] camera holds on the character in medium framing, [Midway] glides straight backward in a steady continuous retreat, drawing back through the atmospheric air and expanding the horizontal depth of the setting, [Finally] settling into a majestic wide-angle establishing tableau where the subject remains a coherent, dignified focal point.'
    },
    // Pattern 4: スロープッシュイン（寄りの画角・クローズアップ）
    {
      endFramePlot: `Relative to the start frame: camera glides gently forward into a closer medium shot, drawing closer to the subject's thoughtful expression and soft ambient glow.`,
      veoMotionPrompt: 'Continuous 8-second slow push-in: [Beginning] camera begins in a relaxed medium view, [Midway] glides steadily forward along the central line of sight, smoothly crossing foreground ambient atmosphere with gentle depth-of-field narrowing, [Finally] resting comfortably in an intimate close-up that captures the subject\'s emotional nuance and natural breathing without any abrupt jump.'
    },
    // Pattern 5: 視線と首振りのドラマチックシフト
    {
      endFramePlot: `Relative to the start frame: holding the same framing, the subject gently turns their head and shifts their gaze toward the ambient light with a subtle reflective expression.`,
      veoMotionPrompt: 'Continuous 8-second organic emotional evolution: [Beginning] subject looks pensively forward in still posture, [Midway] camera executes a slow micro-push while the subject gently shifts their gaze and turns their head toward the soft side lighting, [Finally] settling into a contemplative, serene side-profile nuance with natural subtle hair movement and organic presence.'
    },
    // Pattern 6: 斜め45度マクロオービット（静物・ディテール）
    {
      endFramePlot: `Relative to the start frame: camera circles in a 45-degree macro orbit around the scene, ambient light reflections sliding naturally across identical surfaces.`,
      veoMotionPrompt: 'Continuous 8-second macro curved orbit: [Beginning] camera frames the iconic details in sharp macro focus, [Midway] glides in a smooth 45-degree horizontal arc around the subject, sweeping ambient specular highlights across the textures, [Finally] resolving at a stylish three-quarter hero angle with shallow depth-of-field and pristine visual fidelity.'
    },
    // Pattern 7: ダッチアングル・ダイアゴナルチルト
    {
      endFramePlot: `Relative to the start frame: camera shifts into a stylish diagonal Dutch angle from slightly elevated side, adding artistic geometric depth to the identical scene.`,
      veoMotionPrompt: 'Continuous 8-second diagonal tilt tracking: [Beginning] camera begins in level standard framing, [Midway] smoothly tracks diagonally while tilting the horizon into a stylish 15-degree Dutch angle, revealing geometric leading lines and dynamic background perspective, [Finally] locking into a bold, modern artistic frame with rock-solid subject stability.'
    },
    // Pattern 8: サビ・正面アイレベル情熱プッシュ
    {
      endFramePlot: `Relative to the start frame: camera pushes forward at eye level, the subject turning to look directly at the viewer with focused emotional intensity and vibrant presence.`,
      veoMotionPrompt: 'Continuous 8-second dramatic climax push: [Beginning] subject sits or stands in ambient reverie, [Midway] camera surges forward with confident momentum as the subject purposefully turns their gaze to lock eyes with the lens, [Finally] blooming into a vibrant, high-intensity hero portrait framed in crisp dramatic lighting and unbroken character identity.'
    },
    // Pattern 9: オーバーショルダー・前方展望スライド
    {
      endFramePlot: `Relative to the start frame: camera slides gently behind the subject's shoulder, framing the wide view unfolding in front of them in soft poetic depth.`,
      veoMotionPrompt: 'Continuous 8-second over-the-shoulder glide: [Beginning] camera starts slightly to the side of the subject, [Midway] glides around in a subtle curved trajectory to position just behind their shoulder, passing close silhouette contours, [Finally] opening up the vast panorama in front of them, using the subject\'s shoulder as a steady poetic depth anchor.'
    },
    // Pattern 10: 水平ラテラル・トラッキング（豊かな視差）
    {
      endFramePlot: `Relative to the start frame: camera glides laterally along a horizontal tracking arc, subtle parallax shifting the background elements while keeping the character centered.`,
      veoMotionPrompt: 'Continuous 8-second horizontal tracking glide: [Beginning] camera frames the subject from an initial angle, [Midway] tracks steadily sideways in a gentle curved arc, generating rich realistic parallax between foreground elements and background walls, [Finally] settling smoothly on the opposite side angle while keeping the subject completely steady and unchanged at the center of the frame.'
    },
    // Pattern 11: コージー浮遊クレーンドリフト
    {
      endFramePlot: `Relative to the start frame: camera floats gently upward and tilts downward in a cozy high angle, capturing a quiet, peaceful view of the same scene.`,
      veoMotionPrompt: 'Continuous 8-second floating crane ascent: [Beginning] camera hovers comfortably near eye level, [Midway] gently floats upward like a balloon while tilting downward at a soft 30-degree angle, sweeping warm ambient lighting across the setting, [Finally] easing into a cozy, comforting high perspective that embraces the entire quiet scene.'
    },
    // Pattern 12: フィナーレ・スカイハイプルアップ
    {
      endFramePlot: `Relative to the start frame: camera glides upward and backward in an expansive finale vista shot, opening up the entire cinematic atmosphere in majestic resolution.`,
      veoMotionPrompt: 'Continuous 8-second majestic skyward pullout: [Beginning] camera centers on the protagonist during their final beat, [Midway] ascends backward into the sky on a high crane sweep, revealing the full horizon, distant lights, and expansive atmospheric grandeur, [Finally] settling into an epic, breathtaking final tableau with the character gracefully integrated into the boundless world.'
    }
  ];

  return universalDroneMotions[cutIndex % universalDroneMotions.length];
}

/**
 * 画像生成用の最終プロンプトとネガティブプロンプトを構築
 * （Media Vault 6層レイヤー＆定義駆動エンジンに委譲）
 */
export const buildImagePromptAndNegative = buildFinalCinematicPromptAndNegative;

/**
 * カットごとの演出データ（構図、テロップ、ケンバーン効果）をAIで決定
 * （studioDefinitions および promptEngine に基づく宣言的ロジック駆動）
 */
export async function directShot(
  task: GenerationTask,
  settings: GeneratorSettings,
  activeReference: any,
  previousShotInfo?: PreviousShotContext,
  addLog?: (msg: string, type?: any) => void
): Promise<Partial<Cut>> {
  const { cutId, prompt, styleKey } = task;
  const rawStyle = resolveTastePrompt(styleKey);
  const effectiveDna = task.characterDna || activeReference?.characterDna;
  const isObjectCut = !!task.isObjectOnly;
  const characterGuidance = isObjectCut
    ? 'OBJECT/INSERT CUT: This scene features strictly NO HUMANS. Focus purely on the iconic object, still-life, or environmental scenery.'
    : effectiveDna
      ? `EXACT PROTAGONIST CONSISTENCY MANDATE: The protagonist is explicitly defined as: "${effectiveDna}".
You MUST retain THIS EXACT SAME character (same gender, same age, same hairstyle, same hair color, same eyes, same clothing style/accessories). DO NOT alter their face or clothing.`
      : activeReference 
        ? `Protagonist: ${activeReference.characterDna}. NOTE: Adopt only the character's appearance and distinctive features (face, hair, eyes); DO NOT copy reference pose.` 
        : 'Consistent single protagonist throughout the entire story.';

  // 定義テーブルから本カットの演出プリセットおよびカメラワーク＆ケンバーンを取得
  const preset = getStoryboardPreset(cutId, settings.isMvMode, settings.isMangaMode);
  const recCw = resolveRecommendedCameraWorkAndKenBurns(
    cutId,
    settings.productionMode,
    settings.isMvMode,
    settings.isMangaMode
  );
  const kbPreset: KenBurnsPreset = recCw.recommendedKenBurns;

  const directorRole = settings.isMvMode ? "music video (MV) visual director" : settings.isMangaMode ? "comic book/manga storyboard artist" : "film director";
  
  // MVモード時のカメラ目線厳格制御（サビ区間[Cut 17〜24]のみ許可、他は一切カメラを見ない）
  const isAllowedEyeContact = settings.isMvMode && isMvChorusCut(cutId, 30);
  const mvGazeMandate = settings.isMvMode 
    ? (isAllowedEyeContact 
        ? "CRITICAL MV CLIMAX GAZE: This is the ONLY single cut in the entire music video where direct eye contact with the camera is permitted for powerful emotional resonance." 
        : "CRITICAL MV GAZE MANDATE: The subject MUST NOT look at the camera/viewer under any circumstances! Direct the character looking away, gazing into the distance, eyes cast downward in thought, in pure side profile, or seen from behind. Strict candid documentary aesthetic—never break the fourth wall.")
    : "";

  const mvExtraDirecting = settings.isMvMode 
    ? `MANDATORY FOR MV MODE: Atmospheric, ambient, and seamless continuity. Subdued, introspective, and aesthetic expression. No shouting, no melodramatic action poses, no theatrical over-acting. Natural, gentle movements or contemplative gaze matching the background mood. ${mvGazeMandate}` 
    : "";
  const mangaExtraDirecting = settings.isMangaMode 
    ? "MANDATORY FOR MANGA: Full-bleed edge-to-edge artwork ONLY. Never generate panel borders, white gutters, frames, or blank margins. Fill the entire canvas with dynamic pen-inking, screentones, cel-shading, dynamic facial expressions, and comic-style impact." 
    : "";

  const previousContrastMandate = previousShotInfo?.scale
    ? `CRITICAL CINEMATIC CONTRAST MANDATE:
The PREVIOUS CUT (Cut ${cutId - 1}) was framed as: [${previousShotInfo.scale}] with angle: "${previousShotInfo.angle || previousShotInfo.tag || ''}".
Context of previous cut: "${previousShotInfo.prompt?.slice(0, 120) || ''}".
MANDATORY RULE: This Cut ${cutId} MUST BE RADICALLY DIFFERENT from the previous cut!
- If the previous cut was seated or on the floor, THIS CUT MUST BE standing, walking, in motion, or a dramatic bust portrait!
- NEVER repeat the same camera distance, angle, or character posture as the previous cut.
- Requested Framing for THIS cut is: ${preset.scale} (${preset.angle}).`
    : `Requested Framing: ${preset.scale} (${preset.angle}).`;

  const isHistorical = checkIsHistorical(settings.era, settings.theme);
  const genreDesc = settings.isMvMode 
    ? "an aesthetic music video" 
    : settings.isMangaMode 
      ? "a dramatic comic/manga series" 
      : isHistorical 
        ? "a historical drama" 
        : "a cinematic visual drama";

  const wardrobeDesc = settings.isMvMode
    ? "stylish aesthetic wardrobe matching the music video theme"
    : isHistorical
      ? "authentic historical period attire"
      : "natural character attire matching the setting";

  const defaultTelop = resolveRecommendedTelopStaging(
    cutId, 
    settings.isMvMode, 
    isHistorical, 
    previousShotInfo?.telop,
    settings.productionMode
  );

  const isMultiPanelActive = !!(settings.isMultiPanel || task.isMultiPanel);
  const rawPanelLayout = task.panelLayout || (isMultiPanelActive ? 'dynamic-multi' : 'single');
  const multiPanelExtraDirecting = (isMultiPanelActive && rawPanelLayout !== 'single')
    ? `MANDATORY MULTI-PANEL COMIC COMPOSITION (${rawPanelLayout}):
Create a dynamic split comic panels composition with seamless full-bleed edge-to-edge artwork.
- Absolutely NO white outer borders, NO blank page margins!
- Clearly divided separate panel frames.
- If one panel features a character, other panels MUST focus on world-appropriate background scenery (matching the setting), props, atmospheric lighting, or distinct camera angles.
- NEVER stack or overlap characters directly on top of each other! Keep composition spacious with visual breathing room.`
    : '';

  const directorPrompt = `You are a ${directorRole} designing a visual shot and motion-graphics telop staging for ${genreDesc}.
Context: "${prompt}".
Style: "${rawStyle}".
${characterGuidance}
${previousContrastMandate}

Avoid scale errors. If wide shot, character MUST be small and background realistic. If close-up, show head/shoulders with natural proportions.
COLOR & MEDIUM FIDELITY: Maintain the authentic color grading, vibrant lighting, and visual medium of "${rawStyle}". Do NOT describe scenes as monochrome, grayscale, pencil sketch, or manga screentones unless the chosen style is explicitly monochrome.
${mangaExtraDirecting}
${mvExtraDirecting}
${multiPanelExtraDirecting}

Output ONLY valid JSON:
{
  "enhancedPrompt": "Extremely detailed scene description in English including lighting, props, ${wardrobeDesc}, atmosphere, shot angle, and distinct character pose/action",
  "cameraWork": "${recCw.label}",
  "cinematicAngle": "${preset.angle}",
  "shotScale": "${preset.scale}",
  "telopStyle": "${defaultTelop.style}",
  "telopTransition": "${defaultTelop.transition}",
  "directorTelopNote": "${defaultTelop.directorNote}"
}`;

  const effectiveScale = task.shotScale || preset.scale;
  const effectiveAngle = task.cinematicAngle || preset.angle;

  // 定義テーブルに基づき直前構図を自動除外するネガティブ文字列を生成
  let antiPreviousNegative = buildDynamicAntiPreviousNegative(previousShotInfo, effectiveScale);
  if (settings.isMvMode && !isAllowedEyeContact) {
    antiPreviousNegative = antiPreviousNegative ? `${antiPreviousNegative}, ${MV_ANTI_CAMERA_LOOK_NEGATIVE}` : MV_ANTI_CAMERA_LOOK_NEGATIVE;
  }
  if (isMultiPanelActive) {
    const multiPanelNeg = 'white outer border, page margins, white paper border, blank border, picture frame, overlapping characters, stacked people, people sitting on top of each other, merged humans, duplicate characters overlapping';
    antiPreviousNegative = antiPreviousNegative ? `${antiPreviousNegative}, ${multiPanelNeg}` : multiPanelNeg;
  }

  // プロンプトにすでにカメラディレクティブが含まれている場合は二重付与せず最高解像度の指示を優先
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
  isMultiPanel?: boolean;
  existingTitles?: string[];
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

export interface LyricVisualDirective {
  cutId: number;
  stagingType: 'character_with_props' | 'character_focused' | 'scenic_prop_insert';
  propMotif?: string;
  action?: string;
  visualPromptEn: string;
}

/**
 * Geminiによる楽曲歌詞・ビジュアル自律判断＆映画的緩急バランスエンジン
 * 30カット全体の歌詞コンテキストを俯瞰し、人物主導(65-75%) / 人物×環境小道具(15-25%) / 静物インサート(最大2-3カット)の
 * 映画的緩急バランスを保ちながら、各カットの作画演出英文プロンプトを決定論的に導出
 */
export async function analyzeLyricVisualsWithGemini(
  lyricLines: { cutId: number; lyric: string; section?: string }[],
  theme: string,
  characterContext: string
): Promise<LyricVisualDirective[] | null> {
  if (!lyricLines || lyricLines.length === 0) return null;

  const prompt = `You are a master cinema/anime MV director.
Analyze the following song lyrics and determine the optimal visual motifs, props, and staging directives for each cut.

Theme: "${theme}"
Protagonist context: "${characterContext}"

Lyrics to analyze:
${JSON.stringify(lyricLines, null, 2)}

CRITICAL BALANCING RULE:
A music video must center on human emotion, expressive faces, and kinetic drama.
- Character-Driven Cuts (65%–75%): Protagonist's expressive eyes, bust shots, side profiles, singing postures, walking, looking up at the sky, contemplative glances.
- Integrated Prop & Environment Cuts (15%–25%): Protagonist interacting within the environment where the lyric's props naturally appear (e.g., sitting at table with mugs, holding umbrella, riding bike).
- Dedicated Still-Life Inserts (MAXIMUM 2–3 CUTS ACROSS THE ENTIRE SONG): Pure macro prop shots without humans for punchy dramatic cutaways (e.g., key emotional transition points).

Output ONLY a JSON array of objects with the exact following keys:
[
  {
    "cutId": 1,
    "stagingType": "character_with_props" | "character_focused" | "scenic_prop_insert",
    "propMotif": "string (e.g., two ceramic coffee mugs side by side with rising steam)",
    "action": "string (e.g., sitting at table in contemplative stillness, looking out the window)",
    "visualPromptEn": "string (detailed English visual prompt incorporating the motif, action, cinematic depth, and lighting)"
  }
]`;

  try {
    const res = await callWithRetry<any>(
      () => Flow.generate.text(prompt),
      (attempt, max, delay) => {
        console.warn(`[Gemini Lyric Analysis Retry ${attempt}/${max}]`);
      },
      { maxRetries: 2 }
    );
    if (!res) return null;

    const parsed = safeJsonParse<any[]>(res?.text || res, []);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed as LyricVisualDirective[];
    }
    return null;
  } catch (err) {
    console.warn('Failed to analyze lyrics with Gemini:', err);
    return null;
  }
}

/**
 * 全制作モード共通の鉄壁な脚本生成エンジン
 * 第1段階: タイトル、あらすじ、各Cutの歌詞・基本状況のみを超軽量プロンプトで即座に策定
 * （※各カットの詳細な作画演出・カメラワーク・直前対比は、画像描画直前に directShot がオンデマンドで生成）
 */
export async function generateSafeEpisodeScript(opts: GenerateSafeScriptOptions): Promise<SafeScriptResult> {
  const {
    epId, currentPlan, country, theme, era, isMangaMode, isMvMode,
    taste, productionMode, isMultiPanel, existingTitles, superBackoff, abortCheck, addLog
  } = opts;

  // 初手から無駄な長文指示を削ぎ落とした軽量骨組みプロンプトを使用（1〜2秒で即座に通す）
  const scriptPrompt = buildCompactScriptPrompt(
    epId, currentPlan as any, country, theme, era, isMangaMode, isMvMode, taste, productionMode, isMultiPanel, existingTitles
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

  if (!scriptRes) {
    return {
      titleJp: currentPlan.titleJp,
      titleEn: currentPlan.titleEn,
      summary: currentPlan.summary || `${currentPlan.titleJp}の世界観で紡がれる物語`,
      characterDna: isMvMode 
        ? 'Consistent 19yo Japanese girl, soft wavy dark brown chin-length bob hair, gentle eyes, oversized cozy knit cardigan, sleek over-ear headphones'
        : 'Consistent single protagonist matching the world setting and narrative',
      eraAnalysisJp: '歴史・文化と人情の情景。',
      forbiddenAnachronisms: ['時代にそぐわない現代物'],
      authenticAttireEn: 'Authentic costume matching setting',
      forbiddenKeywordsEn: 'modern items',
      coverCatchphraseJp: `${currentPlan.titleJp}`,
      highlightWords: ['光', '風'],
      cuts: Array.from({ length: isMangaMode ? 24 : (isMvMode ? 30 : 12) }, (_, j) => {
        const isObj = j === 5 || j === 8; // Cut 6 or Cut 9 as object/insert
        const defaultGrid = isObj ? 'center' : 'top-center';
        const defaultCoord: [number, number] = isObj ? [0.5, 0.5] : [0.5, 0.3];
        const defaultSubject = isObj ? 'symbolic_object' : 'character_face';
        const defaultBasicPlot = isObj
          ? `Close-up shot of an iconic atmospheric object matching ${theme}, completely deserted with no people, moody lighting`
          : `Cinematic high quality visual scene, ${theme}, scene ${j + 1} of ${currentPlan.titleEn}, atmospheric lighting`;

        const evolution = resolveCinematicEndFrameAndMotion({
          cutIndex: j,
          basicPlot: defaultBasicPlot,
          isObjectOnly: isObj,
          theme,
          isMvMode,
          isMangaMode
        });

        const dynamicLayoutCycle = ['diagonal-slash', 'l-shaped', 'panoramic-split', 'inset-reaction', 'vertical-split', 'split-2', 'single'];
        return {
          id: j + 1,
          panelLayout: isMultiPanel ? dynamicLayoutCycle[j % dynamicLayoutCycle.length] : 'single',
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
          veoMotionPrompt: evolution.veoMotionPrompt,
          endFramePlot: evolution.endFramePlot,
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
  const effCutCount = isMangaMode ? 24 : (isMvMode ? 30 : 12);
  const targetLength = rawCuts.length >= 20 ? rawCuts.length : effCutCount;
  const normalizedCuts = Array.from({ length: targetLength }, (_, j) => {
    const cutData = rawCuts[j] || {};
    const rawNarration = cutData.narrationJp || cutData.narration || (isMvMode ? `歌詞${j + 1}` : `場面${j + 1}`);
    
    // 物体カットの判定（AI指定、またはCut 6をデフォルトで物体カットに指定）
    const isObj = cutData.isObjectOnly !== undefined 
      ? Boolean(cutData.isObjectOnly) 
      : (j === 5); // Cut 6 is iconic insert by default

    // 9分割focalPointのパースと正規化
    const rawFocal = cutData.focalPoint || {};
    const grid = rawFocal.grid || (isObj ? 'center' : 'top-center');
    const coord: [number, number] = Array.isArray(rawFocal.normalizedCoord) && rawFocal.normalizedCoord.length === 2
      ? [Number(rawFocal.normalizedCoord[0]) || 0.5, Number(rawFocal.normalizedCoord[1]) || (isObj ? 0.5 : 0.3)]
      : (isObj ? [0.5, 0.5] : [0.5, 0.3]);
    const subject = rawFocal.focalSubject || (isObj ? 'symbolic_object' : 'character_face');
    const basicPlot = cutData.basicPlot || cutData.promptEn || cutData.prompt || `Scene ${j + 1} of ${currentPlan.titleEn}`;

    const evolution = resolveCinematicEndFrameAndMotion({
      cutIndex: j,
      basicPlot,
      isObjectOnly: isObj,
      theme,
      isMvMode,
      isMangaMode,
      existingEndPlot: cutData.endFramePlot,
      existingVeoMotion: cutData.veoMotionPrompt
    });

    const dynamicLayoutCycle = ['diagonal-slash', 'l-shaped', 'panoramic-split', 'inset-reaction', 'vertical-split', 'split-2', 'single'];
    const chosenLayout = (cutData.panelLayout && cutData.panelLayout !== 'split-3' && cutData.panelLayout !== 'dynamic-multi')
      ? cutData.panelLayout
      : (isMultiPanel ? dynamicLayoutCycle[j % dynamicLayoutCycle.length] : 'single');

    return {
      id: j + 1,
      panelLayout: chosenLayout,
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
      veoMotionPrompt: evolution.veoMotionPrompt,
      endFramePlot: evolution.endFramePlot
    };
  });

  return {
    titleJp: cleanEpisodeTitle(sanitizeForYouTubeSafety(parsed.titleJp || currentPlan.titleJp)),
    titleEn: cleanEpisodeTitleEn(parsed.titleEn || currentPlan.titleEn),
    summary: sanitizeForYouTubeSafety(parsed.summary || currentPlan.summary || ''),
    characterDna: parsed.characterDna || (isMvMode 
      ? 'Consistent 19yo Japanese girl, soft wavy dark brown chin-length bob hair, gentle eyes, oversized cozy knit cardigan, sleek over-ear headphones' 
      : undefined),
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

