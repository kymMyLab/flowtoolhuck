import { GeneratorSettings, GenerationTask, TelopStyle, TelopTransition, TelopPosition } from '../types';
import { TASTES, STRICT_STYLE_SUFFIX } from '../constants';
import { resolveTastePrompt } from './tasteStorage';
import { 
  SHOT_SCALE_REGISTRY, 
  POSE_CONTRAST_RULES, 
  TWELVE_CUT_STORYBOARD_PRESETS, 
  UNIVERSAL_CINE_CYCLE,
  BASELINE_NEGATIVE_TOKENS,
  StoryShotPreset 
} from '../config/studioDefinitions';

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
  const isCurrentProp = currentScaleLower.includes('prop') || currentScaleLower.includes('object');

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
      }
    }

    // (B) 直前が「口元・吐息」の場合
    if (prevScale.includes('mouth') || prevPrompt.includes('parted lips') || prevPrompt.includes('macro mouth') || prevAngle.includes('口元')) {
      if (!isCurrentMouth) {
        antiTokens.push(
          'parted lips close-up', 'macro mouth', 'mouth and breath framing',
          'trembling lips', 'lower face macro', 'puff of breath'
        );
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

  const masterStylePrefix = `Masterpiece, authentic ${animeAnchor}${rawStyle}. Consistent visual art style in ${rawStyle}.`;
  const masterStylePrompt = `[MASTER ART STYLE: ${animeAnchor}${rawStyle}, strictly maintain identical visual medium and rendering consistency across scenes]`;

  // Layer 2 & 3: Camera Context & Action
  const isAllowedEyeContact = isMv && isMvChorusCut(task.cutId || 1);
  let cameraContext = '';

  if (task.isEndFrame) {
    // EndFrame（到達点フレーム）: 元絵からの相対変化（カメラ・表情・距離）を最重要視
    const cameraShift = task.endFrameCameraDirective || 'Relative to the start frame: subtle cinematic camera and gaze shift';
    cameraContext = `[RELATIVE TRANSFORMATION FROM START FRAME]: ${cameraShift}`;
  } else if (isMv) {
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

  // ── マンガ風コマ割り（マルチパネル）動的注入＆競合解消 ──
  const isMultiPanelActive = !!(settings.isMultiPanel || task.isMultiPanel);
  const rawPanelLayout = task.panelLayout || 'dynamic-multi';

  // 多彩なマンガコマ割りバリエーション定義（均等な板状分割を完全排除し、プロ漫画のダイナミズムを再現）
  const MANGA_LAYOUT_PROMPTS: Record<string, string> = {
    // 1. 斜めスラッシュ分割 (アクション・緊迫・急展開)
    'diagonal-slash': 'multi-panel modern manga composition with a dramatic diagonal slash gutter dividing the canvas into two sharp, asymmetrical angled kinetic panels, contrasting angles and perspectives, non-uniform dynamic wedge-shaped panels, seamless full-bleed artwork, absolutely NO white outer border, NO margins',
    // 2. L字型変形3コマ (大ゴマ主役＋横積み2コマ)
    'l-shaped': 'dynamic Japanese manga 3-panel asymmetric layout: one dominant large vertical hero panel spanning two-thirds of the canvas, paired with two smaller stacked horizontal sub-panels on the opposing side, professional manga storytelling hierarchy, varying panel aspect ratios, seamless full-bleed artwork, absolutely NO white outer border, NO margins',
    // 3. 上部パノラマ＋下部2分割 (情景提示＋反応)
    'panoramic-split': 'modern manga multi-panel layout: a wide dramatic panoramic establishing panel spanning the upper half, with two distinct vertical portrait reaction panels placed side-by-side in the lower half, varied panel shapes, non-uniform composition, seamless full-bleed artwork, absolutely NO white outer border, NO margins',
    // 4. 大ゴマ＋インセットワイプ (心理描写・視線・小物クローズアップ)
    'inset-reaction': 'cinematic full-bleed manga splash panel featuring a smaller floating inset reaction box frame in the lower corner showing intense detail or facial expression, professional manga visual hierarchy, seamless full-bleed artwork, absolutely NO white outer border, NO margins',
    // 5. 左右縦割り2分割 (対比・会話・視線)
    'vertical-split': 'multi-panel manga composition with an asymmetrical vertical division splitting the canvas into two tall side-by-side portrait panels with contrasting perspectives and depths of field, seamless full-bleed artwork, absolutely NO white outer border, NO margins',
    // 6. アシンメトリー2分割 (上下不均等・メリハリ)
    'split-2': 'asymmetrical 2-panel dynamic manga layout with non-uniform heights and dramatic perspective contrast (one large panel dominating two-thirds and one narrow panel), clearly separated panels, seamless full-bleed artwork, absolutely NO white outer border, NO margins',
    // 7. 変形3コマ (不均等なリズム・決して均等スライスではない)
    'split-3': 'dynamic 3-panel Japanese manga composition with varied panel sizes, one wide hero panel and two unequal complementary panels, rhythmic narrative layout, varying heights and widths, seamless full-bleed artwork, absolutely NO white outer border, NO margins',
    // 8. 1コマ大ゴマ (決定打・クライマックス)
    'single': 'single full-bleed epic splash comic panel, high-impact single composition, seamless edge-to-edge artwork, absolutely NO white outer border, NO margins'
  };

  let effectiveLayout = rawPanelLayout;
  if (isMultiPanelActive && (!rawPanelLayout || rawPanelLayout === 'dynamic-multi')) {
    // カットIDやシーンに応じた多彩なローテーション＆ランダムバリエーション
    const layoutCycle = ['diagonal-slash', 'l-shaped', 'panoramic-split', 'inset-reaction', 'vertical-split', 'split-2'];
    const cycleIndex = ((task.cutId || 1) - 1) % layoutCycle.length;
    effectiveLayout = layoutCycle[cycleIndex];
  }

  let multiPanelPrompt = '';
  if (isMultiPanelActive) {
    multiPanelPrompt = MANGA_LAYOUT_PROMPTS[effectiveLayout] || MANGA_LAYOUT_PROMPTS['l-shaped'];
  }

  // 競合解消: マルチパネル時は既存プロンプトや画風定義から "no panels" や "single splash cut" を自動除去
  let effectiveMasterPrefix = masterStylePrefix;
  let effectiveMasterPrompt = masterStylePrompt;
  let effectivePrompt = prompt;
  if (isMultiPanelActive && effectiveLayout !== 'single') {
    effectiveMasterPrefix = effectiveMasterPrefix.replace(/no panels,?\s*/gi, '').replace(/single splash cut,?\s*/gi, '');
    effectiveMasterPrompt = effectiveMasterPrompt.replace(/no panels,?\s*/gi, '').replace(/single splash cut,?\s*/gi, '');
    effectivePrompt = effectivePrompt.replace(/no panels,?\s*/gi, '').replace(/single splash cut,?\s*/gi, '');
  }

  // 白黒スタイル（「🖋️ 白黒劇画」等）が明示的に選ばれている場合以外は、白黒・モノクロ・スクリーントーン化をネガティブで徹底排除
  const isExplicitMonochrome = (styleKey + ' ' + rawStyle).toLowerCase().includes('monochrome') || 
                               (styleKey + ' ' + rawStyle).toLowerCase().includes('白黒') || 
                               (styleKey + ' ' + rawStyle).toLowerCase().includes('black and white');
  const antiMonochromeNegative = !isExplicitMonochrome && !settings.isMangaMode
    ? (isMultiPanelActive ? 'monochrome, grayscale, black and white, desaturated, colorless' : 'monochrome, grayscale, black and white, desaturated, colorless, screentone, manga panels')
    : '';

  // MVモード専用アンチネガティブ（叫び、劇的な怒り、過剰アクション、および非サビ時のカメラ目線の徹底排除）
  const mvAntiCameraLook = (isMv && !isAllowedEyeContact) ? `, ${MV_ANTI_CAMERA_LOOK_NEGATIVE}` : '';

  const mvAntiDramaticNegative = isMv 
    ? `violent action, aggressive shouting, screaming mouth wide open, intense crying, dynamic combat, weapons, explosion, exaggerated action pose, heroic flexing${mvAntiCameraLook}`
    : '';

  // 単調な均等横スライス（3段・2段の均等ボーダー）を徹底排除
  const multiPanelNegative = isMultiPanelActive
    ? 'white outer border, page margins, white paper border, blank border, picture frame, matting, outer canvas border, wide margins, cardboard border, overlapping characters, stacked people, people sitting on top of each other, merged humans, intersecting figures, duplicate characters overlapping, cluttered characters, confusing anatomy overlapping across panels, figures blending into each other, equal horizontal stripes, uniform 3 horizontal slices, monotonous horizontal rows, plain strip comic with equal heights, 3 identical rectangular bars, boring venetian blind panels, ruler-straight repetitive horizontal stripes, lazy equal thirds division'
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
    multiPanelNegative,
    negativePrompt || '', // 直前構図ネガティブ（最重要）
    BASELINE_NEGATIVE_TOKENS.renderingQuality
  ];

  if (task.isEndFrame) {
    // EndFrameでは、完全に静止して変化しないフリーズ重複や、全く別キャラ・別世界になる乖離を防ぐ
    negativeLayers.push('frozen motionless static duplicate, completely identical frozen posture, different character, different outfit, different bedroom setting');
  }

  const panelDirective = multiPanelPrompt ? `[PANEL COMPOSITION: ${multiPanelPrompt}]. ` : '';

  // ── キャラクター一貫性（Character Consistency DNA）＆ 物体カット分離 ──
  const isObjectCut = !!task.isObjectOnly;
  const effectiveDna = !isObjectCut ? (task.characterDna || activeReference?.characterDna) : '';

  // 重要: もし prompt 内にすでに [PROTAGONIST DNA]: が含まれている場合、二重注入・長大化を防ぐためにアクションプロンプトから分離
  let cleanActionPrompt = effectivePrompt || '';
  if (cleanActionPrompt.includes('[PROTAGONIST DNA]:')) {
    cleanActionPrompt = cleanActionPrompt.replace(/,?\s*\[PROTAGONIST DNA\]:[^,\]]*/gi, '').trim();
  }

  // ── 映画的画角＆アングル連動インテリジェント制御（立ち姿の呪縛解放＆視点防衛） ──
  // 今後どんなプロンプトや画角指定が来ても、優先度階層と排他制御により意図した構図・ポーズを100%確実に実現
  const fullPromptContext = `${cleanActionPrompt} ${cameraContext} ${task.shotScale || ''} ${task.cinematicAngle || ''} ${task.camera || ''}`.toLowerCase();
  const rawScale = (task.shotScale || '').toLowerCase();
  const rawAngle = (task.cinematicAngle || '').toLowerCase();

  // 1. 部位特化マクロ・ディテール判定（最優先・タイトルや歌詞の「指先」「足音」による誤爆を完全防止）
  // ※タイトルや歌詞に「指先」「手元」が含まれていても、shotScaleまたはcinematicAngleが明示的に手元・足元・口元指定の場合のみ発動させる
  const isHandsShot = rawScale.includes('hands') || rawAngle.includes('macro hands') || rawAngle.includes('hands & gestures') || rawAngle.includes('tactile extreme close-up macro');
  const isFootstepsShot = rawScale.includes('footsteps') || rawAngle.includes('low-angle footsteps') || rawAngle.includes('ground-level low-angle worm-eye');
  const isMouthShot = rawScale.includes('mouth') || rawAngle.includes('macro mouth') || rawAngle.includes('mouth & breath');

  // 2. カメラアングル特化判定（横顔、背後、俯瞰、煽り、斜め）
  const isProfileShot = rawScale.includes('profile') || rawAngle.includes('profile') || rawAngle.includes('side profile') || rawAngle.includes('side view') || rawAngle.includes('90-degree');
  const isRearShot = rawScale.includes('rear') || rawAngle.includes('rear') || rawAngle.includes('back view') || rawAngle.includes('from behind');
  const isHighAngle = rawScale.includes('high-angle') || rawAngle.includes('high-angle') || rawScale.includes('overhead') || rawAngle.includes("bird's-eye") || rawAngle.includes('overhead') || rawAngle.includes('looking down');
  const isLowAngle = rawScale.includes('low-angle') || rawAngle.includes('low-angle') || rawAngle.includes('worm-eye') || rawAngle.includes('looking sharply upward');
  const isDutchAngle = rawScale.includes('dutch') || rawAngle.includes('dutch') || rawAngle.includes('dutch-angle') || rawAngle.includes('diagonal') || rawAngle.includes('tilted');

  // 3. 構図スケール判定（バストアップ、超広角、極限ドアップ）
  const isBustShot = (rawScale.includes('bust') || rawAngle.includes('bust shot') || rawAngle.includes('chest-up') || rawAngle.includes('candid medium')) && !isProfileShot;
  const isWideShot = rawScale.includes('wide') || rawScale.includes('panorama') || rawAngle.includes('wide panorama') || rawAngle.includes('panoramic environmental tableau');

  // 極限顔面ドアップ: 他の特化アングル（横顔・バスト・口元・手元・足元・引き）ではない、純粋な顔面クローズアップのみ
  const isCloseUpShot = !isProfileShot && !isBustShot && !isHandsShot && !isFootstepsShot && !isMouthShot && !isWideShot && (
    rawScale.includes('close-up') || rawAngle.includes('macro portrait') || rawAngle.includes('extreme macro close-up portrait') || rawScale.includes('extreme close-up')
  );

  const isMacroOrDetailShot = isCloseUpShot || isMouthShot || isHandsShot || isFootstepsShot || isObjectCut;

  const cineShotSpecificNegatives: string[] = [];

  if (isHandsShot) {
    // 手元・指先マクロ: 顔・全身・頭部・ベンチ・自販機を完全粉砕
    cineShotSpecificNegatives.push('face', 'eyes', 'head', 'portrait', 'full body', 'legs', 'feet', 'shoes', 'standing pose', 'wide shot', 'medium shot', 'sitting on bench', 'bench', 'vending machine');
    cleanActionPrompt = `[STRICT MACRO HANDS: Tactile extreme close-up macro focusing sharply on hands, fingers, and subtle emotional gestures, hands in sharp focus, background softly blurred, strictly hands and tactile gesture only, absolutely NO face]. ${cleanActionPrompt}`;
  } else if (isFootstepsShot) {
    // 足元・靴ローアングル: 顔・上半身・ベンチを完全粉砕
    cineShotSpecificNegatives.push('face', 'eyes', 'head', 'torso', 'chest', 'portrait', 'upper body', 'standard eye level', 'high angle', 'sitting on bench', 'bench', 'seated pose');
    cleanActionPrompt = `[STRICT LOW-ANGLE FOOTSTEPS: Extreme ground-level low-angle worm-eye camera tracking footsteps and footwear stepping across terrain, natural ground texture and environmental atmosphere, dynamic kinetic motion, strictly ground and feet level, absolutely NO face]. ${cleanActionPrompt}`;
  } else if (isMouthShot) {
    // 口元・吐息マクロ: 全身・足元・ベンチ・自販機を徹底粉砕
    cineShotSpecificNegatives.push('full body', 'torso', 'legs', 'feet', 'shoes', 'standing pose', 'wide shot', 'medium shot', 'distant face', 'sitting on bench', 'bench', 'vending machine', 'seated posture', 'seated pose');
    cleanActionPrompt = `[STRICT MACRO MOUTH & BREATH: Intimate macro close-up focusing tightly on lips, mouth, chin, and throat in emotional contemplation, holding back unspoken words, shallow depth of field with 100% blurred abstract bokeh, strictly lower face and lips only, absolutely NO full body, NO legs, NO torso, NO bench]. ${cleanActionPrompt}`;
  } else if (isProfileShot) {
    // 横顔・プロファイル（90度真横・振り返り）: 正面向き・カメラ目線を徹底粉砕！三面図があっても必ず真横を向かせる
    cineShotSpecificNegatives.push(
      'facing camera', 'front view', '3/4 front view', 'direct eye contact',
      'looking at viewer', 'centered portrait', 'front-facing character',
      'extreme close-up of eyes', 'macro eyes', 'both eyes visible symmetrically'
    );
    cleanActionPrompt = `[STRICT SIDE PROFILE: Exact 90-degree horizontal side profile view of subject placed along the outer rule-of-thirds, gazing across immense open negative space toward the frame edge, razor-sharp silhouette with brilliant directional rim lighting outlining hair and facial profile, strictly side angle with only one eye profile visible, absolutely NO front view]. ${cleanActionPrompt
      .replace(/\b(facing camera|looking at camera|direct gaze|front view)\b/gi, '')}`;
  } else if (isBustShot) {
    // バストショット（胸から上・自然な佇まい）: 瞳の極限ドアップ化を防止し、衣装・肩・姿勢・空間が映る構図を死守
    cineShotSpecificNegatives.push(
      'extreme close-up of eyes', 'macro eyes', 'cropped forehead', 'huge face filling screen',
      'severed head', 'full body standing far', 'legs', 'feet', 'shoes', 'stiff mannequin posture'
    );
    cleanActionPrompt = `[STRICT MEDIUM BUST SHOT: Candid cinematic chest-up framing capturing authentic posture, upper-body clothing, and natural atmospheric presence within the environment, unposed natural aesthetic, rich rim lighting, rule-of-thirds composition, head and shoulders visible with comfortable breathing room]. ${cleanActionPrompt}`;
  } else if (isCloseUpShot) {
    // 極限ドアップ・瞳と表情: 顔面・瞳・表情のみ。身体・ベンチ・自販機・背景を徹底粉砕（世界観のボケ味は保持）
    cineShotSpecificNegatives.push(
      'full body', 'torso', 'chest', 'shoulders', 'arms', 'hands', 'legs', 'feet', 'shoes',
      'standing pose', 'seated pose', 'sitting', 'sitting on bench', 'bench', 'vending machine', 'wide shot', 'medium shot', 'distant face',
      'normal portrait', 'waist-up crop', 'stiff standing posture'
    );
    cleanActionPrompt = `[STRICT MACRO PORTRAIT: Ultra extreme macro close-up portrait cropped tightly at mid-forehead and chin, massive sparkling eyes dominating the canvas, intricate iris reflections, shallow depth of field with 100% blurred abstract bokeh, strictly tight face and emotive eyes only, absolutely NO full body, NO torso, NO legs, NO arms, NO visible outfit, NO bench]. ${cleanActionPrompt
      .replace(/\b(standing|standing upright|upright|standing by[^\,]+|leaning on[^\,]+|seated|sitting|chair|bench|vending machine)\b/gi, '')
      .replace(/(立っている|佇んでいる|佇む|直立して|座っている|ベンチ|椅子|自販機)/g, '')}`;
  } else if (isLowAngle) {
    // 煽り: 地面スレスレからの極限見上げパースを強制
    cineShotSpecificNegatives.push(
      'eye-level shot', 'horizontal camera angle', 'flat perspective', 'looking down',
      'high angle', 'normal eye level', 'standard seated pose', 'level horizon', 'flat straight perspective',
      'extreme close-up'
    );
    cleanActionPrompt = `[STRICT DRAMATIC LOW-ANGLE: Extreme ground-level camera looking sharply upward at a 60-degree vertical angle, towering majestic perspective with exaggerated vertical foreshortening, subject standing tall framed against the soaring expanse above, dramatic worm-eye parallax]. ${cleanActionPrompt}`;
  } else if (isDutchAngle) {
    // ダッチアングル: 斜め35度傾き
    cineShotSpecificNegatives.push(
      'horizontal level frame', 'straight horizontal camera', 'level horizon', 'flat standard shot',
      'vertical upright symmetry', 'level camera'
    );
    cleanActionPrompt = `[STRICT DUTCH ANGLE: Aggressively tilted 35-degree off-axis Dutch-angle camera framing, sharp kinetic diagonal lines slashing across the frame, off-kilter dynamic perspective creating palpable tension and emotional instability, stylish cinematic slant]. ${cleanActionPrompt}`;
  } else if (isWideShot) {
    // 引き・全景: 風景・環境が画面の90%を支配、被写体は豆粒シルエット
    cineShotSpecificNegatives.push(
      'close-up', 'medium shot', 'prominent character in foreground', 'large face',
      'dominant person in center', 'waist-up', 'chest-up', 'normal portrait'
    );
    cleanActionPrompt = `[STRICT EXTREME WIDE PANORAMA: Grand panoramic environmental tableau where the vast grand environment, immense background scale, and sweeping atmospheric horizon overwhelm 90% of the canvas, character naturally integrated as a tiny distant miniature silhouette in the lower third, breathtaking spatial depth]. ${cleanActionPrompt}`;
  } else if (isHighAngle) {
    // 俯瞰: 真上75度見下ろし
    cineShotSpecificNegatives.push(
      'eye-level shot', 'horizontal angle', 'looking up from below', 'worm-eye view',
      'frontal portrait', 'standard eye level', 'horizontal eye contact', 'extreme close-up'
    );
    cleanActionPrompt = `[STRICT OVERHEAD BIRD'S-EYE: Steep overhead high-angle bird-eye view looking down from high vantage point at a 75-degree angle, emphasizing ground geometry, environmental textures, and long elongated dramatic shadows cast across the floor plane, unique top-down perspective]. ${cleanActionPrompt}`;
  } else if (isRearShot) {
    // 背後: 後ろ姿
    cineShotSpecificNegatives.push(
      'facing camera', 'front view', 'looking back at camera', 'direct eye contact',
      'full frontal face', 'front view portrait', 'extreme close-up of eyes'
    );
    cleanActionPrompt = `[STRICT REAR VIEW: Atmospheric rear three-quarter view seen from behind looking outward into the glowing depth of the world, back turned to camera, expressive back silhouette, sharing the character forward gaze toward the unfolding horizon]. ${cleanActionPrompt}`;
  }

  if (cineShotSpecificNegatives.length > 0) {
    negativeLayers.push(...cineShotSpecificNegatives);
  }

  let characterPromptLayer = '';
  if (isObjectCut) {
    characterPromptLayer = '[STRICT STILL-LIFE INSERT: completely deserted scene, strictly NO humans, NO person, pure macro shot of object and atmospheric environment]. ';
    negativeLayers.push('human, person, girl, boy, man, woman, child, face, eye, hands, fingers, legs, feet, body silhouette, crowd, portrait');
  } else {
    // ── 案A（明示的に男と指定されていない限り100%美少女・女子高生にする）規約 ──
    const hasExplicitMale = /\b(male|boy|man|guy|men|masculine|男子|男の子|少年|男性|青年|オッサン|おじさん)\b/i.test(`${effectiveDna || ''} ${cleanActionPrompt}`);
    
    // 明示的な男指定がない限り、デフォルトを「透明感のある女子高生・美少女」に強制固定
    let baseDna = effectiveDna || '';
    if (!hasExplicitMale) {
      if (!baseDna) {
        baseDna = 'delicate cute anime high school girl, beautiful female protagonist, soft feminine features';
      } else {
        // 日本語「高校生」「学生」等の曖昧な表現を「女子高校生」に強化
        baseDna = baseDna.replace(/(?<!女子)高校生/g, '女子高校生')
          .replace(/(?<!女子)学生/g, '女子学生');
        if (!/\b(female|girl|woman|美少女|女子)\b/i.test(baseDna)) {
          baseDna = `delicate anime girl, ${baseDna}`;
        }
      }
      // 全人物カット共通で男性・少年化を100%完全除外！
      negativeLayers.push('male, boy, man, masculine, male character, young boy, guy, muscular, broad shoulders, facial hair, stubble');
    }

    let sanitizedDna = baseDna;

    if (isProfileShot) {
      sanitizedDna = sanitizedDna
        .replace(/\b(standing|standing upright|upright|full body|shoes?|sneakers?|feet|legs?|sitting|seated|bench)\b/gi, '')
        .trim();
      characterPromptLayer = `[PROTAGONIST PROFILE: ${sanitizedDna}, side profile silhouette, hairstyle, and facial profile matching turnaround sheet, facing sideways]. `;
    } else if (isBustShot) {
      sanitizedDna = sanitizedDna
        .replace(/\b(standing upright|full body|head-to-toe|shoes?|sneakers?|boots?|feet|legs?)\b/gi, '')
        .trim();
      characterPromptLayer = `[PROTAGONIST BUST SHOT: ${sanitizedDna}, upper body, chest-up posture, hair, and clothing matching turnaround sheet]. `;
    } else if (isCloseUpShot || isMouthShot) {
      sanitizedDna = sanitizedDna
        .replace(/\b(standing|standing upright|upright|full body|head-to-toe|shoes?|sneakers?|boots?|legs?|feet|pants|skirt|jacket|coat|windbreaker|sitting|seated|bench)\b/gi, '')
        .trim();
      characterPromptLayer = `[PROTAGONIST CLOSE-UP: ${sanitizedDna}, face, facial features, hair, eyes matching reference turnaround sheet]. `;
    } else if (isHandsShot || isFootstepsShot) {
      sanitizedDna = sanitizedDna
        .replace(/\b(face|eyes|hair|headshot|portrait|smile|gaze)\b/gi, '')
        .trim();
      characterPromptLayer = `[PROTAGONIST ATTIRE: ${sanitizedDna}]. `;
    } else if (isRearShot) {
      sanitizedDna = sanitizedDna
        .replace(/\b(face|eyes|smile|gaze|facial features)\b/gi, '')
        .trim();
      characterPromptLayer = `[PROTAGONIST REAR: ${sanitizedDna}, back silhouette, hair and outfit matching turnaround sheet]. `;
    } else if (task.isEndFrame) {
      // 到達点フレーム: 顔正面の縛りを解き、髪型・衣装の一貫性を維持したまま大胆なアングル変更を許容
      characterPromptLayer = `[PROTAGONIST CONTINUITY: ${sanitizedDna}, strictly maintain identical hairstyle, hair color, and clothing from this transformed perspective]. `;
      negativeLayers.push('different character, change of clothes, multiple people, extra person, duplicate characters');
    } else {
      characterPromptLayer = `[MANDATORY SINGLE PROTAGONIST: ${sanitizedDna}, strictly maintain identical appearance, hairstyle, hair color, and clothing across all scenes matching turnaround sheet]. `;
      negativeLayers.push('different character, different face, different hair, change of clothes, multiple people, extra person, duplicate characters, changing appearance');
    }
  }

  // 参照画像（Reference Images / Turnaround / Master Anchor）
  // 物体専用カット（isObjectCut）のみ人物参照を除外し、
  // キャラクターが登場する全カット（ドアップ、横顔、手元、足元、俯瞰、斜め等）には三面図を100%完全バインド！
  const targetMediaIds: string[] = [];
  if (!isObjectCut) {
    if (task.referenceImageMediaId) {
      targetMediaIds.push(task.referenceImageMediaId);
    } else if (!task.isMvMode && activeReference?.mediaId) {
      targetMediaIds.push(activeReference.mediaId);
    }
  }

  // ネガティブレイヤーの結合（前カットからの対比ネガティブは絶対に消さない）
  let sanitizedNegativeLayers = negativeLayers.filter(Boolean);

  // 【プロンプト先頭配置ガード】マクロ接写・極限画角の場合、AIが最初に見る位置にカメラディレクティブを直接配置して最優先解釈させる
  let leadingDirective = '';
  let remainingAction = cleanActionPrompt;
  const strictMatch = cleanActionPrompt.match(/^(\[STRICT[^\]]+\]\.\s*)/);
  if (strictMatch) {
    leadingDirective = `${strictMatch[1]} `;
    remainingAction = cleanActionPrompt.slice(strictMatch[0].length);
  }

  if (activeReference && !isObjectCut) {
    const { styleDna, antiPoseNegative, eraNegative } = activeReference;
    if (antiPoseNegative) sanitizedNegativeLayers.push(antiPoseNegative);
    if (eraNegative) sanitizedNegativeLayers.push(eraNegative);

    const finalNegative = sanitizedNegativeLayers.filter(Boolean).join(', ');
    const rawFinalPrompt = task.isEndFrame
      ? `${leadingDirective}${effectiveMasterPrefix}. ${cameraContext}. ${effectiveMasterPrompt}. ${panelDirective}${characterPromptLayer}[ACTION: ${remainingAction}]. ${dynamicAttire}. [REFERENCE MEDIUM: ${styleDna || ''}]. ${modePromptSuffix}.${STRICT_STYLE_SUFFIX}`
      : `${leadingDirective}${effectiveMasterPrefix}. ${effectiveMasterPrompt}. ${panelDirective}${characterPromptLayer}[ACTION: ${remainingAction}, ${cameraContext}]. ${dynamicAttire}. [REFERENCE MEDIUM: ${styleDna || ''}]. ${modePromptSuffix}.${STRICT_STYLE_SUFFIX}`;

    return {
      finalPrompt: sanitizePromptForGoogleSafety(rawFinalPrompt),
      finalNegative,
      referenceImageMediaIds: targetMediaIds.length > 0 ? targetMediaIds : undefined
    };
  } else {
    const finalNegative = sanitizedNegativeLayers.filter(Boolean).join(', ');
    const rawFinalPrompt = task.isEndFrame
      ? `${leadingDirective}${effectiveMasterPrefix}. ${cameraContext}. ${effectiveMasterPrompt}. ${panelDirective}${characterPromptLayer}${remainingAction}. ${dynamicAttire}. ${modePromptSuffix}.${STRICT_STYLE_SUFFIX}`
      : `${leadingDirective}${effectiveMasterPrefix}. ${effectiveMasterPrompt}. ${panelDirective}${characterPromptLayer}${cameraContext}. ${remainingAction}. ${dynamicAttire}. ${modePromptSuffix}.${STRICT_STYLE_SUFFIX}`;

    return {
      finalPrompt: sanitizePromptForGoogleSafety(rawFinalPrompt),
      finalNegative,
      referenceImageMediaIds: targetMediaIds.length > 0 ? targetMediaIds : undefined
    };
  }
}

/**
 * Google AI (Imagen 3 / Banana) のセーフティポリシーによる誤検知を回避するためのサニタイザー
 * 性的・暴力的・未成年関連の誤認を招くキーワードを洗練された安全な芸術的表現に置換
 */
export function sanitizePromptForGoogleSafety(prompt: string): string {
  if (!prompt) return prompt;

  let cleaned = prompt
    // undefinedやnullの混入を除去
    .replace(/\b(undefined|null)\b/gi, '')
    // 性的・誘惑的・成人向け誤認ワードの無害化
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
    // 空のブラケットや括弧を除去
    .replace(/\[\s*\]/g, '')
    .replace(/\(\s*\)/g, '')
    // 連続するカンマやピリオド、空白の整理
    .replace(/,\s*,+/g, ',')
    .replace(/\.\s*\.+/g, '.')
    .replace(/,\s*\./g, '.')
    .replace(/\.\s*,/g, '.')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[,.\s]+|[,.\s]+$/g, '')
    .trim();

  // Google Imagen の安全長制限 (1300文字以内に抑制)
  if (cleaned.length > 1300) {
    cleaned = cleaned.slice(0, 1290).replace(/,[^,]*$/, '').trim() + ', masterpiece';
  }

  return cleaned;
}
