import { Episode, Cut, ProductionMode, CastCharacter, TelopStyle, TelopTransition, TelopPosition } from '../types';
import { extractHighlights } from './directorService';
import { resolveMasterCategory } from '../config/masterCategories';
import { CAMERA_WORK_REGISTRY } from '../constants';
import { isCutSelectedForVideo } from './utils';
import { resolveTasteKey } from './tasteStorage';
import { buildDynamicAntiPreviousNegative } from './promptEngine';
import { UNIVERSAL_CINE_CYCLE, CineCameraRule } from '../config/studioDefinitions';

export interface ImportedTrack {
  id: string;
  track_id?: string;
  track_no?: number;
  total_cuts?: number;
  title: string;
  format?: string;
  track_type?: string;
  pool?: string;
  pool_code?: number;
  style?: string;
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
  sound_prompt?: string;
  chorus_start_sec?: number;
  chorus_end_sec?: number;
  chorus_duration_sec?: number;
  chorus_start_ms?: number;
  chorus_end_ms?: number;
  chorus_lyrics?: string;
  input_lyrics?: string;
  generated_lyrics?: string;
  lyrics_kanji?: string;
  audio_filename?: string;
  wav_url?: string;
  cover_url?: string;
  is_instrumental?: boolean;
  paired_vocal_track_id?: string;
  instrumental_track?: ImportedTrack;
  [key: string]: unknown;
}

/**
 * カラオケ（オフボーカル / インスト）トラックの4重判定
 * 1. style が "Audio effects"（FlowMusicのStem/オフボーカル固有シグネチャ）
 * 2. title に (Off-Vocal...), (Instrumental...), インスト, カラオケ 等が含まれる
 * 3. track_type に Instrumental が含まれる
 */
export function isKaraokeOrInstrumentalTrack(track: {
  title?: string;
  style?: string;
  track_type?: string;
}): boolean {
  const title = (track.title || '').toLowerCase();
  const style = (track.style || '').toLowerCase();
  const trackType = (track.track_type || '').toLowerCase();

  // 1. FlowMusic Stem/Off-Vocal固有シグネチャ
  if (style === 'audio effects' || style.includes('audio effects')) return true;

  // 2. タイトル文字列の包括的判定
  if (/(off-?vocal|instrumental|インスト|カラオケ|stem|伴奏)/i.test(title)) return true;

  // 3. Track-Type判定
  if (trackType.includes('instrumental') && !trackType.includes('vocal')) return true;

  return false;
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
    format: trackData['format'] || '🎵 音楽MV (30カット)',
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
 * 破損したJSON文字列から正規表現で可能な限りトラックメタデータをサルベージする救出パーサー
 */
function salvageTracksFromCorruptedText(text: string): ImportedTrack[] {
  const tracks: ImportedTrack[] = [];

  // "title": "..." パターンを走査
  const titleMatches = Array.from(text.matchAll(/"title"\s*:\s*"([^"]+)"/gi));
  if (titleMatches.length > 0) {
    for (let i = 0; i < titleMatches.length; i++) {
      const title = titleMatches[i][1].trim();
      const trackId = `trk_${Date.now()}_${i + 1}`;
      tracks.push({
        id: trackId,
        track_id: trackId,
        track_no: i + 1,
        title: title || `救出トラック ${i + 1}`,
        format: '🎵 音楽MV (30カット)',
        track_type: 'Vocal',
        pool_code: 20,
        style_code: 21,
        taste: 'youth_pop',
        bpm: 125,
        chorus_start_sec: 65,
        chorus_end_sec: 95,
        chorus_duration_sec: 30,
        chorus_start_ms: 65000,
        chorus_end_ms: 95000,
        input_lyrics: text.slice(0, 1000)
      });
    }
  }

  return tracks;
}

/**
 * CT198からエクスポートされたJSONテキスト（単体または配列）をパースして正規化
 * （破損JSONや特殊データ構造にも絶対にクラッシュしない多層フォールバック機構）
 */
export function parseMusicTracksJson(rawText: string): ImportedTrack[] {
  if (!rawText || typeof rawText !== 'string') return [];
  const cleanText = rawText.replace(/^\uFEFF/, '').trim();
  if (!cleanText) return [];

  try {
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanText);
    } catch {
      // 軽微な構文エラー（末尾カンマなど）を自動修正して再試行
      const relaxedText = cleanText.replace(/,\s*([\]}])/g, '$1');
      parsed = JSON.parse(relaxedText);
    }

    let list: unknown[] = [];
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.tracks)) {
        list = obj.tracks;
      } else if (Array.isArray(obj.songs)) {
        list = obj.songs;
      } else if (Array.isArray(obj.session_songs)) {
        list = obj.session_songs;
      } else if (Array.isArray(obj.items)) {
        list = obj.items;
      } else if (Array.isArray(obj.data)) {
        list = obj.data;
      } else if (obj.title || obj.track_id || obj.id) {
        list = [obj];
      } else {
        const values = Object.values(obj);
        if (values.length > 0 && typeof values[0] === 'object' && values[0] !== null) {
          list = values;
        } else {
          list = [obj];
        }
      }
    }

    const mapped: ImportedTrack[] = list.map((rawItem, idx) => {
      const item: Record<string, unknown> = (rawItem && typeof rawItem === 'object') ? (rawItem as Record<string, unknown>) : {};

      const numVal = (v: unknown, fallback: number): number => {
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
      };

      const strVal = (v: unknown, fallback: string = ''): string => {
        if (v === null || v === undefined) return fallback;
        return String(v).trim();
      };

      const poolCode = numVal(item.pool_code, 20);
      const styleCode = numVal(item.style_code, poolCode + 1);
      const cStart = numVal(item.chorus_start_sec, 65);
      const cEnd = numVal(item.chorus_end_sec, cStart + 30);
      const cDur = numVal(item.chorus_duration_sec, Math.max(1, cEnd - cStart));

      const title = strVal(item.title) || `トラック ${idx + 1}`;
      const trackId = strVal(item.track_id || item.id) || `trk_${Date.now()}_${idx + 1}`;

      const formatStr = strVal(item.format, '🎵 音楽MV (30カット)');

      // フォーマットに応じたカット数の自動判定 (MV: 30, Shorts/雑学: 12, ドラマ/マンガ: 24)
      let defaultCuts = 30;
      const lowerFormat = formatStr.toLowerCase();
      if (lowerFormat.includes('shorts') || lowerFormat.includes('ショート') || lowerFormat.includes('雑学') || lowerFormat.includes('trivia')) {
        defaultCuts = 12;
      } else if (lowerFormat.includes('drama') || lowerFormat.includes('ドラマ') || lowerFormat.includes('マンガ') || lowerFormat.includes('manga')) {
        defaultCuts = 24;
      }

      const totalCuts = numVal(item.total_cuts, defaultCuts);

      return {
        id: trackId,
        track_id: trackId,
        track_no: numVal(item.track_no, idx + 1),
        title,
        format: formatStr,
        track_type: strVal(item.track_type, 'Vocal'),
        total_cuts: totalCuts,
        pool: strVal(item.pool, '20_日常・アオハル'),
        pool_code: poolCode,
        style: strVal(item.style),
        style_code: styleCode,
        taste: strVal(item.taste, 'youth_pop'),
        taste_name: strVal(item.taste_name),
        taste_reason: strVal(item.taste_reason),
        bpm: numVal(item.bpm, 125),
        surface_theme: strVal(item.surface_theme),
        hidden_drama: strVal(item.hidden_drama),
        visual_hints: strVal(item.visual_hints),
        scene_context: strVal(item.scene_context),
        character_setting: strVal(item.character_setting),
        sensory_details: strVal(item.sensory_details),
        sound_prompt: strVal(item.sound_prompt),
        chorus_start_sec: cStart,
        chorus_end_sec: cEnd,
        chorus_duration_sec: cDur,
        chorus_start_ms: numVal(item.chorus_start_ms, Math.round(cStart * 1000)),
        chorus_end_ms: numVal(item.chorus_end_ms, Math.round(cEnd * 1000)),
        chorus_lyrics: strVal(item.chorus_lyrics),
        input_lyrics: strVal(item.input_lyrics),
        generated_lyrics: strVal(item.generated_lyrics || item.input_lyrics),
        lyrics_kanji: strVal(item.lyrics_kanji),
        audio_filename: strVal(item.audio_filename),
        wav_url: strVal(item.wav_url),
        cover_url: strVal(item.cover_url)
      };
    });

    // 🎸 カラオケ（オフボーカル / インスト）の自動検知＆親ボーカル曲への自動ペアリング
    const vocalTracks: ImportedTrack[] = [];
    const instrumentalTracks: ImportedTrack[] = [];

    mapped.forEach(t => {
      if (isKaraokeOrInstrumentalTrack(t)) {
        t.is_instrumental = true;
        instrumentalTracks.push(t);
      } else {
        t.is_instrumental = false;
        vocalTracks.push(t);
      }
    });

    // ペアリング処理: タイトル前方一致または同一ベース名でボーカル曲にカラオケを紐付ける
    instrumentalTracks.forEach(inst => {
      const cleanInstTitle = inst.title
        .replace(/\s*[\(（](?:off-?vocal|instrumental|インスト|カラオケ|take\s*\d+|sunset\s*chill\s*off-?vocal)[^\)）]*[\)）]/gi, '')
        .trim();

      const parent = vocalTracks.find(v => {
        const cleanVocalTitle = v.title
          .replace(/\s*[\(（](?:vocal|take\s*\d+|sunset\s*chill\s*ver\.?)[^\)）]*[\)）]/gi, '')
          .trim();
        return v.title === cleanInstTitle || cleanVocalTitle === cleanInstTitle || inst.title.startsWith(v.title) || v.title.startsWith(cleanInstTitle);
      });

      if (parent) {
        parent.instrumental_track = inst;
        inst.paired_vocal_track_id = parent.id;
        console.log(`🔗 [MusicImporter] カラオケ自動ペアリング完了: 「${parent.title}」 ⇦ 「${inst.title}」`);
      }
    });

    // ボーカル曲が存在する場合は、ボーカル曲のみを返却（カラオケ版は画像の製造対象外として除外）
    if (vocalTracks.length > 0) {
      console.log(`🎤 [MusicImporter] 本命ボーカル曲 ${vocalTracks.length}件を画像製造対象として抽出 (カラオケ ${instrumentalTracks.length}件は自動除外＆ペアリング)`);
      return vocalTracks;
    }
    return mapped;
  } catch (err: unknown) {
    const errMessage = err instanceof Error ? err.message : String(err);
    console.warn('JSON parse failed, attempting plain text parsing fallback...', errMessage);

    // フォールバック 1: プレーンテキスト形式（Key: Value）の解析
    const fallbackTracks = parseTextTracksFormat(cleanText);
    if (fallbackTracks.length > 0) {
      console.log('✅ Successfully parsed track from plain text format!');
      return fallbackTracks;
    }

    // フォールバック 2: 破損JSONからの正規表現サルベージ
    const salvaged = salvageTracksFromCorruptedText(cleanText);
    if (salvaged.length > 0) {
      console.log(`✅ Salvaged ${salvaged.length} tracks from corrupted text!`);
      return salvaged;
    }

    // フォールバック 3: 単なる歌詞・テキストとして1曲生成
    if (cleanText.length > 0) {
      const firstLine = cleanText.split('\n')[0].slice(0, 30).trim();
      return [{
        id: `trk_${Date.now()}_fallback`,
        track_id: `trk_${Date.now()}_fallback`,
        track_no: 1,
        title: firstLine || 'インポート楽曲',
        format: '🎵 音楽MV (30カット)',
        track_type: 'Vocal',
        pool_code: 20,
        style_code: 21,
        taste: 'youth_pop',
        bpm: 125,
        chorus_start_sec: 65,
        chorus_end_sec: 95,
        chorus_duration_sec: 30,
        chorus_start_ms: 65000,
        chorus_end_ms: 95000,
        input_lyrics: cleanText,
        lyrics_kanji: cleanText
      }];
    }

    return [];
  }
}

/**
 * visual_hints 文字列（例: "Cut 1-3: [...], Cut 4-9: [...], Cut 10: [★...], Cut 11-12: [...]" またはカッコなし）をカット番号（1〜maxCuts）へマッピング
 */
export function parseVisualHints(visualHintsText: string, maxCuts: number = 60): Record<number, string> {
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

    for (let c = startCut; c <= endCut && c <= maxCuts; c++) {
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
 * 歌詞テキスト・演出ヒント・カット位置から、AI作画が1対1で呼応する具体的な情景・カメラ指示を錬成
 * （FlowTool映画的画角＆アングル自律ディレクションエンジン）
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
    const propName = cleanHint || (cleanLyric ? `symbolic item representing "${cleanLyric}"` : 'a meaningful evocative keepsake object');
    return `[STRICT STILL-LIFE INSERT]: Extreme close-up macro product still-life photography of (${propName}), in natural environmental setting (${theme}), completely deserted scene with strictly NO humans, NO person, shallow depth of field, atmospheric cinematic lighting, crisp tactile reflections and dust motes.`;
  }

  // 2. 普遍的8サイクル画角＆カメラアングルディレクション
  const ruleIndex = (cutIndex - 1) % UNIVERSAL_CINE_CYCLE.length;
  const rule = UNIVERSAL_CINE_CYCLE[ruleIndex];

  // 演出ヒント(cleanHint)や歌詞に「立っている」等の立ちポーズが固定化されている場合、
  // クローズアップや俯瞰などの画角と衝突して棒立ちになるのを防ぐため、画角に合わせてインテリジェントに中和
  let adaptiveHint = cleanHint;
  if (rule.scale.includes('Close-Up') || rule.scale.includes('High-Angle')) {
    adaptiveHint = adaptiveHint.replace(/(立っている|佇んでいる|佇む|直立して|直立の|standing|standing upright)/gi, '').trim();
  }

  if (adaptiveHint) {
    const lyricRef = cleanLyric ? `embodying lyric "${cleanLyric}", ` : '';
    return `[CAMERA DIRECTIVE: ${rule.directive}]. [SCENE CONTEXT]: Scene ${lyricRef}${adaptiveHint}. Set within the world of "${theme}". Dynamic atmospheric depth, natural cinematic lighting, beautiful filmic color grading.`;
  }

  if (!cleanLyric || cleanLyric.startsWith('♪') || /^\(.*\)$/.test(cleanLyric)) {
    return `[CAMERA DIRECTIVE: ${rule.directive}]. Set within the world of "${theme}". Atmospheric cinematic depth, natural lighting.`;
  }

  return `[CAMERA DIRECTIVE: ${rule.directive}]. Scene visually embodying lyric "${cleanLyric}", set within the world of "${theme}".`;
}

/**
 * CT198のインポートトラックから、FlowToolの完全な 30カット（可変対応）MV Episode を自動錬成
 * (v2.2.0-HybridScalable: 30カット・6秒/カット・比率ベース section_ratio_allocation 準拠)
 */
export function convertTrackToEpisode(
  track: ImportedTrack, 
  videoRatio: string = '30%', 
  selectedCharacter?: CastCharacter,
  coverThemeVariant?: string,
  selectedTaste?: string,
  targetCuts?: number,
  explicitEpisodeId?: number
): Episode {
  const totalCuts = targetCuts || (typeof track.total_cuts === 'number' && track.total_cuts > 0 ? track.total_cuts : 30);
  const visualMap = parseVisualHints(track.visual_hints || '', totalCuts);
  const preferredLyrics = track.lyrics_kanji || track.input_lyrics || '';
  const lyricsSec = parseLyricsSections(preferredLyrics);

  // サビ歌詞の取得
  const chorusLines = lyricsSec['chorus'] && lyricsSec['chorus'].length > 0
    ? lyricsSec['chorus']
    : (track.chorus_lyrics ? track.chorus_lyrics.split(/\r?\n/).filter(l => l.trim() && !l.startsWith('[') && !l.startsWith('(')) : []);

  const introLines = lyricsSec['intro'] || [];
  const verse1Lines = lyricsSec['verse1'] || [];
  const prechorusLines = lyricsSec['prechorus'] || [];
  const verse2Lines = lyricsSec['verse2'] || [];
  const bridgeLines = lyricsSec['bridge'] || [];
  const finalChorusLines = lyricsSec['final_chorus'] || [];
  const outroLines = lyricsSec['outro'] || [];

  // 3者共通グランドマスター規格 (v2.2.0-HybridScalable)
  const masterCat = resolveMasterCategory(track.surface_theme || track.title, 'mv');

  const cuts: Cut[] = [];

  for (let i = 1; i <= totalCuts; i++) {
    const progress = (i - 0.5) / totalCuts;

    // 比率ベースのセクション判定 (master_categories.json 準拠)
    let section: 'intro' | 'verse_a' | 'verse_b' | 'chorus' | 'bridge' | 'outro' = 'verse_a';
    if (progress < 0.13) {
      section = 'intro';
    } else if (progress < 0.33) {
      section = 'verse_a';
    } else if (progress < 0.53) {
      section = 'verse_b';
    } else if (progress < 0.80) {
      section = 'chorus';
    } else if (progress < 0.93) {
      section = 'bridge';
    } else {
      section = 'outro';
    }

    const isChorus = section === 'chorus';
    // 伏線小道具カット: bridge セクションの2番目のカット、または特定インデックス
    const bridgeStart = Math.round(totalCuts * 0.80) + 1;
    const isPropCut = totalCuts >= 20 ? (i === bridgeStart + 1) : (i === 10);
    const isLastCut = i === totalCuts;

    // 動的歌詞配分
    let lyric = '';
    if (section === 'intro') {
      const idx = (i - 1) % Math.max(1, introLines.length);
      lyric = introLines[idx] || (i === 1 ? '♪ (Intro Instrumental)' : (introLines[0] || '冷たい風が吹き抜ける'));
    } else if (section === 'verse_a') {
      const sectionOffset = i - Math.round(totalCuts * 0.13);
      const idx = (sectionOffset - 1) % Math.max(1, verse1Lines.length);
      lyric = verse1Lines[idx] || (verse1Lines.length > 0 ? verse1Lines.join(' ') : '冷たい床に伸びる影');
    } else if (section === 'verse_b') {
      const bPool = prechorusLines.length > 0 ? prechorusLines : verse2Lines;
      const sectionOffset = i - Math.round(totalCuts * 0.33);
      const idx = (sectionOffset - 1) % Math.max(1, bPool.length);
      lyric = bPool[idx] || (bPool.length > 0 ? bPool.join(' ') : '広くなった空間は');
    } else if (section === 'chorus') {
      const cPool = chorusLines.length > 0 ? chorusLines : (finalChorusLines.length > 0 ? finalChorusLines : []);
      const sectionOffset = i - Math.round(totalCuts * 0.53);
      const idx = (sectionOffset - 1) % Math.max(1, cPool.length);
      lyric = cPool[idx] || '透き通る風が駆け抜けて';
    } else if (section === 'bridge') {
      const brPool = bridgeLines.length > 0 ? bridgeLines : (verse2Lines.length > 0 ? verse2Lines : prechorusLines);
      const sectionOffset = i - Math.round(totalCuts * 0.80);
      const idx = (sectionOffset - 1) % Math.max(1, brPool.length);
      lyric = brPool[idx] || (isPropCut ? 'あの日置いてった銀の爪' : '隅に落ちてた銀の粒');
    } else {
      // outro
      const idx = (i - Math.round(totalCuts * 0.93) - 1) % Math.max(1, outroLines.length);
      lyric = outroLines[idx] || (isLastCut ? '♪ (Outro / Reverb Tail)' : '新しい明日へ歩き出す');
    }

    const hint = visualMap[i] || '';

    // 映画的カメラアングル＆画角サイクルの解決
    const cineRule = UNIVERSAL_CINE_CYCLE[(i - 1) % UNIVERSAL_CINE_CYCLE.length];
    let shotScale = cineRule.scale;
    let cameraWork = cineRule.cameraWork;
    let isObjectOnly = false;
    let telopStyle: any = 'mv-kinetic-pop';
    let telopTransition: any = 'gsap-kinetic-stagger';
    let telopPosition: any = 'bottom-center';

    if (i === 1) {
      // ★ 冒頭スワイプキラー（極限顔面・瞳のアップ）
      shotScale = 'Extreme Close-Up';
      cameraWork = 'intimate-macro';
      telopPosition = 'bottom-center';
    } else if (isLastCut) {
      // ★ 不在の余韻 ＆ 無限ループ構図
      shotScale = 'Extreme Wide Panorama';
      cameraWork = 'wide-establishing';
      telopPosition = 'bottom-center';
    } else if (isPropCut) {
      // ★ 伏線小道具確定
      shotScale = 'Extreme Close-Up Macro';
      cameraWork = 'macro-reveal';
      isObjectOnly = true;
      telopStyle = 'mv-neon-glow';
      telopPosition = 'bottom-center';
    } else if (isChorus) {
      // ★ サビ演出: カメラワークに動的エナジーを付加
      cameraWork = (i % 2 === 0) ? 'cinematic-orbit' : 'dynamic-pan-zoom';
      telopPosition = 'center-stagger';
    }

    const hl = extractHighlights(lyric);
    const visualPlot = extractLyricVisualPlot(lyric, hint, track.surface_theme || track.title, i, isPropCut);

    const promptEnComponents = [
      `Masterpiece, high production music video, authentic ${masterCat.pool.visual_contract.style_preset}.`,
      visualPlot,
    ];

    // キャストDNAおよび表情のインポート（キャスト固定が明示的にONのときのみ注入）
    if (selectedCharacter && !isPropCut && !isLastCut) {
      let expressionPrompt = selectedCharacter.expressions?.['neutral']?.promptModifierEn?.trim() || '';
      if (i === 1) {
        expressionPrompt = selectedCharacter.expressions?.['sad']?.promptModifierEn?.trim() || selectedCharacter.expressions?.['neutral']?.promptModifierEn?.trim() || '';
      } else if (section === 'verse_b') {
        expressionPrompt = selectedCharacter.expressions?.['sad']?.promptModifierEn?.trim() || selectedCharacter.expressions?.['neutral']?.promptModifierEn?.trim() || '';
      } else if (isChorus) {
        expressionPrompt = selectedCharacter.expressions?.['happy']?.promptModifierEn?.trim() || selectedCharacter.expressions?.['neutral']?.promptModifierEn?.trim() || '';
      } else if (section === 'bridge') {
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

    // 登場人物詳細（character_setting）の画角連動インテリジェント注入
    // （画角がClose-UpやHigh-Angle、Wideの時に「立っている」という固定ポーズが構図を殺さないよう、FlowTool側でスマートに中和）
    if (track.character_setting && !isPropCut && !isLastCut) {
      let cleanSettingDna = track.character_setting
        .replace(/\b(standing|standing upright|upright|seated|sitting|holding an? umbrella|holding umbrellas?|with an? umbrella|holding hands?|walking straight|facing camera)\b/gi, '')
        .replace(/(傘を差して|傘を持ち|傘を持った|傘を差す|立っている|佇んでいる|佇む|直立して|正面を向いて)/g, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      if (cleanSettingDna) {
        if (shotScale.includes('Close-Up') || shotScale.includes('Profile')) {
          // 接写・横顔: 全身立ちポーズを殺し、顔・髪・上半身の容姿特徴のみにフォーカス
          cleanSettingDna = cleanSettingDna.replace(/\b(full body|head-to-toe|shoes?|sneakers?|boots?|legs?|feet)\b/gi, '').trim();
          promptEnComponents.push(`[CHARACTER PORTRAIT DETAILS]: ${cleanSettingDna.replace(/\.+$/, '')}.`);
        } else if (shotScale.includes('Wide') || shotScale.includes('Panorama')) {
          // 引き・全景: 人物が中央に立ちはだからないよう、風景に溶け込むシルエットとして注入
          promptEnComponents.push(`[CHARACTER IN SCENERY]: Subtle atmospheric silhouette of ${cleanSettingDna.replace(/\.+$/, '')}, naturally placed in the expansive landscape.`);
        } else {
          promptEnComponents.push(`[CHARACTER SETTING]: ${cleanSettingDna.replace(/\.+$/, '')}.`);
        }
      }
    }

    // 五感・小道具ディテール（sensory_details）の注入
    if (track.sensory_details && (isPropCut || i === 1 || i === 3 || i === 7 || isChorus)) {
      promptEnComponents.push(`[TACTILE DETAILS]: ${track.sensory_details.trim().replace(/\.+$/, '')}.`);
    }

    // 音楽スタイル（曲調・雰囲気）の作画プロンプト自動注入
    if (track.style && track.style !== 'Audio effects') {
      const moodMatches = track.style.match(/(?:intimate domestic atmosphere|bittersweet nostalgic mood|nostalgic|chill|sparkly|dreamy|melancholic|energetic)[^,]*/gi);
      if (moodMatches && moodMatches.length > 0) {
        promptEnComponents.push(`[AUDIO MOOD]: ${[...new Set(moodMatches)].join(', ')}.`);
      }
    }

    promptEnComponents.push(
      isPropCut 
        ? `Shallow depth of field, dramatic dust motes in sunbeam, crisp macro reflections.` 
        : `Atmospheric cinematography, aesthetic lighting, beautifully detailed textures, clean edge-to-edge artwork.`
    );

    const promptEn = promptEnComponents.join(' ');

    // 直近カットのポーズ・小道具・構図を次カットのネガティブプロンプトへ完全自動バインド
    const recentCuts = cuts.slice(Math.max(0, cuts.length - 2));
    const dynamicAntiPrev = recentCuts.length > 0 ? buildDynamicAntiPreviousNegative(recentCuts.map(c => ({
      scale: c.shotScale,
      angle: c.cameraWork,
      prompt: c.promptEn
    }))) : '';

    cuts.push({
      id: i,
      promptEn: promptEn,
      negativePrompt: dynamicAntiPrev,
      narrationJp: lyric,
      narrationEn: '',
      shotScale: shotScale,
      cameraWork: cameraWork,
      isObjectOnly: isObjectOnly,
      panelLayout: isPropCut ? 'single' : (isChorus ? 'diagonal-slash' : 'single'),
      focalPoint: isPropCut ? { grid: 'center', normalizedCoord: [0.5, 0.5], focalSubject: 'key_prop' } : undefined,
      duration: 6.0,
      isSelectedForVideo: isCutSelectedForVideo(i - 1, videoRatio),
      targetVideoModel: 'omni-flash',
      isDirecting: false,
      isGeneratingImage: false,
      isGeneratingVideo: false,
      isQueued: false,
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

  // トラック番号の自動判定（explicitEpisodeId > track_no > sound_prompt内のTrack-Number > 1）
  let autoTrackNo = explicitEpisodeId || Number(track.track_no);
  if (!autoTrackNo && track.sound_prompt) {
    const match = track.sound_prompt.match(/Track-Number:\s*#?(\d+)/i);
    if (match) autoTrackNo = parseInt(match[1], 10);
  }
  const episodeId = autoTrackNo || 1;
  const uniqueId = `ep_mv_${Date.now()}_${track.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`;

  return {
    id: episodeId,
    internalId: uniqueId,
    titleJp: track.title,
    titleEn: track.title,
    summary: track.hidden_drama || track.surface_theme || '',
    theme: track.surface_theme || track.title,
    taste: resolveTasteKey(selectedTaste || track.taste || 'youth_pop'),
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
    coverThemeVariant: coverThemeVariant,
    soundPrompt: track.sound_prompt,
    musicStyle: track.style,
    instrumentalTrack: track.instrumental_track
  };
}
