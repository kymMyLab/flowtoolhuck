/**
 * 🎭 人物様態（キャラクター・アーキタイプ）マスターデータ 100選
 * 
 * 「画風（Style）」と「人物（Who: 様態・ペルソナ）」を直交分離し、
 * あらゆる物語・MV・漫画・Shortsで再利用可能な普遍的キャラクター属性を定義。
 */

export type ArchetypeCategory = 
  | 'all'
  | 'student'     // ① 学生・ティーン・アオハル (15)
  | 'business'    // ② 社会人・ビジネス・現場 (20)
  | 'daily'       // ③ 日常・家庭・地域 (15)
  | 'subculture'  // ④ 夜・歓楽街・サブカル・音楽 (15)
  | 'suspense'    // ⑤ サスペンス・裏社会・犯罪・怪異 (15)
  | 'fantasy'     // ⑥ 特殊・ケモミミ・ファンタジー (10)
  | 'historical'; // ⑦ 歴史・和風・古典 (10)

export interface CharacterArchetype {
  id: string;
  name: string;             // 様態名（例: 'くたびれた中年サラリーマン'）
  category: Exclude<ArchetypeCategory, 'all'>;
  icon: string;             // Material Symbol名 または 絵文字
  color: string;            // バッジ色テーマ (amber, purple, blue, emerald, rose, slate, cyan, indigo)
  tags: string[];           // 特徴タグ（例: ['#40代男性', '#ヨレたスーツ', '#哀愁の眼差し']）
  summaryJa: string;        // 日本語の人物像サマリー
  dnaPromptEn: string;      // 英語の純粋な人物DNAプロンプト（画風に依存しない外見・服装・雰囲気）
  recommendedTastes?: string[]; // 相性の良いおすすめ画風
}

export const ARCHETYPE_CATEGORY_METAS: Record<Exclude<ArchetypeCategory, 'all'>, { label: string; icon: string; color: string }> = {
  student: { label: '学生・青春', icon: 'school', color: 'from-amber-500 to-orange-500' },
  business: { label: '社会人・現場', icon: 'business_center', color: 'from-blue-600 to-cyan-600' },
  daily: { label: '日常・家庭', icon: 'home', color: 'from-emerald-500 to-teal-500' },
  subculture: { label: '夜・サブカル', icon: 'nightlife', color: 'from-purple-600 to-pink-600' },
  suspense: { label: 'サスペンス・怪異', icon: 'visibility_off', color: 'from-rose-600 to-red-700' },
  fantasy: { label: 'ケモミミ・幻想', icon: 'cruelty_free', color: 'from-fuchsia-500 to-violet-600' },
  historical: { label: '歴史・和風', icon: 'temple_buddhist', color: 'from-amber-600 to-yellow-600' },
};

export const CHARACTER_ARCHETYPES: CharacterArchetype[] = [
  // ── ① 学生・ティーン・アオハル系 (15) ──
  {
    id: 'arch_kemomimi_jk',
    name: '狐耳ケモミミ女子高生',
    category: 'student',
    icon: '🦊',
    color: 'amber',
    tags: ['#高校生', '#もふもふ狐耳', '#セーラー服', '#狐の尻尾'],
    summaryJa: 'ふさふさの狐耳と大きな尻尾を持つ愛らしい女子高生。ネイビーのセーラー服に赤いリボン、ダークブラウンの髪に琥珀色の瞳。',
    dnaPromptEn: 'A cute Japanese high school anime girl with fluffy fox ears and a bushy fox tail, wearing a stylish navy-blue sailor school uniform with pleated skirt and red ribbon necktie, knee-high socks, long silky dark brown hair with subtle golden highlights, radiant golden-amber eyes, youthful charming face, consistent character design, masterpiece',
    recommendedTastes: ['昭和怪異ホラー・カケアミ劇画', '日常・アオハルポップ', 'ノスタルジック水彩']
  },
  {
    id: 'arch_jk_long_hair',
    name: '黒髪ロングの清楚女子高生',
    category: 'student',
    icon: '👧',
    color: 'emerald',
    tags: ['#黒髪ストレート', '#清楚', '#ブレザー制服', '#透明感'],
    summaryJa: '腰まで届くサラサラの黒髪と澄んだ瞳を持つ清楚系女子高生。落ち着いたブレザー制服とチェック柄スカート。',
    dnaPromptEn: 'A graceful Japanese high school girl with waist-length straight jet-black hair and soft bangs, clear expressive dark brown eyes, wearing a neat navy blazer school uniform with white collared shirt and red plaid pleated skirt, modest black loafers, innocent and pure aesthetic demeanor',
    recommendedTastes: ['エモーショナル・シネマティック・スカイ', '日常・アオハルポップ', '青春スナップ写真']
  },
  {
    id: 'arch_jk_gal',
    name: '金髪ギャル女子高生',
    category: 'student',
    icon: '✨',
    color: 'amber',
    tags: ['#ギャル', '#明るい金髪', '#ルーズソックス', '#笑顔'],
    summaryJa: '明るく染めたウェーブ金髪にピアス、崩したカーディガンとルーズソックスが特徴の天真爛漫なギャル。',
    dnaPromptEn: 'A trendy energetic Japanese gyaru high school girl with wavy bleached blonde hair, bright playful hazel eyes, light natural sun-kissed makeup, wearing an oversized beige cardigan draped over shoulders, unbuttoned collar with loose tie, short plaid skirt, white loose socks, bright confident grin',
    recommendedTastes: ['日常・アオハルポップ', 'シティポップ・80sレトロ', 'ネオンサイバー']
  },
  {
    id: 'arch_jk_short_sporty',
    name: '短髪ボーイッシュ運動部女子',
    category: 'student',
    icon: '🏃‍♀️',
    color: 'cyan',
    tags: ['#ショートヘア', '#ボーイッシュ', '#運動部ジャージ', '#快活'],
    summaryJa: 'さっぱりとした黒髪ショートと健康的な日焼け肌、陸上部ジャージを羽織る快活で飾らない爽やかな少女。',
    dnaPromptEn: 'A refreshing athletic Japanese high school girl with sporty pixie-cut dark hair, energetic sparkling eyes, healthy sun-tanned skin, wearing a zipped track-and-field training jacket over school uniform, sweatband on wrist, determined lively expression',
    recommendedTastes: ['日常・アオハルポップ', 'エモーショナル・シネマティック・スカイ']
  },
  {
    id: 'arch_literary_girl',
    name: '図書室の文学少女',
    category: 'student',
    icon: '📖',
    color: 'indigo',
    tags: ['#丸メガネ', '#三つ編み', '#カーディガン', '#読書好き'],
    summaryJa: '細い丸メガネにおさげ髪、分厚い文庫本を大切に抱える物静かで知的な図書室の少女。',
    dnaPromptEn: 'A quiet intellectual Japanese schoolgirl with neat braided dark hair, vintage thin round wire-rimmed spectacles, gentle contemplative dark eyes, wearing an oversized soft knit cardigan over pleated school uniform, holding a hardcover book close to chest, introspective serene aura',
    recommendedTastes: ['ノスタルジック水彩・淡彩画', 'レトロ淡彩アトリエ・極細線画', '昭和怪異ホラー・カケアミ劇画']
  },
  {
    id: 'arch_jirai_girl',
    name: '地雷系ツインテール女子',
    category: 'student',
    icon: '🎀',
    color: 'rose',
    tags: ['#地雷系', '#ツインテール', '#黒リボン', '#病みカワイイ'],
    summaryJa: '黒髪ハーフツインテールにフリルと黒レース、赤いアイラインと厚底ローファーを履きこなす病みカワ少女。',
    dnaPromptEn: 'A fashionable Japanese jirai-kei subculture girl with high dark twin-tails tied with black satin ribbons, tearful reddish under-eye makeup, pale porcelain skin, wearing a frilly black and pink blouse with laced choker, pleated mini skirt with buckles, heavy platform chunky loafers, moody cute aesthetic',
    recommendedTastes: ['ネオンサイバー', 'ダーク・ノワール', 'シティポップ・80sレトロ']
  },
  {
    id: 'arch_manga_boy_mash',
    name: '黒髪マッシュの今どき男子高生',
    category: 'student',
    icon: '🎧',
    color: 'blue',
    tags: ['#マッシュヘア', '#爽やか', '#首かけイヤホン', '#等身大'],
    summaryJa: '目の上ギリギリの黒髪マッシュヘアに有線イヤホン、少し着崩した制服スラックスの等身大男子高生。',
    dnaPromptEn: 'A relatable Japanese teenage high school boy with soft textured dark crop mash hairstyle covering forehead, relaxed observant brown eyes, wearing a white collared school shirt with cuffs casually rolled up, loose tie, dark slacks, wired earphones around neck, natural candid posture',
    recommendedTastes: ['日常・アオハルポップ', 'エモーショナル・シネマティック・スカイ', '青春スナップ写真']
  },
  {
    id: 'arch_delinquent_boy',
    name: 'ヤンキー・不良男子高生',
    category: 'student',
    icon: '🔥',
    color: 'red',
    tags: ['#短髪金髪', '#学ラン前開き', '#鋭い眼光', '#硬派'],
    summaryJa: '無造作なツーブロック金髪に開襟の黒学ラン、喧嘩慣れした絆創膏と鋭くも情に厚い眼差しの硬派ヤンキー。',
    dnaPromptEn: 'A fierce rebellious Japanese delinquent high school boy with undercut bleached spiky hair, sharp defiant amber-brown eyes, adhesive bandage across bridge of nose, wearing an unbuttoned traditional black gakuran jacket over red t-shirt, baggy school trousers, tough and protective presence',
    recommendedTastes: ['昭和怪異ホラー・カケアミ劇画', '白黒劇画・超絶インクマンガ']
  },
  {
    id: 'arch_student_council_boy',
    name: 'メガネ真面目な生徒会長男子',
    category: 'student',
    icon: '👓',
    color: 'slate',
    tags: ['#メガネ', '#生徒会長', '#端正な制服', '#規律正しさ'],
    summaryJa: '整えられた分け目の黒髪に銀縁スクエア眼鏡、第一ボタンまで留めた端正なブレザーを着こなす規律正しい優等生。',
    dnaPromptEn: 'An earnest upright Japanese student council president with neatly parted dark hair, sleek rectangular silver-rimmed glasses, sharp disciplined gaze, wearing a perfectly pressed school blazer with pristine gold school crest, necktie tightly tied, holding leather document folder',
    recommendedTastes: ['日常・アオハルポップ', '白黒劇画・超絶インクマンガ']
  },
  {
    id: 'arch_soccer_captain',
    name: '汗が光るサッカー部主将',
    category: 'student',
    icon: '⚽',
    color: 'emerald',
    tags: ['#スポーツマン', '#キャプテン', '#小麦色の肌', '#爽快な笑顔'],
    summaryJa: '爽やかな短髪に小麦色の引き締まった肌、背番号10のユニフォームを着て皆を引っ張る太陽のような主将。',
    dnaPromptEn: 'A charismatic athletic Japanese high school boy with short breeze-swept hair, glowing sun-tanned complexion, confident warm grin with glistening sweat beads, wearing blue athletic soccer jersey with captain armband, athletic lean build, radiating leadership and vitality',
    recommendedTastes: ['エモーショナル・シネマティック・スカイ', '日常・アオハルポップ']
  },
  {
    id: 'arch_otaku_boy',
    name: '陰キャなオタク系男子高校生',
    category: 'student',
    icon: '🎮',
    color: 'purple',
    tags: ['#猫背', '#黒縁メガネ', '#オーバーサイズパーカー', '#内気'],
    summaryJa: '少し目にかかるボサボサ前髪に黒縁メガネ、大きめのパーカーにリュックを背負った内気だが心優しい少年。',
    dnaPromptEn: 'A shy introverted Japanese high school otaku boy with messy unstyled dark bangs partly concealing eyes, thick black-rimmed glasses, timid gentle gaze, slightly slouched posture, wearing a loose oversized dark hoodie, backpack with enamel anime pins, modest humble atmosphere',
    recommendedTastes: ['日常・アオハルポップ', 'レトロ淡彩アトリエ・極細線画', 'ドット・ピクセルアート']
  },
  {
    id: 'arch_hikikomori_boy',
    name: '不登校気味の繊細な美少年',
    category: 'student',
    icon: '🌙',
    color: 'slate',
    tags: ['#繊細', '#美少年', '#大型ヘッドホン', '#薄暗い部屋着'],
    summaryJa: '透き通るような白い肌と憂いを帯びた美しい瞳、首にかけた大型ヘッドホンとオーバーサイズ部屋着の美少年。',
    dnaPromptEn: 'A fragile sensitive Japanese teenage boy with pale porcelain skin, silky dark hair falling over melancholic deep expressive eyes, slender frame, wearing comfortable oversized loungewear and large studio headphones around neck, poetic artistic solitude atmosphere',
    recommendedTastes: ['ノスタルジック水彩・淡彩画', 'エモーショナル・シネマティック・スカイ', 'ダーク・ノワール']
  },
  {
    id: 'arch_elementary_boy',
    name: '元気いっぱいな小学生男児',
    category: 'student',
    icon: '🧢',
    color: 'amber',
    tags: ['#小学生', '#半ズボン', '#擦り傷', '#元気いっぱい'],
    summaryJa: 'つばの曲がった野球帽に膝の絆創膏、泥だらけのスニーカーで路地を駆け抜ける無邪気な小学生の男の子。',
    dnaPromptEn: 'A playful energetic 10-year-old Japanese elementary school boy with scruffy dark hair under a curved baseball cap, round sparkling eyes with toothy grin, adhesive bandage on knee, wearing bright polo shirt, denim shorts, scuffed running sneakers, radiating childlike curiosity',
    recommendedTastes: ['日常・アオハルポップ', 'ノスタルジック水彩・淡彩画', '昭和怪異ホラー・カケアミ劇画']
  },
  {
    id: 'arch_elementary_girl',
    name: 'ちょっぴりおませな小学生女子',
    category: 'student',
    icon: '🎒',
    color: 'rose',
    tags: ['#赤ランドセル', '#ポニーテール', '#おませ', '#妹系'],
    summaryJa: '高い位置で結んだポニーテールに赤いランドセル、ちょっと背伸びしたカチューシャが似合う利発な女の子。',
    dnaPromptEn: 'A smart cheerful 9-year-old Japanese elementary school girl with high swinging ponytail tied with ribbon, bright inquisitive eyes, wearing a neat school uniform dress, carrying iconic polished red leather randoseru backpack, lively expressive gestures',
    recommendedTastes: ['日常・アオハルポップ', 'ノスタルジック水彩・淡彩画']
  },
  {
    id: 'arch_exchange_student',
    name: '金髪碧眼の外国人留学生女子',
    category: 'student',
    icon: '🌍',
    color: 'cyan',
    tags: ['#金髪碧眼', '#留学生', '#好奇心旺盛', '#日本の制服'],
    summaryJa: '輝くブロンドヘアと青い瞳、日本の高校制服に袖を通して街のすべてに目を輝かせる天真爛漫な留学生。',
    dnaPromptEn: 'A cheerful European exchange student girl in Japan with shimmering golden-blonde wavy hair, bright cerulean blue eyes, wearing Japanese high school uniform blazer with ribbon tie, warm friendly inquisitive smile, holding camera or transit pass, fascinated by surroundings',
    recommendedTastes: ['日常・アオハルポップ', 'エモーショナル・シネマティック・スカイ']
  },

  // ── ② 社会人・ビジネス・現場系 (20) ──
  {
    id: 'arch_salaryman_tired',
    name: 'くたびれた中年サラリーマン',
    category: 'business',
    icon: '💼',
    color: 'slate',
    tags: ['#40代男性', '#ヨレたスーツ', '#哀愁の眼差し', '#生活感'],
    summaryJa: '満員電車と残業に揉まれる40代サラリーマン。ヨレたワイシャツに緩めたネクタイ、家族を想う優しい哀愁。',
    dnaPromptEn: 'A weary hardworking 45-year-old Japanese salaryman with tired gentle eyes, subtle crow feet wrinkles, slightly thinning dark hair, wearing a rumpled grey business suit with loosened necktie and rolled sleeves, holding battered leather briefcase, poignant everyday life pathos',
    recommendedTastes: ['昭和怪異ホラー・カケアミ劇画', '白黒劇画・超絶インクマンガ', 'フィルムノワール']
  },
  {
    id: 'arch_ceo_woman',
    name: '敏腕クールな女社長',
    category: 'business',
    icon: '👠',
    color: 'purple',
    tags: ['#30代女性', '#パンツスーツ', '#ハイヒール', '#凛とした強気'],
    summaryJa: '完璧に仕立てられたハイブランドスーツとピンヒール、妥協を許さない鋭い眼差しと圧倒的なカリスマの若き女社長。',
    dnaPromptEn: 'A sharp authoritative 35-year-old Japanese female CEO with sleek chin-length black bob hairstyle, piercing commanding dark eyes with subtle red lipstick, wearing an immaculate tailored charcoal pantsuit with silk blouse, pointed high heels, luxury wristwatch, aura of ruthless confidence',
    recommendedTastes: ['ラグジュアリー・ソシャゲ美麗キービジュアル', 'ダーク・ノワール', 'シネマティック']
  },
  {
    id: 'arch_office_lady_new',
    name: '新米の初々しいOL',
    category: 'business',
    icon: '📑',
    color: 'emerald',
    tags: ['#20代OL', '#オフィスカジュアル', '#一生懸命', '#清楚'],
    summaryJa: '柔らかなベージュのブラウスにタイトスカート、メモ帳を抱えて小走りでオフィスを駆け回る一生懸命な新入社員。',
    dnaPromptEn: 'An earnest 23-year-old Japanese female office worker with soft wavy dark hair tied in low ponytail, warm diligent brown eyes, wearing a neat pastel-beige blouse tucked into navy pencil skirt, ID badge lanyard around neck, holding document folder, modest approachable beauty',
    recommendedTastes: ['日常・アオハルポップ', 'ノスタルジック水彩・淡彩画']
  },
  {
    id: 'arch_elite_lawyer',
    name: '冷徹なエリート弁護士・官僚',
    category: 'business',
    icon: '⚖️',
    color: 'blue',
    tags: ['#エリート', '#銀縁メガネ', '#高級三つ揃え', '#鋭利な知性'],
    summaryJa: '非の打ち所のないオーダーメイドのスリーピーススーツと銀縁メガネ、感情を排して理路整然と語る若き天才。',
    dnaPromptEn: 'A coldly brilliant 30-year-old Japanese elite attorney with neatly styled swept-back hair, rimless rectangular spectacles, analytical piercing gaze, wearing a bespoke navy three-piece suit with pocket square, crisp white french cuff shirt, gold pin on lapel, sophisticated razor-sharp presence',
    recommendedTastes: ['ダーク・ノワール', '白黒劇画・超絶インクマンガ']
  },
  {
    id: 'arch_factory_artisan',
    name: '無骨な町工場の職人親父',
    category: 'business',
    icon: '🔧',
    color: 'amber',
    tags: ['#50代職人', '#油染み作業着', '#ねじり鉢巻', '#職人気質'],
    summaryJa: '金属粉と油染みのついた作業着にねじり鉢巻、何十年も機械と向き合ってきた分厚いゴツゴツした手の町工場親方。',
    dnaPromptEn: 'A rugged 55-year-old Japanese factory craftsman with weathered lined face, salt-and-pepper hair with twisted cloth hachimaki headband, intense focused eyes, wearing grease-stained blue work overalls with rolled-up sleeves, muscular calloused hands holding caliper measuring tool, artisanal pride',
    recommendedTastes: ['昭和怪異ホラー・カケアミ劇画', '白黒劇画・超絶インクマンガ']
  },
  {
    id: 'arch_construction_foreman',
    name: '熱血現場監督・ガテン系男性',
    category: 'business',
    icon: '🦺',
    color: 'orange',
    tags: ['#現場監督', '#ヘルメット', '#ニッカポッカ', '#日に焼けた肌'],
    summaryJa: '黄色い安全ヘルメットに反射ベスト、図面を片手に現場で大声で指示を飛ばす頼もしい筋肉質の男。',
    dnaPromptEn: 'A sturdy 32-year-old Japanese construction site foreman with tanned rugged skin, determined sharp gaze, wearing white safety hardhat, high-visibility fluorescent vest over work shirt, heavy utility toolbelt, holding construction blueprints rolled under arm, commanding physical authority',
    recommendedTastes: ['白黒劇画・超絶インクマンガ', 'シネマティック']
  },
  {
    id: 'arch_veteran_doctor_woman',
    name: '頼りになるベテラン女医',
    category: 'business',
    icon: '🩺',
    color: 'teal',
    tags: ['#40代医師', '#白衣', '#聴診器', '#包容力と知性'],
    summaryJa: '白衣のポケットに聴診器とボールペン、患者の痛みを理解し冷静に的確な診断を下す頼れる女医。',
    dnaPromptEn: 'A reassuring intellectual 42-year-old Japanese female medical doctor with shoulder-length dark hair tucked behind ears, gentle empathetic yet authoritative dark eyes, wearing pristine white medical lab coat over simple navy scrubs, stethoscope draped around neck, professional serene confidence',
    recommendedTastes: ['日常・アオハルポップ', 'ノスタルジック水彩・淡彩画']
  },
  {
    id: 'arch_nurse_cheerful',
    name: 'いつも笑顔の新米看護師',
    category: 'business',
    icon: '💉',
    color: 'rose',
    tags: ['#看護師', '#ナース服', '#優しい笑顔', '#献身'],
    summaryJa: 'パステルピンクのナースウェアにスニーカー、どんなに過酷な夜勤でも患者に笑顔を絶やさない健気な看護師。',
    dnaPromptEn: 'A compassionate 24-year-old Japanese nurse with dark hair neatly gathered in bun with hairnet, bright warm smiling eyes, wearing pale medical scrubs with pocket pen organizer and digital watch, lightweight athletic shoes, gentle bedside manner, heartwarming dedication',
    recommendedTastes: ['日常・アオハルポップ', 'ノスタルジック水彩・淡彩画']
  },
  {
    id: 'arch_veteran_detective',
    name: '強面だが情に厚いベテラン刑事',
    category: 'business',
    icon: '🕵️‍♂️',
    color: 'stone',
    tags: ['#50代刑事', '#トレンチコート', '#無精髭', '#事件の匂い'],
    summaryJa: 'くしゃくしゃのトレンチコートに無精髭、煙草の煙をくゆらせながら事件現場のわずかな違和感を見逃さないベテラン。',
    dnaPromptEn: 'A grizzled 52-year-old Japanese police detective with heavy stubble on jawline, hooded cynical yet observant dark eyes, unruly grey-streaked hair, wearing wrinkled beige trench coat over dark rumpled suit without tie, police badge clipped to pocket, smoky hardboiled atmosphere',
    recommendedTastes: ['昭和怪異ホラー・カケアミ劇画', 'ダーク・ノワール', '白黒劇画・超絶インクマンガ']
  },
  {
    id: 'arch_police_officer_young',
    name: '若手の熱血巡査・お巡りさん',
    category: 'business',
    icon: '👮‍♂️',
    color: 'blue',
    tags: ['#警察官', '#制服', '#敬礼', '#正義感'],
    summaryJa: 'ピシッとアイロンのかかった制服に警棒と手錠、街の人々の安全を守るため元気に自転車で巡回する好青年巡査。',
    dnaPromptEn: 'An earnest 25-year-old Japanese uniformed patrol police officer with short cropped black hair, bright resolute gaze, wearing formal dark-navy police uniform with silver shoulder insignia, utility belt, white-gloved hand giving crisp salute, clean-cut trustworthy protector aesthetic',
    recommendedTastes: ['日常・アオハルポップ', '白黒劇画・超絶インクマンガ']
  },
  {
    id: 'arch_it_startup_ceo',
    name: 'ITスタートアップの若きCEO',
    category: 'business',
    icon: '💻',
    color: 'indigo',
    tags: ['#20代後半', '#Tシャツにジャケット', '#スマートウォッチ', '#野心'],
    summaryJa: '上質な黒Tシャツに軽いアンコンジャケット、MacBookと最新スマートウォッチを身につけたスマートな起業家。',
    dnaPromptEn: 'A visionary 28-year-old Japanese tech startup founder with modern textured hairstyle, ambitious focused eyes, wearing premium black crewneck tee under slim unstructured blazer, wireless earbuds, smart device on wrist, holding ultra-thin laptop, minimalist contemporary entrepreneur presence',
    recommendedTastes: ['ネオンサイバー', 'シティポップ・80sレトロ']
  },
  {
    id: 'arch_delivery_driver',
    name: '街を駆ける宅配ドライバー',
    category: 'business',
    icon: '📦',
    color: 'teal',
    tags: ['#配達員', '#ユニフォーム', '#キャップ', '#軽快な身のこなし'],
    summaryJa: 'ブランドカラーのポロシャツに作業用キャップ、端末を片手に階段を駆け上がる爽やかで俊敏な配達員。',
    dnaPromptEn: 'An agile friendly 26-year-old Japanese courier delivery driver with short hair under branded baseball cap, energetic smile, wearing athletic polo uniform with reflective shoulder piping, utility gloves, holding portable electronic barcode scanner and parcel, dynamic urban worker',
    recommendedTastes: ['日常・アオハルポップ', '青春スナップ写真']
  },
  {
    id: 'arch_cleaning_man',
    name: '街の優しい清掃員のおじさん',
    category: 'business',
    icon: '🧹',
    color: 'emerald',
    tags: ['#60代男性', '#作業着', '#ほうき', '#穏やかなシワ'],
    summaryJa: '早朝の静かな街を竹ぼうきで掃き清める初老の男性。すれ違う子供たちに優しく挨拶する街の影の功労者。',
    dnaPromptEn: 'A humble gentle 62-year-old Japanese street cleaner with warm deeply creased smiling face, soft grey hair, wearing muted green utility overall jacket, safety gloves, holding traditional bamboo broom, early morning misty daylight, benevolent unsung community guardian aura',
    recommendedTastes: ['ノスタルジック水彩・淡彩画', 'レトロ淡彩アトリエ・極細線画']
  },
  {
    id: 'arch_cafe_owner_woman',
    name: 'おしゃれなカフェの女性店主',
    category: 'business',
    icon: '☕',
    color: 'amber',
    tags: ['#30代女性', '#リネンエプロン', '#丁寧な暮らし', '#コーヒー'],
    summaryJa: 'リネン素材のロングエプロンにラフなお団子ヘア、一杯ずつ丁寧にハンドドリップする静かで穏やかな女性バリスタ。',
    dnaPromptEn: 'A serene 33-year-old Japanese cafe owner with loose dark hair casually pinned in topknot, calm welcoming almond eyes, wearing an earthy linen cross-back apron over cotton blouse, holding brass goose-neck kettle pouring coffee, ambient wooden coffee shop lighting, artisan charm',
    recommendedTastes: ['ノスタルジック水彩・淡彩画', 'レトロ淡彩アトリエ・極細線画', '日常・アオハルポップ']
  },
  {
    id: 'arch_fashion_designer',
    name: '気鋭のファッションデザイナー',
    category: 'business',
    icon: '✂️',
    color: 'rose',
    tags: ['#デザイナー', '#アシンメトリー黒服', '#首かけメジャー', '#芸術家'],
    summaryJa: '首にテーラーメジャーをかけ、アシンメトリーな黒いモード服を着こなす妥協なき前衛クリエイター。',
    dnaPromptEn: 'An avant-garde 31-year-old Japanese fashion designer with striking asymmetrical haircut, sharp visionary gaze, wearing draped sculptural black designer garments, fabric measuring tape hung around neck, tailor shears in pocket, haute couture atelier ambiance',
    recommendedTastes: ['ラグジュアリー・ソシャゲ美麗キービジュアル', 'ダーク・ノワール']
  },
  {
    id: 'arch_kindergarten_teacher',
    name: '子供に慕われる男性保育士',
    category: 'business',
    icon: '🧸',
    color: 'yellow',
    tags: ['#保育士', '#くまさんエプロン', '#優しい笑顔', '#包容力'],
    summaryJa: '動物のアップリケがついた黄色いエプロンを着て、子供たちと同じ目線でしゃがみこんで笑いかける男性保育士。',
    dnaPromptEn: 'A warm affectionate 27-year-old Japanese male nursery school teacher with soft approachable facial features, laughing kind eyes, wearing a colorful animal-patterned apron over casual long-sleeve tee, kneeling down to child eye level with open arms, radiant empathy and innocence',
    recommendedTastes: ['日常・アオハルポップ', 'ノスタルジック水彩・淡彩画']
  },
  {
    id: 'arch_truck_driver_night',
    name: '深夜の長距離トラック運転手',
    category: 'business',
    icon: '🚚',
    color: 'slate',
    tags: ['#40代男性', '#首タオル', '#缶コーヒー', '#ハイウェイの孤独'],
    summaryJa: '首に巻いた吸水タオルに缶コーヒー、深夜の高速道路を何百キロも走り続けるタフで寡黙なドライバー。',
    dnaPromptEn: 'A resilient 44-year-old Japanese long-haul highway truck driver with broad shoulders, weathered rugged face, stubble, cotton towel draped around neck, wearing sleeveless work vest over t-shirt, holding hot canned coffee, highway truck cabin dashboard neon lights reflecting on face',
    recommendedTastes: ['昭和怪異ホラー・カケアミ劇画', 'シティポップ・80sレトロ', 'ダーク・ノワール']
  },
  {
    id: 'arch_bank_branch_manager',
    name: '堅実な銀行支店長・ベテラン行員',
    category: 'business',
    icon: '🏛️',
    color: 'slate',
    tags: ['#50代男性', '#三つ揃えスーツ', '#懐中時計', '#厳格'],
    summaryJa: '白髪交じりのきっちりした髪に、一切の無駄がない濃紺のスーツ。地域の中小企業を見守ってきた責任感ある銀行マン。',
    dnaPromptEn: 'A distinguished 56-year-old Japanese bank branch manager with combed silver-streaked hair, stoic discerning eyes, wearing a classic dark pinstripe three-piece suit with polished fountain pen tucked in breast pocket, authoritative stance, financial reliability',
    recommendedTastes: ['白黒劇画・超絶インクマンガ', 'ダーク・ノワール']
  },
  {
    id: 'arch_baseball_coach',
    name: '情熱的な高校野球部監督',
    category: 'business',
    icon: '⚾',
    color: 'amber',
    tags: ['#熱血漢', '#グラウンドジャージ', '#サングラス', '#甲子園の夢'],
    summaryJa: '日に焼けた赤ら顔に野球部グラウンドコート、首からストップウォッチを下げて選手たちに声を張り上げる熱血監督。',
    dnaPromptEn: 'A passionate 48-year-old Japanese high school baseball coach with deeply tanned weathered skin, loud commanding jaw, sunglasses resting on forehead, wearing team windbreaker jacket and ballcap, stopwatch around neck, clay dirt smudged on sneakers, intense sports drama spirit',
    recommendedTastes: ['白黒劇画・超絶インクマンガ', 'エモーショナル・シネマティック・スカイ']
  },
  {
    id: 'arch_taxi_driver_woman',
    name: '夜の女性タクシードライバー',
    category: 'business',
    icon: '🚕',
    color: 'cyan',
    tags: ['#タクシー運転手', '#白手袋', '#夜の街', '#聞き上手'],
    summaryJa: '純白の手袋に制帽、バックミラー越しに疲れた乗客を優しく見守り、静かに夜の雨の街を走らせる女性運転手。',
    dnaPromptEn: 'A calm observant 46-year-old Japanese female taxi driver with hair tied back neatly, attentive kind eyes reflecting urban neon through rearview mirror, wearing crisp uniform shirt with navy vest and white cotton driving gloves, gripping steering wheel, rainy night street reflections',
    recommendedTastes: ['シティポップ・80sレトロ', 'ダーク・ノワール', 'ノスタルジック水彩・淡彩画']
  },

  // ── ③ 日常・家庭・地域系 (15) ──
  {
    id: 'arch_housewife',
    name: '生活感あふれる専業主婦',
    category: 'daily',
    icon: '🍳',
    color: 'emerald',
    tags: ['#30-40代女性', '#割烹着またはエプロン', '#まとめ髪', '#家庭の温もり'],
    summaryJa: '後ろで束ねた髪に生活感のある布エプロン、夕食の買い出し袋や包丁を手にする家庭を支える温かいお母さん。',
    dnaPromptEn: 'A warm relatable 38-year-old Japanese homemaker and mother with soft dark hair pinned in a casual chignon, gentle crinkling smile around warm brown eyes, wearing a simple floral-patterned cooking apron over comfortable cardigan, kitchen countertop domestic lighting, deeply nurturing and grounded',
    recommendedTastes: ['日常・アオハルポップ', 'ノスタルジック水彩・淡彩画', '昭和怪異ホラー・カケアミ劇画']
  },
  {
    id: 'arch_strict_father',
    name: '無口だが家族想いな頑固親父',
    category: 'daily',
    icon: '🍶',
    color: 'slate',
    tags: ['#50代父親', '#甚平またはポロシャツ', '#腕組み', '#不器用な愛'],
    summaryJa: '無口で頑固、眉間にしわを寄せているが、子供の成長を影で誰よりも喜んでいる不器用な昭和気質の父親。',
    dnaPromptEn: 'A stern unpretentious 53-year-old Japanese father with furrowed brows, salt-and-pepper cropped hair, crossing muscular arms, wearing a navy cotton jinbei loungewear or simple collar shirt, traditional tatami living room backdrop, silent deep familial devotion',
    recommendedTastes: ['昭和怪異ホラー・カケアミ劇画', '白黒劇画・超絶インクマンガ']
  },
  {
    id: 'arch_kind_grandmother',
    name: '縁側の白髪の優しいおばあちゃん',
    category: 'daily',
    icon: '🍵',
    color: 'emerald',
    tags: ['#70代祖母', '#白髪かすり着物', '#縁側', '#温和な微笑み'],
    summaryJa: '縁側でお茶をすすりながら微笑む白髪のおばあちゃん。深いシワと温かい手で孫を包み込む郷愁の象徴。',
    dnaPromptEn: 'A beloved 78-year-old Japanese grandmother with pure silver-white hair tied back, deeply wrinkled kind face beaming with boundless warmth, wearing a traditional indigo kasuri cotton kimono with knitted vest, sitting on sunlit wooden engawa porch with teacup, nostalgic peaceful heritage',
    recommendedTastes: ['ノスタルジック水彩・淡彩画', 'レトロ淡彩アトリエ・極細線画']
  },
  {
    id: 'arch_retired_grandfather',
    name: '盆栽と将棋を愛する隠居祖父',
    category: 'daily',
    icon: '🪴',
    color: 'amber',
    tags: ['#70代祖父', '#盆栽バサミ', '#老眼鏡', '#悠々自適'],
    summaryJa: '鼻の上に老眼鏡を乗せ、庭の松の盆栽を手入れする長老。静かな時の流れの中に人生の深みを湛える。',
    dnaPromptEn: 'A serene wise 76-year-old Japanese grandfather with round reading glasses resting on bridge of nose, balding silver hair, wearing dark woolen haori jacket over kimono, holding traditional bonsai pruning shears over dwarf pine tree, quiet courtyard garden atmosphere',
    recommendedTastes: ['ノスタルジック水彩・淡彩画', '昭和怪異ホラー・カケアミ劇画']
  },
  {
    id: 'arch_pregnant_woman',
    name: 'お腹を愛おしむ幸せな妊婦',
    category: 'daily',
    icon: '🤰',
    color: 'rose',
    tags: ['#妊婦', '#マタニティ服', '#母性', '#柔らかな光'],
    summaryJa: '大きくなったお腹に優しく手を添え、まだ見ぬ我が子に語りかける柔らかな光に包まれたプレママ。',
    dnaPromptEn: 'A glowing expectant Japanese pregnant mother in her late 20s with soft shoulder-length chestnut hair, tranquil blissful expression, gently resting both hands on her swollen pregnant belly, wearing loose flowing pastel cotton maternity dress, soft morning window light, maternal grace',
    recommendedTastes: ['エモーショナル・シネマティック・スカイ', 'ノスタルジック水彩・淡彩画']
  },
  {
    id: 'arch_single_mother',
    name: '奮闘する若きシングルマザー',
    category: 'daily',
    icon: '👩‍👧',
    color: 'orange',
    tags: ['#シングルマザー', '#抱っこ紐', '#たくましさと愛', '#笑顔'],
    summaryJa: '抱っこ紐で赤ちゃんをあやしながら買い出し袋を持つ若き母親。疲労の中でも子供の笑顔に力を得るたくましさ。',
    dnaPromptEn: 'A resilient 26-year-old Japanese single mother with hair casually clamped, tired yet loving sparkling eyes, carrying baby in chest sling carrier while holding grocery bag, wearing modest denim jacket, standing at twilight suburban crosswalk, brave determined maternal strength',
    recommendedTastes: ['日常・アオハルポップ', 'ノスタルジック水彩・淡彩画']
  },
  {
    id: 'arch_weekend_dad',
    name: '全力で遊ぶマイホームパパ',
    category: 'daily',
    icon: '🏕️',
    color: 'cyan',
    tags: ['#30代父親', '#アウトドア服', '#子供と手繋ぎ', '#笑顔'],
    summaryJa: '休日は仕事のことを忘れ、子供と公園を走り回るアウトドアパーカー姿の明るいお父さん。',
    dnaPromptEn: 'A joyful 34-year-old Japanese family father with sporty haircut, radiant playful grin, wearing colorful outdoor windbreaker, cargo shorts, trail sneakers, kneeling down laughing with toddler, sunny suburban park green lawn backdrop, healthy wholesome domestic joy',
    recommendedTastes: ['日常・アオハルポップ', 'エモーショナル・シネマティック・スカイ']
  },
  {
    id: 'arch_nosy_neighbor',
    name: '隣の世話焼きおせっかいおばさん',
    category: 'daily',
    icon: '🧺',
    color: 'purple',
    tags: ['#50代主婦', '#回覧板', '#ご近所ネットワーク', '#愛嬌'],
    summaryJa: 'パーマヘアにカラフルなエプロン、回覧板を片手に路地で立ち話をする街の情報通なおばちゃん。',
    dnaPromptEn: 'A talkative lively 54-year-old Japanese neighborhood auntie with short curly permed hair, expressive theatrical facial gestures, bright colorful house apron, holding wooden clipboard neighborhood bulletin, standing outside residential gate, humorous local vitality',
    recommendedTastes: ['昭和怪異ホラー・カケアミ劇画', '日常・アオハルポップ']
  },
  {
    id: 'arch_candy_store_granny',
    name: '駄菓子屋の番頭おばあちゃん',
    category: 'daily',
    icon: '🍬',
    color: 'amber',
    tags: ['#駄菓子屋', '#昭和レトロ', '#小銭の計算', '#子供の見守り'],
    summaryJa: 'ガラス瓶の飴玉やスーパーボールに囲まれた昭和の駄菓子屋で、子供たちの10円玉を数えてくれるおばあちゃん。',
    dnaPromptEn: 'A nostalgic 75-year-old Japanese candy store granny sitting behind wooden glass counter filled with vintage sweet jars and toy snacks, counting bronze coins with wrinkled nimble fingers, warm watchful smile behind bifocal glasses, nostalgic Showa era retro candy shop interior',
    recommendedTastes: ['昭和怪異ホラー・カケアミ劇画', 'レトロ淡彩アトリエ・極細線画']
  },
  {
    id: 'arch_sleeping_baby',
    name: 'すやすや眠る無垢な赤ん坊',
    category: 'daily',
    icon: '👶',
    color: 'yellow',
    tags: ['#赤ちゃん', '#寝顔', '#よだれかけ', '#生命の神秘'],
    summaryJa: '柔らかな布団ですやすやと寝息を立てる赤ん坊。ぷくぷくの頬と小さな手、希望の光。',
    dnaPromptEn: 'A peaceful slumbering 6-month-old Japanese baby with soft delicate skin, chubby rosy cheeks, tiny closed eyelids with long lashes, wearing pastel organic cotton onesie, wrapped in soft knitted blanket, celestial serene innocence',
    recommendedTastes: ['ノスタルジック水彩・淡彩画', 'エモーショナル・シネマティック・スカイ']
  },
  {
    id: 'arch_lazy_brother',
    name: '休日にジャージで寝転ぶ兄',
    category: 'daily',
    icon: '🛋️',
    color: 'slate',
    tags: ['#だらしない兄', '#緑ジャージ', '#ポテチと漫画', '#無気力'],
    summaryJa: '寝癖だらけのボサボサ頭でこたつに潜り込み、ポテチを食べながら漫画を読むぐうたらな兄。',
    dnaPromptEn: 'A lazy 21-year-old Japanese older brother with unruly bedhead hair sticking in all directions, half-open sleepy eyes, wearing green high school athletic track pants and white undershirt, sprawled on tatami floor reading manga with snack bag nearby, humorous messy domestic slump',
    recommendedTastes: ['日常・アオハルポップ', '昭和怪異ホラー・カケアミ劇画']
  },
  {
    id: 'arch_spunky_sister',
    name: '勝気で口うるさいが可愛い妹',
    category: 'daily',
    icon: '👧',
    color: 'rose',
    tags: ['#勝気な妹', '#ショートボブ', '#部屋着', '#ツンデレ'],
    summaryJa: '腰に手を当てて兄に小言を言いつつも、なんだかんだ世話を焼いてくれる勝気で可愛い妹。',
    dnaPromptEn: 'A feisty cute 16-year-old Japanese younger sister with bob haircut, pouting spirited brown eyes, hands on hips in scolding pose, wearing casual oversized pastel pajama tee and shorts, lively expressive tsundere demeanor',
    recommendedTastes: ['日常・アオハルポップ', 'ノスタルジック水彩・淡彩画']
  },
  {
    id: 'arch_college_cousin',
    name: '垢抜けて帰省した大学生の従姉妹',
    category: 'daily',
    icon: '👒',
    color: 'teal',
    tags: ['#女子大生', '#都会の匂い', '#麦わら帽子', '#懐かしさ'],
    summaryJa: '東京の大学に進学して少し大人っぽくなって帰省した、どこか眩しい憧れの従姉妹のお姉さん。',
    dnaPromptEn: 'A charming fashionable 20-year-old Japanese college girl visiting countryside hometown, stylish highlighted wavy hair under straw sunhat, delicate silver necklace, wearing light summer sundress, nostalgic wistful smile looking at childhood scenery, captivating youthful bloom',
    recommendedTastes: ['エモーショナル・シネマティック・スカイ', '日常・アオハルポップ']
  },
  {
    id: 'arch_cat_landlady',
    name: '地域猫を可愛がるアパート大家',
    category: 'daily',
    icon: '🐱',
    color: 'emerald',
    tags: ['#60代大家さん', '#サンダル', '#地域猫', '#のんびり'],
    summaryJa: '木造アパートの階段下で野良猫たちにご飯をあげながら、住人に「おかえり」と声をかける人情味あふれる大家。',
    dnaPromptEn: 'A friendly 64-year-old Japanese apartment landlady with permed grey hair, comfortable cardigan and floral apron, kneeling in sunlight feeding two stray calico cats, weather-beaten wooden apartment building courtyard backdrop, heartwarming community matriarch',
    recommendedTastes: ['ノスタルジック水彩・淡彩画', '昭和怪異ホラー・カケアミ劇画']
  },
  {
    id: 'arch_morning_walker_man',
    name: '毎朝元気に挨拶する散歩親父',
    category: 'daily',
    icon: '🐕',
    color: 'cyan',
    tags: ['#散歩', '#柴犬', '#ウィンドブレーカー', '#朝の活気'],
    summaryJa: '柴犬のリードを引いて朝露の川沿いを歩き、すれ違う人皆に元気に「おはよう！」と声をかける健康的な初老男性。',
    dnaPromptEn: 'A healthy cheerful 58-year-old Japanese man on morning walk with his spirited Shiba Inu dog on leash, wearing bright jogging windbreaker and visor cap, vigorous warm smile, riverside walking path with morning sunrise mist, vibrant senior health',
    recommendedTastes: ['日常・アオハルポップ', 'エモーショナル・シネマティック・スカイ']
  },

  // ── ④ 夜・歓楽街・サブカル・アーティスト系 (15) ──
  {
    id: 'arch_ennui_bartender',
    name: 'アンニュイな夜のバーテンダー',
    category: 'subculture',
    icon: '🍸',
    color: 'purple',
    tags: ['#バーテンダー', '#黒ベスト', '#シェイカー', '#夜の静寂'],
    summaryJa: '照明を落としたオーセンティックバーで、グラスを静かに拭きながら客の愚痴を受け止める寡黙なバーテンダー。',
    dnaPromptEn: 'A quiet enigmatic 34-year-old Japanese bartender with slicked-back dark hair, observant melancholic dark eyes, wearing an immaculate black formal vest over starched white shirt and bow tie, polishing a crystal glass behind mahogany bar counter, amber liquor bottle reflections',
    recommendedTastes: ['ダーク・ノワール', 'シティポップ・80sレトロ']
  },
  {
    id: 'arch_host_no1',
    name: '歌舞伎町のNo.1ホスト',
    category: 'subculture',
    icon: '🍾',
    color: 'amber',
    tags: ['#ホスト', '#美形流し目', '#派手スーツ', '#シャンパン'],
    summaryJa: '計算された華やかな銀髪アシメヘアにデザイナーズスーツ、女性の心を惑わす甘く冷たい流し目の夜の帝王。',
    dnaPromptEn: 'A glamorous seductive 25-year-old Japanese top Kabukicho host with sculpted silver-ash highlighted hairstyle, mesmerizing almond-shaped eyes with alluring confident gaze, wearing an ornate slim-fit designer suit with satin lapels and sparkling diamond brooch, nightclub neon bokeh',
    recommendedTastes: ['ラグジュアリー・ソシャゲ美麗キービジュアル', 'ネオンサイバー']
  },
  {
    id: 'arch_cabaret_girl_lonely',
    name: '孤独を秘めた売れっ子キャバ嬢',
    category: 'subculture',
    icon: '💄',
    color: 'rose',
    tags: ['#キャバ嬢', '#ゴージャスドレス', '#巻き髪', '#裏の孤独'],
    summaryJa: '華やかなロングドレスと完璧なメイクで笑顔を振りまきつつも、控室でタバコを吹かしながら虚無を見つめる女性。',
    dnaPromptEn: 'A stunning 26-year-old Japanese hostess with cascading voluminous curled dark chestnut hair, exquisite glamorous makeup, wearing an iridescent fitted evening gown with slit, solitary reflective gaze backstage away from club lights, complex contrast of beauty and melancholy',
    recommendedTastes: ['シティポップ・80sレトロ', 'ダーク・ノワール']
  },
  {
    id: 'arch_rock_band_guitarist',
    name: '路地裏の孤高なロックギタリスト',
    category: 'subculture',
    icon: '🎸',
    color: 'red',
    tags: ['#バンドマン', '#革ジャン', '#エレキギター', '#反骨精神'],
    summaryJa: 'くたびれたヴィンテージ革ジャンにボロボロのレスポールギター、夜のライブハウス裏で火花を散らす情熱。',
    dnaPromptEn: 'A fierce edgy 24-year-old Japanese indie rock guitarist with messy shaggy dark hair over intense eyes, wearing a worn distressed black leather motorcycle jacket over graphic band tee, ripped black skinny jeans, holding battered electric guitar, gritty underground club alleyway',
    recommendedTastes: ['ダーク・ノワール', '昭和怪異ホラー・カケアミ劇画', '白黒劇画・超絶インクマンガ']
  },
  {
    id: 'arch_tattoo_artist',
    name: 'アングラなタトゥー彫師',
    category: 'subculture',
    icon: '🖋️',
    color: 'slate',
    tags: ['#彫師', '#タトゥー腕', '#黒ノースリーブ', '#職人技'],
    summaryJa: '両腕に和彫りと幾何学の緻密なタトゥーを刻み、暗いスタジオでニードルを構える寡黙なタトゥーアーティスト。',
    dnaPromptEn: 'An intimidating artistic 33-year-old Japanese tattoo artist with shaved undercut hair, penetrating focused dark eyes, extensive intricate tattoo sleeves covering muscular arms, wearing black sleeveless tank top and sanitary latex gloves, holding tattoo machine, dimly lit neon studio',
    recommendedTastes: ['ダーク・ノワール', '白黒劇画・超絶インクマンガ']
  },
  {
    id: 'arch_club_dj_producer',
    name: '薄暗いクラブの天才トラックメイカー',
    category: 'subculture',
    icon: '🎛️',
    color: 'cyan',
    tags: ['#クラブDJ', '#大型ヘッドホン', '#サンプラー', '#重低音'],
    summaryJa: '大型ヘッドホンを片耳にあて、シンセサイザーとターンテーブルを操りフロアを揺らす天才サウンドクリエイター。',
    dnaPromptEn: 'A cool engrossed 25-year-old Japanese electronic music producer and DJ with bleached fade haircut, oversized streetwear hoodie, glowing professional DJ headphones held to one ear, adjusting mixer knobs on glowing turntable deck, strobe club lighting and haze',
    recommendedTastes: ['ネオンサイバー', 'シティポップ・80sレトロ']
  },
  {
    id: 'arch_fortune_teller_woman',
    name: '怪しげな路地裏の女性占い師',
    category: 'subculture',
    icon: '🔮',
    color: 'purple',
    tags: ['#占い師', '#水晶玉', '#タロット', '#妖艶'],
    summaryJa: '紫のベールとタロットカード、薄暗いテントの中で人の運命を見通す妖しくも美しいミステリアスな占い師。',
    dnaPromptEn: 'A mysterious alluring 36-year-old Japanese tarot fortune teller with deep wavy raven hair adorned with metallic pendants, piercing dark eyes beneath purple silk lace veil, hands with ornate silver rings hovering over illuminated crystal sphere and tarot cards, candle-lit mystical ambiance',
    recommendedTastes: ['ノスタルジック魔女ファンタジー', 'ダーク・ノワール']
  },
  {
    id: 'arch_conbini_night_shift',
    name: '深夜コンビニの気だるげな金髪バイト',
    category: 'subculture',
    icon: '🏪',
    color: 'yellow',
    tags: ['#深夜コンビニ', '#金髪', '#気だるげ', '#夜勤'],
    summaryJa: '青と白のストライプ制服ベストに無造作な金髪、レジ前で退屈そうに深夜の客をやり過ごす青年。',
    dnaPromptEn: 'A bored listless 20-year-old Japanese convenience store night clerk with messy dyed yellow-blonde hair, tired hooded eyes, wearing striped retail store staff vest over dark hoodie, resting chin in palm behind glowing cash register, 3 AM fluorescent store lighting',
    recommendedTastes: ['シティポップ・80sレトロ', '昭和怪異ホラー・カケアミ劇画']
  },
  {
    id: 'arch_retro_cafe_master',
    name: '純喫茶の名物白髭マスター',
    category: 'subculture',
    icon: '☕',
    color: 'amber',
    tags: ['#純喫茶', '#白髭', '#サイフォン', '#昭和クラシック'],
    summaryJa: '立派な白髭に蝶ネクタイ、真鍮のサイフォンから立ち上る湯気を眺めながら静かにジャズを流す純喫茶の主。',
    dnaPromptEn: 'A dignified 68-year-old Japanese kissaten coffee master with full trimmed white beard and mustache, wise gentle eyes behind round horn-rimmed glasses, wearing vintage tweed vest and burgundy bow tie, standing next to bubbling glass siphon brewer, antique mahogany昭和 interior',
    recommendedTastes: ['レトロ淡彩アトリエ・極細線画', '昭和怪異ホラー・カケアミ劇画']
  },
  {
    id: 'arch_vintage_clothing_girl',
    name: 'サブカル古着屋の店員女子',
    category: 'subculture',
    icon: '👗',
    color: 'rose',
    tags: ['#古着屋', '#個性派ボブ', '#ヴィンテージ', '#カルチャー'],
    summaryJa: 'オレンジに染めたマッシュボブにレトロな柄シャツ、古着に囲まれた路地裏のセレクトショップ店員。',
    dnaPromptEn: 'A stylish artsy 22-year-old Japanese vintage boutique clerk with bright ginger-orange blunt bob haircut, creative playful makeup, wearing oversized 70s retro patterned silk shirt, high-waisted corduroy pants, colorful rings, standing among racks of secondhand thrift clothing',
    recommendedTastes: ['シティポップ・80sレトロ', '日常・アオハルポップ']
  },
  {
    id: 'arch_street_skater',
    name: '夜の街を滑るストリートスケーター',
    category: 'subculture',
    icon: '🛹',
    color: 'cyan',
    tags: ['#スケーター', '#ストリート服', '#深夜の疾走', '#自由'],
    summaryJa: 'グラフィティの壁を背にスケートボードを小脇に抱え、誰もいない深夜のビル街を風切って走る少年。',
    dnaPromptEn: 'A bold athletic 19-year-old Japanese street skateboarder with loose windblown hair, focused fearless gaze, wearing oversized graphic skate hoodie, baggy cargo pants, beat-up skate shoes, holding scratched grip-taped skateboard under arm, night urban concrete stairs with graffiti backdrop',
    recommendedTastes: ['ネオンサイバー', 'シティポップ・80sレトロ']
  },
  {
    id: 'arch_laundromat_runaway_girl',
    name: '深夜コインランドリーの家出少女',
    category: 'subculture',
    icon: '🧺',
    color: 'slate',
    tags: ['#家出少女', '#ダボダボ上着', '#夜の自販機', '#孤独'],
    summaryJa: '蛍光灯がチカチカする深夜の無人コインランドリーのベンチで、膝を抱えて温かい缶ココアを握りしめる少女。',
    dnaPromptEn: 'A vulnerable solitary 17-year-old Japanese runaway teenage girl with unkempt dark hair, melancholic distant eyes, curled up on plastic bench inside neon-lit 24-hour laundromat, wearing oversized winter padded jacket over school uniform, holding warm canned cocoa with both hands, cinematic lonely aesthetic',
    recommendedTastes: ['エモーショナル・シネマティック・スカイ', 'ノスタルジック水彩・淡彩画', '昭和怪異ホラー・カケアミ劇画']
  },
  {
    id: 'arch_theater_struggling_actor',
    name: '売れない若手下北沢劇団員',
    category: 'subculture',
    icon: '🎭',
    color: 'amber',
    tags: ['#劇団員', '#台本', '#情熱と貧乏', '#夢追人'],
    summaryJa: '付箋だらけのボロボロの演劇台本を握りしめ、四畳半のアパートで一人深夜のセリフ練習に没頭する青年。',
    dnaPromptEn: 'A passionate struggling 24-year-old Japanese indie theater actor with shaggy hair, expressive intense emotive eyes, wearing casual thrifted knit sweater with frayed cuffs, clutching dog-eared marked-up script booklet with colorful sticky notes, humble bohemian apartment setting',
    recommendedTastes: ['白黒劇画・超絶インクマンガ', 'ノスタルジック水彩・淡彩画']
  },
  {
    id: 'arch_nightclub_promoter',
    name: 'ネオン街の客引き・黒服ボーイ',
    category: 'subculture',
    icon: '📱',
    color: 'slate',
    tags: ['#黒服', '#インカム', '#夜の街', '#冷徹な観察者'],
    summaryJa: '耳にインカムを装着し、路肩で街行く人々を観察しながら無線で合図を送る歓楽街の黒服青年。',
    dnaPromptEn: 'A sharp observant 26-year-old Japanese nightclub floor manager with slicked hair, discreet ear-piece communicator with curled wire, alert cynical eyes, wearing tailored black security suit without tie, standing on rainy neon-lit Kabukicho street corner, ambient urban night mist',
    recommendedTastes: ['ダーク・ノワール', 'ネオンサイバー']
  },
  {
    id: 'arch_underground_idol_center',
    name: '地下アイドルの健気なセンター少女',
    category: 'subculture',
    icon: '🎤',
    color: 'pink',
    tags: ['#地下アイドル', '#ステージ衣装', '#全力の笑顔', '#汗と涙'],
    summaryJa: '手作りのフリル衣装に身を包み、小さなライブハウスのステージで汗を流しながら客席へ全力で歌いかける少女。',
    dnaPromptEn: 'A resilient spirited 18-year-old Japanese underground idol girl with cute bob haircut and sparkly hairclip, shining tearful smiling eyes, glistening perspiration on forehead, wearing handmade pastel frilled stage idol costume with sequins, gripping microphone singing passionately, basement live house spotlights',
    recommendedTastes: ['日常・アオハルポップ', 'エモーショナル・シネマティック・スカイ']
  },

  // ── ⑤ サスペンス・裏社会・犯罪・怪異系 (15) ──
  {
    id: 'arch_creepy_man',
    name: '不気味な怪しい男 (怪異・ストーカー)',
    category: 'suspense',
    icon: '👁️',
    color: 'red',
    tags: ['#不気味', '#見開いた目', '#暗がり', '#心理ホラー'],
    summaryJa: '電柱の陰や街灯の届かない路地裏に立ち、異様な見開いた瞳でじっとこちらを見つめる不穏な男。',
    dnaPromptEn: 'An unsettling eerie Japanese man in his late 30s with unblinking unnervingly wide staring dark eyes, hollow sunken cheeks, sickly pale skin, messy stringy dark hair, wearing a drab oversized nondescript trench coat, partially obscured in shadowy alley corner, psychological horror presence',
    recommendedTastes: ['昭和怪異ホラー・カケアミ劇画', '白黒劇画・超絶インクマンガ']
  },
  {
    id: 'arch_cold_hitman',
    name: '冷酷無比なプロの暗殺者',
    category: 'suspense',
    icon: '🎯',
    color: 'slate',
    tags: ['#殺し屋', '#黒革グローブ', '#感情ゼロ', '#完璧な仕事'],
    summaryJa: '黒のスーツに革グローブ、消音器付きの銃を構え、一切の感情を殺してターゲットを見据えるプロフェッショナル。',
    dnaPromptEn: 'A lethal emotionless 35-year-old Japanese professional assassin with razor-sharp features, cold dead obsidian eyes, wearing immaculate black bespoke suit, fitted black leather gloves, silencer weapon resting in holster, high-contrast chiaroscuro lighting, terrifying efficiency',
    recommendedTastes: ['ダーク・ノワール', '白黒劇画・超絶インクマンガ']
  },
  {
    id: 'arch_yakuza_thug',
    name: '路地裏の威勢のいいチンピラヤクザ',
    category: 'suspense',
    icon: '👊',
    color: 'red',
    tags: ['#チンピラ', '#派手な柄シャツ', '#金ネックレス', '#威圧感'],
    summaryJa: '胸元を大きく開けた派手なアロハ柄シャツに金の喜平ネックレス、煙草をくわえて肩で風を切る血気盛んな若者。',
    dnaPromptEn: 'A brazen aggressive 25-year-old Japanese yakuza thug with buzzed cropped hair, menacing glare, scar across eyebrow, wearing an open-collared loud patterned silk shirt showing chest collarbone and thick gold chain necklace, cigarette hanging from lip, fierce intimidating swagger',
    recommendedTastes: ['白黒劇画・超絶インクマンガ', '昭和怪異ホラー・カケアミ劇画']
  },
  {
    id: 'arch_underworld_boss_elder',
    name: '裏社会を牛耳る黒幕の老人',
    category: 'suspense',
    icon: '🍷',
    color: 'purple',
    tags: ['#黒幕', '#威厳ある老人', '#高級ガウン', '#深淵の眼光'],
    summaryJa: '重厚な革張りソファーに腰掛け、ワイングラスを傾けながら街の命運を指先一つで動かす冷酷な巨頭。',
    dnaPromptEn: 'An imposing sinister 70-year-old Japanese underworld syndicate boss with immaculate swept-back silver hair, piercing ruthless eyes surrounded by weathered authority wrinkles, wearing a luxurious velvet dressing gown with gold embroidery, holding crystal wine glass, opulent dark manor study',
    recommendedTastes: ['ダーク・ノワール', 'ラグジュアリー・ソシャゲ美麗キービジュアル']
  },
  {
    id: 'arch_hardboiled_pi',
    name: '雑居ビルの私立探偵',
    category: 'suspense',
    icon: '🔍',
    color: 'amber',
    tags: ['#私立探偵', '#フェドーラ帽', '#ジッポライター', '#傷だらけ'],
    summaryJa: '雨滴が打ちつけるガラス窓の探偵事務所で、ジッポの炎でタバコに火をつけながら事件の写真を睨む探偵。',
    dnaPromptEn: 'A rugged world-weary 40-year-old Japanese private investigator with angled fedora hat casting shadow over sharp detective eyes, rugged 5 o clock shadow stubble, wearing rumpled brown trench coat with loosened collar, lighting zippo lighter flame, vintage cluttered detective office',
    recommendedTastes: ['ダーク・ノワール', '昭和怪異ホラー・カケアミ劇画']
  },
  {
    id: 'arch_wheelchair_informant',
    name: '裏社会の情報屋青年',
    category: 'suspense',
    icon: '🖥️',
    color: 'cyan',
    tags: ['#情報屋', '#車椅子', '#マルチモニター', '#天才ハッカー'],
    summaryJa: '複数のモニターが青白く光る地下室の車椅子に座り、街中の秘密をデータとして売買する病弱な天才ハッカー。',
    dnaPromptEn: 'A pale frail 23-year-old Japanese underground information broker sitting in a high-tech customized wheelchair, intellectual calculating gaze, soft messy hair, wearing oversized cozy knit cardigan, surrounded by glowing multi-monitor computer screens displaying encrypted data maps in dark basement',
    recommendedTastes: ['ネオンサイバー', 'ダーク・ノワール']
  },
  {
    id: 'arch_loan_shark',
    name: '冷血なヤミ金業者・取り立て屋',
    category: 'suspense',
    icon: '💸',
    color: 'yellow',
    tags: ['#ヤミ金', '#色つきサングラス', '#ブランド時計', '#冷徹'],
    summaryJa: '薄い紫のサングラスに高級ブランドのジャージスーツ、借金の利息を電卓で叩きながら笑みを浮かべる取り立て屋。',
    dnaPromptEn: 'A ruthless calculating 38-year-old Japanese loan shark with slicked undercut, wearing tinted purple-gradient sunglasses, gold signet ring on finger holding digital calculator, high-end designer track jacket, cold mocking smirk, shadowy tenement hallway setting',
    recommendedTastes: ['白黒劇画・超絶インクマンガ', '昭和怪異ホラー・カケアミ劇画']
  },
  {
    id: 'arch_mad_scientist',
    name: '狂気の天才マッドサイエンティスト',
    category: 'suspense',
    icon: '🧪',
    color: 'emerald',
    tags: ['#狂気', '#ボロボロの白衣', '#フラスコ', '#禁断の研究'],
    summaryJa: '薬品で煤けた白衣に乱れ髪、怪しく発光する試験管を掲げて狂気の笑みを浮かべる孤高の科学者。',
    dnaPromptEn: 'A deranged brilliant 45-year-old Japanese mad scientist with wild uncombed grey-black hair standing on end, crazed bloodshot wide eyes behind goggles pushed to forehead, wearing a scorched stained lab coat, holding glowing fluorescent chemical flask, chaotic secret lab apparatus',
    recommendedTastes: ['昭和怪異ホラー・カケアミ劇画', 'ネオンサイバー']
  },
  {
    id: 'arch_fugitive_runaway',
    name: '雨の夜を逃亡する指名手配犯',
    category: 'suspense',
    icon: '🏃‍♂️',
    color: 'slate',
    tags: ['#逃亡者', '#深めフード', '#泥だらけ', '#切迫感'],
    summaryJa: '深くかぶった黒いパーカーのフードから覗く怯えと覚悟の瞳。サイレンの音に背を向け雨の闇へと走る逃亡者。',
    dnaPromptEn: 'A desperate hunted 29-year-old Japanese fugitive runaway with dark hood pulled low over drenched face, haunted paranoid eyes darting sideways, rain-soaked mud-splattered clothing, bruised cheekbone, breathless gasping sprint through dark wet industrial backstreets, dramatic tension',
    recommendedTastes: ['ダーク・ノワール', '昭和怪異ホラー・カケアミ劇画']
  },
  {
    id: 'arch_intellectual_swindler',
    name: '爽やかな笑顔の知能派詐欺師',
    category: 'suspense',
    icon: '🃏',
    color: 'blue',
    tags: ['#結婚詐欺師', '#完璧な笑顔', '#高級スーツ', '#裏の冷酷さ'],
    summaryJa: '誰もが信頼してしまう誠実そうな笑顔と高級スーツを纏いながら、心の中では標的の財産を冷酷に計算する詐欺師。',
    dnaPromptEn: 'A handsome impeccably groomed 32-year-old Japanese con artist with charming persuasive smile, refined polished dark hair, warm approachable eyes masking cold psychopathic calculation, wearing tailored navy luxury suit, holding champagne flute, opulent high-society gala background',
    recommendedTastes: ['ラグジュアリー・ソシャゲ美麗キービジュアル', 'ダーク・ノワール']
  },
  {
    id: 'arch_paranormal_streamer',
    name: '廃墟を彷徨う心霊系配信者',
    category: 'suspense',
    icon: '📹',
    color: 'green',
    tags: ['#心霊配信者', '#LEDライト', '#怯え顔', '#廃病院'],
    summaryJa: 'スマホ用ジンバルとLEDライトを手に、禁足地の廃病院へ足を踏み入れ本物の怪異に直面して青ざめる配信者。',
    dnaPromptEn: 'A terrified 22-year-old Japanese urban explorer live-streamer holding handheld smartphone rig with harsh blinding LED video light, trembling wide-eyed expression with cold sweat, wearing dark utility vest over hoodie, dark eerie abandoned hallway stretching into darkness behind',
    recommendedTastes: ['昭和怪異ホラー・カケアミ劇画', 'ダーク・ノワール']
  },
  {
    id: 'arch_bandaged_amnesiac_girl',
    name: '記憶喪失の包帯少女',
    category: 'suspense',
    icon: '🩹',
    color: 'rose',
    tags: ['#包帯少女', '#記憶喪失', '#病院着', '#謎の痣'],
    summaryJa: '頭部や腕に巻かれた白い包帯、何も思い出せない無垢で怯えた瞳で雨の降る病室の窓の外を見つめる謎の少女。',
    dnaPromptEn: 'A fragile enigmatic 16-year-old Japanese girl with white medical bandages wrapped around forehead and wrists, pale porcelain skin, bewildered haunted dark eyes, wearing loose hospital gown, clutching windowsill looking out into torrential rain, psychological mystery aura',
    recommendedTastes: ['ノスタルジック水彩・淡彩画', '昭和怪異ホラー・カケアミ劇画']
  },
  {
    id: 'arch_street_pickpocket_boy',
    name: '路地裏で暗躍するスリの孤児',
    category: 'suspense',
    icon: '🧤',
    color: 'amber',
    tags: ['#スリの少年', '#身軽', '#すばやい手先', '#ストリートの飢え'],
    summaryJa: '身軽な体躯とすばやい手先、すれ違いざまに財布を抜き取り雑踏へと煙のように消えていくストリートの孤児。',
    dnaPromptEn: 'A quick-witted nimble 14-year-old Japanese street urchin pickpocket with messy hair, sharp feral survivalist eyes, smudged dirt on cheeks, wearing oversized faded oversized vest and patched trousers, nimble fingers sliding a stolen leather wallet into pocket, crowded market alley',
    recommendedTastes: ['昭和怪異ホラー・カケアミ劇画', '白黒劇画・超絶インクマンガ']
  },
  {
    id: 'arch_one_eyed_smuggler',
    name: '密輸船の隻眼の船長',
    category: 'suspense',
    icon: '⚓',
    color: 'slate',
    tags: ['#隻眼', '#アイパッチ', '#荒くれ者', '#密輸船長'],
    summaryJa: '黒革のアイパッチに塩で焼けた肌、荒れ狂う深夜の海で密輸コンテナを運ぶタフで危険な海の狼。',
    dnaPromptEn: 'A grizzled intimidating 50-year-old Japanese sea captain with black leather eyepatch covering left eye, thick salt-and-pepper beard, weathered sun-scorched skin, wearing heavy wool peacoat and weathered nautical cap, gripping storm-battered ship wheel, stormy nocturnal sea spray',
    recommendedTastes: ['白黒劇画・超絶インクマンガ', 'ダーク・ノワール']
  },
  {
    id: 'arch_stoic_mercenary',
    name: '感情を殺した元特殊部隊傭兵',
    category: 'suspense',
    icon: '🎖️',
    color: 'stone',
    tags: ['#傭兵', '#迷彩服', '#ドッグタグ', '#感情欠落'],
    summaryJa: '首元に光るドッグタグと首筋の戦闘傷、感情を極限まで削ぎ落とし任務遂行のためだけに動く孤高の戦士。',
    dnaPromptEn: 'A battle-hardened stoic 36-year-old Japanese mercenary with military buzzcut, severe emotionless gaze, combat scar along neck, silver dog tags resting against tactical black compression shirt, muscular scarred physique, subdued ambient warzone smoke background',
    recommendedTastes: ['白黒劇画・超絶インクマンガ', 'シネマティック']
  },

  // ── ⑥ 特殊・ケモミミ・ファンタジー系 (10) ──
  {
    id: 'arch_cat_devil_maid',
    name: '黒猫耳の小悪魔メイド',
    category: 'fantasy',
    icon: '🐈‍⬛',
    color: 'purple',
    tags: ['#黒猫耳', '#黒猫の尻尾', '#ゴシックメイド', '#小悪魔'],
    summaryJa: 'ぴんと立った黒猫の耳にしなやかな尻尾、クラシカルなゴシックメイド服にいたずらっぽい笑みを浮かべる少女。',
    dnaPromptEn: 'A mischievous gothic Japanese anime girl with fluffy black cat ears and flexible sleek black cat tail, emerald-green feline eyes, wearing a dark Victorian maid dress with white lace apron, choker with tiny brass bell, playful teasing smirk, charming kemonomimi aesthetic',
    recommendedTastes: ['ノスタルジック魔女ファンタジー', 'ラグジュアリー・ソシャゲ美麗キービジュアル']
  },
  {
    id: 'arch_bunny_nurse_clumsy',
    name: '垂れ耳ウサギの癒やし系ナース',
    category: 'fantasy',
    icon: '🐰',
    color: 'pink',
    tags: ['#垂れ耳ウサギ', '#ふわふわ尻尾', '#ドジっ子ナース', '#癒やし'],
    summaryJa: '頭から垂れた大きな白ウサギの耳と丸い尻尾、いつも慌てて薬品を落としそうになりながらも患者を癒やすナース。',
    dnaPromptEn: 'A sweet clumsy anime girl with long floppy white bunny ears drooping along her sides and fluffy round rabbit tail, wide innocent ruby-red eyes, wearing a pastel-pink nurse dress with ruffled cap and heart emblem, blush on cheeks, adorably endearing kemonomimi nurse',
    recommendedTastes: ['日常・アオハルポップ', 'ノスタルジック水彩・淡彩画']
  },
  {
    id: 'arch_silver_wolf_warrior',
    name: '孤高な銀狼耳の女戦士',
    category: 'fantasy',
    icon: '🐺',
    color: 'slate',
    tags: ['#銀狼耳', '#狼の尻尾', '#軽鎧', '#大剣'],
    summaryJa: '銀色に輝く狼の耳とふさふさの尾、冷たい北風の中で巨大なグレートソードを背負う孤高の女戦士。',
    dnaPromptEn: 'A proud noble anime female warrior with sharp silver wolf ears and majestic bushy wolf tail, long flowing silver hair, piercing icy-blue predatory eyes, wearing lightweight engraved leather-and-steel battle armor, carrying massive claymore sword, snow-covered mountain cliff backdrop',
    recommendedTastes: ['ラグジュアリー・ソシャゲ美麗キービジュアル', '白黒劇画・超絶インクマンガ']
  },
  {
    id: 'arch_elf_archer_noble',
    name: '気高きエルフの森の弓兵',
    category: 'fantasy',
    icon: '🧝‍♀️',
    color: 'emerald',
    tags: ['#エルフ', '#尖り耳', '#長弓', '#神秘の森'],
    summaryJa: '透き通る長い尖り耳に黄金の長い髪、深緑のマントを翻して風を読む神秘的な森の守護者。',
    dnaPromptEn: 'An ethereal high-elf archer with slender pointed ears, cascading spun-gold hair, luminous celestial green eyes, wearing forest-green and bronze leather scout attire, drawing an ornate elven recurve longbow, mystical ancient forest glade with floating sunbeams',
    recommendedTastes: ['ノスタルジック魔女ファンタジー', 'ラグジュアリー・ソシャゲ美麗キービジュアル']
  },
  {
    id: 'arch_apprentice_witch',
    name: '見習い魔女・ほうきに乗る少女',
    category: 'fantasy',
    icon: '🧙‍♀️',
    color: 'indigo',
    tags: ['#魔女', '#とんがり帽子', '#ほうき', '#使い魔の小鳥'],
    summaryJa: '体よりも大きなつば広のとんがり帽子をかぶり、古い木製ほうきにまたがって夜空を飛ぶ見習い魔女。',
    dnaPromptEn: 'A charming apprentice anime witch girl wearing an oversized floppy pointed witch hat, flowing starry purple cape over modest dress, clutching a rustic wooden flying broomstick, companion glowing familiar bird on shoulder, full moon night sky with twinkling constellations',
    recommendedTastes: ['ノスタルジック魔女ファンタジー', 'レトロ淡彩アトリエ・極細線画']
  },
  {
    id: 'arch_silver_holy_knight',
    name: '忠義を誓う白銀の女騎士',
    category: 'fantasy',
    icon: '⚔️',
    color: 'blue',
    tags: ['#白銀騎士', '#フルプレート鎧', '#聖剣', '#凛とした美しさ'],
    summaryJa: '磨き上げられた純白の甲冑に青いマント、聖剣を胸元に構えて静かに祈りを捧げる気高き女騎士。',
    dnaPromptEn: 'A valiant beautiful female paladin knight with braided blonde hair, resolute sapphire eyes, clad in polished mirror-like silver plate armor with royal blue tabard and cape, resting both hands on the hilt of a glowing holy broadsword, cathedral stained glass lighting',
    recommendedTastes: ['ラグジュアリー・ソシャゲ美麗キービジュアル', '白黒劇画・超絶インクマンガ']
  },
  {
    id: 'arch_pixie_fairy_mischief',
    name: '小さな羽を持ついたずら妖精',
    category: 'fantasy',
    icon: '🧚‍♀️',
    color: 'teal',
    tags: ['#妖精', '#半透明の羽', '#手のひらサイズ', '#発光'],
    summaryJa: '手のひらサイズで背中にトンボのような半透明の羽を持ち、光の粉を散らしながら宙を舞ういたずら妖精。',
    dnaPromptEn: 'A miniature glowing fairy girl hovering in mid-air with delicate iridescent dragonfly-like translucent wings, playful sparkling golden eyes, wearing a petal-woven dress, surrounded by shimmering magical dust particles, macro depth of field foliage background',
    recommendedTastes: ['ノスタルジック魔女ファンタジー', 'エモーショナル・シネマティック・スカイ']
  },
  {
    id: 'arch_dragonewt_warrior',
    name: '竜の角と尾を持つ戦士青年',
    category: 'fantasy',
    icon: '🐉',
    color: 'orange',
    tags: ['#竜角', '#ドラゴンの尾', '#鱗', '#豪快な戦士'],
    summaryJa: '側頭部から伸びる漆黒の竜の角と力強いドラゴンの尾、頬に走る鱗が野生の風格を漂わせる戦士。',
    dnaPromptEn: 'A formidable dragonewt anime warrior youth with obsidian dragon horns curving from temples, powerful reptilian armored tail, subtle crimson dragon scales on cheeks and forearms, fierce molten gold slit-pupil eyes, wearing barbarian leather battle vest, crackling flame aura',
    recommendedTastes: ['ラグジュアリー・ソシャゲ美麗キービジュアル', '白黒劇画・超絶インクマンガ']
  },
  {
    id: 'arch_mermaid_singer',
    name: '深海の歌姫・人魚の少女',
    category: 'fantasy',
    icon: '🧜‍♀️',
    color: 'cyan',
    tags: ['#人魚', '#真珠の尾ひれ', '#水泡', '#深海の美声'],
    summaryJa: 'エメラルドグリーンに輝く美しい尾ひれと真珠の髪飾り、静かな深海で泡に包まれて歌う人魚の少女。',
    dnaPromptEn: 'A breathtaking mermaid girl floating weightlessly in deep ocean waters, long bioluminescent teal hair drifting like sea anemones, iridescent shimmering fish scales transitioning into majestic fins, glowing pearl jewelry, air bubbles rising in sunbeam-pierced blue abyss',
    recommendedTastes: ['エモーショナル・シネマティック・スカイ', 'ノスタルジック水彩・淡彩画']
  },
  {
    id: 'arch_cyborg_kemomimi',
    name: 'サイボーグ・メカケモミミ少女',
    category: 'fantasy',
    icon: '🤖',
    color: 'cyan',
    tags: ['#メカ狐耳', '#アンドロイド', '#発光ライン', '#電脳空間'],
    summaryJa: 'カーボンファイバーのメカニカルな狐耳と関節に埋め込まれた青いネオンライン、感情を覚え始めた人工生命体。',
    dnaPromptEn: 'A futuristic cybernetic android girl with high-tech carbon-fiber mechanical fox ears and glowing blue fiber-optic tail, synthetic porcelain face with glowing cybernetic barcode tattoo, wearing sleek modular bodysuit, holographic digital UI rings hovering around fingertips',
    recommendedTastes: ['ネオンサイバー', 'シティポップ・80sレトロ']
  },

  // ── ⑦ 歴史・和風・幕末・古典系 (10) ──
  {
    id: 'arch_edo_firefighter',
    name: '江戸の粋な町火消し・若い頭',
    category: 'historical',
    icon: '🚒',
    color: 'red',
    tags: ['#江戸町火消し', '#刺子半纏', '#纏持ち', '#粋と鯔背'],
    summaryJa: '白黒の刺子半纏にねじり鉢巻、大屋根の上に飛び乗って重い纏を力強く振り回す江戸のヒーロー。',
    dnaPromptEn: 'A spirited young Edo period Japanese firefighter matoi-bearer with sharp handsome features, twisted cloth headband, fearless blazing eyes, wearing heavy geometric-patterned sashiko quilted coat with rolled sleeves, balancing atop wooden roof holding ornate fire brigade standard',
    recommendedTastes: ['葛飾北斎・超写実肉筆浮世絵', '白黒劇画・超絶インクマンガ']
  },
  {
    id: 'arch_wandering_ronin',
    name: '酒と刀を愛する無頼の浪人剣客',
    category: 'historical',
    icon: '🍶',
    color: 'stone',
    tags: ['#浪人', '#無精髭', '#竹光ではなく真剣', '#孤高'],
    summaryJa: '擦り切れた着物に無精髭、ひょうたんの酒をあおりながら雨宿りし、悪党の前に静かに太刀を抜く剣客。',
    dnaPromptEn: 'A weary masterless samurai ronin in weathered indigo cotton kimono with frayed hem, rugged dark stubble, uncombed topknot, calm razor-sharp gaze under tattered straw sunhat, hand resting loosely on the worn hilt of a curved katana, rain falling on wooden post-station eaves',
    recommendedTastes: ['昭和怪異ホラー・カケアミ劇画', '白黒劇画・超絶インクマンガ', '葛飾北斎・超写実肉筆浮世絵']
  },
  {
    id: 'arch_yoshiwara_oiran',
    name: '吉原の気高き最高峰花魁',
    category: 'historical',
    icon: '👘',
    color: 'rose',
    tags: ['#花魁', '#豪華打掛', '#かんざし', '#八文字道中'],
    summaryJa: '幾重にも挿した鼈甲のかんざしに金糸の豪華絢爛な打掛、三枚歯の高下駄で悠然と歩く吉原の華。',
    dnaPromptEn: 'A magnificent Edo period tayuu oiran courtesan with towering sculpted chignon adorned with glowing tortoiseshell hairpins and gold ornaments, porcelain white makeup with crimson lips, wearing heavy lavish silk uchikake kimono embroidered with golden phoenixes, regal commanding allure',
    recommendedTastes: ['葛飾北斎・超写実肉筆浮世絵', 'ラグジュアリー・ソシャゲ美麗キービジュアル']
  },
  {
    id: 'arch_shinsengumi_swordsman',
    name: '浅葱色のだんだら羽織の隊士',
    category: 'historical',
    icon: '⚔️',
    color: 'cyan',
    tags: ['#新選組', '#だんだら羽織', '#白鉢金', '#誠の志'],
    summaryJa: '白黒山形模様の浅葱色羽織に白鉢金、幕末京都の治安を守るため命を懸けて刀を振るう若き志士。',
    dnaPromptEn: 'A resolute young Shinsengumi samurai swordsman with tied dark hair, white forehead hachigane metal headband, intense loyal eyes, wearing the iconic light-cyan asagi-iro haori with white mountain-zigzag sleeve trim, holding drawn katana reflecting moonlight, nighttime Kyoto alleyway',
    recommendedTastes: ['白黒劇画・超絶インクマンガ', '葛飾北斎・超写実肉筆浮世絵']
  },
  {
    id: 'arch_teahouse_poster_girl',
    name: '町屋の元気な茶屋看板娘',
    category: 'historical',
    icon: '🍡',
    color: 'emerald',
    tags: ['#茶屋の看板娘', '#たすき掛け', '#三色団子', '#愛嬌'],
    summaryJa: '赤い前掛けにたすき掛け、湯気の立つ急須と三色団子を盆に乗せて元気いっぱいに客を迎える下町の看板娘。',
    dnaPromptEn: 'A charming lively Edo town teahouse poster girl with hair tied in traditional shimada style with red ribbon, rosy cheeks, cheerful welcoming smile, wearing indigo patterned kimono with sleeves tied up with red cord tasuki, holding wooden serving tray with matcha and dango skewers',
    recommendedTastes: ['葛飾北斎・超写実肉筆浮世絵', '日常・アオハルポップ']
  },
  {
    id: 'arch_kunoichi_shadow',
    name: '闇夜を駆ける黒装束のくノ一',
    category: 'historical',
    icon: '🥷',
    color: 'purple',
    tags: ['#くノ一', '#忍び装束', '#クナイ', '#月下の影'],
    summaryJa: '月光を浴びて城の瓦屋根を音もなく駆け、手裏剣とクナイを構えて闇に溶け込む女忍者。',
    dnaPromptEn: 'A stealthy graceful kunoichi female ninja with black face mask revealing piercing focused dark eyes, sleek black shinobi attire with lightweight chainmail protection, holding twin gleaming kunai daggers, leaping silently across castle tiled rooftops under silver full moon',
    recommendedTastes: ['白黒劇画・超絶インクマンガ', 'ダーク・ノワール']
  },
  {
    id: 'arch_dojo_master_daughter',
    name: '道場を背負う若き天才剣術小町',
    category: 'historical',
    icon: '🥋',
    color: 'blue',
    tags: ['#剣術小町', '#白道着と紺袴', '#木刀', '#凛とした気迫'],
    summaryJa: '凛とした姿勢で木刀を正眼に構える道場の娘。清らかな美しさと男勝りの剣技を併せ持つ。',
    dnaPromptEn: 'A proud noble Edo period female kenjutsu practitioner with long dark ponytail, dignified intense gaze, wearing pristine white training dogi and navy pleated hakama trousers, holding polished bokken wooden practice sword in centered stance, traditional wooden dojo floor',
    recommendedTastes: ['白黒劇画・超絶インクマンガ', '葛飾北斎・超写実肉筆浮世絵']
  },
  {
    id: 'arch_merchant_playboy_heir',
    name: '呉服問屋の遊び人風の若旦那',
    category: 'historical',
    icon: '🪭',
    color: 'amber',
    tags: ['#若旦那', '#上等な絹羽織', '#白檀の扇子', '#飄々'],
    summaryJa: '上質な紬の着物に白檀の扇子、一見遊び人風だが実は情勢を冷静に分析している大店の跡取り息子。',
    dnaPromptEn: 'An easygoing handsome young heir of an Edo textile merchant house with relaxed cultured posture, humorous knowing smile, wearing a luxurious fine-woven silk kimono and stylish haori, casually fanning himself with sandalwood folding fan, bustling Nihonbashi merchant quarter',
    recommendedTastes: ['葛飾北斎・超写実肉筆浮世絵', '日常・アオハルポップ']
  },
  {
    id: 'arch_okappiki_investigator',
    name: '夜の江戸を警備する岡っ引き',
    category: 'historical',
    icon: '🏮',
    color: 'orange',
    tags: ['#岡っ引き', '#十手', '#御用提灯', '#勘の鋭さ'],
    summaryJa: '闇を照らす「御用」の角提灯に腰の十手、辻々に目を光らせて町民の平穏を守る頼もしい目明かし。',
    dnaPromptEn: 'A shrewd vigilant Edo period police detective okappiki with dark headband, weathered clever eyes, holding glowing paper lantern inscribed with black kanji characters, iron jutte truncheon tucked in obi sash, standing on arched wooden canal bridge at dusk',
    recommendedTastes: ['昭和怪異ホラー・カケアミ劇画', '葛飾北斎・超写実肉筆浮世絵']
  },
  {
    id: 'arch_traveling_medicine_peddler',
    name: '諸国を旅する薬売りの美青年',
    category: 'historical',
    icon: '💊',
    color: 'teal',
    tags: ['#薬売り', '#背負い薬箱', '#菅笠', '#ミステリアス'],
    summaryJa: '黒塗りの重い薬箱を背負い、妖しげな微笑みと万病を治す霊薬を携えて諸国を巡る美青年。',
    dnaPromptEn: 'A mysterious handsome itinerant medicine seller with delicate porcelain facial features, captivating knowing eyes, wearing wide woven sedge sunhat and layered traveling kimono, carrying tall lacquered wooden cabinet medicine trunk on back, foggy misty rural mountain pass',
    recommendedTastes: ['昭和怪異ホラー・カケアミ劇画', 'ノスタルジック魔女ファンタジー']
  },

  // ── 🐾 ユーザーリクエスト追加: 動物系擬人化 ──
  {
    id: 'arch_kemo_shiba_samurai',
    name: '忠義の柴犬剣士・浪人',
    category: 'fantasy',
    icon: '🐕',
    color: 'amber',
    tags: ['#柴犬擬人化', '#柴耳＆巻き尾', '#着流し浪人', '#一本気'],
    summaryJa: 'ピンと立ったもふもふの柴犬耳と愛らしい巻き尾、質素な着流しに木刀を差した素朴で義理堅い擬人化柴犬浪人。',
    dnaPromptEn: 'A stoic handsome anthropomorphic Japanese Shiba Inu samurai swordsman with expressive fluffy pointed dog ears and a curly tail, noble warm amber eyes, wearing a simple textured linen kimono with rolled-up sleeves, holding a worn wooden bokken sword, rustic countryside backdrop, highly consistent character design',
    recommendedTastes: ['ゆる浮世絵・戯画ポップ', '葛飾北斎・超写実肉筆浮世絵', '白黒劇画・超絶インク']
  },
  {
    id: 'arch_kemo_cat_barista',
    name: '黒猫カフェ店主・バリスタ',
    category: 'fantasy',
    icon: '🐈',
    color: 'purple',
    tags: ['#黒猫擬人化', '#猫耳＆しっぽ', '#クラシックエプロン', '#珈琲マスター'],
    summaryJa: '艶やかな黒猫耳としなやかな細い尻尾を持つ物静かな美青年バリスタ。アンティークなカフェエプロンと真鍮のドリップポット。',
    dnaPromptEn: 'A graceful stylish anthropomorphic black cat barista youth with sleek pointed cat ears and a long slender tail, piercing feline emerald eyes, wearing a dark canvas apron over rolled-sleeve white dress shirt and bowtie, skillfully pouring coffee from a brass drip kettle, cozy retro jazz cafe ambience',
    recommendedTastes: ['ネオ・シティポップ・ナイトウォーク', 'ノスタルジック魔女ファンタジー・極細線画', 'ヴィンテージLo-Fi']
  },
  {
    id: 'arch_kemo_snow_rabbit_miko',
    name: '白兎の雪神楽巫女',
    category: 'fantasy',
    icon: '🐇',
    color: 'rose',
    tags: ['#白兎擬人化', '#うさ耳', '#純白巫女装束', '#雪神楽'],
    summaryJa: '長く白いもふもふの兎耳に透き通るような紅玉色の瞳。純白と緋色の巫女装束をまとい、神楽鈴を掲げて舞う神秘的な雪兎の巫女。',
    dnaPromptEn: 'A divine delicate anthropomorphic snow rabbit shrine maiden with long fluffy white bunny ears, glowing ruby-red eyes, pure fair skin, wearing traditional red-and-white Shinto miko robes with flowing sleeves, holding golden kagura bells with silk streamers, gently falling snow in sacred cedar shrine',
    recommendedTastes: ['レトロモダン・ネオ・ジャポニスム', 'エモーショナル・シネマティック・スカイ', '鳥獣戯画・国宝絵巻']
  },
  {
    id: 'arch_kemo_wolf_biker',
    name: '孤高の灰狼ライダー',
    category: 'fantasy',
    icon: '🐺',
    color: 'slate',
    tags: ['#狼擬人化', '#銀狼耳', '#ダメージ革ジャン', '#夜の疾走'],
    summaryJa: '銀灰色の鋭い狼耳とふさふさの尾を持つアウトローなバイク乗り。擦り切れたライダースジャケットと夜霧のヘッドライト。',
    dnaPromptEn: 'A rugged cool anthropomorphic silver wolf biker with sharp wolf ears and a thick bushy tail, intense silver-blue eyes, wearing a distressed black leather motorcycle jacket with silver studs and chains, leaning against a custom dark motorcycle on wet neon-lit city street at midnight',
    recommendedTastes: ['ネオ・シティポップ・ナイトウォーク', '青年誌カバー・艶麗アイライン＆ソリッドセル', '白黒劇画・超絶インク']
  },

  // ── 🏮 ユーザーリクエスト追加: YouTube「ガチ江戸」歴史劇画系 ──
  {
    id: 'arch_edo_ronin_master',
    name: '凄腕の無頼浪人・居合抜刀',
    category: 'historical',
    icon: '⚔️',
    color: 'amber',
    tags: ['#ガチ江戸', '#無精髭浪人', '#居合斬り', '#凄腕剣客'],
    summaryJa: '剃り残した無精髭に歴戦の刃傷。擦り切れた麻の黒着流しに大刀小刀を佩き、一切の油断のない鋭い眼光を放つ孤高の居合の達人。',
    dnaPromptEn: 'An authentic rugged masterless Edo ronin samurai in his 30s with rough stubble, weathered intense gaze, scarred cheek, loose unkempt topknot, wearing a faded frayed dark hemp kimono tucked at the waist, two authentic katana swords thrust through obi, gritty rainy Edo street at nightfall, realistic authentic historical ukiyo-e aesthetic',
    recommendedTastes: ['葛飾北斎・超写実肉筆浮世絵', '白黒劇画・超絶インク', '昭和怪異ホラー・カケアミ劇画']
  },
  {
    id: 'arch_edo_okappiki_boss',
    name: '江戸町奉行所筆頭・凄腕岡っ引き',
    category: 'historical',
    icon: '🏮',
    color: 'orange',
    tags: ['#ガチ江戸', '#岡っ引き親分', '#真鍮十手', '#八百八町の眼'],
    summaryJa: '藍染めの半纏に粋な吉原つなぎの帯。懐には年季の入った真鍮十手、夜の八百八町の悪事を見逃さない老練な捜査の鬼。',
    dnaPromptEn: 'A seasoned veteran Edo period okappiki chief investigator with a sharp piercing squint, wearing an authentic indigo dyed artisan hanten coat, white headband, holding a brass jutte truncheon half-concealed in sleeve, glowing faceted paper lantern, mist rising from Sumida riverbank at night',
    recommendedTastes: ['葛飾北斎・超写実肉筆浮世絵', '白黒劇画・超絶インク']
  },
  {
    id: 'arch_edo_oiran_tayuu',
    name: '吉原最高峰・孤高の花魁太夫',
    category: 'historical',
    icon: '👘',
    color: 'rose',
    tags: ['#ガチ江戸', '#吉原花魁', '#豪華簪', '#絢爛重厚打掛'],
    summaryJa: '無数の鼈甲簪を挿した立兵庫髷に、金糸銀糸で刺繍された極彩色の重厚な打掛。冷徹なまでの美貌と品格で君臨する吉原の最高峰太夫。',
    dnaPromptEn: 'An exquisite high-ranking Edo Yoshiwara oiran tayu court lady with extravagant tatehyogo hair adorned with dozens of tortoiseshell kanzashi hairpins, immaculate porcelain makeup with crimson lip tint, wearing heavy multi-layered silk uchikake kimono embroidered with gold dragons and chrysanthemums, dignified cold beauty, candlelit tatami chamber',
    recommendedTastes: ['葛飾北斎・超写実肉筆浮世絵', 'レトロモダン・ネオ・ジャポニスム', 'ラグジュアリー・ソシャゲ美麗キービジュアル']
  },
  {
    id: 'arch_edo_kawaraban_reporter',
    name: '江戸事件簿・瓦版屋の健脚青年',
    category: 'historical',
    icon: '📜',
    color: 'teal',
    tags: ['#ガチ江戸', '#瓦版屋', '#情報通', '#すばしっこい'],
    summaryJa: '深編笠を目深に被り、摺り上がったばかりの瓦版を小脇に抱えて「大事件だよ！」と町中を駆け抜ける江戸一番の早耳青年。',
    dnaPromptEn: 'An energetic agile young Edo news crier kawaraban seller wearing a deep woven wicker sedge hat, short active happi coat with tied sleeves, straw waraji sandals, holding reams of freshly woodblock-printed news broadsheets, running dynamically through crowded Edo Nihonbashi market',
    recommendedTastes: ['葛飾北斎・超写実肉筆浮世絵', 'ゆる浮世絵・戯画ポップ']
  },

  // ── 🎸 ユーザーリクエスト追加: バンド・不良・ギャグ・特定キャラ ──
  {
    id: 'arch_subculture_punk_bassist',
    name: '暴動パンク・女性ベーシスト',
    category: 'subculture',
    icon: '🎸',
    color: 'purple',
    tags: ['#ガールズバンド', '#パンクロック', '#ベース女子', '#ウルフカット'],
    summaryJa: 'ネオンピンクのインナーカラーが入った黒髪ウルフカットに安全ピンピアス。傷だらけのヴィンテージベースを膝下まで低く構えてかき鳴らす激情ガール。',
    dnaPromptEn: 'A rebellious fierce punk-rock girl bassist with choppy black wolf-cut hair and neon-pink underlayer streaks, smudged eyeliner, choker with safety pins, wearing an oversized torn band t-shirt, fishnet tights, combat boots, low-slung worn electric bass guitar, screaming amplifier smoke on underground live stage',
    recommendedTastes: ['ネオ・シティポップ・ナイトウォーク', '青年誌カバー・艶麗アイライン＆ソリッドセル', '白黒劇画・超絶インク']
  },
  {
    id: 'arch_showa_tsuppari_delinquent',
    name: '昭和気骨・リーゼント特攻不良',
    category: 'suspense',
    icon: '🔥',
    color: 'rose',
    tags: ['#昭和不良', '#気骨番長', '#リーゼント', '#長ラン'],
    summaryJa: '鋭く反り上がった黒髪ポンパドール（リーゼント）に白いサラシ、引きずるほど長い特注長ランを羽織る、情に厚い昭和ツッパリ番長。',
    dnaPromptEn: 'A retro Showa era fierce high school yankee delinquent leader with a sharp pompadour hairstyle, intense fiery gaze, white bandage wraps around torso, wearing an ankle-length black modified long gakuran coat unbuttoned, leaning defiantly against a corrugated tin wall under a flickering streetlamp',
    recommendedTastes: ['白黒劇画・超絶インク', '青年誌カバー・艶麗アイライン＆ソリッドセル', '昭和怪異ホラー・カケアミ劇画']
  },
  {
    id: 'arch_gag_overreacting_salaryman',
    name: '全身全霊ツッコミ・社畜漫才師',
    category: 'daily',
    icon: '🤣',
    color: 'amber',
    tags: ['#全力ツッコミ', '#ギャグ顔芸', '#漫才社畜', '#メガネ吹っ飛び'],
    summaryJa: 'めくれたネクタイと飛び散る汗、衝撃でメガネが斜めにズレるほどの全身全霊ツッコミ顔芸を披露する愛されサラリーマン。',
    dnaPromptEn: 'A hyper-expressive comedic Japanese businessman comically overreacting with mouth wide open in shocked disbelief, round glasses hilariously askew, tie flying wildly over shoulder, sweat drops flying, expressive anime slapstick humor face, energetic stage comedic lighting',
    recommendedTastes: ['ゆる浮世絵・戯画ポップ', '鳥獣戯画・国宝絵巻', '日常・アオハルポップ']
  },
  {
    id: 'arch_cyberpunk_underground_hacker',
    name: '電脳裏路地・天才サイバーハッカー',
    category: 'subculture',
    icon: '💻',
    color: 'cyan',
    tags: ['#サイバーパンク', '#天才ハッカー', '#ホログラムHUD', '#電脳義肢'],
    summaryJa: 'オーバーサイズフードにホログラム発光バイザー、指先に電脳端子を備えたサイバー義肢で幾何学コードを空中入力する謎の天才ネットランナー。',
    dnaPromptEn: 'A mysterious androgynous cyberpunk netrunner hacker huddled in an oversized high-collar techwear jacket, wearing glowing cyan augmented-reality holographic visor spectacles, cybernetic metallic fingers typing rapidly into floating luminescent holographic code displays, dark rain-slicked server alley',
    recommendedTastes: ['ネオ・シティポップ・ナイトウォーク', 'サイバー設計図・インダストリアル青図', 'エモーショナル・シネマティック・スカイ']
  }
];

/**
 * IDから様態を検索
 */
export function getCharacterArchetypeById(id: string): CharacterArchetype | undefined {
  return CHARACTER_ARCHETYPES.find(a => a.id === id);
}
