/**
 * 🎙️ YouTube収益化安全キャラクター定義（VOICEVOX / 東北ずん子プロジェクト等）
 */
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
    turnaroundPromptEn: 'character design turnaround sheet, 3 angles full body: front view, side view, and back view of meimei himari with dark purple ombre hair, black gothic hooded dress, reaper style, clean character sheet',
    recommendedTastes: ['ダークゴシック童話・黒髪ノスタルジー', '昭和レトロ活版・劇画', '江戸大河・天下泰平の影と群像劇']
  },
  {
    id: 'ryusei',
    nameJa: '青山龍星',
    speakerCredit: 'VOICEVOX:青山龍星 (VirVox Project)',
    icon: '🕶️',
    personality: '低音の渋い声。ハードボイルドな探偵、怪事件を追うルポライター、あるいは怪異を見守る語り部。',
    dnaPromptEn: 'aoyama ryusei, rugged handsome middle-aged Japanese man, dark disheveled hair, slight stubble on jawline, piercing sharp dark eyes, wearing a classic worn beige trench coat with dark suit and tie underneath, cinematic detective noir aesthetic',
    turnaroundPromptEn: 'character design turnaround sheet, 3 angles full body: front view, side view, and back view of rugged detective man in beige trench coat, clean character sheet',
    recommendedTastes: ['劇画・ヴィンテージ昭和', 'ダークゴシック童話・黒髪ノスタルジー', '90年代セル画・サイバーパンク']
  }
];

