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

/**
 * 舞台設定が歴史・時代劇かどうかを判定（時代・テーマ双方から判定）
 */
export function checkIsHistorical(era: string = '', theme: string = ''): boolean {
  const combined = `${era} ${theme}`;
  // 現代・近過去・SNS・現代ビジネス系は非歴史
  if (
    combined.includes('現代') || 
    combined.includes('令和') || 
    combined.includes('平成') || 
    combined.includes('バブル') || 
    combined.includes('SNS') || 
    combined.includes('ブラック企業') || 
    combined.includes('社内不倫') || 
    combined.includes('タワマン') || 
    combined.includes('推し活') || 
    combined.includes('マッチングアプリ')
  ) {
    return false;
  }
  // 歴史・時代劇キーワード
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
export function buildGrandDesignPrompt(count: number, country: string, theme: string, era?: string, isMangaMode?: boolean, isMvMode?: boolean): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  if (isMvMode) {
    return `Create a ${count}-track music video visual series grand design with Concept & Theme: "${worldSetting}".
Analyze the atmospheric mood, ambient lighting, nostalgic or serene emotion, and visual continuity suitable for an aesthetic music video.
Keep the mood subdued, ennui, and poetic without dramatic conflicts or chaotic action.
Output ONLY valid JSON:
{
  "seriesTitle": "Aesthetic MV Concept Collection",
  "overallSynopsis": "Overview of the musical and visual atmosphere across all parts",
  "episodesPlan": [
    { "epNumber": 1, "titleJp": "日本語トラック/情景タイトル", "titleEn": "English Track Title", "summary": "情景と空気感の描写（日本語2〜3行）" }
  ]
}
`;
  }
  const mangaInstruction = isMangaMode 
    ? "Design the pacing and narrative structure specifically for a highly dynamic comic/manga serialization (including dramatic cliffhangers and fast-paced story development)." 
    : "";
  return `Create a full ${count}-episode drama grand design with World Theme & Setting: "${worldSetting}".
Analyze the authentic era, cultural background, human drama, and visual atmosphere directly from this theme.
${mangaInstruction}
Output ONLY valid JSON:
{
  "seriesTitle": "Dramatic Series Title",
  "overallSynopsis": "Overview of the entire narrative arc",
  "episodesPlan": [
    { "epNumber": 1, "titleJp": "日本語タイトル", "titleEn": "English Title", "summary": "話のあらすじ" }
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
    .map(p => `第${p.epNumber}話「${p.titleJp}」: ${p.summary || ''}`)
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

Output ONLY valid JSON:
{
  "epNumber": ${nextEpId},
  "titleJp": "日本語サブタイトル",
  "titleEn": "English Title",
  "summary": "第${nextEpId}話のあらすじ・展開（日本語2〜3行）"
}`;
}

/**
 * ナレーションから強調すべき重要キーワード（2〜4文字の漢字熟語等）を抽出・確定
 * （AIやユーザー指定の単語を優先し、本文に実在する単語だけを厳密に採用。空なら本文から自動抽出して確実に色付けを点灯させる）
 */
export function extractHighlights(narrationText: string, suggestedWords: string[] = []): Array<{ word: string; color: string; sizeScale: number }> {
  if (!narrationText || !narrationText.trim()) return [];
  const validHighlights: Array<{ word: string; color: string; sizeScale: number }> = [];

  const neonColors = ['#FFE600', '#00F0FF', '#FF2A85', '#39FF14', '#FF7A00', '#BD00FF'];

  // 1. 指定された単語のうち、ナレーション本文に確実に含まれているものを採用
  for (const rawWord of suggestedWords) {
    const word = (rawWord || '').trim();
    if (word && narrationText.includes(word) && word.length >= 1 && word.length <= 8) {
      if (!validHighlights.some(h => h.word === word)) {
        const color = neonColors[validHighlights.length % neonColors.length];
        validHighlights.push({ word, color, sizeScale: 1.15 });
      }
    }
  }

  // 2. 複合熟語（「三種の神器」「風の谷」などの 漢字＋の＋漢字）を優先検索
  if (validHighlights.length === 0) {
    const compoundMatches = narrationText.match(/[\u4e00-\u9faf]{1,3}の[\u4e00-\u9faf]{1,3}/g);
    if (compoundMatches && compoundMatches.length > 0) {
      for (const word of Array.from(new Set(compoundMatches)).slice(0, 2)) {
        const color = neonColors[validHighlights.length % neonColors.length];
        validHighlights.push({ word, color, sizeScale: 1.15 });
      }
    }
  }

  // 3. 漢字熟語（2〜4文字）を抽出
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

  // 4. カタカナ単語（2〜6文字）
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

export interface LyricSegment {
  text: string;
  isHighlight: boolean;
  color?: string;
}

export interface LyricLine {
  text: string;
  segments: LyricSegment[];
  hasHighlight: boolean;
}

/**
 * 日本語リリックテキストを自然な文節行に分割し、
 * 各行の中でハイライト指定単語「だけ」を正確にセグメント化する（助詞や他単語の誤着色を防止）
 */
export function buildLyricLines(fullText: string, highlights: Array<{ word: string; color?: string }>): LyricLine[] {
  const clean = (fullText || '').replace(/^[「『\s]+|[」』\s:：]+$/g, '').trim();
  if (!clean) return [];

  const particles = [
    'ながら', 'まま', 'のに', 'ので', 'ても', 'でも', 'から', 'より', 'けど', 'たら', 'して', 'まで', 
    'ば', 'は', 'が', 'を', 'に', 'へ', 'で', 'と', 'の', 'て'
  ];

  // 1. 初期の粗い分割（改行、読点、スペース）
  let initialChunks: string[] = [];
  if (clean.includes('\n')) {
    initialChunks = clean.split('\n').map(s => s.trim()).filter(Boolean);
  } else if (clean.includes('、') || clean.includes(' ') || clean.includes('　')) {
    initialChunks = clean.split(/[\s　、]+/).map(s => s.trim()).filter(Boolean);
  } else {
    initialChunks = [clean];
  }

  // 2. 各チャンクを検証し、1行が長すぎる（目安：11文字以上）場合は助詞や文節で美しく分割
  const splitChunkNaturally = (raw: string): string[] => {
    if (raw.length <= 11) return [raw];

    // キーワードを分断しないためのキーワード保護境界
    const localKeywordRanges: Array<[number, number]> = [];
    highlights.forEach(h => {
      if (!h.word) return;
      let pos = 0;
      while ((pos = raw.indexOf(h.word, pos)) !== -1) {
        localKeywordRanges.push([pos, pos + h.word.length]);
        pos += 1;
      }
    });

    const isInsideLocalKw = (index: number) => {
      return localKeywordRanges.some(([start, end]) => index > start && index < end);
    };

    const subLines: string[] = [];
    let cur = '';

    for (let i = 0; i < raw.length; i++) {
      cur += raw[i];
      const matchedParticle = particles.find(p => cur.endsWith(p));
      const canBreak = matchedParticle && 
                       cur.length >= 4 && 
                       !isInsideLocalKw(i + 1) && 
                       (raw.length - i - 1) >= 3;

      if (canBreak && subLines.length < 2) {
        subLines.push(cur);
        cur = '';
      }
    }
    if (cur) subLines.push(cur);
    return subLines.length > 0 ? subLines : [raw];
  };

  let refinedLines: string[] = [];
  for (const chunk of initialChunks) {
    if (chunk.length > 11 && refinedLines.length < 4) {
      const parts = splitChunkNaturally(chunk);
      refinedLines.push(...parts);
    } else {
      refinedLines.push(chunk);
    }
  }

  // 最大4行に制限（長すぎる場合は末尾行にまとめる）
  if (refinedLines.length > 4) {
    refinedLines = [...refinedLines.slice(0, 3), refinedLines.slice(3).join('')];
  }
  const lines = refinedLines.filter(Boolean);

  // 2. 各行の中で、ハイライト単語「だけ」を抽出してセグメント化
  // 長い単語を優先してマッチング
  const sortedHighlights = [...highlights].filter(h => h.word).sort((a, b) => b.word.length - a.word.length);

  return lines.map(lineText => {
    const charHighlight = new Array<{ isHighlight: boolean; color?: string }>(lineText.length);
    for (let i = 0; i < lineText.length; i++) {
      charHighlight[i] = { isHighlight: false };
    }

    sortedHighlights.forEach(h => {
      if (!h.word) return;
      let pos = 0;
      while ((pos = lineText.indexOf(h.word, pos)) !== -1) {
        // すでに別のハイライトが割り当てられていなければ設定
        let canSet = true;
        for (let k = 0; k < h.word.length; k++) {
          if (charHighlight[pos + k]?.isHighlight) {
            canSet = false;
            break;
          }
        }
        if (canSet) {
          for (let k = 0; k < h.word.length; k++) {
            charHighlight[pos + k] = { isHighlight: true, color: h.color || '#FFE600' };
          }
        }
        pos += 1;
      }
    });

    // 連続する文字をセグメントにまとめる
    const segments: LyricSegment[] = [];
    let curSegText = '';
    let curIsHigh = false;
    let curColor = '#FFE600';

    for (let i = 0; i < lineText.length; i++) {
      const hInfo = charHighlight[i];
      if (i === 0) {
        curSegText = lineText[i];
        curIsHigh = hInfo.isHighlight;
        curColor = hInfo.color || '#FFE600';
      } else if (hInfo.isHighlight === curIsHigh && (!curIsHigh || hInfo.color === curColor)) {
        curSegText += lineText[i];
      } else {
        segments.push({
          text: curSegText,
          isHighlight: curIsHigh,
          color: curIsHigh ? curColor : undefined
        });
        curSegText = lineText[i];
        curIsHigh = hInfo.isHighlight;
        curColor = hInfo.color || '#FFE600';
      }
    }
    if (curSegText) {
      segments.push({
        text: curSegText,
        isHighlight: curIsHigh,
        color: curIsHigh ? curColor : undefined
      });
    }

    const hasHighlight = segments.some(s => s.isHighlight);

    return {
      text: lineText,
      segments,
      hasHighlight
    };
  });
}

/**
 * 各話の脚本（12カット分）および時代考証をAIに動的生成させるプロンプト
 * （世界観・テーマからGeminiが時代考証・衣装・NG要素およびカットごとの金文字強調キーワードを自律生成）
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

  const modeConfig = getProductionModeConfig(effMode, isMvMode);
  const directorRole = modeConfig.getDirectorRole(isMangaMode, isHistorical);
  const contextTitle = modeConfig.getContextTitle(isMangaMode, isHistorical);
  const modeInstructions = modeConfig.promptInstructions;

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

  const multiPanelMandate = isMultiPanel
    ? `DYNAMIC MANGA/COMIC PANELING & SEQUENTIAL COMPOSITION (MULTI-PANEL MODE ENABLED):
As an expert comic/manga director, dynamically determine the visual panel layout for EACH cut to maximize narrative pacing, emotional drama, or comedic timing!
DO NOT restrict cuts to 4 panels! Freely choose varied layouts according to the story moment:
- "single": 1 epic full-bleed splash cut (for emotional climaxes, hero poses, dramatic wide scenery).
- "split-2": 2 contrasting horizontal or vertical split panels (e.g. main subject in one panel, scenic environmental detail or props in the other).
- "split-3": 3 dynamic sequential comic panels depicting rapid cause, action, and surprising outcome.
- "dynamic-multi": 2-4 varied asymmetrical or diagonal panels (for fast-paced montage, comic strips, or high-energy exchanges).

CRITICAL COMPOSITION & SEPARATION RULES (PREVENT OVERCROWDING & OVERLAPPING):
1. NO OVERLAPPING OR MERGED CHARACTERS: Each panel must have its own distinct space and focus. NEVER direct multiple instances of the same person stacked or overlapping directly on top of each other!
2. VISUAL BREATHING ROOM: If one panel features a character, other panels should focus on world-appropriate background scenery (matching "${worldSetting}"), contextual architecture, props, atmospheric lighting, or distinct camera perspectives. Keep the composition spacious and uncluttered!
3. CLEAN PANEL BOUNDARIES: Panels must be clearly divided with defined boundaries. Even if artistic frame-breaking occurs, figures must NEVER intersect or fuse into figures from adjacent panels.
4. FULL-BLEED ARTWORK: All panels must be full-bleed edge-to-edge artwork. Absolutely NO white outer border, NO blank margins!`
    : "";

  return `You are a ${directorRole} and visual researcher.
Create a 12-cut ${contextTitle} for Episode ${epId} ("${currentPlan.titleJp}").
World Theme & Setting: "${worldSetting}".
${visualStyleMandate}

${modeInstructions}

CRITICAL 12-CUT DYNAMIC CINEMATIC CONTRAST & PACING:
Design all 12 cuts with continuous, professional cinematic pacing and contrasting framing.
- NEVER use the exact same shot scale, camera angle, or character posture in two consecutive cuts!
- Dynamically alternate distances: Wide establishing shot -> Intense eye/expression close-up -> Medium profile in motion -> Over-shoulder -> Epic climax splash.
- Vary character poses: sitting, walking, standing resolute, gazing aside, dynamic action.
${mvCameraMandate}
${multiPanelMandate}

CRITICAL: MANDATORY OBJECT / INSERT CUT (NON-HUMAN SCENE):
Among the 12 cuts, EXACTLY 1 to 2 cuts (specifically Cut 6 or Cut 9 as emotional transition/interlude) MUST BE a symbolic object, prop, or environmental still-life with ABSOLUTELY NO HUMANS visible!
Examples of iconic objects matching "${worldSetting}":
- Illuminated or dropped smartphone screen displaying a notification/message on damp pavement.
- A kicked empty soda can rolling slowly across the asphalt street under streetlights.
- A basketball resting motionless on an empty playground court under setting sun.
- Raindrops splashing onto a dark puddle reflecting neon city reflections.
- Curtains fluttering gently by an open window.
For these non-human cuts, set "isObjectOnly": true! For all other human cuts, set "isObjectOnly": false.

CRITICAL: 9-GRID FOCAL POINT & SAFE COMPOSITION (PREVENT CROP CUT-OFFS):
For EVERY cut, specify where the main visual subject is positioned to prevent auto-crop accidents:
- If a person is present, position face safely in upper third: "grid": "top-center", "normalizedCoord": [0.5, 0.3], "focalSubject": "character_face".
- If an object or wide landscape, center it: "grid": "center", "normalizedCoord": [0.5, 0.5], "focalSubject": "object_name".

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
      ${isMultiPanel ? '"panelLayout": "split-2",' : ''}
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
  const modeConfig = getProductionModeConfig(effMode, isMvMode);
  const contextTitle = modeConfig.getContextTitle(isMangaMode, checkIsHistorical(era, theme));

  const avoidSection = existingTitles && existingTitles.length > 0
    ? `\nPREVIOUSLY COVERED TOPICS IN THIS SERIES (DO NOT DUPLICATE OR OVERLAP WITH THESE):\n${existingTitles.map(t => `- ${t}`).join('\n')}\n`
    : '';

  return `You are a creative showrunner directing a 12-cut ${contextTitle} for Episode ${epId} in "${worldSetting}".
Art Style: "${taste || 'Cinematic'}".
${avoidSection}
RULES:
1. Title: Create an engaging Japanese title ("titleJp", 15-25 chars) and English title ("titleEn"). No episode numbers.
2. Protagonist: Define "characterDna" in English (consistent single protagonist: age, gender, hair, signature attire). All character cuts MUST feature this exact protagonist.
3. Object Cut: Cut 6 should be an iconic object without humans ("isObjectOnly": true).
4. 8-Second Dynamic Motion & Evolution (Start -> End):
Every scene is an 8-second video! DO NOT make minor head tilts!
Design an energetic, distinct physical action change between start and end frames:
- "basicPlot": Start frame initial situation in English.
- "endFramePlot": End frame (8s later) reached posture. Keep identical protagonist, clothing, and room, but CHANGE posture/body action dynamically (e.g. standing up stretching arms high, spinning chair 90 degrees holding warm mug, leaning close pointing at screen, walking to open window, collapsing onto bed).
- "veoMotionPrompt": Continuous 8-second motion directive for Veo 3.1 interpolation (First [action], then [smooth transition], finally [reached dynamic state]).
${isMultiPanel ? '5. Panel layout: Use "single", "split-2", or "split-3" per cut.' : ''}

Output ONLY valid JSON:
{
  "titleJp": "このエピソード独自の具体的で引きの強い日本語お題（15〜25文字）",
  "titleEn": "Specific Topic Episode Subtitle in English",
  "summary": "${isMvMode ? '楽曲の世界観（日本語）' : 'あらすじ（日本語）'}",
  "characterDna": "Consistent 19yo Japanese girl, soft wavy dark brown chin-length bob, cozy knit sweater, sleek headphones",
  "eraAnalysisJp": "時代背景の解説（日本語）",
  "cuts": [
    { 
      "id": 1, 
      ${isMultiPanel ? '"panelLayout": "split-2", ' : ''}
      "isObjectOnly": false,
      "basicPlot": "Sitting focused drawing on tablet at glowing desk", 
      "endFramePlot": "Having stood up from chair, stretching arms high overhead with arched back",
      "veoMotionPrompt": "First drawing on tablet, then setting pen down and rising to feet, stretching arms high above head with deep breath",
      "narrationJp": "${isMvMode ? '曲の歌詞20文字前後' : '日本語ナレーション20文字'}"
    }
  ]
};`;
}

/**
 * YouTube広告ガイドライン・アルゴリズムに配慮したセーフワードサニタイザー
 * 露骨な下品語・身体排出物・過度なグロ表現を学術・歴史用語や安全な表現へ自動置換
 */
export function sanitizeForYouTubeSafety(text: string): string {
  if (!text) return '';
  return text
    .replace(/うんち|うんこ/g, '下肥')
    .replace(/人糞/g, '下肥')
    .replace(/糞尿/g, '排泄物')
    .replace(/下痢便/g, '赤痢')
    .replace(/下痢/g, '激しい腹痛')
    .replace(/死体/g, '遺骸')
    .replace(/惨殺/g, '討死');
}

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
  const { cutIndex, basicPlot, isObjectOnly, theme = '', isMvMode, existingEndPlot, existingVeoMotion } = options;

  // 既にGemini等から独自性のある endFramePlot が生成されている場合（basicPlot と完全一致ではなく、20文字以上）
  if (existingEndPlot && existingEndPlot.trim() !== basicPlot.trim() && existingEndPlot.length > 20 && existingVeoMotion) {
    return {
      endFramePlot: existingEndPlot.trim(),
      veoMotionPrompt: existingVeoMotion.trim()
    };
  }

  const isHist = checkIsHistorical('', theme);

  // 1. 物体・静物カット（Cut 6 または isObjectOnly）
  if (isObjectOnly || cutIndex === 5) {
    return {
      endFramePlot: 'The same iconic atmospheric still-life scene completely devoid of people, night breeze swaying curtains casting moving shadows, luminous neon and moonlight reflections drifting slowly across the surface, indicator LED pulsing softly in deep stillness.',
      veoMotionPrompt: 'First still atmospheric frame focusing on the iconic object, then nocturnal breeze swaying nearby fabric as neon and moonlight reflections shift across surfaces, finally settling into poetic, quiet midnight stillness.'
    };
  }

  // 2. 時代劇・歴史設定の場合の12カット固有アクション
  if (isHist) {
    const historicalActions: CinematicEvolution[] = [
      {
        endFramePlot: 'The same historical protagonist having stepped forward along the stone path, resting hand firmly on the hilt of the katana, sharp vigilant eyes scanning the moonlit trees.',
        veoMotionPrompt: 'First standing stationary in traditional garb, then taking two resolute paces forward while resting hand on the sword hilt, finally pausing with a vigilant, sharp glance into the night.'
      },
      {
        endFramePlot: 'The same historical protagonist sitting down smoothly on the wooden engawa porch, holding a steaming earthenware tea cup with both hands, looking out at the rain-soaked garden.',
        veoMotionPrompt: 'First walking along the hallway, then kneeling smoothly onto the wooden porch, lifting an earthenware cup with both hands, finally taking a quiet sip while gazing at the garden.'
      },
      {
        endFramePlot: 'The same historical protagonist having slightly unclasped the sword from its scabbard with their thumb, the polished steel blade catching a glint of cold moonlight.',
        veoMotionPrompt: 'First holding scabbard still, then using left thumb to nudge the sword guard, blade sliding out two inches with cold metallic glint in moonlight, finally locking eyes on the edge.'
      },
      {
        endFramePlot: 'The same historical protagonist raising a paper lantern high overhead, amber candlelight illuminating their focused determined profile as night wind flutters their haori.',
        veoMotionPrompt: 'First carrying lantern low in darkness, then lifting arm high to cast warm candlelight forward, haori coat fluttering in the breeze, finally standing resolute.'
      },
      {
        endFramePlot: 'The same historical protagonist turning around swiftly under the shadow of the temple roof, bamboo grove swaying fiercely behind them in a sudden rush of mountain wind.',
        veoMotionPrompt: 'First standing with back turned, then pivoting body gracefully in sudden alert, bamboo swaying dramatically in the wind, finally settling in a grounded stance.'
      },
      {
        endFramePlot: 'Still life of antique katana resting horizontally on a lacquered wooden stand, incense smoke curling upward into the moonbeams, quiet deserted chamber.',
        veoMotionPrompt: 'First still shot of the katana on the stand, then gentle curl of incense smoke drifting across the blade catching moonlight, finally settling into sacred stillness.'
      },
      {
        endFramePlot: 'The same historical protagonist kneeling quietly on the tatami mat, setting down the calligraphy brush, gazing thoughtfully at the fresh ink characters drying on washi paper.',
        veoMotionPrompt: 'First writing with intense brush strokes, then setting brush gently onto stone rest, resting hands on knees, finally exhaling softly while admiring the calligraphy.'
      },
      {
        endFramePlot: 'The same historical protagonist in dramatic emotional climax, stepping forward boldly, gazing directly into camera with intense piercing eyes, haori whipping in the storm wind!',
        veoMotionPrompt: 'First crouched in darkness, then rising with powerful explosive grace, stepping forward with haori whipping in the wind, finally locking eyes directly on camera with fierce determination.'
      },
      {
        endFramePlot: 'The same historical protagonist unfastening their straw travel hat, letting it hang back over their shoulder, wiping forehead with a tenugui cloth with a relaxed faint smile.',
        veoMotionPrompt: 'First walking with head bowed under straw hat, then reaching up to untie cord, letting hat slip back, wiping brow with cloth, finally gazing forward with serene relief.'
      },
      {
        endFramePlot: 'The same historical protagonist blowing out the paper lantern candle, the room plunging into deep indigo moonlight through the shoji sliding screens.',
        veoMotionPrompt: 'First warm candlelight glowing on face, then leaning gently to blow out the flame, scene plunging instantly into cool indigo moonlight and shoji shadows.'
      },
      {
        endFramePlot: 'The same historical protagonist resting peacefully on the futon bed, wrapped in warm kimono bedding, softly closing eyes in tranquil slumber under the safe roof.',
        veoMotionPrompt: 'First sitting on futon adjusting collar, then lying down smoothly, pulling thick quilt over shoulders, finally closing eyes in deep peaceful sleep.'
      },
      {
        endFramePlot: 'The same historical protagonist standing in the courtyard at dawn, morning mist parting around them, golden sunrise rays spilling across their shoulders as they breathe in the new dawn.',
        veoMotionPrompt: 'First shrouded in morning twilight, then golden dawn rays breaking over the roof, illuminating protagonist who takes a deep breath and looks toward the morning sun.'
      }
    ];
    return historicalActions[cutIndex % 12];
  }

  // 3. 音楽MV・現代深夜チル・ビジュアルドラマの場合の12カット被りなしダイナミックアクション
  const modernMvActions: CinematicEvolution[] = [
    // Cut 1 (index 0): 椅子を押して立ち上がり、両手を頭上に大きく伸ばして背中を反らせる豪快な伸び
    {
      endFramePlot: 'The same protagonist having pushed the desk chair back, standing up and arching back in a wide satisfying stretch with both arms lifted high overhead, breathing deeply in ambient screen light.',
      veoMotionPrompt: 'First sitting focused at the glowing workstation, then setting tools down, smoothly rising to feet and stretching arms high overhead with arched back, finally lowering arms with a relaxed deep breath.'
    },
    // Cut 2 (index 1): 椅子を90度くるりと部屋側に回し、両手で温かいマグカップを包み込んで口元に寄せる
    {
      endFramePlot: 'The same protagonist having spun the desk chair 90 degrees toward the room, cradling a warm ceramic mug in both hands near their lips, gentle steam rising into the cozy shadows.',
      veoMotionPrompt: 'First gazing at the illuminated display, then smoothly spinning the desk chair 90 degrees toward the room, reaching out to pick up the warm mug, finally holding it with both hands enjoying the warmth.'
    },
    // Cut 3 (index 2): 前屈みになり、顔をモニターにグッと近づけて人差し指で画面の波形やコードを指差して閃き・驚きの表情
    {
      endFramePlot: 'The same protagonist leaning forward close to the glowing monitor, pointing their right index finger at a specific line on screen with wide, inspired, captivated eyes.',
      veoMotionPrompt: 'First typing or drawing steadily, then suddenly pausing fingers, leaning upper body forward close to the screen in sudden revelation, finally pointing index finger at the glowing waveform with intrigued eyes.'
    },
    // Cut 4 (index 3): 窓辺に歩み寄り、片手でカーテンを軽く引き寄せながら雨の夜景を見下ろす
    {
      endFramePlot: 'The same protagonist standing right beside the window, gently drawing the sheer curtain aside with one hand, looking out at the glittering nocturnal cityscape.',
      veoMotionPrompt: 'First standing in the quiet room, then taking slow natural steps toward the window, pulling the curtain aside with left hand, finally gazing down at the rain-washed city lights.'
    },
    // Cut 5 (index 4): 窓をサッと開け放ち、吹き込む夜風で髪と部屋着が大きくふわりとなびく中、目を細めて爽快に深呼吸
    {
      endFramePlot: 'The same protagonist having slid the window open, cool midnight breeze blowing their bangs and clothing dynamically, smiling softly with eyes gently squinted in the fresh air.',
      veoMotionPrompt: 'First resting hands on window frame, then sliding the glass pane open, brisk night breeze blowing hair and fabric dynamically, finally closing eyes inhaling the fresh midnight air.'
    },
    // Cut 6 (index 5): 静物インサート
    {
      endFramePlot: 'The same iconic still-life scene empty of humans, curtains swaying in the nocturnal breeze as moving city neon reflections drift across the wooden desk, glowing LED indicator softly pulsing.',
      veoMotionPrompt: 'First static atmospheric still-life of the desktop object, then night breeze swaying curtains casting moving shadows as neon reflections drift across surfaces, finally settling quiet.'
    },
    // Cut 7 (index 6): ベッドの上にバフッと仰向けに倒れ込み、柔らかな掛け布団の上に大の字になって脱力する
    {
      endFramePlot: 'The same protagonist collapsed backward onto the soft mattress, arms and legs sprawled wide across the plush duvet, staring up at the ceiling with a happy, relieved smile.',
      veoMotionPrompt: 'First sitting on the bed edge looking exhausted, then falling straight backward onto the plush mattress, arms and legs sprawling wide across the soft quilt with a relieved smile.'
    },
    // Cut 8 (index 7): サビ・感情爆発！サッと勢いよく上半身を起こし、カメラ（視聴者）をまっすぐ強い情熱的な眼差しで見つめる
    {
      endFramePlot: 'The same protagonist surging upright with dynamic motion, turning their face directly toward the camera with fierce emotional passion, hair flowing, eyes sparkling with determination!',
      veoMotionPrompt: 'First lying still in dim shadows, then powerfully surging upper body upright with hair tossing, turning gaze directly into camera lens with vibrant emotional intensity and sparkling eyes.'
    },
    // Cut 9 (index 8): ヘッドホンをサッと外して首にかけ、片手で前髪をサラリとかきあげて視線を投げかける
    {
      endFramePlot: 'The same protagonist having slipped the headphones down around their neck, running their slender fingers through their front bangs, looking forward with a clear, refreshed gaze.',
      veoMotionPrompt: 'First swaying gently to music with headphones on, then raising hands to slip headphones down around neck, running slender fingers smoothly through front bangs, finally looking forward with clear calm eyes.'
    },
    // Cut 10 (index 9): デスクランプのスイッチをパチリと消し、部屋が瞬時に青白いPC画面と月明かりだけの深い世界へと一変する
    {
      endFramePlot: 'The same protagonist having switched off the warm desk lamp, the room instantly plunging into deep ethereal blue moonlight and screen glow, character resting in serene silhouette.',
      veoMotionPrompt: 'First warm orange incandescent glow, then reaching arm up to switch off lamp, light instantly shifting to deep atmospheric blue tones, settling into tranquil silhouette.'
    },
    // Cut 11 (index 10): 毛布を頭まですっぽり被り、枕をぎゅっと抱きしめて心地よい眠りに落ちていく
    {
      endFramePlot: 'The same protagonist snuggled deeply under the fluffy blanket pulled over their head, hugging a soft pillow tight, drifting peacefully into sweet nocturnal slumber.',
      veoMotionPrompt: 'First shivering lightly in cool room, then tugging warm comforter over shoulders and ears, hugging pillow tightly, finally settling into deep cozy slumber.'
    },
    // Cut 12 (index 11): カーテンの隙間から淡い紫とオレンジの朝焼けの光が差し込み、ゆっくりとまぶたを開けて新しい朝を見つめる
    {
      endFramePlot: 'Soft dawn daylight and pastel morning glow creeping through the window across the room, illuminating the protagonist softly fluttering their eyelids open, looking toward the new day.',
      veoMotionPrompt: 'First nocturnal dimness, then soft morning daylight creeping across the room, illuminating eyelashes, character slowly opening luminous eyes toward the dawn sky.'
    }
  ];

  return modernMvActions[cutIndex % 12];
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
  
  // MVモード時のカメラ目線厳格制御（全12カット中、サビの1回[Cut 8]のみ許可、他は一切カメラを見ない）
  const isAllowedEyeContact = settings.isMvMode && isMvChorusCut(cutId);
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

  // 定義テーブルに基づき直前構図を自動除外するネガティブ文字列を生成
  let antiPreviousNegative = buildDynamicAntiPreviousNegative(previousShotInfo);
  if (settings.isMvMode && !isAllowedEyeContact) {
    antiPreviousNegative = antiPreviousNegative ? `${antiPreviousNegative}, ${MV_ANTI_CAMERA_LOOK_NEGATIVE}` : MV_ANTI_CAMERA_LOOK_NEGATIVE;
  }
  if (isMultiPanelActive) {
    const multiPanelNeg = 'white outer border, page margins, white paper border, blank border, picture frame, overlapping characters, stacked people, people sitting on top of each other, merged humans, duplicate characters overlapping';
    antiPreviousNegative = antiPreviousNegative ? `${antiPreviousNegative}, ${multiPanelNeg}` : multiPanelNeg;
  }



  return {
    promptEn: `${preset.angle}. ${prompt}`,
    negativePrompt: antiPreviousNegative,
    cameraWork: recCw.id,
    cameraMotion: recCw.motionPrompt,
    cinematicAngle: preset.angle,
    shotScale: preset.scale,
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
    panelLayout?: 'single' | 'split-2' | 'split-3' | 'dynamic-multi';
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
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    console.warn(`[Script Fallback for Episode ${epId}] API混雑のため安全構成フォールバックを適用:`, errMsg);
    if (addLog) addLog(`✨ 第${epId}話 サーバー混雑のため、世界観に最適化された安全構成脚本で即座に制作を開始します！`, 'process');

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
      cuts: Array.from({ length: 12 }, (_, j) => {
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

        return {
          id: j + 1,
          panelLayout: isMultiPanel ? (j % 2 === 0 ? 'split-2' : 'dynamic-multi') : 'single',
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
  const normalizedCuts = Array.from({ length: 12 }, (_, j) => {
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

    return {
      id: j + 1,
      panelLayout: cutData.panelLayout || (isMultiPanel ? (j % 3 === 0 ? 'single' : 'split-2') : 'single'),
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
    titleJp: sanitizeForYouTubeSafety(parsed.titleJp || currentPlan.titleJp),
    titleEn: parsed.titleEn || currentPlan.titleEn,
    summary: sanitizeForYouTubeSafety(parsed.summary || currentPlan.summary || ''),
    characterDna: parsed.characterDna || (isMvMode 
      ? 'Consistent 19yo Japanese girl, soft wavy dark brown chin-length bob hair, gentle eyes, oversized cozy knit cardigan, sleek over-ear headphones' 
      : undefined),
    eraAnalysisJp: sanitizeForYouTubeSafety(parsed.eraAnalysisJp || ''),
    forbiddenAnachronisms: parsed.forbiddenAnachronisms || [],
    authenticAttireEn: parsed.authenticAttireEn || '',
    forbiddenKeywordsEn: parsed.forbiddenKeywordsEn || '',
    coverCatchphraseJp: sanitizeForYouTubeSafety(parsed.coverCatchphraseJp || currentPlan.titleJp),
    coverCatchphraseEn: parsed.coverCatchphraseEn || '',
    highlightWords: parsed.highlightWords || [],
    cuts: normalizedCuts
  };
}