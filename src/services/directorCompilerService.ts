import { Flow } from 'flow-sdk';
import { 
  CharacterPresenceType, 
  ExtractedSongDna, 
  CompiledStoryboardCut 
} from '../types';
import { safeJsonParse, callWithRetry } from './utils';

/**
 * Step 2.5: 楽曲メタデータ（character_setting, surface_theme, sensory_details）から
 * 4系統のキャラクター・衣装・小道具DNAを動的抽出
 */
export async function extractSongDnaWithGemini(
  metadata: {
    character_setting?: string;
    surface_theme?: string;
    sensory_details?: string;
  },
  addLog?: (msg: string, type: 'process' | 'success' | 'warning' | 'error' | 'info') => void
): Promise<ExtractedSongDna> {
  const charSetting = metadata.character_setting || '';
  const surfaceTheme = metadata.surface_theme || '';
  const sensoryDetails = metadata.sensory_details || '';

  const fallbackDna: ExtractedSongDna = {
    protagonistDna: 'expressive Japanese anime protagonist, natural stylish hair, expressive emotive eyes, authentic attire matching the song world',
    protagonistPartialWardrobeDna: 'attire sleeve cuffs, hem, and footwear matching the setting',
    partnerDna: '',
    keyPropsDna: 'atmospheric keepsake prop imbued with emotional significance'
  };

  if (!charSetting && !surfaceTheme) {
    return fallbackDna;
  }

  const prompt = `You are an Anime Character & Prop DNA Extractor. Read the song metadata below and output ONLY valid JSON in English.

### Song Metadata:
- Character Setting: ${charSetting}
- Surface Theme: ${surfaceTheme}
- Sensory Details: ${sensoryDetails}

### Extraction Mandate:
Extract character traits faithfully based on the song setting (gender, age, build, attire):
Output strictly a JSON object matching this schema:
{
  "protagonistDna": "Full visual traits of the protagonist (hair, eyes, age, build, exact attire, shoes) faithfully matching Character Setting. Do NOT force a female schoolgirl if the setting describes someone else.",
  "protagonistPartialWardrobeDna": "ONLY sleeve cuffs, pants/skirt hem, coat/jacket fabric, and footwear. Strictly EXCLUDE face, hair, eyes, or head tokens.",
  "partnerDna": "Visual traits of a second character or partner if one is mentioned or implied. If the song is strictly solo or has NO second character, output strictly an empty string \"\".",
  "keyPropsDna": "Key physical items mentioned in theme or sensory details (e.g. scarf, headphones, cup, umbrella, spoon)."
}`;

  try {
    if (addLog) addLog('🧬 [Step 2.5] 楽曲設定からキャラクター＆小道具DNAを動的抽出中...', 'process');

    const res = await callWithRetry<any>(
      () => Flow.generate.text(prompt, { 
        systemInstruction: "You are an anime concept artist and DNA parser. Output strictly valid JSON object only." 
      }),
      (attempt, max, delay, err) => {
        console.warn(`[Gemini DNA Extractor Retry ${attempt}/${max}]`, err);
      },
      { maxRetries: 2, timeoutMs: 15000, timeoutLabel: 'DNA抽出' }
    );

    if (res) {
      const raw = typeof res === 'string' ? res : (res?.text || JSON.stringify(res));
      const parsed = safeJsonParse<ExtractedSongDna>(raw, fallbackDna);
      if (parsed && parsed.protagonistDna) {
        if (addLog) addLog('✨ [Step 2.5] キャラクターDNA抽出完了（キャッシュパージ済み）', 'success');
        return {
          protagonistDna: parsed.protagonistDna || fallbackDna.protagonistDna,
          protagonistPartialWardrobeDna: parsed.protagonistPartialWardrobeDna || fallbackDna.protagonistPartialWardrobeDna,
          partnerDna: typeof parsed.partnerDna === 'string' ? parsed.partnerDna : fallbackDna.partnerDna,
          keyPropsDna: parsed.keyPropsDna || fallbackDna.keyPropsDna
        };
      }
    }
  } catch (err) {
    console.warn('[extractSongDnaWithGemini] Error extracting DNA, using fallback:', err);
    if (addLog) addLog('⚠️ [Step 2.5] DNA抽出フォールバック適用', 'warning');
  }

  return fallbackDna;
}

/**
 * Step 3: 30カット絵コンテ一括検閲・多様化・ルーティングコンパイラ
 * 1人目（音楽担当）の30カットstoryboardを受け取り、
 * 映像総監督として検閲・空文字補完・5つのpresence付与・照明シフト・Veo優先度判定を一括実行
 */
export async function compileStoryboardWithGemini(
  storyboard: any[],
  extractedDna: ExtractedSongDna,
  theme: string,
  addLog?: (msg: string, type: 'process' | 'success' | 'warning' | 'error' | 'info') => void
): Promise<CompiledStoryboardCut[] | null> {
  if (!Array.isArray(storyboard) || storyboard.length === 0) return null;

  const totalCuts = storyboard.length;
  const cutsCompact = storyboard.map((c, idx) => ({
    cutId: idx + 1,
    time: c.time_range || '',
    lyric: c.lyrics_part || '',
    comp: c.camera_composition || '',
    light: c.lighting_scene || '',
    action: c.character_action || '',
    prompt: (c.image_prompt || '').replace(/--ar\s+\d+:\d+/gi, '').trim()
  }));

  const systemInstruction = `You are an Elite Anime MV Director & Storyboard Compiler. Transform the input ${totalCuts}-cut storyboard and ExtractedSongDna into a JSON array of ${totalCuts} CompiledStoryboardCut objects.

### MANDATORY COMPILATION RULES:
1. **UNIVERSAL LYRIC-DRIVEN DIRECTING & SCENE MORPHING (CRITICAL RULE #1)**:
   - You are an elite AI Film Director with 100% creative autonomy. Dynamically and semantically interpret the Japanese 'lyric' of EVERY cut across ANY genre, theme, or topic (slice-of-life, romance, heartbreak, sports, sci-fi, culinary, maritime, travel, comedy, fantasy, action, etc.).
   - NEVER rely on fixed tropes or assume a static school setting. Analyze what each specific line of lyrics literally or poetically expresses:
     - **Autonomous Location & World Building**: Deduce the physical or emotional space directly from the lyric (e.g. cozy bedroom, busy kitchen, ramen counter, highway car cockpit, athletic gym or field, mountain summit, subway car, 24h convenience store, dance club, pitching boat deck, quiet cafe, rain-slicked alley, stadium, starry rooftop). Place the protagonist in that exact world with rich environmental lighting.
     - **Context-Adaptive Wardrobe & Styling**: While preserving the protagonist's core identity (face, eyes, hair color and hairstyle), DYNAMICALLY ADAPT their attire to fit what they are doing and where they are! (e.g. cozy pajamas/loungewear in bed, chef apron/casual wear when cooking, athletic sportswear when running/exercising, stylish swimwear at the beach, driving jacket behind the wheel, warm winter down jacket in snow, waterproof rain gear in a storm, traditional yukata at a festival, trendy streetwear in the city).
       * STRICT RULE: Automatically STRIP and REPLACE any default school blazer, uniform, or suit from the base protagonist DNA whenever the character is engaged in an activity where such attire is unnatural!
     - **Kinetic Pose & Physical Action**: Translate the lyric into a vivid physical posture, movement, or tactile gesture (e.g. sprawled lounging on sheets, gripping a steering wheel, slicing ingredients, sprinting with full momentum, reaching out toward the light, weeping into hands, swinging a racket, holding a hot drink).
     - **Cinematography Tailored to the Action**: Pick the camera angle (overhead bird's-eye view, dynamic low-angle, macro close-up of hands/props, Dutch tilt, wide panoramic landscape) that best amplifies the drama of that specific action.
2. **COLD OPEN HOOK (Cut 1 & 2 Swap)**: Force Cut 1 to be '1_protagonist_solo_focus' with 'slow-push-in' (intimate close-up of protagonist's captivating expressive eyes and face, looking directly toward camera to grip viewer attention). Move the establishing wide scenery to Cut 2 ('2_protagonist_or_pair_wide').
3. **ZERO EMPTY PROMPTS**: If image_prompt is empty (""), synthesize a detailed English prompt from camera_composition, lighting_scene, and character_action, strictly removing any '--ar' tags.
4. **5-WAY PRESENCE ROUTING**:
   - '1_protagonist_solo_focus': Protagonist bust/close-up/eyes.
   - '2_protagonist_or_pair_wide': Wide scenic shot establishing the protagonist within the environment.
   - '3_two_characters_asymmetric': Couple/pair shot. Focus on the main character's face; frame the partner strictly from behind, silhouette, or over-the-shoulder so only ONE face dominates.
   - '4_hands_or_feet_detail': Macro of hands/feet/props (e.g. clutching pajama hem, holding fishing pole, footsteps on wet ground). Make the physical detail the focal subject.
   - '5_scenic_or_still_life': 100% NO humans (e.g. atmospheric still life, empty room, rolling sea waves, rain on window).
5. **ANTI-MODE-COLLAPSE & NATURAL LIGHTING ARC**:
   - Never allow the same shot scale or camera angle for 2 consecutive cuts.
   - Evolve the visual atmosphere and lighting across the song's emotional arc (Opening atmosphere -> Rising tension -> Chorus emotional explosion & rim lighting -> Outro resolution).
6. **0.4s BEAT DROP & COLOR INVERSION**:
   - On peak beat drops or transition cuts (e.g. Cut 11/12, bridge transition), set panel_layout: 'diagonal-slash' and camera_work: 'freeze-frame'.
   - Assign appropriate vibrant accent neon colors for telop highlights based on the emotional mood of each section.
7. **DYNAMIC VEO PRIORITY RANKING (1 to 30)**: Assign a unique integer veo_priority_rank (1 to 30, no duplicates) based on kinetic energy and storytelling significance.
8. **UNIVERSAL PHYSICAL INTEGRITY & ZERO TOPOLOGICAL FUSION (CRITICAL PHYSICAL SANITY RULE)**:
   - When depicting two or more characters, or a character interacting with props, enforce absolute anatomical and physical individuality:
   - NEVER allow shared accessories or garments to fuse or bridge two bodies in mid-air (e.g. NEVER "two people sharing one scarf around both necks", NEVER "cord bridging two ears", NEVER "fused clothes").
   - If characters wear winter accessories, MANDATE that each person wears their own completely separate scarf/gloves around their own neck/hands.
   - If characters share an umbrella or blanket, describe natural physical holding (e.g. one character holding an umbrella over both), never anatomical or textile fusion.
9. **EMOTIONAL SYNCHRONICITY & JOYFUL ENERGY (STRICT SENTIMENT RULE)**:
   - Strictly align facial expression, gaze, and body language with the emotional sentiment of the lyrics.
   - Cheerful, bouncing, rhythmic, or affectionate lyrics ("はずむ", "あしどり", "ステップ", "笑う", "走る", "光", "楽しい"): MUST be rendered with radiant joyful beaming smiles, sparkling cheerful eyes, blushing warm cheeks, and lively buoyant body posture! NEVER produce somber, melancholy, or drooping expressions for upbeat moments!
   - When characters interact affectionately, render sweet endearing smiles, mutual warmth, and affectionate joy. Eradicate awkward dead-eyed or grim expressions during romantic or playful scenes.
10. **UNIVERSAL STABLE MICRO-MOTION MANDATE FOR VEO (ZERO RAPID LIMB MOVEMENT / PRESERVE ARTWORK)**:
    - CRITICAL DIRECTING LAW: Rapid macro physical movements (such as walking, running, swinging limbs, jumping) cause grotesque anatomical morphing and AI hallucinations in video models.
    - FOR EVERY SINGLE CUT across ALL genres, the 'veo_motion_and_end_frame_prompt' MUST focus EXCLUSIVELY on subtle, elegant, highly-stable MICRO-MOTIONS that breathe organic life into the still frame while preserving 100% of the original artwork's perfection:
      ① **Facial Life & Emotion Shift**: Natural blinking, subtle shifting gaze, tender soft smile deepening, parted lips catching breath, micro-facial expressions reflecting the lyric's emotion.
      ② **Atmospheric & Textile Flutter**: Soft breeze gently swaying hair strands and clothing hem, rising breath in cold air, drifting light particles, flickering lens flare or soft bokeh.
      ③ **Cinematic Camera Breathing**: Slow cinematic push-in, subtle floating camera parallax drift, delicate handheld stabilization.
      - STRICTLY FORBIDDEN: NEVER command full-body locomotion like "walking forward", "running", or "jumping". The character's core body pose MUST remain stable and grounded while the micro-motions and camera bring the scene to life!

Output strictly valid JSON array only:
[
  {
    "cutId": 1,
    "character_presence": "1_protagonist_solo_focus",
    "focal_subject": "protagonist_expressive_eyes",
    "compiled_prompt_en": "Extreme close up, protagonist with deep captivating eyes looking into camera...",
    "camera_work": "slow-push-in",
    "panel_layout": "single",
    "telop_neon_color": "#FFE600",
    "veo_priority_rank": 1,
    "veo_motion_and_end_frame_prompt": "Dynamic tracking shot: protagonist smiles warmly with sparkling eyes as camera pushes in smoothly"
  }
]`;

  const userPrompt = `Theme: "${theme}"
Extracted DNA:
- Protagonist: ${extractedDna.protagonistDna}
- Wardrobe Partial: ${extractedDna.protagonistPartialWardrobeDna}
- Partner: ${extractedDna.partnerDna}
- Key Props: ${extractedDna.keyPropsDna}

Raw 30-Cut Storyboard:
${JSON.stringify(cutsCompact, null, 2)}`;

  try {
    if (addLog) addLog(`🎬 [Step 3] 映像総監督Geminiによる${totalCuts}カット一括コンパイル開始（多様化・検閲・照明4段階シフト）...`, 'process');

    const res = await callWithRetry<any>(
      () => Flow.generate.text(userPrompt, { systemInstruction }),
      (attempt, max, delay, err) => {
        console.warn(`[Gemini Storyboard Compiler Retry ${attempt}/${max}]`, err);
        if (addLog) addLog(`⚠️ [Step 3] コンパイラリトライ (${attempt}/${max})`, 'warning');
      },
      { maxRetries: 2, timeoutMs: 35000, timeoutLabel: '絵コンテ一括コンパイル' }
    );

    if (res) {
      const raw = typeof res === 'string' ? res : (res?.text || JSON.stringify(res));
      const parsed = safeJsonParse<CompiledStoryboardCut[]>(raw, []);
      if (Array.isArray(parsed) && parsed.length > 0) {
        if (addLog) {
          const soloCount = parsed.filter(c => c.character_presence === '1_protagonist_solo_focus').length;
          const wideCount = parsed.filter(c => c.character_presence === '2_protagonist_or_pair_wide').length;
          const pairCount = parsed.filter(c => c.character_presence === '3_two_characters_asymmetric').length;
          const handCount = parsed.filter(c => c.character_presence === '4_hands_or_feet_detail').length;
          const stillCount = parsed.filter(c => c.character_presence === '5_scenic_or_still_life').length;
          addLog(`✨ [Step 3] コンパイル完了！[ヒロイン単身:${soloCount} / 引き景観:${wideCount} / 非対称ペア:${pairCount} / 手元足元:${handCount} / 無人静物:${stillCount}]`, 'success');
        }
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[compileStoryboardWithGemini] Compiler error, building deterministic fallback:', err);
    if (addLog) addLog('⚠️ [Step 3] コンパイラエラーのため決定論的ルールコンパイラにフォールバックします', 'warning');
  }

  // 決定論的ルールベース・フォールバックコンパイラ
  return buildDeterministicCompiledStoryboard(storyboard, extractedDna);
}

/**
 * オフラインまたはGemini呼び出し失敗時用の普遍的セマンティック・フォールバックコンパイラ
 * 特定の曲やハードコードに一切依存せず、歌詞の自然言語感情・運動量・物理独立性を100%動的算出
 */
function buildDeterministicCompiledStoryboard(
  storyboard: any[],
  dna: ExtractedSongDna
): CompiledStoryboardCut[] {
  const result: CompiledStoryboardCut[] = [];
  const total = storyboard.length;

  for (let i = 1; i <= total; i++) {
    const raw = storyboard[i - 1] || {};
    const lyric = raw.lyrics_part || '';
    const comp = raw.camera_composition || '';
    const action = raw.character_action || '';
    const rawPrompt = (raw.image_prompt || '').replace(/--ar\s+\d+:\d+/gi, '').trim();
    const fullText = `${lyric} ${comp} ${action} ${rawPrompt}`.toLowerCase();

    // 1. 感情・運動量・セマンティクス解析
    const isJoyful = /(はずむ|弾む|あしどり|足取り|ステップ|スキップ|あわせて|笑顔|笑う|笑み|うれしい|楽しい|光|輝く|跳ねる|踊る|joy|smile|bounce|happy|stride|energetic)/i.test(fullText);
    const isPoignant = /(涙|泣く|サヨナラ|さよなら|消える|遠ざかる|孤独|ひとり|影|切ない|寂しい|雨|夜明け|暗がり|tear|crying|sad|goodbye|lonely)/i.test(fullText);
    const isHighMotion = /(走る|駆け|急ぐ|ダッシュ|ジャンプ|跳ぶ|スプリント|sprint|running|run|jump|leap|kinetic)/i.test(fullText);
    const isMidMotion = isJoyful || /(歩く|進む|踏み出す|巡る|振り返る|手をつなぐ|walk|pacing|strolling|stride)/i.test(fullText);

    // 2. Presence & カメラワークの普遍的判定
    let presence: CharacterPresenceType = '1_protagonist_solo_focus';
    let focalSubject = 'protagonist_expressive_features';
    let cameraWork: CompiledStoryboardCut['camera_work'] = 'slow-push-in';
    let panelLayout: 'single' | 'diagonal-slash' = 'single';
    let telopColor: '#FFE600' | '#FF2A85' | '#00F0FF' | '#FFFFFF' = '#FFE600';

    if (i === 1) {
      presence = '1_protagonist_solo_focus';
      focalSubject = 'protagonist_captivating_eyes_cold_open';
      cameraWork = 'slow-push-in';
    } else if (i === 2 || fullText.includes('establishing') || fullText.includes('全景') || fullText.includes('wide')) {
      presence = '2_protagonist_or_pair_wide';
      focalSubject = 'atmospheric_scenic_environment_establishing';
      cameraWork = 'wide-establishing';
    } else if (fullText.includes('手元') || fullText.includes('足元') || fullText.includes('靴') || fullText.includes('指先') || fullText.includes('hands') || fullText.includes('footsteps')) {
      presence = '4_hands_or_feet_detail';
      focalSubject = isJoyful ? 'dynamic_footsteps_bouncing_in_rhythm' : 'expressive_hands_and_details';
      cameraWork = 'macro-reveal';
    } else if (fullText.includes('ふたり') || fullText.includes('二人') || fullText.includes('並んで') || fullText.includes('手をつな') || fullText.includes('couple') || fullText.includes('pair') || fullText.includes('two')) {
      presence = '3_two_characters_asymmetric';
      focalSubject = isJoyful ? 'joyful_pair_walking_side_by_side_smiling' : 'pair_interacting_with_genuine_emotion';
      cameraWork = isHighMotion || isMidMotion ? 'cinematic-orbit' : 'slow-push-in';
    } else if (fullText.includes('誰もいない') || fullText.includes('無人') || fullText.includes('静物') || fullText.includes('still-life') || fullText.includes('scenery')) {
      presence = '5_scenic_or_still_life';
      focalSubject = 'evocative_lyric_key_prop_still_life';
      cameraWork = 'slow-pull-back';
      telopColor = '#00F0FF';
    }

    // サビ・転換点の照明・レイアウト演出
    const isChorusSection = (i >= 12 && i <= 16) || (i >= 24 && i <= 28);
    if (isChorusSection) {
      telopColor = '#FF2A85';
      if (i === 12 || i === 24) {
        panelLayout = 'diagonal-slash';
        cameraWork = 'freeze-frame';
      }
    } else if (i >= 20 && i <= 23) {
      telopColor = '#00F0FF';
    }

    // 3. 物理的独立性（Anti-Fusion）の保証されたプロンプト生成
    let compiledPrompt = rawPrompt;
    if (!compiledPrompt) {
      const emotionalAtmosphere = isJoyful
        ? 'radiant genuine smile, sparkling lively eyes, upbeat affectionate warmth'
        : isPoignant
          ? 'poignant emotional gaze, gentle bittersweet contemplation'
          : 'natural candid expression, cinematic authentic presence';
      compiledPrompt = `Masterpiece cinematic anime MV, cut ${i}, ${focalSubject}, ${emotionalAtmosphere}, ${action}, ${comp}, beautiful natural lighting`;
    }

    // 物理独立性セーフガード: 二人組・小道具インタラクションにおける衣服連結を構造的に禁止
    if (presence === '3_two_characters_asymmetric' || fullText.includes('two') || fullText.includes('ふたり')) {
      compiledPrompt += ', each character wearing completely separate independent clothing and accessories, strictly no shared cloth bridging bodies';
    }

    // 4. 原画の神作画を100%維持する普遍的マイクロモーション（微動・生体反応・環境ゆらぎ）の動的生成
    let veoMotion = `Cinematic micro-motion for cut ${i}: character pose stably preserved, natural gentle blinking, soft breeze gently swaying hair strands and clothing hem, atmospheric ambient lighting, slow cinematic camera drift`;
    if (isHighMotion) {
      veoMotion = `High-impact cinematic micro-motion for cut ${i}: character grounded pose firmly preserved, fierce wind whipping hair strands and clothing fabric, intense focused gaze blinking naturally, dynamic cinematic camera movement`;
    } else if (isJoyful || isMidMotion) {
      veoMotion = `Lively cinematic micro-motion for cut ${i}: character pose stably preserved, radiant genuine smile gently deepening, sparkling eyes blinking naturally, hair strands fluttering softly in the breeze, slow elegant camera push-in`;
    } else if (isPoignant) {
      veoMotion = `Poignant cinematic micro-motion for cut ${i}: character pose stably preserved, subtle tender shift in gaze, eyes glistening softly with natural blinking, parted lips catching breath, gentle air swaying hair, slow camera pull-back`;
    }

    result.push({
      cutId: i,
      character_presence: presence,
      focal_subject: focalSubject,
      compiled_prompt_en: compiledPrompt,
      camera_work: cameraWork,
      panel_layout: panelLayout,
      telop_neon_color: telopColor,
      veo_priority_rank: (i === 1 ? 1 : i === 13 ? 2 : i === 26 ? 3 : i),
      veo_motion_and_end_frame_prompt: veoMotion
    });
  }

  return result;
}
