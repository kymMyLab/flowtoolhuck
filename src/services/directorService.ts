import { Cut, GenerationTask, GeneratorSettings, KenBurnsPreset, FocalPoint, SeriesEpisodePlan } from '../types';
import { 
  SAFE_CHARACTERS, 
  TASTES,
  resolveRecommendedCameraWorkAndKenBurns, 
  resolveRecommendedTelopStaging 
} from '../constants';
import { safeJsonParse, callWithRetry, formatDurationMs } from './utils';
import { 
  buildDynamicAntiPreviousNegative, 
  getStoryboardPreset, 
  buildFinalCinematicPromptAndNegative, 
  isMvChorusCut,
  MV_ANTI_CAMERA_LOOK_NEGATIVE,
  PreviousShotContext,
  resolveTasteKey,
  resolveTastePrompt
} from './promptEngine';

export type { PreviousShotContext as PreviousShotInfo };
export { resolveTasteKey, resolveTastePrompt };

/**
 * ── タイトル・テキスト整形ヘルパー ──
 */
export function sanitizeForYouTubeSafety(text: string): string {
  if (!text) return '';
  return text.replace(/[殺死血狂暴]/g, '★').replace(/(死ね|殺す|血まみれ|狂気|虐殺)/g, '危険').trim();
}

export function cleanEpisodeTitle(title: string): string {
  if (!title) return '';
  return title
    .replace(/^[\s🎵🎬💡🏮🎨⚓🖼️✨🔥\uD800-\uDBFF\uDC00-\uDFFF\u2600-\u27BF]+/g, '')
    .replace(/^【.*?】\s*/, '')
    .replace(/^(第\s*[\d０-９一二三四五六七八九十百千]+\s*[話曲章幕弾節巻]|Episode\s*[\d０-９一二三四五六七八九十百千]+|Ep\.\s*\d+|Track\s*\d+|Vol\.\s*\d+|Part\s*\d+|Chapter\s*\d+)[:：\s・\-ー]*/i, '')
    .replace(/(第\s*[\d０-９一二三四五六七八九十百千]+\s*[話曲章幕弾節巻]|Episode\s*[\d０-９一二三四五六七八九十百千]+|Ep\.\s*\d+|Track\s*\d+|Vol\.\s*\d+|Part\s*\d+|Chapter\s*\d+)[:：\s・\-ー]*/gi, '')
    .replace(/[\(（【\[]\s*(第\s*[\d０-９一二三四五六七八九十百千]+\s*[話曲章幕弾節巻]|Episode\s*\d+|Vol\.\d+|Track\s*\d+)\s*[\)）】\]]/gi, '')
    .replace(/[\(（【\[]\s*[起承転結・\s]+\s*[\)）】\]]/gi, '')
    .replace(/^[「『](.*?)[」』]$/, '$1')
    .trim();
}

export function cleanEpisodeTitleEn(title: string): string {
  if (!title) return '';
  return title
    .replace(/^(Episode\s*[\d０-９一二三四五六七八九十百千]+|Ep\.\s*\d+|Track\s*\d+|Vol\.\s*\d+|Part\s*\d+|Chapter\s*\d+)[:：\s・\-ー]*/i, '')
    .replace(/[\(（【\[]\s*(Episode\s*\d+|Vol\.\d+|Track\s*\d+)\s*[\)）】\]]\s*$/i, '')
    .trim();
}

export function checkIsHistorical(era: string = '', theme: string = ''): boolean {
  const combined = `${era} ${theme}`;
  if (['現代', '令和', '平成', 'バブル', 'SNS', 'ブラック企業', '社内不倫', 'タワマン', '推し活', 'マッチングアプリ'].some(k => combined.includes(k))) {
    return false;
  }
  return ['江戸', '幕末', '明治', '大正', '戦後', '昭和', '戦国', '平安', '鎌倉', '室町', '安土桃山', '古代', '中世', '大河', '吉原', '新選組', '浪人', '大名', '武士', '侍', '寺子屋', '飛脚', '岡っ引き', '火消し', '屋台めし', '薬売り', '鉄火場', '鼠小僧'].some(k => combined.includes(k));
}

export function extractHighlights(narrationText: string, suggestedWords: string[] = []): Array<{ word: string; color: string; sizeScale: number }> {
  if (!narrationText || !narrationText.trim()) return [];
  const validHighlights: Array<{ word: string; color: string; sizeScale: number }> = [];
  const neonColors = ['#FFE600', '#00F0FF', '#FF2A85', '#39FF14', '#FF7A00', '#BD00FF'];

  for (const rawWord of suggestedWords) {
    const word = (rawWord || '').trim();
    if (word && narrationText.includes(word) && word.length >= 1 && word.length <= 8 && !validHighlights.some(h => h.word === word)) {
      validHighlights.push({ word, color: neonColors[validHighlights.length % neonColors.length], sizeScale: 1.15 });
    }
  }

  const tryMatch = (pattern: RegExp, minLen = 2, maxLen = 6) => {
    if (validHighlights.length >= 2) return;
    const matches = narrationText.match(pattern);
    if (!matches) return;
    for (const word of Array.from(new Set(matches)).filter(w => w.length >= minLen && w.length <= maxLen)) {
      if (validHighlights.length >= 2) break;
      if (!validHighlights.some(h => h.word === word)) {
        validHighlights.push({ word, color: neonColors[validHighlights.length % neonColors.length], sizeScale: 1.15 });
      }
    }
  };

  tryMatch(/[\u4e00-\u9faf]{1,3}の[\u4e00-\u9faf]{1,3}/g, 3, 7);
  tryMatch(/[\u4e00-\u9faf]{2,4}/g, 2, 4);
  tryMatch(/[\u30a1-\u30f6]{2,6}/g, 2, 6);

  return validHighlights;
}

/**
 * 主人公キャラクターの三面図マスターシート生成プロンプトを構築
 */
export function buildCharacterTurnaroundPrompt(
  theme: string,
  country: string,
  era?: string,
  taste?: string,
  characterDna?: string,
  characterId?: string
): string {
  const fixedChar = (characterId && characterId !== 'auto')
    ? SAFE_CHARACTERS.find(c => c.id === characterId)
    : (characterDna ? SAFE_CHARACTERS.find(c => characterDna.includes(c.dnaPromptEn.slice(0, 24))) : undefined);

  const rawStyle = taste ? resolveTastePrompt(taste) : '';
  const isHist = checkIsHistorical(era, theme);
  let cleanStyle = rawStyle;
  if (!isHist && cleanStyle) {
    cleanStyle = cleanStyle.replace(/\b(edo period|feudal japan|ancient japan|ancient japanese)\b/gi, '').replace(/,\s*,/g, ',').trim();
  }

  if (fixedChar) {
    return `${fixedChar.turnaroundPromptEn}
Protagonist DNA: ${fixedChar.dnaPromptEn}.
${cleanStyle ? `Art style: ${cleanStyle}.` : ''}
CRITICAL MANDATE: EXACTLY THREE VIEWS (front, side, back) of ONE SINGLE INDIVIDUAL (${fixedChar.id}) aligned on a single clean white reference sheet. Maintain signature hair color, accessories, and outfit 100% faithfully.`;
  }

  const hasExplicitMale = /\b(male|boy|man|guy|men|masculine|男子|男の子|少年|男性|青年|オッサン|おじさん)\b/i.test(`${characterDna || ''} ${theme || ''}`);
  const defaultProtagonistDesc = hasExplicitMale 
    ? `Handsome aesthetic anime youth protagonist with neat modern styling.`
    : `Charming elegant anime female protagonist with neat modern school uniform attire.`;

  const protagonistProfile = characterDna ? `Protagonist design: ${characterDna}.` : defaultProtagonistDesc;
  const safeThemeDesc = (theme || 'Japanese youth drama').replace(/(少し着崩した|着崩した|ほどけかけた|乱れた|はだけた)/g, 'stylish').replace(/[^\w\s,\.\-]/g, ' ').trim() || 'Japanese school youth';

  return `Master character model sheet, three-view turnaround:
front view, side profile view, back view of the same single protagonist standing in a neutral pose side-by-side.
Full body from head to toe, perfectly consistent face, hairstyle, facial features, and attire.
${protagonistProfile} (Setting inspired by: ${safeThemeDesc})
Clean plain pure white background, professional animation concept art, character turnaround sheet, model sheet, masterpiece, highly detailed, 8k resolution.
${cleanStyle ? `Art style: ${cleanStyle}.` : ''}
CRITICAL MANDATE: EXACTLY THREE VIEWS (front, side, back) of ONE SINGLE INDIVIDUAL aligned on a single sheet. Absolutely NO multiple different people, NO cluttered props, NO extra poses!`;
}

/**
 * キャラクター画像からDNA（特徴）を抽出するためのプロンプトを構築
 */
export function buildCharacterScreeningPrompt(era: string = '', country: string = '', isMvMode?: boolean, theme: string = ''): string {
  const isHistorical = checkIsHistorical(era, theme);
  const contextDesc = isMvMode 
    ? `an indie aesthetic music video visual set in "${era || 'Modern'}", "${country || 'Japan'}"`
    : (isHistorical ? `a historical drama set in "${era || 'Historical Japan'}", "${country || 'Japan'}"` : `a visual drama set in "${era || 'Contemporary'}", "${country || 'Japan'}"`);

  const eraNegative = isHistorical 
    ? 'modern clothing, school uniform, sailor suit, blazer, necktie, modern casual, sneakers, eyeglasses, headphones, wristwatch, smartphone'
    : 'anachronistic armor, historic kimono in modern setting, out-of-place fantasy props';

  return `Analyze the character image for ${contextDesc}.
Identify facial features, hairstyles, expression, and distinctive aesthetic characteristics.
Output JSON: {
  "characterDna": "Description of facial features, hair, eyes, and physical traits",
  "styleDna": "Consistent artistic rendering medium (e.g. anime illustration, cel shading, pop art)",
  "antiPoseNegative": "awkward pose, unnatural anatomy, stiff posture",
  "eraNegative": "${eraNegative}"
}`;
}

/**
 * シリーズ全体のグランドデザイン（全話プロット）を生成するためのプロンプト
 */
export function buildGrandDesignPrompt(
  count: number, 
  country: string, 
  theme: string, 
  era?: string, 
  isMangaMode?: boolean, 
  isMvMode?: boolean,
  characterDna?: string,
  characterName?: string
): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  const noNumberRule = `CRITICAL RULE FOR TITLES (DO NOT INCLUDE EPISODE NUMBERS):
- "titleJp" and "titleEn" MUST BE PURE STANDALONE THEMATIC SUBTITLES without numbers (NEVER write "第1話：", "Episode 1:").`;

  if (isMvMode) {
    return `Create a ${count}-track music video visual series grand design with Concept & Theme: "${worldSetting}".
Analyze atmospheric mood, ambient lighting, nostalgic or serene emotion, and visual continuity.
${noNumberRule}
Output ONLY valid JSON:
{
  "seriesTitle": "Aesthetic MV Concept Collection",
  "overallSynopsis": "Overview of musical and visual atmosphere",
  "episodesPlan": [
    { "epNumber": 1, "titleJp": "情景を象徴する詩的な独立タイトル", "titleEn": "Poetic English Subtitle", "summary": "情景と空気感の描写（日本語2〜3行）" }
  ]
}`;
  }

  const protagonistInstruction = characterDna
    ? `CENTRAL PROTAGONIST: "${characterName || '主人公'}" (${characterDna}). Overarching story revolves around this central protagonist.`
    : `Ensure classic Four-Act (起承転結) continuity arc across all ${count} episodes.`;

  return `Create a full ${count}-episode serialized story grand design with World Theme & Setting: "${worldSetting}".
${protagonistInstruction}
${isMangaMode ? "Design pacing for dynamic comic/manga serialization with dramatic hooks." : ""}
${noNumberRule}
Output ONLY valid JSON:
{
  "seriesTitle": "Dramatic Series Title",
  "overallSynopsis": "Overview of entire narrative arc",
  "episodesPlan": [
    { "epNumber": 1, "titleJp": "この話独自の具体的サブタイトル（第X話は入れない）", "titleEn": "Standalone English Subtitle without numbers", "summary": "話のあらすじ" }
  ]
}`;
}

/**
 * 続編エピソード（第N話）のプロットを自律策定するためのプロンプト
 */
export function buildNextEpisodePlanPrompt(
  nextEpId: number,
  seriesTitle: string,
  overallSynopsis: string,
  previousEpisodes: Array<{ epNumber: number; titleJp: string; summary?: string }>,
  country: string,
  theme: string,
  era?: string,
  isMangaMode?: boolean
): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  const prevSummary = previousEpisodes.map(p => `第${p.epNumber}話「${cleanEpisodeTitle(p.titleJp)}」: ${p.summary || ''}`).join('\n');

  return `You are a world-class drama director and screenwriter continuing serialized drama "${seriesTitle}".
World Setting: "${worldSetting}". Overall Synopsis: "${overallSynopsis}".
Previous Narrative History:
${prevSummary}
Create compelling story outline for NEXT episode (Episode ${nextEpId}).
${isMangaMode ? "Design with intense comic/manga cliffhangers and pacing." : ""}
CRITICAL: "titleJp" and "titleEn" must be standalone subtitles WITHOUT episode numbers (NEVER write "第${nextEpId}話").
Output ONLY valid JSON:
{
  "epNumber": ${nextEpId},
  "titleJp": "この話独自の具体的サブタイトル（第X話は入れない）",
  "titleEn": "Standalone English Subtitle without numbers",
  "summary": "この話のあらすじ・展開（日本語2〜3行）"
}`;
}

/**
 * Google Flow Gemini 負荷軽減用: 必要最小限の出力構造に絞った軽量脚本プロンプト
 */
export function buildCompactScriptPrompt(
  epId: number, 
  currentPlan: SeriesEpisodePlan, 
  country: string, 
  theme: string, 
  era?: string, 
  isMangaMode?: boolean,
  isMvMode?: boolean,
  taste?: string,
  productionMode?: string,
  existingTitles?: string[],
  characterId?: string,
  targetCutCount?: number
): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  const effMode = productionMode || (isMvMode ? 'mv' : 'episodes');
  const cutCount = targetCutCount && targetCutCount > 0 ? targetCutCount : (effMode === 'manga' ? 24 : (effMode === 'mv' || isMvMode ? 30 : 12));
  const fixedChar = (characterId && characterId !== 'auto') ? SAFE_CHARACTERS.find(c => c.id === characterId) : undefined;
  const charDirective = fixedChar ? `\nPROTAGONIST LOCK: Protagonist MUST be "${fixedChar.nameJa}" (${fixedChar.dnaPromptEn}). Narration style: ${fixedChar.personality}. SAFETY: Never depict cruel abuse.` : '';
  const defaultCharDna = fixedChar ? fixedChar.dnaPromptEn : 'Consistent single protagonist matching the world setting and narrative';
  const rawStyle = taste ? resolveTastePrompt(taste) : '';

  const plannedTitleJp = cleanEpisodeTitle(currentPlan.titleJp || `場面${epId}`);
  const plannedTitleEn = cleanEpisodeTitleEn(currentPlan.titleEn || `Scene ${epId}`);
  const avoidDup = (existingTitles && existingTitles.length > 0) ? `AVOID DUPLICATE THEMES: Do NOT repeat [${existingTitles.join(', ')}].` : '';

  return `You are a film director and screenwriter.
Output a ${cutCount}-cut script for Episode ${epId} in "${worldSetting}".
Episode Concept: "${currentPlan.summary || plannedTitleJp}".
Art Style: "${taste || ''}" (${rawStyle}).
${avoidDup}

RULES:
1. "titleJp" and "titleEn" must be standalone subtitles WITHOUT episode numbers (e.g. "titleJp": "${plannedTitleJp}", "titleEn": "${plannedTitleEn}").
2. Protagonist: Define "characterDna" in English. All character cuts MUST feature this protagonist in "basicPlot".${charDirective}
3. Object Cut: Cut 6 should be an iconic object without humans ("isObjectOnly": true).

Output ONLY valid JSON:
{
  "titleJp": "${plannedTitleJp}",
  "titleEn": "${plannedTitleEn}",
  "summary": "${isMvMode ? '楽曲の世界観（日本語）' : 'あらすじ（日本語）'}",
  "characterDna": "${defaultCharDna}",
  "eraAnalysisJp": "時代背景の解説（日本語）",
  "cuts": [
    { 
      "id": 1, 
      "isObjectOnly": false,
      "basicPlot": "Front-three-quarters view of ${fixedChar ? fixedChar.dnaPromptEn : 'protagonist'} in atmospheric scene matching ${plannedTitleEn}", 
      "narrationJp": "${isMvMode ? '曲の歌詞20文字前後' : '日本語ナレーション20文字'}"
    }
  ]
};`;
}

export interface InfographicCoverPromptOptions {
  titleJp: string;
  titleEn?: string;
  coverCatchphraseJp?: string;
  coverCatchphraseEn?: string;
  theme?: string;
  era?: string;
  taste?: string;
  country?: string;
  productionMode?: string;
  characterDna?: string;
  styleDna?: string;
  forbiddenAnachronisms?: string[];
  authenticAttireEn?: string;
}

/**
 * 世界観・時代・ジャンルに完全適応するインフォグラフィック扉絵プロンプトを構築
 */
export function buildAdaptiveInfographicCoverPrompt(options: InfographicCoverPromptOptions): {
  promptEn: string;
  negativePromptEn: string;
} {
  const {
    titleJp,
    titleEn: _titleEn,
    coverCatchphraseJp,
    theme = '',
    era = '',
    taste = '',
    productionMode = 'episodes',
    characterDna,
    styleDna,
    forbiddenAnachronisms = [],
    authenticAttireEn = ''
  } = options;

  const isHist = checkIsHistorical(era, theme);
  const combinedContext = `${era} ${theme} ${productionMode}`.toLowerCase();
  const cleanTitle = cleanEpisodeTitle(titleJp) || titleJp;
  let cleanSubtitle = cleanEpisodeTitle(coverCatchphraseJp || '');
  if (cleanSubtitle === cleanTitle || cleanSubtitle.length < 2) cleanSubtitle = '';

  let mediumInstruction = `Premium cinematic vertical teaser poster, high-CTR commercial infographic design, striking visual hierarchy, professional cinematic color grading`;
  let typographyStyle = `Striking high-contrast Japanese poster headline typography reading "${cleanTitle}" centered inside floating title plaque in upper portion with safe breathing margin above`;
  let extraNegative = `cheap low-res flyer, amateur layout, chaotic clutter`;

  if (isHist) {
    mediumInstruction = `Authentic traditional Japanese artistic poster and editorial key visual (modern Ukiyo-e and Nihonga-inspired illustration), full-bleed scenic atmosphere with rich textured details, subtle washi texture, decorative border`;
    typographyStyle = `Prominent bold sumi-ink Japanese calligraphy plaque positioned in upper portion, displaying exact title "${cleanTitle}" with seal stamp`;
    extraNegative = `modern typography, digital fonts, English text overlay, plastic, neon cyberpunk, sneakers, modern clothing, wristwatch, smartphone`;
  } else if (productionMode === 'manzai' || combinedContext.includes('漫才') || combinedContext.includes('お笑い')) {
    mediumInstruction = `High-energy theatrical entertainment flyer poster (Yose comedy hall style), vibrant comedic composition, warm paper lanterns, bold stage lighting`;
    typographyStyle = `Dynamic Japanese theatrical headline typography boldly showing "${cleanTitle}" centered in floating marquee`;
    extraNegative = `dark horror, grim, somber, overly melancholic`;
  } else if (productionMode === 'trivia' || combinedContext.includes('雑学') || combinedContext.includes('解説')) {
    mediumInstruction = `Stunning commercial infographic editorial poster, high-CTR visual encyclopedia diagram layout, structured visual hierarchy, magazine cover aesthetic`;
    typographyStyle = `Bold high-impact Japanese editorial headline typography featuring "${cleanTitle}" centered in floating banner`;
    extraNegative = `messy collage, cluttered unintelligible scribbles, distorted diagrams`;
  } else if (productionMode === 'mv' || combinedContext.includes('音楽') || combinedContext.includes('mv')) {
    mediumInstruction = `Iconic music concept art poster and vinyl single cover design, evocative color grading, cinematic emotional narrative, subtle audio HUD visualizer accents`;
    typographyStyle = `Stylized Japanese music single headline typography reading "${cleanTitle}" centered in floating neon-accented audio plaque`;
    extraNegative = `boring layout, flat corporate diagram, low-effort snapshot`;
  }

  let focalSubject = characterDna 
    ? `Main focal subject: ${characterDna} ${isHist && authenticAttireEn ? `dressed in authentic ${authenticAttireEn}` : ''}, captured in medium-wide shot (framed from waist up or seated low) in lower two-thirds of canvas below floating title plaque.`
    : `Key thematic visual: Symbolic central subject embodying essence of "${theme}", framed in lower two-thirds beneath floating title plaque.`;

  const subtitleClause = cleanSubtitle ? `Integrated subtitle accent: "${cleanSubtitle}". (Do NOT write episode number digits).` : '';
  const resolvedTaste = taste ? resolveTastePrompt(taste) : (styleDna || '');
  const styleClause = resolvedTaste ? `Artistic rendering style: ${resolvedTaste}.` : '';

  const promptEn = [
    `Vertical 9:16 high-impact editorial cover poster and commercial infographic key visual.`,
    mediumInstruction + `.`,
    `Poster Layout: Cohesive full-bleed scene. Horizontal title signboard boldly displaying ONLY exact title "${cleanTitle}" positioned in upper area with 8%-12% safe breathing margin below top border. Mandatory: NEVER write episode numbers (NO "第1話", "Episode 1", "Vol.1")!`,
    focalSubject,
    typographyStyle + `.`,
    subtitleClause,
    styleClause,
    `Composition: Vertical 9:16 aspect ratio, harmonious editorial hierarchy. Main character framed below title plaque with ample breathing room. Masterpiece, 8k resolution.`
  ].filter(Boolean).join(' ');

  const baseNegative = `episode number, episode counter, "第1話", "第2話", "Episode 1", "Episode 2", "Vol.1", numbered badge, giant blank void at top, banner touching top edge, text crammed against ceiling, text overlapping character head, blurry, low resolution, bad anatomy, duplicate character, ugly, artifacts`;
  const negativePromptEn = [baseNegative, extraNegative, forbiddenAnachronisms.join(', ')].filter(Boolean).join(', ');

  return { promptEn, negativePromptEn };
}

/**
 * 直前のカットの構図・ポーズ・アングルを排除するための動的ネガティブプロンプト
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
      { maxRetries: 2, superBackoff: false, abortCheck }
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
        const isObj = j === 5 || j === 8;
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
    const isObj = cutData.isObjectOnly !== undefined ? Boolean(cutData.isObjectOnly) : (j === 5);
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
      focalPoint: { grid, normalizedCoord: coord, focalSubject: subject },
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
