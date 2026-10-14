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
  // 1. 小道具カット（Cut 10: 伏線アイテム）の神域マクロ処理
  if (isPropCut) {
    let propName = hint ? hint.replace(/★\s*/g, '').trim() : '';
    if (!propName) {
      if (/鍵|かぎ|合鍵|key/i.test(lyric)) propName = 'an old weathered brass key with tarnished metallic patina and rustic scratches';
      else if (/ネジ|ねじ|ボルト|銀の粒|粒|screw/i.test(lyric)) propName = 'a tiny shiny silver screw lying on the wooden floor, catching sharp light reflections';
      else if (/爪|銀の爪|指輪|リング|アクセサリー/i.test(lyric)) propName = 'a delicate silver ring or accessory with subtle metallic gleam';
      else if (/ダンボール|段ボール|箱|荷造り|box/i.test(lyric)) propName = 'a small open cardboard box containing nostalgic forgotten memories';
      else if (/時計|針|秒針/i.test(lyric)) propName = 'a vintage ticking wristwatch with worn leather strap resting quietly';
      else if (/手紙|写真|ノート|便箋/i.test(lyric)) propName = 'a faded handwritten letter and a vintage polaroid snapshot';
      else propName = 'a solitary symbolic metallic keepsake object';
    }
    return `[STRICT STILL-LIFE INSERT]: Extreme close-up macro product still-life photography of the key symbolic prop (${propName}), resting on a weathered wooden surface, completely deserted scene with strictly NO humans, shallow depth of field, dramatic dust motes floating in sunbeam, crisp metallic textures and reflections.`;
  }

  // 2. 歌詞（セリフ）の解析
  const cleanLyric = (lyric || '').trim();
  const isInstrumental = !cleanLyric || cleanLyric.startsWith('♪') || /^\(.*\)$/.test(cleanLyric);

  const detectedMotifs: string[] = [];

  // (A) 小道具・キーオブジェクト
  if (/鍵|かぎ|合鍵/i.test(cleanLyric)) detectedMotifs.push("holding an old weathered brass key with rusted metallic sheen");
  if (/ネジ|ねじ|銀の粒|粒/i.test(cleanLyric)) detectedMotifs.push("a tiny shiny silver screw lying on the floor in the corner of the room catching the light");
  if (/ダンボール|段ボール|箱|荷造り|荷物/i.test(cleanLyric)) detectedMotifs.push("tall stacks of brown cardboard moving boxes sealed with packing tape");
  if (/爪|銀の爪|指輪|リング/i.test(cleanLyric)) detectedMotifs.push("delicate silver accessory with subtle metallic glimmer");
  if (/傘|ビニール傘|雨傘/i.test(cleanLyric)) detectedMotifs.push("a clear transparent umbrella glistening with water droplets");
  if (/窓|カーテン/i.test(cleanLyric)) detectedMotifs.push("a large window with sheer white curtains fluttering gently in the breeze");
  if (/扉|ドア|開かない/i.test(cleanLyric)) detectedMotifs.push("a closed vintage wooden door with antique brass doorknob");
  if (/手紙|便箋|写真|ノート|日記/i.test(cleanLyric)) detectedMotifs.push("an open handwritten notebook and nostalgic polaroid photo");
  if (/靴|スニーカー|足元|足音/i.test(cleanLyric)) detectedMotifs.push("close-up of worn shoes on the bare wooden floorboards");

  // (B) 身体部位・仕草・身体感覚
  if (/右手|左手|手元|手のひら|指先|指/i.test(cleanLyric)) {
    if (/錆び|艶/i.test(cleanLyric)) {
      detectedMotifs.push("extreme intimate focus on character's hand with rusted metallic patina residue on fingertips, subtle emotional trembling");
    } else {
      detectedMotifs.push("intimate close-up on character's hand and fingers, delicate emotional gesture");
    }
  }
  if (/影|伸びる影/i.test(cleanLyric)) detectedMotifs.push("dramatic elongated shadows stretching across the bare wooden floor");
  if (/床|冷たい床|座る|しゃがむ/i.test(cleanLyric)) {
    if (cutIndex === 2 || cutIndex === 9) {
      detectedMotifs.push("character sitting or crouching quietly on the cold hardwood floor");
    } else {
      detectedMotifs.push("character standing tall on the hardwood floor, looking across the spacious room");
    }
  }
  if (/振り返る|後ろ姿|背中/i.test(cleanLyric)) detectedMotifs.push("character seen from behind or three-quarter profile, pausing in contemplation");
  if (/歩く|歩き出|進む/i.test(cleanLyric)) detectedMotifs.push("character taking a resolute forward step towards the light");
  if (/瞳|目|見つめ|見上げる/i.test(cleanLyric)) detectedMotifs.push("contemplative introspective gaze, looking down quietly in deep thought");
  if (/冷たい|冷たさ/i.test(cleanLyric)) detectedMotifs.push("cold atmospheric lighting, subtle melancholic chill in the room");
  if (/べたつ|音/i.test(cleanLyric)) detectedMotifs.push("quiet solitary indoor setting with rich tactile ambiance");

  // (C) 天候・光・時間帯・環境
  if (/風|そよ風|駆け抜け/i.test(cleanLyric)) detectedMotifs.push("gentle wind drifting into the room, swaying hair and fabrics");
  if (/夕|日暮れ|日が落ちる|茜色|黄昏|夕暮れ/i.test(cleanLyric)) detectedMotifs.push("intense golden hour sunset light streaming horizontally across the room, warm amber tones");
  if (/朝|朝日|夜明け|日差し|光/i.test(cleanLyric)) detectedMotifs.push("brilliant morning sunbeams piercing through the haze, radiant dust motes");
  if (/夜|星|月|暗/i.test(cleanLyric)) detectedMotifs.push("deep twilight dusk, cool indigo ambient tones with distant city night lights");
  if (/雨|濡れ|水たまり/i.test(cleanLyric)) detectedMotifs.push("rain streaks washing down the glass window, moody reflective surfaces");
  if (/空間|部屋|何もない|広くなった/i.test(cleanLyric)) detectedMotifs.push("vast spacious empty room with clean hardwood floors and bare walls");

  // (D) カット別の映画的ストーリーテリング構成（YouTube Shortsアルゴリズム攻略・神域設計）
  let defaultCutAction = '';
  switch (cutIndex) {
    case 1:
      // ★ 批評家絶賛フック: 冒頭0.5秒スワイプキラー（引きの風景を排除し、息を呑む極限の感情接写）
      defaultCutAction = 'Arresting cinematic extreme close-up visual hook on character\'s intense emotional eyes and face, dramatic directional lighting highlighting sparkling iris reflections, subtle whispering gesture with finger touching parted lip, arresting gaze directly captivating the viewer, shallow depth of field, instant swipe-stopping impact';
      break;
    case 2:
      defaultCutAction = 'Downward medium angle, protagonist crouching down or seated on the wooden floor beside stacked brown cardboard moving boxes, long cast shadows, packing belongings';
      break;
    case 3:
      defaultCutAction = 'Extreme close-up macro framing purely on character\'s hands applying packing tape to a cardboard box or touching personal belongings, tactile texture, intimate focus';
      break;
    case 4:
      // ★ 一時停止トラップ（考察フック）: 画面の隅に謎めいた走り書きメモや未送信画面の微細な違和感を仕込む
      defaultCutAction = 'Dutch-tilt medium shot, protagonist pausing amidst the spacious room with an enigmatic contemplative gaze; in the foreground on a surface lies a mysterious handwritten memo or subtle smartphone screen clue inviting the viewer to pause and scrutinize';
      break;
    case 5:
      defaultCutAction = 'Dynamic wide chorus opening shot, emotional wind billowing curtains and hair, radiant sunlight streaming through, stepping forward into the open space';
      break;
    case 6:
      defaultCutAction = 'Emotional medium close-up bust portrait, character bathed in warm golden sunset illumination from the side, contemplative atmosphere and quiet catharsis';
      break;
    case 7:
      defaultCutAction = "Intense close-up focusing purely on the character's hands and fingertips holding an old key or touching a surface, intimate emotional gesture, shallow depth of field";
      break;
    case 8:
      defaultCutAction = 'Cinematic wide climax, protagonist walking forward through the glowing hallway, seen from behind or three-quarter view, bathed in dramatic illumination, resolute forward motion';
    case 9:
      // ★ 考察回収フック: 物語の真相に関わる小さな遺留品を発見する驚きの構図
      defaultCutAction = 'Low angle dramatic discovery shot, protagonist looking down towards a shadowed floor corner, uncovering a tiny gleaming keepsake or fateful clue object, high contrast lighting sparking curiosity';
      break;
    case 11:
      defaultCutAction = 'Heroic medium close-up, protagonist with hand resting on the antique door handle, looking towards the open exit with calm resolve and hope, ready to depart';
      break;
    case 12:
      // ★ 不在の余韻 ＆ 無限ループ構造: 主人公が消え去り、静寂の空間とキーアイテムだけが残り、Cut 1へと滑らかにループ回帰する
      defaultCutAction = 'Cinematic crane-up pull-out wide shot of the deserted quiet room, protagonist has completely disappeared leaving a poignant emotional void, only the fateful key keepsake resting quietly on the surface in a single sunbeam, seamless circular composition naturally looping back into Cut 1';
      break;
    default:
      defaultCutAction = 'Cinematic framing matching the music video narrative';
      break;
  }

  const baseTheme = hint ? hint.replace(/★\s*/g, '').trim() : theme;
  const visualMotifsText = detectedMotifs.length > 0 ? detectedMotifs.join(', ') : '';

  if (isInstrumental || !visualMotifsText) {
    // 歌詞がない、または抽象的な場合：「なければ生成」でカットごとのドラマアクションとテーマを結合
    return `${defaultCutAction}, set in ${baseTheme}. Atmospheric cinematic depth, natural lighting.`;
  }

  // 歌詞がある場合：「あればそれを意識する」で歌詞モチーフを主役に据えた構図を構築
  return `Scene visually embodying lyric "${cleanLyric}": ${visualMotifsText}. ${defaultCutAction}, set in ${baseTheme}.`;
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
      `Masterpiece, high production music video, authentic ${masterCat.pool.visual_contract.style_preset},`,
    ];

    // キャストDNAおよび表情のインポート（カット10の小道具・カット12の余韻を除く人物カット）
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
      promptEnComponents.push(`[SCENE]: ${track.scene_context.trim().replace(/\.+$/, '')}.`);
    }

    // 登場人物詳細（character_setting）の注入（小道具特写Cut10および余韻Cut12を除く人物カット）
    if (track.character_setting && !isPropCut && i !== 12) {
      promptEnComponents.push(`[CHARACTER]: ${track.character_setting.trim().replace(/\.+$/, '')}.`);
    }

    // 五感・小道具ディテール（sensory_details）の注入（小道具Cut10や手元接写Cut）
    if (track.sensory_details && (isPropCut || i === 1 || i === 3 || i === 7 || i === 10)) {
      promptEnComponents.push(`[TACTILE DETAILS]: ${track.sensory_details.trim().replace(/\.+$/, '')}.`);
    }

    promptEnComponents.push(visualPlot);
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
