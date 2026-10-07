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
4. 8-Second Dynamic Cinematic Progression (180° Drone Orbit & Camera Angle Shift):
Every cut is an 8-second video! Veo 3.1 excels at sweeping camera motion, 180° drone orbits, and spatial parallax without breaking anatomy!
Between Start Frame ("basicPlot") and End Frame ("endFramePlot"), create a DRAMATIC PERSPECTIVE / ANGLE SHIFT (e.g. 180-degree drone orbit to the other side showing dynamic profile/back, low-angle rising to high overhead crane view, sweeping spiral pan revealing the atmosphere, or character dramatically changing action/posture):
- "basicPlot": Start frame initial situation and camera angle in English.
- "endFramePlot": The reached visual state 8 seconds later. Maintain 100% identical protagonist, clothing, and room, but CAPTURED FROM A COMPLETELY DIFFERENT ANGLE OR SHIFTED POSTURE (e.g. camera has orbited 180 degrees to show dynamic side-profile or back against glowing backdrop, or character smoothly transitioned to a new posture under dynamic new lighting angle).
- "veoMotionPrompt": Natural continuous 8-second motion directive for Veo 3.1 interpolation (e.g. "Continuous 8-second cinematic drone orbit: camera smoothly circles 180 degrees around character from front to side-back angle while character naturally turns head, dynamic light sweep, seamless cinematic motion").
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
      "basicPlot": "Front-three-quarters view of protagonist sitting focused at glowing desk in dark room", 
      "endFramePlot": "180-degree reverse drone angle of the same protagonist, seen from behind and side looking across the room illuminated by rim light",
      "veoMotionPrompt": "Continuous 8-second cinematic drone orbit: camera smoothly circles 180 degrees around the character from front to side-back angle, dynamic lighting sweep across surfaces, seamless cinematic movement",
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

  return universalDroneMotions[cutIndex % 12];
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
 * （特定ジャンル語句のハードコードを一切排除し、時代・テーマ・プロダクションモードから媒体と作風を動的導出）
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

  // 1. 世界観・ジャンルに応じた媒体（Medium）とグラフィックスタイルの動的決定
  let mediumInstruction = '';
  let typographyStyle = '';
  let extraNegative = '';

  if (isHist) {
    // 【歴史・時代劇（江戸・幕末・戦国など）】
    mediumInstruction = `Authentic traditional Japanese broadsheet woodblock print (Kawaraban / Ukiyo-e woodblock poster style), rich aged washi paper texture, bold sumi-ink brush calligraphy accents, historical woodblock aesthetic with vintage ink saturation, authentic period crests and traditional geometric border lines`;
    typographyStyle = `Prominent bold sumi-ink Japanese calligraphy banner at the top displaying the exact title "${titleJp}" with traditional seal stamp embellishment`;
    extraNegative = `modern typography, digital fonts, English text overlay, modern glossy plastic, modern digital UI, neon cyberpunk, electronic synthesizers, headphones, sneakers, modern clothing, wristwatch, smartphone, plastic textures`;
  } else if (productionMode === 'manzai' || combinedContext.includes('漫才') || combinedContext.includes('お笑い') || combinedContext.includes('寄席') || combinedContext.includes('演芸')) {
    // 【漫才・演芸・コメディ】
    mediumInstruction = `High-energy theatrical entertainment flyer poster (Yose comedy hall poster style), vibrant comedic composition, dramatic stage lighting, warm festive paper lanterns, bold dynamic layout capturing theatrical charisma and expressive performance energy`;
    typographyStyle = `Dynamic Japanese theatrical headline typography boldly showing "${titleJp}" with high-impact comedy poster lettering`;
    extraNegative = `dark horror, grim, somber, overly melancholic, scientific graphs, abstract high-tech`;
  } else if (productionMode === 'trivia' || combinedContext.includes('雑学') || combinedContext.includes('トリビア') || combinedContext.includes('科学') || combinedContext.includes('解説') || combinedContext.includes('歴史解説')) {
    // 【雑学・トリビア・解説・科学】
    mediumInstruction = `Stunning commercial infographic editorial poster, high-CTR visual encyclopedia diagram layout, elegant schematic breakdown elements, clean structured visual hierarchy, captivating focal demonstration, informative magazine cover aesthetic`;
    typographyStyle = `Bold high-impact Japanese editorial headline typography featuring "${titleJp}", with clean structured subtext styling`;
    extraNegative = `messy collage, cluttered unintelligible scribbles, illegible tiny text, distorted diagrams`;
  } else if (productionMode === 'craft' || combinedContext.includes('職人') || combinedContext.includes('工芸') || combinedContext.includes('伝統技')) {
    // 【伝統工芸・職人技】
    mediumInstruction = `Artisan master anatomy infographic poster, warm organic textured craft paper, delicate technical cross-section sketches and authentic artisan handiwork schematics, exquisite workshop atmosphere, masterwork craftsmanship`;
    typographyStyle = `Refined artisan Japanese brushed typography displaying "${titleJp}"`;
    extraNegative = `neon, cyberpunk, modern plastic, synthetic futuristic graphics`;
  } else if (productionMode === 'quotes' || combinedContext.includes('名言') || combinedContext.includes('格言') || combinedContext.includes('哲学')) {
    // 【名言・哲学】
    mediumInstruction = `Profound minimalist philosophical graphic poster, commanding negative space, striking monumental focal imagery symbolizing deep contemplation, sophisticated artistic duotone or evocative lighting`;
    typographyStyle = `Monumental Japanese typographic composition prominently presenting the core phrase "${titleJp}"`;
    extraNegative = `cluttered graphics, juvenile cartoon elements, chaotic composition`;
  } else if (productionMode === 'mv' || combinedContext.includes('音楽') || combinedContext.includes('music') || combinedContext.includes('mv')) {
    // 【音楽・MV】
    mediumInstruction = `Iconic music concept art poster and editorial vinyl cover design, evocative atmospheric color grading, cinematic emotional visual narrative, stylish graphic design accents`;
    typographyStyle = `Stylized Japanese music single headline typography reading "${titleJp}"`;
    extraNegative = `boring layout, flat corporate diagram, low-effort snapshot`;
  } else {
    // 【汎用・現代ドラマ・通常モード】
    mediumInstruction = `Premium cinematic vertical teaser poster, high-CTR commercial infographic design, striking visual hierarchy, compelling editorial cover layout, professional cinematic color grading`;
    typographyStyle = `Striking high-contrast Japanese poster headline typography reading "${titleJp}"`;
    extraNegative = `cheap low-res flyer, amateur layout, chaotic clutter`;
  }

  // 2. 主役・フォーカルサブジェクトの動的設定（看板・文字との被りを防ぐため、タイトル枠の下に余裕を持った配置）
  let focalSubject = '';
  if (characterDna) {
    const costumeNote = isHist && authenticAttireEn ? `dressed in authentic ${authenticAttireEn}` : '';
    focalSubject = `Main focal subject: ${characterDna} ${costumeNote}, positioned in the comfortable center portion of the composition with ample clear margin beneath the top title banner, captured in a charismatic and expressive hero pose with zero collision between head and typography.`;
  } else if (theme) {
    focalSubject = `Key thematic visual: Symbolic central subject embodying the essence of "${theme}", positioned in the center with clear breathing room beneath the title banner.`;
  } else {
    focalSubject = `Central hero focal visual with striking presence, positioned comfortably in the mid-lower composition beneath the title.`;
  }

  // 3. サブキャッチコピー
  const subtitleClause = coverCatchphraseJp 
    ? `Integrated punchy subtitle text accent: "${coverCatchphraseJp}".` 
    : '';

  // 4. アートスタイル (taste)
  const resolvedTaste = taste ? resolveTastePrompt(taste) : (styleDna || '');
  const styleClause = resolvedTaste ? `Artistic rendering style: ${resolvedTaste}.` : '';

  // 5. プロンプト結合（上部25%のタイトル看板枠と、中央のキャラクターの完全な棲み分け・被り防止）
  const promptEn = [
    `Vertical 9:16 high-impact cover poster and commercial infographic key visual.`,
    mediumInstruction + `.`,
    `Layout Hierarchy: Top 25% is dedicated exclusively to the header banner and bold Japanese title typography. Generous visual breathing space between the bottom of the title banner and the subject below.`,
    focalSubject,
    typographyStyle + `.`,
    subtitleClause,
    styleClause,
    `Composition: Vertical 9:16 aspect ratio, perfectly balanced editorial hierarchy. The character is framed entirely below the top title banner with clear vertical separation, ensuring zero visual overlap or collision between the character's head/hair and the banner frame. Crystal clear focal point, professional graphic design, masterpiece, 8k resolution.`
  ].filter(Boolean).join(' ');

  // 6. ネガティブプロンプト（文字と頭部の重なり・被りを徹底排除）
  const baseNegative = `text overlapping character's head, banner colliding with hair, text covering face, cluttered overlap between subject and title, awkwardly placed text, blurry, low resolution, bad anatomy, duplicate character, multiple people when single subject intended, cropped subject, cluttered messy collage, distorted hands, extra limbs, ugly, JPEG artifacts`;
  const forbiddenAnachStr = forbiddenAnachronisms.length > 0 ? forbiddenAnachronisms.join(', ') : '';
  const negativePromptEn = [
    baseNegative,
    extraNegative,
    forbiddenAnachStr
  ].filter(Boolean).join(', ');

  return { promptEn, negativePromptEn };
}