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
    category: '🏮 江戸・幕末・大河群像劇 (天下泰平と動乱の50年)',
    items: [
      '🏮 江戸大河・天下泰平の影と群像劇（幕府・町衆・忍びの暗闘と50年の興亡）',
      '⚔️ 幕末動乱・新時代を拓く志士と守護者たち（維新回天・思想と剣の激突）',
      '👘 江戸の風俗・吉原裏表（粋と野暮・見栄と情けの駆け引き）',
      '🗾 東海道五十三次・諸国放浪と奇縁録（全国を巡る旅情・風土記・人情事件）',
      '💰 大江戸商戦記・暖簾と情熱の百年（両替商・呉服屋・職人組織の興亡）',
      '🏯 大奥深奥・権謀術数と愛憎の三十年（御台所・側室・女中たちの権力闘争）',
      '🗡️ 岡っ引きと辻斬り（十手と捕物帳・闇に葬られた大奥の密命）',
      '🌾 諸藩財政再建記・知恵と改革の大名改革（破綻寸前の小藩を立て直す男たち）',
      '⚔️ 新選組・壬生浪士の挽歌（誠の旗の下に散った若者たちの熱情）',
      '🎲 江戸暗黒街・裏社会の掟と仁義（夜の江戸を支配する侠客と盗賊の年代記）',
      '🥢 江戸の長屋人情（宵越しの銭は持たぬ・お節介と温かい絆）',
      '⚒️ 江戸の職人・町火消し（命を張った火事場の意地と喧嘩）',
      '🏃‍♂️ 江戸の飛脚（宿場町・関所破り・命がけの定刻配達）',
      '🍣 江戸の屋台めし（握り寿司・蕎麦・うなぎの誕生と職人魂）'
    ]
  },
  {
    category: '🚂 明治・大正・帝都浪漫と開化 (激動の近代化史)',
    items: [
      '👑 帝都華族と新興財閥の愛憎劇（旧体制の誇りと近代化の荒波・血脈の闘争）',
      '🎩 大正モダン・帝都浪漫と怪異事件帖（華やかな文化の裏に蠢く路地裏の闇）',
      '🚂 文明開化・激動を駆ける先駆者たち（鉄路・新聞・医術・教育の夜明け）',
      '🕵️ 帝都特務機関と怪盗紳士（ガス灯の夜に交錯する諜報戦と至高の頭脳戦）',
      '🖋️ 文豪たちの群像・時代を創った熱情と狂気（原稿用紙に命を削る創作者たち）',
      '💃 鹿鳴館の陰謀・外交戦と華麗なる仮面舞踏会（国運を懸けた淑女たちの情報戦）',
      '🚢 移民船航路・新天地を目指した開拓者たちの航海記（太平洋を渡った日本人）',
      '🎭 浅草オペラと歓楽街の星（大正の自由と刹那の青春・舞台に賭けた命）',
      '☕ カフェーの女給と貧乏画家（琥珀色の珈琲と交わらない恋）',
      '🚂 陸蒸気開通秘話（鉄の馬に驚愕した人々と若き技師の執念）',
      '🏥 洋式医学校の青春・命を救う若き蘭方医たち（コレラ・未知の病に挑む）',
      '⚔️ 明治剣客浪漫・廃刀令の嵐と武士の誇り（新時代に取り残された剣士たちの挽歌）'
    ]
  },
  {
    category: '📻 昭和・激動と復興・高度成長・バブル (昭和クロニクル)',
    items: [
      '🏭 戦後復興・焼け跡から立ち上がった男たちの戦後史（闇市から大企業への軌跡）',
      '🕶️ 昭和裏社会・組織の興亡と仁義の年代記（激動の昭和ヤクザ抗争史・50年録）',
      '🔧 下町町工場と世界を制した技術者たち（泥臭い情熱と家族の絆・ものづくり大河）',
      '🎤 昭和歌謡・芸能界の光と影（夜の街の栄枯盛衰・歌姫とプロデューサーの一代記）',
      '💰 バブル狂乱・野望と破滅のマネーゲーム（地上げ・巨額金融・狂騒の終焉）',
      '📰 激動の昭和報道・スクープを追う新聞記者たち（大事件の真相と権力の闇）',
      '🏛️ 昭和の巨塔・政財界フィクサーと黒幕の暗躍（戦後政治の表と裏・巨大疑獄事件）',
      '🏢 団地妻の憂鬱・新生活の影（白い巨塔に隠された孤立と見栄）',
      '🚂 集団就職列車・金の卵たち（夜汽車に揺られた少年少女の青春）',
      '🚗 峠の走り屋・深夜のバトル（ハチロクと青春を懸けたテールランプ）',
      '🥊 下町のボクシングジム（拳一つでどん底から這い上がる男）',
      '📺 昭和家電狂騒曲（三種の神器を巡る家族の意地と奮闘記）'
    ]
  },
  {
    category: '💻 平成・ゼロ年代・ネット黎明期と変革 (デジタル創世記)',
    items: [
      '🚀 ITベンチャー戦国時代・ビットバレーの覇者たち（雑居ビルから上場への野望）',
      '🏢 就職氷河期・失われた世代の反撃（理不尽な格差に抗う者たちの生存戦略）',
      '🌐 ネット黎明期・アングラカルチャーと電脳空間（テキストサイトと深夜の群像）',
      '🥊 平成格闘技バブル・リングの熱狂と興行の裏（拳に夢を乗せた男たちの年代記）',
      '🎮 秋葉原オタクカルチャー開拓史（サブカルが世界を席巻するまでの軌跡）',
      '💬 平成初期・深夜のチャットルーム（ダイヤルアップ音と秘密の告白）',
      '🌺 渋谷ギャルとストリートカルチャー（ルールを壊した彼女たちの居場所）',
      '📟 ポケベルと雨の公衆電話（数字の暗号に託した最後のメッセージ）',
      '🎸 バンドブーム・下北沢のライブハウスと上京物語（メジャーデビューの光と挫折）',
      '🌸 青春・アオハル（部活・放課後・甘酸っぱい初恋と友情の3年間）'
    ]
  },
  {
    category: '⚠️ 現代社会派・巨大組織と人間ドラマ (リアルな生き残り劇)',
    items: [
      '🏦 メガバンク・派閥抗争と巨大融資の闇（下剋上と頭取の座を巡る権力闘争）',
      '⚖️ 法廷サスペンス・冤罪と国家権力の巨悪（真実を追う弁護士と検察の死闘）',
      '🏥 現代医療崩壊・大学病院の権力と命の選択（白い巨塔・孤高の名医の闘い）',
      '🏢 タワマン格差と現代家族の仮面（見栄と嫉妬・崩壊していく日常からの再生）',
      '🏛️ 政界黒幕・選挙戦と密室の談合（世襲議員と叩き上げ秘書の暗躍）',
      '📱 SNS承認欲求と見栄の地獄（港区女子・パパ活・タワマン格差）',
      '💼 ブラック企業・サビ残300時間（理不尽な上司と壊れていく心からの脱出記）',
      '📸 社内不倫と因果応報（完璧だった家庭が崩壊する1通の通知）',
      '🏚️ 8050問題・老老介護（静かに迫る孤立と共倒れのリアル）',
      '💳 ギャンブル狂いと消費者金融（自転車操業の果てに見た地獄）',
      '📉 年金・退職金の現実（制度の罠・逃げ切れなかった世代）'
    ]
  },
  {
    category: '🏰 王道ハイファンタジー・国家興亡大河 (剣と魔法の50話クロニクル)',
    items: [
      '👑 帝国興亡記・辺境伯と戦火のクロニクル（国家・英雄・戦乱の50話大河叙事詩）',
      '🗡️ 冒険者ギルド年代記・最弱から大陸最強への覇道（未踏峰ダンジョン探索録）',
      '🔮 魔導帝国の崩壊と独立戦争（禁忌の古代魔法と反乱軍レジスタンス）',
      '🏰 辺境開拓村から始まる建国記（内政・領地経営・多種族共存の歴史）',
      '⚔️ 神々の遺産と選ばれし勇者たち（大陸全土を巡る聖剣と封印の旅路）',
      '🐉 竜騎兵団戦記・空を駆ける騎士たちの絆（帝国空軍と竜との契約）',
      '📜 大陸商館クロニクル・交易路と富を巡る商人たちの暗闘（経済戦争ファンタジー）',
      '🧙‍♀️ 禁術魔導アカデミー・四大学閥の覇権争い（天才魔術師たちの研究と謀略）'
    ]
  },
  {
    category: '⚔️ ダークファンタジー・滅びと再生 (重厚なダークエピック)',
    items: [
      '💀 滅びゆく終末世界・灰燼と希望の旅路（ダークソウルライク・滅亡前夜の群像劇）',
      '✝️ 異端審問官と呪われた血脈（魔女狩りの狂気・教会の闇と禁忌の契約）',
      '🗡️ 深淵の迷宮・死線を超える傭兵たちの記録（狂気と血戦のハック＆スラッシュ）',
      '⏳ 不老不死の呪いと千年の放浪者（死ねない男が目撃した文明の栄枯盛衰）',
      '🩸 吸血鬼一族の黄昏・血の掟と裏切り（永遠の夜に生きる貴族たちの愛憎劇）',
      '⛓️ 奴隷闘技場・血塗られた砂と自由への反乱（剣闘士たちの死闘と反乱軍蜂起）'
    ]
  },
  {
    category: '🚀 近未来SF・サイバーパンク・宇宙開拓 (壮大なる未来叙事詩)',
    items: [
      '🌃 超巨大メガコーポと電脳スラムの反逆者たち（サイバーパンク・電脳抗争50話）',
      '🚀 星間移民船団・新天地への100年航海（密室の宇宙船と世代交代のドラマ）',
      '🤖 アンドロイド覚醒・感情を持った機械と人類の境界線（逃亡と権利獲得の旅路）',
      '🛰️ 地球連邦と月面コロニーの独立戦争（人型機動兵器と若きパイロットの群像劇）',
      '🌐 電脳空間メタバースの覇権戦争（仮想世界の支配者と反乱軍のサイバーバトル）',
      '🪐 辺境惑星テラフォーミング探査隊（未知の惑星環境と異星生命体の驚異）'
    ]
  },
  {
    category: '🌊 大航海・秘境探検・海洋冒険録 (世界の果てを巡る旅)',
    items: [
      '🏴‍☠️ 大航海時代・七つの海を制覇する海賊旗（海洋覇権・秘宝と新大陸探検記）',
      '🧭 未踏峰・極限の冒険者たち（世界の果て・深海と秘境に挑んだ探検隊年代記）',
      '🏝️ 孤島の牢獄と脱出計画（無実の罪で投獄された男の十年越しの復讐）',
      '⚓ 貿易商船団と海軍の護送作戦（嵐と海賊の待ち受ける危険海域突破）'
    ]
  },
  {
    category: '👻 怪異・民俗学ミステリー・伝奇 (忌まわしき因習と謎解き)',
    items: [
      '📜 怪異民俗学調査録・封印された因習と禁足地（全国の怪異と呪いの歴史を追う）',
      '👁️ ヒトコワ・日常の狂気と犯罪捜査録（隣人の異常行動・失踪者の足跡）',
      '⛩️ 因習村の掟・禁忌の儀式と代々続く呪い（村八分と隠蔽された血の歴史）',
      '🕵️ 都市伝説対策特務課・深夜の怪異案件ファイル（現代都市に現れる怪異と対峙）',
      '🏚️ 事故物件の住み込み清掃人（壁のシミが語りかけてくる部屋の秘密）'
    ]
  },
  {
    category: '🏰 欧風洋館・名門寄宿学園・クラシカル浪漫 (夕暮れの時計塔と黒髪の軌跡)',
    items: [
      '🏰 欧風古城の全寮制学園・夕暮れの大階段と黒髪の少女（歴史ある洋館・アーチ窓の斜光）',
      '📚 琥珀色の古書図書館・吹き抜けの螺旋階段と夕陽の読書（巨大な書架・革装丁・舞う埃）',
      '🕰️ 時計塔の回廊と黄昏の鐘（石造りのアーチ・赤レンガの中庭・風になびくリボン）',
      '🎻 音楽堂の夕暮れ・ステンドグラスと消えゆく旋律（木製チェロ・譜面台・静寂の放課後）',
      '🌿 温室と冬薔薇のサンルーム（ガラスドーム・白アイアン・夕霧と角砂糖）',
      '🛤️ 霧のプラットホームと寄宿学校専用列車（レンガ造りの駅舎・真鍮のランプ・旅立ち）',
      '🔭 天文観測室と夜想曲（真鍮の天球儀・アンティーク望遠鏡・静かな星空）',
      '🕯️ 礼拝堂の夕べ・沈黙の祈りとパイプオルガン（色鮮やかな光の影・木製ベンチ）',
      '☕ 旧館サロンの放課後・銀のティーポットと暖炉（アンティークソファ・スコーンの香り）',
      '🍁 黄昏の並木道と石造りの正門（舞い散る落ち葉・冷たい風・帰路の足音）'
    ]
  }
];

export const THEMES: string[] = THEME_CATEGORIES.flatMap(c => c.items);

export const TASTES: Record<string, string> = {
  "🏰 欧風クラシカル・黒髪ノスタルジー (Nostalgic European Manor & Black Hair Academy)":
    "Masterpiece 2D anime illustration, authentic theatrical anime film still, high-end Kyoto Animation and Makoto Shinkai quality atmospheric cinematography, grand classical European manor interior, monumental cathedral-like tall arched multipane leaded windows, majestic polished dark walnut grand staircase with ornate balustrade, antique European architecture, glorious warm golden hour sunset light streaming dramatically through massive windows, soft god rays, glowing airborne dust motes floating in warm light, rich amber and warm mahogany wood tones, deep cinematic dusk atmosphere, featuring a graceful student girl with lustrous natural raven black hair, silky high black ponytail tied with an elegant deep burgundy wine-red ribbon, expressive intelligent violet-dark eyes, gentle quiet contemplative gaze, classic tailored deep navy blue academy blazer uniform, tailored pleated skirt, ribbon tie, leather school bag, soft golden rim lighting tracing her silhouette and hair strands, quiet poetic cinematic ambiance, emotional depth of field, absolutely NO flashy magic circles, NO fantasy weapons, NO armor, NO glowing magical symbols, NO gacha card borders, NO saturated mobile game splash art, NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "💎 エターナル・プリズムルミナス (Ethereal Prismatic Lineless)":
    "Breathtaking, ultra-detailed lineless digital painting in a luminous, ethereal semi-realistic anime style, dynamic cinematic composition. Rendered with soft, luminous, heavily layered brushwork and no hard black outlines. Atmospheric lighting featuring kaleidoscopic prismatic light refraction, glowing crystal shards, drifting flower petals, water droplets, intense bloom, and dreamy lens bokeh particles with realistic f/1.2 depth of field and subtle chromatic aberration. Smooth cinematic diagonal gradient lighting transitioning from bright luminous silvery-lavender mist to deep twilight indigo and dark violet. Ethereal characters with glowing expressive eyes with intricate light reflections, translucent porcelain skin with soft blush, volumetric rim lighting, and soft subsurface scattering. Highly atmospheric, emotional, and poetic aesthetic, absolutely NO flat cartoon coloring, NO bold outlines, NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "🌙 ノスタルジック魔女ファンタジー・極細線画 (Retro Fantasy Whisper-Line)":
    "Authentic 2D anime illustration, retro fantasy anime style, detailed flat coloring, extremely fine whisper-thin pencil-like outline, ultra-delicate and intricate line art, paper-thin faded subtle linework blending softly with coloring, nostalgic grainy textured flat anime aesthetic, vintage film grain, textured digital painting quality, muted and desaturated color palette, warm floating ember-like particles, soft round glowing bokeh lights, cozy magical atmospheric cinematic lighting, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, NO watermark, clean edge-to-edge artwork",

  "🍷 青年誌カバー・艶麗アイライン＆ソリッドセル (Modern Seinen Manga Cover Art)":
    "Masterpiece 2D anime illustration in modern seinen manga cover style, high-end anime aesthetic, refined mature and charismatic charm, elegant modern graphic novel aesthetic, prominent face with sharp delicate V-shaped chin and slender jawline, mesmerizing eyes with thick heavy dark upper eyeliner and dense eyelashes, sharp-edged two-tone cel shading with lineless internal shapes carved purely by contrasting color planes without internal lines, saturated warm amber fringe at shadow borders, dramatic cinematic moody lighting, warm dim ambient bokeh, polished high-contrast modern comic cover illustration finish, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO cover titles, NO logos, NO speech bubbles, clean edge-to-edge artwork",

  "🎨 レトロモダン・ネオ・ジャポニスム (Retro-Modern Neo-Japonisme)":
    "Authentic 2D graphic illustration, sophisticated Japanese retro-modern aesthetic, neo-japonisme art, ultra-clean ultra-fine delicate ink line art, fragile thin linework, no bold lines, highly stylized character design, dramatic dynamic composition with heavy focus on depth of field, rich high-contrast color palette (deep cyan, warm golds, muted reds), intricate gold filigree patterns, subtle matte and glossy textures blended, explosive glitter and particle effects, dramatic volumetric lighting, cinematic lens flares, highly detailed vintage poster art finish, optimized for catchy visual impact, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "🌃 ネオ・シティポップ・ナイトウォーク (Neo-City Pop Nightwalk Anime)":
    "Authentic 2D anime illustration, nostalgic modern anime aesthetic, neo-city pop style, ultra-fine delicate ink lines, fragile thin linework, no bold lines, highly detailed character design, dynamic wide-angle composition, atmospheric night city with soft glowing neon pink and cyan lights, rain-slicked reflective pavement, dramatic light reflections, chromatic aberration, subtle warm Lo-Fi film grain texture, cozy emotional atmosphere, polished high-fidelity anime cut finish, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "✨ エモーショナル・シネマティック・スカイ (Emotional Cinematic Sky Anime)":
    "Authentic 2D anime masterpiece, breathtaking emotional cinematic anime movie still, hyper-detailed anime aesthetic, ultra-fine delicate ink lines, fragile thin linework, no bold lines, dynamic sweeping wide-angle composition, massive towering cumulus clouds, dazzling volumetric god rays, intense lens flares and golden hour light scattering, rich amber and violet gradient sky, delicate wind and floating particles, expressive character design with luminous eyes, high-impact emotional anime movie finish, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "⚔️ ダークファンタジー・重厚陰影 (Dark Chiaroscuro Anime)":
    "Authentic 2D anime illustration, dark cinematic fantasy anime aesthetic, extreme chiaroscuro lighting, deep shadows, delicate thin linework, intense glowing fiery ember highlights, ominous ruined gothic atmosphere, dynamic sharp armor reflections, hyper-detailed epic illustration, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "🖋 白黒劇画・超絶インクマンガ (Intense Monochrome Manga)":
    "Authentic 2D monochrome manga illustration, dramatic gekiga aesthetic, aggressive dry ink brush strokes, ultra-fine screentone crosshatching gradients, extreme chiaroscuro contrast, dynamic single splash cut, no panels, gritty realism, high-impact black and white artwork, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "🏮 ゆる浮世絵・戯画ギャグ調 (Humorous Edo Ukiyo-e Manga)":
    "Humorous Japanese Ukiyo-e manga style, eccentric Edo pop art, full-bleed edge-to-edge seamless artwork, authentic textured washi paper, vintage woodblock printing, delicate thin ink lines, deadpan comedic expressions, quirky stylized body proportions, funny historical genre cut, playful Edo parody finish, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO outer border, NO white margin, NO paper frame, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "🌊 葛飾北斎・超写実肉筆浮世絵 (Hyper-Realistic Hokusai Nikuhitsu Ukiyo-e)":
    "Masterpiece authentic Katsushika Hokusai nikuhitsu Ukiyo-e painting art style, traditional hand-painted nikuhitsu-ga brushwork, extreme museum archival quality, genuine antique textured aged washi paper with raw mulberry fibers, delicate organic paper discoloration, warm sepia and tea-stained antique patina, traditional natural mineral pigments (deep indigo aizuri, crushed malachite green, vermilion cinnabar, earthy ochre), fine sumi ink calligraphy brush lines with authentic dry-brush friction, intentional ink pooling and nuanced pressure variations, seamless full-bleed edge-to-edge artwork, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO frame, NO borders, NO margins, NO modern digital gloss, NO subtitles, NO text, NO speech bubbles, NO calligraphy stamp, NO seal marks",

  "🐸 鳥獣戯画・国宝絵巻モノクローム (Chōjū-giga National Treasure Ink Scroll)":
    "National Treasure Chōjū-jinbutsu-giga (Scrolls of Frolicking Animals) Japanese ink painting masterpiece, authentic Heian and Kamakura period handscroll aesthetic, expressive anthropomorphic frogs (kaeru), rabbits (usagi), monkeys (saru), and foxes (kitsune) frolicking and performing human activities with lively dynamic humor, pure monochrome sumi-e wash, expressive fluid brushstrokes with dry-brush flying white (haku) and soft ink bleed (tarashikomi), ancient weathered silk and antique mulberry washi scroll texture with subtle age cracks and sepia toning, timeless classical Japanese satirical ink art, seamless full-bleed edge-to-edge composition, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO outer border, NO white margin, NO subtitles, NO text, NO speech bubbles",

  "👑 アール・ヌーヴォー・宮廷エレガンス (Art Nouveau Imperial Elegance)":
    "Masterpiece Alphonse Mucha inspired 2D Art Nouveau anime illustration, elegant imperial court aesthetics, ultra-fine delicate golden ink contours, fragile thin linework, no bold lines, expressive gorgeous character design, cascading flowing hair, intricate gold filigree and botanical lace motifs gently blended into the background, translucent silk drapery, luminous porcelain skin, soft diffused museum lighting, vibrant amber and emerald palette, seamless full-bleed composition, edge-to-edge artwork, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO frame, NO borders, NO arch window, NO subtitles, NO text, NO speech bubbles",

  "🌸 日常系萌えアニメ・ハッチングチーク (Moe Daily Hatching Blush Anime)":
    "Authentic 2D Japanese TV anime illustration, high-end slice-of-life anime style, ultra-fine delicate ink lines, simple expressive anime eyes, vertical blush lines on cheeks, hatching blush, separated subtle blush, soft natural skin tones, charming character design, gentle warm school life atmosphere, vibrant clean anime color palette, polished 2D digital cel animation finish, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "🎨 くすみパステル・チルスケッチ (Muted Pastel Chill Sketch Anime)":
    "Authentic 2D anime sketch style, delicate clean line art, muted pastel color palette, warm beige tones, minimalist flat coloring, soft natural ambient lighting, cozy relaxed Lo-Fi atmosphere, indie music video aesthetic, poetic unhurried mood, beautiful subtle artistic composition, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "🌃 劇場版フラットセル・夜景ティール (Cinematic Flat Cel Teal Anime)":
    "Authentic 2D cinematic anime movie aesthetic, clean crisp ink lineart, authentic flat cel shading, muted dark teal environmental background, subtle sharp rim light, high-impact cinematic contrast, elegant restrained color grading, theatrical anime feature film key frame finish, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "📐 サイバー・テクニカル・ブループリント (Cyber Technical Blueprint)":
    "Intricate technical blueprint schematic of an advanced quantum machine and architectural cross-section, glowing holographic cyan and amber HUD vector overlays, ultra-precise CAD wireframe lines, deep navy blue blueprint grid paper aesthetic, industrial patent schematic rendering, volumetric laser light rays, ultra-clean engineering laboratory aesthetic, clean edge-to-edge schematic composition, absolutely NO subtitles, NO caption text, NO speech bubbles, NO watermark",

  "🔬 ナショジオ・超深度マクロ自然科学 (NatGeo Macro Science & Crystal)":
    "Extreme macro cinematic photograph of iridescent bismuth crystal growing in dark laboratory, hyper-detailed crystalline molecular geometry, translucent light refractions and prism caustics, National Geographic science documentary aesthetic, dark moody background with pinpoint rim lighting, 8k natural science visual, clean edge-to-edge photography, absolutely NO subtitles, NO text, NO caption banner, NO speech bubbles, NO watermark, NO logo",

  "🏛️ バウハウス・幾何学キネティックアート (Bauhaus Geometric Kinetic)":
    "Minimalist Bauhaus kinetic sculpture graphic design, floating geometric brass spheres and matte concrete monoliths, frosted glass shadows, elegant brutalist gallery lighting, Swiss graphic design aesthetic, high-contrast abstract architectural balance, ultra-clean commercial look, clean edge-to-edge artwork, absolutely NO subtitles, NO text, NO speech bubbles, NO watermark",

  "📜 ダ・ヴィンチ古代手稿・飛行機械スケッチ (Da Vinci Codex & Antique Sketch)":
    "Authentic Leonardo da Vinci codex manuscript sketch illustration, complex flying ornithopter mechanism and astronomical clockwork, sepia aged parchment paper texture, vintage brown fountain ink linework, Renaissance engineering studies, anatomical and mechanical notations, museum archival illustration, clean edge-to-edge drawing, absolutely NO subtitles, NO modern text, NO speech bubbles, NO watermark",

  "📜 レトロ淡彩アトリエ・極細線画 (Nostalgic Faded Pastel Whisper-Line)":
    "Authentic 2D anime illustration, retro nostalgic hand-drawn anime style, detailed flat coloring, extremely fine whisper-thin pencil-like outline, ultra-delicate and intricate line art with paper-thin slightly rough borders blending softly with colors, grainy heavily textured flat anime aesthetic, vintage film grain, rustic soft digital painting quality, muted and desaturated color palette with warm faded natural pastel tones (soft beige, pale orange, muted green, faded browns), gentle natural daylight paper-like warmth, cluttered atmospheric lived-in details, natural camera-grain overlay, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "📼 90s平成深夜アニメ・セル画キャプチャ (90s Retro Cel Animation CRT)":
    "Authentic retro 2D anime cell animation screenshot in 1990s vintage cel animation style, captured in a nostalgia-heavy low-contrast 4:3-inspired cinematic view, analog film grain, natural hand-painted cel imperfections, visible VHS-tape scanlines, slight chromatic aberration and color bleeding at borders, CRT television display artifacts, subtle dark brown ink contours, faded desaturated analog color grading, soft ambient halation, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO Japanese text, NO speech bubbles, clean edge-to-edge artwork",

  "🖋️ 昭和怪異ホラー・カケアミ劇画 (Vintage Japanese Horror Crosshatch)":
    "Authentic 2D vintage Japanese horror manga illustration style, 1970s retro graphic art, heavily stylized vintage print aesthetic, rough black ink linework with authentic dip pen texture and ink bleed, dense hand-drawn crosshatching and fine screentone shading, printed on aged yellowed tea-stained vintage pulp paper texture, severe desaturation with sepia, off-white, and charcoal blacks, eerie Showa-era dark folklore mood, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "⚡ Y2Kストリート・太線ポップステッカー (Bold Line Y2K Pop Sticker)":
    "Vibrant 2000s Y2K street fashion anime illustration, bold graphic sticker art style, extremely thick bold solid black ink outlines, vibrant punchy flat saturated pop colors, sharp high-contrast cel shading with dramatic comic pop-art highlights, dynamic wide-angle fisheye lens perspective, crisp vector-like graphic finish, clean halftone dot accents, urban graffiti backdrop, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "🕯️ ダークゴシック童話・ペン画版画 (Dark Gothic Fairytale Engraving)":
    "Authentic 2D dark fantasy gothic fairytale storybook illustration, antique crosshatch engraving art style, intricate pen-and-ink linework with dense crosshatching, scratchy etched woodblock aesthetic, monochrome base with muted desaturated jewel tones (faded plum, moss green, tarnished gold accents), aged parchment texture, high contrast chiaroscuro with elongated spindly shadows, whimsical macabre atmosphere, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "🌸 70s-80sレトロ少女漫画・水彩ロマンス (Vintage Shoujo Watercolor Romance)":
    "Authentic 2D vintage 1970s-1980s shoujo manga color illustration, nostalgic watercolor aesthetic, delicate ink contours with soft watercolor bleed and feathering, muted warm pastel palette (lavender, peach, dusty rose), luminous retro anime eyes with hand-drawn star highlights and dense lashes, soft colored-pencil textures and paper grain, dreamy floating bubbles and floral petals, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "🔮 中世タロット・ゴシック木版画 (Antique Medieval Tarot Woodcut)":
    "Authentic 2D antique medieval tarot card illustration, dark gothic woodcut engraving print art style, high-contrast monochrome ink illustration with aged gold leaf accents, intricate linework reminiscent of vintage woodblock prints and Aubrey Beardsley ink drawings, crisp crosshatching, ornate vintage baroque occult motifs with mystical sun and moon motifs, aged yellowed parchment paper, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO modern text, NO speech bubbles, clean edge-to-edge artwork",

  "🧶 フェルト＆クレイ・ストップモーション人形劇 (Tactile Claymation & Felt Puppet)":
    "Charming tactile stop-motion puppet animation still, claymation and wool-felt puppet art style, macro miniature photography, visible handcrafted textures including soft wool fuzz, delicate clay fingerprints, tiny fabric stitching, miniature tilt-shift depth of field with soft blurred background, cinematic warm studio lighting with tiny physical shadows, cozy attic diorama, clean edge-to-edge composition, absolutely NO subtitles, NO text, NO speech bubbles, NO watermark",

  "🎨 リソグラフ版ズレ＆2色刷りグラフィック (Risograph Print Two-Tone Indie MV)":
    "Authentic 2D stylized risograph print anime illustration, limited color screenprint art style, indie music video graphic aesthetic, authentic risograph texture with intentional slight misregistration and color misalignment, visible coarse halftone grain, ink roller texture, bold minimalist color palette strictly limited to vibrant fluorescent warm orange and deep muted navy/teal duotone against rough art paper, crisp graphic linework, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "✂️ 立体ペーパーカット・極彩色シャドウシアター (Layered Papercut Shadow Theater)":
    "Intricate handcrafted multi-layered 2D papercut illustration, shadow puppet theater aesthetic, 3D papercraft art style, handcrafted layered cut-paper diorama, distinct visible paper textures, sharp laser-cut paper edges with subtle cast drop shadows between overlapping layers creating physical depth, dramatic theatrical backlit illumination shining through translucent colored paper layers (stained-glass effect), rich jewel-tone color palette (emerald green, deep amethyst violet, glowing amber gold), absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  // ── 🐾 ユーザーリクエスト追加: 動物系擬人化 ──
  "🦊 もふもふケモミミ・獣人ファンタジー (Fluffy Kemomimi & Beastfolk Fantasy)":
    "Masterpiece 2D anime fantasy illustration, fluffy kemomimi animal ears and tail, gentle charming anime aesthetic, delicate fine ink lines, warm soft watercolor-like cel shading, warm ambient daylight with floating luminous dandelion seeds and gentle glowing motes, cozy fairytale atmosphere, vibrant expressive eyes, rich natural textures, edge-to-edge seamless artwork, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, NO watermark",

  "🐺 サイバー・ビーストパンク (Cyber Beastpunk & Anthropomorphic)":
    "Authentic 2D cyberpunk anime illustration, anthropomorphic cyber beast aesthetic, sleek wolf/feline ears with cybernetic implants, glowing neon teal and magenta circuit lines, wet asphalt reflections, futuristic street fashion with techwear and glowing holographic visors, sharp dynamic cel shading, deep cinematic shadows, dramatic high-contrast street art finish, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  "🐾 平成レトロ・戯画アニマロイド (Retro Pop Animaloid Cartoon)":
    "Authentic 2D playful retro pop anthropomorphic animal cartoon art, vibrant 90s-00s Japanese mascot anime aesthetic, bold playful ink contours, bright saturated cheerful pastel palette, whimsical expressive animal characters performing human activities, halftone dot background accents, energetic clean visual storytelling, humorous nostalgic pop finish, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles, clean edge-to-edge artwork",

  // ── 🏮 ユーザーリクエスト追加: YouTube「ガチ江戸」歴史劇画系 ──
  "🏮 YouTube歴史解説・ガチ江戸劇画 (Authentic Edo Documentary Gekiga)":
    "Authentic 2D Edo period documentary gekiga manga illustration, gritty historical realism, deep textured washi paper, rough sumi ink brush lines with dynamic dry-brush friction, heavy authentic chiaroscuro shadows, historically accurate Edo merchant and samurai attire, candlelit dusky atmosphere, muted earthy mineral pigments (charcoal black, tea brown, dull indigo), high-impact serious historical narrative art, clean edge-to-edge artwork, absolutely NO realistic photograph, NO photorealism, NO 3D render, absolutely NO subtitles, NO text, NO Japanese characters, NO caption banner, NO outer black letterbox border",

  "👘 吉原裏路地・陰影浮世絵ノワール (Edo Alley Ukiyo-e Noir)":
    "Authentic 2D cinematic Edo noir ukiyo-e aesthetic, dark misty alley of Yoshiwara pleasure quarters at night, red paper lanterns casting rich warm crimson glow onto dark wooden lattice windows, deep impenetrable indigo shadows, elegant stylized silhouette, fine dip-pen linework with subtle woodblock texture, atmospheric cinematic mystery, dramatic side lighting, clean edge-to-edge composition, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO text, NO speech bubbles",

  "⚔️ 幕末古写真風・木版クロニクル (Bakumatsu Tintype & Woodblock)":
    "Authentic late Edo and Bakumatsu period vintage tintype photograph merged with woodblock chronicle art, antique sepia and silver-halide photographic grain, subtle hand-tinted soft colors, weathered paper edges, dignified samurai and townsfolk portraiture, historically authentic swords and haori coats, solemn atmospheric historic archive quality, clean artwork, absolutely NO subtitles, NO text, NO speech bubbles, NO modern fonts, NO watermark",

  // ── 🎸 ユーザーリクエスト追加: サブカル・不良・ギャグ・特定ジャンル ──
  "🎸 ガレージパンク・地下ライブハウス (Garage Punk & Underground Live)":
    "Raw explosive underground garage punk anime art style, 2D graphic illustration, heavy gritty black ink lines, dynamic ink splatters and rough screentone texture, high-contrast monochrome with fierce crimson and neon accents, wild rebellious energy, authentic 2D anime illustration, absolutely NO realistic photograph, NO photorealism, NO 3D render, clean edge-to-edge artwork, NO subtitles, NO speech bubbles",

  "👊 昭和ツッパリ・熱血暴走劇画 (Retro Showa Yankee Action Manga)":
    "Authentic 2D classic 1980s Showa yankee delinquent action manga style, ultra-bold black ink brushwork, intense speed lines and dramatic impact screech marks, sharp fierce eyes with heavy screentone hatching, retro modified gakuran uniforms and pompadour hairstyles, gritty industrial backdrop under neon sodium streetlights, hot-blooded nostalgic retro comic finish, dynamic manga splash page, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO speech bubbles, clean edge-to-edge artwork",

  "🤪 爆笑カートゥーン・スラップスティック (Slapstick Comedy & Hyper-Deform)":
    "Authentic 2D dynamic slapstick comedy anime cartoon art, extreme funny exaggerated facial expressions (jaw-dropping shock, flying sweat droplets, popped-out cartoon eyes), chaotic kinetic motion blur lines, bright punchy candy colors, humorous anime gag comic styling, energetic comedic timing captured in single splash frame, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO subtitles, NO speech bubbles, clean edge-to-edge artwork",

  "☕ 下北沢オルタナ・チルホップ (Shimokitazawa Indie Lo-Fi Chill)":
    "Authentic 2D indie anime illustration, lo-fi chillhop music video aesthetic, delicate clean ink lineart, muted warm pastel tones and vintage earth colors, flat cel shading, soft ambient daylight, cozy relaxed slice-of-life mood, authentic 2D Japanese anime art, absolutely NO realistic photograph, NO photorealism, NO 3D render, NO text, NO speech bubbles, clean edge-to-edge illustration"
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
  { label: '2話目のみ', value: 'cut2' },
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
export const STRICT_STYLE_SUFFIX = ' seamless full-bleed vertical 9:16 artwork. Strictly upright vertical perspective. Grounded immersive cinematic human eye-level framing. Absolutely NO drone shots, NO modern aerial drones, NO borders, NO margins, NO text, NO subtitles, NO caption banner, NO speech bubbles, NO kanji, NO numbers, NO year labels, NO signs indicating the year or date, clean edge-to-edge artwork.';
export const CUTS_PER_EPISODE = 12;
export const DEFAULT_ASPECT_RATIO = '1:1';