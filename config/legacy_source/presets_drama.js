/**
 * Music Factory Studio - 表ドラ（日常テーマ100選）＆ 裏ドラ（二重構造100選）マスター辞書
 * カテゴリ別 optgroup 体系化
 */

const SURFACE_THEMES_PRESETS = [
    {
        category: "🎒 アオハル・放課後・甘酸っぱい日常",
        items: [
            { id: "two_seater_bicycle_slope", name: "🚲 自転車の二人乗り（背中に当たる温もり、夕方の土手、風になびく髪とセーラー服）" },
            { id: "shared_umbrella_walk", name: "☔ 雨の日の相合い傘（近すぎる肩、水たまりを避ける足音、雨に混じる甘いシャンプーの匂い）" },
            { id: "split_ice_candy", name: "🍦 放課後のソーダアイス半分こ（パキッと割る音、分け合う指先、笑い合う公園のベンチ）" },
            { id: "stairway_shared_earphone", name: "🎧 階段の踊り場で片耳イヤホン（同じプレイリスト、触れそうな肩、夕陽が差し込む窓辺）" },
            { id: "library_whisper_secret", name: "📖 放課後の図書室で二人きり（めくる本の音、落書きしたメモ、内緒のひそひそ話）" },
            { id: "two_straws_one_drink", name: "🥤 一つのドリンクを二本のストローで（氷のカラカラ音、近すぎる視線、照れ笑い）" },
            { id: "afterschool_empty_classroom", name: "🌅 夕暮れの教室で居残り勉強（オレンジ色の黒板、伸びる二人の影、帰りたくない時間）" },
            { id: "winter_shared_muffler", name: "🧣 冬のマフラーを二人で巻く（冷たい頬、触れ合う首元、白く重なる吐息）" },
            { id: "club_croquette_share", name: "🥔 部活帰りの買い食いコロッケ（半分こする温もり、夕焼け空、笑い転げる川沿いの道）" },
            { id: "yukata_festival_handhold", name: "🎆 浴衣で歩く夏祭りの帰り道（りんご飴、カランコロン鳴る下駄、はぐれないように握る手）" },
            { id: "rooftop_secret_lunch", name: "🍙 誰もいない屋上で食べるお弁当（青空の風、卵焼きのトレード、二人だけの秘密基地）" },
            { id: "sports_day_headband_tie", name: "🏃 体育祭でハチマキを後ろから結んでもらう（背中に触れる指先、高鳴る胸の鼓動）" },
            { id: "chalk_blackboard_doodle", name: "🖍️ 放課後の黒板に相合傘の落書き（急いで消すチョークの粉、照れ笑い、駆け出す足音）" },
            { id: "vending_cider_cheek_tap", name: "🫧 自販機の冷たいサイダーをほっぺにペタッ（ヒヤッとする感触、悪戯な笑顔、吹き出す炭酸）" },
            { id: "station_gate_reluctant_bye", name: "🚉 改札口でなかなかバイバイできない夕方（行っちゃう電車、名残惜しい視線、あと一本見送る口実）" }
        ]
    },
    {
        category: "🏠 部屋・住まい・暮らし",
        items: [
            { id: "moving_out", name: "📦 引っ越し（段ボールの山、ガムテープの音、がらんどうの部屋）" },
            { id: "assemble_furniture", name: "🔨 家具を組み立てる（六角レンチ、木目の板、床に散らばる説明書、ネジの締め音）" },
            { id: "room_makeover", name: "🛏️ 部屋の模様替え（ベッドの位置を変える、カーテンを開けた時の光、埃の匂い）" },
            { id: "laundry_balcony", name: "👕 ベランダで洗濯物を干す（はためく白いシャツ、柔軟剤の香り、青空と物干し竿）" },
            { id: "morning_shoelaces", name: "👟 朝の玄関で靴紐を結ぶ（まだ冷たい朝の空気、ぎゅっと締めるスニーカー、カチャリと閉まる鍵）" },
            { id: "forgot_key", name: "🔑 鍵を忘れて玄関先で立ち往生（閉まったドア、夕暮れのチャイム、階段に座り込む時間）" },
            { id: "fridge_leftovers", name: "🍳 冷蔵庫の余り物で料理（カタカタ鳴る鍋、野菜を切る音、深夜のキッチン）" },
            { id: "kotatsu_winter", name: "🍊 コタツから出られない冬の午後（みかんの皮、ぬくもり、テレビの微かな音）" },
            { id: "screen_door_rain", name: "🌧️ 網戸越しに聞く夕立の音（湿った風、アスファルトの匂い、遠くの雷）" },
            { id: "midnight_dishes", name: "🫧 深夜の食器洗い（泡立つスポンジ、流れる温い水、静まり返った部屋）" },
            { id: "alarm_clock", name: "⏰ 目覚まし時計を止める朝（二度寝の誘惑、カーテンの隙間の光、重い毛布）" },
            { id: "open_package", name: "📦 届いた荷物の段ボールを開ける（カッターの刃、プチプチを潰す指先、待ち遠しかった瞬間）" },
            { id: "water_plants", name: "🪴 観葉植物に水をやる（土の匂い、青々とした葉、静かな休日の朝）" },
            { id: "bath_ceiling", name: "🛁 お風呂でぼーっと天井を見つめる（立ちのぼる湯気、水面の波紋、反響する鼻歌）" },
            { id: "vacuum_cleaning", name: "🧹 部屋の隅の埃を掃除機で吸う（唸るモーター音、綺麗になっていく畳、すっきりした空気）" }
        ]
    },
    {
        category: "🍜 食事・カフェ・コンビニ",
        items: [
            { id: "midnight_ramen", name: "🍜 深夜のラーメン（立ちのぼる湯気、琥珀色のスープ、カウンター、冷めないうちに啜る音）" },
            { id: "night_conbini_ice", name: "🍦 夜のコンビニのアイス（自動ドアのチャイム、青白い蛍光灯、深夜の帰り道）" },
            { id: "burnt_toast", name: "🍞 朝の少し焦げたバタートースト（香ばしいパンの匂い、溶けるバター、カリッとした音）" },
            { id: "rainy_cafe_coffee", name: "☕ 雨の日の喫茶店のホットコーヒー（白いマグカップ、雨音、窓をつたう水滴）" },
            { id: "supermarket_bento", name: "🛒 スーパーの夕暮れ惣菜買い出し（ガラガラ引く買い物カゴ、割引シール、レジ袋の擦れる音）" },
            { id: "vending_warm_cocoa", name: "🍫 自販機のあたたかい缶ココア（冷たい指先、カコンと落ちる音、ポケットで握る温もり）" },
            { id: "street_croquette", name: "🥔 商店街の出来立てコロッケ（茶色い紙袋の温もり、サクッとした衣、夕方の買い食い）" },
            { id: "shaved_ice_festival", name: "🍧 夏祭りの屋台のかき氷（ブルーハワイの青、ガリガリ削る氷、舌が染まる笑顔）" },
            { id: "izakaya_cheers", name: "🍺 居酒屋の最初の一杯と枝豆（冷えたジョッキの結露、乾杯の音、ざわめく店内）" },
            { id: "holiday_pancake", name: "🥞 休日のホットケーキ作り（フライパンの丸い焼き目、シロップが染みる甘い匂い）" },
            { id: "day2_curry", name: "🍛 カレーの2日目の鍋（少し煮詰まった深いコク、温め直すお玉の音、安心する匂い）" },
            { id: "station_soba", name: "🥢 駅前の立ち食いそば（だしの強い香り、湯気で曇るメガネ、発車ベルの焦り）" },
            { id: "depachika_cake", name: "🍰 デパ地下の試食とケーキ選び（華やかなショーケース、リボンをかける手元、ご褒美の箱）" },
            { id: "drivethru_burger", name: "🍔 ドライブスルーのハンバーガー（車内に充満するポテトの匂い、紙袋から伸びる手、夜の国道）" },
            { id: "cold_barley_tea", name: "🧊 水筒に入れた冷たい麦茶（カランと鳴る氷、汗をかいたステンレス、夏の部活帰り）" }
        ]
    },
    {
        category: "📱 日常の道具・通信・身の回り",
        items: [
            { id: "garakei_to_smartphone", name: "📱 ガラケーからスマホに代わる（古い電話帳、赤外線通信、液晶画面の指紋）" },
            { id: "broken_earphones", name: "🎧 壊れかけのイヤホンの片耳（片方だけ聴こえるベース、断線しかけたコード、隣に差し出す半分）" },
            { id: "charging_cable_search", name: "🔌 深夜の充電ケーブルを探す手（ベッドの隙間、暗闇の手探り、カチッと刺さる安心）" },
            { id: "forgot_umbrella_train", name: "☂️ 傘を電車の網棚に置き忘れる（ビニール傘の持ち手、降りた瞬間の雨粒、濡れる肩）" },
            { id: "movie_ticket_stub", name: "🎟️ ポケットに残っていた映画の半券（くしゃくしゃの紙、暗闇で分け合ったポップコーン）" },
            { id: "used_book_notes", name: "📖 古本屋で見つけた誰かの書き込み（色褪せた栞、黄ばんだページ、知らない誰かの筆跡）" },
            { id: "short_pencil", name: "✏️ ペンケースの短くなった鉛筆（削りたての木の匂い、消しゴムのカス、ノートの落書き）" },
            { id: "bicycle_chain_oil", name: "🚲 自転車のチェーンに油を差す（黒く汚れる指先、キーキー鳴き止むペダル、軽くなる漕ぎ味）" },
            { id: "clock_stopped", name: "⌛ 時計の電池が切れて止まる（動かない秒針、静寂の部屋、時間が止まったような錯覚）" },
            { id: "receipt_back_memo", name: "🧾 レシートの裏の殴り書きメモ（買わなきゃいけない牛乳、忘れっぽい癖、財布の底）" },
            { id: "new_white_sneakers", name: "👟 新しいスニーカーをおろす日（真っ白なソール、硬いかかと、晴れた朝の一歩目）" },
            { id: "cut_bangs_too_short", name: "✂️ 鏡の前で前髪を切りすぎる（散らばる髪の毛、ハサミの感触、照れくさいおでこ）" },
            { id: "chipped_favorite_mug", name: "☕ お気に入りのマグカップの小さな欠け（指でなぞるフチ、捨てられない愛着、毎朝の相棒）" },
            { id: "bag_keys_lip", name: "👜 カバンの中で絡まる鍵とリップ（底をごそごそ探す手、キーホルダーの擦れる音）" },
            { id: "flip_old_planner", name: "📒 古い手帳をパラパラめくる（予定の書き込み、懐かしい筆跡、忘れていた約束）" }
        ]
    },
    {
        category: "🚶 街・移動・帰り道",
        items: [
            { id: "railroad_crossing", name: "🚂 夕暮れの踏切待ち（カンカン鳴る警報音、通り過ぎる銀色の電車、風になびくスカート）" },
            { id: "midnight_footbridge", name: "🌉 終電を逃した深夜の歩道橋（遠くのテールランプ、静まり返った国道、誰もいない風）" },
            { id: "coin_laundry_drum", name: "🌀 コインランドリーの回るドラム（ガラス越しの洗濯物、洗剤の甘い匂い、ベンチで待つ時間）" },
            { id: "rain_puddle_jump", name: "💧 雨上がりの水たまりを避けて歩く（反射する青空、泥はねを気にする足元、濡れたアスファルト）" },
            { id: "station_cold_bench", name: "🚉 駅のホームの冷たいベンチ（白く煙る吐息、電光掲示板の文字、遠くのアナウンス）" },
            { id: "bus_back_seat", name: "🚌 バスの一番後ろの席（窓にもたれる頭、振動するガラス、流れていく見慣れた街並み）" },
            { id: "bookstore_browsing", name: "📚 本屋で背表紙を指でなぞる（静まり返る店内、紙の匂い、ふと目が止まるタイトル）" },
            { id: "hill_night_view", name: "🌃 夜景を見下ろす高台の坂道（眼下に広がる街の灯り、息が上がる坂、遠くのサイレン）" },
            { id: "shutter_street_walk", name: "🏬 商店街のシャッター通りを歩く（夕暮れの影、カラスの声、昔通った駄菓子屋の跡）" },
            { id: "ticket_gate_error", name: "💳 自動改札でICカードが引っかかる（ピピッと鳴る赤いゲート、後ろの人の視線、慌てる指先）" },
            { id: "airport_deck", name: "✈️ 空港の展望デッキで見る飛行機（轟音とジェット燃料の匂い、飛び立つ翼、見送る背中）" },
            { id: "coastal_bicycle_slope", name: "🌊 自転車で下る海沿いの坂道（吹き抜ける潮風、カタカタ鳴るカゴ、眩しい水平線）" },
            { id: "midnight_gas_station", name: "⛽ 誰もいない深夜のガソリンスタンド（白く眩しい照明、給油ノズルのカチャリ音、夜のドライブ）" },
            { id: "subway_stairs_run", name: "🚇 地下鉄の階段を駆け上がる（吹き抜ける突風、階段の先に広がる夕焼け、急ぐ足音）" },
            { id: "unknown_rural_station", name: "🌾 旅先の知らない駅で降りてみる（改札のない駅舎、虫の声、どこか懐かしい風）" }
        ]
    },
    {
        category: "🌸 季節と天気・自然の表情",
        items: [
            { id: "cherry_blossom_path", name: "🌸 春の桜吹雪の通学路（ひらひら舞うピンクの花びら、新しい制服、少し浮足立つ朝）" },
            { id: "summer_shower_rainbow", name: "🌈 夏の終わりの夕立と虹（急な雷雨の後の晴れ間、濡れた木々の緑、空にかかる大きなアーチ）" },
            { id: "autumn_leaf_steps", name: "🍂 秋の落ち葉を踏むカサカサ音（黄色いイチョウの絨毯、踏みしめるブーツ、肌寒い風）" },
            { id: "foggy_window_drawing", name: "❄️ 冬の朝に窓ガラスが白く曇る（指で落書きするガラス、外の雪景色、暖かい部屋）" },
            { id: "tsuyu_sunny_break", name: "☀️ 梅雨の晴れ間の強い日差し（蒸し暑い空気、洗濯物が一気に乾く匂い、蝉の鳴き始め）" },
            { id: "cumulonimbus_shadow", name: "☁️ 真夏の入道雲と日陰（ジリジリ照りつけるアスファルト、自販機の影、冷たい麦茶）" },
            { id: "typhoon_warm_wind", name: "🌀 台風が近づく日の生暖かい風（揺れる看板、買い出しで混むスーパー、不気味に赤い夕空）" },
            { id: "winter_orion_sky", name: "✨ 冬の夜空に白く浮かぶオリオン座（かじかむ指先、澄み切った大気、星の瞬き）" },
            { id: "distant_summer_fireworks", name: "🎆 遠くで鳴る夏の終わりの花火（ドーンと遅れて響く音、ビルの合間の光、祭りの後の寂しさ）" },
            { id: "haruichiban_wind", name: "💨 春一番の強風で傘がひっくり返る（飛ばされそうな帽子、目に入る砂、笑うしかない瞬間）" },
            { id: "first_snow_shoulder", name: "⛄ 初雪が肩にふわりと溶ける（冷たい感触、静まり返る街、見上げる灰色の空）" },
            { id: "red_dragonfly_dusk", name: "🌾 夕暮れのアカトンボと黄金色の田んぼ（稲穂の波、長い自分の影、涼しくなった秋風）" },
            { id: "morning_dew_flower", name: "🌺 朝露に濡れるクモの巣と朝顔（静かな早朝の庭、ひんやりした空気、咲いたばかりの青）" },
            { id: "crepuscular_rays", name: "🌤️ 雲間から差し込む光の筋（レンブラント光線、天使の梯子、立ち止まって見上げる瞬間）" },
            { id: "white_breath_contest", name: "🧣 冬の朝の息の白さ比べ（ふーっと吐き出す白い煙、笑い合う声、マフラーに顔を埋める）" }
        ]
    },
    {
        category: "🏫 学校・仕事・何気ない人間関係",
        items: [
            { id: "library_whisper", name: "📖 放課後の図書室のひそひそ話（紙の匂い、西日の差す窓辺、沈黙が心地いい距離）" },
            { id: "gym_behind_callout", name: "🏀 体育館裏の呼び出し（夕暮れの影、ボールのバウンド音、ぎこちない沈黙と告白）" },
            { id: "midnight_radio_study", name: "📻 テスト勉強の合間の深夜ラジオ（机の電気スタンド、パーソナリティの笑い声、夜食のカップ麺）" },
            { id: "pantry_short_chat", name: "🍵 会社の給湯室の短い雑談（お茶を入れる音、給湯器の湯気、ふっと肩の力が抜ける瞬間）" },
            { id: "awkward_elevator", name: "🛗 エレベーターで乗り合わせた気まずい沈黙（見上げる階数表示、微かなモーター音、開いた時の安堵）" },
            { id: "overtime_empty_floor", name: "💻 オフィスの残業で一人きりのフロア（カチカチ鳴るキーボード、消えかけた蛍光灯、外の夜景）" },
            { id: "school_festival_prep", name: "🎨 文化祭の準備で残る夕暮れの教室（段ボールと絵の具の匂い、黒板の落書き、終わってほしくない時間）" },
            { id: "train_eye_contact", name: "🚃 満員電車で目が合う見知らぬ人（揺れる吊り革、スマホを見る振り、次の駅で降りていく背中）" },
            { id: "window_seat_change", name: "🪟 席替えで窓際の席になる（心地よい西日、外のグラウンドの歓声、少し遠くなったあの人の席）" },
            { id: "morning_meeting_coffee", name: "☕ 朝の会議前のドリップコーヒー（紙コップの温もり、開く手帳、眠気を飛ばす一口）" },
            { id: "part_time_meal", name: "🍛 バイト上がりのまかないご飯（厨房の残り香、エプロンを外す解放感、仲間と笑うカウンター）" },
            { id: "thesis_final_period", name: "📑 卒論・レポートの最後の句点を打つ（疲れた指先、保存ボタンのクリック、朝焼けの部屋）" },
            { id: "pass_handout_back", name: "📄 配布されたプリントを後ろに回す（紙の手触り、振り向いた時の笑顔、何気ない日常）" },
            { id: "rooftop_bento", name: "🍙 屋上で食べる早弁のおにぎり（吹き抜ける青空の風、ラップを剥がす音、見つからないように隠す仕草）" },
            { id: "locker_lock_sound", name: "🔒 ロッカーの鍵をカチャリと閉める（部活終わりの夕方、汗の匂い、また明日ねと手を振る声）" }
        ]
    },
    {
        category: "🌙 感情の揺らぎ・ふとした日常の瞬間",
        items: [
            { id: "flip_unread_phone", name: "📵 既読がつかないスマホ画面を伏せる（画面の暗転、机に置く音、気にしてない振りのため息）" },
            { id: "mirror_smile_practice", name: "🪞 鏡の前でふとつくる笑顔の練習（少し疲れた目元、作り笑い、よしと呟いてドアを開ける）" },
            { id: "sudden_twilight_tears", name: "🌇 なぜか急に涙が出そうになる黄昏時（茜色のグラデーション、電線のシルエット、胸の奥のツンとした痛み）" },
            { id: "fist_in_pocket", name: "✊ ポケットの中でぎゅっと握りしめた拳（悔しさを飲み込む唇、雑踏の足音、負けないという決意）" },
            { id: "old_playlist_years_later", name: "🎵 昔のプレイリストを何年かぶりに聴く（イントロの1秒で蘇るあの頃、胸のざわめき、変わらないメロディ）" },
            { id: "midnight_water_drink", name: "🥛 夜中に目が覚めて水を飲む（静まり返る台所、冷たい水が喉を通る感覚、時計のコチコチ音）" },
            { id: "secret_alone_walk", name: "🤫 誰にも言えない秘密を一人抱えて歩く（夕暮れの雑踏、すれ違う人々の笑顔、自分だけの世界の境界線）" },
            { id: "arrive_30min_early", name: "⏳ 約束の時間より30分早く着いてしまう（喫茶店の窓際、何度も見る時計、そわそわする指先）" },
            { id: "shadow_length_dusk", name: "👤 ふと自分の影の長さに気付く帰り道（オレンジ色の夕陽、伸びる影、季節の移ろい）" },
            { id: "traffic_light_blue_sky", name: "🚦 信号待ちで青空を見上げる（どこまでも澄んだ青、飛行機雲の白、深呼吸ひとつ）" }
        ]
    }
];

const HIDDEN_DRAMA_PRESETS = [
    {
        category: "💖 アオハル全開・両片想い・甘々シチュエーション",
        items: [
            { id: "shared_umbrella_shoulder_wet", name: "☔ 相合い傘で自分の肩ばかり濡らしているあの人の優しい横顔" },
            { id: "bicycle_two_seater_breeze", name: "🚲 自転車の二人乗り・背中に伝わる鼓動と夕暮れの土手の風" },
            { id: "accidental_finger_touch_drink", name: "🥤 一つのドリンクに二本のストロー・指先が触れ合って真っ赤になる瞬間" },
            { id: "library_secret_note_pass", name: "📖 放課後の図書室の死角・本棚越しにこっそり交わす内緒のメモ" },
            { id: "half_muffler_shared_winter", name: "🧣 一つの長いマフラーを二人で巻いて歩く雪の日の帰り道" },
            { id: "hand_in_coat_pocket", name: "🧤 「寒いね」って言いながら私の手を自分のコートのポケットに入れる仕草" },
            { id: "leaning_sleep_on_shoulder", name: "🚃 帰りの電車でウトウトして私の肩にコテンと頭を預けてくる寝顔" },
            { id: "rooftop_secret_confession_eve", name: "🏫 放課後の屋上で二人きり・夕陽に染まる横顔と「あのね」の続き" },
            { id: "shared_earphone_distance", name: "🎧 片耳ずつのイヤホン・同じ音楽を聴きながら縮まる二人の距離" },
            { id: "mock_quarrel_sweet_bites", name: "🍬 「一口ちょうだい」でアイスをかじられて笑い合う甘い帰り道" },
            { id: "school_festival_holding_hands", name: "🎆 文化祭の後夜祭・キャンプファイヤーの影で人混みに紛れて繋いだ手" },
            { id: "late_night_phone_call_sleepy", name: "🌙 深夜の長電話・お互い眠くて言葉が途切れても切りたくない甘い静寂" },
            { id: "rain_shelter_under_eaves", name: "🌧️ 突然の夕立で狭い軒下に駆け込み・息が触れそうな近さに跳ねる心臓" },
            { id: "sideline_cheer_eye_contact", name: "⚽ 部活の試合中・グラウンドから客席の自分を探して目が合いふっと笑う瞬間" },
            { id: "stairs_almost_hug", name: "🚪 狭い階段の踊り場でぶつかりそうになり・抱き止められた胸元の温もり" }
        ]
    },
    {
        category: "🍓 胸キュン・照れ隠し・恋の始まり",
        items: [
            { id: "head_pat_shy_turnaway", name: "🧢 「よく頑張ったな」と頭をポンポンされて顔から火が出そうになる夕方" },
            { id: "stolen_glance_across_classroom", name: "🪟 授業中にふと視線を感じて振り返ると・慌てて教科書で顔を隠すあの人" },
            { id: "cold_cider_cheek_surprise", name: "🫧 自販機の冷たい缶サイダーを不意にほっぺに当ててくる悪戯な笑顔" },
            { id: "awkward_first_handhold", name: "🤝 手を繋ぎたいのに指がかすめるだけで・お互いぎこちなく歩く海辺の夕暮れ" },
            { id: "matching_secret_keychain", name: "🔑 誰にもバレないように通学カバンの内側に付けたお揃いのストラップ" },
            { id: "text_reply_heartbeat_instant", name: "💬 送って1秒で「今ちょうど君のこと考えてた」と返信が来た瞬間の歓喜" },
            { id: "watching_sleeping_face_sunset", name: "🌅 放課後の夕暮れの教室・机に突っ伏して眠るあの人の長い睫毛を見つめる" },
            { id: "studying_together_too_close", name: "📝 「教えて」と言いながらノート越しに距離が近すぎて文字が頭に入らない時間" },
            { id: "morning_toast_running_encounter", name: "🍞 角を曲がったらばったり会って「一緒に行こ」と照れ笑いする朝の奇跡" },
            { id: "summer_festival_yukata_blush", name: "👘 普段と違う浴衣姿を見て「…すごく似合ってる」と目を逸らすあの人" },
            { id: "borrowed_hoodie_sweet_scent", name: "🧥 雨宿りで貸してもらった大きめパーカーに残るあの人の優しい匂い" },
            { id: "confession_in_heart_waiting", name: "💌 「ずっと前から好きだった」の言葉を胸の奥で何度も繰り返す放課後" },
            { id: "shared_umbrella_gentle_distance", name: "🌂 傘を忘れたふりをして「一緒に入ろ」と駆け寄ってきた雨の校門前" },
            { id: "graduation_button_promise", name: "🌸 卒業式の第二ボタン・照れながら「お前に一番にもらってほしい」と差し出す手" },
            { id: "sweetest_future_promise", name: "✨ 「来年も、その先もずっと一緒にいようね」と何気なく交わす最高の約束" }
        ]
    },
    {
        category: "☀️ 眩しい友情・青春の無敵感・最高の瞬間",
        items: [
            { id: "shouting_at_ocean_dusk", name: "🌊 自転車を放り出して夕暮れの海に向かって叫ぶ・無敵だった僕らの夏休み" },
            { id: "midnight_convenience_store_run", name: "🚲 深夜にチャリを飛ばしてコンビニ前で食べる肉まんと・くだらない大笑い" },
            { id: "soaking_wet_rainy_chase", name: "🌧️ どしゃ降りの雨の中を傘もささずに笑いながら走り抜けたグラウンド" },
            { id: "all_nighter_roof_sunrise", name: "🌅 友達の部屋で夜明かしして・ベランダから見上げた朝焼けの眩しさ" },
            { id: "secret_base_abandoned_bus", name: "🚌 秘密の場所で分け合ったスナック菓子と・未来のデカい夢を語り合った夜" },
            { id: "cultural_festival_grand_finale", name: "🎸 文化祭の後夜祭・バンドのラストナンバーで肩を組んで跳ねた体育館" },
            { id: "club_last_summer_tears_smile", name: "⚾ 最後の夏の大会・泥だらけのユニフォームで抱き合って笑ったマウンド" },
            { id: "exam_victory_hug", name: "💮 合格発表の掲示板の前で番号を見つけて・思わず抱き合って跳び跳ねた春" },
            { id: "spontaneous_road_trip", name: "🚗 免許取り立ての友達の車で宛てもなく海を目指した初めてのドライブ" },
            { id: "summer_fireworks_sparkler", name: "🎇 公園のベンチで最後の線香花火が落ちるのをみんなで息を呑んで見つめる夜" }
        ]
    },
    {
        category: "💔 失恋・未練・過去の恋",
        items: [
            { id: "breakup_10years_room", name: "💔 10年前に別れた彼氏（部屋の片付け・捨てられない合鍵と未練）" },
            { id: "ex_ring_on_finger", name: "💍 偶然街で見かけたあの人の薬指に光る結婚指輪" },
            { id: "call_history_cannot_redial", name: "📞 二度とかけ直せない着信履歴の古い電話番号" },
            { id: "one_pair_mug", name: "☕ 元恋人とお揃いで買ったペアマグカップの残された片方" },
            { id: "unfulfilled_trip_brochure", name: "🗺️ 約束したまま果たせなかった旅行のパンフレット" },
            { id: "stepped_back_for_happiness", name: "🕊️ 相手の幸せを願って自分から身を引いた過去" },
            { id: "stay_friends_rejection", name: "🌧️ 「友達のままでいよう」と言われて終わった片想い" },
            { id: "wedding_invitation_drawer", name: "💌 相手の結婚式の招待状を机の引き出しの奥にしまう夜" },
            { id: "unsaid_dont_go", name: "🚂 あの日言えなかった「行かないで」の一言" },
            { id: "hidden_photo_folder", name: "🖼️ 写真フォルダの奥に隠した消せない2人の笑顔の写真" },
            { id: "familiar_perfume_crossing", name: "💐 街でふとすれ違った香水が昔の恋人と同じ匂いだった瞬間" },
            { id: "quarrel_forever_goodbye", name: "🌧️ ケンカ別れのまま二度と会えなくなってしまった恋" },
            { id: "just_a_substitute", name: "🎭 相手にとって自分はただの都合のいい代役だった記憶" },
            { id: "our_song_on_radio", name: "📻 一緒に聴いたあの曲が今でもラジオから不意に流れてくる" },
            { id: "smile_in_dream_fading", name: "🌙 夢の中に出てきたあの人が優しく微笑んで消えていった朝" }
        ]
    },
    {
        category: "🕊️ 別れ・死別・天国の誰か",
        items: [
            { id: "never_meet_again_promise", name: "🕊️ もう二度と会えない大切な人との最後の約束" },
            { id: "pet_collar_bell", name: "🐕 天国へ旅立った愛犬の小さな首輪と鈴の音" },
            { id: "hospital_bed_last_smile", name: "🏥 病室のベッドで交わした最後の「ありがとう」の微笑み" },
            { id: "late_mother_apron", name: "🍳 幼い頃に亡くした母親の遺したエプロンの優しい匂い" },
            { id: "accident_lost_bestfriend", name: "⚡ 事故で突然奪われた親友と叶えられなかった夢" },
            { id: "grandparent_magic_trick", name: "👴 祖父母が昔教えてくれた手品と温かい手のシワ" },
            { id: "unopened_letter_belongings", name: "✉️ 遺品整理で見つけた自分宛ての未開封の手紙" },
            { id: "memorial_seaside_bench", name: "🌊 毎年命日にだけ一人で訪れる海辺のベンチ" },
            { id: "photo_frozen_in_time", name: "📷 写真の中の笑顔だけが歳をとらずに止まっている切なさ" },
            { id: "cherry_blossom_departure", name: "🌸 桜が咲くたびに思い出すあの人の永遠の旅立ちの日" },
            { id: "answering_machine_voice", name: "📼 残された留守番電話の声を消せずに深夜に再生する" },
            { id: "proud_report_in_heaven", name: "☁️ いつか空の上で再会した時に胸を張って報告したい想い" },
            { id: "words_left_as_amulet", name: "🧿 大切な人が遺してくれた最後の言葉を今でもお守りにしている" },
            { id: "favorite_flower_corner", name: "🌻 あの人が好きだった花を部屋の片隅に絶やさず飾る" },
            { id: "pinky_promise_reborn", name: "🤙 「生まれ変わってもまた会おうね」と交わした指切り" }
        ]
    },
    {
        category: "⏳ 孤独・ひとりぼっち・居場所",
        items: [
            { id: "empty_room_single_spoon", name: "⏳ 誰も帰ってこない部屋・一人分のスプーンを見つめる寂しさ" },
            { id: "crowded_train_isolation", name: "🚆 満員電車の雑踏の中でふと感じる世界からの完全な孤立感" },
            { id: "no_place_to_belong", name: "🏠 家族や友人の中で自分だけが本当の居場所を見つけられない" },
            { id: "birthday_alone_dark_room", name: "🎂 誕生日の夜に誰からもメッセージが来ない暗い部屋" },
            { id: "killing_true_self", name: "🎭 周りの期待に応えるために本当の自分を殺し続けている" },
            { id: "silent_scream_behind_smile", name: "😢 「大丈夫」と笑いながら内心では助けを求めている悲鳴" },
            { id: "unspoken_limit_burden", name: "🛑 誰にも弱音を吐けずに一人で抱え込んだ限界の孤独" },
            { id: "mirror_stranger_night", name: "🪞 鏡に映る自分が誰だか分からなくなる真夜中" },
            { id: "blinding_lights_deep_shadow", name: "🌃 街の灯りが眩しすぎて自分の影の濃さに怯える心" },
            { id: "unloved_childhood_scar", name: "🥀 親の愛を知らずに育ち人を愛する方法が分からない" },
            { id: "sns_timeline_midnight_pain", name: "📱 SNSのタイムラインでみんなが楽しそうに見える深夜の痛み" },
            { id: "invisible_cold_wall", name: "🧱 誰かと一緒にいてもどこか冷たい透明な壁を感じてしまう" },
            { id: "left_behind_alone", name: "⏳ 昔の仲間たちが次々と結婚し自分だけ取り残された焦燥" },
            { id: "lights_out_abyss", name: "🌑 部屋の明かりを消した瞬間に押し寄せる途方もない虚無" },
            { id: "between_vanish_and_live", name: "⚖️ 「消えてしまいたい」と「生きたい」の間で激しく揺れる心" }
        ]
    },
    {
        category: "🌧️ 後悔・罪悪感・言えなかった言葉",
        items: [
            { id: "unsaid_sorry_and_thanks", name: "🌧️ あの日言えなかった「ごめんね」と「ありがとう」の小さな後悔" },
            { id: "lie_hurt_someone_special", name: "💔 自分のついた小さな嘘が原因で大切な人を決定的に傷つけた記憶" },
            { id: "missed_friend_sos", name: "🆘 助けを求めるサインを出していた友人に気付けなかった消えない自責" },
            { id: "unforgivable_words_spoken", name: "💥 カッとなって口にしてしまった取り返しのつかないひどい言葉" },
            { id: "abandoned_dream_regret", name: "🎨 夢を諦めて妥協の現実を選んだあの日への拭いきれない後悔" },
            { id: "betrayed_supporter_past", name: "🏃 背中を押して信じてくれた人を裏切って逃げ出してしまった過去" },
            { id: "jealousy_ugly_heart", name: "🐍 嫉妬から他人の成功を心から祝福できなかった醜い自分への嫌悪" },
            { id: "parent_collapsed_before_filial", name: "🏥 親孝行が何一つできないまま親が倒れてしまった深い後悔" },
            { id: "no_courage_confession", name: "💌 告白する勇気が出ないまま別の誰かのものになってしまったあの人" },
            { id: "success_on_sacrifices", name: "⚖️ 自分の夢のために誰かの犠牲の上に立っている拭えない罪悪感" },
            { id: "road_not_taken_nostalgia", name: "🛣️ あの時違う道を選んでいたらどうなっていただろうという深夜の未練" },
            { id: "ignored_person_in_need", name: "☔ 困っている人を見捨てて通り過ぎてしまった日の冷たい雨" },
            { id: "secret_to_the_grave", name: "🗝️ この秘密だけは誰にも言えず墓場まで持っていくと決めたあの誓い" },
            { id: "rewind_time_to_that_morning", name: "⏪ もう一度だけ時間を巻き戻せるならあの朝に戻ってやり直したい" },
            { id: "irretrievable_youth_guilt", name: "🍂 取り戻せない二度と来ない青春の時間を悔やむ深夜の自問自答" }
        ]
    },
    {
        category: "⚔️ 宿命・秘密・復讐・二重生活",
        items: [
            { id: "revenge_behind_calm_smile", name: "⚔️ 親を奪われた過去の復讐・笑顔の裏に研ぎ澄ました静かな決意" },
            { id: "double_life_secret_agent", name: "🕶️ 誰にも明かせない裏の顔（潜入者/スパイ）としての偽りの日常" },
            { id: "clan_heavy_curse_destiny", name: "🩸 生まれながらに背負わされた一族の重い呪いと過酷な宿命" },
            { id: "forbidden_love_enemy", name: "🥀 敵対する組織の相手と恋に落ちてしまった許されない愛" },
            { id: "traitor_act_to_protect", name: "🛡️ 仲間を守るためにあえて自ら裏切り者を演じる孤独な覚悟" },
            { id: "burning_life_countdown", name: "⏳ 自分の命を削りながら戦い続ける残されたわずかな時間" },
            { id: "endless_pilgrimage_atonement", name: "🕯️ 犯してしまった消せない罪を償うための終わりのない巡礼の旅" },
            { id: "waiting_former_friend_blade", name: "🗡️ いつか自分を討ちに来るかつての親友を静かに待つ心境" },
            { id: "prophet_of_collapsed_peace", name: "👁️ この穏やかな日常がいつか必ず崩れ去ると知っている予知の重圧" },
            { id: "massive_debt_daytime_smile", name: "💼 誰にも言えない巨額の借金を背負い笑顔で明るく働く昼の顔" },
            { id: "dark_hero_hands_soiled", name: "🌑 正義を貫くためにあえて悪に手を染めるダークヒーローの葛藤" },
            { id: "android_discovering_fake", name: "🤖 自分が心を持ったアンドロイド（作られた偽りの存在）だと知った苦悩" },
            { id: "memory_erasure_specimen", name: "🧬 いつか記憶がすべて消去される運命にある実験体の最後の記録" },
            { id: "silence_knowing_true_culprit", name: "🤫 過去の未解決事件の真犯人を知りながら沈黙を守り続ける恐怖" },
            { id: "revenge_empty_road", name: "🔥 復讐を果たした後に何も残らないと分かっていながら突き進む修羅の道" }
        ]
    },
    {
        category: "🕊️ 成長・旅立ち・自立の痛み",
        items: [
            { id: "leaving_hometown_family", name: "🎒 生まれ育った愛する故郷と家族に背を向けて一人旅立つ日の朝" },
            { id: "surpass_admired_mentor", name: "🥋 ずっと憧れていた先輩の背中をいつか追い越さなければならない宿命" },
            { id: "fading_childhood_dream", name: "🪁 子どもの頃の無邪気な夢が大人になるにつれて色褪せていく痛み" },
            { id: "broken_dream_sunset", name: "🏟️ 長年打ち込んだ部活や夢の引退・夢破れた日のグラウンドの夕暮れ" },
            { id: "mentor_teaching_understood", name: "👨‍🏫 厳しかった恩師の教えの真意に大人になってからようやく気付く涙" },
            { id: "protector_responsibility", name: "🛡️ 守られる側から誰かを守る側へ変わった責任の重さと怖さ" },
            { id: "classmates_scattering_soon", name: "🏫 いつかこの平穏な教室の仲間たちと散り散りになる予感の切なさ" },
            { id: "aged_parents_shoulders", name: "👵 親が小さく年老いて見えた瞬間に胸を突く言葉にできない切なさ" },
            { id: "first_night_living_alone", name: "🧊 初めて一人暮らしを始めた日の夜の冷蔵庫の唸り音と心細さ" },
            { id: "clumsy_first_step_forward", name: "🌱 不器用ながらも自分の足で一歩を踏み出す決意の痛みと覚悟" },
            { id: "crushed_by_real_world", name: "🏢 憧れの世界の残酷な現実に打ちのめされた新人の頃の涙" },
            { id: "vow_to_become_stronger", name: "🔥 過去の自分の無力さを知ったからこそ絶対に強くなろうとする誓い" },
            { id: "watching_child_fly_away", name: "🕊️ 巣立っていく我が子の背中を見送る親の静かな誇りと寂しさ" },
            { id: "changing_town_no_place", name: "🏗️ 変わっていく生まれ故郷の街並みに自分の居場所がなくなっていく感覚" },
            { id: "rite_of_passage_pain", name: "🚶 痛みを受け入れながら一歩ずつ大人になっていく通過儀礼の季節" }
        ]
    },
    {
        category: "🌟 奇跡・祈り・密かな救い",
        items: [
            { id: "words_saved_from_rock_bottom", name: "🌟 絶望の底にいた時に見知らぬ誰かにかけてもらった救いの一言" },
            { id: "unbroken_soul_rising", name: "🔥 何度打ちのめされても諦めずに立ち上がり続ける魂の不屈" },
            { id: "invisible_thread_bond", name: "🧵 どんなに離れていても心のどこかで繋がっていると信じる魂の絆" },
            { id: "light_in_darkness_promise", name: "🕯️ 暗闇の中で見つけた小さな希望の光を絶対に消さないという誓い" },
            { id: "believe_laugh_together_someday", name: "🌈 いつか笑って思い出話にできる日が必ず来ると信じる今" },
            { id: "flower_blooming_unnoticed", name: "🌼 誰にも気付かれなくても誰かのために咲き続ける名もなき花" },
            { id: "miracle_born_from_wounds", name: "✨ 過去の深い傷があったからこそ出会えた今の奇跡への感謝" },
            { id: "red_string_reunion", name: "🧶 運命の糸を手繰り寄せて長い年月を経て再び巡り会う奇跡の瞬間" },
            { id: "gratitude_for_meeting", name: "🙏 どんな結末になろうともあなたに出会えたことへの深い感謝" },
            { id: "vow_to_love_until_the_end", name: "💍 この命が終わるその瞬間まで愛し抜くという魂の誓い" }
        ]
    }
];

// グローバルスコープに公開
if (typeof window !== 'undefined') {
    window.SURFACE_THEMES_PRESETS = SURFACE_THEMES_PRESETS;
    window.HIDDEN_DRAMA_PRESETS = HIDDEN_DRAMA_PRESETS;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SURFACE_THEMES_PRESETS, HIDDEN_DRAMA_PRESETS };
}
