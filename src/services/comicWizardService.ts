/**
 * comicWizardService.ts
 * ComicCreationWizardModal で使用する AI 考案・画像生成・ストーリープランニングのサービス層
 */

import { ProductionMode, CastCharacter, SeriesEpisodePlan } from '../types';
import { Flow } from 'flow-sdk';
import { callWithRetry, safeJsonParse, formatErrorMessage } from './utils';
import { buildGrandDesignPrompt, cleanEpisodeTitle, cleanEpisodeTitleEn } from './directorService';
import { createDefaultCastCharacter } from './castStorage';
import { resolveImageModel } from '../constants';

export interface TurnaroundCandidate {
  id: string;
  tasteName: string;      // 例: 📜 レトロ淡彩アトリエ・極細線画
  tastePromptEn: string;  // 画風プロンプト
  name: string;           // 主人公名
  concept: string;        // 性格・世界観設定
  dnaPromptEn: string;    // 容姿DNA
  turnaroundBase64?: string;
  turnaroundMediaId?: string;
  status: 'idle' | 'generating_image' | 'completed' | 'error';
  errorMessage?: string;
  isUserSpecified?: boolean; // ユーザーが明示的に指定した画風か
}

export interface ProduceSnapshot {
  version: '1.0';
  timestamp: string;
  productionMode?: ProductionMode;
  selectedTheme: string;
  tasteMode: 'ai_auto' | 'custom_pick';
  selectedCustomTastes: string[];
  candidates: TurnaroundCandidate[];
  selectedCandidateId: string | null;
  subCharacters: CastCharacter[];
  episodeCount: number;
  cutsPerEpisode: number;
  seriesTitle: string;
  overallSynopsis: string;
  episodesPlan: SeriesEpisodePlan[];
  step: 1 | 2 | 3;
}

/**
 * テーマおよび指定画風に基づき、5組の【画風 × 主人公三面図設定】をAI自律考案
 */
export async function brainstormProtagonistCandidates(params: {
  productionMode: ProductionMode;
  selectedTheme: string;
  tasteMode: 'ai_auto' | 'custom_pick';
  selectedCustomTastes: string[];
  availableTastes: Record<string, string>;
  currentModeConfig: { label: string; desc: string };
  onAddLog: (msg: string, type?: 'process' | 'success' | 'warning' | 'error') => void;
}): Promise<TurnaroundCandidate[]> {
  const {
    productionMode,
    selectedTheme,
    tasteMode,
    selectedCustomTastes,
    availableTastes,
    currentModeConfig,
    onAddLog
  } = params;

  const userPicksCount = selectedCustomTastes.length;
  const isCustomMode = tasteMode === 'custom_pick' && userPicksCount > 0;

  // ユーザー指定画風のプロンプト指示文
  let customTastesInstruction = '';
  if (isCustomMode) {
    customTastesInstruction = `
【最重要: ユーザーが自ら指定した画風 (${userPicksCount}個)】:
${selectedCustomTastes.map((key, i) => `候補 ${i + 1} 枠: 「${key}」 (英語画風プロンプト: ${availableTastes[key] || 'masterpiece anime style'})`).join('\n')}

【厳守事項】:
出力する5個の候補のうち、最初の${userPicksCount}個は上記の指定された画風をそのまま「tasteName」および「tastePromptEn」に1文字も変えずに厳格に採用してください。
残りの${5 - userPicksCount}個の枠は、世界観テーマ「${selectedTheme}」に最高にマッチする全く異なる魅力的な画風をAIが考案して補完してください。
`;
  } else {
    customTastesInstruction = `
【画風選定の要件】:
世界観テーマ「${selectedTheme}」の歴史・情緒・空気感に最高にマッチする、全くアプローチの異なる魅力的な5種類の画風（例: 緻密線画、水彩淡彩、劇画調、モダンアニメ、レトロセル画など世界観に即した画風）をAIが自律考案してください。
`;
  }

  // モードに応じた役割とキャラクターガイドライン
  let modeSpecificRole = '世界的大ヒット作品を生み出す天才エグゼクティブプロデューサー兼アートディレクター';
  let modeSpecificCharDirective = `世界観テーマ「${selectedTheme}」のジャンル・空気感・情緒を忠実に尊重してください。`;
  if (productionMode === 'mv') {
    modeSpecificRole = '世界的トップアーティストのミュージックビデオ(MV)・映像詩を手掛ける天才映像監督兼アートディレクター';
    modeSpecificCharDirective = `【最重要: 音楽MV特化キャラクター設計】:
- 楽曲の世界観やエモーショナルな心情（孤独、夜明け、焦燥、希望、疾走感など）を一身に背負う【MVの象徴的ヒロイン／ボーカリスト／アーティスト像】として考案してください。
- 画面映えする印象的な髪型、瞳の光、夜の街や幻想的空間に映えるアイコニックな衣装・シルエットを持たせてください。`;
  } else if (productionMode === 'manzai') {
    modeSpecificRole = 'お笑い・演芸の聖地で数々のレジェンドを生み出してきた名席亭兼プロデューサー';
    modeSpecificCharDirective = `【最重要: 漫才・掛け合い特化キャラクター設計】:
- 舞台上でテンポの良い掛け合いを行う演芸コンビ（ボケ役、またはツッコミ役）の中心人物として考案してください。
- 表情豊かで愛嬌やクセがあり、舞台衣装（スーツ、着物、個性的な普段着など）を着こなす魅力的な人物にしてください。`;
  } else if (productionMode === 'manga') {
    modeSpecificRole = '大ヒット連載を次々に立ち上げる伝説の少年・青年マンガ誌の編集長兼アートディレクター';
    modeSpecificCharDirective = `【最重要: コミック・マンガ特化キャラクター設計】:
- コマ割りや見開きで圧倒的な存在感を放つ、感情表現豊かで読者の心を掴む主人公キャラクターとして考案してください。`;
  }

  const prompt = `あなたは${modeSpecificRole}です。
【制作ジャンル・大枠】: ${currentModeConfig.label} (${currentModeConfig.desc})
以下の【世界観テーマ】に深く根ざした、全くアプローチの異なる【5種類の画風・テイスト】と、それぞれの画風を極限まで活かした魅力的な【主人公キャラクター案】を5組考案してください。

【世界観テーマ】: ${selectedTheme}
${customTastesInstruction}

【キャラクター考案の最重要ガイドライン】:
${modeSpecificCharDirective}
- 現代社会派・人間ドラマ・日常系（例: 8050問題、老老介護、ブラック企業、家族愛、下町人情など）の場合：
  ★絶対に武器や魔法、サイバースーツ、ファンタジーの肩書（求道者、切り込み役、トリックスター等）を付けないでください！
  ★実在のリアルな職業や立場（例: 孤軍奮闘する長男、限界を迎えた介護従事者、見守る幼馴染、訪問看護師、心優しきケースワーカー等）として考案してください。
  ★画風も白黒劇画、淡彩水彩、細線画、ジブリ調の温もりある日常描写など、テーマの重みや哀愁、ぬくもりを表現できる画風にしてください。
- 歴史・時代劇の場合はその時代の身分・職業（町火消し、岡っ引き、看板娘など）、ファンタジー・バトルの場合のみ相応の戦士や魔法使いにしてください。

【出力要件】
以下のキーを持つ厳密なJSON形式（Markdownのコードブロックなし）で出力してください:
{
  "candidates": [
    {
      "id": "cand_1",
      "tasteName": "世界観にマッチする独創的画風名 (日本語)",
      "tastePromptEn": "Detailed English art style prompt matching the tasteName, masterpiece",
      "name": "主人公の名前 (立場・肩書)",
      "concept": "性格、信念、日常での立場や抱える葛藤（日本語2行程度）",
      "dnaPromptEn": "Detailed English character appearance prompt: gender, age, realistic hairstyle, expressive eyes, everyday or authentic clothing matching ${selectedTheme}"
    }
  ]
}`;

  let initialCandidates: TurnaroundCandidate[] = [];

  try {
    const res = await callWithRetry<any>(
      () => Flow.generate.text(prompt),
      (attempt, max, delay, err) => {
        onAddLog(`⚠️ [画風&キャラ考案] リトライ (${attempt}/${max}) ${Math.round(delay / 1000)}秒待機... (${formatErrorMessage(err)})`, 'warning');
      },
      5
    );
    const text = res?.text || (typeof res === 'string' ? res : '');
    const parsed = safeJsonParse<any>(text, null);
    let list: any[] = [];
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && Array.isArray(parsed.candidates)) {
      list = parsed.candidates;
    }

    if (list.length >= 3) {
      initialCandidates = list.map((item, idx) => {
        const isUserPick = isCustomMode && idx < selectedCustomTastes.length;
        const tasteName = isUserPick ? selectedCustomTastes[idx] : (item.tasteName || `画風案 ${idx + 1}`);
        const tastePromptEn = isUserPick ? (availableTastes[selectedCustomTastes[idx]] || item.tastePromptEn) : (item.tastePromptEn || 'anime style, masterpiece');
        return {
          id: item.id || `cand_${idx + 1}`,
          tasteName,
          tastePromptEn,
          name: item.name || `主人公 ${idx + 1}`,
          concept: item.concept || `${selectedTheme}の世界を生きる主人公`,
          dnaPromptEn: item.dnaPromptEn || `A striking authentic character matching ${selectedTheme}`,
          status: 'idle' as const,
          isUserSpecified: isUserPick,
        };
      });
    }
  } catch (textErr: any) {
    console.warn('[ComicWizard] Flow.generate.text failed, fallback to smart candidates:', textErr);
    onAddLog(`⚠️ AIテキスト考案が一時応答待ちのため、世界観「${selectedTheme}」に最適化した候補を動的構築して三面図作画を開始します`, 'warning');
  }

  // 候補が空の場合（エラー時含む）は、世界観テーマのジャンルに最適化した動的フォールバックを自動生成
  if (initialCandidates.length === 0) {
    const isSocialOrDaily = /介護|8050|年金|ブラック|社内|不倫|平成|昭和|日常|生活|孤独|社会|家族|就職/.test(selectedTheme);
    const isEdoOrHistorical = /江戸|幕末|新選組|大名|侍|武士|吉原|長屋|明治|大正/.test(selectedTheme);

    interface ArchetypeDef {
      name: string;
      concept: string;
      dna: string;
      tasteKey?: string;
    }

    let fallbackArchetypes: ArchetypeDef[] = [];

    if (isSocialOrDaily) {
      fallbackArchetypes = [
        {
          name: '孤軍奮闘する家族 (長男/当事者)',
          concept: '日々の葛藤と親への想いを抱え、現実と静かに向き合い続ける実直な主人公',
          dna: 'Japanese ordinary adult, tired yet gentle and determined eyes, simple modest casual clothes, realistic everyday life setting',
          tasteKey: '白黒劇画・超絶インクマンガ (Seinen manga realist ink)'
        },
        {
          name: '現場を支えるケアマネジャー',
          concept: '制度の限界に悩みながらも、利用者の尊厳を守るため奔走する温かい主人公',
          dna: 'Japanese care manager, kind empathetic expression, neat practical work clothes with cardigan, holding clipboard',
          tasteKey: 'ノスタルジック水彩・淡彩画 (Nostalgic watercolor drama)'
        },
        {
          name: '人生の哀愁を背負う老親',
          concept: '衰えゆく体と子への負い目に揺れながら、過去の誇りを胸に生きる主人公',
          dna: 'Elderly Japanese person, weathered gentle face with deep wrinkles, nostalgic demeanor, soft indoor attire',
          tasteKey: '📜 レトロ淡彩アトリエ・極細線画 (Nostalgic Faded Pastel Whisper-Line)'
        },
        {
          name: '街を駆ける福祉相談員',
          concept: '孤立した家庭を見過ごせず、粘り強く対話を重ねて希望を紡ぐ主人公',
          dna: 'Compassionate social worker, youthful focused gaze, durable practical outerwear, friendly approachable presence',
          tasteKey: '📜 レトロ淡彩アトリエ・極細線画 (Nostalgic Faded Pastel Whisper-Line)'
        },
        {
          name: '静かに見守る隣人・理解者',
          concept: '言葉少なに温かい差し入れや声をかけ、孤立を防ぐ地域の光となる主人公',
          dna: 'Kind neighborhood resident, warm welcoming smile, ordinary home clothes, humble gentle atmosphere',
          tasteKey: '✨ エモーショナル・シネマティック・スカイ (Emotional Cinematic Sky Anime)'
        }
      ];
    } else if (isEdoOrHistorical) {
      fallbackArchetypes = [
        {
          name: '腕利きの若き職人・町火消し',
          concept: '情に厚く曲がったことが大嫌い、町の危機に真っ先に飛び込む江戸っ子',
          dna: 'Spirited Edo period Japanese artisan, sharp lively eyes, traditional hanten coat with rolled sleeves',
          tasteKey: '🌊 葛飾北斎・超写実肉筆浮世絵 (Hyper-Realistic Hokusai Nikuhitsu Ukiyo-e)'
        },
        {
          name: '訳ありの浪人・用心棒',
          concept: '過去を語らず町外れに佇むが、弱者を救うため静かに太刀を抜く剣客',
          dna: 'Wandering masterless samurai, calm piercing gaze, weathered dark kimono, tied hair',
          tasteKey: '🖋 白黒劇画・超絶インクマンガ (Intense Monochrome Manga)'
        },
        {
          name: '下町の看板娘・小町',
          concept: '持ち前の明るさと機転で長屋の揉め事を次々に解決する町の太陽',
          dna: 'Charming Edo town maiden, bright lively smile, colorful cotton kimono with apron',
          tasteKey: '🌸 日常系萌えアニメ・ハッチングチーク (Moe Daily Hatching Blush Anime)'
        },
        {
          name: '観察眼鋭き町医者・蘭方医',
          concept: '貧しい庶民からも銭を取らず、命の平等を信じて新薬を探し求める知性派',
          dna: 'Intellectual Edo doctor, observant gentle expression, neat traditional doctor robes',
          tasteKey: '📜 レトロ淡彩アトリエ・極細線画 (Nostalgic Faded Pastel Whisper-Line)'
        },
        {
          name: '闇夜を駆ける義賊・情報屋',
          concept: '昼はしがない瓦版売り、夜は悪徳商人の不正を暴く裏の英雄',
          dna: 'Clever street informer, quick witted smirk, agile dark haori coat and headband',
          tasteKey: '✨ エモーショナル・シネマティック・スカイ (Emotional Cinematic Sky Anime)'
        }
      ];
    } else {
      fallbackArchetypes = [
        {
          name: '希望を胸に歩む若き主人公',
          concept: '壁にぶつかりながらも、自らの信念を信じて一歩ずつ前進する主人公',
          dna: 'Expressive youthful character, passionate hopeful eyes, distinctive personal costume matching the setting',
          tasteKey: '✨ エモーショナル・シネマティック・スカイ (Emotional Cinematic Sky Anime)'
        },
        {
          name: '経験豊かな導き手・守護者',
          concept: '豊富な経験と包容力で周囲を支え、困難の打開策を見出す頼もしい存在',
          dna: 'Reliable experienced figure, calm steady eyes, well-worn dependable practical attire',
          tasteKey: '📜 レトロ淡彩アトリエ・極細線画 (Nostalgic Faded Pastel Whisper-Line)'
        },
        {
          name: '孤高の信念を貫く探求者',
          concept: '妥協を許さず己の道を突き進む、高い集中力と純粋さを持つ孤高の人物',
          dna: 'Intense focused protagonist, keen insightful eyes, sleek distinctive functional attire',
          tasteKey: '白黒劇画・超絶インクマンガ (Seinen manga realist ink)'
        },
        {
          name: '優しき共感者・サポーター',
          concept: '繊細な感性で他者の心の痛みに寄り添い、絆を繋ぎとめる重要なキーパーソン',
          dna: 'Gentle empathetic character, soft understanding eyes, cozy comfortable clothing',
          tasteKey: 'ノスタルジック水彩・淡彩画 (Nostalgic watercolor drama)'
        },
        {
          name: '変革を起こすチャレンジャー',
          concept: '常識に囚われない自由な発想で、停滞した状況に新しい風を吹き込む起爆剤',
          dna: 'Dynamic bold protagonist, spirited confident grin, unconventional modern stylish outfit',
          tasteKey: '📜 レトロ淡彩アトリエ・極細線画 (Nostalgic Faded Pastel Whisper-Line)'
        }
      ];
    }

    initialCandidates = fallbackArchetypes.map((arch, idx) => {
      const isUserPick = isCustomMode && idx < selectedCustomTastes.length;
      let tasteName = isUserPick ? selectedCustomTastes[idx] : (arch.tasteKey || `画風案 ${idx + 1}`);
      let tastePromptEn = isUserPick ? (availableTastes[selectedCustomTastes[idx]] || 'masterpiece') : 'anime masterpiece, high quality';

      if (!isUserPick && arch.tasteKey && availableTastes[arch.tasteKey]) {
        tastePromptEn = availableTastes[arch.tasteKey];
      } else if (!isUserPick && availableTastes[tasteName]) {
        tastePromptEn = availableTastes[tasteName];
      }

      return {
        id: `cand_${idx + 1}`,
        tasteName,
        tastePromptEn,
        name: `${arch.name}`,
        concept: `${selectedTheme}の中で、${arch.concept}`,
        dnaPromptEn: `${arch.dna}, matching world setting of ${selectedTheme}`,
        status: 'idle' as const,
        isUserSpecified: isUserPick,
      };
    });
  }

  return initialCandidates;
}

/**
 * 候補の三面図シート（16:9）を AI 作画
 */
export async function generateCandidateTurnaroundImage(params: {
  candidate: TurnaroundCandidate;
  index: number;
  total: number;
  onAddLog: (msg: string, type?: 'process' | 'success' | 'warning' | 'error') => void;
}): Promise<{ base64: string; mediaId?: string }> {
  const { candidate, index, total, onAddLog } = params;
  const modelDef = resolveImageModel();
  const safeModelName = modelDef?.name || '🍌 Nano Banana 2';
  const safeNegative = 'worst quality, normal quality, lowres, deformed, distorted, bad anatomy, bad hands, blurry, complex background, text, watermark';

  onAddLog(`📐 [${index + 1}/${total}] 「${candidate.tasteName}」×「${candidate.name}」の三面図シートを作画中...`, 'process');

  const turnaroundPrompt = `${candidate.dnaPromptEn}, anime character turnaround sheet, model sheet, three views, full body front view, full body side view, full body back view, clean plain white background, high-contrast crisp anime lineart, consistent clothing and proportions, masterpiece. Art style: ${candidate.tastePromptEn}`;

  const imgRes = await callWithRetry<any>(
    () => Flow.generate.image({
      prompt: turnaroundPrompt,
      negativePrompt: safeNegative,
      aspectRatio: '16:9',
      modelDisplayName: safeModelName,
    }),
    (att, max, d, e) => {
      onAddLog(`⚠️ [${index + 1}/${total}] 作画リトライ (${att}/${max}) (理由: ${formatErrorMessage(e)})`, 'warning');
    },
    3
  );

  const base64 = imgRes?.base64 || imgRes?.image?.base64;
  const mediaId = imgRes?.mediaId || imgRes?.image?.mediaId;

  if (!base64) {
    throw new Error('画像データが取得できませんでした');
  }

  return { base64, mediaId };
}

/**
 * 主人公を取り巻くサブキャラクター（相棒・ライバルなど）を自律考案
 */
export async function brainstormSubCharacters(params: {
  productionMode: ProductionMode;
  selectedTheme: string;
  seriesTitle: string;
  currentCandidate: TurnaroundCandidate;
  currentModeConfig: { label: string; desc: string };
  onAddLog: (msg: string, type?: 'process' | 'success' | 'warning' | 'error') => void;
}): Promise<CastCharacter[]> {
  const {
    productionMode,
    selectedTheme,
    seriesTitle,
    currentCandidate: target,
    currentModeConfig,
    onAddLog
  } = params;

  onAddLog(`👥 【${currentModeConfig.label}】「${target.name}」を取り巻くサブキャラ・相棒を自動考案中...`, 'process');

  let subRoleGuidance = `作品『${seriesTitle || target.name}』（主人公: 「${target.name}」）のストーリー展開を強力に引き立てる、魅力的なサブキャラクター（お友達・相棒、ヒロイン、宿敵・ライバルなど）を【2〜3名】考案してください。`;
  if (productionMode === 'mv') {
    subRoleGuidance = `音楽MV『${seriesTitle || target.name}』（メイン象徴キャラクター: 「${target.name}」）の世界観を深めるサブキャラクター（相棒、バンド仲間、回想に現れる大切な人、または対照的な影の人物など）を【2〜3名】考案してください。`;
  } else if (productionMode === 'manzai') {
    subRoleGuidance = `漫才・掛け合い『${seriesTitle || target.name}』で、「${target.name}」とコンビを組む相方（ツッコミ役、またはボケ役）および関係者（舞台関係者や熱狂的ファンなど）を【2〜3名】考案してください。`;
  }

  const prompt = `あなたは世界的な映像・コミック制作スタジオのキャスティングディレクターです。
【制作ジャンル・大枠】: ${currentModeConfig.label} (${currentModeConfig.desc})
${subRoleGuidance}

【世界観テーマ】: ${selectedTheme}
【画風テイスト】: ${target.tasteName}
【主人公 / メインキャラクター】: ${target.name} (${target.concept})

【重要】世界観「${selectedTheme}」の日常・社会派・歴史などのジャンルに応じたリアリティを重視してください。

以下の厳密なJSON形式（Markdownコードブロックなし）で出力してください:
{
  "subCharacters": [
    {
      "name": "キャラクター名 (立場・肩書)",
      "role": "partner",
      "concept": "主人公との関係性・相棒・パートナーとしての役割（日本語2行）",
      "dnaPromptEn": "Detailed English character appearance prompt: gender, age, hair, eyes, distinct clothing matching ${selectedTheme}"
    },
    {
      "name": "キャラクター名 (立場・肩書)",
      "role": "antagonist",
      "concept": "主人公と対比をなすライバル・対立者・または別の生き方をする人物としての役割（日本語2行）",
      "dnaPromptEn": "Detailed English character appearance prompt: gender, age, hair, eyes, distinct clothing matching ${selectedTheme}"
    }
  ]
}`;

  try {
    const res = await callWithRetry<any>(
      () => Flow.generate.text(prompt),
      (attempt, max, delay, err) => {
        onAddLog(`⚠️ [サブキャラ考案] リトライ (${attempt}/${max}) ${Math.round(delay / 1000)}秒待機... (${formatErrorMessage(err)})`, 'warning');
      },
      5
    );
    const text = res?.text || (typeof res === 'string' ? res : '');
    const parsed = safeJsonParse<any>(text, null);
    let list: any[] = [];
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && Array.isArray(parsed.subCharacters)) {
      list = parsed.subCharacters;
    }

    if (list.length > 0) {
      const chars: CastCharacter[] = list.map((item, idx) => {
        return createDefaultCastCharacter(
          `sub_char_${idx + 1}_${Date.now()}`,
          item.name,
          item.role || 'partner',
          item.dnaPromptEn
        );
      });
      onAddLog(`✨ サブキャラクター${chars.length}名の配役が完了しました！`, 'success');
      return chars;
    } else {
      throw new Error('サブキャラクターの生成に失敗しました');
    }
  } catch (err: any) {
    onAddLog(`❌ サブキャラ考案エラー: ${formatErrorMessage(err)}`, 'error');
    // フォールバック
    return [
      createDefaultCastCharacter(`sub_1_${Date.now()}`, '頼れる相棒・理解者', 'partner', `A trustworthy loyal companion and friend of ${target.name}, matching ${selectedTheme}`),
      createDefaultCastCharacter(`sub_2_${Date.now()}`, '宿命の好敵手・対立者', 'antagonist', `A compelling opposing figure to ${target.name}, sharp intense eyes matching ${selectedTheme}`)
    ];
  }
}

/**
 * 起承転結ストーリー（全エピソード計画）を自律考案
 */
export async function brainstormStoryPlan(params: {
  productionMode: ProductionMode;
  selectedTheme: string;
  episodeCount: number;
  currentCandidate: TurnaroundCandidate;
  currentModeConfig: { label: string; unit: string };
  onAddLog: (msg: string, type?: 'process' | 'success' | 'warning' | 'error') => void;
}): Promise<{
  seriesTitle: string;
  overallSynopsis: string;
  episodesPlan: SeriesEpisodePlan[];
}> {
  const {
    productionMode,
    selectedTheme,
    episodeCount: count,
    currentCandidate: target,
    currentModeConfig,
    onAddLog
  } = params;

  onAddLog(`📜 【${currentModeConfig.label}】「${target.name}」で【全${count}${currentModeConfig.unit}】の構成プランを構築中...`, 'process');

  const prompt = buildGrandDesignPrompt(
    count,
    '日本',
    selectedTheme,
    target.tasteName,
    productionMode === 'manga',
    productionMode === 'mv',
    target.dnaPromptEn,
    target.name
  );

  try {
    const res = await callWithRetry<any>(
      () => Flow.generate.text(prompt),
      (attempt, max, delay, err) => {
        onAddLog(`⚠️ [プロット生成] リトライ (${attempt}/${max}) ${Math.round(delay / 1000)}秒待機... (${formatErrorMessage(err)})`, 'warning');
      },
      5
    );
    const text = res?.text || (typeof res === 'string' ? res : '');
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = safeJsonParse<any>(cleaned, null);

    if (parsed && Array.isArray(parsed.episodesPlan) && parsed.episodesPlan.length > 0) {
      const seriesTitle = parsed.seriesTitle || (productionMode === 'mv' ? `${target.name} MV Collection` : `${target.name}伝`);
      const overallSynopsis = parsed.overallSynopsis || '';

      // 指定話数 count に厳密に同期＆話数番号を徹底サニタイズ（削除やスキップ時の欠番事故を防止）
      let adjustedPlan: SeriesEpisodePlan[] = parsed.episodesPlan.map((p: any, idx: number) => {
        const epNum = p.epNumber || (idx + 1);
        const rawTitleJp = p.titleJp || '';
        const cleanedJp = cleanEpisodeTitle(rawTitleJp);
        const fallbackJp = productionMode === 'mv' 
          ? (idx === 0 ? '静寂の夜明け' : idx === count - 1 ? '光の終幕' : '心象のグラデーション')
          : (idx < Math.round(count * 0.25) ? '運命の幕開け' : idx < Math.round(count * 0.55) ? '深まる謎と試練' : idx < Math.round(count * 0.85) ? '最大の激突と転換' : '大団円と未来');
        
        const rawTitleEn = p.titleEn || '';
        const cleanedEn = cleanEpisodeTitleEn(rawTitleEn);
        const fallbackEn = productionMode === 'mv' ? 'Atmospheric Melody' : 'Dramatic Scene';

        return {
          epNumber: epNum,
          titleJp: cleanedJp || fallbackJp,
          titleEn: cleanedEn || fallbackEn,
          summary: p.summary || `${target.name}の物語の情景`
        };
      });

      if (adjustedPlan.length > count) {
        adjustedPlan = adjustedPlan.slice(0, count);
      } else if (adjustedPlan.length < count) {
        const diff = count - adjustedPlan.length;
        const fillers: SeriesEpisodePlan[] = Array.from({ length: diff }, (_, idx) => {
          const epNum = adjustedPlan.length + idx + 1;
          return {
            epNumber: epNum,
            titleJp: productionMode === 'mv' ? '続く旋律と情景' : '続く戦いと希望',
            titleEn: productionMode === 'mv' ? 'Resonant Melody' : 'Continuing Struggle and Hope',
            summary: `${target.name}の壮大な物語の情景`
          };
        });
        adjustedPlan = [...adjustedPlan, ...fillers];
      }

      onAddLog(`🎉 『${seriesTitle}』（全${adjustedPlan.length}${currentModeConfig.unit}）の構成プロットが確定しました！`, 'success');

      return {
        seriesTitle,
        overallSynopsis,
        episodesPlan: adjustedPlan
      };
    } else {
      throw new Error('ストーリープロットの生成に失敗しました');
    }
  } catch (err: any) {
    onAddLog(`❌ プロット生成エラー: ${formatErrorMessage(err)}`, 'error');
    // フォールバック（削除時の欠番事故を防ぐため、第X話やEpisode Xなどの連番は一切入れない）
    const dummyPlan: SeriesEpisodePlan[] = Array.from({ length: count }, (_, i) => ({
      epNumber: i + 1,
      titleJp: productionMode === 'mv' 
        ? (i === 0 ? '静寂の夜明け' : i === count - 1 ? '光の終幕' : '心象のグラデーション') 
        : (i < Math.round(count * 0.25) ? '運命の幕開け' : i < Math.round(count * 0.55) ? '深まる謎と試練' : i < Math.round(count * 0.85) ? '最大の激突と転換' : '大団円と未来'),
      titleEn: productionMode === 'mv' 
        ? (i === 0 ? 'Dawn of Silence' : i === count - 1 ? 'Curtain of Light' : 'Emotional Gradient')
        : (i < Math.round(count * 0.25) ? 'Destiny Awakens' : i < Math.round(count * 0.55) ? 'Deepening Mystery' : i < Math.round(count * 0.85) ? 'Climactic Clashing' : 'Grand Finale'),
      summary: `主人公${target.name}が織りなすドラマと情景`
    }));

    return {
      seriesTitle: productionMode === 'mv' ? `${target.name} MV Project` : `${target.name}活劇録`,
      overallSynopsis: `${selectedTheme}の世界で${target.name}が仲間と共に織りなす全${count}${currentModeConfig.unit}のストーリー`,
      episodesPlan: dummyPlan
    };
  }
}
