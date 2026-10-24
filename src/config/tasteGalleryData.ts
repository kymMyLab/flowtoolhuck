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
    id: 'european_classical_manor',
    tasteKey: '🏰 欧風クラシカル・黒髪ノスタルジー (Nostalgic European Manor & Black Hair Academy)',
    displayName: '🏰 欧風クラシカル・黒髪ノスタルジー',
    category: 'anime',
    descriptionJp: '歴史ある欧風洋館の大階段・アーチ窓の夕暮れに佇む黒髪の制服少女。京都アニメーション・新海誠作品を思わせる情緒豊かな劇場版アニメ調。',
    samples: {
      students: `https://raw.githubusercontent.com/kymMyLab/flowtoolhuck/78667178dbc5b83984b42c098ba201f622205e89/assets/tastes/european_classical_manor/students.jpg`,
      edo: `https://raw.githubusercontent.com/kymMyLab/flowtoolhuck/78667178dbc5b83984b42c098ba201f622205e89/assets/tastes/european_classical_manor/edo.jpg`,
      adult: `https://raw.githubusercontent.com/kymMyLab/flowtoolhuck/78667178dbc5b83984b42c098ba201f622205e89/assets/tastes/european_classical_manor/adult.jpg`,
    }
  },
  {
    id: 'prismatic_luminous',
    tasteKey: '💎 エターナル・プリズムルミナス (Ethereal Prismatic Lineless)',
    displayName: '💎 エターナル・プリズムルミナス',
    category: 'anime',
    descriptionJp: '万華鏡のようなプリズム屈折光・クリスタル・浮遊粒子が輝く、主線のない幻想的なルミナスアニメ調。アオハル青春からファンタジーまで、圧倒的な透明感と光の階調美を描き出す。',
    samples: {
      students: `https://raw.githubusercontent.com/kymMyLab/flowtoolhuck/082a3be/assets/tastes/prismatic_luminous/students.jpg`,
      edo: `https://raw.githubusercontent.com/kymMyLab/flowtoolhuck/082a3be/assets/tastes/prismatic_luminous/edo.jpg`,
      adult: `https://raw.githubusercontent.com/kymMyLab/flowtoolhuck/082a3be/assets/tastes/prismatic_luminous/adult.jpg`,
    }
  },
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
    id: 'seinen_manga',
    tasteKey: '🍷 青年誌カバー・艶麗アイライン＆ソリッドセル (Modern Seinen Manga Cover Art)',
    displayName: '🍷 青年誌カバー・艶麗アイライン＆ソリッドセル',
    category: 'anime',
    descriptionJp: '青年誌の表紙を飾るソリッドな2値セル陰影と、濃密なアイラインが際立つスタイリッシュな画風。',
    samples: {
      students: `${CDN_BASE}/seinen_manga/students.jpg`,
      edo: `${CDN_BASE}/seinen_manga/edo.jpg`,
      adult: `${CDN_BASE}/seinen_manga/adult.jpg`,
    }
  },
  {
    id: 'neo_japonisme',
    tasteKey: '🎨 レトロモダン・ネオ・ジャポニスム (Retro-Modern Neo-Japonisme)',
    displayName: '🎨 レトロモダン・ネオ・ジャポニスム',
    category: 'japanese',
    descriptionJp: '大正浪漫とサイバーポップが融合した新日本画。金箔や幾何学模様が舞うドラマチックな構図。',
    samples: {
      students: `${CDN_BASE}/neo_japonisme/students.jpg`,
      edo: `${CDN_BASE}/neo_japonisme/edo.jpg`,
      adult: `${CDN_BASE}/neo_japonisme/adult.jpg`,
    }
  },
  {
    id: 'cinematic_sky',
    tasteKey: '✨ エモーショナル・シネマティック・スカイ (Emotional Cinematic Sky Anime)',
    displayName: '✨ エモーショナル・シネマティック・スカイ',
    category: 'anime',
    descriptionJp: '新海誠風の圧倒的な積乱雲・黄昏の光彩散乱・映画クオリティのエモーショナルな背景美。',
    samples: {
      students: `${CDN_BASE}/cinematic_sky/students.jpg`,
      edo: `${CDN_BASE}/cinematic_sky/edo.jpg`,
      adult: `${CDN_BASE}/cinematic_sky/adult.jpg`,
    }
  },
  {
    id: 'dark_chiaroscuro',
    tasteKey: '⚔️ ダークファンタジー・重厚陰影 (Dark Chiaroscuro Anime)',
    displayName: '⚔️ ダークファンタジー・重厚陰影',
    category: 'cinematic',
    descriptionJp: 'キアロスクーロの劇的な明暗対比、深淵の闇と火の粉のハイライトが織りなすダークファンタジー。',
    samples: {
      students: `${CDN_BASE}/dark_chiaroscuro/students.jpg`,
      edo: `${CDN_BASE}/dark_chiaroscuro/edo.jpg`,
      adult: `${CDN_BASE}/dark_chiaroscuro/adult.jpg`,
    }
  },
  {
    id: 'intense_manga',
    tasteKey: '🖋 白黒劇画・超絶インクマンガ (Intense Monochrome Manga)',
    displayName: '🖋 白黒劇画・超絶インクマンガ',
    category: 'art',
    descriptionJp: '渇筆の墨飛沫と超精密スクリーントーンが炸裂する、圧倒的リアリズムの白黒劇画。',
    samples: {
      students: `${CDN_BASE}/intense_manga/students.jpg`,
      edo: `${CDN_BASE}/intense_manga/edo.jpg`,
      adult: `${CDN_BASE}/intense_manga/adult.jpg`,
    }
  },
  {
    id: 'edo_humor',
    tasteKey: '🏮 ゆる浮世絵・戯画ギャグ調 (Humorous Edo Ukiyo-e Manga)',
    displayName: '🏮 ゆる浮世絵・戯画ギャグ調',
    category: 'japanese',
    descriptionJp: 'ゆるい脱力感とユーモラスな表情が癖になる江戸時代劇画ポップアート。',
    samples: {
      students: `${CDN_BASE}/edo_humor/students.jpg`,
      edo: `${CDN_BASE}/edo_humor/edo.jpg`,
      adult: `${CDN_BASE}/edo_humor/adult.jpg`,
    }
  },
  {
    id: 'choju_giga',
    tasteKey: '🐸 鳥獣戯画・国宝絵巻モノクローム (Chōjū-giga National Treasure Ink Scroll)',
    displayName: '🐸 鳥獣戯画・国宝絵巻モノクローム',
    category: 'japanese',
    descriptionJp: '平安・鎌倉の国宝鳥獣人物戯画を完全再現。墨絵のたらし込みと古典和紙の風格。',
    samples: {
      students: `${CDN_BASE}/choju_giga/students.jpg`,
      edo: `${CDN_BASE}/choju_giga/edo.jpg`,
      adult: `${CDN_BASE}/choju_giga/adult.jpg`,
    }
  },
  {
    id: 'art_nouveau',
    tasteKey: '👑 アール・ヌーヴォー・宮廷エレガンス (Art Nouveau Imperial Elegance)',
    displayName: '👑 アール・ヌーヴォー・宮廷エレガンス',
    category: 'art',
    descriptionJp: 'ミュシャにインスパイアされた宮廷装飾絵画。流麗な金泥の曲線美と植物レースモチーフ。',
    samples: {
      students: `${CDN_BASE}/art_nouveau/students.jpg`,
      edo: `${CDN_BASE}/art_nouveau/edo.jpg`,
      adult: `${CDN_BASE}/art_nouveau/adult.jpg`,
    }
  },
  {
    id: 'moe_hatching',
    tasteKey: '🌸 日常系萌えアニメ・ハッチングチーク (Moe Daily Hatching Blush Anime)',
    displayName: '🌸 日常系萌えアニメ・ハッチングチーク',
    category: 'anime',
    descriptionJp: 'ほっぺの縦線ハッチングチークが愛らしい、王道の日常系きらら系TVアニメ調。',
    samples: {
      students: `${CDN_BASE}/moe_hatching/students.jpg`,
      edo: `${CDN_BASE}/moe_hatching/edo.jpg`,
      adult: `${CDN_BASE}/moe_hatching/adult.jpg`,
    }
  },
  {
    id: 'pastel_chill',
    tasteKey: '🎨 くすみパステル・チルスケッチ (Muted Pastel Chill Sketch Anime)',
    displayName: '🎨 くすみパステル・チルスケッチ',
    category: 'art',
    descriptionJp: 'くすみパステルカラーと優しいスケッチ線画。Lo-Fiミュージックビデオのようなチルな空気感。',
    samples: {
      students: `${CDN_BASE}/pastel_chill/students.jpg`,
      edo: `${CDN_BASE}/pastel_chill/edo.jpg`,
      adult: `${CDN_BASE}/pastel_chill/adult.jpg`,
    }
  },
  {
    id: 'movie_teal',
    tasteKey: '🌃 劇場版フラットセル・夜景ティール (Cinematic Flat Cel Teal Anime)',
    displayName: '🌃 劇場版フラットセル・夜景ティール',
    category: 'cinematic',
    descriptionJp: '劇場版アニメの夜景カットのようなティール＆オレンジの映画的カラーグレーディング。',
    samples: {
      students: `${CDN_BASE}/movie_teal/students.jpg`,
      edo: `${CDN_BASE}/movie_teal/edo.jpg`,
      adult: `${CDN_BASE}/movie_teal/adult.jpg`,
    }
  },
  {
    id: 'retro_90s',
    tasteKey: '📼 90s平成深夜アニメ・セル画キャプチャ (90s Retro Cel Animation CRT)',
    displayName: '📼 90s平成深夜アニメ・セル画キャプチャ',
    category: 'anime',
    descriptionJp: '90年代のVHS走査線・CRTブラウン管・手描きセル画のにじみを忠実に再現したレトロアニメ。',
    samples: {
      students: `${CDN_BASE}/retro_90s/students.jpg`,
      edo: `${CDN_BASE}/retro_90s/edo.jpg`,
      adult: `${CDN_BASE}/retro_90s/adult.jpg`,
    }
  },
  {
    id: 'showa_horror',
    tasteKey: '🖋️ 昭和怪異ホラー・カケアミ劇画 (Vintage Japanese Horror Crosshatch)',
    displayName: '🖋️ 昭和怪異ホラー・カケアミ劇画',
    category: 'art',
    descriptionJp: '昭和の怪奇漫画のような緻密なカケアミと黄ばんだザラ紙印刷のホラーテイスト。',
    samples: {
      students: `${CDN_BASE}/showa_horror/students.jpg`,
      edo: `${CDN_BASE}/showa_horror/edo.jpg`,
      adult: `${CDN_BASE}/showa_horror/adult.jpg`,
    }
  },
  {
    id: 'cyber_blueprint',
    tasteKey: '📐 サイバー・テクニカル・ブループリント (Cyber Technical Blueprint)',
    displayName: '📐 サイバー・テクニカル・ブループリント',
    category: 'art',
    descriptionJp: '青焼き設計図の上にホログラフィックHUDが浮かぶ精密サイバーエンジニアリング。',
    samples: {
      students: `${CDN_BASE}/cyber_blueprint/students.jpg`,
      edo: `${CDN_BASE}/cyber_blueprint/edo.jpg`,
      adult: `${CDN_BASE}/cyber_blueprint/adult.jpg`,
    }
  },
  {
    id: 'natgeo_macro',
    tasteKey: '🔬 ナショジオ・超深度マクロ自然科学 (NatGeo Macro Science & Crystal)',
    displayName: '🔬 ナショジオ・超深度マクロ自然科学',
    category: 'cinematic',
    descriptionJp: 'ナショナルジオグラフィック風の超深度マクロ結晶写真。科学ドキュメンタリーの質感。',
    samples: {
      students: `${CDN_BASE}/natgeo_macro/students.jpg`,
      edo: `${CDN_BASE}/natgeo_macro/edo.jpg`,
      adult: `${CDN_BASE}/natgeo_macro/adult.jpg`,
    }
  },
  {
    id: 'bauhaus',
    tasteKey: '🏛️ バウハウス・幾何学キネティックアート (Bauhaus Geometric Kinetic)',
    displayName: '🏛️ バウハウス・幾何学キネティックアート',
    category: 'art',
    descriptionJp: '洗練された幾何学立体とコンクリート・真鍮のモダンアートギャラリー空間。',
    samples: {
      students: `${CDN_BASE}/bauhaus/students.jpg`,
      edo: `${CDN_BASE}/bauhaus/edo.jpg`,
      adult: `${CDN_BASE}/bauhaus/adult.jpg`,
    }
  },
  {
    id: 'davinci_codex',
    tasteKey: '📜 ダ・ヴィンチ古代手稿・飛行機械スケッチ (Da Vinci Codex & Antique Sketch)',
    displayName: '📜 ダ・ヴィンチ古代手稿・飛行機械スケッチ',
    category: 'art',
    descriptionJp: 'レオナルド・ダ・ヴィンチの直筆手稿・解剖図・飛行機械の羊皮紙スケッチ。',
    samples: {
      students: `${CDN_BASE}/davinci_codex/students.jpg`,
      edo: `${CDN_BASE}/davinci_codex/edo.jpg`,
      adult: `${CDN_BASE}/davinci_codex/adult.jpg`,
    }
  },

  // ── 🐾 ユーザーリクエスト追加: 動物系擬人化 ──
  {
    id: 'kemomimi_fantasy',
    tasteKey: '🦊 もふもふケモミミ・獣人ファンタジー (Fluffy Kemomimi & Beastfolk Fantasy)',
    displayName: '🦊 もふもふケモミミ・獣人ファンタジー',
    category: 'anime',
    descriptionJp: 'ふさふさの動物耳と尻尾を持つ愛らしいケモミミキャラクター。温かみのある柔らかな光とファンタジーアニメ調。',
    samples: {
      students: `${CDN_BASE}/kemomimi_fantasy/students.jpg`,
      edo: `${CDN_BASE}/kemomimi_fantasy/edo.jpg`,
      adult: `${CDN_BASE}/kemomimi_fantasy/adult.jpg`,
    }
  },
  {
    id: 'cyber_beast',
    tasteKey: '🐺 サイバー・ビーストパンク (Cyber Beastpunk & Anthropomorphic)',
    displayName: '🐺 サイバー・ビーストパンク',
    category: 'anime',
    descriptionJp: 'ネオン光彩が走るサイバー義肢と鋭い獣耳。近未来の電脳裏通りを駆けるスタイリッシュな獣人ストリート調。',
    samples: {
      students: `${CDN_BASE}/cyber_beast/students.jpg`,
      edo: `${CDN_BASE}/cyber_beast/edo.jpg`,
      adult: `${CDN_BASE}/cyber_beast/adult.jpg`,
    }
  },
  {
    id: 'retro_animaloid',
    tasteKey: '🐾 平成レトロ・戯画アニマロイド (Retro Pop Animaloid Cartoon)',
    displayName: '🐾 平成レトロ・戯画アニマロイド',
    category: 'art',
    descriptionJp: 'アメリカンカートゥーンと日本のマスコットが融合した、ポップで愛嬌たっぷりの擬人化アニマルアート。',
    samples: {
      students: `${CDN_BASE}/retro_animaloid/students.jpg`,
      edo: `${CDN_BASE}/retro_animaloid/edo.jpg`,
      adult: `${CDN_BASE}/retro_animaloid/adult.jpg`,
    }
  },

  // ── 🏮 ユーザーリクエスト追加: YouTube「ガチ江戸」歴史劇画系 ──
  {
    id: 'gachi_edo_geki',
    tasteKey: '🏮 YouTube歴史解説・ガチ江戸劇画 (Authentic Edo Documentary Gekiga)',
    displayName: '🏮 YouTube歴史解説・ガチ江戸劇画',
    category: 'japanese',
    descriptionJp: 'YouTubeの歴史深掘り動画のような重厚な墨線、和紙の繊維感、リアルな江戸庶民の陰影と本格時代考証劇画。',
    samples: {
      students: `${CDN_BASE}/gachi_edo_geki/students.jpg`,
      edo: `${CDN_BASE}/gachi_edo_geki/edo.jpg`,
      adult: `${CDN_BASE}/gachi_edo_geki/adult.jpg`,
    }
  },
  {
    id: 'edo_noir_alley',
    tasteKey: '👘 吉原裏路地・陰影浮世絵ノワール (Edo Alley Ukiyo-e Noir)',
    displayName: '👘 吉原裏路地・陰影浮世絵ノワール',
    category: 'japanese',
    descriptionJp: '行灯の茜色と漆黒の闇が織りなすシネマティックな江戸情景。格子戸の影と艶やかな着物の陰影美。',
    samples: {
      students: `${CDN_BASE}/edo_noir_alley/students.jpg`,
      edo: `${CDN_BASE}/edo_noir_alley/edo.jpg`,
      adult: `${CDN_BASE}/edo_noir_alley/adult.jpg`,
    }
  },
  {
    id: 'bakumatsu_photo_hanga',
    tasteKey: '⚔️ 幕末古写真風・木版クロニクル (Bakumatsu Tintype & Woodblock)',
    displayName: '⚔️ 幕末古写真風・木版クロニクル',
    category: 'japanese',
    descriptionJp: '幕末の湿板写真（セピア・銀塩写真）の粒子感と木版画の擦れが融合した、圧倒的リアリズムの歴史ロマン。',
    samples: {
      students: `${CDN_BASE}/bakumatsu_photo_hanga/students.jpg`,
      edo: `${CDN_BASE}/bakumatsu_photo_hanga/edo.jpg`,
      adult: `${CDN_BASE}/bakumatsu_photo_hanga/adult.jpg`,
    }
  },

  // ── 🎸 ユーザーリクエスト追加: サブカル・不良・ギャグ・特定ジャンル ──
  {
    id: 'garage_punk_live',
    tasteKey: '🎸 ガレージパンク・地下ライブハウス (Garage Punk & Underground Live)',
    displayName: '🎸 ガレージパンク・地下ライブハウス',
    category: 'art',
    descriptionJp: '地下ライブハウスの熱気、飛び散るスプレー、ハイコントラストなストロボ光とアンプの煙が渦巻くロックスタイル。',
    samples: {
      students: `${CDN_BASE}/garage_punk_live/students.jpg`,
      edo: `${CDN_BASE}/garage_punk_live/edo.jpg`,
      adult: `${CDN_BASE}/garage_punk_live/adult.jpg`,
    }
  },
  {
    id: 'showa_yankee_action',
    tasteKey: '👊 昭和ツッパリ・熱血暴走劇画 (Retro Showa Yankee Action Manga)',
    displayName: '👊 昭和ツッパリ・熱血暴走劇画',
    category: 'anime',
    descriptionJp: '80年代ヤンキー漫画のような太い黒ベタ、激しい集中線、ギラつく眼光と熱血スクリーントーン。',
    samples: {
      students: `${CDN_BASE}/showa_yankee_action/students.jpg`,
      edo: `${CDN_BASE}/showa_yankee_action/edo.jpg`,
      adult: `${CDN_BASE}/showa_yankee_action/adult.jpg`,
    }
  },
  {
    id: 'pop_slapstick_gag',
    tasteKey: '🤪 爆笑カートゥーン・スラップスティック (Slapstick Comedy & Hyper-Deform)',
    displayName: '🤪 爆笑カートゥーン・スラップスティック',
    category: 'art',
    descriptionJp: '目が飛び出る・アゴが外れる！コミカルな漫符と全身全霊のオーバーアクションが炸裂する全力ギャグ調。',
    samples: {
      students: `${CDN_BASE}/pop_slapstick_gag/students.jpg`,
      edo: `${CDN_BASE}/pop_slapstick_gag/edo.jpg`,
      adult: `${CDN_BASE}/pop_slapstick_gag/adult.jpg`,
    }
  },
  {
    id: 'shimokita_chillhop',
    tasteKey: '☕ 下北沢オルタナ・チルホップ (Shimokitazawa Indie Lo-Fi Chill)',
    displayName: '☕ 下北沢オルタナ・チルホップ',
    category: 'anime',
    descriptionJp: '下北沢の古着屋やレコードショップのような、くすみカラーとレコードノイズ、エモい日常スナップ調。',
    samples: {
      students: `${CDN_BASE}/shimokita_chillhop/students.jpg`,
      edo: `${CDN_BASE}/shimokita_chillhop/edo.jpg`,
      adult: `${CDN_BASE}/shimokita_chillhop/adult.jpg`,
    }
  }
];
