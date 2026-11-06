import { SAFE_CHARACTERS } from '../config/safeCharacters';
import { SeriesEpisodePlan } from '../types';
import { TASTES } from '../constants';

export function resolveTasteKey(tasteKeyOrId: string = ''): string {
  if (!tasteKeyOrId) return '';
  const trimmed = tasteKeyOrId.trim();
  if (TASTES[trimmed]) return trimmed;

  const lower = trimmed.toLowerCase();
  const partialKey = Object.keys(TASTES).find(
    k => k.split(' (')[0] === trimmed || k.toLowerCase().includes(lower)
  );
  return partialKey || trimmed;
}

export function resolveTastePrompt(tasteKey: string): string {
  if (!tasteKey) return '';
  const fullKey = resolveTasteKey(tasteKey);
  return TASTES[fullKey] || TASTES[tasteKey] || tasteKey;
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
  if (
    combined.includes('現代') || combined.includes('令和') || combined.includes('平成') || 
    combined.includes('バブル') || combined.includes('SNS') || combined.includes('ブラック企業') || 
    combined.includes('社内不倫') || combined.includes('タワマン') || combined.includes('推し活') || 
    combined.includes('マッチングアプリ')
  ) {
    return false;
  }
  return (
    combined.includes('江戸') || combined.includes('幕末') || combined.includes('明治') || 
    combined.includes('大正') || combined.includes('戦後') || combined.includes('昭和') || 
    combined.includes('戦国') || combined.includes('平安') || combined.includes('鎌倉') || 
    combined.includes('室町') || combined.includes('安土桃山') || combined.includes('古代') || 
    combined.includes('中世') || combined.includes('大河') || combined.includes('吉原') || 
    combined.includes('新選組') || combined.includes('浪人') || combined.includes('大名') || 
    combined.includes('武士') || combined.includes('侍') || combined.includes('寺子屋') || 
    combined.includes('飛脚') || combined.includes('岡っ引き') || combined.includes('火消し') || 
    combined.includes('屋台めし') || combined.includes('薬売り') || combined.includes('鉄火場') || 
    combined.includes('鼠小僧')
  );
}

export function extractHighlights(narrationText: string, suggestedWords: string[] = []): Array<{ word: string; color: string; sizeScale: number }> {
  if (!narrationText || !narrationText.trim()) return [];
  const validHighlights: Array<{ word: string; color: string; sizeScale: number }> = [];
  const neonColors = ['#FFE600', '#00F0FF', '#FF2A85', '#39FF14', '#FF7A00', '#BD00FF'];

  for (const rawWord of suggestedWords) {
    const word = (rawWord || '').trim();
    if (word && narrationText.includes(word) && word.length >= 1 && word.length <= 8) {
      if (!validHighlights.some(h => h.word === word)) {
        const color = neonColors[validHighlights.length % neonColors.length];
        validHighlights.push({ word, color, sizeScale: 1.15 });
      }
    }
  }

  if (validHighlights.length === 0) {
    const compoundMatches = narrationText.match(/[\u4e00-\u9faf]{1,3}の[\u4e00-\u9faf]{1,3}/g);
    if (compoundMatches && compoundMatches.length > 0) {
      for (const word of Array.from(new Set(compoundMatches)).slice(0, 2)) {
        const color = neonColors[validHighlights.length % neonColors.length];
        validHighlights.push({ word, color, sizeScale: 1.15 });
      }
    }
  }

  if (validHighlights.length === 0) {
    const kanjiMatches = narrationText.match(/[\u4e00-\u9faf]{2,4}/g);
    if (kanjiMatches && kanjiMatches.length > 0) {
      const candidates = Array.from(new Set(kanjiMatches)).filter(w => w.length >= 2 && w.length <= 4);
      for (const word of candidates.slice(0, 2)) {
        const color = neonColors[validHighlights.length % neonColors.length];
        validHighlights.push({ word, color, sizeScale: 1.15 });
      }
    }
  }

  if (validHighlights.length === 0) {
    const katakanaMatches = narrationText.match(/[\u30a1-\u30f6]{2,6}/g);
    if (katakanaMatches && katakanaMatches.length > 0) {
      for (const word of Array.from(new Set(katakanaMatches)).slice(0, 2)) {
        const color = neonColors[validHighlights.length % neonColors.length];
        validHighlights.push({ word, color, sizeScale: 1.15 });
      }
    }
  }

  return validHighlights;
}

/**
 * 主人公キャラクターの三面図（正面・横顔・後ろ姿）マスターシート生成プロンプトを構築
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
    cleanStyle = cleanStyle
      .replace(/\b(edo period|feudal japan|ancient japan|ancient japanese)\b/gi, '')
      .replace(/,\s*,/g, ',')
      .replace(/^\s*,\s*/, '')
      .replace(/,\s*$/, '')
      .trim();
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

  const protagonistProfile = characterDna 
    ? `Protagonist design: ${characterDna}.` 
    : defaultProtagonistDesc;

  const safeThemeDesc = (theme || 'Japanese youth drama')
    .replace(/(少し着崩した|着崩した|ほどけかけた|乱れた|はだけた)/g, 'stylish')
    .replace(/[^\w\s,\.\-]/g, ' ')
    .trim() || 'Japanese school youth';

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
  const charDirective = fixedChar ? `\nPROTAGONIST LOCK: The protagonist MUST be "${fixedChar.nameJa}" (${fixedChar.dnaPromptEn}). Personality & speaking style in narrationJp: ${fixedChar.personality}. SAFETY GUARDRAIL: Never depict cruel abuse or make ${fixedChar.nameJa} a ruthless murderer/criminal.` : '';
  const defaultCharDna = fixedChar ? fixedChar.dnaPromptEn : 'Consistent single protagonist matching the world setting and narrative';
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
2. Protagonist: Define "characterDna" in English. All character cuts MUST feature this exact protagonist in "basicPlot".${charDirective}
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
