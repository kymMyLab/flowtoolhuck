import { Episode, Cut, ProductionMode, CastCharacter } from '../types';
import { extractHighlights } from './directorService';
import { resolveMasterCategory } from '../config/masterCategories';
import { CAMERA_WORK_REGISTRY } from '../constants';
import { isCutSelectedForVideo } from './utils';

export interface ImportedTrack {
  id: string;
  track_id?: string;
  track_no?: number;
  title: string;
  format?: string;
  track_type?: string;
  pool_code?: number;
  style_code?: number;
  taste?: string;
  taste_name?: string;
  taste_reason?: string;
  bpm?: number;
  surface_theme?: string;
  hidden_drama?: string;
  visual_hints?: string;
  scene_context?: string;
  character_setting?: string;
  sensory_details?: string;
  chorus_start_sec?: number;
  chorus_end_sec?: number;
  chorus_duration_sec?: number;
  chorus_start_ms?: number;
  chorus_end_ms?: number;
  chorus_lyrics?: string;
  input_lyrics?: string;
  lyrics_kanji?: string;
  audio_filename?: string;
  wav_url?: string;
  cover_url?: string;
  [key: string]: any;
}

/**
 * CT198のプレーンテキスト形式（Title: ... / Surface-Theme: ...）をパースするフォールバックパーサー
 */
export function parseTextTracksFormat(rawText: string): ImportedTrack[] {
  const lines = rawText.split(/\r?\n/);
  const trackData: Record<string, string> = {};
  const lyricsLines: string[] = [];
  let isLyricsSection = false;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 歌詞セクション開始の判定（[Intro] や [Verse] など）
    if (/^\[([a-zA-Z0-9\s\-]+)(?:\([^\)]+\))?\]/i.test(line)) {
      isLyricsSection = true;
    }

    if (isLyricsSection) {
      lyricsLines.push(rawLine);
      continue;
    }

    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && !line.startsWith('[') && !line.startsWith('(')) {
      const rawKey = line.slice(0, colonIdx).trim().toLowerCase().replace(/[-_]/g, '');
      const val = line.slice(colonIdx + 1).trim();

      if (rawKey === 'title') trackData['title'] = val;
      else if (rawKey === 'tracknumber' || rawKey === 'trackno') trackData['track_no'] = val.replace(/[^0-9]/g, '');
      else if (rawKey === 'format') trackData['format'] = val;
      else if (rawKey === 'tracktype') trackData['track_type'] = val;
      else if (rawKey === 'surfacetheme') trackData['surface_theme'] = val;
      else if (rawKey === 'hiddendrama') trackData['hidden_drama'] = val;
      else if (rawKey === 'visualhints') trackData['visual_hints'] = val;
      else if (rawKey === 'scenecontext') trackData['scene_context'] = val;
      else if (rawKey === 'charactersetting') trackData['character_setting'] = val;
      else if (rawKey === 'sensorydetails') trackData['sensory_details'] = val;
      else if (rawKey === 'poolcode') trackData['pool_code'] = val;
      else if (rawKey === 'stylecode') trackData['style_code'] = val;
      else if (rawKey === 'taste') trackData['taste'] = val;
      else if (rawKey === 'tastename') trackData['taste_name'] = val;
      else if (rawKey === 'tastereason') trackData['taste_reason'] = val;
      else if (rawKey === 'bpm') trackData['bpm'] = val.replace(/[^0-9]/g, '');
      else if (rawKey === 'chorustime') {
        const timeMatch = val.match(/(\d+):(\d+)\s*[-〜~]\s*(\d+):(\d+)/);
        if (timeMatch) {
          const startSec = parseInt(timeMatch[1], 10) * 60 + parseInt(timeMatch[2], 10);
          const endSec = parseInt(timeMatch[3], 10) * 60 + parseInt(timeMatch[4], 10);
          trackData['chorus_start_sec'] = String(startSec);
          trackData['chorus_end_sec'] = String(endSec);
        }
      }
    }
  }

  if (!trackData['title']) {
    return [];
  }

  const poolCode = Number(trackData['pool_code']) || 20;
  const styleCode = Number(trackData['style_code']) || (poolCode + 1);
  const cStart = Number(trackData['chorus_start_sec']) || 65;
  const cEnd = Number(trackData['chorus_end_sec']) || (cStart + 30);
  const allLyrics = lyricsLines.join('\n');

  return [{
    id: `trk_${Date.now()}_1`,
    track_id: `trk_${Date.now()}_1`,
    track_no: Number(trackData['track_no']) || 1,
    title: trackData['title'] || '無題のトラック',
    format: trackData['format'] || '🎵 音楽MV (12カット)',
    track_type: trackData['track_type'] || 'Vocal',
    pool_code: poolCode,
    style_code: styleCode,
    taste: trackData['taste'] || 'youth_pop',
    taste_name: trackData['taste_name'] || '',
    taste_reason: trackData['taste_reason'] || '',
    bpm: Number(trackData['bpm']) || 125,
    surface_theme: trackData['surface_theme'] || '',
    hidden_drama: trackData['hidden_drama'] || '',
    visual_hints: trackData['visual_hints'] || '',
    scene_context: trackData['scene_context'] || '',
    character_setting: trackData['character_setting'] || '',
    sensory_details: trackData['sensory_details'] || '',
    chorus_start_sec: cStart,
    chorus_end_sec: cEnd,
    chorus_duration_sec: Math.max(1, cEnd - cStart),
    chorus_start_ms: cStart * 1000,
    chorus_end_ms: cEnd * 1000,
    chorus_lyrics: '',
    input_lyrics: allLyrics,
    lyrics_kanji: allLyrics
  }];
}

/**
 * CT198からエクスポートされたJSONテキスト（単体または配列）をパースして正規化
 * （プレーンテキスト形式の場合もフォールバック解析）
 */
export function parseMusicTracksJson(rawText: string): ImportedTrack[] {
  const cleanText = rawText.replace(/^\uFEFF/, '').trim();
  if (!cleanText) return [];

  try {
    const parsed = JSON.parse(cleanText);
    let list: any[] = [];
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.tracks)) {
        list = parsed.tracks;
      } else if (Array.isArray(parsed.songs)) {
        list = parsed.songs;
      } else if (Array.isArray(parsed.session_songs)) {
        list = parsed.session_songs;
      } else if (Array.isArray(parsed.items)) {
        list = parsed.items;
      } else if (Array.isArray(parsed.data)) {
        list = parsed.data;
      } else if (parsed.title || parsed.track_id || parsed.id) {
        list = [parsed];
      } else {
        const values = Object.values(parsed);
        if (values.length > 0 && typeof values[0] === 'object') {
          list = values;
        } else {
          list = [parsed];
        }
      }
    }

    return list.map((item, idx) => {
      const poolCode = Number(item.pool_code) || 20;
      const styleCode = Number(item.style_code) || (poolCode + 1);
      const cStart = Number(item.chorus_start_sec) || 65;
      const cEnd = Number(item.chorus_end_sec) || (cStart + 30);
      const cDur = Number(item.chorus_duration_sec) || Math.max(1, cEnd - cStart);

      return {
        id: item.id || `trk_${Date.now()}_${idx}`,
        track_id: item.track_id || item.id || `trk_${Date.now()}_${idx}`,
        track_no: Number(item.track_no) || idx + 1,
        title: item.title || '無題のトラック',
        format: item.format || '🎵 音楽MV (12カット)',
        track_type: item.track_type || 'Vocal',
        pool_code: poolCode,
        style_code: styleCode,
        taste: item.taste || 'youth_pop',
        taste_name: item.taste_name || '',
        taste_reason: item.taste_reason || '',
        bpm: Number(item.bpm) || 125,
        surface_theme: item.surface_theme || '',
        hidden_drama: item.hidden_drama || '',
        visual_hints: item.visual_hints || '',
        scene_context: item.scene_context || '',
        character_setting: item.character_setting || '',
        sensory_details: item.sensory_details || '',
        chorus_start_sec: cStart,
        chorus_end_sec: cEnd,
        chorus_duration_sec: cDur,
        chorus_start_ms: item.chorus_start_ms || Math.round(cStart * 1000),
        chorus_end_ms: item.chorus_end_ms || Math.round(cEnd * 1000),
        chorus_lyrics: item.chorus_lyrics || '',
        input_lyrics: item.input_lyrics || '',
        lyrics_kanji: item.lyrics_kanji || '',
        audio_filename: item.audio_filename || '',
        wav_url: item.wav_url || '',
        cover_url: item.cover_url || ''
      };
    });
  } catch (err: any) {
    // JSON解析に失敗した場合、テキスト形式（Key: Value）のフォールバック解析を試行
    console.warn('JSON parse failed, attempting plain text parsing fallback...', err.message);
    const fallbackTracks = parseTextTracksFormat(cleanText);
    if (fallbackTracks.length > 0) {
      console.log('✅ Successfully parsed track from plain text format!');
      return fallbackTracks;
    }
    console.error('Failed to parse music tracks JSON or plain text:', err);
    throw new Error(`JSONまたは楽曲テキストの解析に失敗しました: ${err.message}`);
  }
}

/**
 * visual_hints 文字列（例: "Cut 1-3: [...], Cut 4-9: [...], Cut 10: [★...], Cut 11-12: [...]" またはカッコなし）をカット番号（1〜12）へマッピング
 */
export function parseVisualHints(visualHintsText: string): Record<number, string> {
  const map: Record<number, string> = {};
  if (!visualHintsText) return map;

  // 1. カッコあり形式: Cut 1-3: [説明]
  // 2. カッコなし形式: Cut 1-3: 説明, Cut 4-9: 説明
  const regex = /Cut\s*(\d+)(?:\s*[-〜~]\s*(\d+))?:\s*(?:\[([^\]]+)\]|([^,;\n]+(?=[,\n]|Cut\s*\d+:|$)))/gi;
  let match;
  while ((match = regex.exec(visualHintsText)) !== null) {
    const startCut = parseInt(match[1], 10);
    const endCut = match[2] ? parseInt(match[2], 10) : startCut;
    const content = (match[3] || match[4] || '').trim();
    if (!content) continue;

    for (let c = startCut; c <= endCut && c <= 12; c++) {
      map[c] = content;
    }
  }

  return map;
}

/**
 * 歌詞テキスト（正規漢字またはひらがな）をセクションタグ [Intro], [Verse], [Chorus] ごとに分離
 */
export function parseLyricsSections(lyricsText: string): Record<string, string[]> {
  const sections: Record<string, string[]> = {};
  if (!lyricsText) return sections;

  const lines = lyricsText.split(/\r?\n/);
  let currentSection = 'intro';
  sections[currentSection] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const tagMatch = line.match(/^\[([a-zA-Z0-9\s\-]+)(?:\([^\)]+\))?\]/);
    if (tagMatch) {
      const tagLower = tagMatch[1].toLowerCase();
      if (tagLower.includes('intro')) currentSection = 'intro';
      else if (tagLower.includes('verse 1') || tagLower.includes('verse1')) currentSection = 'verse1';
      else if (tagLower.includes('pre-chorus') || tagLower.includes('prechorus')) currentSection = 'prechorus';
      else if (tagLower.includes('final chorus') || tagLower.includes('climax')) currentSection = 'final_chorus';
      else if (tagLower.includes('chorus')) currentSection = 'chorus';
      else if (tagLower.includes('verse 2') || tagLower.includes('verse2')) currentSection = 'verse2';
      else if (tagLower.includes('bridge')) currentSection = 'bridge';
      else if (tagLower.includes('outro')) currentSection = 'outro';
      else currentSection = tagLower.replace(/[^a-z0-9]/g, '_');

      if (!sections[currentSection]) sections[currentSection] = [];
    } else {
      // 歌詞本文（英語のト書き行 [Playful 8-bit...] などを除外）
      if (!line.startsWith('[') && !line.startsWith('(')) {
        if (!sections[currentSection]) sections[currentSection] = [];
        sections[currentSection].push(line);
      }
    }
  }

  return sections;
}

/**
 * 歌詞テキスト・演出ヒント・カット位置から、AI作画が1対1で呼応する具体的な情景・被写体・小道具プロンプトを錬成
 * （「あればそれを意識し、なければ楽曲世界観から自動生成補完する」FlowTool映画的演出ロジック）
 */
export function extractLyricVisualPlot(
  lyric: string,
  hint: string,
  theme: string,
  cutIndex: number,
  isPropCut: boolean
): string {
  const cleanHint = (hint || '').replace(/★\s*/g, '').trim();
  const cleanLyric = (lyric || '').trim();

  // 1. 小道具カット（Cut 10: 伏線アイテム）のマクロ静物処理
  if (isPropCut) {
    const propName = cleanHint || (cleanLyric ? `symbolic item representing "${cleanLyric}"` : 'a solitary meaningful keepsake object');
    return `[STRICT STILL-LIFE INSERT]: Extreme close-up macro product still-life photography of (${propName}), in natural environmental setting (${theme}), completely deserted scene with strictly NO humans, NO person, shallow depth of field, atmospheric cinematic lighting, crisp tactile reflections and dust motes.`;
  }

  // 2. もしCT198等の演出ヒント(visual_hints)が存在する場合、最優先でその情景・アクションを主役に据える！
  if (cleanHint) {
    const lyricRef = cleanLyric ? `embodying lyric "${cleanLyric}", ` : '';
    return `[CINEMATIC DIRECTIVE]: Scene ${lyricRef}${cleanHint}. Set within the world of "${theme}". Dynamic atmospheric depth, natural cinematic lighting, beautiful filmic color grading.`;
  }

  // 3. 演出ヒントがない場合：普遍的・映画的な12カット・ストーリーテリング構図
  let universalAction = '';
  switch (cutIndex) {
    case 1:
      universalAction = 'Arresting cinematic extreme close-up visual hook on character\'s intense emotional eyes and expressive face, dramatic directional lighting highlighting sparkling iris reflections, candid gaze, shallow depth of field, instant swipe-stopping impact';
      break;
    case 2:
      universalAction = 'Atmospheric medium shot, character natural posture within the ambient environment, long cast shadows, contemplating surroundings';
      break;
    case 3:
      universalAction = 'Intimate close-up macro framing on character\'s hand, delicate fingers touching fabric or surrounding textures, subtle emotional gesture, shallow depth of field';
      break;
    case 4:
      universalAction = 'Dutch-tilt medium angle, character pausing amidst the space with an enigmatic contemplative gaze, subtle environmental clue in foreground';
      break;
    case 5:
      universalAction = 'Dynamic wide chorus opening shot, emotional wind billowing hair and clothes, radiant sunlight streaming through, energetic forward movement into the open space';
      break;
    case 6:
      universalAction = 'Emotional medium close-up bust portrait, character bathed in warm golden sunset illumination from the side, contemplative atmosphere and quiet catharsis';
      break;
    case 7:
      universalAction = 'Intense intimate close-up focusing on subtle tactile interaction, gentle hand gesture or subtle shift in posture, emotional resonance';
      break;
    case 8:
      universalAction = 'Cinematic wide climax, character seen from behind or three-quarter profile moving forward into the glowing horizon, bathed in dramatic illumination';
    case 9:
      universalAction = 'Low angle dynamic discovery shot, character looking towards the changing scenery, high contrast lighting sparking curiosity';
      break;
    case 11:
      universalAction = 'Heroic medium close-up, character looking towards the open horizon with calm resolve and gentle smile, bathed in twilight warmth';
      break;
    case 12:
      universalAction = 'Cinematic crane-up pull-out wide shot of the expansive scenery, elongated shadows stretching into the distance, character silhouette blending into the atmospheric horizon, seamless circular loop back into beginning';
      break;
    default:
      universalAction = 'Cinematic framing matching the music video narrative';
      break;
  }

  if (!cleanLyric || cleanLyric.startsWith('♪') || /^\(.*\)$/.test(cleanLyric)) {
    return `${universalAction}, set in "${theme}". Atmospheric cinematic depth, natural lighting.`;
  }

  return `Scene visually embodying lyric "${cleanLyric}": ${universalAction}, set in "${theme}".`;
}

/**
 * CT198のインポートトラックから、FlowToolの完全な 12カット MV Episode を自動錬成
 */
export function convertTrackToEpisode(
  track: ImportedTrack, 
  videoRatio: string = '30%', 
  selectedCharacter?: CastCharacter,
  coverThemeVariant?: string,
  selectedTaste?: string
): Episode {
  const visualMap = parseVisualHints(track.visual_hints || '');
  const preferredLyrics = track.lyrics_kanji || track.input_lyrics || '';
  const lyricsSec = parseLyricsSections(preferredLyrics);

  // サビ歌詞の取得
  const chorusLines = lyricsSec['chorus'] && lyricsSec['chorus'].length > 0
    ? lyricsSec['chorus']
    : (track.chorus_lyrics ? track.chorus_lyrics.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('[') && !l.startsWith('(')) : []);

  // 12カットの歌詞配分マップ
  const cutLyricsMap: Record<number, string> = {
    1: lyricsSec['intro']?.[0] || '♪ (Intro Instrumental)',
    2: lyricsSec['verse1']?.slice(0, 2)?.join(' ') || '冷たい床に伸びる影',
    3: lyricsSec['verse1']?.slice(2, 4)?.join(' ') || 'べたつく音が響くたび',
    4: lyricsSec['prechorus']?.slice(0, 2)?.join(' ') || '広くなった空間は',
    5: chorusLines[0] || '透き通る風が駆け抜けて',
    6: chorusLines[1] || '何もない部屋に日が落ちる',
    7: chorusLines[2] || '右手に残る錆びた艶',
    8: chorusLines[3] || '開かない扉の幻を',
    9: lyricsSec['verse2']?.slice(0, 2)?.join(' ') || '隅に落ちてた銀の粒',
    10: lyricsSec['bridge']?.slice(0, 2)?.join(' ') || 'あの日置いてった銀の爪',
    11: lyricsSec['final_chorus']?.slice(0, 2)?.join(' ') || '新しい明日へ歩き出す',
    12: lyricsSec['outro']?.[0] || '♪ (Outro / Reverb Tail)'
  };

  // 3者共通グランドマスター規格 (v2.2.0)
  const masterCat = resolveMasterCategory(track.surface_theme || track.title, 'mv');

  const cuts: Cut[] = [];
  for (let i = 1; i <= 12; i++) {
    const hint = visualMap[i] || '';
    const lyric = cutLyricsMap[i] || '';
    const isChorus = i >= 5 && i <= 8;
    const isPropCut = i === 10;

    let shotScale = 'Wide';
    let cameraWork = 'static';
    let isObjectOnly = false;
    let telopStyle: any = 'mv-kinetic-pop';
    let telopTransition: any = 'gsap-kinetic-stagger';
    let telopPosition: any = 'bottom-center';

    if (i === 1) {
      // ★ アルゴリズム必勝: 冒頭0.5秒スワイプキラー（極限顔面・瞳のアップ）
      shotScale = 'Extreme Close-Up (Swipe Hook)';
      cameraWork = 'push-in-heroic';
      telopPosition = 'bottom-center';
    } else if (i === 2 || i === 3) {
      shotScale = 'Medium Close-Up';
      cameraWork = 'push-in';
    } else if (i === 4) {
      shotScale = 'Dutch Angle Medium (Clue Hook)';
      cameraWork = 'dutch-tilt';
    } else if (isChorus) {
      shotScale = i === 5 ? 'Extreme Wide' : (i === 6 ? 'Medium Dynamic' : (i === 7 ? 'Close-Up' : 'Wide Dynamic'));
      cameraWork = i % 2 === 0 ? 'cinematic-orbit' : 'dynamic-pan-zoom';
      telopPosition = 'center-stagger';
    } else if (i === 9) {
      shotScale = 'Low Angle Medium (Discovery)';
      cameraWork = 'pull-out';
    } else if (isPropCut) {
      shotScale = 'Extreme Close-Up Macro';
      cameraWork = 'macro-reveal';
      isObjectOnly = true; // ★カット10は伏線小道具確定！
      telopStyle = 'mv-neon-glow';
      telopPosition = 'bottom-center';
    } else if (i === 11) {
      shotScale = 'Heroic Close-Up';
      cameraWork = 'push-in-heroic';
      telopPosition = 'center-climax';
    } else if (i === 12) {
      // ★ 不在の余韻 ＆ 無限ループ構図
      shotScale = 'Cinematic Wide (Void Loop)';
      cameraWork = 'crane-up-fade';
      telopPosition = 'bottom-center';
    }

    const hl = extractHighlights(lyric);
    const visualPlot = extractLyricVisualPlot(lyric, hint, track.surface_theme || track.title, i, isPropCut);

    const promptEnComponents = [
      `Masterpiece, high production music video, authentic ${masterCat.pool.visual_contract.style_preset}.`,
      visualPlot,
    ];

    // キャストDNAおよび表情のインポート（キャスト固定が明示的にONのときのみ注入）
    if (selectedCharacter && !isPropCut && i !== 12) {
      let expressionPrompt = selectedCharacter.expressions?.['neutral']?.promptModifierEn?.trim() || '';
      if (i === 1) {
        expressionPrompt = selectedCharacter.expressions?.['sad']?.promptModifierEn?.trim() || selectedCharacter.expressions?.['neutral']?.promptModifierEn?.trim() || '';
      } else if (i === 4) {
        expressionPrompt = selectedCharacter.expressions?.['sad']?.promptModifierEn?.trim() || selectedCharacter.expressions?.['neutral']?.promptModifierEn?.trim() || '';
      } else if (isChorus) {
        expressionPrompt = selectedCharacter.expressions?.['happy']?.promptModifierEn?.trim() || selectedCharacter.expressions?.['neutral']?.promptModifierEn?.trim() || '';
      } else if (i === 11) {
        expressionPrompt = selectedCharacter.expressions?.['neutral']?.promptModifierEn?.trim() || selectedCharacter.expressions?.['happy']?.promptModifierEn?.trim() || '';
      }

      const cleanDna = selectedCharacter.dnaPromptEn ? selectedCharacter.dnaPromptEn.trim().replace(/\.+$/, '') : '';
      const expressionPart = expressionPrompt ? ` [EXPRESSION]: ${expressionPrompt.replace(/\.+$/, '')}.` : '';
      if (cleanDna) {
        promptEnComponents.push(`[PROTAGONIST DNA]: ${cleanDna}.${expressionPart}`);
      }
    }

    // 情景コンテキスト（scene_context）の注入
    if (track.scene_context) {
      promptEnComponents.push(`[SCENE CONTEXT]: ${track.scene_context.trim().replace(/\.+$/, '')}.`);
    }

    // 登場人物詳細（character_setting）の注入（小道具特写Cut10および余韻Cut12を除く人物カット）
    if (track.character_setting && !isPropCut && i !== 12) {
      promptEnComponents.push(`[CHARACTER SETTING]: ${track.character_setting.trim().replace(/\.+$/, '')}.`);
    }

    // 五感・小道具ディテール（sensory_details）の注入（小道具Cut10や手元接写Cut）
    if (track.sensory_details && (isPropCut || i === 1 || i === 3 || i === 7 || i === 10)) {
      promptEnComponents.push(`[TACTILE DETAILS]: ${track.sensory_details.trim().replace(/\.+$/, '')}.`);
    }

    promptEnComponents.push(
      isPropCut 
        ? `Shallow depth of field, dramatic dust motes in sunbeam, crisp macro reflections.` 
        : `Atmospheric cinematography, 8k resolution, cinematic lighting, photorealistic texture.`
    );

    const promptEn = promptEnComponents.join(' ');

    cuts.push({
      id: i,
      promptEn: promptEn,
      narrationJp: lyric,
      narrationEn: '',
      shotScale: shotScale,
      cameraWork: cameraWork,
      isObjectOnly: isObjectOnly,
      panelLayout: isPropCut ? 'single' : (isChorus ? 'diagonal-slash' : 'single'),
      focalPoint: isPropCut ? { grid: 'center', normalizedCoord: [0.5, 0.5], focalSubject: 'key_prop' } : undefined,
      duration: isChorus ? 7.5 : 5.0,
      isSelectedForVideo: isCutSelectedForVideo(i - 1, videoRatio),
      telop: {
        fullText: lyric,
        highlights: hl,
        style: telopStyle,
        transition: telopTransition,
        position: telopPosition,
        directorNote: hint ? `[CT198 Direct] ${hint}` : (isPropCut ? `[Key Prop] ${lyric}` : `[Lyric Motif] ${lyric}`)
      }
    });
  }

  const episodeId = Number(track.track_no) || 1;
  const uniqueId = `ep_mv_${Date.now()}_${track.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`;

  return {
    id: episodeId,
    internalId: uniqueId,
    titleJp: track.title,
    titleEn: track.title,
    summary: track.hidden_drama || track.surface_theme || '',
    theme: track.surface_theme || track.title,
    taste: selectedTaste || track.taste || 'youth_pop',
    isMvMode: true,
    productionMode: 'mv',
    cuts: cuts,
    isGenerating: false,
    isGeneratingRemainingImages: false,
    isBatchGeneratingVideos: false,
    isPreviewDone: false,
    isDone: false,
    coverCatchphraseJp: track.title,
    coverCatchphraseEn: track.title,
    characterDna: selectedCharacter ? selectedCharacter.dnaPromptEn : undefined,
    characterTurnaroundBase64: selectedCharacter ? (selectedCharacter.turnaroundBase64 || selectedCharacter.avatarBase64) : undefined,
    characterTurnaroundMediaId: selectedCharacter ? selectedCharacter.turnaroundMediaId : undefined,
    characterTurnaroundPrompt: selectedCharacter ? selectedCharacter.turnaroundPromptEn : undefined,
    coverThemeVariant: coverThemeVariant
  };
}
