export const COUNTRIES = ['日本'];

export const ERAS = [
  '江戸時代（泰平の世・長屋・町人文化・職人）',
  '⚔️ 幕末動乱・黒船来航（新選組・浪人・開国・激動の志士）',
  '明治時代（文明開化・ハイカラ・激動）',
  '大正ロマン（モダンガール・文豪・カフェ）',
  '🗼 戦後復興・三丁目の夕日（闇市・白黒テレビ・下町人情）',
  '昭和レトロ（高度成長・純喫茶・団地）',
  '💰 バブル狂乱（ワンレン・札束タクシー・ディスコ・80s後半）',
  '平成ノスタルジー（ガラケー・90s〜00s・就職氷河期）',
  '📱 現代・令和（SNS病・港区・マッチングアプリ・タワマン）'
];

export interface ThemeCategory {
  category: string;
  items: string[];
}

export const THEME_CATEGORIES: ThemeCategory[] = [
  {
    category: '🏮 江戸・大河・歴史人情',
    items: [
      '🏮 江戸の風俗・吉原裏表（粋と野暮・見栄と情けの駆け引き）',
      '🏃‍♂️ 江戸の飛脚（宿場町・関所破り・命がけの定刻配達）',
      '🏯 参勤交代・貧乏大名の苦悩（借金まみれの財政と武家の体面）',
      '🥢 江戸の長屋人情（宵越しの銭は持たぬ・お節介と温かい絆）',
      '⚒️ 江戸の職人・町火消し（命を張った火事場の意地と喧嘩）',
      '🗡️ 岡っ引きと辻斬り（十手と捕物帳・闇に葬られた大奥の密命）',
      '🍣 江戸の屋台めし（握り寿司・蕎麦・うなぎの誕生と職人魂）',
      '📜 寺子屋と落ちぶれ浪人（刀を捨て筆を教える男の隠された過去）',
      '💊 諸国行商・富山の薬売り（旅路で見聞きした怪異と各地の秘密）',
      '🎲 鉄火場の女胴元（賽の目に賭けた宿命・仁義と散り際の美学）',
      '⚔️ 新選組・壬生浪士の挽歌（誠の旗の下に散った若者たちの熱情）',
      '🌾 飢饉と義賊・鼠小僧（奪われた年貢を取り戻す暗夜の疾走）'
    ]
  },
  {
    category: '🚂 明治・大正・浪漫',
    items: [
      '🚂 陸蒸気開通秘話（鉄の馬に驚愕した人々と若き技師の執念）',
      '☕ カフェーの女給と貧乏画家（琥珀色の珈琲と交わらない恋）',
      '👑 華族の没落・令嬢の決断（洋館を手放し新時代へ踏み出す女）',
      '🎩 怪盗紳士と帝都警察（ガス灯の夜に舞う予告状と探偵の推理）',
      '🖋️ 文豪の愛憎・原稿用紙の告白（締め切りと酒と破滅の美学）'
    ]
  },
  {
    category: '📻 昭和・戦後・高度成長・バブル',
    items: [
      '📻 戦後・闇市の孤児とジャズ（焦土に響いた希望のサックス）',
      '🏭 集団就職列車・金の卵たち（夜汽車に揺られた少年少女の青春）',
      '🏢 団地妻の憂鬱・新生活の影（白い巨塔に隠された孤立と見栄）',
      '💰 バブル狂乱・地上げ屋の罠（狂気のマネーゲームと崩壊前夜）',
      '🚗 峠の走り屋・深夜のバトル（ハチロクと青春を懸けたテールランプ）',
      '🥊 下町のボクシングジム（拳一つでどん底から這い上がる男）',
      '📺 昭和家電狂騒曲（三種の神器を巡る家族の意地と奮闘記）'
    ]
  },
  {
    category: '💻 平成・ゼロ年代・就職氷河期',
    items: [
      '💻 平成初期・深夜のチャットルーム（ダイヤルアップ音と秘密の告白）',
      '🏢 就職氷河期・手取り15万（理不尽な格差と生き残り）',
      '📟 ポケベルと雨の公衆電話（数字の暗号に託した最後のメッセージ）',
      '🎤 渋谷ギャルとパラパラ（ルールを壊した彼女たちの居場所）',
      '🎮 秋葉原・深夜の行列とオタク（情熱とプライドを懸けたゲーム発売日）',
      '💔 すれ違い・言えなかった一言（時代に翻弄された恋と別れ）',
      '🤦‍♂️ 悶絶の黒歴史（思い出すと夜中に枕をバンバン叩く大失敗）',
      '🌸 青春・アオハル（部活・放課後・甘酸っぱい初恋と友情）'
    ]
  },
  {
    category: '⚠️ 現代・SNS・社会派の闇',
    items: [
      '⚠️ SNS承認欲求と見栄の地獄（港区女子・パパ活・タワマン格差）',
      '💼 ブラック企業・サビ残300時間（理不尽な上司と壊れていく心）',
      '📸 社内不倫と因果応報（完璧だった家庭が崩壊する1通の通知）',
      '🏚️ 8050問題・老老介護（静かに迫る孤立と共倒れのリアル）',
      '📉 年金・退職金の現実（制度の罠・逃げ切れなかった世代）',
      '💳 ギャンブル狂いと消費者金融（自転車操業の果てに見た地獄）',
      '📱 推し活破産・投げ銭の果て（画面の向こうにすべてを捧げた男）'
    ]
  },
  {
    category: '⚡ スカッと・逆転・覚醒',
    items: [
      '⚡ 舐められていた奴の覚醒（見下してきた連中を見返す大逆転）',
      '🛡️ 静かなる復讐（すべてを奪われた主人公の完全論破）',
      '🥋 破門された天才・道場破り（裏切りの師匠を見返す一撃）',
      '🍜 潰れかけのラーメン屋（頑固親父と脱サラ息子の奇跡の復活）'
    ]
  },
  {
    category: '👻 怪異・都市伝説・ヒトコワ',
    items: [
      '👻 ヒトコワ・日常の狂気（隣人の異常行動・消えた同級生）',
      '⛩️ 因習村の掟・禁忌の儀式（決して足を踏み入れてはならない場所）',
      '📞 深夜の赤い公衆電話（午前2時に鳴り響く死者からの着信）',
      '🏚️ 事故物件の住み込み清掃人（壁のシミが語りかけてくる部屋）'
    ]
  }
];

export const THEMES: string[] = THEME_CATEGORIES.flatMap(c => c.items);

export const TASTES: Record<string, string> = {
  "🧪⚡ ネオ・バーチャル・ポップ (Neo Virtual Pop Anime)":
    "High-energy anime music video (AMV) aesthetic, virtual pop star style, dynamic composition, ultra-fine delicate ink lines, fragile thin linework, no bold lines, expressive sparkling eyes, intricate character design with diverse hairstyles, iridescent surfaces, vibrant pastel and neon color palette, dramatic chromatic aberration, particle effects, lens flares, polished highly detailed 2D anime finish",

  "🎨 レトロモダン・ネオ・ジャポニスム (Retro-Modern Neo-Japonisme)":
    "Sophisticated Japanese retro-modern illustration, neo-japonisme aesthetic, ultra-clean ultra-fine delicate ink line art, fragile thin linework, no bold lines, highly stylized character design, dramatic dynamic composition with heavy focus on depth of field, rich high-contrast color palette (deep cyan, warm golds, muted reds), intricate gold filigree patterns, subtle matte and glossy textures blended, explosive glitter and particle effects, dramatic volumetric lighting, cinematic lens flares, highly detailed vintage poster art finish, optimized for catchy visual impact",

  "🌃 ネオ・シティポップ・ナイトウォーク (Neo-City Pop Nightwalk Anime)":
    "Nostalgic modern anime aesthetic, neo-city pop style, ultra-fine delicate ink lines, fragile thin linework, no bold lines, highly detailed character design, dynamic wide-angle composition, atmospheric night city with soft glowing neon pink and cyan lights, rain-slicked reflective pavement, dramatic light reflections, chromatic aberration, subtle warm Lo-Fi film grain texture, cozy emotional atmosphere, polished high-fidelity anime cut finish",

  "✨ エモーショナル・シネマティック・スカイ (Emotional Cinematic Sky Anime)":
    "Breathtaking emotional cinematic anime masterpiece, hyper-detailed anime aesthetic, ultra-fine delicate ink lines, fragile thin linework, no bold lines, dynamic sweeping wide-angle composition, massive towering cumulus clouds, dazzling volumetric god rays, intense lens flares and golden hour light scattering, rich amber and violet gradient sky, delicate wind and floating particles, expressive character design with luminous eyes, high-impact emotional anime movie still finish",

  "⚔️ ダークファンタジー・重厚陰影 (Dark Chiaroscuro Anime)":
    "Dark cinematic fantasy anime aesthetic, extreme chiaroscuro lighting, deep shadows, delicate thin linework, intense glowing fiery ember highlights, ominous ruined gothic atmosphere, dynamic sharp armor reflections, hyper-detailed epic illustration",

  "🖋 白黒劇画・超絶インクマンガ (Intense Monochrome Manga)":
    "Dramatic monochrome manga aesthetic, aggressive dry ink brush strokes, ultra-fine screentone crosshatching gradients, extreme chiaroscuro contrast, dynamic single splash cut, no panels, gritty realism, high-impact black and white artwork",

  "🏮 ゆる浮世絵・戯画ギャグ調 (Humorous Edo Ukiyo-e Manga)":
    "Humorous Japanese Ukiyo-e manga style, eccentric Edo pop art, full-bleed edge-to-edge seamless artwork, absolutely NO outer border, NO white margin, NO paper frame, authentic textured washi paper, vintage woodblock printing, delicate thin ink lines, deadpan comedic expressions, quirky stylized body proportions, funny historical genre cut, playful Edo parody finish",

  "🌊 葛飾北斎・超写実肉筆浮世絵 (Hyper-Realistic Hokusai Nikuhitsu Ukiyo-e)":
    "Masterpiece authentic Edo period Ukiyo-e painting by Katsushika Hokusai, hyper-realistic nikuhitsu-ga (original hand-painted brush painting), extreme museum archival quality, genuine antique textured aged washi paper with raw mulberry fibers, delicate organic paper discoloration, warm sepia and tea-stained antique patina, traditional natural mineral pigments (deep indigo aizuri, crushed malachite green, vermilion cinnabar, earthy ochre), fine sumi ink calligraphy brush lines with authentic dry-brush friction, intentional ink pooling and nuanced pressure variations, realistic Edo period aesthetic, seamless full-bleed edge-to-edge artwork, absolutely NO frame, NO borders, NO margins, NO modern digital gloss",

  "🐸 鳥獣戯画・国宝絵巻モノクローム (Chōjū-giga National Treasure Ink Scroll)":
    "National Treasure Chōjū-jinbutsu-giga (Scrolls of Frolicking Animals) Japanese ink painting masterpiece, authentic Heian and Kamakura period handscroll aesthetic, expressive anthropomorphic frogs (kaeru), rabbits (usagi), monkeys (saru), and foxes (kitsune) frolicking and performing human activities with lively dynamic humor, pure monochrome sumi-e wash, expressive fluid brushstrokes with dry-brush flying white (haku) and soft ink bleed (tarashikomi), ancient weathered silk and antique mulberry washi scroll texture with subtle age cracks and sepia toning, timeless classical Japanese satirical ink art, seamless full-bleed edge-to-edge composition, absolutely NO outer border, NO white margin",

  "👑 アール・ヌーヴォー・宮廷エレガンス (Art Nouveau Imperial Elegance)":
    "Masterpiece Alphonse Mucha inspired Art Nouveau anime illustration, elegant imperial court aesthetics, ultra-fine delicate golden ink contours, fragile thin linework, no bold lines, expressive gorgeous character design, cascading flowing hair, intricate gold filigree and botanical lace motifs gently blended into the background, translucent silk drapery, luminous porcelain skin, soft diffused museum lighting, vibrant amber and emerald palette, seamless full-bleed composition, edge-to-edge artwork, absolutely NO frame, NO borders, NO arch window",

  "🎴 ネオ・エンブレム・カードアート (Modern High-End Anime Card Art)":
    "High-end Japanese anime character card art aesthetic, ultra-fine crisp ink line art, fragile thin linework, no bold lines, sharp cel shading with rich dimensional gradient shadows, highly intricate costume and texture details, dynamic low-angle composition with subtle forced foreshortening, dramatic cinematic rim lighting, luminous floating light particles, full-bleed edge-to-edge seamless artwork, polished 2D key visual finish",

  "🌸 日常系萌えアニメ・ハッチングチーク (Moe Daily Hatching Blush Anime)":
    "Authentic Japanese TV anime aesthetic, high-end slice-of-life anime style, ultra-fine delicate ink lines, simple expressive anime eyes, vertical blush lines on cheeks, hatching blush, separated subtle blush, soft natural skin tones, charming character design, gentle warm school life atmosphere, vibrant clean anime color palette, polished 2D digital cel animation finish",

  "🎨 くすみパステル・チルスケッチ (Muted Pastel Chill Sketch Anime)":
    "Anime sketch style, delicate clean line art, muted pastel color palette, warm beige tones, minimalist flat coloring, soft natural ambient lighting, cozy relaxed Lo-Fi atmosphere, indie music video aesthetic, poetic unhurried mood, beautiful subtle artistic composition",

  "🌃 劇場版フラットセル・夜景ティール (Cinematic Flat Cel Teal Anime)":
    "Cinematic anime movie aesthetic, clean crisp ink lineart, authentic flat cel shading, muted dark teal environmental background, subtle sharp rim light, high-impact cinematic contrast, elegant restrained color grading, theatrical anime feature film key frame finish",

  "📐 サイバー・テクニカル・ブループリント (Cyber Technical Blueprint)":
    "Intricate technical blueprint schematic of an advanced quantum machine and architectural cross-section, glowing holographic cyan and amber HUD vector overlays, ultra-precise CAD wireframe lines, deep navy blue blueprint grid paper aesthetic, industrial patent schematic render, volumetric laser light rays, ultra-clean engineering laboratory aesthetic, 8k resolution",

  "🔬 ナショジオ・超深度マクロ自然科学 (NatGeo Macro Science & Crystal)":
    "Extreme macro cinematic photograph of iridescent bismuth crystal growing in dark laboratory, hyper-detailed crystalline molecular geometry, translucent light refractions and prism caustics, National Geographic science documentary aesthetic, dark moody background with pinpoint rim lighting, 8k octane render, hyperrealistic natural science visual",

  "🏛️ バウハウス・幾何学キネティックアート (Bauhaus Geometric Kinetic)":
    "Minimalist Bauhaus kinetic sculpture, floating geometric brass spheres and matte concrete monoliths, frosted glass shadows, elegant brutalist gallery lighting, Swiss graphic design aesthetic, high-contrast abstract architectural balance, ultra-clean commercial look",

  "📜 ダ・ヴィンチ古代手稿・飛行機械スケッチ (Da Vinci Codex & Antique Sketch)":
    "Authentic Leonardo da Vinci codex manuscript sketch, complex flying ornithopter mechanism and astronomical clockwork, sepia aged parchment paper texture, vintage brown fountain ink linework, Renaissance engineering studies, anatomical and mechanical notations, museum archival illustration"
};

import {
  IMAGE_MODELS_REGISTRY,
  VIDEO_MODELS_REGISTRY,
  CAMERA_WORK_REGISTRY,
  MV_THEMES,
  TRIVIA_THEMES,
  QUOTES_THEMES,
  FOLKLORE_THEMES,
  CRAFT_THEMES,
  TELOP_STYLE_REGISTRY,
  TELOP_TRANSITION_REGISTRY,
  TELOP_POSITION_REGISTRY,
  PRODUCTION_MODES_CONFIG,
  PRODUCTION_MODES_LIST,
  getProductionModeConfig,
  resolveImageModel,
  resolveVideoModel,
  resolveCameraWork,
  resolveTelopStyle,
  resolveTelopTransition,
  resolveTelopPosition,
  resolveRecommendedTelopStaging,
  resolveRecommendedCameraWorkAndKenBurns
} from './config/studioDefinitions';

export {
  IMAGE_MODELS_REGISTRY,
  VIDEO_MODELS_REGISTRY,
  CAMERA_WORK_REGISTRY,
  MV_THEMES,
  TRIVIA_THEMES,
  QUOTES_THEMES,
  FOLKLORE_THEMES,
  CRAFT_THEMES,
  TELOP_STYLE_REGISTRY,
  TELOP_TRANSITION_REGISTRY,
  TELOP_POSITION_REGISTRY,
  PRODUCTION_MODES_CONFIG,
  PRODUCTION_MODES_LIST,
  getProductionModeConfig,
  resolveImageModel,
  resolveVideoModel,
  resolveCameraWork,
  resolveTelopStyle,
  resolveTelopTransition,
  resolveTelopPosition,
  resolveRecommendedTelopStaging,
  resolveRecommendedCameraWorkAndKenBurns
};

export const PRODUCTION_MODES = PRODUCTION_MODES_LIST;

export const IMAGE_MODELS = IMAGE_MODELS_REGISTRY;
export const VIDEO_MODELS = VIDEO_MODELS_REGISTRY;

export const VIDEO_RATIO_OPTIONS = [
  { label: 'なし(0%)', value: 'none' },
  { label: 'キメ(30%)', value: '30%' },
  { label: '半分(50%)', value: '50%' },
  { label: '全部(100%)', value: '100%' }
];

export const KEN_BURNS_PRESETS = [
  { label: 'なし (None)', value: 'none' },
  { label: 'ゆっくり寄る (Zoom In)', value: 'zoom-in' },
  { label: 'ゆっくり引く (Zoom Out)', value: 'zoom-out' },
  { label: '左へ流す (Pan Left)', value: 'pan-left' },
  { label: '右へ流す (Pan Right)', value: 'pan-right' },
  { label: '見上げる (Tilt Up)', value: 'tilt-up' },
  { label: '見下ろす (Tilt Down)', value: 'tilt-down' }
];

export const CAMERA_WORK_OPTIONS = CAMERA_WORK_REGISTRY.map(c => ({
  label: c.label,
  value: c.motionPrompt
}));

export const sanitizeFilename = (name: string) => (name || '').replace(/[\\/:*?"<>|]/g, '').trim();

// ── 極彩色ネオンパレット（スタジオ統一定義） ──
export interface NeonTheme {
  color: string;
  glow: string;
  border: string;
  shadow: string;
}

export const STUDIO_NEON_PALETTE: NeonTheme[] = [
  { color: '#FFE600', glow: '0 0 16px rgba(255, 230, 0, 0.95), 0 0 28px rgba(255, 200, 0, 0.5), 0 2px 5px rgba(0,0,0,0.95)', border: 'border-amber-400/50', shadow: 'shadow-amber-500/25' },
  { color: '#00F0FF', glow: '0 0 16px rgba(0, 240, 255, 0.95), 0 0 28px rgba(0, 200, 255, 0.5), 0 2px 5px rgba(0,0,0,0.95)', border: 'border-cyan-400/50', shadow: 'shadow-cyan-500/25' },
  { color: '#FF2A85', glow: '0 0 16px rgba(255, 42, 133, 0.95), 0 0 28px rgba(255, 0, 100, 0.5), 0 2px 5px rgba(0,0,0,0.95)', border: 'border-pink-500/50', shadow: 'shadow-pink-500/25' },
  { color: '#39FF14', glow: '0 0 16px rgba(57, 255, 20, 0.95), 0 0 28px rgba(40, 220, 0, 0.5), 0 2px 5px rgba(0,0,0,0.95)', border: 'border-emerald-400/50', shadow: 'shadow-emerald-500/25' },
  { color: '#FF7A00', glow: '0 0 16px rgba(255, 122, 0, 0.95), 0 0 28px rgba(255, 80, 0, 0.5), 0 2px 5px rgba(0,0,0,0.95)', border: 'border-orange-400/50', shadow: 'shadow-orange-500/25' },
  { color: '#BD00FF', glow: '0 0 16px rgba(189, 0, 255, 0.95), 0 0 28px rgba(160, 0, 240, 0.5), 0 2px 5px rgba(0,0,0,0.95)', border: 'border-purple-400/50', shadow: 'shadow-purple-500/25' }
];

export function resolveNeonTheme(word: string, highlightIdx: number, cutId: number, customColor?: string): NeonTheme {
  if (customColor && customColor !== '#FFE600') {
    return {
      color: customColor,
      glow: `0 0 16px ${customColor}, 0 0 28px ${customColor}80, 0 2px 5px rgba(0,0,0,0.95)`,
      border: 'border-white/40',
      shadow: 'shadow-white/20'
    };
  }
  let hash = 0;
  const cleanWord = (word || '').trim();
  for (let i = 0; i < cleanWord.length; i++) {
    hash = (hash << 5) - hash + cleanWord.charCodeAt(i);
  }
  const idx = Math.abs(hash + highlightIdx * 3 + cutId * 5) % STUDIO_NEON_PALETTE.length;
  return STUDIO_NEON_PALETTE[idx];
}

// システム動作に必要なテクニカル定数
export const STRICT_STYLE_SUFFIX = ' seamless full-bleed vertical 9:16 artwork. Strictly upright vertical perspective. Grounded immersive cinematic human eye-level framing. Absolutely NO drone shots, NO modern aerial drones, NO borders, NO text, NO kanji, NO numbers, NO year labels, NO signs indicating the year or date.';
export const CUTS_PER_EPISODE = 12;
export const DEFAULT_ASPECT_RATIO = '9:16';