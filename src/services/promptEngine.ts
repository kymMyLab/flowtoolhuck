import { GeneratorSettings, GenerationTask } from '../types';
import { TASTES, STRICT_STYLE_SUFFIX } from '../constants';
import { 
  SHOT_SCALE_REGISTRY, 
  POSE_CONTRAST_RULES, 
  TWELVE_CUT_STORYBOARD_PRESETS, 
  BASELINE_NEGATIVE_TOKENS,
  StoryShotPreset 
} from '../config/studioDefinitions';

export interface PreviousShotContext {
  scale?: string;
  angle?: string;
  prompt?: string;
  tag?: string;
  telop?: {
    style?: any;
    transition?: any;
    position?: any;
  };
}

/**
 * MVモードにおけるサビ（クライマックス）判定（12カット中、Cut 8 のみ）
 */
export function isMvChorusCut(cutId: number = 1): boolean {
  return (cutId % 12) === 8 || cutId === 8;
}

/**
 * 非サビ時のカメラ目線・正面向きを徹底排除するアンチトークン
 */
export const MV_ANTI_CAMERA_LOOK_NEGATIVE = 'looking at camera, eye contact, looking at viewer, staring into lens, frontal eye contact, breaking fourth wall, posed portrait, mugshot, mugshot gaze, smiling at camera';

/**
 * 直前カットの情報に基づいて、構図・ポーズ・アングルの重複を排除するネガティブプロンプトを自動生成
 * （ロジック定義テーブル POSE_CONTRAST_RULES および SHOT_SCALE_REGISTRY を参照）
 */
export function buildDynamicAntiPreviousNegative(previous?: PreviousShotContext): string {
  if (!previous) return '';

  const antiTokens: string[] = [];

  // 1. 直前のスケールに基づく除外トークン
  if (previous.scale && SHOT_SCALE_REGISTRY[previous.scale]) {
    antiTokens.push(...SHOT_SCALE_REGISTRY[previous.scale].antiRepeatNegatives);
    antiTokens.push(`identical ${previous.scale} framing`, `same shot scale as previous scene`);
  } else if (previous.scale) {
    if (previous.scale.toLowerCase().includes('close')) {
      antiTokens.push('extreme close-up', 'macro face', 'zoomed in headshot');
    } else if (previous.scale.toLowerCase().includes('wide')) {
      antiTokens.push('distant tiny figure', 'extreme wide shot', 'panoramic view');
    } else if (previous.scale.toLowerCase().includes('medium')) {
      antiTokens.push('standard medium shot', 'static bust portrait');
    }
  }

  // 2. 直前のカメラアングルに基づく除外トークン
  if (previous.angle) {
    const lowerAngle = previous.angle.toLowerCase();
    if (lowerAngle.includes('high-angle') || lowerAngle.includes('downward') || lowerAngle.includes('俯瞰')) {
      antiTokens.push('high angle looking down', 'overhead camera perspective');
    } else if (lowerAngle.includes('low-angle') || lowerAngle.includes('worm') || lowerAngle.includes('煽り')) {
      antiTokens.push('low angle looking up', 'worm-eye perspective');
    }
  }

  // 3. 直前のポーズ・姿勢（床座り、立ち等）に基づく動的除外（POSE_CONTRAST_RULES を検索）
  if (previous.prompt) {
    const lowerPrompt = previous.prompt.toLowerCase();
    for (const rule of POSE_CONTRAST_RULES) {
      if (rule.triggerKeywords.some(keyword => lowerPrompt.includes(keyword))) {
        antiTokens.push(...rule.antiRepeatNegatives);
      }
    }
  }

  // 4. 一般的な重複防止ガード
  antiTokens.push(
    'identical composition to previous cut',
    'repeating previous scene composition',
    'same camera angle as previous cut',
    'monotonous repetitive pose'
  );

  return Array.from(new Set(antiTokens)).join(', ');
}

/**
 * 各カット番号に対応するストーリーボード演出プリセットを取得
 * （シネマ / 音楽MV / 漫画モードを自動切り替え）
 */
export function getStoryboardPreset(
  cutId: number, 
  isMvMode?: boolean, 
  isMangaMode?: boolean
): { scale: string; angle: string; tag: string } {
  const index = Math.max(0, cutId - 1) % TWELVE_CUT_STORYBOARD_PRESETS.length;
  const def = TWELVE_CUT_STORYBOARD_PRESETS[index];
  
  let angle = def.cinematicAngle;
  if (isMvMode) {
    angle = def.mvAngle;
  } else if (isMangaMode) {
    angle = def.mangaAngle;
  }

  return {
    scale: def.scale,
    angle: angle,
    tag: def.tag
  };
}

/**
 * 6層レイヤーに基づき、プロンプトとネガティブプロンプトを完全合成
/**
 * 画風が写真（実写・フォト）かアート・イラストかを判定
 */
export function isPhotoStyle(styleKey: string = '', rawStyle: string = ''): boolean {
  const combined = `${styleKey} ${rawStyle}`.toLowerCase();
  
  // アート・イラスト・描画系キーワード（これらがあれば絶対に非写真）
  const artKeywords = [
    'アニメ', 'イラスト', 'マンガ', '漫画', 'セル画', 'ドット', 'ピクセル', '水彩', '油絵', '油彩', '版画', '浮世絵', '劇画', 'レトロモダン', '線画',
    'anime', 'manga', 'illustration', 'cel', 'pixel', '8-bit', '16-bit', 'watercolor', 'oil painting', 'ukiyo-e', 'woodblock', 'art nouveau', 'chibi', 'ligne claire', 'drawing', 'sketch', 'vector', 'lo-fi anime'
  ];
  if (artKeywords.some(k => combined.includes(k))) return false;

  // 写真キーワードがある場合のみ写真判定
  const photoKeywords = ['写真', '実写', 'フォト', 'photo', 'photograph', 'dslr', '35mm', 'realistic portrait', 'cinematic live-action'];
  return photoKeywords.some(k => combined.includes(k));
}

/**
 * 6層レイヤーに基づき、プロンプトとネガティブプロンプトを完全合成
 * （画風に応じた動的判定を行い、イラスト・ドット絵・アニメへの不要な写真ワード注入を完全排除）
 */
export function buildFinalCinematicPromptAndNegative(
  task: GenerationTask,
  settings: GeneratorSettings,
  activeReference?: any
): { finalPrompt: string; finalNegative: string; referenceImageMediaIds?: string[] } {
  const { prompt, negativePrompt, styleKey, forbiddenAnachronisms, authenticAttireEn, forbiddenKeywordsEn } = task;
  const rawStyle = TASTES[styleKey] || '';
  const isMv = settings.isMvMode || task.isMvMode;

  // Layer 1: Master Style Anchor
  const masterStylePrefix = `Masterpiece, authentic ${rawStyle}. Consistent visual art style in ${rawStyle}.`;
  const masterStylePrompt = `[MASTER ART STYLE: ${rawStyle}, strictly maintain identical visual medium and rendering consistency across scenes]`;

  const isPhoto = isPhotoStyle(styleKey, rawStyle);
  const isNonPhoto = !isPhoto;
  const isPixel = (styleKey + ' ' + rawStyle).toLowerCase().includes('ドット') || 
                  (styleKey + ' ' + rawStyle).toLowerCase().includes('ピクセル') || 
                  (styleKey + ' ' + rawStyle).toLowerCase().includes('pixel') || 
                  (styleKey + ' ' + rawStyle).toLowerCase().includes('8-bit');

  // Layer 2 & 3: Camera Context & Action
  const isAllowedEyeContact = isMv && isMvChorusCut(task.cutId || 1);
  let cameraContext = '';
  if (isMv) {
    const mvGazePrompt = isAllowedEyeContact
      ? 'dramatic emotional climax, direct captivating eye contact with camera, powerful cinematic presence'
      : 'unposed candid non-look angle, character looking away into distance or downcast in quiet contemplation, no camera look, no eye contact';

    if (isPixel) {
      cameraContext = `Atmospheric indie music video visual still, clean retro pixel art aesthetic, charming indie game backdrop, serene breathing space, beautiful composition, ${mvGazePrompt}`;
    } else if (isNonPhoto) {
      cameraContext = `Candid atmospheric indie music video visual still, serene breathing space, aesthetic cinematic color grading, beautiful artistic composition, ${mvGazePrompt}`;
    } else {
      cameraContext = `Candid atmospheric indie music video still, natural human anatomy, unposed natural posture, soft rim lighting, serene breathing space, cinematic 35mm photography aesthetic, ${mvGazePrompt}`;
    }
  } else {
    if (isPixel) {
      cameraContext = 'Iconic pixel art composition, clear silhouette, expressive retro gaming perspective, charming retro game visual';
    } else if (isNonPhoto) {
      cameraContext = 'Cinematic composition, dynamic natural pose, natural anatomy, solid torso, complete body framing, grounded perspective';
    } else {
      cameraContext = 'Cinematic composition, dynamic natural pose, natural human anatomy, solid torso, complete body framing, grounded perspective, 8k resolution, cinematic lighting';
    }
  }
  
  // Layer 4: Wardrobe & Attire (時代劇なら HISTORICAL PERIOD ATTIRE、現代劇やMVなら WARDROBE & ATTIRE)
  const isHistorical = !isMv && ((task.eraAnalysis && (task.eraAnalysis.includes('江戸') || task.eraAnalysis.includes('幕末') || task.eraAnalysis.includes('明治') || task.eraAnalysis.includes('大正') || task.eraAnalysis.includes('戦後') || task.eraAnalysis.includes('昭和') || task.eraAnalysis.includes('武士') || task.eraAnalysis.includes('侍'))) || (settings.era && (settings.era.includes('江戸') || settings.era.includes('幕末') || settings.era.includes('明治') || settings.era.includes('大正') || settings.era.includes('戦後') || settings.era.includes('昭和'))));
  const dynamicAttire = authenticAttireEn 
    ? (isHistorical ? `[HISTORICAL PERIOD ATTIRE: ${authenticAttireEn}]` : `[WARDROBE & ATTIRE: ${authenticAttireEn}]`)
    : '';

  // Layer 5: Mode Suffix (MVアンニュイ情景 または 漫画演出)
  let modePromptSuffix = '';
  if (isMv) {
    modePromptSuffix = 'poetic indie music video visual, contemplative atmosphere, gentle ambient wind, quiet emotion, cinematic color grading, beautiful subtle mood, no dramatic conflict';
  } else if (settings.isMangaMode) {
    modePromptSuffix = 'manga style, full-bleed edge-to-edge artwork, borderless composition, filling entire canvas without margins, dynamic pen and ink, screentone, cel shading, intense dramatic expressions, extreme high contrast, bold line art, speed lines';
  }

  // Layer 6: Negative Rules (厳密な優先度で結合)
  const allows3d = (styleKey + ' ' + rawStyle).toLowerCase().includes('3d') || (styleKey + ' ' + rawStyle).toLowerCase().includes('cg');
  const baseIllustrationNeg = allows3d
    ? 'photorealistic, realistic photo, hyperrealistic photograph, real life, live-action, 35mm photograph, DSLR, camera photo'
    : 'photorealistic, realistic photo, hyperrealistic photograph, real life, live-action, 35mm photograph, DSLR, camera photo, 3d render, cgi';
  const illustrationNegative = isNonPhoto ? baseIllustrationNeg : '';

  const dynamicForbidden = forbiddenKeywordsEn || (forbiddenAnachronisms || []).join(', ');

  // 画風に必須のキーワード（例: neon, pop, pastel等）がAIの禁止ワードに誤混入した場合の衝突自動除外フィルター
  const styleKeywords = `${styleKey} ${rawStyle}`.toLowerCase();
  const sanitizedForbidden = dynamicForbidden
    ? dynamicForbidden
        .split(',')
        .map(w => w.trim())
        .filter(w => {
          if (!w) return false;
          const lower = w.toLowerCase();
          const words = lower.split(/\s+/);
          // 画風の定義に含まれる単語（neon, pop, pastel等）がネガティブに含まれていたら除去
          return !words.some(word => word.length > 2 && styleKeywords.includes(word));
        })
        .join(', ')
    : '';

  // 白黒スタイル（「🖋️ 白黒劇画」等）が明示的に選ばれている場合以外は、白黒・モノクロ・スクリーントーン化をネガティブで徹底排除
  const isExplicitMonochrome = (styleKey + ' ' + rawStyle).toLowerCase().includes('monochrome') || 
                               (styleKey + ' ' + rawStyle).toLowerCase().includes('白黒') || 
                               (styleKey + ' ' + rawStyle).toLowerCase().includes('black and white');
  const antiMonochromeNegative = !isExplicitMonochrome && !settings.isMangaMode
    ? 'monochrome, grayscale, black and white, desaturated, colorless, screentone, manga panels'
    : '';

  // MVモード専用アンチネガティブ（叫び、劇的な怒り、過剰アクション、および非サビ時のカメラ目線の徹底排除）
  const mvAntiCameraLook = (isMv && !isAllowedEyeContact) ? `, ${MV_ANTI_CAMERA_LOOK_NEGATIVE}` : '';

  const mvAntiDramaticNegative = isMv 
    ? `violent action, aggressive shouting, screaming mouth wide open, intense crying, dynamic combat, weapons, explosion, exaggerated action pose, heroic flexing${mvAntiCameraLook}`
    : '';

  const negativeLayers: string[] = [
    BASELINE_NEGATIVE_TOKENS.anatomicalIntegrity,
    BASELINE_NEGATIVE_TOKENS.antiReferenceStiffness,
    antiMonochromeNegative,
    mvAntiDramaticNegative,
    sanitizedForbidden,
    illustrationNegative,
    BASELINE_NEGATIVE_TOKENS.antiFrameAndBorder,
    negativePrompt || '', // 直前構図ネガティブ（最重要）
    BASELINE_NEGATIVE_TOKENS.renderingQuality
  ];

  if (activeReference) {
    const { styleDna, antiPoseNegative, eraNegative, mediaId } = activeReference;
    if (antiPoseNegative) negativeLayers.push(antiPoseNegative);
    if (eraNegative) negativeLayers.push(eraNegative);

    const finalNegative = negativeLayers.filter(Boolean).join(', ');
    const finalPrompt = `${masterStylePrefix}. ${masterStylePrompt}. [ACTION: ${prompt}, ${cameraContext}]. ${dynamicAttire}. [REFERENCE MEDIUM: ${styleDna || ''}]. ${modePromptSuffix}.${STRICT_STYLE_SUFFIX}`;

    return {
      finalPrompt,
      finalNegative,
      referenceImageMediaIds: mediaId ? [mediaId] : undefined
    };
  } else {
    const finalNegative = negativeLayers.filter(Boolean).join(', ');
    const finalPrompt = `${masterStylePrefix}. ${masterStylePrompt}. ${cameraContext}. ${prompt}. ${dynamicAttire}. ${modePromptSuffix}.${STRICT_STYLE_SUFFIX}`;

    return {
      finalPrompt,
      finalNegative
    };
  }
}
