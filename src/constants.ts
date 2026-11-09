import { KenBurnsPreset, ProductionMode, TelopStyle, TelopTransition, TelopPosition, GeneratorSettings } from './types';
// ── 🎲 ランダム（おまかせ）定数 ──
export const RANDOM_SELECT_OPTION = '🎲 ランダム（おまかせ）';
// ── 🎙️ YouTube収益化安全キャラクター定義（VOICEVOX / 東北ずん子プロジェクト等） ──
export interface SafeCharacter {
  id: string;
  nameJa: string;
  speakerCredit: string;
  icon: string;
  personality: string;
  dnaPromptEn: string;
  turnaroundPromptEn: string;
  recommendedTastes: string[];
}
export const SAFE_CHARACTERS: SafeCharacter[] = [
  {
    id: 'zundamon',
    nameJa: 'ずんだもん',
    speakerCredit: 'VOICEVOX:ずんだもん / 東北ずん子プロジェクト (SSS合同会社)',
    icon: '🌱',
    personality: '好奇心旺盛で少し生意気だがビビり。語尾に「〜なのだ」「〜のだ」。不気味な現象や怪異に巻き込まれやすい。',
    dnaPromptEn: 'zundamon, cute short green hair with distinctive green edamame soybean hair ornaments on both sides, bright energetic green eyes, wearing a white oversized hooded zip-up sweatshirt jacket with subtle green accents, dark shorts, youthful chibi anime girl appearance, expressive face',
    turnaroundPromptEn: 'character design turnaround sheet, 3 angles full body: front view, side view, and back view of zundamon with short green hair, edamame soybean shaped ear hair ornaments, wearing white and green oversized hoodie, dark shorts, consistent character model, clean character sheet',
    recommendedTastes: ['ダークゴシック童話・黒髪ノスタルジー', '昭和レトロ活版・劇画', '水彩絵の具・淡彩ノスタルジー', '90年代セル画・サイバーパンク']
  },
  {
    id: 'metan',
    nameJa: '四国めたん',
    speakerCredit: 'VOICEVOX:四国めたん / 東北ずん子プロジェクト (SSS合同会社)',
    icon: '🎀',
    personality: 'お嬢様言葉（〜ですわ、〜かしら）、厨二病気質でオカルトや神秘的なものに詳しい。冷静沈着だが時にドジっ子。',
    dnaPromptEn: 'shikoku metan, elegant white twin-tail hair tied with pink ribbons, calm crimson-red eyes, wearing an ornate gothic lolita dress in pastel pink and black frills, thigh-high stockings, elegant and slightly chuunibyou wealthy anime girl',
    turnaroundPromptEn: 'character design turnaround sheet, 3 angles full body: front view, side view, and back view of shikoku metan with white twin-tail hair with pink ribbons, elegant pink and black gothic lolita dress, clean character model sheet',
    recommendedTastes: ['ダークゴシック童話・黒髪ノスタルジー', '欧風クラシカル・黒髪ノスタルジー', '劇画・ヴィンテージ昭和']
  },
  {
    id: 'tsumugi',
    nameJa: '春日部つむぎ',
    speakerCredit: 'VOICEVOX:春日部つむぎ',
    icon: '✨',
    personality: '明るく元気な埼玉ギャル。感情豊かでリアクションが大きい（〜じゃん！、マジで！？）。ギャップで怖がり。',
    dnaPromptEn: 'kasukabe tsumugi, stylish medium blonde hair with light brown inner color streaks, cheerful honey-amber eyes, trendy modern casual street-fashion hoodie jacket, loose socks, adorable expressive Japanese gal gyaru anime girl',
    turnaroundPromptEn: 'character design turnaround sheet, 3 angles full body: front view, side view, and back view of kasukabe tsumugi with blonde hair with inner color streaks, stylish oversized hoodie, casual gyaru fashion, clean character model sheet',
    recommendedTastes: ['90年代セル画・サイバーパンク', 'アニメ原画・線画スケッチ', '水彩絵の具・淡彩ノスタルジー']
  },
  {
    id: 'himari',
    nameJa: '冥鳴ひまり',
    speakerCredit: 'VOICEVOX:冥鳴ひまり',
    icon: '🔮',
    personality: '死神見習い。ミステリアスで落ち着いたダウナー系ボイス。怪異や死後の世界、都市伝説の語り手・案内人。',
    dnaPromptEn: 'meimei himari, mysterious gothic reaper anime girl, dark purple ombre hair, cool violet eyes, wearing a black hood cape and gothic dark dress with skull motif accessories, enigmatic mysterious aura',
    turnaroundPromptEn: 'character design turnaround sheet, 3 angles full body: front view, side view, and back view of meimei himari with purple hair, gothic black cloak, clean character model sheet',
    recommendedTastes: ['ダークファンタジー・重厚陰影', 'ダークゴシック童話・黒髪ノスタルジー']
  },
  {
    id: 'sayo',
    nameJa: '小夜/SAYO',
    speakerCredit: 'VOICEVOX:小夜/Sayo',
    icon: '🌸',
    personality: '落ち着いた知性派アナウンサー。ニュース原稿のような極めてクリアで上品な語り口。歴史の真相や難解な事件を理知的に解き明かす。',
    dnaPromptEn: 'sayo, elegant young Japanese woman, neat sleek jet-black bob hair, calm intelligent deep sapphire-blue eyes, wearing a stylish modern dark blazer jacket over white blouse, professional and refined anime protagonist',
    turnaroundPromptEn: 'character design turnaround sheet, 3 angles full body: front view, side view, and back view of sayo with sleek black bob hair, dark blazer and blouse, elegant professional anime character model sheet',
    recommendedTastes: ['劇画・ヴィンテージ昭和', '水彩絵の具・淡彩ノスタルジー', '昭和レトロ活版・劇画', '欧風クラシカル・黒髪ノスタルジー']
  },
  {
    id: 'nurse_t',
    nameJa: 'ナースロボ＿タイプＴ',
    speakerCredit: 'VOICEVOX:ナースロボ＿タイプＴ',
    icon: '💉',
    personality: '心優しき人造生命体・アンドロイド。淡々とした機械的・無機質ボイスの中に微かな感情が宿る。怪異や生命反応を冷徹にスキャンする。',
    dnaPromptEn: 'nurse robot type t, futuristic cyber android anime girl, pale pastel-pink twin-tails hair, cool clear turquoise-cyan eyes, wearing a sleek minimalist cyber nurse uniform with white and teal accents and stylized visor headset, subtle robotic joints, solitary mysterious presence',
    turnaroundPromptEn: 'character design turnaround sheet, 3 angles full body: front view, side view, and back view of nurse robot type t with pastel pink twin-tails, cyber nurse uniform, minimalist robotic details, clean character sheet',
    recommendedTastes: ['90年代セル画・サイバーパンク', 'ダークファンタジー・重厚陰影', 'ダークゴシック童話・黒髪ノスタルジー']
  },
  {
    id: 'usagi',
    nameJa: '中国うさぎ',
    speakerCredit: 'VOICEVOX:中国うさぎ / 東北ずん子プロジェクト (SSS合同会社)',
    icon: '🐰',
    personality: 'あざと可愛い妹系ロリボイス。ビビりで泣き虫だが好奇心で付いてくる。怪異に出くわすとパニックで絶叫するマスコット枠。',
    dnaPromptEn: 'chugoku usagi, adorable petite anime girl, fluffy long pure-white twin-tails hair tied with oversized pink rabbit-ear ribbon hair bows, large soft ruby-pink eyes, wearing a pastel pink and cream frilled capelet dress, cute knee-high socks, shy and endearing facial expression',
    turnaroundPromptEn: 'character design turnaround sheet, 3 angles full body: front view, side view, and back view of chugoku usagi with fluffy white twin-tails, rabbit-ear ribbons, pastel capelet dress, clean character model sheet',
    recommendedTastes: ['水彩絵の具・淡彩ノスタルジー', 'ダークゴシック童話・黒髪ノスタルジー', 'アニメ原画・線画スケッチ']
  }
];
// ── 🎨 テーマカテゴリー定義 ──
export interface ThemeCategory {
  category: string;
  items: string[];
}
export const THEME_CATEGORIES: ThemeCategory[] = [
  {
    category: '🎒 日常・青春・アオハル',
    items: [
      '🏫 放課後の教室と夕暮れ（教室に残る二人・夕日の差し込む窓・伸びる影）',
      '🚲 海沿いの坂道と通学路（潮風・並んで漕ぐ自転車・青空と入道雲）',
      '🌧️ 昇降口の雨宿り（突然のスコール・一つのビニール傘・かすかな緊張感）',
      '🥤 屋上のサマータイム（炭酸飲料・風に揺れるカーテン・フェンス越しの街）',
      '☕ 雨の日の純喫茶（曇った窓ガラス・温かい珈琲の湯気・琥珀色の読書）',
      '🎶 レコードが鳴る古民家カフェ（針のプチプチ音・埃が踊る午後の日差し）',
      '🌃 深夜2時の部屋（薄暗い間接照明・青白いPC画面・ベッドサイドのチル）',
      '🧺 深夜のコインランドリー（回る洗濯ドラム・漂う洗剤の香り・蛍光灯と外の雨）',
      '🚉 改札口で名残惜しい夕方（行っちゃう電車・見送る視線・あと一本待つ口実）',
      '🎆 浴衣で歩く夏祭りの帰り道（りんご飴・カランコロン鳴る下駄・人混みで握る手）'
    ]
  },
  {
    category: '⛩️ 怪異・民俗学・禁足地・都市伝説',
    items: [
      '🏚️ 廃村の立ち入り禁止看板（生い茂る蔦・風化し歪んだ鳥居・濃い霧）',
      '⛩️ 日本各地の絶対不可侵・禁足地（結界・神域・風化した注連縄・侵食される境界）',
      '👻 誰もいない深夜の旧校舎（軋む廊下・赤く光る非常口・消えない足音）',
      '🚂 幻の無人駅・境界線伝説（霧のプラットフォーム・戻れない線路・異界の気配）',
      '⛰️ 山岳の怪異と異界の掟（吹雪に消える山小屋・古の祠・山の神の視線）',
      '🌲 樹海深奥の隠れ里（巨木に囲まれた孤立集落・外界を拒む風習・神楽鈴の音）',
      '🕳️ 地下空間の秘密軍事壕（冷たいコンクリート・錆びた鉄扉・途切れた配線）',
      '🏮 黄昏時の路地裏と百鬼夜行（現世と常世の狭間・怪しい影・狐面の笑み）',
      '🌊 夜の防波堤と潮騒の怪異（漆黒の海・揺れる常夜灯・深海からの誘い）',
      '📻 昭和オカルト・深夜の乱数放送（ざらつく砂嵐・途切れるアナウンス・謎の暗号）'
    ]
  },
  {
    category: '🏮 歴史・大河・帝都浪漫・時代劇',
    items: [
      '🏮 江戸大河・天下泰平の影と群像劇（幕府・町衆・忍びの暗闘と50年の興亡）',
      '⚔️ 幕末動乱・新時代を拓く志士と守護者（維新回天・思想と剣の激突）',
      '🎩 大正モダン・帝都浪漫と怪異事件帖（ガス灯の夜・華やかな社交界の裏に蠢く闇）',
      '👑 帝都華族と新興財閥の愛憎劇（旧体制の誇りと近代化の荒波・血脈の闘争）',
      '🗡️ 妖刀伝説・鍛冶師の祈りと呪詛（炎と鉄の錬金術・血を吸う白刃）',
      '🌾 諸藩財政再建記・知恵と改革の大名改革（破綻寸前の小藩を立て直す男たち）',
      '👘 華麗なる大奥・美しき権謀術数（御台所・側室・女中たちの権力闘争）',
      '☕ カフェーの女給と貧乏画家（大正浪漫・琥珀色の珈琲と交わらない恋）',
      '🍣 江戸の屋台めし・職人魂（握り寿司・蕎麦・うなぎの誕生と賑わう河岸）',
      '🏯 名城防衛戦・難攻不落の要塞（石垣・狭間からの射撃・包囲された本丸）'
    ]
  },
  {
    category: '🌃 近未来・サイバーパンク・SF',
    items: [
      '🌃 雨煙るネオン街の裏路地（紫と青の反射光・ホログラム広告・サイバー義肢）',
      '🤖 電脳空間のダイブ（流れ落ちる緑のコード・記憶のアーカイブ・光の回廊）',
      '🚗 深夜の首都高・湾岸トワイライト（流れるテールランプ・エンジン音・疾走するネオン）',
      '🚁 摩天楼のランディングパッド（夜景を見下ろす高層ビル・飛来するドローン）',
      '🛰️ 軌道エレベーターと星の海（大気圏を貫くタワー・見下ろす蒼い地球）',
      '🔌 スラム街の闇医師とサイバネティクス（ガラクタ配線・生体パーツ・密売組織）',
      '🌐 巨大AIマザーフレームの沈黙（点滅する無数のラック・冷気の霧・意志の芽生え）',
      '🚀 廃棄宇宙船のサルベージ（無重力の残骸・漏れ出す液体酸素・孤独な船外活動）',
      '🏭 巨大サイバーメガフロート（海上に浮かぶ工場島・煙突の炎・錆びたデッキ）'
    ]
  },
  {
    category: '🏰 ファンタジー・古代遺跡・スチームパンク',
    items: [
      '🏰 古代遺跡と光る水晶（苔むした石柱・浮遊する魔法鉱石・神秘の泉）',
      '🌳 精霊が宿る大樹の森（巨大な樹根の階段・舞い踊る光の胞子・エルフの集落）',
      '🚂 雲海を駆ける蒸気機関列車（真鍮の計器・吹き出す蒸気・果てしない大空）',
      '⚔️ 竜の谷の黄昏（広がる雲海・聳え立つ岩山・風を切り裂く飛翔）',
      '🌌 星降る天文台と時計塔（巨大な真鍮歯車・天球儀・夜空を貫く望遠鏡）',
      '🛡️ 騎士団の城塞都市（石畳の広場・はためく紋章旗・ステンドグラスの大聖堂）',
      '🏜️ 砂漠に埋もれた機巧都市（砂嵐・露出した歯車仕掛け・古代の自動人形）',
      '🧙‍♀️ 薬草香る森の魔女の隠れ家（吊るされた乾燥ハーブ・煮えたぎる大釜・使い魔の黒猫）',
      '🌊 幻の海底神殿と蒼の秘宝（差し込む陽光のカーテン・泳ぐウミガメ・眠るレリーフ）'
    ]
  }
];
export const THEMES: string[] = THEME_CATEGORIES.flatMap(c => c.items);
// ── 🖌️ 画風・スタイル（Single Source of Truth） ──
export const TASTES: Record<string, string> = {
  "🏰 欧風クラシカル・黒髪ノスタルジー (Nostalgic European Manor & Black Hair Academy)":
    "Masterpiece 2D anime illustration, high-end theatrical anime film still, atmospheric cinematography, antique European architecture, glorious warm golden hour sunset light, rich amber wood tones, soft golden rim lighting, quiet poetic ambiance, clean edge-to-edge artwork, absolutely NO 3D render, NO subtitles, NO text, NO speech bubbles",
  "💎 エターナル・プリズムルミナス (Ethereal Prismatic Lineless)":
    "Breathtaking lineless digital painting in a luminous, ethereal anime style, kaleidoscopic prismatic light refraction, glowing crystal shards, drifting flower petals, intense bloom, dreamy lens bokeh particles with realistic f/1.2 depth of field, translucent porcelain skin with soft blush, volumetric rim lighting, clean edge-to-edge artwork, absolutely NO 3D render, NO text",
  "🌙 ノスタルジック魔女ファンタジー・極細線画 (Retro Fantasy Whisper-Line)":
    "Authentic 2D anime illustration, retro fantasy anime style, detailed flat coloring, extremely fine whisper-thin pencil-like outline, vintage film grain, warm floating ember-like particles, soft round glowing bokeh lights, cozy magical atmospheric cinematic lighting, clean edge-to-edge artwork",
  "🍷 青年誌カバー・艶麗アイライン＆ソリッドセル (Modern Seinen Manga Cover Art)":
    "Masterpiece 2D anime illustration in modern seinen manga cover style, prominent face with sharp delicate V-shaped chin, mesmerizing eyes with thick heavy dark upper eyeliner, sharp-edged two-tone cel shading, polished high-contrast modern comic cover finish, clean edge-to-edge artwork",
  "🎨 レトロモダン・ネオ・ジャポニスム (Retro-Modern Neo-Japonisme)":
    "Authentic 2D graphic illustration, sophisticated Japanese retro-modern aesthetic, neo-japonisme art, ultra-fine delicate ink line art, rich high-contrast color palette (deep cyan, warm golds, muted reds), intricate gold filigree patterns, clean edge-to-edge artwork",
  "🌃 ネオ・シティポップ・ナイトウォーク (Neo-City Pop Nightwalk Anime)":
    "Authentic 2D anime illustration, neo-city pop style, ultra-fine delicate ink lines, atmospheric night city with soft glowing neon pink and cyan lights, rain-slicked reflective pavement, subtle warm Lo-Fi film grain texture, clean edge-to-edge artwork",
  "✨ エモーショナル・シネマティック・スカイ (Emotional Cinematic Sky Anime)":
    "Authentic 2D anime masterpiece, breathtaking emotional anime movie still, dynamic sweeping wide-angle composition, massive towering cumulus clouds, dazzling volumetric god rays, rich amber and violet gradient sky, luminous expressive eyes, clean edge-to-edge artwork",
  "⚔️ ダークファンタジー・重厚陰影 (Dark Chiaroscuro Anime)":
    "Authentic 2D anime illustration, dark cinematic fantasy anime aesthetic, extreme chiaroscuro lighting, deep shadows, intense glowing fiery ember highlights, ominous ruined gothic atmosphere, clean edge-to-edge artwork",
  "🖋 白黒劇画・超絶インクマンガ (Intense Monochrome Manga)":
    "Authentic 2D monochrome manga illustration, dramatic gekiga aesthetic, aggressive dry ink brush strokes, ultra-fine screentone crosshatching gradients, extreme chiaroscuro contrast, dynamic single splash cut, clean edge-to-edge artwork",
  "🌸 日常系萌えアニメ・ハッチングチーク (Moe Daily Hatching Blush Anime)":
    "Authentic 2D Japanese TV anime illustration, high-end slice-of-life anime style, ultra-fine delicate ink lines, vertical blush lines on cheeks, soft natural skin tones, charming character design, gentle warm school life atmosphere, clean edge-to-edge artwork"
};
// ── 🤖 画像生成モデル定義 ──
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
  if (keyOrLabel === 'banana-2' || keyOrLabel.includes('Banana 2（')) {
    return IMAGE_MODELS_REGISTRY.find(m => m.id === 'banana-2.1') || defaultModel;
  }
  return IMAGE_MODELS_REGISTRY.find(m => m.id === keyOrLabel || m.label === keyOrLabel || m.name === keyOrLabel) || defaultModel;
}
// ── 🎥 カメラワーク・演出 ──
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
// ── 🚫 姿勢・構図の連続被り防止ルール ──
export const POSE_CONTRAST_RULES: Array<{
  triggerKeywords: string[];
  antiRepeatNegatives: string[];
}> = [
  {
    triggerKeywords: ['sit', 'sitting', 'floor', 'ground', 'seated', 'crouch'],
    antiRepeatNegatives: ['sitting on floor', 'sitting down', 'seated posture', 'crossed legs', 'kneeling']
  },
  {
    triggerKeywords: ['stand', 'standing', 'stiff', 'upright'],
    antiRepeatNegatives: ['stiff standing pose', 'static upright standing', 'motionless standing']
  },
  {
    triggerKeywords: ['walk', 'walking', 'stride', 'run', 'running'],
    antiRepeatNegatives: ['walking away repetition', 'running pose repetition', 'identical walking stride']
  },
  {
    triggerKeywords: ['umbrella', 'parasol', 'rain', '傘'],
    antiRepeatNegatives: ['holding umbrella', 'open umbrella', 'umbrella in hand']
  },
  {
    triggerKeywords: ['phone', 'smartphone', 'mobile', 'スマホ'],
    antiRepeatNegatives: ['holding smartphone', 'looking at phone screen', 'texting on smartphone']
  }
];
// ── 🎬 制作モード統合オブジェクト ──
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
    getDirectorRole: (isManga, isHistorical) => isManga ? 'world-class comic/manga author' : isHistorical ? 'world-class historical drama director' : 'world-class cinematic drama director',
    getContextTitle: (isManga, isHistorical) => isManga ? 'Comic Episode' : isHistorical ? 'Historical Drama Episode' : 'Drama Episode',
    promptInstructions: 'Direct each cut with profound narrative progression and cinematic gravitas.'
  },
  manga: {
    value: 'manga',
    label: '📖 短編マンガ・読み切り',
    icon: 'auto_stories',
    badge: '1話完結',
    desc: '起承転結の短編マンガを一括自動プロデュース',
    telopNote: '漫画フキダシ・効果音',
    colorClass: 'border-emerald-500/30 bg-emerald-950/40 text-emerald-200',
    cardTitle: 'Manga Episode Card',
    cardIcon: 'auto_stories',
    themeLabel: 'テーマ',
    unit: '話',
    themes: [],
    getDirectorRole: () => 'award-winning manga artist and comic storyboard director',
    getContextTitle: () => 'Manga Episode Sequence',
    promptInstructions: 'Utilize cinematic comic panel compositions and intense story pacing.'
  },
  mv: {
    value: 'mv',
    label: '🎵 音楽MV',
    icon: 'music_note',
    badge: '全30カット',
    desc: 'エモーショナルな楽曲MVビジュアル',
    telopNote: 'ネオン枠・キネティック',
    colorClass: 'border-purple-500/30 bg-purple-950/40 text-purple-200',
    cardTitle: 'Music Video Concept Card',
    cardIcon: 'headphones',
    themeLabel: 'シチュエーション',
    unit: '曲',
    themes: [],
    getDirectorRole: () => 'world-class music video director',
    getContextTitle: () => 'Music Video Sequence',
    promptInstructions: 'Create emotional, poetic song lyrics and seamless aesthetic visuals.'
  },
  trivia: {
    value: 'trivia',
    label: '💡 衝撃雑学Shorts',
    icon: 'lightbulb',
    badge: 'TikTok特化',
    desc: '冒頭フック＆オチの衝撃雑学',
    telopNote: '画面中央超特大',
    colorClass: 'border-amber-500/40 bg-amber-950/40 text-amber-200',
    cardTitle: 'Trivia Card',
    cardIcon: 'lightbulb',
    themeLabel: '雑学テーマ',
    unit: '本',
    themes: [],
    getDirectorRole: () => 'viral YouTube Shorts trivia creator',
    getContextTitle: () => 'Trivia Sequence',
    promptInstructions: 'Hook in Cut 1, explain truth in Cut 2-10, deliver punchline in Cut 11-12.'
  },
  quotes: {
    value: 'quotes',
    label: '📜 偉人の名言',
    icon: 'history_edu',
    badge: '保存特化',
    desc: '心に刺さる人生訓',
    telopNote: '厳粛な縦書き',
    colorClass: 'border-teal-500/40 bg-teal-950/40 text-teal-200',
    cardTitle: 'Quotes Card',
    cardIcon: 'format_quote',
    themeLabel: '名言・人物',
    unit: '篇',
    themes: [],
    getDirectorRole: () => 'philosophical essayist',
    getContextTitle: () => 'Quotes Sequence',
    promptInstructions: 'Present profound quotes and life prescriptions.'
  },
  folklore: {
    value: 'folklore',
    label: '👻 怪異・未解決事件',
    icon: 'visibility',
    badge: '考察・恐怖',
    desc: '背筋凍る謎と怪異',
    telopNote: '深紅ハイライト',
    colorClass: 'border-rose-900/60 bg-rose-950/50 text-rose-200',
    cardTitle: 'Folklore Card',
    cardIcon: 'psychology',
    themeLabel: '怪異・伝説',
    unit: '話',
    themes: [],
    getDirectorRole: () => 'investigative mystery storyteller',
    getContextTitle: () => 'Folklore Sequence',
    promptInstructions: 'Suspenseful commentary evoking eerie curiosity.'
  },
  craft: {
    value: 'craft',
    label: '🏯 超絶技巧・職人魂',
    icon: 'handyman',
    badge: '神業和モダン',
    desc: '神の手を持つ職人技',
    telopNote: '伝統金文字',
    colorClass: 'border-yellow-600/40 bg-yellow-950/40 text-yellow-200',
    cardTitle: 'Craft Card',
    cardIcon: 'precision_manufacturing',
    themeLabel: '伝統技術',
    unit: '作',
    themes: [],
    getDirectorRole: () => 'master artisan documentarian',
    getContextTitle: () => 'Craft Sequence',
    promptInstructions: 'Serene and reverent celebration of master craftsmanship.'
  },
  'style-matrix': {
    value: 'style-matrix',
    label: '🎨 画風比較',
    icon: 'palette',
    badge: '自動比較',
    desc: '複数画風を一括検証',
    telopNote: '画風比較',
    colorClass: 'border-pink-500/30 bg-pink-950/40 text-pink-200',
    cardTitle: 'Style Card',
    cardIcon: 'palette',
    themeLabel: 'テーマ',
    unit: '組',
    themes: [],
    getDirectorRole: () => 'art style director',
    getContextTitle: () => 'Style Matrix',
    promptInstructions: 'Standardized prompt evaluation across styles.'
  },
  manzai: {
    value: 'manzai',
    label: '🎙️ 漫才・掛け合い',
    icon: 'record_voice_over',
    badge: '演芸掛け合い',
    desc: 'ボケ＆ツッコミの掛け合い劇',
    telopNote: '掛け合い吹き出し',
    colorClass: 'border-orange-500/30 bg-orange-950/40 text-orange-200',
    cardTitle: 'Manzai Card',
    cardIcon: 'record_voice_over',
    themeLabel: 'テーマ・お題',
    unit: '本',
    themes: [],
    getDirectorRole: () => 'comedic writer',
    getContextTitle: () => 'Manzai Routine',
    promptInstructions: 'Rapid-fire banter between contrasting characters.'
  }
};
export function getProductionModeConfig(mode?: string, isMvMode?: boolean): ProductionModeConfig {
  if (isMvMode) return PRODUCTION_MODES_CONFIG.mv;
  if (!mode || !(mode in PRODUCTION_MODES_CONFIG)) return PRODUCTION_MODES_CONFIG.episodes;
  return PRODUCTION_MODES_CONFIG[mode as ProductionMode];
}
export const PRODUCTION_MODES_LIST = Object.values(PRODUCTION_MODES_CONFIG);
export const PRODUCTION_MODES = PRODUCTION_MODES_LIST;
export const IMAGE_MODELS = IMAGE_MODELS_REGISTRY;
// ── 🎥 映画的カメラディレクションサイクル ──
export interface CineCameraRule {
  scale: string;
  tag: string;
  cameraWork: string;
  directive: string;
  antiPoseTokens: string[];
}
export const UNIVERSAL_CINE_CYCLE: CineCameraRule[] = [
  {
    scale: 'Extreme Close-Up',
    tag: '極限ドアップ・瞳',
    cameraWork: 'intimate-macro',
    directive: 'Ultra extreme macro close-up portrait cropped tightly at mid-forehead and chin, massive sparkling eyes dominating the canvas, shallow depth of field, strictly face and eyes only',
    antiPoseTokens: ['full body', 'torso', 'legs', 'wide shot', 'standing pose']
  },
  {
    scale: 'Low-Angle Footsteps',
    tag: '足元・踏み出し',
    cameraWork: 'low-angle-tilt-up',
    directive: 'Extreme ground-level low-angle worm-eye camera looking at footsteps taking a resolute kinetic stride, dynamic motion, strictly ground and feet level',
    antiPoseTokens: ['face', 'portrait', 'eyes', 'high angle']
  },
  {
    scale: 'Medium Bust Shot',
    tag: '日常シチュエーション',
    cameraWork: 'medium-push-in',
    directive: 'Candid medium atmospheric framing capturing authentic unposed posture, rich directional side chiaroscuro rim lighting, shallow depth of field',
    antiPoseTokens: ['stiff upright pose', 'facing camera rigidly']
  },
  {
    scale: 'Still-Life Object Macro',
    tag: '象徴アイテム・静物',
    cameraWork: 'macro-reveal',
    directive: 'Cinematic extreme close-up macro product still-life photography of an iconic symbolic keepsake object, completely deserted scene with strictly NO humans, rich tactile texture',
    antiPoseTokens: ['human', 'person', 'face', 'eyes', 'hands', 'body', 'crowd', 'portrait']
  }
];
// ── 🎞️ ストーリーボードプリセット ──
export interface StoryShotPreset {
  scale: string;
  tag: string;
  cinematicAngle: string;
  mangaAngle: string;
  mvAngle: string;
}
export const TWELVE_CUT_STORYBOARD_PRESETS: StoryShotPreset[] = [
  { scale: 'Wide', tag: '引き・世界観', cinematicAngle: 'High-angle landscape view looking down from above, sweeping atmospheric background', mangaAngle: 'Massive full-bleed opening splash illustration', mvAngle: 'Cinematic establishing wide landscape, serene music video opening' },
  { scale: 'Medium', tag: '佇まい・アンニュイ', cinematicAngle: 'Dramatic low-angle worm-eye view looking up, intense cinematic perspective', mangaAngle: 'Intense macro eye close-up filling the frame, heavy screentones', mvAngle: 'Relaxed medium shot, subject in contemplative quiet pose' },
  { scale: 'Close-up', tag: '情緒的ディテール', cinematicAngle: 'Looking back over the shoulder, dynamic three-quarter view', mangaAngle: 'Webtoon vertical flow, character in mid-action', mvAngle: 'Artistic detail close-up, focusing on hands or feet walking' },
  { scale: 'Wide', tag: '逆光・光の移ろい', cinematicAngle: 'Cinematic wide horizontal shot, street-level atmospheric perspective', mangaAngle: 'Establishing shot with detailed architecture', mvAngle: 'Wide horizontal shot with golden hour backlight' },
  { scale: 'Medium', tag: '後ろ姿・風情', cinematicAngle: 'Dutch tilt angled close-up, dramatic diagonal framing', mangaAngle: 'Dutch tilt angular composition, intense emotion', mvAngle: 'Over-the-shoulder or three-quarter back view, hair swaying in breeze' },
  { scale: 'Close-up', tag: '伏し目・静寂', cinematicAngle: 'Low-angle medium shot looking up towards character standing strong', mangaAngle: 'Dramatic high-contrast cel-shaded lighting', mvAngle: 'Gentle side profile close-up, downcast tranquil gaze' },
  { scale: 'Wide', tag: '風景・呼吸感', cinematicAngle: 'High-angle downward view from balcony or hill', mangaAngle: 'Sweeping manga double-page spread style', mvAngle: 'Expansive environmental composition, vast sky' },
  { scale: 'Medium', tag: '小休止・自然体', cinematicAngle: 'Over-the-shoulder perspective looking past character', mangaAngle: 'Intense standoff over-the-shoulder framing', mvAngle: 'Casual candid medium framing, sitting peacefully' },
  { scale: 'Close-up', tag: 'マクロ・テクスチャ', cinematicAngle: 'Side profile close-up silhouette with warm rim light', mangaAngle: 'Extreme close-up on mouth/jaw with gritted teeth', mvAngle: 'Atmospheric macro focus, dappled sunlight, soft shadows' },
  { scale: 'Medium', tag: '歩き出し・流れる時', cinematicAngle: 'Centered cinematic medium portrait, dramatic side-lighting', mangaAngle: 'Dynamic running action, kinetic speed lines', mvAngle: 'Smooth moving perspective, walking forward at gentle pace' },
  { scale: 'Close-up', tag: 'アンニュイ表情', cinematicAngle: 'Macro emotional close-up capturing intense gaze', mangaAngle: 'Emotional character face, glowing eyes', mvAngle: 'Subtle expressive close-up, calm peaceful face' },
  { scale: 'Wide', tag: '余韻・アウトロ', cinematicAngle: 'Epic wide cinematic climax view, panoramic composition', mangaAngle: 'Cinematic climax splash artwork', mvAngle: 'Epic serene wide lingering view, fading twilight' }
];
// ── 🛡️ 基本ネガティブプロンプト ──
export const BASELINE_NEGATIVE_TOKENS = {
  anatomicalIntegrity: 'giant, floating head, severed body, floating torso, bad anatomy, deformed fingers',
  antiReferenceStiffness: 'identical pose as reference image, static mugshot pose',
  antiAnachronisms: 'modern clothing, wristwatch, eyeglasses, sneakers, smartphone, headphones, electricity pole',
  antiFrameAndBorder: 'frame, border, picture frame, white border, white margin, comic panel outline, panel border, outer frame, blank edge',
  renderingQuality: 'lowres, worst quality, text, subtitles, caption bar, speech bubbles, dialog box, Japanese characters, kanji subtitles, watermark, blurry'
};
// ── 📺 テロップ演出 ──
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
// ── 📐 システム定数 ──
export const STRICT_STYLE_SUFFIX = ' seamless full-bleed square 1:1 artwork. Grounded immersive cinematic framing. Absolutely NO drone shots, NO modern aerial drones, NO borders, NO margins, NO text, NO subtitles, NO caption banner, NO speech bubbles, NO kanji, NO numbers, NO year labels, NO signs indicating the year or date, clean edge-to-edge artwork.';
export const CUTS_PER_EPISODE = 12;
export const DEFAULT_ASPECT_RATIO = '1:1';
// ── 互換エクスポート ──
export const DEFAULT_VIDEO_MODEL = 'Omni 1.1 Flash';
export const DEFAULT_GENERATOR_SETTINGS: GeneratorSettings = {
  productionMode: 'episodes',
  country: '日本',
  theme: RANDOM_SELECT_OPTION,
  taste: RANDOM_SELECT_OPTION,
  imageModel: IMAGE_MODELS_REGISTRY[1]?.label || '🍌 Nano Banana 2.1',
  defaultVideoModel: '',
  videoRatio: 'none',
  episodeCount: 5,
  cutCount: 12,
  previewCutCount: 12,
  parallelCount: 1,
  executionProfile: 'night_safe',
  autoVideo: false,
  autoDownload: true,
  superBackoff: true,
  isMvMode: false,
  aspectRatio: '1:1',
  characterId: 'random',
  enableTurnaroundSheet: true,
  autoApproveTurnaround: true,
  enableObjectCut: true,
  enableEndFrames: false
};
export const DEFAULT_IMAGE_MODEL = IMAGE_MODELS_REGISTRY[1]?.label || '🍌 Nano Banana 2.1';
export const PRODUCTION_MODE_OPTIONS = PRODUCTION_MODES_LIST;

