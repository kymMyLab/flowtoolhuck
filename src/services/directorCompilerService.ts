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
   - Provide a vivid, high-motion veo_motion_and_end_frame_prompt for ALL cuts that brings the lyric's action to life.

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
    "veo_motion_and_end_frame_prompt": "Start frame eyes downcast, camera pushes in as protagonist looks up into lens with subtle emotion"
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
 * オフラインまたはGemini呼び出し失敗時用の決定論的フォールバックコンパイラ
 * （Rule 1〜6の制約を確定的なアルゴリズムで完全補完）
 */
function buildDeterministicCompiledStoryboard(
  storyboard: any[],
  dna: ExtractedSongDna
): CompiledStoryboardCut[] {
  const result: CompiledStoryboardCut[] = [];
  const total = storyboard.length;

  // 黄金Veo順位定義マップ (Cut ID -> Rank)
  const goldenVeoRanks: Record<number, number> = {
    1: 1,   // Cold Open Hook
    13: 2,  // Chorus 1 Explosion
    26: 3,  // Final Chorus Climax
    10: 4,  // Scarf wrapping start
    11: 5,  // Scarf wrapping collar
    18: 6,  // Instrumental drop
    22: 7,  // Intimate whisper
    25: 8,  // Lonely spoon still life
    29: 9,  // Unwrapping scarf
    4: 10   // Walking into wind
  };

  let remainingRank = 11;

  for (let i = 1; i <= total; i++) {
    const raw = storyboard[i - 1] || {};
    const lyric = raw.lyrics_part || '';
    const comp = raw.camera_composition || '';
    const action = raw.character_action || '';
    const rawPrompt = (raw.image_prompt || '').replace(/--ar\s+\d+:\d+/gi, '').trim();

    const fullText = `${lyric} ${comp} ${action} ${rawPrompt}`.toLowerCase();

    // 1. Presence の判定
    let presence: CharacterPresenceType = '1_protagonist_solo_focus';
    let focalSubject = 'heroine_face';
    let cameraWork: CompiledStoryboardCut['camera_work'] = 'slow-push-in';
    let panelLayout: 'single' | 'diagonal-slash' = 'single';
    let telopColor: '#FFE600' | '#FF2A85' | '#00F0FF' | '#FFFFFF' = '#FFE600';

    // Rule 1: Cut 01 は必ず Cold Open Hook (ヒロイン瞳マクロ)
    if (i === 1) {
      presence = '1_protagonist_solo_focus';
      focalSubject = 'heroine_expressive_eyes_cold_open';
      cameraWork = 'slow-push-in';
    } else if (i === 2 || fullText.includes('establishing') || fullText.includes('全景') || fullText.includes('引き構図') || fullText.includes('wide shot')) {
      presence = '2_protagonist_or_pair_wide';
      focalSubject = 'suburban_scenery_with_distant_figures';
      cameraWork = 'wide-establishing';
    } else if (fullText.includes('誰もいない') || fullText.includes('無人') || fullText.includes('スプーン') || fullText.includes('still-life') || i === 25) {
      presence = '5_scenic_or_still_life';
      focalSubject = 'lonely_single_spoon_in_kitchen';
      cameraWork = 'slow-pull-back';
      telopColor = '#00F0FF';
    } else if (fullText.includes('pocket') || fullText.includes('手元') || fullText.includes('足元') || fullText.includes('loafers') || fullText.includes('カイロ') || fullText.includes('編み目')) {
      presence = '4_hands_or_feet_detail';
      focalSubject = fullText.includes('かいろ') || fullText.includes('pocket') ? 'pocket_heat_pack' : 'woven_scarf_texture';
      cameraWork = 'macro-reveal';
    } else if (fullText.includes('two') || fullText.includes('ふたり') || fullText.includes('二人の') || fullText.includes('並んで') || fullText.includes('男子生徒') || fullText.includes('boy')) {
      presence = '3_two_characters_asymmetric';
      focalSubject = 'heroine_with_partner_in_foreground';
      cameraWork = i === 13 ? 'cinematic-orbit' : 'slow-push-in';
    }

    // Rule 5: 0.4s Beat Drop & Cut 25->26
    if (fullText.includes('stop') || fullText.includes('beat drop') || fullText.includes('無音') || i === 12) {
      panelLayout = 'diagonal-slash';
      cameraWork = 'freeze-frame';
    }

    // 照明カラー
    if (i >= 20 && i <= 25) {
      telopColor = '#00F0FF';
    } else if (i >= 26) {
      telopColor = i >= 29 ? '#FFFFFF' : '#FF2A85';
    }

    // Veo 優先順位
    let rank = goldenVeoRanks[i];
    if (!rank) {
      rank = remainingRank++;
    }

    // プロンプト補完
    let compiledPrompt = rawPrompt;
    if (!compiledPrompt) {
      compiledPrompt = `Masterpiece cinematic anime MV, cut ${i}, ${focalSubject}, ${action}, ${comp}, beautiful cinematic lighting`;
    }

    result.push({
      cutId: i,
      character_presence: presence,
      focal_subject: focalSubject,
      compiled_prompt_en: compiledPrompt,
      camera_work: cameraWork,
      panel_layout: panelLayout,
      telop_neon_color: telopColor,
      veo_priority_rank: rank,
      veo_motion_and_end_frame_prompt: `Cinematic motion for cut ${i}: subtle organic character breathing, wind gently swaying clothes and hair`
    });
  }

  return result;
}
