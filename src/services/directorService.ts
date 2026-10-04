import { Flow } from 'flow-sdk';
import { Cut, GenerationTask, GeneratorSettings, KenBurnsPreset, SeriesEpisodePlan } from '../types';
import { IMAGE_MODELS, DEFAULT_ASPECT_RATIO, STRICT_STYLE_SUFFIX, TASTES } from '../constants';
import { resolveTastePrompt } from './tasteStorage';
import { safeJsonParse, callWithRetry } from './utils';
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
- "split-2": 2 contrasting horizontal or vertical split panels (e.g. action in top/left panel -> reaction in bottom/right panel).
- "split-3": 3 dynamic sequential comic panels depicting rapid cause, action, and surprising outcome.
- "dynamic-multi": 2-4 varied asymmetrical or diagonal panels (for fast-paced montage, comic strips, or high-energy exchanges).

For EACH cut, assign "panelLayout" ("single" | "split-2" | "split-3" | "dynamic-multi") and incorporate the panel composition directly into "basicPlot".
MANDATORY: All panels must be full-bleed edge-to-edge artwork. Absolutely NO white outer border, NO blank margins!`
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
      "basicPlot": "Cinematic visual description of the cut in English matching the art style", 
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
  isMultiPanel?: boolean
): string {
  const worldSetting = era && era !== theme ? `${theme} (時代: ${era}, 地域: ${country})` : `${theme} (${country})`;
  const effMode = productionMode || (isMvMode ? 'mv' : 'episodes');
  const modeConfig = getProductionModeConfig(effMode, isMvMode);
  const contextTitle = modeConfig.getContextTitle(isMangaMode, checkIsHistorical(era, theme));

  return `You are a script director.
Create a compact 12-cut ${contextTitle} for Episode ${epId} ("${currentPlan.titleJp}").
Theme & Setting: "${worldSetting}". Art Style: "${taste || 'Cinematic'}".
${isMultiPanel ? 'Direct each cut panel layout freely ("single", "split-2", "split-3", "dynamic-multi") without white borders.' : 'Dynamically alternate camera distances (Wide -> Close-up -> Medium -> Climax).'}
Output ONLY valid JSON:
{
  "titleJp": "${currentPlan.titleJp}",
  "titleEn": "${currentPlan.titleEn}",
  "summary": "${isMvMode ? '楽曲の世界観（日本語）' : 'あらすじ（日本語）'}",
  "eraAnalysisJp": "時代背景の解説（日本語）",
  "authenticAttireEn": "Costume and attire matching ${worldSetting}",
  "forbiddenKeywordsEn": "modern elements, out of context",
  "forbiddenAnachronisms": ["不自然な要素"],
  "coverCatchphraseJp": "惹きつけるキャッチコピー",
  "highlightWords": ["キーワード"],
  "cuts": [
    { "id": 1, ${isMultiPanel ? '"panelLayout": "split-2", ' : ''}"basicPlot": "Visual description in English", "narrationJp": "${isMvMode ? '曲の歌詞20文字前後' : '日本語ナレーション20文字'}", "highlights": ["キーワード"] }
  ]
}`;
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
  const characterGuidance = activeReference 
    ? `Protagonist: ${activeReference.characterDna}. NOTE: Adopt only the character's appearance and distinctive features (face, hair, eyes); DO NOT copy reference pose.` 
    : 'No specific reference asset.';

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

  const directorPrompt = `You are a ${directorRole} designing a visual shot and motion-graphics telop staging for ${genreDesc}.
Context: "${prompt}".
Style: "${rawStyle}".
${characterGuidance}
${previousContrastMandate}

Avoid scale errors. If wide shot, character MUST be small and background realistic. If close-up, show head/shoulders with natural proportions.
COLOR & MEDIUM FIDELITY: Maintain the authentic color grading, vibrant lighting, and visual medium of "${rawStyle}". Do NOT describe scenes as monochrome, grayscale, pencil sketch, or manga screentones unless the chosen style is explicitly monochrome.
${mangaExtraDirecting}
${mvExtraDirecting}

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

  try {
    const res = await Flow.generate.text(directorPrompt);
    const resText = typeof res === 'string' ? res : (res?.text || res);
    const parsed = safeJsonParse<any>(resText, {});
    if (parsed && parsed.enhancedPrompt) {
      const cwDef = parsed.cameraWork ? resolveCameraWork(parsed.cameraWork) : recCw;
      return {
        promptEn: parsed.enhancedPrompt,
        negativePrompt: antiPreviousNegative,
        cameraWork: cwDef.id,
        cameraMotion: cwDef.motionPrompt,
        cinematicAngle: parsed.cinematicAngle || preset.angle,
        shotScale: parsed.shotScale || preset.scale,
        kenBurnsPreset: cwDef.recommendedKenBurns || kbPreset,
        telop: {
          fullText: '',
          style: parsed.telopStyle || defaultTelop.style,
          transition: parsed.telopTransition || defaultTelop.transition,
          position: defaultTelop.position,
          directorNote: parsed.directorTelopNote || defaultTelop.directorNote
        }
      };
    }
  } catch (err) {
    if (addLog) addLog(`演出AIの生成をスキップしプリセットを適用します: ${err}`, 'warning');
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