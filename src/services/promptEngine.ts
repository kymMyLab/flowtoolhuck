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
export function buildDynamicAntiPreviousNegative(previous?: PreviousShotContext | PreviousShotContext[]): string {
  if (!previous) return '';

  const contexts: PreviousShotContext[] = Array.isArray(previous) ? previous : [previous];
  if (contexts.length === 0) return '';

  const antiTokens: string[] = [];

  for (const ctx of contexts) {
    if (!ctx) continue;

    // 1. 直前のスケールに基づく除外トークン
    if (ctx.scale && SHOT_SCALE_REGISTRY[ctx.scale]) {
      antiTokens.push(...SHOT_SCALE_REGISTRY[ctx.scale].antiRepeatNegatives);
      antiTokens.push(`identical ${ctx.scale} framing`, `same shot scale as previous scene`);
    } else if (ctx.scale) {
      const lowerScale = ctx.scale.toLowerCase();
      if (lowerScale.includes('close')) {
        antiTokens.push('extreme close-up', 'macro face', 'zoomed in headshot', 'tight portrait', 'identical close camera distance', 'face-only framing');
      } else if (lowerScale.includes('wide') || lowerScale.includes('panorama')) {
        antiTokens.push('distant tiny figure', 'extreme wide shot', 'panoramic view', 'identical wide landscape', 'sweeping panorama');
      } else if (lowerScale.includes('bust')) {
        antiTokens.push('bust shot repetition', 'identical bust portrait', 'chest-up framing repetition');
      } else if (lowerScale.includes('medium')) {
        antiTokens.push('standard medium shot', 'static bust portrait', 'monotonous medium distance', 'identical standing pose');
      }
    }

    // 2. 直前のカメラアングル・動きに基づく除外トークン
    if (ctx.angle || ctx.tag) {
      const angleStr = `${ctx.angle || ''} ${ctx.tag || ''}`.toLowerCase();
      if (angleStr.includes('high') || angleStr.includes('down') || angleStr.includes('俯瞰') || angleStr.includes('overhead') || angleStr.includes('bird')) {
        antiTokens.push('high angle looking down', 'overhead camera perspective', 'bird-eye view repetition');
      } else if (angleStr.includes('low') || angleStr.includes('worm') || angleStr.includes('煽り') || angleStr.includes('upward')) {
        antiTokens.push('low angle looking up', 'worm-eye perspective', 'upward tilt repetition');
      } else if (angleStr.includes('dutch') || angleStr.includes('diagonal') || angleStr.includes('tilt') || angleStr.includes('斜め')) {
        antiTokens.push('dutch angle tilt', 'diagonal horizon repetition', 'slanted camera axis');
      } else if (angleStr.includes('profile') || angleStr.includes('side') || angleStr.includes('横')) {
        antiTokens.push('side profile view', '90-degree profile repetition', 'looking sideways repetition');
      } else if (angleStr.includes('rear') || angleStr.includes('back') || angleStr.includes('behind') || angleStr.includes('背')) {
        antiTokens.push('seen from behind', 'back view repetition', 'over the shoulder framing');
      }
    }

    // 3. 直前のポーズ・姿勢・背景要素・小道具のダイレクトネガティブ化
    if (ctx.prompt && typeof ctx.prompt === 'string') {
      const lowerPrompt = ctx.prompt.toLowerCase();

      // (A) 姿勢・ポーズ・向きの除外
      if (lowerPrompt.includes('sit') || lowerPrompt.includes('crouch') || lowerPrompt.includes('seated') || lowerPrompt.includes('floor') || lowerPrompt.includes('ground') || lowerPrompt.includes('座')) {
        antiTokens.push('sitting on floor', 'sitting down', 'seated posture', 'crouching pose', 'squatting on ground', 'sitting pose', 'hugging knees on floor', 'sitting on bench');
      }
      if (lowerPrompt.includes('stand') || lowerPrompt.includes('standing') || lowerPrompt.includes('upright') || lowerPrompt.includes('立')) {
        antiTokens.push('identical standing pose', 'repeating standing posture', 'static upright standing', 'straight standing pose', 'stiff standing posture', 'standing by railing', 'leaning on fence', 'duplicate fence pose', 'monotonous standing figure');
      }
      if (lowerPrompt.includes('fence') || lowerPrompt.includes('railing') || lowerPrompt.includes('手すり') || lowerPrompt.includes('柵')) {
        antiTokens.push('identical fence background', 'repeating railing', 'same fence perspective');
      }
      if (lowerPrompt.includes('walk') || lowerPrompt.includes('walking') || lowerPrompt.includes('stride') || lowerPrompt.includes('歩')) {
        antiTokens.push('walking in same direction', 'repeating walking pose', 'identical walking stride');
      }
      if (lowerPrompt.includes('run') || lowerPrompt.includes('running') || lowerPrompt.includes('dash') || lowerPrompt.includes('走')) {
        antiTokens.push('running pose repetition', 'dashing posture repetition');
      }
      if (lowerPrompt.includes('turn') || lowerPrompt.includes('behind') || lowerPrompt.includes('back view') || lowerPrompt.includes('背') || lowerPrompt.includes('振り')) {
        antiTokens.push('seen from behind', 'looking back over shoulder', 'back turned', 'rear view repetition');
      }
      if (lowerPrompt.includes('front') || lowerPrompt.includes('facing camera') || lowerPrompt.includes('centered') || lowerPrompt.includes('look at') || lowerPrompt.includes('eye contact') || lowerPrompt.includes('正面') || lowerPrompt.includes('目線')) {
        antiTokens.push('facing front camera', 'identical front view', 'centered head-on angle', 'looking straight into camera', 'monotonous eye contact');
      }
      if (lowerPrompt.includes('lean') || lowerPrompt.includes('leaning') || lowerPrompt.includes('寄りかか')) {
        antiTokens.push('leaning against wall', 'leaning on railing', 'slouching posture');
      }
      if (lowerPrompt.includes('chin') || lowerPrompt.includes('cheek') || lowerPrompt.includes('thinking') || lowerPrompt.includes('頬杖')) {
        antiTokens.push('hand on chin pose', 'hand on cheek', 'touching face pose');
      }

      // (B) 傘・手持ち小道具・アクセサリの重複防止（前カットと同一ポーズ・小道具の完全排除）
      if (lowerPrompt.includes('umbrella') || lowerPrompt.includes('parasol') || lowerPrompt.includes('傘')) {
        antiTokens.push('holding umbrella', 'open umbrella', 'umbrella in hand', 'repeating umbrella pose', 'holding clear vinyl umbrella', 'carrying umbrella', 'parasol');
      }
      if (lowerPrompt.includes('phone') || lowerPrompt.includes('smartphone') || lowerPrompt.includes('mobile') || lowerPrompt.includes('スマホ') || lowerPrompt.includes('携帯')) {
        antiTokens.push('holding smartphone', 'looking at phone screen', 'repeating phone gesture', 'operating mobile phone');
      }
      if (lowerPrompt.includes('cup') || lowerPrompt.includes('mug') || lowerPrompt.includes('glass') || lowerPrompt.includes('drink') || lowerPrompt.includes('coffee') || lowerPrompt.includes('tea') || lowerPrompt.includes('コップ')) {
        antiTokens.push('holding cup', 'holding mug', 'drinking pose', 'holding beverage');
      }
      if (lowerPrompt.includes('bike') || lowerPrompt.includes('bicycle') || lowerPrompt.includes('cycling') || lowerPrompt.includes('自転車')) {
        antiTokens.push('riding bicycle', 'identical bicycle pose', 'repeating bicycle framing');
      }
      if (lowerPrompt.includes('book') || lowerPrompt.includes('notebook') || lowerPrompt.includes('reading') || lowerPrompt.includes('本') || lowerPrompt.includes('読書')) {
        antiTokens.push('holding book', 'reading book pose', 'holding notebook', 'open book repetition');
      }
      if (lowerPrompt.includes('sword') || lowerPrompt.includes('katana') || lowerPrompt.includes('blade') || lowerPrompt.includes('刀')) {
        antiTokens.push('holding katana', 'drawing sword pose', 'brandishing weapon repetition');
      }
      if (lowerPrompt.includes('fan') || lowerPrompt.includes('folding fan') || lowerPrompt.includes('sensu') || lowerPrompt.includes('扇子')) {
        antiTokens.push('holding folding fan', 'waving fan repetition');
      }
      if (lowerPrompt.includes('headphone') || lowerPrompt.includes('earphone') || lowerPrompt.includes('ヘッドホン')) {
        antiTokens.push('wearing headphones repetition', 'adjusting headphones');
      }

      // (C) 特徴的な背景・小道具シチュエーションの重複防止
      if (lowerPrompt.includes('window') || lowerPrompt.includes('balcony') || lowerPrompt.includes('窓')) {
        antiTokens.push('identical window background', 'same window frame backdrop', 'repeating window perspective');
      }
      if (lowerPrompt.includes('cardboard') || lowerPrompt.includes('moving box') || lowerPrompt.includes('段ボール')) {
        antiTokens.push('identical cardboard boxes background', 'repeating stacked moving boxes');
      }
      if (lowerPrompt.includes('door') || lowerPrompt.includes('doorway') || lowerPrompt.includes('扉') || lowerPrompt.includes('ドア')) {
        antiTokens.push('identical doorway framing', 'same door backdrop');
      }
      if (lowerPrompt.includes('street') || lowerPrompt.includes('sidewalk') || lowerPrompt.includes('crossing') || lowerPrompt.includes('交差点') || lowerPrompt.includes('路地')) {
        antiTokens.push('identical street perspective', 'repeating sidewalk angle', 'same street corner');
      }

      for (const rule of POSE_CONTRAST_RULES) {
        if (rule.triggerKeywords.some(keyword => lowerPrompt.includes(keyword))) {
          antiTokens.push(...rule.antiRepeatNegatives);
        }
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

  // 重複排除して最大30トークン程度に制限（トークンあふれ防止）
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
  // 今後どんなプロンプトや設定が飛んできても、FlowTool側が画角・アングルに応じてポーズの偏りを自動中和
  const fullPromptContext = `${cleanActionPrompt} ${cameraContext} ${task.shotScale || ''} ${task.cinematicAngle || ''} ${task.camera || ''}`.toLowerCase();

  const isCloseUpShot = fullPromptContext.includes('close-up') || fullPromptContext.includes('macro') || fullPromptContext.includes('headshot') || fullPromptContext.includes('tight portrait') || fullPromptContext.includes('bust shot') || fullPromptContext.includes('ドアップ');
  const isLowAngle = fullPromptContext.includes('low-angle') || fullPromptContext.includes('worm') || fullPromptContext.includes('upward') || fullPromptContext.includes('looking up') || fullPromptContext.includes('煽り');
  const isDutchAngle = fullPromptContext.includes('dutch') || fullPromptContext.includes('diagonal') || fullPromptContext.includes('斜め');
  const isWideShot = fullPromptContext.includes('wide') || fullPromptContext.includes('panorama') || fullPromptContext.includes('establishing') || fullPromptContext.includes('landscape') || fullPromptContext.includes('全景');
  const isHighAngle = fullPromptContext.includes('high-angle') || fullPromptContext.includes('bird') || fullPromptContext.includes('overhead') || fullPromptContext.includes('looking down') || fullPromptContext.includes('俯瞰');
  const isProfileShot = fullPromptContext.includes('profile') || fullPromptContext.includes('side view') || fullPromptContext.includes('90-degree') || fullPromptContext.includes('横顔');
  const isRearShot = fullPromptContext.includes('rear') || fullPromptContext.includes('back view') || fullPromptContext.includes('from behind') || fullPromptContext.includes('後ろ姿') || fullPromptContext.includes('背後');

  const cineShotSpecificNegatives: string[] = [];

  if (isCloseUpShot) {
    // 寄り・接写: 顔面・瞳・表情のみ。身体・椅子・背景を徹底粉砕
    cineShotSpecificNegatives.push(
      'full body', 'torso', 'chest', 'shoulders', 'arms', 'hands', 'legs', 'feet', 'shoes',
      'standing pose', 'seated on chair', 'sitting on bench', 'room interior', 'outdoor street',
      'wide shot', 'medium shot', 'distant face', 'normal portrait', 'waist-up crop', 'stiff standing posture'
    );
    cleanActionPrompt = `[STRICT MACRO PORTRAIT: Ultra extreme macro close-up portrait cropped tightly at mid-forehead and chin, massive sparkling eyes dominating the canvas, intricate iris reflections, shallow depth of field with 100% blurred abstract bokeh, strictly face and eyes only, absolutely NO full body, NO torso, NO legs, NO background scene]. ${cleanActionPrompt
      .replace(/\b(standing|standing upright|upright|standing by[^\,]+|leaning on[^\,]+|seated|sitting|chair|bench)\b/gi, '')
      .replace(/(立っている|佇んでいる|佇む|直立して|座っている|ベンチ|椅子)/g, '')}`;
  } else if (isLowAngle) {
    // 煽り: 地面スレスレからの極限見上げパースを強制
    cineShotSpecificNegatives.push(
      'eye-level shot', 'horizontal camera angle', 'flat perspective', 'looking down',
      'high angle', 'normal eye level', 'standard seated pose', 'level horizon', 'flat straight perspective'
    );
    cleanActionPrompt = `[STRICT DRAMATIC LOW-ANGLE: Extreme ground-level camera looking sharply upward at a 60-degree vertical angle, towering majestic perspective with exaggerated vertical foreshortening, subject standing tall framed against the immense towering sky and dynamic overhead clouds, dramatic worm-eye parallax]. ${cleanActionPrompt}`;
  } else if (isDutchAngle) {
    // ダッチアングル: 斜め35度傾き
    cineShotSpecificNegatives.push(
      'horizontal level frame', 'straight horizontal camera', 'level horizon', 'flat standard shot',
      'vertical upright symmetry', 'level camera'
    );
    cleanActionPrompt = `[STRICT DUTCH ANGLE: Aggressively tilted 35-degree off-axis Dutch-angle camera framing, sharp kinetic diagonal horizon slashing across the frame, dramatic diagonal leading lines, stylish cinematic slant]. ${cleanActionPrompt}`;
  } else if (isWideShot) {
    // 引き・全景: 風景が画面の90%を支配、被写体は豆粒シルエット
    cineShotSpecificNegatives.push(
      'close-up', 'medium shot', 'prominent character in foreground', 'large face',
      'dominant person in center', 'waist-up', 'chest-up', 'normal portrait'
    );
    cleanActionPrompt = `[STRICT EXTREME WIDE PANORAMA: Grand panoramic environmental tableau where sweeping sky, colossal horizon, and expansive landscape overwhelm 90% of the canvas, character naturally integrated as a tiny distant miniature silhouette in the lower third, immense breathing space and breathtaking atmospheric scale]. ${cleanActionPrompt}`;
  } else if (isHighAngle) {
    // 俯瞰: 真上75度見下ろし
    cineShotSpecificNegatives.push(
      'eye-level shot', 'horizontal angle', 'looking up from below', 'worm-eye view',
      'frontal portrait', 'standard eye level', 'horizontal eye contact'
    );
    cleanActionPrompt = `[STRICT OVERHEAD BIRD'S-EYE: Steep overhead high-angle bird-eye view looking down from high vantage point at a 75-degree angle, emphasizing ground geometry, environmental textures, and long elongated dramatic shadows cast across the floor plane, unique top-down perspective]. ${cleanActionPrompt}`;
  } else if (isProfileShot) {
    // 横顔: 90度真横
    cineShotSpecificNegatives.push(
      'facing camera', 'front view', '3/4 front view', 'direct eye contact',
      'looking at viewer', 'centered portrait', 'front-facing character'
    );
    cleanActionPrompt = `[STRICT SIDE PROFILE: Exact 90-degree horizontal side profile view of subject placed along the outer rule-of-thirds, gazing across immense open negative space toward the frame edge, razor-sharp silhouette with brilliant directional rim lighting outlining hair and facial profile]. ${cleanActionPrompt}`;
  } else if (isRearShot) {
    // 背後: 後ろ姿
    cineShotSpecificNegatives.push(
      'facing camera', 'front view', 'looking back at camera', 'direct eye contact',
      'full frontal face', 'front view portrait'
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
  } else if (effectiveDna) {
    // クローズアップ等の場合、DNAやキャラクター設定内の立ちポーズ・服装指定を安全に顔・瞳のみに純化
    let sanitizedDna = effectiveDna;
    if (isCloseUpShot) {
      sanitizedDna = sanitizedDna
        .replace(/\b(standing|standing upright|upright|full body|head-to-toe|shoes?|sneakers?|boots?|legs?|feet|pants|skirt|jacket|coat|windbreaker)\b/gi, '')
        .trim();
      characterPromptLayer = `[PROTAGONIST CLOSE-UP DNA: ${sanitizedDna}, face, facial features, hair, eyes only]. `;
    } else if (task.isEndFrame) {
      // 到達点フレーム: 顔正面の縛りを解き、髪型・衣装の一貫性を維持したまま大胆なアングル変更を許容
      characterPromptLayer = `[PROTAGONIST CONTINUITY: ${sanitizedDna}, strictly maintain identical hairstyle, hair color, and clothing from this transformed perspective]. `;
      negativeLayers.push('different character, change of clothes, multiple people, extra person, duplicate characters');
    } else {
      characterPromptLayer = `[MANDATORY SINGLE PROTAGONIST: ${sanitizedDna}, strictly maintain identical facial appearance, hairstyle, hair color, and clothing across all scenes]. `;
      negativeLayers.push('different character, different face, different hair, change of clothes, multiple people, extra person, duplicate characters, changing appearance');
    }
  }

  // 参照画像（Reference Images / Turnaround / Master Anchor）
  const targetMediaIds: string[] = [];
  if (!isObjectCut) {
    if (task.referenceImageMediaId) targetMediaIds.push(task.referenceImageMediaId);
    if (activeReference?.mediaId && !targetMediaIds.includes(activeReference.mediaId)) {
      targetMediaIds.push(activeReference.mediaId);
    }
  }

  if (activeReference && !isObjectCut) {
    const { styleDna, antiPoseNegative, eraNegative } = activeReference;
    if (antiPoseNegative) negativeLayers.push(antiPoseNegative);
    if (eraNegative) negativeLayers.push(eraNegative);

    const finalNegative = negativeLayers.filter(Boolean).join(', ');
    const rawFinalPrompt = task.isEndFrame
      ? `${effectiveMasterPrefix}. ${cameraContext}. ${effectiveMasterPrompt}. ${panelDirective}${characterPromptLayer}[ACTION: ${cleanActionPrompt}]. ${dynamicAttire}. [REFERENCE MEDIUM: ${styleDna || ''}]. ${modePromptSuffix}.${STRICT_STYLE_SUFFIX}`
      : `${effectiveMasterPrefix}. ${effectiveMasterPrompt}. ${panelDirective}${characterPromptLayer}[ACTION: ${cleanActionPrompt}, ${cameraContext}]. ${dynamicAttire}. [REFERENCE MEDIUM: ${styleDna || ''}]. ${modePromptSuffix}.${STRICT_STYLE_SUFFIX}`;

    return {
      finalPrompt: sanitizePromptForGoogleSafety(rawFinalPrompt),
      finalNegative,
      referenceImageMediaIds: targetMediaIds.length > 0 ? targetMediaIds : undefined
    };
  } else {
    const finalNegative = negativeLayers.filter(Boolean).join(', ');
    const rawFinalPrompt = task.isEndFrame
      ? `${effectiveMasterPrefix}. ${cameraContext}. ${effectiveMasterPrompt}. ${panelDirective}${characterPromptLayer}${cleanActionPrompt}. ${dynamicAttire}. ${modePromptSuffix}.${STRICT_STYLE_SUFFIX}`
      : `${effectiveMasterPrefix}. ${effectiveMasterPrompt}. ${panelDirective}${characterPromptLayer}${cameraContext}. ${cleanActionPrompt}. ${dynamicAttire}. ${modePromptSuffix}.${STRICT_STYLE_SUFFIX}`;

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
