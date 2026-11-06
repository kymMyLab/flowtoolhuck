import { GeneratorSettings, GenerationTask, TelopStyle, TelopTransition, TelopPosition } from '../types';
import { STRICT_STYLE_SUFFIX } from '../constants';
import { resolveTastePrompt } from './directorService';
import { 
  POSE_CONTRAST_RULES, 
  TWELVE_CUT_STORYBOARD_PRESETS, 
  UNIVERSAL_CINE_CYCLE,
  BASELINE_NEGATIVE_TOKENS
} from '../constants';

export interface PreviousShotContext {
  scale?: string;
  angle?: string;
  prompt?: string;
  tag?: string;
  telop?: {
    style?: TelopStyle;
    transition?: TelopTransition;
    position?: TelopPosition;
    directorNote?: string;
  };
}

export interface ActiveReferenceContext {
  mediaId?: string;
  characterDna?: string;
  styleDna?: string;
  antiPoseNegative?: string;
  eraNegative?: string;
  [key: string]: unknown;
}

/**
 * MVモードにおけるサビ（クライマックス）判定
 * v2.2.0-HybridScalable規格:
 * - 30カット時: Cut 17〜24 (比率 0.53〜0.80)
 * - 12カット時: Cut 5〜8 または Cut 8
 */
export function isMvChorusCut(cutId: number = 1, totalCuts: number = 30): boolean {
  if (totalCuts === 30) {
    return cutId >= 17 && cutId <= 24;
  }
  if (totalCuts <= 12) {
    return (cutId % 12) === 8 || cutId === 8 || (cutId >= 5 && cutId <= 8);
  }
  const ratio = (cutId - 1) / Math.max(1, totalCuts);
  return ratio >= 0.53 && ratio <= 0.80;
}

/**
 * 非サビ時のカメラ目線・正面向きを徹底排除するアンチトークン
 */
export const MV_ANTI_CAMERA_LOOK_NEGATIVE = 'looking at camera, eye contact, looking at viewer, staring into lens, frontal eye contact, breaking fourth wall, posed portrait, mugshot, mugshot gaze, smiling at camera';

/**
 * 普遍的物理・解剖学的破綻（人体融合・衣服連結・首連結）を永久追放する絶対ネガティブトークン
 */
export const UNIVERSAL_PHYSICAL_SANITY_NEGATIVE = 'fused clothing, connected accessories, conjoined bodies, merged fabric, stretched cloth bridge between people, physically impossible shared clothing, anatomical fusion, mutated limbs, single scarf around two heads, cloth linking necks';

/**
 * 顔面・瞳・口元の極限接写（フェイスアップ系マクロ）であるかを厳密に判定
 */
export function isFaceMacroScale(scale?: string, angle?: string): boolean {
  if (!scale && !angle) return false;
  const s = (scale || '').toLowerCase();
  const a = (angle || '').toLowerCase();
  
  // 静物・手元・足元・引き・横顔・俯瞰は除外
  if (s.includes('still-life') || s.includes('object') || s.includes('prop')) return false;
  if (s.includes('hands') || s.includes('footsteps') || s.includes('wide') || s.includes('overhead')) return false;
  if (s.includes('profile') && !s.includes('close-up')) return false;

  // 顔面ドアップ（瞳、顔全体）、口元・吐息
  if (s.includes('extreme close-up') || s.includes('mouth') || s.includes('macro portrait')) return true;
  if (a.includes('extreme macro close-up portrait') || a.includes('eyes dominating') || a.includes('tight face') || a.includes('parted lips') || a.includes('macro mouth') || a.includes('lips only')) return true;
  return false;
}

/**
 * 第2段セーフティ: 直前カットと同一の構図・アングル・シーンの反復を厳格に禁止するポジティブ指令
 */
export function buildPositiveAntiPreviousMandate(
  previous?: PreviousShotContext | PreviousShotContext[]
): string {
  if (!previous) return '';
  const contexts: PreviousShotContext[] = Array.isArray(previous) ? previous : [previous];
  if (contexts.length === 0) return '';

  const prev = contexts[0];
  const prevScale = prev.scale || '';
  const prevAngle = prev.tag || prev.angle || '';
  const framingDesc = [prevScale, prevAngle].filter(Boolean).join(' / ');

  return `[MANDATORY CINEMATIC CONTRAST - STRICTLY PROHIBIT IDENTICAL FRAMING]: Strictly forbidden from repeating previous scene framing, camera distance, or composition (${framingDesc || 'previous cut'}). You MUST create a stark visual contrast in camera perspective, composition, and subject focus. Do NOT render an identical crop or repeated angle.`;
}

/**
 * 直前カット（または直近の複数カット）の情報に基づいて、構図・ポーズ・アングル・小道具の重複を徹底排除するネガティブプロンプトを自動生成
 * （ロジック定義テーブル POSE_CONTRAST_RULES および SHOT_SCALE_REGISTRY を参照）
 */
export function buildDynamicAntiPreviousNegative(
  previous?: PreviousShotContext | PreviousShotContext[],
  currentCutScale?: string
): string {
  if (!previous) return '';

  const contexts: PreviousShotContext[] = Array.isArray(previous) ? previous : [previous];
  if (contexts.length === 0) return '';

  const antiTokens: string[] = [];
  const currentScaleLower = (currentCutScale || '').toLowerCase();
  const isCurrentEyeMacro = currentScaleLower.includes('extreme close-up') && !currentScaleLower.includes('mouth') && !currentScaleLower.includes('macro');
  const isCurrentMouth = currentScaleLower.includes('mouth');
  const isCurrentHands = currentScaleLower.includes('hands');
  const isCurrentFootsteps = currentScaleLower.includes('footsteps') || currentScaleLower.includes('feet');
  const isCurrentWide = currentScaleLower.includes('wide') || currentScaleLower.includes('panorama');
  const isCurrentHighAngle = currentScaleLower.includes('high-angle') || currentScaleLower.includes('overhead');
  const isCurrentDutch = currentScaleLower.includes('dutch');
  const isCurrentProfile = currentScaleLower.includes('profile');
  const isCurrentBust = currentScaleLower.includes('bust');
  const isCurrentProp = currentScaleLower.includes('prop') || currentScaleLower.includes('object') || currentScaleLower.includes('still-life');

  for (const ctx of contexts) {
    if (!ctx) continue;
    const prevScale = (ctx.scale || '').toLowerCase();
    const prevPrompt = (ctx.prompt || '').toLowerCase();
    const prevAngle = `${ctx.angle || ''} ${ctx.tag || ''}`.toLowerCase();

    // ── 1. 直前カットの主要被写体・構図の直接ネガティブ化（直前の画像を次のネガティブにする） ──
    
    // (A) 直前が「瞳・顔面ドアップ」の場合
    if (prevScale.includes('extreme close-up') || prevPrompt.includes('extreme close-up') || prevPrompt.includes('macro portrait') || prevPrompt.includes('sparkling eyes') || prevAngle.includes('瞳')) {
      if (!isCurrentEyeMacro) {
        antiTokens.push(
          'extreme close-up of eyes', 'macro eyes', 'sparkling eye close-up',
          'iris reflection macro', 'staring eye framing', 'cropped forehead',
          'identical eye close-up', 'macro face', 'huge eyes filling screen'
        );
      } else {
        // 同一顔面アップ連続時も完全複製や同一構図の繰り返しを強く排除
        antiTokens.push('identical eye close-up', 'repeated framing', 'duplicate crop', 'cloned eye reflection');
      }
    }

    // (B) 直前が「口元・吐息」の場合
    if (prevScale.includes('mouth') || prevPrompt.includes('parted lips') || prevPrompt.includes('macro mouth') || prevAngle.includes('口元')) {
      if (!isCurrentMouth) {
        antiTokens.push(
          'parted lips close-up', 'macro mouth', 'mouth and breath framing',
          'trembling lips', 'lower face macro', 'puff of breath'
        );
      } else {
        antiTokens.push('identical mouth close-up', 'repeated mouth framing', 'duplicate crop');
      }
    }

    // (C) 直前が「手元・指先・袖口」の場合
    if (prevScale.includes('hands') || prevPrompt.includes('macro hands') || prevPrompt.includes('fingers') || prevAngle.includes('手元') || prevAngle.includes('hands')) {
      if (!isCurrentHands) {
        antiTokens.push(
          'macro hands', 'hands close-up', 'fingers close-up', 'clenching knuckles',
          'touching hands', 'holding hands', 'clasped hands', 'interlocked fingers',
          'sleeve cuffs macro', 'tactile fingers', 'fists', 'hands in foreground',
          'wringing hands', 'hands fidgeting', 'gloves close-up'
        );
      }
    }

    // (D) 直前が「足元・靴・ローアングル」の場合
    if (prevScale.includes('footsteps') || prevScale.includes('feet') || prevPrompt.includes('sneakers') || prevPrompt.includes('footsteps') || prevAngle.includes('足元')) {
      if (!isCurrentFootsteps) {
        antiTokens.push(
          'low-angle footsteps', 'sneakers close-up', 'shoes on ground',
          'pavement worm-eye view', 'walking feet', 'stride across pavement'
        );
      }
    }

    // (E) 直前が「超広角・情景主役」の場合
    if (prevScale.includes('wide') || prevScale.includes('panorama') || prevPrompt.includes('panorama') || prevAngle.includes('超広角')) {
      if (!isCurrentWide) {
        antiTokens.push(
          'extreme wide panorama', 'distant miniature silhouette', 'sweeping landscape',
          'vast panoramic horizon', 'distant tiny figure', 'panoramic establishing shot'
        );
      }
    }

    // (F) 直前が「真上俯瞰・トップダウン」の場合
    if (prevScale.includes('overhead') || prevScale.includes('high-angle') || prevPrompt.includes('bird-eye') || prevPrompt.includes('overhead') || prevAngle.includes('俯瞰')) {
      if (!isCurrentHighAngle) {
        antiTokens.push(
          'overhead high-angle', 'bird-eye view', 'top-down perspective',
          'looking down from 75 degrees', 'steep high angle view', 'overhead looking down'
        );
      }
    }

    // (G) 直前が「斜め傾き・ダッチアングル」の場合
    if (prevScale.includes('dutch') || prevPrompt.includes('dutch') || prevPrompt.includes('diagonal') || prevAngle.includes('ダッチ') || prevAngle.includes('斜め')) {
      if (!isCurrentDutch) {
        antiTokens.push(
          'dutch angle tilt', 'diagonal horizon', 'slanted camera angle',
          '35-degree tilt', 'off-axis frame', 'slanted horizon repetition'
        );
      }
    }

    // (H) 直前が「完全真横・プロファイル」の場合
    if (prevScale.includes('profile') || prevPrompt.includes('side profile') || prevAngle.includes('横顔') || prevAngle.includes('プロファイル')) {
      if (!isCurrentProfile) {
        antiTokens.push(
          'exact side profile', '90-degree profile view', 'looking sideways',
          'profile silhouette', 'profile repetition'
        );
      }
    }

    // (I) 直前が「バストショット・日常シチュエーション」の場合
    if (prevScale.includes('bust') || prevPrompt.includes('chest-up') || prevAngle.includes('バスト')) {
      if (!isCurrentBust) {
        antiTokens.push(
          'bust shot portrait', 'chest-up framing', 'centered upper body portrait',
          'identical bust portrait repetition'
        );
      }
    }

    // (J) 直前が「象徴小道具・静物マクロ」の場合
    if (prevScale.includes('prop') || prevScale.includes('object') || prevPrompt.includes('still-life') || prevAngle.includes('静物')) {
      if (!isCurrentProp) {
        antiTokens.push(
          'still life object macro', 'key prop close-up', 'inanimate item',
          'deserted scene without human'
        );
      }
    }

    // ── 2. 直前カットのカメラアングル・動きの直接除外 ──
    if (prevAngle.includes('high') || prevAngle.includes('俯瞰') || prevAngle.includes('overhead')) {
      if (!isCurrentHighAngle) antiTokens.push('high angle looking down', 'overhead camera perspective');
    } else if (prevAngle.includes('low') || prevAngle.includes('煽り') || prevAngle.includes('upward')) {
      if (!currentScaleLower.includes('low')) antiTokens.push('low angle looking up', 'worm-eye perspective');
    } else if (prevAngle.includes('dutch') || prevAngle.includes('diagonal') || prevAngle.includes('斜め')) {
      if (!isCurrentDutch) antiTokens.push('dutch angle tilt', 'slanted camera axis');
    }

    // ── 3. 直前カットの固有シチュエーション・背景・小道具の排除 ──
    if (prevPrompt.includes('crosswalk') || prevPrompt.includes('crossing') || prevPrompt.includes('横断歩道')) {
      antiTokens.push('crosswalk', 'pedestrian crossing', 'white zebra road stripes');
    }
    if (prevPrompt.includes('bench') || prevPrompt.includes('ベンチ') || prevPrompt.includes('seated') || prevPrompt.includes('sitting')) {
      antiTokens.push('bench', 'sitting on bench', 'seated posture', 'sitting pose');
    }
    if (prevPrompt.includes('stairs') || prevPrompt.includes('riverbank') || prevPrompt.includes('階段') || prevPrompt.includes('河川敷')) {
      antiTokens.push('concrete stairs', 'riverbank steps', 'stairs embankment');
    }
    if (prevPrompt.includes('bicycle') || prevPrompt.includes('bike') || prevPrompt.includes('自転車')) {
      antiTokens.push('bicycle', 'riding bike');
    }
    if (prevPrompt.includes('umbrella') || prevPrompt.includes('傘')) {
      antiTokens.push('holding umbrella', 'umbrella', 'parasol');
    }
    if (prevPrompt.includes('phone') || prevPrompt.includes('smartphone') || prevPrompt.includes('スマホ')) {
      antiTokens.push('holding smartphone', 'operating phone');
    }
    if (prevPrompt.includes('can') || prevPrompt.includes('aluminum') || prevPrompt.includes('缶')) {
      antiTokens.push('aluminum can', 'holding can', 'beverage can');
    }
    if (prevPrompt.includes('classroom') || prevPrompt.includes('chalkboard') || prevPrompt.includes('blackboard') || prevPrompt.includes('教室') || prevPrompt.includes('机')) {
      antiTokens.push('classroom desks', 'blackboard', 'empty classroom');
    }

    // ── 4. ポーズの重複防止 ──
    for (const rule of POSE_CONTRAST_RULES) {
      if (rule.triggerKeywords.some(keyword => prevPrompt.includes(keyword))) {
        antiTokens.push(...rule.antiRepeatNegatives);
      }
    }
  }

  // 5. 一般的な重複防止ガード
  antiTokens.push(
    'identical composition to previous cut',
    'repeating previous scene composition',
    'same camera angle as previous cut',
    'monotonous repetitive pose'
  );

  const uniqueTokens = Array.from(new Set(antiTokens));
  return uniqueTokens.slice(0, 30).join(', ');
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
  // 音楽MVモード時は、YouTubeで天下を取る8大映画カメラサイクルを最優先で適用！
  if (isMvMode) {
    const cycleIdx = Math.max(0, cutId - 1) % UNIVERSAL_CINE_CYCLE.length;
    const rule = UNIVERSAL_CINE_CYCLE[cycleIdx];
    return {
      scale: rule.scale,
      angle: rule.directive,
      tag: rule.tag
    };
  }

  const index = Math.max(0, cutId - 1) % TWELVE_CUT_STORYBOARD_PRESETS.length;
  const def = TWELVE_CUT_STORYBOARD_PRESETS[index];
  
  let angle = def.cinematicAngle;
  if (isMangaMode) {
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
  activeReference?: ActiveReferenceContext
): { finalPrompt: string; finalNegative: string; referenceImageMediaIds?: string[] } {
  const { prompt, negativePrompt, styleKey, forbiddenAnachronisms, authenticAttireEn, forbiddenKeywordsEn } = task;
  const rawStyle = resolveTastePrompt(styleKey);
  const isMv = settings.isMvMode || task.isMvMode;

  // Layer 1: Master Style Anchor
  const isPhoto = isPhotoStyle(styleKey, rawStyle);
  const isNonPhoto = !isPhoto;
  const isPixel = (styleKey + ' ' + rawStyle).toLowerCase().includes('ドット') || 
                  (styleKey + ' ' + rawStyle).toLowerCase().includes('ピクセル') || 
                  (styleKey + ' ' + rawStyle).toLowerCase().includes('pixel') || 
                  (styleKey + ' ' + rawStyle).toLowerCase().includes('8-bit');

  const animeAnchor = (isNonPhoto && !rawStyle.toLowerCase().includes('anime') && !rawStyle.toLowerCase().includes('manga') && !rawStyle.toLowerCase().includes('illustration'))
    ? '2D anime illustration, anime aesthetic, '
    : '';

  const masterStylePrefix = 'Masterpiece';
  const masterStylePrompt = `[ART STYLE: ${animeAnchor}${rawStyle}]`;

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
    ? 'photorealistic, realistic photo, hyperrealistic photograph, real life, live-action, 35mm photograph, DSLR, camera photo, raw photograph, realistic human photo, western live-action film'
    : 'photorealistic, realistic photo, hyperrealistic photograph, real life, live-action, 35mm photograph, DSLR, camera photo, 3d render, cgi, raw photograph, realistic human photo, western live-action film';
  const illustrationNegative = isNonPhoto ? baseIllustrationNeg : '';


  const dynamicForbidden = forbiddenKeywordsEn || (forbiddenAnachronisms || []).join(', ');

  // 画風に必須のキーワード（例: neon, pop, pastel, チーク等）がAIの禁止ワードに誤混入した場合の衝突自動除外フィルター
  const styleKeywords = `${styleKey} ${rawStyle}`.toLowerCase();
  const isMoeBlush = styleKeywords.includes('ハッチングチーク') || styleKeywords.includes('チーク') || styleKeywords.includes('萌え');
  const isPastelSketch = styleKeywords.includes('くすみパステル') || styleKeywords.includes('チルスケッチ') || styleKeywords.includes('pastel') || styleKeywords.includes('sketch');
  const isFlatCel = styleKeywords.includes('フラットセル') || styleKeywords.includes('flat cel');
  
  const sanitizedForbidden = dynamicForbidden
    ? dynamicForbidden
        .split(',')
        .map(w => w.trim())
        .filter(w => {
          if (!w) return false;
          const lower = w.toLowerCase();
          const words = lower.split(/\s+/);
          
          // 特定の画風特有の必須キーワードと衝突するユーザー入力ネガティブを保護（無効化）する
          if (isMoeBlush && (lower.includes('blush') || lower.includes('チーク') || lower.includes('頬'))) return false;
          if (isPastelSketch && (lower.includes('pastel') || lower.includes('sketch') || lower.includes('くすみ'))) return false;
          if (isFlatCel && (lower.includes('flat') || lower.includes('cel') || lower.includes('セル'))) return false;

          // 一般的な画風定義に含まれる単語（neon, pop, pastel等）がネガティブに含まれていたら除去
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

  // ── 画風特化型ネガティブガード（ハッチングチーク、くすみパステル、フラットセルの品質保証） ──
  const styleSpecificNegatives: string[] = [];
  const lowerStyleFull = (styleKey + ' ' + rawStyle).toLowerCase();
  
  // 1. 萌え・ハッチングチーク特化（赤鼻・シール状チーク・ドット赤み・リアル目の完全排除）
  if (lowerStyleFull.includes('blush') || lowerStyleFull.includes('チーク') || lowerStyleFull.includes('萌え')) {
    styleSpecificNegatives.push('dotted blush, stippling, sticker blush, connected blush across nose, red nose, full face blush, detailed realistic eyes, small pupils');
  }

  // 2. くすみパステル・スケッチ特化（ギラつき・高彩度・重い影・テカリの完全排除）
  if (lowerStyleFull.includes('sketch') || lowerStyleFull.includes('pastel') || lowerStyleFull.includes('くすみ') || lowerStyleFull.includes('チルスケッチ')) {
    styleSpecificNegatives.push('high contrast, vibrant saturated colors, heavy shadows, complex shading, glossy');
  }

  // 3. フラットセル・劇場版特化（エアブラシグラデーション・CG立体感の完全排除）
  if (lowerStyleFull.includes('flat cel') || lowerStyleFull.includes('フラットセル')) {
    styleSpecificNegatives.push('detailed shading, heavy gradient, 3d render, complex shading');
  }

  const styleSpecificNegative = styleSpecificNegatives.join(', ');

  const negativeLayers: string[] = [
    BASELINE_NEGATIVE_TOKENS.anatomicalIntegrity,
    BASELINE_NEGATIVE_TOKENS.antiReferenceStiffness,
    antiMonochromeNegative,
    mvAntiDramaticNegative,
    sanitizedForbidden,
    illustrationNegative,
    styleSpecificNegative,
    BASELINE_NEGATIVE_TOKENS.antiFrameAndBorder,
    negativePrompt || '', // 直前構図ネガティブ（最重要）
    BASELINE_NEGATIVE_TOKENS.renderingQuality
  ];

  const panelDirective = '';

  // ── キャラクター一貫性（Character Consistency DNA）＆ 物体カット分離 ──
  const rawScale = (task.shotScale || '').toLowerCase();
  const rawAngle = (task.cinematicAngle || '').toLowerCase();
  const isObjectCut = !!task.isObjectOnly || rawScale.includes('object') || rawScale.includes('still-life') || rawAngle.includes('still-life') || rawScale.includes('prop');
  const effectiveDna = !isObjectCut ? (task.characterDna || activeReference?.characterDna) : '';

  let cleanActionPrompt = prompt || '';
  if (cleanActionPrompt.includes('[PROTAGONIST DNA]:')) {
    cleanActionPrompt = cleanActionPrompt.replace(/,?\s*\[PROTAGONIST DNA\]:[^,\]]*/gi, '').trim();
  }

  // ── 映画的画角＆アングル連動インテリジェント制御 ──
  const fullPromptContext = `${cleanActionPrompt} ${cameraContext} ${task.shotScale || ''} ${task.cinematicAngle || ''} ${task.camera || ''}`.toLowerCase();

  const isHandsShot = rawScale.includes('hands') || rawAngle.includes('macro hands') || rawAngle.includes('hands & gestures');
  const isFootstepsShot = rawScale.includes('footsteps') || rawAngle.includes('low-angle footsteps');
  const isMouthShot = rawScale.includes('mouth') || rawAngle.includes('macro mouth');
  const isProfileShot = rawScale.includes('profile') || rawAngle.includes('profile') || rawAngle.includes('side profile') || rawAngle.includes('90-degree');
  const isRearShot = rawScale.includes('rear') || rawAngle.includes('rear') || rawAngle.includes('back view') || rawAngle.includes('from behind');
  const isHighAngle = rawScale.includes('high-angle') || rawAngle.includes('high-angle') || rawScale.includes('overhead') || rawAngle.includes("bird's-eye");
  const isLowAngle = rawScale.includes('low-angle') || rawAngle.includes('low-angle') || rawAngle.includes('worm-eye');
  const isDutchAngle = rawScale.includes('dutch') || rawAngle.includes('dutch');
  const isBustShot = (rawScale.includes('bust') || rawAngle.includes('bust shot') || rawAngle.includes('chest-up')) && !isProfileShot;
  const isExtremeWideShot = rawScale.includes('extreme wide') || rawScale.includes('panorama') || rawAngle.includes('wide panorama') || rawAngle.includes('panoramic environmental tableau');

  const hasSpecificNonFaceSubject = /(cable|wire|handrail|shoes?|sneakers?|boots?|bag|can|mug|window frame|phone|bell|button|earbud|earpiece|earlobe|narrow gap|blazer)/i.test(fullPromptContext);
  const isCloseUpShot = !isObjectCut && !isProfileShot && !isBustShot && !isHandsShot && !isFootstepsShot && !isMouthShot && !isExtremeWideShot && !isRearShot && !hasSpecificNonFaceSubject && (
    rawScale.includes('close-up') || rawAngle.includes('macro portrait') || rawScale.includes('extreme close-up')
  );

  const cineShotSpecificNegatives: string[] = [];

  if (isHandsShot) {
    cineShotSpecificNegatives.push('face', 'eyes', 'head', 'portrait', 'full body', 'legs', 'feet', 'shoes', 'standing pose', 'wide shot', 'medium shot');
    cleanActionPrompt = `[STRICT MACRO HANDS: Tactile extreme close-up macro focusing sharply on hands, fingers, and subtle emotional gestures, background softly blurred, strictly hands only, NO face]. ${cleanActionPrompt}`;
  } else if (isFootstepsShot) {
    cineShotSpecificNegatives.push('face', 'eyes', 'head', 'torso', 'chest', 'portrait', 'upper body', 'standard eye level', 'high angle');
    cleanActionPrompt = `[STRICT LOW-ANGLE FOOTSTEPS: Extreme ground-level low-angle worm-eye camera tracking footsteps and footwear stepping across terrain, strictly ground and feet level, NO face]. ${cleanActionPrompt}`;
  } else if (isMouthShot) {
    cineShotSpecificNegatives.push('full body', 'torso', 'legs', 'feet', 'shoes', 'standing pose', 'wide shot', 'medium shot', 'distant face');
    cleanActionPrompt = `[STRICT MACRO MOUTH & BREATH: Intimate macro close-up focusing tightly on lips, mouth, chin, and throat, shallow depth of field, strictly lower face and lips only, NO full body]. ${cleanActionPrompt}`;
  } else if (isProfileShot) {
    cineShotSpecificNegatives.push('facing camera', 'front view', '3/4 front view', 'direct eye contact', 'looking at viewer', 'centered portrait', 'front-facing character', 'both eyes visible symmetrically');
    cleanActionPrompt = `[STRICT SIDE PROFILE: Exact 90-degree horizontal side profile view of subject placed along outer rule-of-thirds, directional rim lighting outlining hair and facial profile, strictly side angle, NO front view]. ${cleanActionPrompt.replace(/\b(facing camera|looking at camera|direct gaze|front view)\b/gi, '')}`;
  } else if (isBustShot) {
    cineShotSpecificNegatives.push('extreme close-up of eyes', 'macro eyes', 'cropped forehead', 'huge face filling screen', 'severed head', 'full body standing far', 'legs', 'feet');
    cleanActionPrompt = `[STRICT MEDIUM BUST SHOT: Candid cinematic chest-up framing capturing authentic posture, upper-body clothing, and natural atmospheric presence within the environment, head and shoulders visible]. ${cleanActionPrompt}`;
  } else if (isCloseUpShot) {
    cineShotSpecificNegatives.push('full body', 'torso', 'chest', 'shoulders', 'arms', 'hands', 'legs', 'feet', 'shoes', 'standing pose', 'seated pose', 'wide shot', 'medium shot', 'distant face');
    if (!cleanActionPrompt.includes('macro detail shot') && !cleanActionPrompt.includes('close-up shot focused on')) {
      cleanActionPrompt = `[STRICT MACRO PORTRAIT: Close-up portrait focusing on expressive face, hair, and eyes, shallow depth of field, NO full body, NO legs]. ${cleanActionPrompt}`;
    }
  } else if (isLowAngle) {
    cineShotSpecificNegatives.push('eye-level shot', 'horizontal camera angle', 'flat perspective', 'looking down', 'high angle', 'extreme close-up');
    cleanActionPrompt = `[STRICT DRAMATIC LOW-ANGLE: Ground-level camera looking upward, towering perspective showing character and environment]. ${cleanActionPrompt}`;
  } else if (isDutchAngle) {
    cineShotSpecificNegatives.push('horizontal level frame', 'straight horizontal camera', 'level horizon', 'vertical upright symmetry');
    cleanActionPrompt = `[STRICT DUTCH ANGLE: Tilted 35-degree off-axis Dutch-angle camera framing, dynamic diagonal perspective]. ${cleanActionPrompt}`;
  } else if (isExtremeWideShot) {
    cineShotSpecificNegatives.push('close-up', 'macro face', 'waist-up', 'chest-up');
    cleanActionPrompt = `[STRICT WIDE PANORAMA: Expansive environmental scene with protagonist visible in the world setting, breathtaking spatial depth]. ${cleanActionPrompt}`;
  } else if (isHighAngle) {
    cineShotSpecificNegatives.push('eye-level shot', 'looking up from below', 'worm-eye view', 'extreme close-up');
    cleanActionPrompt = `[STRICT OVERHEAD HIGH-ANGLE: High-angle view looking down from above, showing the protagonist within the environmental geometry]. ${cleanActionPrompt}`;
  } else if (isRearShot) {
    cineShotSpecificNegatives.push('facing camera', 'front view', 'looking back at camera', 'direct eye contact', 'full frontal face');
    cleanActionPrompt = `[STRICT REAR VIEW: Atmospheric rear three-quarter view seen from behind looking outward into the world, back turned to camera]. ${cleanActionPrompt}`;
  }

  if (cineShotSpecificNegatives.length > 0) {
    negativeLayers.push(...cineShotSpecificNegatives);
  }

  let characterPromptLayer = '';
  if (isObjectCut) {
    const focal = task.focalSubject || 'symbolic scene';
    characterPromptLayer = `[UNINHABITED STILL LIFE / SCENERY: ${focal}]: completely deserted scene, strictly NO humans, NO person, NO face, pure atmospheric cinematic environment. `;
    negativeLayers.push(
      'human, person, girl, boy, man, woman, child, face, eye, eyes, pupils, mouth, lips, cheeks, hands, fingers, legs, feet, body silhouette, crowd, portrait, standing character, sitting character, anime character'
    );
  } else {
    const hasExplicitMale = /\b(male|boy|man|guy|men|masculine|男子|男の子|少年|男性|青年|オッサン|おじさん)\b/i.test(`${effectiveDna || ''} ${cleanActionPrompt}`);
    const sanitizedDna = (effectiveDna || (hasExplicitMale ? 'handsome anime male protagonist' : 'charming anime female protagonist')).trim();
    if (!hasExplicitMale) {
      negativeLayers.push('male, boy, man, masculine, male character, young boy, guy, muscular, broad shoulders, facial hair, stubble');
    }
    characterPromptLayer = `[MANDATORY SINGLE PROTAGONIST: ${sanitizedDna}, strictly maintain identical appearance, hairstyle, hair color, accessories, and clothing across all scenes matching reference turnaround sheet]. `;
    negativeLayers.push('different character, different face, different hair, change of clothes, multiple people, extra person, duplicate characters, changing appearance');
  }

  const targetMediaIds: string[] = [];
  if (!isObjectCut) {
    if (task.referenceImageMediaId) {
      targetMediaIds.push(task.referenceImageMediaId);
    } else if (!task.isMvMode && activeReference?.mediaId) {
      targetMediaIds.push(activeReference.mediaId);
    }
  }

  const sanitizedNegativeLayers = negativeLayers.filter(Boolean);
  sanitizedNegativeLayers.push(UNIVERSAL_PHYSICAL_SANITY_NEGATIVE);

  let leadingDirective = '';
  let remainingAction = cleanActionPrompt;
  const strictMatch = cleanActionPrompt.match(/^(\[STRICT[^\]]+\]\.\s*)/);
  if (strictMatch) {
    leadingDirective = `${strictMatch[1]} `;
    remainingAction = cleanActionPrompt.slice(strictMatch[0].length);
  }

  let positiveContrastMandate = task.antiPreviousMandate || '';
  if (!positiveContrastMandate && task.previousContexts) {
    positiveContrastMandate = buildPositiveAntiPreviousMandate(task.previousContexts);
  }
  const contrastDirective = positiveContrastMandate ? `${positiveContrastMandate}. ` : '';
  const effectiveAttire = isObjectCut ? '' : dynamicAttire;
  const attirePromptPart = effectiveAttire ? ` ${effectiveAttire}.` : '';

  if (activeReference && !isObjectCut) {
    const { styleDna, antiPoseNegative, eraNegative } = activeReference;
    if (antiPoseNegative) sanitizedNegativeLayers.push(antiPoseNegative);
    if (eraNegative) sanitizedNegativeLayers.push(eraNegative);
    const finalNegative = sanitizedNegativeLayers.filter(Boolean).join(', ');
    const rawFinalPrompt = `${leadingDirective}${panelDirective}${characterPromptLayer}[ACTION: ${remainingAction}, ${cameraContext}].${attirePromptPart} ${masterStylePrompt}. [REFERENCE MEDIUM: ${styleDna || ''}]. ${modePromptSuffix}.${STRICT_STYLE_SUFFIX}${contrastDirective ? ` ${contrastDirective}` : ''}`;
    return {
      finalPrompt: sanitizePromptForGoogleSafety(rawFinalPrompt),
      finalNegative,
      referenceImageMediaIds: targetMediaIds.length > 0 ? targetMediaIds : undefined
    };
  }

  const finalNegative = sanitizedNegativeLayers.filter(Boolean).join(', ');
  const rawFinalPrompt = `${leadingDirective}${panelDirective}${characterPromptLayer}${cameraContext}. ${remainingAction}.${attirePromptPart} ${masterStylePrompt}. ${modePromptSuffix}.${STRICT_STYLE_SUFFIX}${contrastDirective ? ` ${contrastDirective}` : ''}`;

  return {
    finalPrompt: sanitizePromptForGoogleSafety(rawFinalPrompt),
    finalNegative,
    referenceImageMediaIds: targetMediaIds.length > 0 ? targetMediaIds : undefined
  };
}

/**
 * Google AI (Imagen 3 / Banana) のセーフティポリシーによる誤検知を回避するためのサニタイザー
 */
export function sanitizePromptForGoogleSafety(prompt: string): string {
  if (!prompt) return prompt;

  let cleaned = prompt
    .replace(/\b(undefined|null)\b/gi, '')
    .replace(/\b(seductive|seductively)\b/gi, 'charismatic')
    .replace(/\b(adult manga|erotic manga|hentai)\b/gi, 'graphic novel')
    .replace(/\b(intimate lighting|intimate scene|intimate atmosphere)\b/gi, 'moody atmospheric lighting')
    .replace(/\b(sensual|sensuality)\b/gi, 'poetic elegant')
    .replace(/\b(erotic|erotica)\b/gi, 'artistic')
    .replace(/\b(provocative)\b/gi, 'striking')
    .replace(/\b(distinctly not childlike|not childlike)\b/gi, '')
    .replace(/\b(childlike|child-like)\b/gi, 'stylized')
    .replace(/\b(naked|nude|nudity)\b/gi, 'artistic silhouette')
    .replace(/\b(skimpy|revealing)\b/gi, 'stylish')
    .replace(/\[\s*\]/g, '')
    .replace(/\(\s*\)/g, '')
    .replace(/,\s*,+/g, ',')
    .replace(/\.\s*\.+/g, '.')
    .replace(/,\s*\./g, '.')
    .replace(/\.\s*,/g, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
    .trim();

  if (cleaned.length > 2500) {
    cleaned = cleaned.slice(0, 2480).replace(/,[^,]*$/, '').trim() + ', masterpiece';
  }

  return cleaned;
}
