import { Cut, GenerationTask, GeneratorSettings, KenBurnsPreset, FocalPoint, SeriesEpisodePlan } from '../types';
import { 
  SAFE_CHARACTERS, 
  TASTES,
  resolveRecommendedCameraWorkAndKenBurns, 
  resolveRecommendedTelopStaging 
} from '../constants';
import { safeJsonParse, callWithRetry, formatDurationMs, sleepWithAbortCheck } from './utils';
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
import { Flow } from 'flow-sdk';
export type { PreviousShotContext as PreviousShotInfo };
export { resolveTasteKey, resolveTastePrompt };
/**
 * ── タイトル・テキスト整形ヘルパー ──
 */
export function sanitizeForYouTubeSafety(text: string): string {
  if (!text) return '';
  return text.replace(/[殺死血狂暴]/g, '★').replace(/(死ね|殺す|血まみれ|狂気|虐殺)/g, '危険').trim();
}
export const FALLBACK_EPISODE_SUBTITLES: Record<number, { jp: string; en: string }> = {
  1: { jp: '運命の胎動と旅立ち', en: 'Dawn of Destiny' },
  2: { jp: '交錯する思惑と影', en: 'Shadows Intertwined' },
  3: { jp: '激動の転換点', en: 'Turning of the Tide' },
  4: { jp: '迫りくる決断の刻', en: 'Hour of Reckoning' },
  5: { jp: '明日への咆哮と夜明け', en: 'Roar Towards Tomorrow' },
  6: { jp: '嵐の前の静けさ', en: 'Calm Before the Storm' },
  7: { jp: '再起の誓い', en: 'Vow of Revival' },
  8: { jp: '白熱する包囲網', en: 'The Tightening Net' },
  9: { jp: '砕かれた幻想', en: 'Shattered Illusions' },
  10: { jp: '栄光の凱歌と未来', en: 'Triumphant Hymn of Hope' }
};

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
 * シリーズ全体のグランドデザイン（最大20話チャンクリレー対応プロンプト）
 */
export function buildGrandDesignChunkPrompt(
  startEp: number,
  endEp: number,
  totalCount: number,
  country: string, 
  theme: string, 
  era?: string, 
  isMangaMode?: boolean, 
  isMvMode?: boolean,
  characterDna?: string,
  characterName?: string,
  previousEpisodesHeaders?: string
): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  const countInChunk = endEp - startEp + 1;
  const isFirstChunk = startEp === 1;
  const contextClause = previousEpisodesHeaders
    ? `\nPREVIOUS GENERATED EPISODES (Episodes 1 to ${startEp - 1}):\n${previousEpisodesHeaders}\nCRITICAL: Continue seamlessly as subsequent standalone serial episodes ${startEp} to ${endEp}. Each episode must be high-integrity and individually compelling even if watched out of order.`
    : '';
  const protagonistInstruction = characterDna
    ? `CENTRAL PROTAGONIST: "${characterName || '主人公'}" (${characterDna}). Maintain consistent protagonist presence.`
    : `Design engaging standalone and serialized story arc.`;
  return `Create episodes ${startEp} to ${endEp} (total planned series: ${totalCount} episodes) with Theme: "${worldSetting}".
${protagonistInstruction}
${isMangaMode ? "Design pacing for dynamic comic/manga serialization with dramatic hooks." : ""}
${isMvMode ? "Design poetic aesthetic musical visuals." : ""}
${contextClause}
CRITICAL RULES:
1. Generate EXACTLY ${countInChunk} episode plans from epNumber ${startEp} to ${endEp}.
2. "titleJp" and "titleEn" MUST BE PURE STANDALONE SUBTITLES (do NOT include "第1話" or "Episode 1").
3. Each episode must stand on its own without breaking continuity if viewed independently.
Output ONLY valid JSON:
{
  ${isFirstChunk ? `"seriesTitle": "${theme.split('（')[0]} Series",\n  "overallSynopsis": "Overview of entire narrative arc",` : ''}
  "episodesPlan": [
    { "epNumber": ${startEp}, "titleJp": "独自のサブタイトル", "titleEn": "Standalone English Subtitle", "summary": "この話のあらすじ（日本語2〜3行）" }
  ]
}`;
}
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
  return buildGrandDesignChunkPrompt(1, Math.min(20, count), count, country, theme, era, isMangaMode, isMvMode, characterDna, characterName);
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
 * 最大20カットずつの「チャンク・リレー生成」プロンプト
 */
export function buildCompactScriptChunkPrompt(
  epId: number, 
  currentPlan: SeriesEpisodePlan, 
  startCut: number,
  endCut: number,
  totalCutCount: number,
  country: string, 
  theme: string, 
  era?: string, 
  isMangaMode?: boolean,
  isMvMode?: boolean,
  taste?: string,
  _productionMode?: string,
  existingTitles?: string[],
  characterId?: string,
  previousCutsSummary?: string
): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  const fixedChar = (characterId && characterId !== 'auto') ? SAFE_CHARACTERS.find(c => c.id === characterId) : undefined;
  const charDirective = fixedChar ? `\nPROTAGONIST LOCK: Protagonist MUST be "${fixedChar.nameJa}" (${fixedChar.dnaPromptEn}). Narration style: ${fixedChar.personality}. SAFETY: Never depict cruel abuse.` : '';
  const defaultCharDna = fixedChar ? fixedChar.dnaPromptEn : 'Consistent single protagonist matching the world setting and narrative';
  const rawStyle = taste ? resolveTastePrompt(taste) : '';
  const plannedTitleJp = cleanEpisodeTitle(currentPlan.titleJp || `場面${epId}`);
  const plannedTitleEn = cleanEpisodeTitleEn(currentPlan.titleEn || `Scene ${epId}`);
  const avoidDup = (existingTitles && existingTitles.length > 0) ? `AVOID DUPLICATE THEMES: Do NOT repeat [${existingTitles.join(', ')}].` : '';
  const isFirstChunk = startCut === 1;
  const isFinalChunk = endCut >= totalCutCount;
  const chunkCount = endCut - startCut + 1;
  const pacingDirective = !isFinalChunk
    ? `\n【重要・物語の進行に関する絶対指示】現在は全${totalCutCount}カット中の第${startCut}〜${endCut}カット目（物語の途中・展開中）です。ここで絶対に物語を完結させず、次のカット（Cut ${endCut + 1}以降）へ続く展開のままバトンを渡してください。事件の完全解決や総括の結びに入らず、次へ続く緊張感や新たな事態の発生を描いてください。結末（オチ・解決）は最終カット（Cut ${totalCutCount}）でのみ描かれます。`
    : `\n【最終バッチ指示】現在は全${totalCutCount}カットのクライマックスおよび結末部（Cut ${startCut}〜${endCut}）です。これまでの展開を受け止め、第${totalCutCount}カット目で見事な結末・オチ・余韻を描いてストーリーを美しく完結させてください。`;
  const relayHistoryClause = previousCutsSummary
    ? `\n--- PREVIOUS CUTS CONTEXT (Cut 1 to ${startCut - 1}) ---\n${previousCutsSummary}\nCRITICAL: Continue the story chronologically from Cut ${endCut < totalCutCount ? startCut : startCut}. Do not restart or repeat previous scenes.`
    : '';
  return `You are an elite film director, manga artist, and screenwriter.
Generate screenplay for Cut ${startCut} to Cut ${endCut} (Total Cuts planned: ${totalCutCount}) for Episode ${epId} in "${worldSetting}".
Episode Concept: "${currentPlan.summary || plannedTitleJp}".
Art Style: "${taste || ''}" (${rawStyle}).
${avoidDup}
${charDirective}
${pacingDirective}
${relayHistoryClause}
MANDATORY RULES:
1. Generate EXACTLY ${chunkCount} cuts starting from id: ${startCut} up to id: ${endCut}.
2. Ensure continuous story flow and visual variety across shot scales (Close-up, Medium, Wide).
3. Cut with "isObjectOnly": true should occasionally focus on an atmospheric symbolic keepsake or deserted prop without humans.
4. "basicPlot" MUST be clear, high-detail English description for text-to-image prompt.
5. "narrationJp" MUST be natural Japanese dialogue or poetic narration (around 20-40 characters).
6. Format: Output cuts as an array under the "cuts" field, even if there is only 1 cut.
Output ONLY valid JSON:
{
  ${isFirstChunk ? `"titleJp": "第${epId}話の展開を象徴する独自の劇的サブタイトル（既存の[${(existingTitles || []).join(', ')}]やテーマ名「${theme.split('（')[0]}」そのままは厳禁）",
  "titleEn": "Unique dramatic English subtitle for Episode ${epId}",
  "summary": "${currentPlan.summary || plannedTitleJp}",
  "characterDna": "${defaultCharDna}",
  "eraAnalysisJp": "時代背景・世界観の解説（日本語）",` : ''}
  "cuts": [
    { 
      "id": ${startCut}, 
      "isObjectOnly": false,
      "basicPlot": "Cinematic visual scene description of protagonist...", 
      "narrationJp": "セリフまたはナレーション（日本語）"
    }
  ]
}`;
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
  isHorizontal?: boolean;
}
/**
 * 世界観・時代・ジャンルに完全適応するインフォグラフィック扉絵・16:9看板プロンプトを構築
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
    authenticAttireEn = '',
    isHorizontal = false
  } = options;
  const isHist = checkIsHistorical(era, theme);
  const combinedContext = `${era} ${theme} ${productionMode}`.toLowerCase();
  const cleanTitle = cleanEpisodeTitle(titleJp) || titleJp;
  let cleanSubtitle = cleanEpisodeTitle(coverCatchphraseJp || '');
  if (cleanSubtitle === cleanTitle || cleanSubtitle.length < 2) cleanSubtitle = '';
  const formatDesc = isHorizontal
    ? `Cinematic horizontal 16:9 widescreen YouTube master thumbnail poster and editorial promotional billboard.`
    : `Vertical 9:16 high-impact editorial cover poster and commercial infographic key visual.`;
  let mediumInstruction = isHorizontal
    ? `Premium cinematic 16:9 master title card, high-CTR YouTube thumbnail visual, beautiful atmospheric lighting, elegant scenic composition`
    : `Premium cinematic vertical teaser poster, high-CTR commercial infographic design, striking visual hierarchy, professional cinematic color grading`;
  let typographyStyle = isHorizontal
    ? `Striking high-contrast Japanese title typography boldly displaying "${cleanTitle}" artistically embedded into a beautiful floating antique signboard or architectural title plaque in the upper or upper-side area with balanced breathing margin`
    : `Striking high-contrast Japanese poster headline typography reading "${cleanTitle}" centered inside floating title plaque in upper portion with safe breathing margin above`;
  let extraNegative = `cheap low-res flyer, amateur layout, chaotic clutter`;
  if (isHist) {
    mediumInstruction = isHorizontal
      ? `Authentic traditional Japanese panoramic key visual (modern Ukiyo-e and Nihonga-inspired illustration), expansive landscape with rich textured details, subtle washi texture`
      : `Authentic traditional Japanese artistic poster and editorial key visual (modern Ukiyo-e and Nihonga-inspired illustration), full-bleed scenic atmosphere with rich textured details, subtle washi texture, decorative border`;
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
    mediumInstruction = isHorizontal
      ? `Iconic widescreen music single master artwork and YouTube cover, evocative color grading, cinematic emotional narrative`
      : `Iconic music concept art poster and vinyl single cover design, evocative color grading, cinematic emotional narrative, subtle audio HUD visualizer accents`;
    typographyStyle = `Stylized Japanese music single headline typography reading "${cleanTitle}" centered in floating neon-accented audio plaque`;
    extraNegative = `boring layout, flat corporate diagram, low-effort snapshot`;
  }
  let focalSubject = characterDna 
    ? (isHorizontal 
        ? `Main focal subject: ${characterDna} ${isHist && authenticAttireEn ? `dressed in authentic ${authenticAttireEn}` : ''}, captured in cinematic medium shot positioned harmoniously alongside the title signboard in wide 16:9 view.`
        : `Main focal subject: ${characterDna} ${isHist && authenticAttireEn ? `dressed in authentic ${authenticAttireEn}` : ''}, captured in medium-wide shot (framed from waist up or seated low) in lower two-thirds of canvas below floating title plaque.`)
    : `Key thematic visual: Symbolic central subject embodying essence of "${theme}".`;
  const subtitleClause = cleanSubtitle ? `Integrated subtitle accent: "${cleanSubtitle}". (Do NOT write episode number digits).` : '';
  const resolvedTaste = taste ? resolveTastePrompt(taste) : (styleDna || '');
  const styleClause = resolvedTaste ? `Artistic rendering style: ${resolvedTaste}.` : '';
  const ratioClause = isHorizontal
    ? `Composition: Horizontal 16:9 widescreen aspect ratio, harmonious cinematic hierarchy, bright beautiful atmospheric lighting, masterpiece, 8k resolution.`
    : `Composition: Vertical 9:16 aspect ratio, harmonious editorial hierarchy. Main character framed below title plaque with ample breathing room. Masterpiece, 8k resolution.`;
  const promptEn = [
    formatDesc,
    mediumInstruction + `.`,
    `Poster Layout: Cohesive full-bleed scene. Dedicated title signboard boldly displaying ONLY exact title "${cleanTitle}". Mandatory: NEVER write episode numbers (NO "第1話", "Episode 1", "Vol.1")!`,
    focalSubject,
    typographyStyle + `.`,
    subtitleClause,
    styleClause,
    ratioClause
  ].filter(Boolean).join(' ');
  const baseNegative = `episode number, episode counter, "第1話", "第2話", "Episode 1", "Episode 2", "Vol.1", numbered badge, giant blank void, banner touching extreme top edge, text crammed against ceiling, text overlapping character head, blurry, low resolution, bad anatomy, duplicate character, ugly, artifacts, dark heavy black bar, black border, dark navy tint`;
  const negativePromptEn = [baseNegative, extraNegative, forbiddenAnachronisms.join(', ')].filter(Boolean).join(', ');
  return { promptEn, negativePromptEn };
}
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
/**
 * 最大20個ずつの「チャンク・リレー生成」ループ
 */
export async function generateSafeEpisodeScript(opts: GenerateSafeScriptOptions): Promise<SafeScriptResult> {
  const {
    epId, currentPlan, country, theme, era, isMangaMode, isMvMode,
    taste, productionMode, existingTitles, characterId, targetCutCount, abortCheck, addLog
  } = opts;
  const totalCuts = targetCutCount && targetCutCount > 0 ? targetCutCount : (isMangaMode ? 24 : (isMvMode ? 30 : 12));
  const CHUNK_SIZE = 20;
  const chunkCount = Math.ceil(totalCuts / CHUNK_SIZE);
  const fixedChar = (characterId && characterId !== 'auto') ? SAFE_CHARACTERS.find(c => c.id === characterId) : undefined;
  const fallbackDna = fixedChar
    ? fixedChar.dnaPromptEn
    : (isMvMode
      ? 'Consistent 19yo Japanese girl, soft wavy dark brown chin-length bob hair, gentle eyes, oversized cozy knit cardigan, sleek over-ear headphones'
      : 'Consistent single protagonist matching the world setting and narrative');
  const fallbackSub = FALLBACK_EPISODE_SUBTITLES[epId] || { jp: `場面${epId}の情景`, en: `Scene ${epId}` };
  const baseTitleCandidate = cleanEpisodeTitle(currentPlan.titleJp || '');
  const isDuplicateOfTheme = baseTitleCandidate && theme && (theme.includes(baseTitleCandidate) || baseTitleCandidate.includes(theme.split('（')[0]));
  const defaultInitialTitleJp = (!baseTitleCandidate || isDuplicateOfTheme)
    ? `${theme.split('（')[0].slice(0, 10)}〜${fallbackSub.jp}`
    : baseTitleCandidate;
  const defaultInitialTitleEn = cleanEpisodeTitleEn(currentPlan.titleEn || fallbackSub.en);

  let episodeMetadata = {
    titleJp: defaultInitialTitleJp,
    titleEn: defaultInitialTitleEn,
    summary: currentPlan.summary || `${defaultInitialTitleJp}の世界観で紡がれる物語`,
    characterDna: fallbackDna,
    eraAnalysisJp: '歴史・文化と人情の情景。',
    forbiddenAnachronisms: ['時代にそぐわない現代物'],
    authenticAttireEn: 'Authentic costume matching setting',
    forbiddenKeywordsEn: 'modern items',
    coverCatchphraseJp: `${currentPlan.titleJp}`,
    coverCatchphraseEn: '',
    highlightWords: ['光', '風']
  };
  const accumulatedCuts: SafeScriptResult['cuts'] = [];
  for (let chunkIdx = 0; chunkIdx < chunkCount; chunkIdx++) {
    if (abortCheck && abortCheck()) break;
    if (chunkIdx > 0) {
      if (addLog) addLog(`☕ 次バッチ（Cut ${chunkIdx * CHUNK_SIZE + 1}〜）準備中（API安定のため2秒待機）...`, 'info');
      const rested = await sleepWithAbortCheck(2000, abortCheck);
      if (!rested) break;
    }
    const startCut = chunkIdx * CHUNK_SIZE + 1;
    const endCut = Math.min((chunkIdx + 1) * CHUNK_SIZE, totalCuts);
    const isFirstChunk = chunkIdx === 0;
    let previousCutsSummary = '';
    if (!isFirstChunk && accumulatedCuts.length > 0) {
      previousCutsSummary = accumulatedCuts.map(c => {
        const shortSummary = (c.narrationJp || c.basicPlot || '').replace(/[\r\n]+/g, ' ').trim().slice(0, 30);
        return `#Cut${c.id}: ${shortSummary}`;
      }).join('\n');
    }
    if (addLog) {
      if (chunkCount > 1) {
        addLog(`📝 【第${epId}話】脚本リレー生成中 [${chunkIdx + 1}/${chunkCount}]: Cut ${startCut}〜${endCut} / 全${totalCuts}カット...`, 'process');
      } else {
        addLog(`📝 【第${epId}話】脚本生成中: Cut ${startCut}〜${endCut}...`, 'process');
      }
    }
    const chunkPrompt = buildCompactScriptChunkPrompt(
      epId,
      currentPlan as any,
      startCut,
      endCut,
      totalCuts,
      country,
      theme,
      era,
      isMangaMode,
      isMvMode,
      taste,
      productionMode,
      existingTitles,
      characterId,
      previousCutsSummary
    );
    let scriptRes: any;
    const chunkStartTime = Date.now();
    let scriptHeartbeat: any = null;
    if (addLog) {
      scriptHeartbeat = setInterval(() => {
        const elapsed = Math.round((Date.now() - chunkStartTime) / 1000);
        addLog(`⏳ 【第${epId}話】Cut ${startCut}〜${endCut} 執筆中（${elapsed}秒経過）...`, 'process');
      }, 5000);
    }
    try {
      scriptRes = await callWithRetry<any>(
        () => Flow.generate.text(chunkPrompt),
        (attempt, max, delay, err) => {
          console.error(`[Script Chunk ${chunkIdx + 1} Retry ${attempt}/${max}]`, err);
          const waitStr = formatDurationMs(delay);
          if (addLog) {
            addLog(`⚠️ 第${epId}話 脚本リトライ (${attempt}/${max}) ${waitStr}後...`, 'warning');
          }
        },
        { maxRetries: 3, superBackoff: false, abortCheck }
      );
    } catch (err: any) {
      console.warn(`[Script Fallback for Ep ${epId} Chunk ${chunkIdx + 1}]`, err);
      if (addLog) addLog(`⚠️ 第${epId}話 Cut ${startCut}〜${endCut}: 自動フェイルセーフ構成を適用します`, 'process');
    } finally {
      if (scriptHeartbeat) clearInterval(scriptHeartbeat);
    }
    let parsedCuts: any[] = [];
    if (scriptRes && scriptRes.text) {
      const parsed = safeJsonParse<any>(scriptRes.text, {});
      if (isFirstChunk) {
        if (parsed.titleJp) episodeMetadata.titleJp = cleanEpisodeTitle(sanitizeForYouTubeSafety(parsed.titleJp));
        if (parsed.titleEn) episodeMetadata.titleEn = cleanEpisodeTitleEn(parsed.titleEn);
        if (parsed.summary) episodeMetadata.summary = sanitizeForYouTubeSafety(parsed.summary);
        if (parsed.characterDna) episodeMetadata.characterDna = parsed.characterDna;
        if (parsed.eraAnalysisJp) episodeMetadata.eraAnalysisJp = sanitizeForYouTubeSafety(parsed.eraAnalysisJp);
        if (Array.isArray(parsed.forbiddenAnachronisms)) episodeMetadata.forbiddenAnachronisms = parsed.forbiddenAnachronisms;
        if (parsed.authenticAttireEn) episodeMetadata.authenticAttireEn = parsed.authenticAttireEn;
        if (parsed.forbiddenKeywordsEn) episodeMetadata.forbiddenKeywordsEn = parsed.forbiddenKeywordsEn;
        if (parsed.coverCatchphraseJp) episodeMetadata.coverCatchphraseJp = cleanEpisodeTitle(sanitizeForYouTubeSafety(parsed.coverCatchphraseJp));
        if (parsed.coverCatchphraseEn) episodeMetadata.coverCatchphraseEn = parsed.coverCatchphraseEn;
        if (Array.isArray(parsed.highlightWords)) episodeMetadata.highlightWords = parsed.highlightWords;
      }
      if (Array.isArray(parsed.cuts)) {
        parsedCuts = parsed.cuts;
      } else if (Array.isArray(parsed.scenes)) {
        parsedCuts = parsed.scenes;
      } else if (Array.isArray(parsed)) {
        parsedCuts = parsed;
      } else if (parsed && typeof parsed === 'object') {
        if (parsed.cuts && typeof parsed.cuts === 'object' && !Array.isArray(parsed.cuts)) {
          parsedCuts = [parsed.cuts];
        } else if (parsed.basicPlot || parsed.narrationJp || parsed.promptEn || parsed.id) {
          parsedCuts = [parsed];
        }
      }
    }
    const expectedChunkCount = endCut - startCut + 1;
    for (let cIdx = 0; cIdx < expectedChunkCount; cIdx++) {
      const globalCutId = startCut + cIdx;
      const rawCutData = parsedCuts.find((c: any) => c && Number(c.id) === globalCutId) || parsedCuts[cIdx] || {};
      const isObj = rawCutData.isObjectOnly !== undefined ? Boolean(rawCutData.isObjectOnly) : (globalCutId % 6 === 0);
      const rawNarration = rawCutData.narrationJp || rawCutData.narration || (isMvMode ? `歌詞パート${globalCutId}` : `場面${globalCutId}の情景`);
      const defaultCoord: [number, number] = isObj ? [0.5, 0.5] : [0.5, 0.3];
      const defaultSubject = isObj ? 'symbolic_object' : 'character_face';
      const defaultPlot = isObj
        ? `Atmospheric iconic object or landscape matching ${theme}, completely empty of people, cinematic still-life`
        : `${fixedChar ? `${fixedChar.dnaPromptEn}, ` : ''}cinematic scene ${globalCutId} of ${currentPlan.titleEn}, atmospheric lighting`;
      accumulatedCuts.push({
        id: globalCutId,
        panelLayout: 'single',
        basicPlot: rawCutData.basicPlot || rawCutData.promptEn || defaultPlot,
        narrationJp: sanitizeForYouTubeSafety(rawNarration),
        highlights: rawCutData.highlights || episodeMetadata.highlightWords || [],
        isObjectOnly: isObj,
        focalPoint: {
          grid: isObj ? 'center' : 'top-center',
          normalizedCoord: defaultCoord,
          focalSubject: defaultSubject
        },
        compositionPrompt: rawCutData.compositionPrompt || (isObj 
          ? 'Centered still-life composition of prop/object, rule of thirds, completely empty of people' 
          : 'Subject framed at upper-third, face centered at top-center, rule of thirds composition')
      });
    }
    if (addLog && chunkCount > 1) {
      addLog(`✅ 【第${epId}話】リレー完了 [${chunkIdx + 1}/${chunkCount}]: Cut ${startCut}〜${endCut} (${accumulatedCuts.length}/${totalCuts}カット確定)`, 'success');
    }
  }
  accumulatedCuts.forEach((cut, idx) => {
    cut.id = idx + 1;
  });
  return {
    ...episodeMetadata,
    cuts: accumulatedCuts
  };
}

