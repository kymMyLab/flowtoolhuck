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
export function sanitizeForYouTubeSafety(text: string, isMvMode: boolean = false): string {
  if (!text) return '';
  if (isMvMode) {
    // 音楽MVモードでは「死神」「殺風景」等の一般的な詩的表現・歌詞を不自然に伏せ字化せずそのまま保持し、過激な暴力・グロ表現のみ対象とする
    return text.replace(/(血まみれ|虐殺|死ねよ|殺してやる)/g, '危険').trim();
  }
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
  previousCutsSummary?: string,
  mvSettings?: { songTitle?: string; lyricsMemo?: string; mvVibe?: 'pop' | 'chill'; mvStyleMode?: 'lofi_loop' | 'unified' | 'mix' }
): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  const fixedChar = (!isMvMode && characterId && characterId !== 'auto' && characterId !== 'mv_cap_girl' && characterId !== 'random') 
    ? SAFE_CHARACTERS.find(c => c.id === characterId) 
    : undefined;
  const charDirective = fixedChar ? `\nPROTAGONIST LOCK: Protagonist MUST be "${fixedChar.nameJa}" (${fixedChar.dnaPromptEn}). Narration style: ${fixedChar.personality}. SAFETY: Never depict cruel abuse.` : '';
  
  const MV_CAP_GIRL_DNA = 'cool aesthetic Japanese anime girl wearing a backwards baseball cap, oversized street hoodie, denim shorts, stylish high-top sneakers, sleek over-ear headphones resting around her neck, soft wavy hair, expressive calm eyes';
  const defaultCharDna = isMvMode ? MV_CAP_GIRL_DNA : (fixedChar ? fixedChar.dnaPromptEn : 'Consistent single protagonist matching the world setting and narrative');
  const rawStyle = taste ? resolveTastePrompt(taste) : '';
  const plannedTitleJp = cleanEpisodeTitle(currentPlan.titleJp || `場面${epId}`);
  const plannedTitleEn = cleanEpisodeTitleEn(currentPlan.titleEn || `Scene ${epId}`);
  const avoidDup = (existingTitles && existingTitles.length > 0) ? `AVOID DUPLICATE THEMES: Do NOT repeat [${existingTitles.join(', ')}].` : '';
  const isFirstChunk = startCut === 1;
  const isFinalChunk = endCut >= totalCutCount;
  const chunkCount = endCut - startCut + 1;
  const defaultMvPhrases = ['AFTER SCHOOL', 'SUMMER BREEZE', 'MIDNIGHT STEP', 'DAYDREAM POP', 'BLUE MOMENT', 'NEON HORIZON'];
  const mvSongTitle = (mvSettings?.songTitle || '').trim() || plannedTitleEn || defaultMvPhrases[Math.floor(Math.random() * defaultMvPhrases.length)];
  const lyricsList = (mvSettings?.lyricsMemo || '')
    .split(/[\r\n]+/)
    .map(l => l.trim())
    .filter(Boolean);
  const mvVibe = mvSettings?.mvVibe || 'pop';
  let mvWorldDirection = '';
  if (isMvMode) {
    const vibeInstruction = mvVibe === 'pop'
      ? `🌈 VIBE: ✨ ポップ・青春 (Kawaii Pop)
- Atmosphere: Crisp saturated blue skies, fluffy white summer clouds, vibrant school footbridges, colorful Tokyo/Japanese street corners, rooftop with soft golden hour reflections, joyful airy aesthetic.
- Color & Lighting: Glossy candy pastel & vivid acrylic painted 3D letter surfaces (soft cream, sunny yellow, pastel sky blue, cherry pink accents). Bright, uplifting, clean modern anime MV aesthetic.
- 🚫 STRICTLY FORBIDDEN IN POP VIBE: NO dark gritty concrete, NO decaying ruins, NO gloomy dark rain, NO European classical gothic buildings.`
      : `🌙 VIBE: 🌙 チル・夜更かし (Lo-Fi Chill)
- Atmosphere: Nostalgic midnight city, rain-slicked wet pavement with neon reflections, quiet corner cafes, late-night laundromat glow, peaceful railway crossing under twilight.
- Color & Lighting: Softly glowing warm vintage neon tubes, weathered brick/concrete lettering, cool indigo and warm amber twilight, serene melancholic Lo-Fi chillhop aesthetic.`;
    mvWorldDirection = `
【🎵 音楽MV (12Cut×AIエモ切り抜き) 専用ディレクション: 4ゾーン高密度ワイド構図 × 空間に散らばる英単語立体文字】
${vibeInstruction}
- 🚫 FORBIDDEN COMPOSITIONS: NO empty plain backgrounds (NO empty flat sky/grass with single subject), NO clumped tight logo blocks in center.
- 📐 MANDATORY 4-ZONE HIGH-DENSITY BALANCED WIDE LAYOUT (Each scene MUST feature 4 distinct storytelling zones for multiple emo crops):
  1) 🔤 SPATIALLY SCATTERED 3D LETTERS: The letters of "${mvSongTitle}" are NOT clumped into one tight block. They are dynamically scattered across the physical environment (some letters in the foreground, some staggered in middle ground and distance) along sidewalks, rooftops, or bridges with depth and physical perspective.
  2) 🧢 COOL ANIME GIRL: "${MV_CAP_GIRL_DNA}" naturally positioned interacting with one of the giant letters (sitting inside 'O', resting on 'U', sitting on 'A'/'H' crossbar, leaning on 'L'/'E').
  3) 👟 GROUND & FOOTSTEPS DETAIL: Highly detailed ground textures in lower third (wet asphalt neon reflections, puddle ripple rings, rooftop grid tiles, railway wooden ties, concrete curb with spraypaint) framing the girl's high-top sneakers.
  4) ☕ PROPS & BACKGROUND STORYTELLING DETAILS: Foreground/side props (steaming paper coffee cup on letter ledge, open notebook/sketchbook, soda bottle with condensation, potted foliage) + Rich atmospheric background elements (sunset tangled powerlines, glowing vending machine, warm cafe window backlight, layered city skyline).
- 🌆 12 HIGH-VARIETY LOCATIONS & TIMING (Every cut MUST explore a completely distinct setting & lighting):
  * Cut 1 (駅前歩道橋・放課後夕暮れ): Orange sunset sky, tangled powerlines, letters of "${mvSongTitle}" scattered along footbridge railing, girl sitting in 'O' dangling sneakers.
  * Cut 2 (夜の雨上がり裏路地): Wet asphalt reflecting pink/cyan glowing neon 3D letters, puddle ripples, girl lying across 'U' curve gazing up at rainy twilight sky.
  * Cut 3 (学校の屋上・青空と入道雲): Crisp cobalt summer sky, towering white thunderhead clouds, chain-link fence, pastel letters of "${mvSongTitle}" resting along rooftop edge, girl perched on 'H'/'A' crossbar holding headphones.
  * Cut 4 (レトロ純喫茶前・午後): Cobblestone pavement, warm amber light through textured glass, steaming coffee cup and potted green plant on letter pedestal, girl leaning against 'L'/'E' step holding smartphone.
  * Cut 5 (深夜のコインランドリー前): Glowing cyan vending machine, white fluorescent glow through glass, neon tube letters embedded on curb, girl peeking playfully between two tall letters.
  * Cut 6 (海沿いの坂道と踏切): Shimmering blue sea horizon, coastal railway crossing barrier, bright sun glinting off white clouds, giant letters lining the roadside, girl in shade of giant letter on sidewalk.
  * Cut 7 (高架下ストリートアート壁面): Atmospheric elevated railway bridge, colorful urban graffiti wall, concrete letters, girl walking along top edge of connected letters like balance beam.
  * Cut 8 (夕暮れ河川敷の階段・サビ): Magic hour violet and amber sky, wide grass embankment concrete steps, illuminated letters glowing, wind whipping oversized hoodie, dynamic dance step.
  * Cut 9 (深夜の首都高陸橋): Distant car headlight light-trails, steel bridge girders, cool midnight breeze, girl resting high-top sneaker on first letter pedestal tying shoelace.
  * Cut 10 (早朝のカフェ通り): Dawn light breaking, empty quiet shopping arcade, morning mist, girl leaning both arms against curved back of rounded letter, chin resting on hands.
  * Cut 11 (ネオン街ゲームセンター横): Vibrant arcade neon reflections on wet street, clear vinyl umbrella, backlit silhouette of girl against the glowing giant phrase letters.
  * Cut 12 (夜明けの摩天楼屋上・結末): Golden sunrise crowning the city skyline, quiet morning breeze, girl sitting atop the final letter of "${mvSongTitle}" watching the new day begin.
- ✍️ LYRICS ASSIGNMENT: Assign poetic Japanese phrases to each cut's "narrationJp" (if user lyrics are provided: ${lyricsList.length > 0 ? `incorporate phrases from: ${lyricsList.slice(0, 12).join(' / ')}` : 'poetic urban lyric lines'}).
`;
  }
  const pacingDirective = !isFinalChunk
    ? `\n【重要・物語の進行に関する絶対指示】現在は全${totalCutCount}カット中の第${startCut}〜${endCut}カット目（物語の途中・展開中）です。ここで絶対に物語を完結させず、次のカット（Cut ${endCut + 1}以降）へ続く展開のままバトンを渡してください。事件の完全解決や総括の結びに入らず、次へ続く緊張感や新たな事態の発生を描いてください。結末（オチ・解決）は最終カット（Cut ${totalCutCount}）でのみ描かれます。`
    : `\n【最終バッチ指示】現在は全${totalCutCount}カットのクライマックスおよび結末部（Cut ${startCut}〜${endCut}）です。これまでの展開を受け止め、第${totalCutCount}カット目で見事な結末・オチ・余韻を描いてストーリーを美しく完結させてください。`;
  const relayHistoryClause = previousCutsSummary
    ? `\n--- PREVIOUS CUTS CONTEXT (Cut 1 to ${startCut - 1}) ---\n${previousCutsSummary}\nCRITICAL: Continue the story chronologically from Cut ${endCut < totalCutCount ? startCut : startCut}. Do not restart or repeat previous scenes.`
    : '';
  return `You are an elite film director, manga artist, and art director for modern Lo-Fi anime music videos.
Generate screenplay for Cut ${startCut} to Cut ${endCut} (Total Cuts planned: ${totalCutCount}) for Episode ${epId} in "${worldSetting}".
Episode Concept: "${currentPlan.summary || plannedTitleJp}".
Art Style: "${taste || ''}" (${rawStyle}).
${avoidDup}
${charDirective}
${mvWorldDirection}
${pacingDirective}
${relayHistoryClause}
MANDATORY RULES:
1. Generate EXACTLY ${chunkCount} cuts starting from id: ${startCut} up to id: ${endCut}.
2. Ensure continuous story flow and visual variety across shot scales (Close-up, Medium, Wide).
3. Cut with "isObjectOnly": true should occasionally focus on an atmospheric symbolic keepsake or deserted prop without humans.
4. "basicPlot" MUST be clear, high-detail English description for text-to-image prompt.
5. "narrationJp" MUST be natural Japanese dialogue, lyric phrase, or poetic narration (around 20-40 characters).
6. Format: Output cuts as an array under the "cuts" field, even if there is only 1 cut.
Output ONLY valid JSON:
{
  ${isFirstChunk ? `"titleJp": "${plannedTitleJp}",
  "titleEn": "${plannedTitleEn}",
  "summary": "${currentPlan.summary || plannedTitleJp}",
  "characterDna": "${defaultCharDna}",
  "eraAnalysisJp": "時代背景・世界観の解説（日本語）",` : ''}
  "cuts": [
    { 
      "id": ${startCut}, 
      "isObjectOnly": false,
      "basicPlot": "Cinematic visual scene description of protagonist...", 
      "narrationJp": "セリフまたは歌詞フレーズ（日本語）"
    }
  ]
}`;
}
/**
 * ── 🎵 【最重要】完成画像をGeminiに視覚解析させ、エモい切り抜きCutを動的判定させる ──
 */
export async function analyzeImageForEmoCrops(
  imageBase64: string,
  cutId: number,
  narrationJp: string,
  promptEn: string
): Promise<{
  emoCrops: Array<{
    id: number;
    label: string;
    centerX: number;
    centerY: number;
    zoomScale: number;
    panDirection?: 'none' | 'slow-pan-right' | 'slow-pan-left' | 'slow-tilt-up' | 'slow-zoom-in' | 'slow-zoom-out';
    emoReason: string;
    isSafeFromArtifacts: boolean;
  }>;
  visualArtifactWarning?: string;
  cinemagraphMotionTargets?: string;
}> {
  const cleanB64 = imageBase64.replace(/^data:image\/\w+;base64,/, '').trim();
  if (!cleanB64) {
    return {
      emoCrops: [{
        id: 1,
        label: '全体ビュー (Full)',
        centerX: 0.5,
        centerY: 0.5,
        zoomScale: 1.0,
        panDirection: 'none',
        emoReason: '構図全体の静謐な空気感をそのまま味わうマスターショット',
        isSafeFromArtifacts: true
      }],
      cinemagraphMotionTargets: 'delicate swaying of hair tips, subtle flutter of clothes hem, natural blinking, gentle ambient light flicker'
    };
  }
  const analysisPrompt = `You are a legendary Anime Music Video (AMV) Art Director & Cinematographer.
Analyze the provided generated image for Cut #${cutId} (Context: "${narrationJp}", Prompt: "${promptEn}").
YOUR MISSION:
1. ARTIFACT & DEFORMATION INSPECTION:
   - Identify if there are any subtle hand/finger deformations, strange face lines, or clipped elements.
   - Note which areas are crisp, beautiful, and SAFE to zoom into (e.g. gorgeous eye profile, cool sneakers, sneakers on wet pavement, silhouette against glowing giant letters, atmospheric sky).
   - If an area has risk of looking weird when cropped, DO NOT crop tightly into it.
2. DYNAMIC EMO CROP SELECTION (EXTRACT 3 TO 4 DISTINCTLY DIVERSE CROPS):
   - You MUST extract 3 to 4 crop points that look radically different from each other so the video editor can cut between them dynamically:
     1) [全景マスター (Wide/Full)]: zoomScale: 1.0 to 1.15. The whole 4-zone high-density scenery showing the scattered 3D letters, anime girl, and city depth.
     2) [キャラクター表情・上半身 (Medium Chest/Face)]: zoomScale: 1.5 to 2.1, centered on the girl's expressive face, backwards cap, and headphones around her neck.
     3) [足元・スニーカーと地面反射 (Sneakers & Ground)]: zoomScale: 1.4 to 2.0, centered on the girl's high-top sneakers resting on the curb/pavement with puddle/wet surface reflections.
     4) [エモ小道具・風景パーツ (Prop / Letter Detail)]: zoomScale: 1.4 to 2.0, centered on the steaming coffee cup, soda bottle, plant, or neon glowing letter curve next to her.
   - For each crop, define:
     * label: Japanese title (e.g. "4ゾーン全景 (マスター)", "キャップと横顔 (上半身)", "スニーカーと路面の反射 (足元)", "湯気立つ珈琲と文字の影 (小道具)")
     * centerX: normalized coordinate (0.05 to 0.95, center is 0.5)
     * centerY: normalized coordinate (0.05 to 0.95, center is 0.5)
     * zoomScale: 1.0 to 2.2
     * panDirection: 'none' | 'slow-pan-right' | 'slow-pan-left' | 'slow-tilt-up' | 'slow-zoom-in' | 'slow-zoom-out'
     * emoReason: Japanese aesthetic explanation why this crop evokes deep emotion / chill vibe.
     * isSafeFromArtifacts: boolean (true if visually flawless)
3. CINEMAGRAPH MOTION TARGETS (VEO 3.1 LITE SELECTION):
   - Inspect what is ACTUALLY VISIBLE in this image.
   - Pick 3 to 5 motion phrases STRICTLY from the following 20-item whitelist that exist in this image:
     [Character]:
     - "delicate swaying of hair tips/strands"
     - "subtle flutter of hoodie strings and clothes hem"
     - "natural blinking and gentle breathing"
     - "tiny rhythmic toe-tapping of dangling sneakers"
     - "subtle finger tapping"
     [Props/Objects]:
     - "rising steam from hot drinks/food"
     - "fizzing bubbles in soda bottle/glass"
     - "fluttering pages of an open notebook/book"
     - "gentle swaying of curtains, lanterns, or wind chimes"
     - "spinning laundromat drum or vinyl record"
     - "dripping raindrops from clear umbrella/eaves"
     [Lights/City]:
     - "soft ambient flicker on neon tubes and streetlights"
     - "blinking traffic lights or railroad crossing signals"
     - "subtle screen glow from smartphone"
     [Nature/Atmosphere]:
     - "subtle ripples on water puddles or shimmering sea surface"
     - "gentle rustling of tree leaves and dappled sunlight"
     - "drifting dust motes, petals, mist, or rain droplets"
     - "slow drift of distant clouds"
     - "slight wind sway on overhead power lines"
     - "flickering candle or incense smoke"
   - Output comma-separated English list in "cinemagraphMotionTargets" field. Do NOT include elements not present in the image!
Output ONLY valid JSON:
{
  "visualArtifactWarning": "気づいた破綻リスク（なければ空文字）",
  "cinemagraphMotionTargets": "3 to 5 comma-separated whitelist phrases describing actual visible elements",
  "emoCrops": [
    {
      "id": 1,
      "label": "ショット名",
      "centerX": 0.5,
      "centerY": 0.5,
      "zoomScale": 1.0,
      "panDirection": "slow-zoom-in",
      "emoReason": "なぜエモいかの理由",
      "isSafeFromArtifacts": true
    }
  ]
}`;
  try {
    const res = await callWithRetry<any>(
      () => Flow.generate.text(analysisPrompt, {
        systemInstruction: "You are an expert anime art director analyzing frame compositions with precision.",
        images: [{ base64: cleanB64, mimeType: 'image/png' }]
      }),
      undefined,
      { maxRetries: 2, timeoutMs: 45000 }
    );
    const parsed = safeJsonParse<any>(res?.text || '{}', {});
    const crops = Array.isArray(parsed.emoCrops) && parsed.emoCrops.length > 0 ? parsed.emoCrops : [];
    const motionTargets = (parsed.cinemagraphMotionTargets || '').trim() || 'delicate swaying of hair tips, subtle flutter of clothes hem, natural blinking, gentle ambient light flicker';
    
    if (crops.length === 0) {
      return {
        emoCrops: [{
          id: 1,
          label: '全体マスタービュー',
          centerX: 0.5,
          centerY: 0.5,
          zoomScale: 1.0,
          panDirection: 'slow-zoom-in',
          emoReason: '巨大文字とキャラクターの対比が最も美しく成立している全体構図',
          isSafeFromArtifacts: true
        }],
        visualArtifactWarning: parsed.visualArtifactWarning || undefined,
        cinemagraphMotionTargets: motionTargets
      };
    }
    return {
      emoCrops: crops.map((c: any, idx: number) => ({
        id: idx + 1,
        label: c.label || `エモ切り抜き #${idx + 1}`,
        centerX: typeof c.centerX === 'number' ? Math.max(0.1, Math.min(0.9, c.centerX)) : 0.5,
        centerY: typeof c.centerY === 'number' ? Math.max(0.1, Math.min(0.9, c.centerY)) : 0.5,
        zoomScale: typeof c.zoomScale === 'number' ? Math.max(1.0, Math.min(2.5, c.zoomScale)) : 1.2,
        panDirection: c.panDirection || 'none',
        emoReason: c.emoReason || '構図の詩的対比と空気感の調和',
        isSafeFromArtifacts: c.isSafeFromArtifacts !== false
      })),
      visualArtifactWarning: parsed.visualArtifactWarning || undefined,
      cinemagraphMotionTargets: motionTargets
    };
  } catch (err) {
    console.warn('[Gemini Emo Crop Analysis Fallback]', err);
    return {
      emoCrops: [{
        id: 1,
        label: '全体ビュー (Default)',
        centerX: 0.5,
        centerY: 0.5,
        zoomScale: 1.0,
        panDirection: 'slow-zoom-in',
        emoReason: '街の空気感と立体文字の存在感を自然に捉えたマスター構図',
        isSafeFromArtifacts: true
      }],
      cinemagraphMotionTargets: 'delicate swaying of hair tips, subtle flutter of clothes hem, natural blinking, gentle ambient light flicker'
    };
  }
}
/**
 * ── 🎵 【MV 1枚絵から12連微動展開】マスター1枚絵から12アングルと別々のシネマグラフ部位を抽出 ──
 */
export async function analyzeMasterImageFor12Crops(
  imageBase64: string,
  lyricsList: string[],
  songTitle: string
): Promise<Array<{
  cutId: number;
  label: string;
  centerX: number;
  centerY: number;
  zoomScale: number;
  panDirection?: 'none' | 'slow-pan-right' | 'slow-pan-left' | 'slow-tilt-up' | 'slow-zoom-in' | 'slow-zoom-out';
  emoReason: string;
  cinemagraphMotionTargets: string;
}>> {
  const cleanB64 = imageBase64.replace(/^data:image\/\w+;base64,/, '').trim();
  const whitelistClauses = [
    'delicate swaying of hair tips/strands',
    'subtle flutter of hoodie strings and clothes hem',
    'natural blinking and gentle breathing',
    'tiny rhythmic toe-tapping of dangling sneakers',
    'subtle finger tapping',
    'rising steam from hot drinks/food',
    'fizzing bubbles in soda bottle/glass',
    'fluttering pages of an open notebook/book',
    'gentle swaying of curtains, lanterns, or wind chimes',
    'spinning laundromat drum or vinyl record',
    'dripping raindrops from clear umbrella/eaves',
    'soft ambient flicker on neon tubes and streetlights',
    'blinking traffic lights or railroad crossing signals',
    'subtle screen glow from smartphone',
    'subtle ripples on water puddles or shimmering sea surface',
    'gentle rustling of tree leaves and dappled sunlight',
    'drifting dust motes, petals, mist, or rain droplets',
    'slow drift of distant clouds',
    'slight wind sway on overhead power lines',
    'flickering candle or incense smoke'
  ];
  const default12 = [
    { cutId: 1, label: 'マスター全景 (世界観確立)', centerX: 0.5, centerY: 0.5, zoomScale: 1.0, panDirection: 'slow-zoom-in' as const, emoReason: '街と立体文字と少女の全景', cinemagraphMotionTargets: 'delicate swaying of hair tips/strands, subtle flutter of hoodie strings and clothes hem, slow drift of distant clouds' },
    { cutId: 2, label: '少女の横顔・呼吸 (表情寄)', centerX: 0.45, centerY: 0.35, zoomScale: 1.8, panDirection: 'slow-tilt-up' as const, emoReason: 'キャップ下の澄んだ瞳とヘッドフォン', cinemagraphMotionTargets: 'natural blinking and gentle breathing, delicate swaying of hair tips/strands' },
    { cutId: 3, label: '足元のスニーカー (リズムタップ)', centerX: 0.48, centerY: 0.82, zoomScale: 1.7, panDirection: 'slow-pan-right' as const, emoReason: 'ハイカットスニーカーと縁石の影', cinemagraphMotionTargets: 'tiny rhythmic toe-tapping of dangling sneakers, subtle ripples on water puddles or shimmering sea surface' },
    { cutId: 4, label: '手元の小道具・湯気 (日常感)', centerX: 0.55, centerY: 0.60, zoomScale: 1.9, panDirection: 'none' as const, emoReason: '温かいドリンクの湯気と微かな指先', cinemagraphMotionTargets: 'rising steam from hot drinks/food, subtle finger tapping' },
    { cutId: 5, label: '立体文字モニュメント (サビ導入)', centerX: 0.70, centerY: 0.45, zoomScale: 1.4, panDirection: 'slow-pan-left' as const, emoReason: '街に溶け込む巨大英文字のカーブ', cinemagraphMotionTargets: 'soft ambient flicker on neon tubes and streetlights, gentle rustling of tree leaves and dappled sunlight' },
    { cutId: 6, label: '街の空気感・さざ波 (情景インサート)', centerX: 0.30, centerY: 0.70, zoomScale: 1.5, panDirection: 'slow-tilt-up' as const, emoReason: '濡れた路面の反射と光彩', cinemagraphMotionTargets: 'subtle ripples on water puddles or shimmering sea surface, dripping raindrops from clear umbrella/eaves' },
    { cutId: 7, label: '後ろ姿・パーカーの裾 (サビ絶頂)', centerX: 0.48, centerY: 0.45, zoomScale: 1.5, panDirection: 'slow-zoom-in' as const, emoReason: '風に吹かれるビッグシルエットパーカー', cinemagraphMotionTargets: 'subtle flutter of hoodie strings and clothes hem, delicate swaying of hair tips/strands' },
    { cutId: 8, label: '頭上の電線と空 (解放感)', centerX: 0.50, centerY: 0.20, zoomScale: 1.4, panDirection: 'slow-tilt-up' as const, emoReason: '交差する電線とグラデーション空', cinemagraphMotionTargets: 'slight wind sway on overhead power lines, slow drift of distant clouds' },
    { cutId: 9, label: 'ネオン看板と光の明滅 (夜更け)', centerX: 0.75, centerY: 0.30, zoomScale: 1.7, panDirection: 'none' as const, emoReason: 'レトロな明滅とLo-Fiな陰影', cinemagraphMotionTargets: 'soft ambient flicker on neon tubes and streetlights, subtle screen glow from smartphone' },
    { cutId: 10, label: '少女の目元・まつ毛 (繊細な感情)', centerX: 0.45, centerY: 0.32, zoomScale: 2.1, panDirection: 'none' as const, emoReason: '涼しげな眼差しと風に揺れる前髪', cinemagraphMotionTargets: 'natural blinking and gentle breathing, delicate swaying of hair tips/strands' },
    { cutId: 11, label: '風に揺れる街角・葉擦れ (クライマックス)', centerX: 0.25, centerY: 0.40, zoomScale: 1.6, panDirection: 'slow-pan-right' as const, emoReason: '街路樹の木漏れ日と木々のざわめき', cinemagraphMotionTargets: 'gentle rustling of tree leaves and dappled sunlight, drifting dust motes, petals, mist, or rain droplets' },
    { cutId: 12, label: '全景ラストショット (余韻)', centerX: 0.50, centerY: 0.50, zoomScale: 1.05, panDirection: 'slow-zoom-out' as const, emoReason: '曲の終わりを告げる静かな全景フェード', cinemagraphMotionTargets: 'delicate swaying of hair tips/strands, natural blinking and gentle breathing, slow drift of distant clouds' }
  ];
  if (!cleanB64) return default12;
  const prompt = `You are a master anime music video director. We have ONE SINGLE high-definition master artwork for song "${songTitle || 'Lo-Fi Chill'}".
Your task: Divide this single image into EXACTLY 12 distinct cinematic crops (Cut 1 to Cut 12), ensuring 100% character and art style consistency with zero artifacts.
For EACH of the 12 cuts:
1. Provide unique framing:
   - Cut 1: Wide establishing shot (zoomScale: 1.0)
   - Cut 2: Medium face/eyes profile (zoomScale: 1.6 - 2.1)
   - Cut 3: Footwear / sneakers / ground interaction (zoomScale: 1.5 - 2.0)
   - Cut 4: Prop or beverage / food steam / hands (zoomScale: 1.5 - 2.0)
   - Cut 5: 3D typography letters detail in environment (zoomScale: 1.3 - 1.8)
   - Cut 6: Environment / reflection / puddles (zoomScale: 1.3 - 1.8)
   - Cut 7: Back or torso silhouette in the wind (zoomScale: 1.4 - 1.9)
   - Cut 8: Sky, rooftop, overhead powerlines or ceiling (zoomScale: 1.3 - 1.7)
   - Cut 9: Neon signage / streetlight / screen glow (zoomScale: 1.4 - 1.9)
   - Cut 10: Extreme close-up of eyes or headphones (zoomScale: 1.8 - 2.2)
   - Cut 11: Foliage / curtains / background scenery (zoomScale: 1.4 - 1.8)
   - Cut 12: Final wide outro shot (zoomScale: 1.05)
2. Assign 2-3 motion phrases for Veo 3.1 Lite cinemagraph loop STRICTLY from this whitelist:
${whitelistClauses.map(w => `   - "${w}"`).join('\n')}
Output ONLY valid JSON:
{
  "crops": [
    {
      "cutId": 1,
      "label": "カット名",
      "centerX": 0.5,
      "centerY": 0.5,
      "zoomScale": 1.0,
      "panDirection": "slow-zoom-in",
      "emoReason": "美学的な演出理由",
      "cinemagraphMotionTargets": "whitelist phrase 1, whitelist phrase 2"
    }
  ]
}`;
  try {
    const res = await callWithRetry<any>(
      () => Flow.generate.text(prompt, {
        systemInstruction: "You are a world-class anime MV director orchestrating 12 distinct crops from a master artwork.",
        images: [{ base64: cleanB64, mimeType: 'image/png' }]
      }),
      undefined,
      { maxRetries: 2, timeoutMs: 50000 }
    );
    const parsed = safeJsonParse<any>(res?.text || '{}', {});
    const rawList = Array.isArray(parsed?.crops) ? parsed.crops : [];
    if (rawList.length >= 8) {
      return Array.from({ length: 12 }, (_, i) => {
        const item = rawList.find((c: any) => c && Number(c.cutId) === (i + 1)) || rawList[i] || default12[i];
        return {
          cutId: i + 1,
          label: item.label || default12[i].label,
          centerX: typeof item.centerX === 'number' ? Math.max(0.1, Math.min(0.9, item.centerX)) : default12[i].centerX,
          centerY: typeof item.centerY === 'number' ? Math.max(0.1, Math.min(0.9, item.centerY)) : default12[i].centerY,
          zoomScale: typeof item.zoomScale === 'number' ? Math.max(1.0, Math.min(2.5, item.zoomScale)) : default12[i].zoomScale,
          panDirection: item.panDirection || default12[i].panDirection,
          emoReason: item.emoReason || default12[i].emoReason,
          cinemagraphMotionTargets: item.cinemagraphMotionTargets || default12[i].cinemagraphMotionTargets
        };
      });
    }
  } catch (err) {
    console.warn('[analyzeMasterImageFor12Crops fallback]', err);
  }
  return default12;
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
  const isMv = settings.isMvMode || task.isMvMode;
  const effectiveScale = task.shotScale || preset.scale;
  const effectiveAngle = task.cinematicAngle || preset.angle;
  let antiPreviousNegative = isMv 
    ? 'extreme macro face, cropped forehead, distorted fingers, anatomical fusion, 3d CGI render' 
    : buildDynamicAntiPreviousNegative(previousShotInfo, effectiveScale);
  if (isMv && !isAllowedEyeContact) {
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
  mvSettings?: { songTitle?: string; lyricsMemo?: string; mvVibe?: 'pop' | 'chill'; mvStyleMode?: 'lofi_loop' | 'unified' | 'mix' };
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
  let episodeMetadata = {
    titleJp: cleanEpisodeTitle(currentPlan.titleJp || `場面${epId}`),
    titleEn: cleanEpisodeTitleEn(currentPlan.titleEn || `Scene ${epId}`),
    summary: currentPlan.summary || `${currentPlan.titleJp}の世界観で紡がれる物語`,
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
      previousCutsSummary,
      opts.mvSettings
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
      const isObj = isMvMode ? false : (rawCutData.isObjectOnly !== undefined ? Boolean(rawCutData.isObjectOnly) : (globalCutId % 6 === 0));
      const rawNarration = rawCutData.narrationJp || rawCutData.narration || (isMvMode ? `歌詞パート${globalCutId}` : `場面${globalCutId}の情景`);
      const defaultCoord: [number, number] = isObj ? [0.5, 0.5] : [0.5, 0.4];
      const defaultSubject = isObj ? 'symbolic_object' : 'character_and_giant_typography';
      const defaultPlot = isMvMode
        ? `Wide to medium shot of cool anime girl in stylish hoodie and sneakers interacting with gigantic 3D physical typography object of song title in a quiet Lo-Fi urban scene`
        : (isObj
          ? `Atmospheric iconic object or landscape matching ${theme}, completely empty of people, cinematic still-life`
          : `${fixedChar ? `${fixedChar.dnaPromptEn}, ` : ''}cinematic scene ${globalCutId} of ${currentPlan.titleEn}, atmospheric lighting`);
      accumulatedCuts.push({
        id: globalCutId,
        panelLayout: 'single',
        basicPlot: rawCutData.basicPlot || rawCutData.promptEn || defaultPlot,
        narrationJp: sanitizeForYouTubeSafety(rawNarration, isMvMode),
        highlights: rawCutData.highlights || episodeMetadata.highlightWords || [],
        isObjectOnly: isObj,
        focalPoint: {
          grid: isObj ? 'center' : 'center',
          normalizedCoord: defaultCoord,
          focalSubject: defaultSubject
        },
        compositionPrompt: rawCutData.compositionPrompt || (isMvMode
          ? 'Medium-wide establishing composition showing both the massive 3D typography letters and the cool anime girl clearly framed in the scene'
          : (isObj 
            ? 'Centered still-life composition of prop/object, rule of thirds, completely empty of people' 
            : 'Subject framed at upper-third, face centered at top-center, rule of thirds composition'))
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

