import { SeriesEpisodePlan } from '../types';
import { getProductionModeConfig } from '../config/studioDefinitions';
import { resolveTastePrompt } from './tasteStorage';
import { checkIsHistorical, cleanEpisodeTitle, cleanEpisodeTitleEn } from './directorTextHelpers';

/**
 * 主人公キャラクターの三面図（正面・横顔・後ろ姿）マスターシート生成プロンプトを構築
 */
export function buildCharacterTurnaroundPrompt(
  theme: string,
  country: string,
  era?: string,
  taste?: string,
  characterDna?: string
): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  const rawStyle = taste ? resolveTastePrompt(taste) : '';
  const isHist = checkIsHistorical(era, theme);
  const costumeInstruction = isHist 
    ? `Strictly authentic historical attire matching ${era || 'period Japan'}. No modern elements.` 
    : `Aesthetic, evocative outfit and styling fitting ${worldSetting}.`;

  const protagonistProfile = characterDna 
    ? `Protagonist design: ${characterDna}.` 
    : `Protagonist designed for ${worldSetting}.`;

  return `Master character model sheet, three-view turnaround:
front view, side profile view, back view of the same single protagonist standing in a neutral pose side-by-side.
Full body from head to toe, perfectly consistent face, hairstyle, facial features, and attire.
${protagonistProfile} (${costumeInstruction})
Clean plain pure white background, professional animation concept art, character turnaround sheet, model sheet, masterpiece, highly detailed, 8k resolution.
${rawStyle ? `Art style: ${rawStyle}.` : ''}
CRITICAL MANDATE: EXACTLY THREE VIEWS (front, side, back) of ONE SINGLE INDIVIDUAL aligned on a single sheet. Absolutely NO multiple different people, NO cluttered props, NO extra poses!`;
}

/**
 * キャラクター画像からDNA（特徴）を抽出するためのプロンプトを構築
 */
export function buildCharacterScreeningPrompt(era: string = '', country: string = '', isMvMode?: boolean, theme: string = ''): string {
  const isHistorical = checkIsHistorical(era, theme);
  
  if (isMvMode) {
    return `Analyze the character image for an indie aesthetic music video visual set in "${era || 'Modern'}", "${country || 'Japan'}".
Identify facial features, hairstyles, expression, and distinctive aesthetic characteristics.
Output JSON: {
  "characterDna": "Description of facial features, hair, eyes, and physical traits",
  "styleDna": "Consistent artistic rendering medium (e.g. anime illustration, cel shading, pop art)",
  "antiPoseNegative": "awkward pose, unnatural anatomy, stiff posture",
  "eraNegative": "out-of-character fantasy armor, medieval props"
}`;
  }

  if (isHistorical) {
    return `Analyze the character image for a historical drama set in "${era || 'Historical Japan'}", "${country || 'Japan'}".
Identify facial features, hairstyles, and iconic characteristics.
Strictly ensure modern attire (school uniform, blazer, necktie, casual wear, sneakers, glasses, headphones) is converted to authentic period clothing for "${era || 'the era'}".
Output JSON: {
  "characterDna": "Description of facial features and body traits",
  "styleDna": "Consistent artistic rendering medium",
  "antiPoseNegative": "awkward pose, unnatural anatomy, stiff posture",
  "eraNegative": "modern clothing, school uniform, sailor suit, blazer, necktie, modern casual, sneakers, eyeglasses, headphones, wristwatch, smartphone"
}`;
  }

  return `Analyze the character image for a visual drama set in "${era || 'Contemporary'}", "${country || 'Japan'}".
Identify facial features, hairstyles, clothing style, and iconic characteristics.
Output JSON: {
  "characterDna": "Description of facial features, hair, and distinct physical traits",
  "styleDna": "Consistent artistic rendering medium",
  "antiPoseNegative": "awkward pose, unnatural anatomy, stiff posture",
  "eraNegative": "anachronistic armor, historic kimono in modern setting, out-of-place fantasy props"
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
- "titleJp" and "titleEn" MUST BE PURE STANDALONE THEMATIC SUBTITLES!
- NEVER include episode numbers, track numbers, volume prefixes, or acts (e.g. NEVER write "第1話：", "第1話", "第一話", "Episode 1:", "Track 1:", "Vol.1", "起・承", "転・結").
- Reason: Episodes can be deleted, skipped, or reordered by the creator. Numbered or sequential titles cause broken missing-number gaps (飛び番).
- GOOD Example: "titleJp": "芳香剤の奥の臭気", "titleEn": "The Scent Beneath the Bleach"
- BAD Example:  "titleJp": "第1話：芳香剤の奥の臭気（起・承）", "titleEn": "EPISODE 1: THE SCENT BENEATH THE BLEACH"`;

  if (isMvMode) {
    return `Create a ${count}-track music video visual series grand design with Concept & Theme: "${worldSetting}".
Analyze the atmospheric mood, ambient lighting, nostalgic or serene emotion, and visual continuity suitable for an aesthetic music video.
Keep the mood subdued, ennui, and poetic without dramatic conflicts or chaotic action.
${noNumberRule}
Output ONLY valid JSON:
{
  "seriesTitle": "Aesthetic MV Concept Collection",
  "overallSynopsis": "Overview of the musical and visual atmosphere across all parts",
  "episodesPlan": [
    { "epNumber": 1, "titleJp": "情景を象徴する詩的な独立タイトル", "titleEn": "Poetic English Subtitle", "summary": "情景と空気感の描写（日本語2〜3行）" }
  ]
}
`;
  }
  const mangaInstruction = isMangaMode 
    ? "Design the pacing and narrative structure specifically for a highly dynamic comic/manga serialization (including dramatic cliffhangers, high-stakes comic paneling, and compelling chapter hooks)." 
    : "";
  const protagonistInstruction = characterDna
    ? `CENTRAL PROTAGONIST:
Name: "${characterName || '主人公'}"
Appearance DNA: "${characterDna}"
The overarching ${count}-episode epic story MUST revolve around this central protagonist.
Ensure a classic Four-Act (起承転結: Introduction -> Development -> Crisis/Climax -> Grand Resolution) continuity arc across all ${count} episodes.`
    : `Ensure a classic Four-Act (起承転結: Introduction -> Development -> Crisis/Climax -> Grand Resolution) continuity arc across all ${count} episodes.`;

  return `Create a full ${count}-episode serialized story grand design with World Theme & Setting: "${worldSetting}".
Analyze the authentic era, cultural background, human drama, and visual atmosphere directly from this theme.
${protagonistInstruction}
${mangaInstruction}
${noNumberRule}
Output ONLY valid JSON:
{
  "seriesTitle": "Dramatic Series Title",
  "overallSynopsis": "Overview of the entire narrative arc",
  "episodesPlan": [
    { "epNumber": 1, "titleJp": "この話独自の具体的サブタイトル（第X話は入れない）", "titleEn": "Standalone English Subtitle without numbers", "summary": "話のあらすじ" }
  ]
}
`;
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
  const prevSummary = previousEpisodes
    .map(p => `第${p.epNumber}話「${cleanEpisodeTitle(p.titleJp)}」: ${p.summary || ''}`)
    .join('\n');
  const mangaInstruction = isMangaMode 
    ? "Design with intense comic/manga cliffhangers, high emotional stakes, and dynamic story pacing." 
    : "";

  return `You are a world-class drama director and screenwriter.
We are continuing the serialization of the drama series "${seriesTitle}".
World Theme & Setting: "${worldSetting}".
Overall Synopsis: "${overallSynopsis}".

Previous Episodes Narrative History:
${prevSummary}

Now, create the compelling story outline for the NEXT episode (Episode ${nextEpId}).
It must naturally build upon the climax of the previous episodes and introduce exciting developments.
${mangaInstruction}

CRITICAL RULE FOR TITLES (DO NOT INCLUDE EPISODE NUMBERS):
- "titleJp" and "titleEn" MUST BE PURE STANDALONE THEMATIC SUBTITLES!
- NEVER include episode numbers (e.g. NEVER write "第${nextEpId}話", "Episode ${nextEpId}").
- Provide ONLY the specific dramatic subtitle itself.

Output ONLY valid JSON:
{
  "epNumber": ${nextEpId},
  "titleJp": "この話独自の具体的サブタイトル（第X話は入れない）",
  "titleEn": "Standalone English Subtitle without numbers",
  "summary": "この話のあらすじ・展開（日本語2〜3行）"
}`;
}

/**
 * 各話の脚本（12カット分）および時代考証をAIに動的生成させるプロンプト
 */
export function buildScriptPrompt(
  epId: number, 
  currentPlan: SeriesEpisodePlan, 
  country: string, 
  theme: string, 
  era?: string, 
  isMangaMode?: boolean, 
  isMvMode?: boolean,
  taste?: string,
  productionMode?: string,
  isMultiPanel?: boolean
): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  const rawStyle = taste ? resolveTastePrompt(taste) : '';
  const isHistorical = checkIsHistorical(era, theme);
  const effMode = productionMode || (isMvMode ? 'mv' : 'episodes');
  const cutCount = effMode === 'manga' ? 24 : 12;

  const modeConfig = getProductionModeConfig(effMode, isMvMode);
  const directorRole = modeConfig.getDirectorRole(isMangaMode, isHistorical);
  const contextTitle = modeConfig.getContextTitle(isMangaMode, isHistorical);

  const visualStyleMandate = taste
    ? `VISUAL ART STYLE INTEGRATION:
Visual Style: "${taste}"
Style Attributes: "${rawStyle}"
MANDATORY VISUAL RULES:
- Ensure all cut visual descriptions ("basicPlot") harmonize naturally with this art style, maintaining rich atmosphere and color.
- NEVER describe scenes as monochrome, black and white, or sketch unless the art style itself is explicitly monochrome!
- NEVER include elements of this art style (e.g., neon, pop, pastel, anime, glowing lights) into forbidden lists!`
    : "";

  const mvCameraMandate = isMvMode
    ? "CRITICAL MV CAMERA GAZE: Cut 8 (Chorus climax) is the ONLY cut in the entire 12-cut music video where direct eye contact with the camera is permitted for intense emotional resonance. In all other 11 cuts, the subject MUST NOT look at the camera/viewer under any circumstances! Direct the character looking away, into the distance, eyes cast downward in thought, in pure side profile, or seen from behind."
    : "";

  return `You are a ${directorRole} and visual researcher.
Create a ${cutCount}-cut ${contextTitle} for Episode ${epId} ("${currentPlan.titleJp}").
Theme & Setting: "${worldSetting}".
Episode Narrative Arc & Context: "${currentPlan.summary || currentPlan.titleJp}".
${visualStyleMandate}
${mvCameraMandate}

${isMultiPanel ? `DYNAMIC MANGA COMIC PANEL COMPOSITION:
Vary panel shapes and cuts dynamically to avoid monotonous layouts!
Assign "panelLayout" dynamically for each cut from:
- "diagonal-slash" (kinetic sharp angled diagonal dividing the frame into 2 wedge panels)
- "l-shaped" (asymmetrical 3-panel: 1 dominant tall vertical hero panel + 2 stacked horizontal sub-panels)
- "panoramic-split" (wide panoramic establishing panel at top + 2 vertical side-by-side reaction panels below)
- "inset-reaction" (epic splash shot with a smaller floating inset box showing emotional reaction or detail)
- "vertical-split" (asymmetrical vertical division splitting into two side-by-side portrait panels)
- "split-2" (asymmetrical non-uniform 2 panels)
- "single" (impactful 1-panel splash cut)
Do NOT output identical layouts sequentially. Create visual drama and rhythm!
` : ''}
CRITICAL: NARRATIVE EMOTIONAL ARC & VEO MOTION (START -> END INTERPOLATION):
Derive motion pacing from the story's emotional flow (Intro -> Struggle -> Chorus Climax -> Settled Afterglow):
- "veoMotionPrompt": Natural fluid progression using transition adverbs (First ..., then ..., next ..., finally ... smoothly settles). NEVER use exact second numbers like "0-3s"!
- "endFramePlot": The visual state at the end of the camera/character motion (used as End Frame input).

${isMvMode ? 'ATMOSPHERIC & VISUAL HARMONY:' : (isHistorical ? 'STRICT HISTORICAL ACCURACY:' : 'AUTHENTIC SETTING & CULTURAL ACCURACY:')}
Dynamically analyze the period, setting, and atmosphere implied by "${worldSetting}". Determine authentic aesthetic attire and identify elements that would break the mood and must NEVER appear (NEVER forbid elements of the chosen Visual Art Style).

CRITICAL SUBTITLE HIGHLIGHTS:
For EACH cut, select 1 to 2 key terms (which MUST BE EXACTLY present in narrationJp) for the "highlights" array to be highlighted in gold text.

Output ONLY valid JSON matching this exact structure:
{
  "titleJp": "${currentPlan.titleJp}",
  "titleEn": "${currentPlan.titleEn}",
  "summary": "${isMvMode ? '楽曲の世界観・全体の雰囲気（日本語2〜3行）' : '話のあらすじ（日本語）'}",
  "eraAnalysisJp": "${isMvMode ? 'MVのビジュアルコンセプトと情緒の解説（日本語）' : '時代背景と舞台設定の考証解説（日本語）'}",
  "authenticAttireEn": "Detailed English prompt for natural attire and wardrobe matching ${worldSetting}",
  "forbiddenKeywordsEn": "${isMvMode ? 'loud screaming, harsh dissonance, out-of-context modern clutter, theatrical over-acting' : 'Comma-separated English negative keywords for anachronisms that must NEVER appear in ' + worldSetting}",
  "forbiddenAnachronisms": ["${isMvMode ? '過剰な劇的演出' : '日本語の禁止要素1'}", "${isMvMode ? '世界観を壊す不自然な要素' : '日本語の禁止要素2'}"],
  "coverCatchphraseJp": "${isMvMode ? '楽曲に寄り添うエモーショナルなフレーズ' : '超ド迫力キャッチコピー'}",
  "highlightWords": ["代表キーワード1", "代表キーワード2"],
  "cuts": [
    { 
      "id": 1, 
      ${isMultiPanel ? '"panelLayout": "diagonal-slash",' : ''}
      "isObjectOnly": false,
      "focalPoint": {
        "grid": "top-center",
        "normalizedCoord": [0.5, 0.3],
        "focalSubject": "character_face"
      },
      "compositionPrompt": "Subject framed at upper-third, face centered at top-center, rule of thirds",
      "basicPlot": "Concise scene concept and situation in English (1-2 sentences, e.g. Walking alone along country path under glowing dusk sky)", 
      "veoMotionPrompt": "First walking steadily forward with hair swaying in the breeze, then slowly turning head towards the sunset sky, finally smoothly settling into a calm reflective pause",
      "endFramePlot": "Side profile of protagonist bathed in golden sunset glow, gazing quietly at the distant horizon",
      "narrationJp": "${isMvMode ? '楽曲の歌詞・リリック（1曲の歌として繋がるエモい歌詞20文字前後）' : '重厚なナレーション（日本語）'}",
      "highlights": ["ナレーション内の重要語1", "ナレーション内の重要語2"]
    }
  ]
}
`;
}

/**
 * Google Flow Gemini 負荷軽減用: 必要最小限の出力構造に絞った軽量脚本プロンプト（フェイルセーフ用）
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
  isMultiPanel?: boolean,
  existingTitles?: string[]
): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  const effMode = productionMode || (isMvMode ? 'mv' : 'episodes');
  const cutCount = effMode === 'manga' ? 24 : 12;
  const rawStyle = taste ? resolveTastePrompt(taste) : '';

  const plannedTitleJp = cleanEpisodeTitle(currentPlan.titleJp || `場面${epId}`);
  const plannedTitleEn = cleanEpisodeTitleEn(currentPlan.titleEn || `Scene ${epId}`);

  const avoidDupClause = (existingTitles && existingTitles.length > 0)
    ? `AVOID DUPLICATE THEMES: Do NOT repeat these already used concepts: [${existingTitles.join(', ')}]. Create fresh situations!`
    : '';

  const titleRule = `1. Unique Title: "titleJp" and "titleEn" must be standalone subtitles WITHOUT episode numbers (e.g. "titleJp": "${plannedTitleJp}", "titleEn": "${plannedTitleEn}"). NEVER include "第${epId}話" or "Episode ${epId}".`;

  return `You are a film director and screenwriter.
Output a ${cutCount}-cut script for Episode ${epId} of a story in "${worldSetting}".
Episode Concept: "${currentPlan.summary || plannedTitleJp}".
Art Style: "${taste || ''}" (${rawStyle}).
${avoidDupClause}

RULES:
${titleRule}
2. Protagonist: Define "characterDna" in English (consistent single protagonist: age, gender, hair, signature attire). All character cuts MUST feature this exact protagonist.
3. Object Cut: Cut 6 should be an iconic object without humans ("isObjectOnly": true).
4. 8-Second Dynamic Cinematic Progression (180° Drone Orbit & Camera Angle Shift):
Every cut is an 8-second video!
- "basicPlot": Start frame initial situation and camera angle in English.
- "endFramePlot": The reached visual state 8 seconds later from a completely different angle.
- "veoMotionPrompt": Natural continuous 8-second motion directive for Veo 3.1 interpolation.
${isMultiPanel ? '5. Dynamic Manga Panel Layouts: Assign diverse and dynamic comic panel shapes matching the scene rhythm and emotion! Choose from: "diagonal-slash" (kinetic sharp angled slash), "l-shaped" (asymmetric hero panel + 2 stacked sub-panels), "panoramic-split" (wide top establishing shot + 2 vertical sub-panels), "inset-reaction" (splash scene with smaller inset reaction frame), "vertical-split" (side-by-side vertical panels), "split-2" (asymmetric 2-panel), or "single" (full-bleed single splash). VARY the layout dynamically between cuts!' : ''}

Output ONLY valid JSON:
{
  "titleJp": "${plannedTitleJp}",
  "titleEn": "${plannedTitleEn}",
  "summary": "${isMvMode ? '楽曲の世界観（日本語）' : 'あらすじ（日本語）'}",
  "characterDna": "Consistent 19yo Japanese girl, soft wavy dark brown chin-length bob, cozy knit sweater, sleek headphones",
  "eraAnalysisJp": "時代背景の解説（日本語）",
  "cuts": [
    { 
      "id": 1, 
      ${isMultiPanel ? '"panelLayout": "diagonal-slash", ' : ''}
      "isObjectOnly": false,
      "basicPlot": "Front-three-quarters view of protagonist sitting focused at glowing desk in dark room", 
      "endFramePlot": "180-degree reverse drone angle of the same protagonist, seen from behind and side looking across the room illuminated by rim light",
      "veoMotionPrompt": "Continuous 8-second cinematic drone orbit: camera smoothly circles 180 degrees around the character from front to side-back angle, dynamic lighting sweep across surfaces, seamless cinematic movement",
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
    titleEn,
    coverCatchphraseJp,
    theme = '',
    era = '',
    taste = '',
    country = 'Japan',
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
  if (cleanSubtitle === cleanTitle || cleanSubtitle.length < 2) {
    cleanSubtitle = '';
  }

  let mediumInstruction = '';
  let typographyStyle = '';
  let extraNegative = '';

  if (isHist) {
    mediumInstruction = `Authentic traditional Japanese artistic poster and editorial key visual (modern Ukiyo-e and Nihonga-inspired illustration), cohesive full-bleed scenic atmosphere of the historical era with rich textured details, subtle aged washi texture wash, period architectural elements and lanterns, traditional decorative geometric border trim`;
    typographyStyle = `Prominent bold sumi-ink Japanese calligraphy plaque elegantly positioned in the upper portion (with a balanced 8% to 12% safe breathing margin below the top border), displaying the exact title "${cleanTitle}" with traditional seal stamp embellishment`;
    extraNegative = `modern typography, digital fonts, English text overlay, modern glossy plastic, modern digital UI, neon cyberpunk, electronic synthesizers, headphones, sneakers, modern clothing, wristwatch, smartphone, plastic textures`;
  } else if (productionMode === 'manzai' || combinedContext.includes('漫才') || combinedContext.includes('お笑い') || combinedContext.includes('寄席') || combinedContext.includes('演芸')) {
    mediumInstruction = `High-energy theatrical entertainment flyer poster (Yose comedy hall poster style), vibrant comedic composition, dramatic stage lighting, warm festive paper lanterns, bold dynamic layout capturing theatrical charisma and expressive performance energy`;
    typographyStyle = `Dynamic Japanese theatrical headline typography boldly showing "${cleanTitle}" centered inside a floating marquee in the upper portion below a balanced safe top margin`;
    extraNegative = `dark horror, grim, somber, overly melancholic, scientific graphs, abstract high-tech`;
  } else if (productionMode === 'trivia' || combinedContext.includes('雑学') || combinedContext.includes('トリビア') || combinedContext.includes('科学') || combinedContext.includes('解説') || combinedContext.includes('歴史解説')) {
    mediumInstruction = `Stunning commercial infographic editorial poster, high-CTR visual encyclopedia diagram layout, elegant schematic breakdown elements, clean structured visual hierarchy, captivating focal demonstration, informative magazine cover aesthetic`;
    typographyStyle = `Bold high-impact Japanese editorial headline typography featuring "${cleanTitle}" centered inside a floating infographic banner in the upper portion with a balanced clear breathing margin above`;
    extraNegative = `messy collage, cluttered unintelligible scribbles, illegible tiny text, distorted diagrams`;
  } else if (productionMode === 'craft' || combinedContext.includes('職人') || combinedContext.includes('工芸') || combinedContext.includes('伝統技')) {
    mediumInstruction = `Artisan master anatomy infographic poster, warm organic textured craft paper, delicate technical cross-section sketches and authentic artisan handiwork schematics, exquisite workshop atmosphere, masterwork craftsmanship`;
    typographyStyle = `Refined artisan Japanese brushed typography displaying "${cleanTitle}" centered inside a floating artisan plaque in the upper portion with a balanced safe margin above`;
    extraNegative = `neon, cyberpunk, modern plastic, synthetic futuristic graphics`;
  } else if (productionMode === 'quotes' || combinedContext.includes('名言') || combinedContext.includes('格言') || combinedContext.includes('哲学')) {
    mediumInstruction = `Profound minimalist philosophical graphic poster, commanding negative space, striking monumental focal imagery symbolizing deep contemplation, sophisticated artistic duotone or evocative lighting`;
    typographyStyle = `Monumental Japanese typographic composition prominently presenting the core phrase "${cleanTitle}" centered in the upper zone with expansive negative space around it`;
    extraNegative = `cluttered graphics, juvenile cartoon elements, chaotic composition`;
  } else if (productionMode === 'mv' || combinedContext.includes('音楽') || combinedContext.includes('music') || combinedContext.includes('mv')) {
    mediumInstruction = `Iconic music concept art poster and editorial vinyl single cover design, evocative atmospheric color grading, cinematic emotional visual narrative, stylish audio metadata HUD graphics, subtle equalizer visualizer accents, track title graphic hierarchy`;
    typographyStyle = `Stylized Japanese music single headline typography reading "${cleanTitle}" elegantly centered inside a sleek floating neon-accented audio plaque in the upper portion, positioned with a balanced 8% to 12% breathing space below the top edge`;
    extraNegative = `boring layout, flat corporate diagram, low-effort snapshot`;
  } else {
    mediumInstruction = `Premium cinematic vertical teaser poster, high-CTR commercial infographic design, striking visual hierarchy, compelling editorial cover layout, professional cinematic color grading`;
    typographyStyle = `Striking high-contrast Japanese poster headline typography reading "${cleanTitle}" centered inside a floating title block in the upper portion with a balanced clear breathing margin above`;
    extraNegative = `cheap low-res flyer, amateur layout, chaotic clutter`;
  }

  let focalSubject = '';
  if (characterDna) {
    const costumeNote = isHist && authenticAttireEn ? `dressed in authentic ${authenticAttireEn}` : '';
    focalSubject = `Main focal subject: ${characterDna} ${costumeNote}, captured in a pull-back medium-wide shot (framed comfortably from waist up or seated low), positioned firmly in the lower two-thirds of the vertical canvas. The subject's head is kept comfortably below the floating title plaque, ensuring clean visual separation.`;
  } else if (theme) {
    focalSubject = `Key thematic visual: Symbolic central subject embodying the essence of "${theme}", framed comfortably in the lower two-thirds beneath the floating title plaque.`;
  } else {
    focalSubject = `Central hero focal visual with striking presence, framed in a pull-back view positioned in the lower two-thirds beneath the floating title area.`;
  }

  const subtitleClause = cleanSubtitle 
    ? `Integrated punchy subtitle text accent: "${cleanSubtitle}". (CRITICAL: Do NOT write any episode number digits or "第X話").` 
    : '';

  const resolvedTaste = taste ? resolveTastePrompt(taste) : (styleDna || '');
  const styleClause = resolvedTaste ? `Artistic rendering style: ${resolvedTaste}.` : '';

  const promptEn = [
    `Vertical 9:16 high-impact editorial cover poster and commercial infographic key visual.`,
    mediumInstruction + `.`,
    `Poster Layout & Visual Hierarchy: Cohesive full-bleed environmental scene seamlessly spanning the entire canvas from top to bottom. The horizontal title signboard plaque boldly displaying ONLY the exact standalone title "${cleanTitle}" is elegantly positioned in the upper area (centered horizontally, with its top edge floating at a balanced 8% to 12% safe breathing margin below the top canvas border). The atmospheric background scene (architectural ceiling, ambient sky, or room details) naturally flows behind and around the plaque without any awkward blank boxes or empty voids. The plaque maintains clean safe clearance from the top border without touching it. CRITICAL MANDATORY RULE: NEVER write or draw any episode numbers, episode counters, chapter badges, or sequence numbers (e.g. ABSOLUTELY NO "第1話", "第2話", "第3話", "第4話", "Episode 1", "Episode 2", "Vol.1", "起・承", "転・結") anywhere on the signboard, poster, or banner!`,
    focalSubject,
    typographyStyle + `.`,
    subtitleClause,
    styleClause,
    `Camera & Composition: Vertical 9:16 aspect ratio, harmonious professional editorial poster hierarchy. The background scene is unified and full-bleed across the whole canvas. The title plaque is placed in the upper portion with a natural 8% to 12% breathing margin from the top edge. The main character is framed below the title plaque in a medium-wide shot (standing or seated comfortably in the lower two-thirds), with ample visual breathing room between character and title plaque. Unified single-scene composition, no split frames, no giant empty blank areas, crystal clear focal point, professional graphic design, masterpiece, 8k resolution.`
  ].filter(Boolean).join(' ');

  const baseNegative = `episode number, episode numbers, episode counter, chapter number, "第1話", "第2話", "第3話", "第4話", "Episode 1", "Episode 2", "Episode 3", "Episode 4", "Vol.1", "Vol.2", "起・承", "転・結", numbered badge, numbered plaque, episode header, giant blank void at top, massive empty space at top, plain blank paper section, huge blank area above sign, two-tier split canvas, horizon dividing canvas into blank top and busy bottom, signboard placed in the dead center, empty notepad header, banner touching top edge, signboard touching top border, banner flush with ceiling, text crammed against the ceiling, text cut off at top edge, signboard at very top of frame, zero top margin, cropped title banner, text touching canvas boundary, missing first character, extreme close-up portrait with head at top ceiling, text overlapping character's head, banner colliding with hair, text covering face, cluttered overlap between subject and title, awkwardly placed text, blurry, low resolution, bad anatomy, duplicate character, multiple people when single subject intended, cropped subject, cluttered messy collage, distorted hands, extra limbs, ugly, JPEG artifacts`;
  const forbiddenAnachStr = forbiddenAnachronisms.length > 0 ? forbiddenAnachronisms.join(', ') : '';
  const negativePromptEn = [
    baseNegative,
    extraNegative,
    forbiddenAnachStr
  ].filter(Boolean).join(', ');

  return { promptEn, negativePromptEn };
}
