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
  }
];

export const THEMES: string[] = THEME_CATEGORIES.flatMap(c => c.items);

export const TASTES: Record<string, string> = {
  "🌙 ノスタルジック魔女ファンタジー・極細線画 (Retro Fantasy Whisper-Line)":
    "2D anime illustration, retro fantasy anime style, detailed flat coloring, extremely fine whisper-thin pencil-like outline, ultra-delicate and intricate line art, paper-thin faded subtle linework blending softly with coloring, nostalgic grainy textured flat anime aesthetic, vintage film grain, textured digital painting quality, muted and desaturated color palette, warm floating ember-like particles, soft round glowing bokeh lights, cozy magical atmospheric cinematic lighting",

  "🍸 ラグジュアリー・ソシャゲ美麗キービジュアル (High-End Gacha Splash Art)":
    "High-end Japanese anime key visual, refined mature young-adult anime aesthetic, gacha splash art style, elegant mature proportions, sleek jawline, alluring expressive almond-shaped eyes, sophisticated beauty, not overly cartoonish, polished digital illustration with fine tinted lines, deep layered gradient shadows, fine fabric texture, shimmering highlights and jewelry, rich ambient lighting with warm amber glow, soft cinematic rim light on silhouette, high-fidelity luxury anime key frame finish",

  "🍷 青年誌カバー・艶麗アイライン＆ソリッドセル (Modern Seinen Manga Cover Art)":
    "Masterpiece anime illustration in modern seinen manga cover style, high-end anime aesthetic, refined mature and charismatic charm, elegant modern graphic novel aesthetic, prominent face with sharp delicate V-shaped chin and slender jawline, mesmerizing eyes with thick heavy dark upper eyeliner and dense eyelashes, sharp-edged two-tone cel shading with lineless internal shapes carved purely by contrasting color planes without internal lines, saturated warm amber fringe at shadow borders, dramatic cinematic moody lighting, warm dim ambient bokeh, polished high-contrast modern comic cover illustration finish",

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
    "Authentic Leonardo da Vinci codex manuscript sketch, complex flying ornithopter mechanism and astronomical clockwork, sepia aged parchment paper texture, vintage brown fountain ink linework, Renaissance engineering studies, anatomical and mechanical notations, museum archival illustration",

  "📜 レトロ淡彩アトリエ・極細線画 (Nostalgic Faded Pastel Whisper-Line)":
    "2D anime illustration, retro nostalgic hand-drawn anime style, detailed flat coloring, extremely fine whisper-thin pencil-like outline, ultra-delicate and intricate line art with paper-thin slightly rough borders blending softly with colors, grainy heavily textured flat anime aesthetic, vintage film grain, rustic soft digital painting quality, muted and desaturated color palette with warm faded natural pastel tones (soft beige, pale orange, muted green, faded browns), gentle natural daylight paper-like warmth, cluttered atmospheric lived-in details, natural camera-grain overlay",

  "📼 90s平成深夜アニメ・セル画キャプチャ (90s Retro Cel Animation CRT)":
    "A grainy candid retro 2D anime screenshot in 1990s vintage cel animation style, captured in a nostalgia-heavy low-contrast 4:3-inspired cinematic view, analog film grain, natural hand-painted cel imperfections, visible VHS-tape scanlines, slight chromatic aberration and color bleeding at borders, CRT television display artifacts, subtle dark brown ink contours, faded desaturated analog color grading, soft ambient halation",

  "🖋️ 昭和怪異ホラー・カケアミ劇画 (Vintage Japanese Horror Crosshatch)":
    "Vintage Japanese horror manga illustration style, 1970s retro graphic art, heavily stylized vintage print aesthetic, rough black ink linework with authentic dip pen texture and ink bleed, dense hand-drawn crosshatching and fine screentone shading, printed on aged yellowed tea-stained vintage pulp paper texture, severe desaturation with sepia, off-white, and charcoal blacks, eerie Showa-era dark folklore mood",

  "⚡ Y2Kストリート・太線ポップステッカー (Bold Line Y2K Pop Sticker)":
    "Vibrant 2000s Y2K street fashion anime illustration, bold graphic sticker art style, extremely thick bold solid black ink outlines, vibrant punchy flat saturated pop colors, sharp high-contrast cel shading with dramatic comic pop-art highlights, dynamic wide-angle fisheye lens perspective, crisp vector-like graphic finish, clean halftone dot accents, urban graffiti backdrop",

  "🕯️ ダークゴシック童話・ペン画版画 (Dark Gothic Fairytale Engraving)":
    "Dark fantasy gothic fairytale storybook illustration, antique crosshatch engraving art style, intricate pen-and-ink linework with dense crosshatching, scratchy etched woodblock aesthetic, monochrome base with muted desaturated jewel tones (faded plum, moss green, tarnished gold accents), aged parchment texture, high contrast chiaroscuro with elongated spindly shadows, whimsical macabre atmosphere",

  "🌸 70s-80sレトロ少女漫画・水彩ロマンス (Vintage Shoujo Watercolor Romance)":
    "Vintage 1970s-1980s shoujo manga color illustration, nostalgic watercolor aesthetic, delicate ink contours with soft watercolor bleed and feathering, muted warm pastel palette (lavender, peach, dusty rose), luminous retro anime eyes with hand-drawn star highlights and dense lashes, soft colored-pencil textures and paper grain, dreamy floating bubbles and floral petals",

  "🔮 中世タロット・ゴシック木版画 (Antique Medieval Tarot Woodcut)":
    "Antique medieval tarot card illustration, dark gothic woodcut engraving print art style, high-contrast monochrome ink illustration with aged gold leaf accents, intricate linework reminiscent of vintage woodblock prints and Aubrey Beardsley ink drawings, crisp crosshatching, framed within an ornate vintage baroque occult border frame with mystical sun and moon motifs, aged yellowed parchment paper",

  "🧶 フェルト＆クレイ・ストップモーション人形劇 (Tactile Claymation & Felt Puppet)":
    "Charming tactile stop-motion puppet animation still, claymation and wool-felt puppet art style, macro miniature photography, visible handcrafted textures including soft wool fuzz, delicate clay fingerprints, tiny fabric stitching, miniature tilt-shift depth of field with soft blurred background, cinematic warm studio lighting with tiny physical shadows, cozy attic diorama",

  "🎨 リソグラフ版ズレ＆2色刷りグラフィック (Risograph Print Two-Tone Indie MV)":
    "Stylized risograph print anime illustration, limited color screenprint art style, indie music video graphic aesthetic, authentic risograph texture with intentional slight misregistration and color misalignment, visible coarse halftone grain, ink roller texture, bold minimalist color palette strictly limited to vibrant fluorescent warm orange and deep muted navy/teal duotone against rough art paper, crisp graphic linework",

  "✂️ 立体ペーパーカット・極彩色シャドウシアター (Layered Papercut Shadow Theater)":
    "Intricate multi-layered papercut illustration, shadow puppet theater aesthetic, 3D papercraft art style, handcrafted layered cut-paper diorama, distinct visible paper textures, sharp laser-cut paper edges with subtle cast drop shadows between overlapping layers creating physical depth, dramatic theatrical backlit illumination shining through translucent colored paper layers (stained-glass effect), rich jewel-tone color palette (emerald green, deep amethyst violet, glowing amber gold)"
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