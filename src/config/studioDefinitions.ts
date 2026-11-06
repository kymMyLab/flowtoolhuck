import { KenBurnsPreset } from '../types';

/**
 * =======================================================================
 * STUDIO PRO: ロジック駆動型・統合定義ファイル (Single Source of Truth)
 * =======================================================================
 * すべてのモデル、構図ルール、カメラワーク、プロンプトパイプライン、
 * ネガティブ除外ルールをこの定義データに集約します。
 * コード側での個別ハードコードを完全排除し、この定義から自動駆動させます。
 */

// ── 1. 画像生成モデル定義 ─────────────────────────────────────────────
export interface ImageModelDefinition {
  id: string;
  name: string;
  label: string;
  description: string;
  isDefault?: boolean;
}

export const IMAGE_MODELS_REGISTRY: ImageModelDefinition[] = [
  { 
    id: 'banana-pro', 
    name: '🍌 Nano Banana Pro', 
    label: '🍌 Banana Pro（最高峰シネマ / 0pt・別枠クォータ）', 
    description: '圧倒的ディテールとライティング。2.1制限時も別枠で描画可能' 
  },
  { 
    id: 'banana-2.1', 
    name: '🍌 Nano Banana 2.1', 
    label: '🍌 Banana 2.1（高速・高画質 / 0pt）★新標準', 
    description: '速度と描画精度のバランスが最も優れた標準モデル',
    isDefault: true
  },
  { 
    id: 'banana-2-lite', 
    name: '🍌 Nano Banana 2 Lite', 
    label: '🍌 2 Lite（超爆速 / 0pt）', 
    description: '下書き・大量プレビュー確認向け' 
  }
];

export function resolveImageModel(keyOrLabel?: string): ImageModelDefinition {
  const defaultModel = IMAGE_MODELS_REGISTRY.find(m => m.isDefault) || IMAGE_MODELS_REGISTRY[1];
  if (!keyOrLabel) return defaultModel;
  // 旧 "banana-2" や部分一致もスマートに解決
  if (keyOrLabel === 'banana-2' || keyOrLabel.includes('Banana 2（')) {
    return IMAGE_MODELS_REGISTRY.find(m => m.id === 'banana-2.1') || defaultModel;
  }
  return IMAGE_MODELS_REGISTRY.find(m => m.id === keyOrLabel || m.label === keyOrLabel || m.name === keyOrLabel) || defaultModel;
}

// ── 2. カメラワーク・演出（Webtoon静止画向け固定デフォルト） ──────────
export interface CameraWorkDefinition {
  id: string;
  label: string;
  motionPrompt: string;
  recommendedKenBurns: KenBurnsPreset;
}

export const DEFAULT_CAMERA_WORK: CameraWorkDefinition = { 
  id: 'static', 
  label: '固定（静止画マスター）', 
  motionPrompt: 'Static cinematic frame, stable composition, high quality artwork',
  recommendedKenBurns: 'none'
};

export const CAMERA_WORK_REGISTRY: CameraWorkDefinition[] = [DEFAULT_CAMERA_WORK];

export function resolveCameraWork(_labelOrMotion?: string): CameraWorkDefinition {
  return DEFAULT_CAMERA_WORK;
}

export function resolveRecommendedCameraWorkAndKenBurns(
  _cutId?: number,
  _mode?: string,
  _isMvMode?: boolean,
  _isMangaMode?: boolean
): CameraWorkDefinition {
  return DEFAULT_CAMERA_WORK;
}

// ── 5. アクション・姿勢・小道具の対比ルール（Pose & Props Contrast Rule） ─────────────
export const POSE_CONTRAST_RULES: Array<{
  triggerKeywords: string[];
  antiRepeatNegatives: string[];
}> = [
  // 1. 座り・しゃがみ・床姿勢
  {
    triggerKeywords: ['sit', 'sitting', 'floor', 'ground', 'tatami', 'cross-legged', 'seated', 'crouch', 'crouching', 'squat', 'bench', 'chair'],
    antiRepeatNegatives: [
      'sitting on floor', 'sitting down', 'seated posture', 'crossed legs', 
      'kneeling', 'squatting', 'floor sitting pose', 'looking up from floor', 
      'sitting on tatami', 'floor seating posture', 'sitting on bench', 'sitting on chair'
    ]
  },
  // 2. 直立・棒立ち
  {
    triggerKeywords: ['stand', 'standing', 'stiff', 'upright'],
    antiRepeatNegatives: [
      'stiff standing pose', 'static upright standing', 'motionless standing',
      'identical standing pose', 'repeating standing posture', 'straight standing posture'
    ]
  },
  // 3. 移動（歩き・走り・疾走）
  {
    triggerKeywords: ['walk', 'walking', 'stride', 'run', 'running', 'dash', 'dashing'],
    antiRepeatNegatives: [
      'walking away repetition', 'running pose repetition', 'identical walking stride',
      'walking in same direction', 'dashing pose repetition'
    ]
  },
  // 4. 傘・日傘・雨天小道具（手前カットからの連続出現を絶対阻止）
  {
    triggerKeywords: ['umbrella', 'parasol', 'rain', '傘', '日傘', '雨傘'],
    antiRepeatNegatives: [
      'holding umbrella', 'open umbrella', 'umbrella in hand', 'repeating umbrella pose',
      'holding clear vinyl umbrella', 'carrying umbrella', 'parasol', 'umbrella canopy'
    ]
  },
  // 5. スマホ・携帯デバイス
  {
    triggerKeywords: ['phone', 'smartphone', 'mobile', 'cellphone', 'スマホ', '携帯'],
    antiRepeatNegatives: [
      'holding smartphone', 'looking at phone screen', 'repeating phone gesture',
      'operating mobile device', 'texting on smartphone'
    ]
  },
  // 6. カップ・グラス・飲み物・カフェ小道具
  {
    triggerKeywords: ['cup', 'mug', 'glass', 'drink', 'drinking', 'coffee', 'tea', 'beverage', 'tumbler', 'カップ', 'コップ'],
    antiRepeatNegatives: [
      'holding cup', 'holding mug', 'drinking pose', 'holding beverage', 'sipping drink', 'holding glass'
    ]
  },
  // 7. 自転車・乗り物
  {
    triggerKeywords: ['bike', 'bicycle', 'cycling', 'pedal', '自転車'],
    antiRepeatNegatives: [
      'riding bicycle', 'sitting on bike', 'holding bicycle handlebars', 'repeating bicycle framing'
    ]
  },
  // 8. 本・ノート・ペン・読書・執筆
  {
    triggerKeywords: ['book', 'notebook', 'pen', 'reading', 'writing', 'pencil', '本', '読書'],
    antiRepeatNegatives: [
      'holding book', 'reading book pose', 'holding notebook', 'writing with pen', 'open book'
    ]
  },
  // 9. 刀・剣・武器
  {
    triggerKeywords: ['sword', 'katana', 'blade', 'weapon', 'sheath', '刀', '抜刀'],
    antiRepeatNegatives: [
      'holding katana', 'drawing sword pose', 'brandishing weapon', 'holding blade'
    ]
  },
  // 10. 扇子・うちわ
  {
    triggerKeywords: ['fan', 'folding fan', 'sensu', 'uchiwa', '扇子', '団扇'],
    antiRepeatNegatives: [
      'holding folding fan', 'waving fan', 'fan covering mouth', 'holding sensu'
    ]
  },
  // 11. ヘッドフォン・音楽機器
  {
    triggerKeywords: ['headphone', 'headphones', 'earphone', 'earphones', 'headset', 'ヘッドホン'],
    antiRepeatNegatives: [
      'wearing headphones around neck', 'adjusting headphones', 'listening with earphones'
    ]
  },
  // 12. 寄りかかり・手すり・壁
  {
    triggerKeywords: ['lean', 'leaning', 'railing', 'fence', 'against wall'],
    antiRepeatNegatives: [
      'leaning against wall', 'leaning on railing', 'slouching posture', 'leaning pose'
    ]
  },
  // 13. 頬杖・顔に手を当てる思索ポーズ
  {
    triggerKeywords: ['hand on chin', 'hand on cheek', 'thinking pose', 'chin in hand', 'resting chin', '頬杖'],
    antiRepeatNegatives: [
      'hand on chin pose', 'hand on cheek', 'touching face pose', 'resting chin on palm'
    ]
  },
  // 14. 振り返り・背後構図
  {
    triggerKeywords: ['turn', 'turning', 'behind', 'back view', 'looking back', 'shoulder'],
    antiRepeatNegatives: [
      'seen from behind', 'looking back over shoulder', 'back turned', 'rear view repetition'
    ]
  },
  // 15. 正面凝視・カメラ目線
  {
    triggerKeywords: ['front', 'facing camera', 'centered', 'eye contact', 'looking at viewer', 'looking at camera'],
    antiRepeatNegatives: [
      'facing front camera', 'identical front view', 'centered head-on angle', 'looking straight into camera', 'monotonous eye contact', 'mugshot stare'
    ]
  }
];

// ── 6. 各制作モード用特化テーマ定義 ─────────────────────────────────
import {
  MV_THEMES,
  TRIVIA_THEMES,
  QUOTES_THEMES,
  FOLKLORE_THEMES,
  CRAFT_THEMES
} from './themes';

export {
  MV_THEMES,
  TRIVIA_THEMES,
  QUOTES_THEMES,
  FOLKLORE_THEMES,
  CRAFT_THEMES
};
// ── 6.5. 制作モード・プラグイン統合オブジェクト (PRODUCTION_MODES_CONFIG) ─────
import type { ProductionMode } from '../types';

export interface ProductionModeConfig {
  value: ProductionMode;
  label: string;
  icon: string;
  badge: string;
  desc: string;
  telopNote: string;
  colorClass: string;
  cardTitle: string;
  cardIcon: string;
  themeLabel: string;
  unit: string;
  themes: string[];
  getDirectorRole: (isManga?: boolean, isHistorical?: boolean) => string;
  getContextTitle: (isManga?: boolean, isHistorical?: boolean) => string;
  promptInstructions: string;
}

export const PRODUCTION_MODES_CONFIG: Record<ProductionMode, ProductionModeConfig> = {
  episodes: {
    value: 'episodes',
    label: '🎬 ドラマ連番',
    icon: 'movie',
    badge: '映画字幕',
    desc: '重厚なストーリー連載（映画字幕フェード）',
    telopNote: '下部中央フェード・台詞没入重視',
    colorClass: 'border-white/20 bg-white/5 text-gray-200',
    cardTitle: 'Historical Intelligence Card',
    cardIcon: 'history_edu',
    themeLabel: 'テーマ',
    unit: '話',
    themes: [],
    getDirectorRole: (isManga, isHistorical) => isManga ? 'world-class comic/manga author and storyboard artist' : isHistorical ? 'world-class historical drama director' : 'world-class cinematic drama director',
    getContextTitle: (isManga, isHistorical) => isManga ? 'Comic Episode' : isHistorical ? 'Historical Drama Episode' : 'Drama Episode',
    promptInstructions: `CINEMATIC DRAMA DIRECTING:
1. Pacing & Continuity: Direct each cut with profound narrative progression and cinematic gravitas.
2. Dialogue & Narration: narrationJp MUST be gripping spoken dialogue or deep cinematic narration (20-30 characters per cut).
3. Highlights: Highlight 1 to 2 key terms driving emotional weight.`
  },
  manga: {
    value: 'manga',
    label: '📖 短編マンガ・読み切り (24Cut)',
    icon: 'auto_stories',
    badge: '1話完結',
    desc: '起承転結の24Cut短編マンガを一括自動プロデュース',
    telopNote: '漫画フキダシ・効果音・セリフ',
    colorClass: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200',
    cardTitle: 'Manga Episode Card',
    cardIcon: 'auto_stories',
    themeLabel: 'テーマ',
    unit: '話',
    themes: [],
    getDirectorRole: () => 'award-winning manga artist, comic storyboard director, and visual novel creator',
    getContextTitle: () => '24-Cut Manga Episode Sequence',
    promptInstructions: `24-CUT SHORT MANGA STORY DIRECTING:
1. Pacing & Structure (Four Acts):
   - Act 1 (Cut 1-6 / 起 - Introduction): Establish daily routine, character personalities, and the sudden inciting incident.
   - Act 2 (Cut 7-12 / 承 - Development): Investigation, journey, obstacle, and deeper character interaction.
   - Act 3 (Cut 13-18 / 転 - Crisis & Climax): Dramatic confrontation, shocking truth reveal, high-stakes battle or emotional clash.
   - Act 4 (Cut 19-24 / 結 - Resolution): Aftermath, heartfelt dialogue, sunset/dawn aftermath, and unforgettable ending hook.
2. Comic Paneling: Utilize cinematic comic panel compositions (close-ups for emotions, wide angles for impacts, dynamic perspective).
3. Dialogue & Highlights: Every cut must feature vivid manga dialogue or inner monologue in narrationJp.`
  },
  mv: {
    value: 'mv',
    label: '🎵 音楽MV',
    icon: 'music_note',
    badge: '全30カット',
    desc: 'Ado風キネティック対向スルー・ビート同期',
    telopNote: 'キネティック対向スルー・ネオン枠',
    colorClass: 'border-purple-500/30 bg-purple-950/40 text-purple-200',
    cardTitle: 'Music Video Concept Card',
    cardIcon: 'headphones',
    themeLabel: 'シチュエーション',
    unit: '曲',
    themes: MV_THEMES,
    getDirectorRole: () => 'world-class music video (MV) director and visual poet',
    getContextTitle: () => 'Music Video Sequence',
    promptInstructions: `MUSIC VIDEO (MV) CONTINUITY & LYRIC DIRECTING:
1. Seamless Visual Flow in the Same World:
This is an authentic music video sequence where the visual is a cinematic aesthetic backdrop to a song. Maintain a steady, atmospheric, nostalgic, or melancholic mood. The 12 cuts must form a seamless, cohesive visual universe.
2. AUTHENTIC SONG LYRICS:
CRITICAL: Do NOT write third-person scenery narration. Instead, narrationJp MUST be REAL EMOTIONAL SONG LYRICS as if sung by Ado, Yorushika, ZUTOMAYO, YOASOBI, or Vaundy!
- Cuts 1-3 (Verse A): Quiet restlessness, unvoiced emotions, solitary late night.
- Cuts 4-6 (Verse B): Rising tempo, running through the dusk, heartbeats accelerating.
- Cuts 7-9 (Chorus / Drop): Emotional climax, powerful punchy lyrical hooks!
- Cuts 10-12 (Outro / Epilogue): Lingering resonance, quiet dawn, resolved heartbeat.
3. Aesthetic Subtitle Highlights:
For EACH cut, select 1 to 2 key emotional words (which MUST be EXACTLY present in narrationJp) for the highlights array.`
  },
  trivia: {
    value: 'trivia',
    label: '💡 衝撃雑学Shorts',
    icon: 'lightbulb',
    badge: 'TikTok特化',
    desc: '冒頭フック＆オチ（画面中央フラッシュ）',
    telopNote: '画面中央超特大・ズームバウンス',
    colorClass: 'border-amber-500/40 bg-amber-950/40 text-amber-200',
    cardTitle: 'Trivia & Science Intelligence Card',
    cardIcon: 'lightbulb',
    themeLabel: '雑学テーマ',
    unit: '本',
    themes: TRIVIA_THEMES,
    getDirectorRole: () => 'viral YouTube Shorts/TikTok trivia creator and documentary director',
    getContextTitle: () => 'Trivia Shorts Sequence',
    promptInstructions: `VIRAL TRIVIA DIRECTING:
1. Pacing & Curiosity: Hook in Cut 1-2 with unbelievable curiosity/question. Explain the hidden scientific/historical truth in Cut 3-9. Deliver a mind-blowing punchline/conclusion in Cut 10-12.
2. Narration: narrationJp MUST be punchy Japanese trivia spoken commentary (18-25 chars per cut, engaging YouTube Shorts rhythm).
3. Gold Highlights: Highlight critical numbers, shocking facts, and core keywords.`
  },
  quotes: {
    value: 'quotes',
    label: '📜 偉人の名言・処方箋',
    icon: 'history_edu',
    badge: '保存特化',
    desc: '心に刺さる人生訓（厳粛な縦書き墨文字）',
    telopNote: '厳粛な縦書き／天吊り・静寂フェード',
    colorClass: 'border-teal-500/40 bg-teal-950/40 text-teal-200',
    cardTitle: 'Mastermind Wisdom Card',
    cardIcon: 'format_quote',
    themeLabel: '名言・人物',
    unit: '篇',
    themes: QUOTES_THEMES,
    getDirectorRole: () => 'philosophical essayist, master typographer, and quote archivist',
    getContextTitle: () => 'Quotes Shorts Sequence',
    promptInstructions: `PHILOSOPHICAL GREAT QUOTES DIRECTING:
1. Pacing: Cut 1-3 sets the emotional dilemma/anxiety of life. Cut 4-9 reveals the profound quote and wisdom. Cut 10-12 provides the healing conclusion/prescription to save.
2. Narration: narrationJp MUST be elegant, dignified, memorable quotes (格調高い名言・超訳処方箋).
3. Gold Highlights: Highlight the profound keyword that resonates in the heart.`
  },
  folklore: {
    value: 'folklore',
    label: '👻 怪異・未解決事件',
    icon: 'visibility',
    badge: '考察・恐怖',
    desc: '背筋凍る謎（不穏グリッチ・深紅文字）',
    telopNote: '不穏グリッチ・深紅ハイライト',
    colorClass: 'border-rose-900/60 bg-rose-950/50 text-rose-200',
    cardTitle: 'Occult & Folklore Intelligence Card',
    cardIcon: 'psychology',
    themeLabel: '怪異・伝説',
    unit: '話',
    themes: FOLKLORE_THEMES,
    getDirectorRole: () => 'investigative mystery storyteller and psychological suspense director',
    getContextTitle: () => 'Folklore Mystery Sequence',
    promptInstructions: `FOLKLORE & UNSOLVED MYSTERY DIRECTING:
1. Pacing: Cut 1-2 introduces the chilling historical incident/creepy lore. Cut 3-9 examines unsettling evidence and bizarre theories. Cut 10-12 poses an eerie open question provoking comments.
2. Narration: narrationJp MUST be suspenseful, atmospheric commentary evoking curiosity and goosebumps.
3. Gold Highlights: Highlight chilling evidence, dates, and ominous names.`
  },
  craft: {
    value: 'craft',
    label: '🏯 超絶技巧・職人魂',
    icon: 'handyman',
    badge: '神業和モダン',
    desc: '神の手を持つ職人技（凛とした伝統金文字）',
    telopNote: '凛とした伝統和モダン・金墨文字',
    colorClass: 'border-yellow-600/40 bg-yellow-950/40 text-yellow-200',
    cardTitle: 'Craftsmanship Spirit Card',
    cardIcon: 'precision_manufacturing',
    themeLabel: '伝統技術',
    unit: '作',
    themes: CRAFT_THEMES,
    getDirectorRole: () => 'master artisan documentarian and aesthetic visual poet',
    getContextTitle: () => 'Craft Documentary Sequence',
    promptInstructions: `SUPREME CRAFTSMAN DIRECTING:
1. Pacing: Cut 1-2 presents the raw pristine material. Cut 3-9 captures the mesmerizing precision handwork, micro-focus, and extreme dedication. Cut 10-12 reveals the sublime finished masterpiece.
2. Narration: narrationJp MUST be serene, reverent, and poetic, honoring the craftsman's devotion.
3. Gold Highlights: Highlight artisan terms, material names, and supreme techniques.`
  },
  'style-matrix': {
    value: 'style-matrix',
    label: '🎨 画風比較 (2枚)',
    icon: 'palette',
    badge: '自動比較',
    desc: '同一プロンプトで複数画風を一括検証（2枚固定）',
    telopNote: '画風比較（動画なし）',
    colorClass: 'border-pink-500/30 bg-pink-950/40 text-pink-200',
    cardTitle: 'Style Matrix Card',
    cardIcon: 'palette',
    themeLabel: 'テーマ',
    unit: '組',
    themes: [],
    getDirectorRole: () => 'world-class visual artist and art style comparison director',
    getContextTitle: () => 'Style Matrix Comparison',
    promptInstructions: `STYLE MATRIX COMPARISON DIRECTING:
Direct standardized prompt scenes for evaluating identical visual compositions across different art styles.`
  },
  manzai: {
    value: 'manzai',
    label: '🎙️ 漫才・掛け合い',
    icon: 'record_voice_over',
    badge: '演芸掛け合い',
    desc: 'テンポ良いボケ＆ツッコミの掛け合い劇',
    telopNote: 'ポップスライド・掛け合い吹き出し',
    colorClass: 'border-orange-500/30 bg-orange-950/40 text-orange-200',
    cardTitle: 'Manzai Dialogue Card',
    cardIcon: 'record_voice_over',
    themeLabel: 'テーマ・お題',
    unit: '本',
    themes: [],
    getDirectorRole: () => 'world-class comedic writer and dynamic dialogue director',
    getContextTitle: () => 'Manzai Dialogue Routine',
    promptInstructions: `MANZAI & COMEDIC DIALOGUE DIRECTING:
1. Pacing & Timing: Rapid-fire banter between two contrasting characters (Boke & Tsukkomi). Dynamic reaction shots and exaggerated expressions.
2. Dialogue: narrationJp MUST be crisp, rhythmic Japanese comedic dialogue with snappy punchlines.
3. Highlights: Highlight the punchline keywords, witty remarks, and sound effects.`
  }
};

export function getProductionModeConfig(mode?: string, isMvMode?: boolean): ProductionModeConfig {
  if (isMvMode) return PRODUCTION_MODES_CONFIG.mv;
  if (!mode || !(mode in PRODUCTION_MODES_CONFIG)) return PRODUCTION_MODES_CONFIG.episodes;
  return PRODUCTION_MODES_CONFIG[mode as ProductionMode];
}

export const PRODUCTION_MODES_LIST = Object.values(PRODUCTION_MODES_CONFIG);

export interface CineCameraRule {
  scale: string;
  tag: string;
  cameraWork: string;
  directive: string;
  antiPoseTokens: string[];
}

/**
 * YouTubeで天下を取る映画的10大カメラディレクションサイクル (Cine Director 10 Patterns)
 * （Google AIの中庸バイアスを強制破壊し、ドアップ・口元・手元・足元・煽り・ダッチ・超広角・俯瞰・横顔・象徴静物を極限の迫力で描画させる）
 */
export const UNIVERSAL_CINE_CYCLE: CineCameraRule[] = [
  // 1. Extreme Close-Up / 極限ドアップ・瞳と表情
  {
    scale: 'Extreme Close-Up',
    tag: '極限ドアップ・瞳',
    cameraWork: 'intimate-macro',
    directive: 'Ultra extreme macro close-up portrait cropped tightly at mid-forehead and chin, massive sparkling eyes dominating the canvas, intricate iris reflections, shallow depth of field with 100% blurred abstract bokeh, strictly tight face and emotive eyes only, absolutely NO full body, NO torso, NO legs, NO arms, NO visible outfit',
    antiPoseTokens: ['full body', 'torso', 'legs', 'feet', 'shoes', 'standing pose', 'seated pose', 'sitting', 'wide shot', 'medium shot', 'distant face', 'normal portrait', 'waist-up crop', 'stiff standing posture']
  },
  // 2. Low-Angle Footsteps / 足元・歩行・ローアングル (顔面アップから一気に足元へスイッチ)
  {
    scale: 'Low-Angle Footsteps',
    tag: '足元・踏み出し',
    cameraWork: 'low-angle-tilt-up',
    directive: 'Extreme ground-level low-angle worm-eye camera looking at footsteps, footwear or feet taking a resolute kinetic stride across the environmental terrain matching the scene setting, ground surface texture, dynamic cinematic motion, strictly ground and feet level',
    antiPoseTokens: ['face', 'portrait', 'upper body', 'chest-up', 'eyes', 'standard eye level', 'high angle', 'looking down']
  },
  // 3. Candid Medium Situation / 日常バストアップ・佇まい (自然な全身/上半身と背景の調和)
  {
    scale: 'Medium Bust Shot',
    tag: '日常シチュエーション',
    cameraWork: 'medium-push-in',
    directive: 'Candid medium atmospheric framing capturing authentic unposed posture within the scene, resting quietly or shifting weight thoughtfully, natural relaxed aesthetic, rich directional side chiaroscuro rim lighting, shallow depth of field',
    antiPoseTokens: ['stiff upright pose', 'facing camera rigidly', 'formal portrait', 'direct eye contact', 'extreme close-up of eyes']
  },
  // 4. Macro Mouth & Breath / 口元・表情・吐息のドアップ (曲の情感を宿す口元)
  {
    scale: 'Macro Mouth & Breath',
    tag: '口元・歌唱・吐息',
    cameraWork: 'intimate-macro',
    directive: 'Intimate macro close-up focusing tightly on parted expressive lips, chin, and throat, delicate kinetic breathing reflecting the emotional atmosphere, shallow depth of field with 100% blurred background, strictly lower face and lips only',
    antiPoseTokens: ['full body', 'legs', 'feet', 'shoes', 'wide shot', 'medium shot', 'full face', 'distant portrait', 'standing pose', 'eyes close-up']
  },
  // 5. Extreme Wide Landscape Panorama / 超広角・情景主役 (口元から一転、雄大な風景へ)
  {
    scale: 'Extreme Wide Panorama',
    tag: '超広角・情景主役',
    cameraWork: 'wide-establishing',
    directive: 'Grand panoramic environmental tableau where the vast grand environment, immense background scale, and sweeping atmospheric horizon overwhelm 90% of the canvas, character naturally integrated as a tiny distant miniature silhouette in the lower third, breathtaking spatial depth',
    antiPoseTokens: ['close-up', 'medium shot', 'prominent character in foreground', 'large face', 'dominant person in center', 'waist-up', 'chest-up', 'normal portrait']
  },
  // 6. Macro Hands & Gestures / 手元・指先のアクション (感情を宿す指先)
  {
    scale: 'Macro Hands & Gestures',
    tag: '手元・指先・仕草',
    cameraWork: 'macro-reveal',
    directive: 'Tactile extreme close-up macro focusing sharply on hands, fingers, and tactile gestures matching the character attire and setting, natural expressive kinetic movement, background softly blurred, strictly hands and tactile gesture only, NO face',
    antiPoseTokens: ['full face', 'eyes', 'portrait', 'full body', 'legs', 'feet', 'distant shot', 'standing pose', 'wide shot']
  },
  // 7. Dutch-Angle Diagonal Tilt / 傾き35度のダッチアングル・斜め構図
  {
    scale: 'Dutch-Angle Medium',
    tag: '斜め傾き・ダッチアングル',
    cameraWork: 'dutch-tilt',
    directive: 'Aggressively tilted 35-degree off-axis Dutch-angle camera framing, sharp kinetic diagonal lines slashing across the frame, off-kilter dynamic perspective creating palpable tension and emotional instability, stylish cinematic slant',
    antiPoseTokens: ['horizontal level frame', 'straight horizontal camera', 'level horizon', 'flat standard shot', 'vertical upright symmetry', 'level camera']
  },
  // 8. Medium Close-Up Profile / 完全真横90度・横顔・振り返り
  {
    scale: 'Medium Close-Up Profile',
    tag: '完全真横・プロファイル',
    cameraWork: 'cinematic-profile-pan',
    directive: 'Exact 90-degree horizontal side profile view halting mid-stride, poignant three-quarter view or turning head to glance back over shoulder with a bittersweet searching gaze, razor-sharp silhouette with brilliant directional rim lighting outlining hair and facial profile',
    antiPoseTokens: ['facing camera', 'front view', 'direct eye contact', 'centered portrait', 'front-facing character']
  },
  // 9. Overhead High-Angle Bird\'s-Eye / 真上75度俯瞰・影と幾何学
  {
    scale: 'Overhead High-Angle',
    tag: '真上俯瞰・影と幾何学',
    cameraWork: 'high-angle-tilt-down',
    directive: 'Steep overhead high-angle bird-eye view looking down from high vantage point at a 75-degree angle, emphasizing ground geometry, environmental textures, and long elongated dramatic shadows cast across the floor plane, unique top-down perspective',
    antiPoseTokens: ['eye-level shot', 'horizontal angle', 'looking up from below', 'worm-eye view', 'frontal portrait', 'standard eye level', 'horizontal eye contact']
  },
  // 10. Still-Life Key Prop / ★象徴アイテム・静物マクロ (OBJ・人物完全排除)
  {
    scale: 'Still-Life Object Macro',
    tag: '象徴アイテム・静物',
    cameraWork: 'macro-reveal',
    directive: 'Cinematic extreme close-up macro product still-life photography of an iconic symbolic keepsake object, resting quietly in ambient natural lighting, completely deserted scene with strictly NO humans, NO person, rich tactile texture, crisp specular reflections, and fine floating dust motes',
    antiPoseTokens: ['human', 'person', 'face', 'eyes', 'hands', 'body', 'crowd', 'portrait', 'girl', 'boy', 'man', 'woman', 'head', 'torso']
  }
];

// ── 7. 12カット・ストーリー展開プリセット（シネマ・漫画・音楽MV） ────────
export interface StoryShotPreset {
  scale: string;
  tag: string;
  cinematicAngle: string;
  mangaAngle: string;
  mvAngle: string;
}

export const TWELVE_CUT_STORYBOARD_PRESETS: StoryShotPreset[] = [
  {
    scale: 'Wide',
    tag: '引き・世界観',
    cinematicAngle: 'High-angle landscape view looking down from above, character is an active figure in the townscape / environmental setting, sweeping atmospheric background',
    mangaAngle: 'Massive full-bleed edge-to-edge opening splash illustration, grand world setting, extreme atmospheric depth, speed lines',
    mvAngle: 'Cinematic establishing wide landscape, atmospheric natural scenery, subject walking or standing naturally in the distance, gentle wind, beautiful natural light, serene music video opening'
  },
  {
    scale: 'Medium',
    tag: '佇まい・アンニュイ',
    cinematicAngle: 'Dramatic low-angle worm\'s-eye view looking up from below, intense cinematic perspective showing head and shoulders firmly grounded, dynamic sky background',
    mangaAngle: 'Intense macro eye close-up filling the frame, heavy screen tones, speed lines radiating, dramatic monologue expression, borderless',
    mvAngle: 'Relaxed medium shot, subject in contemplative quiet pose, looking away calmly, soft natural rim lighting, unposed candid aesthetic'
  },
  {
    scale: 'Close-up',
    tag: '情緒的ディテール',
    cinematicAngle: 'Looking back over the shoulder while walking away, dynamic three-quarter view, candid emotional glance',
    mangaAngle: 'Webtoon style vertical flow, character in mid-action, dynamic diagonal angle, bold SFX onomatopoeia, full-bleed composition',
    mvAngle: 'Artistic detail close-up, focusing on hands, feet walking, gently swaying grass, or atmospheric texture, emotional shallow depth of field'
  },
  {
    scale: 'Wide',
    tag: '逆光・光の移ろい',
    cinematicAngle: 'Cinematic wide horizontal shot, street-level atmospheric perspective with environment and props, character interacting with setting',
    mangaAngle: 'Establishing shot with detailed pen-and-ink architecture, deep shadows, cinematic comic perspective, full-bleed edge-to-edge',
    mvAngle: 'Wide horizontal shot with golden hour backlight or moody dusk glow, warm rim illumination, quiet environmental harmony'
  },
  {
    scale: 'Medium',
    tag: '後ろ姿・風情',
    cinematicAngle: 'Dutch tilt angled close-up, dramatic diagonal framing focusing on eyes and expression',
    mangaAngle: 'Dutch tilt angular composition, character reacting with intense emotional distortion, bold line art, borderless',
    mvAngle: 'Over-the-shoulder or three-quarter back view, hair and clothes gently swaying in the breeze, gazing into the vast open horizon'
  },
  {
    scale: 'Close-up',
    tag: '伏し目・静寂',
    cinematicAngle: 'Low-angle medium shot looking up towards character standing strong, solid upper body posture',
    mangaAngle: 'Dramatic high-contrast cel-shaded lighting, character holding a decisive standing pose, speed lines, full-bleed',
    mvAngle: 'Gentle side profile close-up, downcast tranquil gaze, subtle melancholic expression, soft cinematic bokeh, quiet emotion'
  },
  {
    scale: 'Wide',
    tag: '風景・呼吸感',
    cinematicAngle: 'High-angle downward view from balcony or hill, character walking naturally among townspeople on the ground',
    mangaAngle: 'Sweeping manga double-page spread style, multiple focal points, epic environmental scale, detailed crosshatching, borderless edge-to-edge',
    mvAngle: 'Expansive environmental composition, subject integrated as a small harmonious part of the scenery, vast sky, breathing space'
  },
  {
    scale: 'Medium',
    tag: '小休止・自然体',
    cinematicAngle: 'Over-the-shoulder perspective looking past the character towards the scene ahead, tense atmosphere',
    mangaAngle: 'Intense standoff over-the-shoulder framing, heavy tension, screentone gradients, dramatic shadows, full-bleed',
    mvAngle: 'Casual candid medium framing, pausing naturally, sitting peacefully or leaning gently, neutral serene vibe, no dramatic tension'
  },
  {
    scale: 'Close-up',
    tag: 'マクロ・テクスチャ',
    cinematicAngle: 'Side profile close-up silhouette with warm lantern rim light, dramatic lighting',
    mangaAngle: 'Extreme close-up on mouth/jaw with gritted teeth, heavy inking, dramatic stylized emotion, borderless',
    mvAngle: 'Atmospheric macro focus, dappled sunlight, soft shadows, raindrops, or gentle light leak reflection, evocative visual texture'
  },
  {
    scale: 'Medium',
    tag: '歩き出し・流れる時',
    cinematicAngle: 'Centered cinematic medium portrait, dramatic side-lighting, dignified cinematic presence',
    mangaAngle: 'Dynamic leaping/running action, extreme foreshortening, kinetic speed lines, borderless edge-to-edge artwork',
    mvAngle: 'Smooth moving perspective, walking forward at a gentle pace, natural relaxed gait, candid indie music video frame'
  },
  {
    scale: 'Close-up',
    tag: 'アンニュイ表情',
    cinematicAngle: 'Macro emotional close-up capturing intense gaze and lip expression',
    mangaAngle: 'Tearful or highly emotional character face, glowing eyes, fine delicate line art, emotional screentones, borderless',
    mvAngle: 'Subtle expressive close-up, calm peaceful face, soft diffused ambient lighting, neutral gentle aura, serene beauty'
  },
  {
    scale: 'Wide',
    tag: '余韻・アウトロ',
    cinematicAngle: 'Epic wide cinematic climax view, panoramic environmental composition',
    mangaAngle: 'Cinematic climax splash artwork, full environment integration, spectacular pen and ink mastery, full-bleed borderless',
    mvAngle: 'Epic serene wide lingering view, subject melting into the vast landscape, fading twilight, timeless poetic stillness'
  }
];

// ── 7. 基本ネガティブプロンプト規約 ────────────────────────────────────
export const BASELINE_NEGATIVE_TOKENS = {
  anatomicalIntegrity: 'giant, giantess, floating head, severed body, floating torso, half body cut off by scenery, scale error, diorama, simple mugshot, bad anatomy, deformed fingers',
  antiReferenceStiffness: 'identical pose as reference image, repeating reference image pose, static mugshot pose, repeating reference angle',
  antiAnachronisms: 'modern clothing, wristwatch, eyeglasses, sneakers, smartphone, headphones, electricity pole, asphalt road',
  antiFrameAndBorder: 'frame, border, picture frame, ornate frame, arch frame, decorative border, white border, white margin, white gutter, paper margin, comic panel outline, panel border, outer frame, blank edge, cropped border, boxed layout, empty spacing',
  renderingQuality: 'lowres, worst quality, text, subtitles, closed captions, caption bar, caption banner, speech bubbles, dialog box, Japanese characters, kanji subtitles, news ticker, text overlay, title text, watermark, signature, blurry, artifact, jpeg artifacts, poorly rendered'
};

// ── 8. テロップ演出（Webtoon静止画向け固定デフォルト） ──────────
import { TelopStyle, TelopTransition, TelopPosition } from '../types';

export function resolveRecommendedTelopStaging(
  _cutId?: number, 
  _isMvMode?: boolean, 
  _isHistorical?: boolean,
  _prevStaging?: any,
  _mode?: string
): {
  style: TelopStyle;
  transition: TelopTransition;
  position: TelopPosition;
  directorNote: string;
} {
  return {
    style: 'cinema-subtle',
    transition: 'aos-fade-soft',
    position: 'bottom-center',
    directorNote: '[Webtoon字幕] 下部中央配置'
  };
}
