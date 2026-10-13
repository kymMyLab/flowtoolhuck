export type TasteSampleCategory = 'students' | 'edo' | 'adult';

export interface TasteGalleryItem {
  id: string;
  tasteKey: string; // TASTESのオブジェクトキーと完全一致
  displayName: string;
  category: 'anime' | 'japanese' | 'cinematic' | 'art';
  descriptionJp: string;
  samples?: {
    students?: string;
    edo?: string;
    adult?: string;
  };
}

const CDN_BASE = 'https://raw.githubusercontent.com/kymMyLab/flowtoolhuck/main/assets/tastes';

export const TASTE_GALLERY_DATA: TasteGalleryItem[] = [
  {
    id: 'retro_witch',
    tasteKey: '🌙 ノスタルジック魔女ファンタジー・極細線画 (Retro Fantasy Whisper-Line)',
    displayName: '🌙 ノスタルジック魔女ファンタジー・極細線画',
    category: 'anime',
    descriptionJp: '極細の鉛筆ライクな繊細な輪郭線と、ノスタルジックな粒子感・温かいボケ光が特徴のアニメ調。',
    samples: {
      students: `${CDN_BASE}/retro_witch/students.jpg`,
      edo: `${CDN_BASE}/retro_witch/edo.jpg`,
      adult: `${CDN_BASE}/retro_witch/adult.jpg`,
    }
  },
  {
    id: 'city_pop',
    tasteKey: '🌃 ネオ・シティポップ・ナイトウォーク (Neo-City Pop Nightwalk Anime)',
    displayName: '🌃 ネオ・シティポップ・ナイトウォーク',
    category: 'anime',
    descriptionJp: 'ネオンピンク＆シアンの鮮やかな夜景光彩、雨の反射、Lo-Fiな質感がエモーショナルな現代ポップアート。',
    samples: {
      students: `${CDN_BASE}/city_pop/students.jpg`,
      edo: `${CDN_BASE}/city_pop/edo.jpg`,
      adult: `${CDN_BASE}/city_pop/adult.jpg`,
    }
  },
  {
    id: 'hokusai_ukiyoe',
    tasteKey: '🌊 葛飾北斎・超写実肉筆浮世絵 (Hyper-Realistic Hokusai Nikuhitsu Ukiyo-e)',
    displayName: '🌊 葛飾北斎・超写実肉筆浮世絵',
    category: 'japanese',
    descriptionJp: '葛飾北斎の肉筆画を再現した最高峰の浮世絵。本物の和紙繊維・藍摺・鉱物顔料・墨筆の擦れを完全再現。',
    samples: {
      students: `${CDN_BASE}/hokusai_ukiyoe/students.jpg`,
      edo: `${CDN_BASE}/hokusai_ukiyoe/edo.jpg`,
      adult: `${CDN_BASE}/hokusai_ukiyoe/adult.jpg`,
    }
  },
  {
    id: 'luxury_gacha',
    tasteKey: '🍸 ラグジュアリー・ソシャゲ美麗キービジュアル (High-End Gacha Splash Art)',
    displayName: '🍸 ラグジュアリー・ソシャゲ美麗キービジュアル',
    category: 'anime',
    descriptionJp: '高級感あふれるハイエンドゲームのキービジュアル調。深いグラデーション陰影と金装飾の輝き。',
  },
  {
    id: 'seinen_manga',
    tasteKey: '🍷 青年誌カバー・艶麗アイライン＆ソリッドセル (Modern Seinen Manga Cover Art)',
    displayName: '🍷 青年誌カバー・艶麗アイライン＆ソリッドセル',
    category: 'anime',
    descriptionJp: '青年誌の表紙を飾るソリッドな2値セル陰影と、濃密なアイラインが際立つスタイリッシュな画風。',
  },
  {
    id: 'neo_japonisme',
    tasteKey: '🎨 レトロモダン・ネオ・ジャポニスム (Retro-Modern Neo-Japonisme)',
    displayName: '🎨 レトロモダン・ネオ・ジャポニスム',
    category: 'japanese',
    descriptionJp: '大正浪漫とサイバーポップが融合した新日本画。金箔や幾何学模様が舞うドラマチックな構図。',
  },
  {
    id: 'cinematic_sky',
    tasteKey: '✨ エモーショナル・シネマティック・スカイ (Emotional Cinematic Sky Anime)',
    displayName: '✨ エモーショナル・シネマティック・スカイ',
    category: 'anime',
    descriptionJp: '新海誠風の圧倒的な積乱雲・黄昏の光彩散乱・映画クオリティのエモーショナルな背景美。',
  },
  {
    id: 'dark_chiaroscuro',
    tasteKey: '⚔️ ダークファンタジー・重厚陰影 (Dark Chiaroscuro Anime)',
    displayName: '⚔️ ダークファンタジー・重厚陰影',
    category: 'cinematic',
    descriptionJp: 'キアロスクーロの劇的な明暗対比、深淵の闇と火の粉のハイライトが織りなすダークファンタジー。',
  },
  {
    id: 'intense_manga',
    tasteKey: '🖋 白黒劇画・超絶インクマンガ (Intense Monochrome Manga)',
    displayName: '🖋 白黒劇画・超絶インクマンガ',
    category: 'art',
    descriptionJp: '渇筆の墨飛沫と超精密スクリーントーンが炸裂する、圧倒的リアリズムの白黒劇画。',
  },
  {
    id: 'edo_humor',
    tasteKey: '🏮 ゆる浮世絵・戯画ギャグ調 (Humorous Edo Ukiyo-e Manga)',
    displayName: '🏮 ゆる浮世絵・戯画ギャグ調',
    category: 'japanese',
    descriptionJp: 'ゆるい脱力感とユーモラスな表情が癖になる江戸時代劇画ポップアート。',
  },
  {
    id: 'choju_giga',
    tasteKey: '🐸 鳥獣戯画・国宝絵巻モノクローム (Chōjū-giga National Treasure Ink Scroll)',
    displayName: '🐸 鳥獣戯画・国宝絵巻モノクローム',
    category: 'japanese',
    descriptionJp: '平安・鎌倉の国宝鳥獣人物戯画を完全再現。墨絵のたらし込みと古典和紙の風格。',
  },
  {
    id: 'art_nouveau',
    tasteKey: '👑 アール・ヌーヴォー・宮廷エレガンス (Art Nouveau Imperial Elegance)',
    displayName: '👑 アール・ヌーヴォー・宮廷エレガンス',
    category: 'art',
    descriptionJp: 'ミュシャにインスパイアされた宮廷装飾絵画。流麗な金泥の曲線美と植物レースモチーフ。',
  },
  {
    id: 'moe_hatching',
    tasteKey: '🌸 日常系萌えアニメ・ハッチングチーク (Moe Daily Hatching Blush Anime)',
    displayName: '🌸 日常系萌えアニメ・ハッチングチーク',
    category: 'anime',
    descriptionJp: 'ほっぺの縦線ハッチングチークが愛らしい、王道の日常系きらら系TVアニメ調。',
  },
  {
    id: 'pastel_chill',
    tasteKey: '🎨 くすみパステル・チルスケッチ (Muted Pastel Chill Sketch Anime)',
    displayName: '🎨 くすみパステル・チルスケッチ',
    category: 'art',
    descriptionJp: 'くすみパステルカラーと優しいスケッチ線画。Lo-Fiミュージックビデオのようなチルな空気感。',
  },
  {
    id: 'movie_teal',
    tasteKey: '🌃 劇場版フラットセル・夜景ティール (Cinematic Flat Cel Teal Anime)',
    displayName: '🌃 劇場版フラットセル・夜景ティール',
    category: 'cinematic',
    descriptionJp: '劇場版アニメの夜景カットのようなティール＆オレンジの映画的カラーグレーディング。',
  },
  {
    id: 'retro_90s',
    tasteKey: '📼 90s平成深夜アニメ・セル画キャプチャ (90s Retro Cel Animation CRT)',
    displayName: '📼 90s平成深夜アニメ・セル画キャプチャ',
    category: 'anime',
    descriptionJp: '90年代のVHS走査線・CRTブラウン管・手描きセル画のにじみを忠実に再現したレトロアニメ。',
  },
  {
    id: 'showa_horror',
    tasteKey: '🖋️ 昭和怪異ホラー・カケアミ劇画 (Vintage Japanese Horror Crosshatch)',
    displayName: '🖋️ 昭和怪異ホラー・カケアミ劇画',
    category: 'art',
    descriptionJp: '昭和の怪奇漫画のような緻密なカケアミと黄ばんだザラ紙印刷のホラーテイスト。',
  },
  {
    id: 'cyber_blueprint',
    tasteKey: '📐 サイバー・テクニカル・ブループリント (Cyber Technical Blueprint)',
    displayName: '📐 サイバー・テクニカル・ブループリント',
    category: 'art',
    descriptionJp: '青焼き設計図の上にホログラフィックHUDが浮かぶ精密サイバーエンジニアリング。',
  },
  {
    id: 'natgeo_macro',
    tasteKey: '🔬 ナショジオ・超深度マクロ自然科学 (NatGeo Macro Science & Crystal)',
    displayName: '🔬 ナショジオ・超深度マクロ自然科学',
    category: 'cinematic',
    descriptionJp: 'ナショナルジオグラフィック風の超深度マクロ結晶写真。科学ドキュメンタリーの質感。',
  },
  {
    id: 'bauhaus',
    tasteKey: '🏛️ バウハウス・幾何学キネティックアート (Bauhaus Geometric Kinetic)',
    displayName: '🏛️ バウハウス・幾何学キネティックアート',
    category: 'art',
    descriptionJp: '洗練された幾何学立体とコンクリート・真鍮のモダンアートギャラリー空間。',
  },
  {
    id: 'davinci_codex',
    tasteKey: '📜 ダ・ヴィンチ古代手稿・飛行機械スケッチ (Da Vinci Codex & Antique Sketch)',
    displayName: '📜 ダ・ヴィンチ古代手稿・飛行機械スケッチ',
    category: 'art',
    descriptionJp: 'レオナルド・ダ・ヴィンチの直筆手稿・解剖図・飛行機械の羊皮紙スケッチ。',
  },
];
