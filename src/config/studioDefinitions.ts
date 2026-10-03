import { KenBurnsPreset, VideoModelType } from '../types';

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
    id: 'banana-2-lite', 
    name: '🍌 Nano Banana 2 Lite', 
    label: '🍌 2 Lite（超爆速 / 0pt）', 
    description: '下書き・大量プレビュー確認向け' 
  },
  { 
    id: 'banana-2', 
    name: '🍌 Nano Banana 2', 
    label: '🍌 Banana 2（高速・高画質 / 0pt）★推奨', 
    description: '速度と描画精度のバランスが最も優れた標準モデル',
    isDefault: true
  },
  { 
    id: 'banana-pro', 
    name: '🍌 Nano Banana Pro', 
    label: '🍌 Banana Pro（最高峰シネマ / 0pt）', 
    description: '圧倒的ディテールとライティング。キメカット向け' 
  }
];

export function resolveImageModel(keyOrLabel?: string): ImageModelDefinition {
  const defaultModel = IMAGE_MODELS_REGISTRY.find(m => m.isDefault) || IMAGE_MODELS_REGISTRY[1];
  if (!keyOrLabel) return defaultModel;
  return IMAGE_MODELS_REGISTRY.find(m => m.id === keyOrLabel || m.label === keyOrLabel || m.name === keyOrLabel) || defaultModel;
}

// ── 2. 動画生成モデル定義 ─────────────────────────────────────────────
export interface VideoModelDefinition {
  id: VideoModelType;
  name: string;
  label: string;
  defaultDuration: number;
  costPoints: number;
  isDefault?: boolean;
}

export const VIDEO_MODELS_REGISTRY: VideoModelDefinition[] = [
  { 
    id: 'veo-lite', 
    name: 'Veo 3.1 - Lite', 
    label: 'Veo 3.1 Lite（8秒 / 5pt）★コスパ最強', 
    defaultDuration: 8, 
    costPoints: 5,
    isDefault: true 
  },
  { 
    id: 'omni-flash', 
    name: 'Omni 1.1 Flash', 
    label: 'Omni 1.1 Flash（4秒 / 15pt）⚡高速', 
    defaultDuration: 4, 
    costPoints: 15 
  },
  { 
    id: 'veo-fast', 
    name: 'Veo 3.1 - Fast', 
    label: 'Veo 3.1 Fast（8秒 / 10pt）🚀高速シネマ', 
    defaultDuration: 8, 
    costPoints: 10 
  }
];

export function resolveVideoModel(idOrName?: string): VideoModelDefinition {
  const defaultModel = VIDEO_MODELS_REGISTRY.find(m => m.isDefault) || VIDEO_MODELS_REGISTRY[0];
  if (!idOrName) return defaultModel;
  return VIDEO_MODELS_REGISTRY.find(m => m.id === idOrName || m.name === idOrName || m.label === idOrName) || defaultModel;
}

// ── 3. カメラワーク・カメラモーション定義 ──────────────────────────────
export interface CameraWorkDefinition {
  id: string;
  label: string;
  motionPrompt: string;
  recommendedKenBurns: KenBurnsPreset;
}

export const CAMERA_WORK_REGISTRY: CameraWorkDefinition[] = [
  { 
    id: 'static', 
    label: '固定（フィックス）', 
    motionPrompt: 'Static camera, perfectly still cinematic frame, stable perspective',
    recommendedKenBurns: 'none'
  },
  { 
    id: 'zoom-in', 
    label: 'ゆっくりズームイン', 
    motionPrompt: 'Slow cinematic zoom in towards the subject, dramatic emotional tension',
    recommendedKenBurns: 'zoom-in'
  },
  { 
    id: 'zoom-out', 
    label: 'ゆっくりズームアウト', 
    motionPrompt: 'Slow cinematic zoom out revealing the expansive atmosphere and surrounding environment',
    recommendedKenBurns: 'zoom-out'
  },
  { 
    id: 'pan-left', 
    label: 'パン（左へ流す）', 
    motionPrompt: 'Smooth horizontal camera pan movement from right to left',
    recommendedKenBurns: 'pan-left'
  },
  { 
    id: 'pan-right', 
    label: 'パン（右へ流す）', 
    motionPrompt: 'Smooth horizontal camera pan movement from left to right',
    recommendedKenBurns: 'pan-right'
  },
  { 
    id: 'tilt-up', 
    label: 'ティルト（見上げる）', 
    motionPrompt: 'Slow cinematic vertical camera tilt moving upwards towards the sky',
    recommendedKenBurns: 'tilt-up'
  },
  { 
    id: 'tilt-down', 
    label: 'ティルト（見下ろす）', 
    motionPrompt: 'Slow cinematic vertical camera tilt moving downwards from overhead',
    recommendedKenBurns: 'tilt-down'
  },
  { 
    id: 'handheld', 
    label: '手持ち風（微細な揺れ）', 
    motionPrompt: 'Realistic handheld camera style, subtle organic breathing camera shake, cinema verite realism',
    recommendedKenBurns: 'zoom-in'
  },
  { 
    id: 'tracking', 
    label: '被写体を追従（トラッキング）', 
    motionPrompt: 'Dynamic camera tracking shot smoothly following the character in motion',
    recommendedKenBurns: 'pan-left'
  }
];

export function resolveCameraWork(labelOrMotion?: string): CameraWorkDefinition {
  if (!labelOrMotion) return CAMERA_WORK_REGISTRY[0];
  return CAMERA_WORK_REGISTRY.find(c => c.label === labelOrMotion || c.motionPrompt === labelOrMotion || c.id === labelOrMotion) || CAMERA_WORK_REGISTRY[0];
}

/**
 * 制作モード（全7ジャンル）の特性に応じた最適なカメラワーク＆ケンバーン演出を算出
 */
export function resolveRecommendedCameraWorkAndKenBurns(
  cutId: number,
  mode?: string,
  isMvMode?: boolean,
  isMangaMode?: boolean
): CameraWorkDefinition {
  // 1. 漫画モード（isMangaMode）または画風比較（style-matrix）：完全固定（ブレ防止）
  if (isMangaMode || mode === 'style-matrix') {
    return resolveCameraWork('static');
  }

  // 2. 📜 偉人の名言・処方箋（quotes）：文字可読性と厳粛な静寂を優先し「固定（フィックス）」
  if (mode === 'quotes') {
    return resolveCameraWork('static');
  }

  // 3. 💡 衝撃雑学Shorts（trivia）：冒頭2秒のフックとインパクト重視（ズームイン主体）
  if (mode === 'trivia') {
    const triviaPool = ['zoom-in', 'zoom-in', 'pan-left', 'tilt-up', 'zoom-in'];
    const cwId = triviaPool[(cutId - 1) % triviaPool.length];
    return resolveCameraWork(cwId);
  }

  // 4. 👻 怪異・未解決事件（folklore）：不穏なスロー移動・見上げるチルト
  if (mode === 'folklore') {
    const folklorePool = ['zoom-in', 'tilt-up', 'pan-left', 'zoom-in', 'tilt-down', 'pan-right'];
    const cwId = folklorePool[(cutId - 1) % folklorePool.length];
    return resolveCameraWork(cwId);
  }

  // 5. 🏯 超絶技巧・職人魂（craft）：手元へのクローズアップ・作品鑑賞パン・仰ぐチルト
  if (mode === 'craft') {
    const craftPool = ['zoom-in', 'pan-right', 'tilt-up', 'zoom-in', 'pan-left', 'zoom-out'];
    const cwId = craftPool[(cutId - 1) % craftPool.length];
    return resolveCameraWork(cwId);
  }

  // 6. 🎵 音楽MVモード（mv）：楽曲パート展開連動（Aメロ＝静寂・導入、Bメロ＝空間変化・加速、サビ＝最高潮・ダイナミック寄り、アウトロ＝余韻）
  if (isMvMode || mode === 'mv') {
    const normCut = ((cutId - 1) % 12) + 1;
    let cwId = 'zoom-in';
    if (normCut <= 3) {
      // Verse A（静寂・導入）: 緩やかなパン・チルト・ズーム
      const vA = ['pan-left', 'tilt-up', 'zoom-in'];
      cwId = vA[(normCut - 1) % vA.length];
    } else if (normCut <= 6) {
      // Verse B（空間変化・加速）: 右パン・チルトダウン・ズームイン
      const vB = ['pan-right', 'tilt-down', 'zoom-in'];
      cwId = vB[(normCut - 4) % vB.length];
    } else if (normCut <= 9) {
      // Chorus ★（最高潮・サビ）: ダイナミックなズームイン・ズームアウト
      const vCh = ['zoom-in', 'zoom-out', 'zoom-in'];
      cwId = vCh[(normCut - 7) % vCh.length];
    } else {
      // Outro（余韻・終幕）: 引きのズームアウト・パン・静寂
      const vOut = ['zoom-out', 'pan-left', 'zoom-out'];
      cwId = vOut[(normCut - 10) % vOut.length];
    }
    return resolveCameraWork(cwId);
  }

  // 7. 🎬 ドラマ連番モード（episodes / デフォルト）: 映画的感情曲線ローテーション
  const dramaPool = ['zoom-in', 'pan-left', 'zoom-out', 'tilt-up', 'zoom-in', 'pan-right'];
  const cwId = dramaPool[(cutId - 1) % dramaPool.length];
  return resolveCameraWork(cwId);
}


// ── 4. 構図スケール＆直前カット対比ルール定義（Rule-based Contrast） ─────
export interface ShotScaleDefinition {
  scale: string;
  tag: string;
  cinematicAngle: string;
  mangaAngle: string;
  // この構図が直前に使われた場合に次カットへ自動注入されるネガティブワード
  antiRepeatNegatives: string[];
  // 直前がこの構図だった場合に推奨される対比スケール候補
  suggestedContrastScales: string[];
}

export const SHOT_SCALE_REGISTRY: Record<string, ShotScaleDefinition> = {
  'Wide': {
    scale: 'Wide',
    tag: '引き・世界観',
    cinematicAngle: 'Cinematic wide horizontal shot, street-level atmospheric perspective with environment and props',
    mangaAngle: 'Establishing shot with detailed pen-and-ink architecture, deep shadows, cinematic comic perspective, full-bleed edge-to-edge',
    antiRepeatNegatives: [
      'extreme wide shot', 'distant landscape', 'tiny distant character', 
      'bird eye view', 'panoramic wide shot', 'distant miniature figure'
    ],
    suggestedContrastScales: ['Close-up', 'Medium']
  },
  'Close-up': {
    scale: 'Close-up',
    tag: '迫真アップ',
    cinematicAngle: 'Dramatic low-angle worm\'s-eye view looking up from below, intense cinematic perspective showing head and shoulders firmly grounded, dynamic sky background',
    mangaAngle: 'Intense macro eye close-up filling the frame, heavy screen tones, speed lines radiating, dramatic monologue expression, borderless',
    antiRepeatNegatives: [
      'extreme close-up', 'macro face', 'zoomed-in headshot', 
      'cropped face filling screen', 'tight headshot portrait'
    ],
    suggestedContrastScales: ['Wide', 'Medium', 'Splash']
  },
  'Medium': {
    scale: 'Medium',
    tag: '上半身・対峙',
    cinematicAngle: 'Looking back over the shoulder while walking away, dynamic three-quarter view, candid emotional glance',
    mangaAngle: 'Dramatic high-contrast cel-shaded lighting, character holding a dynamic combat or decisive standing pose, speed lines, full-bleed',
    antiRepeatNegatives: [
      'standard medium shot', 'static bust portrait', 'waist-up centered portrait', 
      'neutral mid-shot'
    ],
    suggestedContrastScales: ['Close-up', 'Wide']
  },
  'Splash': {
    scale: 'Splash',
    tag: '見開き大ゴマ',
    cinematicAngle: 'Epic wide cinematic climax view, panoramic environmental composition',
    mangaAngle: 'Massive full-bleed edge-to-edge illustration, dynamic character pose breaking across the entire screen, extreme impact, borderless, speed lines',
    antiRepeatNegatives: [
      'splash double spread', 'extreme wide environmental view', 'distant panoramic landscape'
    ],
    suggestedContrastScales: ['Close-up', 'Medium']
  }
};

// ── 5. アクション・姿勢の対比ルール（Pose Contrast Rule） ─────────────
export const POSE_CONTRAST_RULES: Array<{
  triggerKeywords: string[];
  antiRepeatNegatives: string[];
}> = [
  {
    triggerKeywords: ['sit', 'sitting', 'floor', 'ground', 'tatami', 'cross-legged', 'seated'],
    antiRepeatNegatives: [
      'sitting on floor', 'sitting down', 'seated', 'crossed legs', 
      'kneeling', 'squatting', 'floor sitting pose', 'looking up from floor', 
      'sitting on tatami', 'floor seating posture'
    ]
  },
  {
    triggerKeywords: ['stand', 'standing', 'stiff', 'upright'],
    antiRepeatNegatives: [
      'stiff standing pose', 'static upright standing', 'motionless standing'
    ]
  },
  {
    triggerKeywords: ['walk', 'walking', 'run', 'running'],
    antiRepeatNegatives: [
      'walking away repetition', 'running pose repetition'
    ]
  }
];

// ── 6. 各制作モード用特化テーマ定義（各10選） ──────────────────────
export const MV_THEMES = [
  '🌿 草原の風と夕暮れ（あてもなく歩く帰り道・揺れる草木と黄金の光）',
  '☕ 雨の日の純喫茶（曇った窓ガラス・温かい珈琲の湯気・静かな読書）',
  '🌃 深夜2時の部屋（薄暗い間接照明・青白いPC画面・ベッドサイドのチル）',
  '🚗 都会の夜間ドライブ（雨に濡れた高速道路・流れるテールランプ・首都高）',
  '🏖️ 誰もいない晩夏の砂浜（静かに寄せては返す波・夕凪・足跡）',
  '🚉 夕暮れのローカル線無人駅（吹き抜ける風・夕日差すベンチ・遠い鉄橋）',
  '🌆 ビルの屋上・街を見下ろす微風（茜色から紫へのマジックアワー・佇む背中）',
  '🏙️ 霧が立ち込める早朝の街（まだ誰もいない静まり返った交差点・朝露）',
  '🌌 満天の星空と焚き火（静寂の森・揺らめく小さな炎・火の粉と夜空）',
  '🎨 木漏れ日のアトリエ（白いカーテンの揺れ・散らかったパレット・午後の光）'
];

export const TRIVIA_THEMES = [
  '💡 9割が知らない江戸時代の夜のトイレ事情（実は世界一エコだった真実）',
  '⚔️ 戦国武将が一番恐れていた「意外すぎる死因」（討ち死により多い病の闇）',
  '🍙 コンビニのおにぎりが常温でも腐らない科学のウラと歴史',
  '💰 バブル狂乱・タクシーを1万円札で止めた男たちの悲惨な末路',
  '🍣 江戸前寿司のワサビは「防腐剤」ではなく〇〇隠しだった話',
  '📜 教科書が教えない徳川家康の「究極のケチ伝説と健康オタク」',
  '🚂 明治の陸蒸気・煙を吸うと早死にすると信じた人々の大パニック',
  '🏯 参勤交代で大名が破産寸前？宿場町で繰り広げられた借金地獄',
  '🏃‍♂️ 江戸の飛脚が東京〜京都を3日で走れた「ナンバ走り」の驚異',
  '📻 戦後の闇市で「謎の缶詰」を食べた人々に起きた怪奇現象'
];

export const QUOTES_THEMES = [
  '🪷 ブッダが語る「どうでもいい人間関係」を一瞬で断ち切る処方箋',
  '🦅 ニーチェが説いた「孤独を愛せる人」が最後に圧倒的に勝つ理由',
  '⚔️ 織田信長が遺した「裏切り者に下す冷酷にして合理的な決断」',
  '☕ 太宰治が泥酔の果てに呟いた「愛されることの重荷と絶望の美学」',
  '🗡️ 宮本武蔵「五輪書」・迷いを断ち切るための冷徹な勝負哲学',
  '🏛️ 古代ローマ皇帝マルクス・アウレリウス「他人の悪意に動じるな」',
  '🍵 千利休「侘び寂び」の極意・贅沢を捨てた者が手にする絶対的自由',
  '👑 坂本龍馬「世の人は我を何とも言わば言え」・規格外の生き方',
  '🖋️ 芥川龍之介「ぼんやりとした不安」・繊細すぎる魂の叫び',
  '🏮 勝海舟「行いは己のもの、批判は他人のもの」・器の大きさの極意'
];

export const FOLKLORE_THEMES = [
  '🏚️ 明治三十年・一夜にして地図から消滅した「名無しの村」の怪異',
  '🗡️ 江戸の辻斬り・雨の夜にだけ現れる「顔のない浪人」の正体',
  '🏥 昭和の廃病院・封印された地下カルテに記された「被験者0号」',
  '⛩️ 絶対に振り返ってはいけない山奥の鳥居と、あるマタギの遺言',
  '🎭 大正の浅草・見世物小屋から忽然と消えた「木乃伊の少女」',
  '🌊 日本海を漂流した無人船・船長室に残された不可解な日記',
  '📜 古文書に墨塗りで隠された「ある大名家の世継ぎ怪死事件」',
  '🚂 深夜の終電・決して降りてはいけない「存在しない駅」の都市伝説',
  '🌾 飢饉の冬・村人全員が笑顔で餓死した不気味な豊作祈願の謎',
  '🕳️ 東京の地下深く・戦時中に掘られたまま放置された防空壕の奥'
];

export const CRAFT_THEMES = [
  '🪵 1000年倒れない五重塔・釘を1本も使わない宮大工の奇跡',
  '🗡️ 名刀・正宗の刃文・現代科学でも再現不可能な焼き入れの宇宙',
  '🍣 銀座の寿司職人・シャリを握る「わずか3秒」に宿る極致の技',
  '🥢 輪島塗の100年輝く漆器・120工程を素手で磨き上げる執念',
  '👘 西陣織の極細金糸・肉眼の限界を超えて織り成す幻の文様',
  '⚒️ 江戸切子の硝子職人・下書きなしでダイヤモンドを削り出す勘',
  '🍵 茶道・千利休が求めた「究極の茶碗」を生み出す土と炎の対話',
  '🔥 日本刀のたたら製鉄・三日三晩眠らずに炎を見守る村下の眼力',
  '🪓 樹齢千年の屋久杉を伐り出す山師・木の声を聞く掟と美学',
  '🍱 曲げわっぱ・杉の板を湯気で曲げる「0.1ミリの指先の記憶」'
];

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
  mv: {
    value: 'mv',
    label: '🎵 音楽MV (12カット)',
    icon: 'music_note',
    badge: '全12カット',
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
  }
};

export function getProductionModeConfig(mode?: string, isMvMode?: boolean): ProductionModeConfig {
  if (isMvMode) return PRODUCTION_MODES_CONFIG.mv;
  if (!mode || !(mode in PRODUCTION_MODES_CONFIG)) return PRODUCTION_MODES_CONFIG.episodes;
  return PRODUCTION_MODES_CONFIG[mode as ProductionMode];
}

export const PRODUCTION_MODES_LIST = Object.values(PRODUCTION_MODES_CONFIG);

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
  renderingQuality: 'lowres, worst quality, text, watermark, signature, blurry, artifact, jpeg artifacts, poorly rendered'
};

// ── 8. Vook風テロップ演出スタイル＆トランジション定義 ──────────────────────
import { TelopStyle, TelopTransition, TelopPosition } from '../types';

export interface TelopStyleDefinition {
  id: TelopStyle;
  name: string;
  description: string;
  badgeColor: string;
  defaultTransition: TelopTransition;
  defaultPosition: TelopPosition;
}

export const TELOP_STYLE_REGISTRY: TelopStyleDefinition[] = [
  {
    id: 'mv-blur-slide',
    name: 'ブラースライド (Vook高速演出)',
    description: '方向性ブラーと急減速イージングで滑らかに流し込むプロ仕様MV演出',
    badgeColor: '#00E5FF',
    defaultTransition: 'blur-slide-left',
    defaultPosition: 'bottom-left'
  },
  {
    id: 'mv-kinetic-pop',
    name: 'キネティック・タイポ (Ado / リリック躍動)',
    description: '単語ごとにスタッガーで跳ね上がり、強調語を巨大化させる段違いダイナミック演出',
    badgeColor: '#FFE600',
    defaultTransition: 'zoom-in-bounce',
    defaultPosition: 'center-stagger'
  },
  {
    id: 'mv-neon-glow',
    name: 'ネオングロー (夜景・サイバー)',
    description: '光彩拡散ブラーと多重グローで、暗がりや夜景にエモーショナルに溶け込む演出',
    badgeColor: '#FF2E93',
    defaultTransition: 'glow-fade',
    defaultPosition: 'bottom-center'
  },
  {
    id: 'cinema-subtle',
    name: 'シネマティック・ミニマル (静寂・AOS風)',
    description: '半透明グラスモーフィズムプレートと繊細な字間による上品な映画字幕演出',
    badgeColor: '#A78BFA',
    defaultTransition: 'aos-fade-soft',
    defaultPosition: 'bottom-center'
  },
  {
    id: 'brush-impact',
    name: '墨文字・ド迫力インパクト (時代劇・覚醒)',
    description: '極太フォントと力強い縁取りで、一撃の重みと気迫を伝える大河ドラマ演出',
    badgeColor: '#F59E0B',
    defaultTransition: 'blur-slide-right',
    defaultPosition: 'bottom-center'
  },
  {
    id: 'mv-vertical-lyric',
    name: 'エモ縦書きリリック (Eve/ヨルシカ・和モダン)',
    description: 'サイドバーに繊細に流れる縦書きタイポグラフィ。視線を遮らず余白を美しく魅せる',
    badgeColor: '#34D399',
    defaultTransition: 'aos-fade-soft',
    defaultPosition: 'vertical-right'
  },
  {
    id: 'mv-center-climax',
    name: '画面中央クライマックス (サビ・GSAP特大炸裂)',
    description: 'サビの決めフレーズを画面中央にズドンと炸裂させる最大インパクト演出',
    badgeColor: '#EC4899',
    defaultTransition: 'animista-slide-bck',
    defaultPosition: 'center-climax'
  }
];

export interface TelopTransitionDefinition {
  id: TelopTransition;
  name: string;
  description: string;
  icon: string;
}

export const TELOP_TRANSITION_REGISTRY: TelopTransitionDefinition[] = [
  { id: 'animista-slide-bck', name: 'Animista奥からズームイン (slide-bck)', description: '3D空間の奥から手前にグッと飛び込む迫真モーション', icon: 'filter_tilt_shift' },
  { id: 'gsap-kinetic-stagger', name: 'GSAP急減速スタッガー (呼吸＆残像)', description: '初速最速・終速ピタ止めと微細な呼吸フローティング', icon: 'speed' },
  { id: 'aos-fade-soft', name: 'AOS上品ソフトフェード (静寂・映画風)', description: '繊細な浮遊感とソフトな透過で情景を邪魔しない', icon: 'opacity' },
  { id: 'blur-slide-left', name: '左からブラースライド (Vook高速)', description: '左から横ブラーを伴い高速スライドイン', icon: 'arrow_forward' },
  { id: 'blur-slide-up', name: '下からブラースライド', description: '下から縦ブラーを伴いフワッと飛び込み', icon: 'arrow_upward' },
  { id: 'blur-slide-right', name: '右からブラースライド', description: '右から駆け抜けるようにスライドイン', icon: 'arrow_back' },
  { id: 'zoom-in-bounce', name: 'ズームイン・バウンス', description: '飛び込んで軽く弾むリズミカルな登場', icon: 'fit_screen' },
  { id: 'glow-fade', name: 'ネオン・グローフェード', description: '光の粒子がにじみ出るように静かに発光', icon: 'flare' },
  { id: 'glitch-pop', name: 'グリッチ・カットイン', description: 'デジタルなカットインで瞬時に切り替え', icon: 'bolt' }
];

export interface TelopPositionDefinition {
  id: TelopPosition;
  name: string;
  description: string;
  icon: string;
}

export const TELOP_POSITION_REGISTRY: TelopPositionDefinition[] = [
  { id: 'bottom-left', name: '下部左寄り (左始まり・ステアステップ)', description: '左下から階段状にリズミカルに並ぶ現代MV風レイアウト', icon: 'align_horizontal_left' },
  { id: 'bottom-right', name: '下部右寄り (右付け・ステアステップ)', description: '右下から内側へ階段状に引き締める端正な右寄せレイアウト', icon: 'align_horizontal_right' },
  { id: 'top-cinema', name: '上部シネマ (空・天井天吊り)', description: '下部・中央のメイン被写体を避け、上空の余白に上品に浮遊', icon: 'vertical_align_top' },
  { id: 'vertical-right', name: '右サイド縦書き (和モダン・エモ)', description: '画面右端に縦書きで流すヨルシカ・Eve風の洗練デザイン', icon: 'format_textdirection_r_to_l' },
  { id: 'vertical-left', name: '左サイド縦書き (雑誌・アンニュイ)', description: '画面左端に縦書きで流す叙情的なタイポグラフィ', icon: 'format_textdirection_l_to_r' },
  { id: 'bottom-center', name: '下部中央 (安定・映画字幕)', description: '最も視認性が高くどんなシーンにも馴染む王道字幕配置', icon: 'align_horizontal_center' }
];

export function resolveTelopStyle(styleId?: string): TelopStyleDefinition {
  return TELOP_STYLE_REGISTRY.find(s => s.id === styleId) || TELOP_STYLE_REGISTRY[0];
}

export function resolveTelopTransition(transId?: string): TelopTransitionDefinition {
  return TELOP_TRANSITION_REGISTRY.find(t => t.id === transId) || TELOP_TRANSITION_REGISTRY[0];
}

export function resolveTelopPosition(posId?: string): TelopPositionDefinition {
  return TELOP_POSITION_REGISTRY.find(p => p.id === posId) || TELOP_POSITION_REGISTRY[0];
}

/**
 * カット番号と世界観に基づいてディレクターの推奨テロップ演出を解決
 * 【鉄則ルール】
 * 1. 2回連続で同じ出し方（トランジション）・同じ配置が出ない完全Anti-Repeat制御
 * 2. 画面中央（メイン被写体）を覆い隠さないため、中央配置を排除し「左始まり」「右付け」「上部」「縦書き」に展開
 * 3. ユーザー絶賛の「左寄りの左始まり」と「右寄りの右付け」をテンポよく交互に展開
 */
/**
 * カット番号、楽曲構造、直前カット情報に基づいて動的に演出を生成する「無限バリエーションAIディレクター」
 * 【数千本の量産に耐える完全ランダム × 音楽構造連動エンジン】
 * 1. 画面中央（メイン被写体）を覆い隠さない安全レイアウト（下部左、下部右、上部、縦書き）
 * 2. 直前カットの「出し方（トランジション）」と「配置構図」を100%除外するAnti-Repeat保証
 * 3. 楽曲パート（Aメロ＝静、Bメロ＝変、サビ＝動★、アウトロ＝余韻）の情緒と盛り上がりを確実に維持
 */
export function resolveRecommendedTelopStaging(
  cutId: number, 
  isMvMode?: boolean, 
  isHistorical?: boolean,
  prevStaging?: { transition?: TelopTransition; position?: TelopPosition; style?: TelopStyle },
  mode?: string
): {
  style: TelopStyle;
  transition: TelopTransition;
  position: TelopPosition;
  directorNote: string;
} {
  const normCut = ((cutId - 1) % 12) + 1;
  const pickRandom = <T>(pool: T[], avoid?: T): T => {
    const valid = avoid ? pool.filter(item => item !== avoid) : pool;
    const list = valid.length > 0 ? valid : pool;
    return list[Math.floor(Math.random() * list.length)];
  };

  // 1. 💡 衝撃雑学・ウラ真実（TikTok/Shorts特化の中央インパクト）
  if (mode === 'trivia') {
    const style: TelopStyle = 'mv-center-climax';
    const transPool: TelopTransition[] = ['zoom-in-bounce', 'animista-slide-bck', 'glitch-pop', 'gsap-kinetic-stagger'];
    const posPool: TelopPosition[] = ['center-climax', 'bottom-center'];
    const transition = pickRandom(transPool, prevStaging?.transition);
    const position = pickRandom(posPool, prevStaging?.position);
    return {
      style, transition, position,
      directorNote: `[💡衝撃雑学Shorts] 画面中央フラッシュテロップ（${position} × ${transition}）。冒頭2秒のフックとオチで視聴者を釘付けにする仕様。`
    };
  }

  // 2. 📜 偉人の名言・超訳処方箋（縦書き・厳粛・静寂フェード）
  if (mode === 'quotes') {
    const style: TelopStyle = 'traditional-sumi';
    const transPool: TelopTransition[] = ['aos-fade-soft', 'blur-slide-up', 'glow-fade'];
    const posPool: TelopPosition[] = ['vertical-left', 'top-cinema', 'bottom-center'];
    const transition = pickRandom(transPool, prevStaging?.transition);
    const position = pickRandom(posPool, prevStaging?.position);
    return {
      style, transition, position,
      directorNote: `[📜偉人名言] 厳粛な縦書き／天吊りタイポグラフィ（${position} × ${transition}）。静寂なフェードで言葉の重みを心に刻む保存特化型演出。`
    };
  }

  // 3. 👻 歴史の怪異・未解決事件（不穏グリッチ・深紅）
  if (mode === 'folklore') {
    const stylePool: TelopStyle[] = ['traditional-sumi', 'mv-neon-glow'];
    const transPool: TelopTransition[] = ['glitch-pop', 'aos-fade-soft', 'glow-fade'];
    const posPool: TelopPosition[] = ['bottom-center', 'center-stagger', 'vertical-right'];
    const transition = pickRandom(transPool, prevStaging?.transition);
    const position = pickRandom(posPool, prevStaging?.position);
    const style = pickRandom(stylePool, prevStaging?.style);
    return {
      style, transition, position,
      directorNote: `[👻怪異・考察] 不穏なグリッチと深紅ハイライト（${position} × ${transition}）。恐怖と謎を煽りコメント議論を誘発。`
    };
  }

  // 4. 🏯 超絶技巧・職人魂（凛とした伝統墨・和モダン）
  if (mode === 'craft') {
    const style: TelopStyle = 'traditional-sumi';
    const transPool: TelopTransition[] = ['blur-slide-left', 'aos-fade-soft', 'blur-slide-up'];
    const posPool: TelopPosition[] = ['bottom-left', 'vertical-right', 'bottom-center'];
    const transition = pickRandom(transPool, prevStaging?.transition);
    const position = pickRandom(posPool, prevStaging?.position);
    return {
      style, transition, position,
      directorNote: `[🏯職人魂] 凛とした和の墨文字（${position} × ${transition}）。極限の手仕事と美を邪魔しない最高峰の気品ある演出。`
    };
  }

  // 5. 🎵 音楽MVモード（Ado風キネティック・ビート同期対向スルー）
  if (isMvMode || mode === 'mv') {
    let stylePool: TelopStyle[] = [];
    let transPool: TelopTransition[] = [];
    let posPool: TelopPosition[] = [];
    let sectionName = '';
    let sectionMood = '';

    if (normCut <= 3) {
      sectionName = `Verse A${normCut}`; sectionMood = '静寂・導入';
      stylePool = ['cinema-subtle', 'mv-blur-slide'];
      transPool = ['aos-fade-soft', 'blur-slide-left', 'blur-slide-up', 'glow-fade'];
      posPool = ['bottom-left', 'bottom-right'];
    } else if (normCut <= 6) {
      sectionName = normCut === 6 ? 'Bridge' : `Verse B${normCut - 3}`; sectionMood = '空間変化・加速';
      stylePool = ['mv-vertical-lyric', 'mv-blur-slide', 'mv-kinetic-pop'];
      transPool = ['blur-slide-right', 'zoom-in-bounce', 'aos-fade-soft', 'blur-slide-left', 'animista-slide-bck'];
      posPool = ['vertical-right', 'vertical-left', 'top-cinema', 'bottom-left', 'bottom-right'];
    } else if (normCut <= 9) {
      sectionName = `Chorus ${normCut - 6}★`; sectionMood = '最高潮・爆発';
      stylePool = ['mv-neon-glow', 'mv-kinetic-pop', 'mv-blur-slide'];
      transPool = ['animista-slide-bck', 'gsap-kinetic-stagger', 'zoom-in-bounce', 'glitch-pop'];
      posPool = ['bottom-left', 'bottom-right', 'top-cinema'];
    } else {
      sectionName = normCut === 10 ? 'Verse C' : `Outro ${normCut - 10}`; sectionMood = '静寂・余韻';
      stylePool = ['mv-neon-glow', 'cinema-subtle', 'mv-vertical-lyric'];
      transPool = ['glow-fade', 'aos-fade-soft', 'blur-slide-left'];
      posPool = ['bottom-left', 'bottom-right', 'vertical-left', 'vertical-right'];
    }

    const transition = pickRandom(transPool, prevStaging?.transition);
    const position = pickRandom(posPool, prevStaging?.position);
    const style = pickRandom(stylePool, prevStaging?.style);
    return {
      style, transition, position,
      directorNote: `[🎵音楽MV・${sectionName}] キネティックタイポ（${position} × ${transition}）。被写体を遮らず楽曲のグルーヴと完全同期。`
    };
  }

  // 6. 🎬 ドラマ連番モード（映画字幕スタイル・台詞没入重視）
  const stylePool: TelopStyle[] = ['cinema-subtle'];
  const transPool: TelopTransition[] = ['aos-fade-soft', 'blur-slide-up'];
  const posPool: TelopPosition[] = ['bottom-center', 'bottom-left'];
  const transition = pickRandom(transPool, prevStaging?.transition);
  const position = pickRandom(posPool, prevStaging?.position);
  const style = pickRandom(stylePool, prevStaging?.style);

  return {
    style, transition, position,
    directorNote: `[🎬シネマドラマ字幕] 映画館の字幕のように下部（${position}）に上品にフェードイン（${transition}）。ストーリーと俳優の感情を極限まで引き立てる。`
  };
}
