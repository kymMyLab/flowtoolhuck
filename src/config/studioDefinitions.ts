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
  '🏮 江戸庶民の裏稼業・闇ビジネス（夜鷹・拝み屋・屎尿回収・もぐり医師）',
  '🏮 江戸長屋のトンデモ共同生活（四畳半のプライバシーゼロ・井戸端ルール・長屋の掟）',
  '🏮 江戸の食生活とジャンクフード文化（ファストフード屋台・初鰹狂騒・白米中毒の脚気）',
  '🏮 江戸の衛生環境とリサイクル狂気（徹底したエコ社会・共同便所ビジネス・風呂事情）',
  '🏮 江戸の火事と火消しのウラ実態（喧嘩上等・破壊消防・放火の重罰と火事場泥棒）',
  '🏮 貧乏旗本・下級武士の内職サバイバル（傘張り・朝顔栽培・金魚養殖・バイト暮らし）',
  '🏮 吉原遊郭の光と闇・リアルなシステム（花魁の借金地獄・格式と掟・遊女の日常）',
  '🏮 江戸の医療・民間療法と奇病（蘭方医vs漢方医・麻酔手術の誕生・迷信と呪術）',
  '🏮 江戸の犯罪・捕物帳と拷問刑罰（同心と岡っ引きの実態・島流し・晒し首と石抱き）',
  '🏮 江戸っ子の娯楽・見世物小屋と流行（エレキテル興行・大相撲・富くじギャンブル）',
  '⚔️ 戦国足軽・雑兵たちの過酷なリアル（自前装備・略奪給与・戦場での奴隷狩り）',
  '⚔️ 戦国合戦の兵站とサバイバル飯（兵糧丸・味噌玉・現地調達・水不足地獄）',
  '⚔️ 戦国武将たちのリアルな死因と奇病（破傷風・梅毒・脳卒中・不衛生な戦傷治療）',
  '⚔️ 戦国時代の情報戦・リアル忍者工作（素破・透破・偽情報・合戦前の裏切り工作）',
  '⚔️ 戦国城郭の防衛ギミックと籠城地獄（落とし穴・隠し狭間・飢餓地獄・共食いの恐怖）',
  '⚔️ 戦国武将の過酷な日常とルーティン（早朝起床・暗殺対策・影武者・睡眠管理）',
  '⚔️ 戦国時代の火縄銃と最新兵器革命（火薬の密輸・南蛮技術・弾丸の材料調達）',
  '⚔️ 武士道以前のリアルな裏切りと処世術（寝返りの相場・人質ビジネス・下剋上の掟）',
  '⚔️ 戦国大名の領国経営とブラック労働（一揆鎮圧・治水工事の過酷労働・農民搾取）',
  '⚔️ 戦国の女性たちの政略と過酷な運命（政略結婚・人質生活・落城時の決断）',
  '🏪 コンビニ弁当・総菜を支える超絶食品科学（菌との戦い・超急速冷凍・pH調整剤の真実）',
  '🏪 コンビニ物流・24時間供給の裏側（ドミナント戦略・3便配送・深夜の店舗オペレーション）',
  '🏪 定番ヒット商品の開発ウラ歴史（おにぎりフィルム革命・チキン戦争・PB商品の誕生）',
  '🏪 コンビニスイーツの激闘と開発秘話（専門店超えの生クリーム・シュークリーム戦争・低糖質開発）',
  '🏪 清涼飲料水・エナジードリンクの販売戦略（棚割り戦争・自販機ビジネス・人工甘味料の進化）',
  '🏪 冷凍食品とレトルトパウチの宇宙級技術（解凍してもサクサク・常温保存の限界・宇宙食技術）',
  '🏪 スナック菓子・ポテトチップスの味覚工学（ポテト品種改良・油の酸化防止・やみつきパウダー）',
  '🏪 インスタントラーメン・カップ麺の超進化（油揚げ麺の奇跡・生麺食感の追求・粉末スープの秘密）',
  '🏪 食品工場のオートメーションと異物混入防止（超音波カッター・X線検査機・秒速パック技術）',
  '🏪 コンビニ店長・オーナーの知られざる経営実態（廃棄ロス問題・本部との契約・深夜ワンオペ）',
  '💰 バブル期の狂乱地上げ屋とマネーゲーム（地上げの手口・札束攻勢・銀行の過剰融資）',
  '💰 バブル期の異常な金遣いと夜の街（アッシーメッシー・高級ディスコ狂乱・1万円札タクシー）',
  '💰 バブル期の超高級車・外車ブーム狂想曲（シーマ現象・ベンツ転売・ローン地獄）',
  '💰 狂気の不動産神話とリゾート開発破綻（山林投機・ゴルフ場会員権・未完の巨大テーマパーク）',
  '💰 バブル期の就職戦線・超売り手市場の伝説（内定拘束ハワイ旅行・交通費バラマキ・青田買い）',
  '💰 企業マネーのアート爆買いと怪しい絵画商法（ゴッホ落札合戦・美術品担保・贋作スキャンダル）',
  '💰 バブル崩壊の引き金と銀行破綻パニック（総量規制・不良債権地獄・山一證券と拓銀の最後）',
  '💰 狂乱の株価高騰とNTT株上場ショック（財テクブーム・主婦の株取引・仕手筋の暗躍）',
  '💰 バブル期のトレンディドラマと消費文化（ワンレンボディコン・クリスマス高級ホテル争奪戦）',
  '💰 失われた30年の幕開け・借金王たちの末路（自己破産ドミノ・夜逃げ・怪死事件のウラ側）',
  '🍣 寿司の進化史・屋台のおにぎりサイズから高級店へ（発酵熟成・酢飯誕生・冷蔵技術革命）',
  '🍣 蕎麦・天ぷら・うどんの誕生と江戸庶民闘争（二八蕎麦の謎・屋台立ち食い・出汁の東西格差）',
  '🍣 ラーメン激動の100年史・屋台から世界的国民食へ（浅草来々軒・ご当地ラーメン・スープ進化論）',
  '🍣 鰻（うなぎ）の蒲焼と土用丑の日の仕掛け（平賀源内のマーケティング・背開き腹開き・秘伝タレ）',
  '🍣 日本のカレーライス独自進化論（海軍カレー・学校給食・カレールーの量産化技術）',
  '🍣 豆腐・納豆・味噌・醤油の発酵技術ウラ歴史（寺院の精進料理・麹菌の奇跡・長期保存の知恵）',
  '🍣 日本人の肉食解禁とすき焼き・牛鍋パニック（明治の肉食令・屠殺への偏見・文明開化の味）',
  '🍣 和菓子と羊羹・砂糖が変えた日本の甘味史（南蛮渡来の砂糖・虎屋の歴史・茶道とおもてなし）',
  '🍣 お茶・抹茶の伝来と戦国政治闘争（栄西の養生訓・千利休の茶の湯・茶器の異常な価格）',
  '🍣 日本酒づくりの歴史と酒蔵サバイバル（口噛み酒・三段仕込み・灘の宮水・銘酒の誕生）',
  '📜 教科書に載らない戦国三英傑の変人奇癖（信長の癇癪・秀吉の女好き妄執・家康の健康オタク）',
  '📜 文豪たちの破天荒すぎるクズエピソード（太宰治の心中未遂・谷崎潤一郎の妻譲渡・石川啄木の借金）',
  '📜 幕末志士たちのリアルな素顔と武勇伝のウラ（坂本龍馬のピストル・西郷隆盛の肥満・新選組の粛清）',
  '📜 世界の天才科学者・発明家の奇行録（ニュートンの針刺し・エジソンの睡眠法・テスラの潔癖症）',
  '📜 世界の独裁者・暴君たちの異常な日常（ヒトラーのベジタリアン・ネロの狂気・スターリンの疑心暗鬼）',
  '📜 古代の哲学者・思想家たちのブッ飛んだ死因（タレスの井戸転落・ディオゲネスの樽生活・クリュシッポスの爆笑死）',
  '📜 平安貴族たちの優雅な日常の裏にある泥臭い現実（藤原道長の糖尿病・お風呂嫌い・生々しい呪詛合戦）',
  '📜 日本の歴代天皇・将軍たちの知られざる奇癖（犬公方綱吉の真実・足利義政の引きこもり・趣味偏愛）',
  '📜 世界の名将・軍人たちの意外な弱点とトラウマ（ナポレオンの猫恐怖症・カエサルの薄毛隠し・アレクサンドロス）',
  '📜 歴史に名を残した芸術家たちの狂気と偏執（ダ・ヴィンチの解剖ノート・ミケランジェロの不潔・ピカソの女性遍歴）',
  '🚂 文明開化パニック・西洋化に怯えた人々の珍事件（散髪脱刀令・牛鍋ブーム・鉄道への恐怖）',
  '🚂 明治の警察制度と犯罪捜査の夜明け（サーベル巡査・西洋式指紋捜査・監獄制度の近代化）',
  '🚂 鉄道開通の狂乱と鉄道忌避伝説（蒸気機関車は火の車・靴を脱いで乗車・時刻表パニック）',
  '🚂 明治の学校制度導入と寺子屋消滅の悲喜劇（学制反対一揆・洋装制服・英語教育の混乱）',
  '🚂 明治の感染症パニックと衛生警察の誕生（コレラ大流行・消毒液への恐怖・隔離病棟の暴動）',
  '🚂 西洋医学vs漢方医学・医師免許の激闘（脚気の原因論争・森鴎外の過ち・北里柴三郎の孤軍奮闘）',
  '🚂 明治の郵便・電信ネットワーク革命（飛脚の失業・電信柱への迷信・前島密の郵便制度）',
  '🚂 廃藩置県と武士たちの失業サバイバル（秩禄処分・士族の商法・西南戦争への導火線）',
  '🚂 明治の洋服・ファッション革命（洋装令・鹿鳴館のダンス狂騒・下着の普及と混乱）',
  '🚂 明治の新聞・メディアとゴシップ合戦（瓦版から日刊紙へ・筆禍事件・毒婦高橋お伝騒動）',
  '🏯 参勤交代サバイバル・大名行列の地獄の台所事情（莫大な移動費用・見栄の借金・大名貸し）',
  '🏯 幕末・藩政改革のウラ技と財政再建（専売制・偽金鋳造・借金踏み倒し作戦）',
  '🏯 江戸幕府の貨幣改鋳とインフレ地獄（荻原重秀の小判改鋳・田沼意次の経済政策・米価乱高下）',
  '🏯 大名貸し商人たちのエグい回収テクニック（三井・鴻池の金融力・藩への貸出停止・担保差し押さえ）',
  '🏯 天災と飢饉サバイバル・藩の緊急経済対策（浅間山噴火・天保の飢饉・備蓄米倉庫の攻防）',
  '🏯 幕府の御用金徴発と豪商たちの抵抗（無理やり献金・資産隠し・町人貴族の台頭）',
  '🏯 抜け荷・密貿易に手を染めた外様大名（薩摩藩の琉球密貿易・佐賀藩の陶磁器輸出・長州の抜け荷）',
  '🏯 旗本・御家人の借金地獄と札差ビジネス（札差の法外な利息・養子縁組による家督売り買い・夜逃げ）',
  '🏯 江戸城の維持費と大奥の巨額予算（大奥の年間経費・着物代の浪費・女中たちの賄賂工作）',
  '🏯 幕府最後の軍制改革とフランス借款（横須賀製鉄所・幕府陸軍の近代化・消えた徳川埋蔵金）',
  '🏃‍♂️ 日本古来の超人身体能力・ナンバ走りと飛脚の謎（1日100km走破・骨格の使い方・歩法）',
  '🏃‍♂️ 古武術・甲冑着用時の驚異の身体操法（古流柔術・重心移動・鎧を着たまま泳ぐ甲冑水泳）',
  '🏃‍♂️ 山伏・修験者たちの超人山岳踏破技術（断崖絶壁走破・野草サバイバル・呼吸法とトランス状態）',
  '🏃‍♂️ 古代・中世の荷運び人「強力（ごうりき）」の怪力伝説（米俵5俵背負い・山岳運搬・歩荷の技術）',
  '🏃‍♂️ 忍者のリアルな身体訓練と跳躍・消術（忍び足・関節外し・壁登り道具・呼吸法）',
  '🏃‍♂️ 古代・中世の職人たちの超絶手仕事と道具工学（宮大工の木組み・日本刀の鍛造・野鍛冶の技術）',
  '🏃‍♂️ 和船・弁才船の操船技術と海の荒くれ者（逆風帆走・潮の読み方・遭難漂流サバイバル）',
  '🏃‍♂️ 鷹狩りとマタギの狩猟身体術（山岳の追跡技術・クマ撃ちの掟・鷹の調教メソッド）',
  '🏃‍♂️ 江戸・中世の早飛脚と駅伝通信リレー（継飛脚のネットワーク・夜間走行・関所突破の特権）',
  '🏃‍♂️ 古代相撲・力石持ち上げに見る怪力文化（力石の重量記録・野見宿禰の足技・農村の力比べ行事）',
  '📻 昭和闇市と戦後ヤミ米サバイバル（カストリ酒・代用食・買い出し列車の死闘）',
  '📻 三種の神器と昭和家電ブームの裏側（白黒テレビ・洗濯機・冷蔵庫が変えた家庭革命）',
  '📻 高度経済成長期の猛烈サラリーマン生態（24時間戦えますか・社内タバコ天国・終身雇用の光と影）',
  '📻 昭和の団地ブームと生活スタイルの激変（2DKの間取り革命・ステンレス流し台・団地族のステータス）',
  '📻 昭和の子ども文化と駄菓子屋ワールド（ベーゴマ・メンコ・10円ゲーム・謎の粉末ジュース）',
  '📻 昭和の公害問題と公衆衛生の闘い（スモッグ警報・光化学スモッグ・ゴミ戦争）',
  '📻 昭和歌謡・レコード産業とテレビ黄金期（カラーテレビ普及・紅白歌合戦の視聴率・アイドル誕生）',
  '📻 昭和の交通戦争とマイカーブーム（カローラvsサニー・暴走族問題・高速道路網の建設）',
  '📻 昭和オカルトブームとノストラダムス現象（スプーン曲げ・コックリさん・心霊写真ブーム）',
  '📻 昭和のインスタント食品大革命（即席ラーメン誕生・レトルトカレー・自販機うどん）',
  '🧠 脳がバグる錯覚・認知バイアスの科学（日常で起きる記憶改ざん・選択盲・サブリミナル効果）',
  '🧠 睡眠と夢のヤバすぎる未解明メカニズム（金縛りの正体・明晰夢・睡眠不足の脳破壊）',
  '🧠 痛みと脳の騙し合い・ファントムペインの謎（幻肢痛・プラセボ効果・辛味は痛覚の真実）',
  '🧠 味覚と嗅覚の超絶シンクロ・味の錯覚（イチゴ味の正体・鼻をつまむと消える味・偏食の科学）',
  '🧠 視覚と盲点のトリック・脳が勝手に補完する世界（チェッカーシャドウ錯視・動体視力・視野狭窄）',
  '🧠 恐怖とストレスが引き起こす肉体異常（アドレナリンラッシュ・凍りつき反応・心臓麻痺の科学）',
  '🧠 筋肉と運動神経の限界リミッター（火事場の馬鹿力の正体・筋肥大の仕組み・筋肉痛の謎）',
  '🧠 腸内細菌とセカンドブレイン（腸が操る感情と食欲・セロトニンの9割は腸・腸内フローラ）',
  '🧠 体温調節と汗・鳥肌の進化の痕跡（なぜ寒気で鳥肌が立つのか・汗腺の発達・熱中症のメカニズム）',
  '🧠 記憶の定着と忘却のスーパーメカニズム（エビングハウスの忘却曲線・海馬の選別・デジャブの正体）',
  '🌌 宇宙の極限環境とヤバすぎる天体（ダイヤモンドの雨・超巨大ブラックホール・死の惑星）',
  '🌌 太陽系の知られざるヤバい衛星たち（エウロパの地下海洋・タイタンのメタン雨・イオの火山地獄）',
  '🌌 地球深部・マントルとコアの未知の世界（地底の超高温高圧・マントル対流・地磁気逆転の危機）',
  '🌌 深海と極限生物のエイリアンワールド（熱水噴出孔・メガマウス・超高圧に耐える深海生物）',
  '🌌 地球史最大の大量絶滅イベント（全球凍結スノーボール・ペルム紀大絶滅・小惑星衝突の瞬間）',
  '🌌 超新星爆発とガンマ線バーストの脅威（直撃なら地球滅亡・ベテルギウスの異変・宇宙線シャワー）',
  '🌌 時間と空間の歪み・一般相対性理論のリアル（重力で遅れる時間・ブラックホールの事象の地平面）',
  '🌌 暗黒物質（ダークマター）と暗黒エネルギーの謎（宇宙の95%は正体不明・宇宙膨張の加速）',
  '🌌 フェルミのパラドックスと地球外生命の探索（なぜ宇宙人に会えないのか・ドレイクの方程式）',
  '🌌 宇宙の終焉シナリオ・最後の瞬間（ビッグフリーズ・ビッグリップ・熱的死の静寂）'
];

export const QUOTES_THEMES = [
  '🪷 ブッダの教え・人間関係の執着を手放す哲学（怒り・迷い・心の処方箋）',
  '🦅 ニーチェの哲学・孤独と自己超克（周りに流されず自分の意志で生きる道）',
  '⚔️ 戦国武将・英雄たちの死生観と冷徹な決断（信長・家康・秀吉・政宗）',
  '☕ 文豪たちの愛憎と人生論（太宰治・芥川・漱石・三島が残した言葉）',
  '🗡️ 宮本武蔵・武士道の勝負哲学（迷いを断ち切り勝機を掴む極意）',
  '🏛️ 古代ギリシャ・ローマ哲学（ストア派・皇帝マルクス・アウレリウス・セネカの知恵）',
  '🍵 禅と茶道・侘び寂びの美学（千利休・良寛・何もない贅沢）',
  '👑 幕末志士たちの熱狂と覚悟（坂本龍馬・吉田松陰・西郷隆盛の信念）',
  '🏮 勝海舟・器の大きさと処世術（怒らず争わず時代を動かす知恵）',
  '🕊️ 老子・荘子のタオイズム（無為自然・肩の力を抜いて楽に生きる道）'
];

export const FOLKLORE_THEMES = [
  '🏚️ 日本各地の消えた村・忌み地の怪異（因習・封印された集落・禁足地）',
  '🗡️ 江戸・明治の辻斬りと闇夜の怪異伝説（都市伝説・実在した怪事件）',
  '🏥 昭和・近代の封印された記録（廃病院・人体実験・未解決の公文書）',
  '⛩️ 山岳信仰とマタギの禁忌（山に潜むモノ・神隠し・異界の掟）',
  '🎭 浅草・見世物小屋と大正奇譚（異形の興行・怪奇幻想・幻術）',
  '🌊 海洋怪異・漂流船と海の怪異（幽霊船・底知れぬ深海・水神の祟り）',
  '📜 古文書に墨塗りで隠された大名家の怪異（呪われた血筋・お家騒動）',
  '🚂 鉄道怪異・深夜の終電と存在しない駅（境界線の怪談・都市伝説）',
  '🌾 寒村の民間伝承・豊作祈願の裏の儀式（人柱・飢饉の記憶・座敷童）',
  '🕳️ 地下空間・戦時中の防空壕と遺棄された施設（闇に眠る声・未踏の遺構）'
];

export const CRAFT_THEMES = [
  '🪵 日本建築・宮大工の神技（1000年倒れない五重塔・木組みの奇跡）',
  '🗡️ 日本刀・刀鍛冶の宇宙（鋼の鍛錬・正宗・たたら製鉄の炎）',
  '🍣 和食・江戸前鮨職人の極致（仕込み・温度・熟成・米と魚の対話）',
  '🥢 伝統工芸・漆器と蒔絵（輪島塗・100年輝く器・素手の研ぎ澄まし）',
  '👘 西陣織・絹織物の極致（極細金糸・肉眼を超えた文様美）',
  '⚒️ 切子・江戸硝子職人の神業（下書きなしのカット・光の屈折）',
  '🍵 陶芸・茶陶と炎の対話（千利休の黒楽茶碗・登り窯の奇跡）',
  '🔥 たたら製鉄・砂鉄と炭の錬金術（三日三晩眠らず見守る村下の眼）',
  '🪓 銘木・屋久杉と山師の掟（巨木を倒す呼吸・森との約束）',
  '🍱 曲げわっぱ・杉板を湯気で曲げる技術（0.1ミリの指先の記憶）'
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
