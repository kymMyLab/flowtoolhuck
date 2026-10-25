import { Episode, Cut, ProductionMode, CastCharacter, TelopStyle, TelopTransition, TelopPosition, CharacterPresenceType, ExtractedSongDna } from '../types';
import { extractHighlights } from './directorService';
import { resolveMasterCategory } from '../config/masterCategories';
import { CAMERA_WORK_REGISTRY } from '../constants';
import { isCutSelectedForVideo } from './utils';
import { resolveTasteKey } from './tasteStorage';
import { buildDynamicAntiPreviousNegative, isFaceMacroScale } from './promptEngine';
import { UNIVERSAL_CINE_CYCLE, CineCameraRule } from '../config/studioDefinitions';

export interface ImportedStoryboardCut {
  cut_number: number;
  time_range?: string;
  lyrics_part?: string;
  camera_composition?: string;
  lighting_scene?: string;
  character_action?: string;
  image_prompt?: string;
  [key: string]: unknown;
}

/**
 * タイムレンジ文字列（例: "0:00 - 0:06", "1:04 - 1:05"）からカットの秒数（duration）を算出
 */
export function parseTimeRangeDuration(timeRange?: string, fallbackDuration: number = 6.0): number {
  if (!timeRange) return fallbackDuration;
  const parts = timeRange.split(/\s*[-〜~]\s*/);
  if (parts.length === 2) {
    const parseSec = (t: string) => {
      const segs = t.trim().split(':');
      if (segs.length === 2) {
        return parseInt(segs[0], 10) * 60 + parseFloat(segs[1]);
      }
      return parseFloat(t);
    };
    const s = parseSec(parts[0]);
    const e = parseSec(parts[1]);
    if (!isNaN(s) && !isNaN(e) && e > s) {
      return parseFloat((e - s).toFixed(1));
    }
  }
  return fallbackDuration;
}

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
  storyboard?: ImportedStoryboardCut[];
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
  const cStart = trackData['chorus_start_sec'] !== undefined && trackData['chorus_start_sec'] !== ''
    ? Number(trackData['chorus_start_sec'])
    : 60;
  const cEnd = trackData['chorus_end_sec'] !== undefined && trackData['chorus_end_sec'] !== ''
    ? Number(trackData['chorus_end_sec'])
    : (cStart + 30);
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
        chorus_start_sec: 60,
        chorus_end_sec: 90,
        chorus_duration_sec: 30,
        chorus_start_ms: 60000,
        chorus_end_ms: 90000,
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
        if (v === undefined || v === null || v === '') return fallback;
        const n = Number(v);
        return Number.isFinite(n) ? n : fallback;
      };

      const strVal = (v: unknown, fallback: string = ''): string => {
        if (v === null || v === undefined) return fallback;
        return String(v).trim();
      };

      const poolCode = numVal(item.pool_code, 20);
      const styleCode = numVal(item.style_code, poolCode + 1);
      const cStart = numVal(item.chorus_start_sec, 60);
      const cEnd = numVal(item.chorus_end_sec, cStart + 30);
      const cDur = numVal(item.chorus_duration_sec, Math.max(1, cEnd - cStart));

      const title = strVal(item.title) || `トラック ${idx + 1}`;
      const trackId = strVal(item.track_id || item.id) || `trk_${Date.now()}_${idx + 1}`;

      const formatStr = strVal(item.format, '🎵 音楽MV (30カット)');

      // フォーマットに応じたカット数の自動判定 (storyboard内包ならそのカット数を最優先)
      let defaultCuts = Array.isArray(item.storyboard) && item.storyboard.length > 0 ? item.storyboard.length : 30;
      const lowerFormat = formatStr.toLowerCase();
      if (!Array.isArray(item.storyboard) || item.storyboard.length === 0) {
        if (lowerFormat.includes('shorts') || lowerFormat.includes('ショート') || lowerFormat.includes('雑学') || lowerFormat.includes('trivia')) {
          defaultCuts = 12;
        } else if (lowerFormat.includes('drama') || lowerFormat.includes('ドラマ') || lowerFormat.includes('マンガ') || lowerFormat.includes('manga')) {
          defaultCuts = 24;
        }
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
        cover_url: strVal(item.cover_url),
        storyboard: Array.isArray(item.storyboard) ? item.storyboard.map((sb: any, sbIdx: number) => ({
          cut_number: typeof sb.cut_number === 'number' ? sb.cut_number : sbIdx + 1,
          time_range: strVal(sb.time_range),
          lyrics_part: strVal(sb.lyrics_part),
          camera_composition: strVal(sb.camera_composition),
          lighting_scene: strVal(sb.lighting_scene),
          character_action: strVal(sb.character_action),
          image_prompt: strVal(sb.image_prompt)
        })) : undefined
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
        chorus_start_sec: 60,
        chorus_end_sec: 90,
        chorus_duration_sec: 30,
        chorus_start_ms: 60000,
        chorus_end_ms: 90000,
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
 * 歌詞テキスト（正規漢字またはひらがな）をセクションタグ [Intro (0:00 - 0:20)], [Verse 1 - Fast Rap], [Chorus] 等ごとに高精度に分離
 * タグのタイムコードや追加表記に完全対応し、タグなし歌詞でも全行を均等配分できるように保持
 */
export function parseLyricsSections(lyricsText: string): Record<string, string[]> & { _allLines: string[] } {
  const sections: Record<string, string[]> & { _allLines: string[] } = { _allLines: [] };
  if (!lyricsText) return sections;

  const lines = lyricsText.split(/\r?\n/);
  let currentSection = 'intro';
  sections[currentSection] = [];

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // 角括弧 [ ... ] で囲まれたヘッダー・タグを検出（タイムコードやサブタイトル付きも完全捕捉）
    const tagMatch = line.match(/^\[([^\]]+)\]/);
    if (tagMatch) {
      const tagContent = tagMatch[1].toLowerCase();
      // セクション名の判定
      if (tagContent.includes('intro')) currentSection = 'intro';
      else if (tagContent.includes('verse 1') || tagContent.includes('verse1')) currentSection = 'verse1';
      else if (tagContent.includes('pre-chorus') || tagContent.includes('prechorus')) currentSection = 'prechorus';
      else if (tagContent.includes('post-chorus') || tagContent.includes('postchorus') || tagContent.includes('interlude') || tagContent.includes('drop')) currentSection = 'post_chorus';
      else if (tagContent.includes('final chorus') || tagContent.includes('climax')) currentSection = 'final_chorus';
      else if (tagContent.includes('chorus')) currentSection = 'chorus';
      else if (tagContent.includes('verse 2') || tagContent.includes('verse2')) currentSection = 'verse2';
      else if (tagContent.includes('bridge')) currentSection = 'bridge';
      else if (tagContent.includes('outro')) currentSection = 'outro';
      // 音楽の演奏ト書き [Sparkling Pluck...], [Full Bedroom Trap...] 等はセクション変更せずスキップ

      if (!sections[currentSection]) sections[currentSection] = [];
    } else {
      // 歌詞本文（英語のト書き行や単なる(gasp)以外の歌唱行を収集）
      if (!line.startsWith('[') && !/^\((?:gasp|silence|end|tu-tu-tu|yeah|la-la-la|ooh)\)$/i.test(line)) {
        if (/^\s*[\(（]?※Cut\s*\d+/i.test(line)) continue;
        if (!sections[currentSection]) sections[currentSection] = [];
        sections[currentSection].push(line);
        sections._allLines.push(line);
      }
    }
  }

  return sections;
}



/**
 * 歌詞テキスト（日本語）からキャラクターの具体的なキネティック・アクション（身体動作・仕草・感情の身体化）を自動抽出
 * 棒立ち・無感情・退屈なポーズを排し、歌詞の感情と直結した生々しい映画的躍動感を注入
 */
export function parseLyricKineticAction(lyric: string, section?: string, isPropCut?: boolean): string {
  if (isPropCut) return '';
  const text = (lyric || '').trim();
  if (!text || text.startsWith('♪') || /^\(.*\)$/.test(text)) return '';

  const actions: string[] = [];

  // 1. 手・拳・ポケット・袖（抑圧された感情・微細なしぐさ）
  if (/にぎりしめ|握る|拳|つかむ|つかんだ|力込/i.test(text)) {
    actions.push('hands clenching tightly into trembling fists, suppressed emotional intensity');
  } else if (/ポケット/i.test(text)) {
    actions.push('hands slipped quietly into pockets, natural contemplative posture');
  } else if (/袖|指先|爪|引っ掛け/i.test(text)) {
    actions.push('delicate subconscious fidgeting gesture with fingers, contemplative nuance');
  } else if (/触れ|なぞる|手のひら|温もり|ぬくもり/i.test(text)) {
    actions.push('tenderly resting open palm against a surface, feeling faint lingering warmth through fingertips');
  } else if (/放す|こぼれ|すり抜け|ほどけ|落と/i.test(text)) {
    actions.push('fingers slowly parting open in surrender as something intangible slips through grasp');
  }

  // 2. 呼吸・唇・視線・表情（内面の吐露・沈黙）
  if (/白く.*息|吐息.*白|ため息|深く息/i.test(text)) {
    actions.push('soft wistful exhalation, subtle breathing motion reflecting deep inner thoughts');
  }
  if (/唇|噛む|言えな|声|叫ぶ|言葉/i.test(text)) {
    actions.push('biting lower lip slightly, lips parted as if holding back unspoken words');
  }
  if (/見上げ|空|仰ぐ|雲|星|天井/i.test(text)) {
    actions.push('chin lifted upward, reflective glassy eyes gazing into the soaring expanse above');
  } else if (/うつむ|影|床|足元|見つめる|落とす/i.test(text)) {
    actions.push('eyes cast downward staring intently at elongated shadows stretching across the ground, pensive bowed posture');
  }
  if (/涙|瞳|濡れ|揺れる|滲む/i.test(text)) {
    actions.push('glistening eyes catching specular rim light, resolute emotional intensity, trembling gaze');
  } else if (/目を閉じ|瞼|閉じる/i.test(text)) {
    actions.push('eyes softly closed in peaceful introspection, subtle breeze brushing across eyelashes');
  }

  // 3. 移動・歩行・振り返り（ドラマの推進・時間の進行）
  if (/はずむ|弾む|あしどり|足取り|ステップ|スキップ|あわせてゆく|あわせて|はずみ/i.test(text)) {
    actions.push('walking energetically with a joyful lively bounce in their stride, bright beaming smile, matching footsteps in an upbeat cheerful rhythmic pace');
  } else if (/振り返|背中|振り向|立ち止ま|去る/i.test(text)) {
    actions.push('halting mid-stride and glancing back over shoulder with a bittersweet searching gaze');
  } else if (/走る|駆け|急ぐ|追いかけ/i.test(text)) {
    actions.push('dynamic forward athletic momentum, hair and clothes whipping back in kinetic sprint');
  } else if (/歩く|歩き出|足音|踏み出|一歩/i.test(text)) {
    actions.push('taking a resolute brisk step forward, dynamic leg stride, clothes swishing with kinetic purpose');
  } else if (/寝転が|ごろん|ベッドの上|シーツ|横たわ|まくら/i.test(text)) {
    actions.push('lying down comfortably on soft bed, rolling over lazily across rumpled sheets and pillows, relaxed candid bedroom posture');
  } else if (/一本釣り|釣り|竿|引き|引く|大漁/i.test(text)) {
    actions.push('athletic firm braced stance, gripping and hauling bowed fishing rod with intense kinetic power against splashing waves');
  } else if (/パジャマの裾|裾.*握|もこもこ.*握|裾/i.test(text)) {
    actions.push('delicately clutching hem of oversized cozy clothing with both hands, gentle tactile gesture of emotional contemplation');
  } else if (/しゃがむ|座る|膝|うずくま/i.test(text)) {
    actions.push('crouching down low with knees drawn together, thoughtful solitary resting posture');
  }

  // 4. 風・光・環境との相互作用
  if (/風|吹き抜け|靡く|揺れる/i.test(text)) {
    actions.push('sudden gust of wind whipping hair across the face, raising forearm to shield eyes against the breeze');
  }
  if (/眩しい|光|差し込む|夕暮れ|西日|朝|太陽/i.test(text)) {
    actions.push('squinting gently against piercing dramatic backlight, hand slightly raised to shade eyes');
  }

  if (actions.length > 0) {
    return actions.slice(0, 2).join(', ');
  }

  // 5. フォールバック（セクションに応じた自律アクション）
  if (section === 'chorus' || section === 'final_chorus') {
    return 'passionate singing posture, chin lifted with resonant emotion, dynamic kinetic hair motion';
  } else if (section === 'post_chorus') {
    return 'rhythmic swaying to the instrumental beat, immersed in the musical interlude';
  } else if (section === 'bridge') {
    return 'stillness charged with anticipation, subtle chest rise on a deep breath, intense introspective focus';
  } else {
    return 'natural candid movement, shifting weight slightly with an introspective thoughtful gaze';
  }
}


/**
 * 歌詞テキストから具体的な小道具・ロケーション・映画的情景モチーフを抽出
 * 「夕暮れのガードレール」一辺倒になるのを完全に破壊し、自販機、階段、橋、自転車、缶、手すりなど歌詞通りの世界を描かせる
 */
export function extractLyricScenicMotif(lyric: string): string {
  const text = (lyric || '').trim();
  if (!text) return '';

  const motifs: string[] = [];

  // 1. ベッド・布団・自室・部屋・シーツ・枕・パジャマ・ごろん
  if (/ベッド|ふとん|布団|へや|部屋|自室|シーツ|まくら|枕|パジャマ|寝転が|ごろん/i.test(text)) {
    motifs.push('cozy tranquil private bedroom interior, soft mattress with rumpled blankets and fluffy pillows, warm domestic indoor lighting, peaceful secluded room');
  }
  // 2. コンビニ・レジ・深夜
  else if (/コンビニ|レジ|肉まん|おでん|アイス|深夜の明かり/i.test(text)) {
    motifs.push('brightly illuminated 24-hour Japanese convenience store storefront glowing in the dark, warm light spilling through large glass windows, quiet late-night street');
  }
  // 3. 船・海・甲板・航海・港・荒波
  else if (/漁船|船|ボート|甲板|デッキ|航海|港|港町|荒波|波しぶき|水平線|沖合|大漁/i.test(text)) {
    motifs.push('rugged wooden ship deck pitching on surging ocean waves, dramatic white sea spray mist, deep churning seawater, dramatic maritime atmosphere');
  }
  // 4. 駅・改札・電車・ホーム・始発・終電
  else if (/改札|かいさつ|電車|でんしゃ|ホーム|始発|終電|地下鉄/i.test(text)) {
    motifs.push('train station ticket turnstiles and suburban transit platform, atmospheric commuter ambiance');
  }
  // 5. 台所・キッチン・朝食・料理
  else if (/台所|キッチン|料理|フライパン|湯気|トースター|朝食/i.test(text)) {
    motifs.push('warm home kitchen, countertop with steam rising, warm morning sunlight streaming in');
  }
  // 6. 洗面所・お風呂・鏡
  else if (/お風呂|洗面台|鏡|ドライヤー|湯気/i.test(text)) {
    motifs.push('steamy bathroom mirror, warm domestic atmosphere, soft morning light');
  }
  // 7. 海・ビーチ・波・砂浜・夏
  else if (/うみ|海|なみ|波|しぶき|飛沫|砂浜|すなはま|海岸|かいがん|ビーチ|beach|shore|ocean|wave|サンダル|水着|みずぎ/i.test(text)) {
    motifs.push('crystal clear emerald ocean shallows, sparkling turquoise ripples, wet white sand shoreline under bright radiant sunlight');
  }
  // 8. 雪・冬・粉雪・吹雪・氷
  else if (/ゆき|雪|こおり|氷|ふぶき|吹雪|粉雪|こゆき|初雪|冬景色|winter|snow|blizzard/i.test(text)) {
    motifs.push('pristine untouched powdery snow covering the tranquil ground, delicate floating snowflakes in crisp silent winter morning air');
  }
  // 9. 自販機・缶ジュース
  else if (/自販機|じはんき|自動販売機|ベンダー/i.test(text)) {
    motifs.push('standing by a glowing illuminated drink vending machine on the corner, warm red light glowing in twilight, warm canned beverage dropping into slot');
  } else if (/アルミ缶|缶コーヒー|缶ジュース|空き缶|缶の底|プルタブ/i.test(text)) {
    motifs.push('holding an aluminum drink can between both hands, tactile metal reflections and condensation');
  }
  // 10. 階段・河川敷・堤防
  else if (/階段|かいだん|河川敷|かわべり|川沿い|堤防|土手/i.test(text)) {
    motifs.push('concrete riverside embankment overlooking calm water, sitting on the steps in natural relaxed posture');
  }
  // 11. 自転車
  else if (/じてんしゃ|自転車/i.test(text)) {
    motifs.push('dramatic cinematic headlight glare from a passing commuter bicycle, intense luminous lens flare slashing across scene');
  }
  // 12. 歩道橋・欄干
  else if (/歩道橋|ほどうきょう|橋の上|はしのうえ|手すり|てすり|欄干/i.test(text)) {
    motifs.push('solitary pedestrian footbridge railing, weathered metallic texture in atmospheric daylight');
  }
  // 13. 教室・黒板・放課後
  else if (/きょうしつ|教室|こくばん|黒板|放課後|下校/i.test(text)) {
    motifs.push('empty nostalgic classroom with wooden desks and fluttering curtains catching warm slant sunlight');
  }
  // 14. 影・夕暮れ・西日
  else if (/にしび|西日|夕暮れ|夕日|夕陽|sunset|golden-hour/i.test(text)) {
    motifs.push('long elongated sharp shadow cast across the textured ground under low slant golden-hour sunlight');
  }

  return motifs[0] || '';
}

/**
 * 歌詞テキスト・演出ヒント・カット位置から、AI作画が1対1で呼応する具体的な情景・カメラ指示を錬成
 * （FlowTool 10大映画的演出パターン × 歌詞情景自律融合ディレクションエンジン）
 */
export function extractLyricVisualPlot(
  lyric: string,
  hint: string,
  theme: string,
  cutIndex: number,
  isPropCut: boolean,
  section?: string
): string {
  const cleanHint = (hint || '').replace(/★\s*/g, '').trim();
  const cleanLyric = (lyric || '').trim();

  // 1. 小道具カット（Cut 10 / Cut 26: 抽象的・象徴的アイテム）のマクロ静物処理
  if (isPropCut) {
    let propDesc = cleanHint;
    if (!propDesc) {
      if (/銀の爪|銀の粒|粒|爪|指輪|鍵|チケット|手紙|メモ|コイン|アルミ|缶|底|ひづけ|日付|すうじ/i.test(cleanLyric)) {
        propDesc = `a solitary gleaming small keepsake object (${cleanLyric}) resting quietly on surface`;
      } else if (cleanLyric) {
        propDesc = `a poetic symbolic still-life item evoking the essence of "${cleanLyric}"`;
      } else {
        propDesc = 'a poetic weathered keepsake object imbued with nostalgic memory';
      }
    }
    return `[STRICT STILL-LIFE INSERT]: Cinematic extreme close-up macro product still-life photography of (${propDesc}), set within atmospheric environment (${theme}), completely deserted scene with strictly NO humans, NO person, shallow depth of field, atmospheric cinematic lighting, rich tactile textures, crisp specular reflections and fine floating dust motes.`;
  }

  // 2. 普遍的10大映画的演出ルール
  const ruleIndex = (cutIndex - 1) % UNIVERSAL_CINE_CYCLE.length;
  const rule = UNIVERSAL_CINE_CYCLE[ruleIndex];

  // 3. 歌詞連動キネティック・アクション（身体動作・仕草）
  const kineticAction = parseLyricKineticAction(cleanLyric, section, isPropCut);
  const actionPart = kineticAction ? ` [KINETIC ACTION: ${kineticAction}].` : '';

  // 4. 歌詞固有のシチュエーション・ロケーション・小道具モチーフ
  // （※瞳や口元の極限接写の場合は、自販機や階段などの大型背景モチーフで画角を壊さないよう除外）
  const isFaceMacro = rule.scale.includes('Close-Up') || rule.scale.includes('Mouth');
  const scenicMotif = isFaceMacro ? '' : extractLyricScenicMotif(cleanLyric);
  const motifPart = scenicMotif ? ` [SCENIC MOTIF: ${scenicMotif}].` : '';

  // 演出ヒント(cleanHint)が特定の立ちポーズや座り姿勢で固まっている場合の中和
  let adaptiveHint = cleanHint;
  if (rule.scale.includes('Close-Up') || rule.scale.includes('Mouth') || rule.scale.includes('High-Angle') || rule.scale.includes('Footsteps')) {
    adaptiveHint = adaptiveHint
      .replace(/(立っている|佇んでいる|佇む|直立して|直立の|standing|standing upright|座っている|ベンチ|seated|sitting|bench)/gi, '')
      .trim();
  }

  // 接写系（瞳・口元）は、背景環境に引っ張られて全身引き絵になるのを完全に防ぎつつ、曲の世界観・光とボケ味を調和
  if (isFaceMacro) {
    const emotionContext = cleanLyric ? `reflective emotive expression for "${cleanLyric}", ` : '';
    return `[CAMERA DIRECTIVE: ${rule.directive}].${actionPart} [LIGHTING & BOKEH]: ${emotionContext}Atmospheric lighting reflecting the visual theme of "${theme}", gorgeous 100% shallow depth of field abstract bokeh, emotional cinematic color grading.`;
  }

  if (adaptiveHint && !adaptiveHint.includes('Cut ')) {
    const lyricRef = cleanLyric ? `embodying lyric "${cleanLyric}", ` : '';
    return `[CAMERA DIRECTIVE: ${rule.directive}].${actionPart}${motifPart} [SCENE CONTEXT]: Scene ${lyricRef}${adaptiveHint}. Set within the world of "${theme}". Dynamic atmospheric depth, natural cinematic lighting, beautiful filmic color grading.`;
  }

  if (cleanLyric && !cleanLyric.startsWith('♪') && !/^\(.*\)$/.test(cleanLyric)) {
    return `[CAMERA DIRECTIVE: ${rule.directive}].${actionPart}${motifPart} Scene visually embodying lyric "${cleanLyric}", set within the world of "${theme}".`;
  }

  return `[CAMERA DIRECTIVE: ${rule.directive}].${actionPart}${motifPart} Set within the world of "${theme}". Atmospheric cinematic depth, natural lighting.`;
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
  const postChorusLines = lyricsSec['post_chorus'] || [];
  const verse2Lines = lyricsSec['verse2'] || [];
  const bridgeLines = lyricsSec['bridge'] || [];
  const finalChorusLines = lyricsSec['final_chorus'] || [];
  const outroLines = lyricsSec['outro'] || [];

  // 3者共通グランドマスター規格 (v2.2.0-HybridScalable)
  const masterCat = resolveMasterCategory(track.surface_theme || track.title, 'mv');

  const cuts: Cut[] = [];
  let lastShotScale = '';
  let lastCinematicAngle = '';

  // 🎬 JSON内に完全な絵コンテ(storyboard)が存在し、かつ要求カット数と一致する場合のみ絵コンテをダイレクト適用
  const canUseStoryboard = Array.isArray(track.storyboard) && 
    track.storyboard.length > 0 && 
    track.storyboard.length === totalCuts;

  if (canUseStoryboard && track.storyboard) {
    console.log(`🎬 [MusicImporter] 楽曲「${track.title}」の同梱絵コンテ（${track.storyboard.length}カット）を高精度ダイレクト適用します！`);

    for (let i = 1; i <= totalCuts; i++) {
      const cutData = track.storyboard[i - 1];
      const timeRange = cutData.time_range || '';
      const rawPrompt = cutData.image_prompt || '';
      // --ar 9:16 等のMidjourney用アスペクト比指定を除去
      const cleanPrompt = rawPrompt.replace(/--ar\s+\d+:\d+/gi, '').replace(/\s{2,}/g, ' ').trim();
      const lyric = cutData.lyrics_part || '';
      const duration = parseTimeRangeDuration(timeRange, 6.0);

      const promptLower = rawPrompt.toLowerCase();
      const compLower = (cutData.camera_composition || '').toLowerCase();
      const actionLower = (cutData.character_action || '').toLowerCase();
      const fullText = `${promptLower} ${compLower} ${actionLower}`;

      // ── (A) 人物なし・静物・風景カットの厳密判定 ──
      // コード・手すり・スニーカー・バッグ・自販機ボタン・窓枠・缶・カップ・無人風景など
      const isObjectOnly = /(人物はまだ|人物は消え|人物は不在|人物は完全に|誰もいない|無人|人物の姿はなく|静止ロングフィックス|静止フィックス)/i.test(fullText) ||
        /(thin white audio cable|audio cord|earphone wire|worn white sneakers|school bag resting|metal staircase handrail|wooden window frame|phone screen|railroad crossing|abandoned aluminum|ceramic mugs?|brass bell|solitary glowing vending machine|empty high school stair|empty wooden bench|solitary glowing|still wide shot|completely deserted)/i.test(promptLower);

      // ── (B) 画角（shotScale）とカメラワークの精密分類（安易にClose-Upにして顔面化するのを完全防御） ──
      let shotScale = 'Medium Shot';
      let cameraWork = 'slow-push-in';

      if (isObjectOnly || /cable|wire|handrail|shoes?|sneakers?|bag|can|mug|window frame|phone|bell|button/i.test(promptLower) || /手すり|コード|スニーカー|バッグ|缶|自販機|窓枠|スマホ|ボタン/i.test(compLower)) {
        shotScale = 'Still-Life Object Macro';
        cameraWork = 'macro-reveal';
      } else if (/eye dilated|pupil|瞳|虹彩|見開/i.test(fullText)) {
        // 瞳の極限マクロ（Cut 11等のキメカットのみ）
        shotScale = 'Extreme Close-Up';
        cameraWork = 'intimate-macro';
      } else if (/lips|mouth|口元|唇|吐息/i.test(fullText)) {
        shotScale = 'Macro Mouth & Breath';
        cameraWork = 'slow-push-in';
      } else if (/ear |earbud|earpiece|earlobe|耳元|耳たぶ/i.test(fullText)) {
        // 耳元は顔正面ではなく横顔・耳元マクロ
        shotScale = 'Side Profile';
        cameraWork = 'slow-push-in';
      } else if (/hands?|fingers?|pocket|手元|指先|ポケット/i.test(fullText)) {
        shotScale = 'Macro Hands';
        cameraWork = 'macro-reveal';
      } else if (/shoes?|sneakers?|boots?|foot|feet|footsteps|足元|靴/i.test(fullText)) {
        shotScale = 'Low-Angle Footsteps';
        cameraWork = 'tilt-up';
      } else if (/behind|rear|back view|後ろ姿|背中|肩の隙間|narrow gap between.*blazer/i.test(fullText)) {
        shotScale = 'Rear View';
        cameraWork = 'slow-push-in';
      } else if (/side profile|profile|横顔/i.test(fullText)) {
        shotScale = 'Side Profile';
        cameraWork = 'cinematic-orbit';
      } else if (/bust shot|bust|バストアップ/i.test(fullText)) {
        shotScale = 'Medium Bust Shot';
        cameraWork = 'slow-push-in';
      } else if (/overhead|bird|top-down|俯瞰|真上/i.test(fullText)) {
        shotScale = 'High-Angle Overhead';
        cameraWork = 'slow-pan';
      } else if (/low angle|ローアングル/i.test(fullText)) {
        shotScale = 'Low Angle';
        cameraWork = 'tilt-up';
      } else if (/wide|panoramic|ロング|全景/i.test(fullText)) {
        shotScale = 'Wide Shot';
        cameraWork = 'wide-establishing';
      } else if (/close-up|クローズアップ/i.test(fullText)) {
        shotScale = 'Medium Close-Up Profile';
        cameraWork = 'slow-push-in';
      }

      // プロンプト構築（Masterpiece + スタイルプリセット + 絵コンテプロンプト + キャストDNA）
      const promptEnComponents = [
        `Masterpiece, high production music video, authentic ${masterCat.pool.visual_contract.style_preset}.`,
        cleanPrompt
      ];

      // キャストDNA（人物カットかつキャスト固定が有効な場合）
      // ※ 古いファンタジー騎士等のDNAが残留しないよう、track.character_setting を最優先
      const effectiveTrackSetting = track.character_setting ? track.character_setting.trim() : '';
      if (!isObjectOnly) {
        if (effectiveTrackSetting) {
          promptEnComponents.push(`[CHARACTER SETTING]: ${effectiveTrackSetting}.`);
        } else if (selectedCharacter) {
          const cleanDna = selectedCharacter.dnaPromptEn ? selectedCharacter.dnaPromptEn.trim().replace(/\.+$/, '') : '';
          if (cleanDna) {
            promptEnComponents.push(`[PROTAGONIST DNA]: ${cleanDna}.`);
          }
        }
      }

      const promptEn = promptEnComponents.join(' ');

      // 🛡️ 【最重要】直前のカット（1〜2カット前）の構図・アングル・主要被写体を次のネガティブプロンプトへ完全バインド！
      const recentCuts = cuts.slice(Math.max(0, cuts.length - 2));
      let dynamicAntiPrev = recentCuts.length > 0 ? buildDynamicAntiPreviousNegative(recentCuts.map(c => ({
        scale: c.shotScale,
        angle: c.cinematicAngle || c.cameraWork,
        prompt: c.promptEn,
        tag: c.cameraWork
      })), shotScale) : '';

      // 直前カットが顔面アップ・瞳・ポートレートだった場合、今回が明示的な瞳マクロでない限り顔アップを強制粉砕！
      const prevCut = recentCuts[recentCuts.length - 1];
      if (prevCut) {
        const prevPromptLower = (prevCut.promptEn || '').toLowerCase();
        const prevScaleLower = (prevCut.shotScale || '').toLowerCase();
        if (prevScaleLower.includes('close-up') || prevPromptLower.includes('face') || prevPromptLower.includes('eyes') || prevPromptLower.includes('portrait')) {
          if (!shotScale.includes('Extreme Close-Up')) {
            const faceNegatives = 'extreme close-up of eyes, macro eyes, huge face filling screen, cropped forehead, close-up face portrait, duplicate face, identical frontal face, front view portrait';
            dynamicAntiPrev = dynamicAntiPrev ? `${dynamicAntiPrev}, ${faceNegatives}` : faceNegatives;
          }
        }
        // 直前が静物マクロ・手元だった場合、今回は静物を除外
        if (prevScaleLower.includes('object') || prevScaleLower.includes('hands')) {
          if (!shotScale.includes('Object') && !shotScale.includes('Hands')) {
            dynamicAntiPrev = dynamicAntiPrev ? `${dynamicAntiPrev}, static prop, inanimate object macro` : 'static prop, inanimate object macro';
          }
        }
      }

      // 5-way presence の初期アサイン
      let presence: CharacterPresenceType = '1_protagonist_solo_focus';
      let focalSubject = 'heroine_face';
      if (i === 1) {
        presence = '1_protagonist_solo_focus';
        focalSubject = 'heroine_expressive_eyes_cold_open';
      } else if (i === 2 || /establishing|wide|全景|引き構図/i.test(fullText)) {
        presence = '2_protagonist_or_pair_wide';
        focalSubject = 'environment_with_distant_figures';
      } else if (isObjectOnly || i === 25 || /スプーン|誰もいない|無人/i.test(fullText)) {
        presence = '5_scenic_or_still_life';
        focalSubject = 'symbolic_keepsake_still_life';
      } else if (shotScale.includes('Macro Hands') || shotScale.includes('Footsteps') || /手元|足元|カイロ|ポケット|マフラーの編み目/i.test(fullText)) {
        presence = '4_hands_or_feet_detail';
        focalSubject = /かいろ|ポケット/i.test(fullText) ? 'pocket_heat_pack' : 'keepsake_prop_texture';
      } else if (/two|ふたり|二人の|並んで|男子生徒|boy|肩が触れ/i.test(fullText)) {
        presence = '3_two_characters_asymmetric';
        focalSubject = 'heroine_with_partner_in_foreground';
      }

      // 黄金Veo順位定義マップ (Cut ID -> Rank)
      const goldenVeoRanks: Record<number, number> = {
        1: 1, 13: 2, 26: 3, 10: 4, 11: 5, 18: 6, 22: 7, 25: 8, 29: 9, 4: 10
      };
      const veoRank = goldenVeoRanks[i] || (10 + ((i * 7) % 20) + 1);

      const isBeatDrop = /stop|beat drop|無音/i.test(fullText) || i === 12;
      const isSelected = isCutSelectedForVideo(i - 1, videoRatio, veoRank, totalCuts);

      const hl = extractHighlights(lyric);

      cuts.push({
        id: i,
        promptEn: promptEn,
        cleanAction: cutData.character_action || '',
        cleanImagePrompt: cleanPrompt,
        cleanLighting: cutData.lighting_scene || '',
        cleanComposition: cutData.camera_composition || '',
        negativePrompt: dynamicAntiPrev,
        narrationJp: lyric,
        narrationEn: '',
        shotScale: shotScale,
        cameraWork: isBeatDrop ? 'freeze-frame' : cameraWork,
        cinematicAngle: cutData.camera_composition || shotScale,
        isObjectOnly: presence === '5_scenic_or_still_life',
        characterPresence: presence,
        veoPriorityRank: veoRank,
        panelLayout: isBeatDrop ? 'diagonal-slash' : 'single',
        focalPoint: { grid: 'center', normalizedCoord: [0.5, 0.5], focalSubject: focalSubject },
        duration: duration,
        isSelectedForVideo: isSelected,
        targetVideoModel: isSelected ? 'veo-fast' : 'none',
        isDirecting: false,
        isGeneratingImage: false,
        isGeneratingVideo: false,
        isQueued: false,
        telop: {
          fullText: lyric,
          highlights: hl,
          style: isObjectOnly ? 'mv-neon-glow' : 'mv-kinetic-pop',
          transition: 'gsap-kinetic-stagger',
          position: 'bottom-center',
          directorNote: `[Storyboard Cut ${i}] ${cutData.camera_composition || ''} ${cutData.lighting_scene ? `| ${cutData.lighting_scene}` : ''}`.trim()
        }
      });
    }
  } else {
    // 🧠 【自律推論エンジン】storyboard が存在しないか、または指定カット数が変更された場合の高精度フォールバック
    if (track.storyboard && track.storyboard.length > 0) {
      console.log(`🧠 [MusicImporter] 指定カット数(${totalCuts})が同梱絵コンテ数(${track.storyboard.length})と異なるため、自律推論ディレクターに切り替えて錬成します。`);
    }

    for (let i = 1; i <= totalCuts; i++) {
      const progress = (i - 0.5) / totalCuts;

      // セクション判定（30カット時はCT198小節ロック規格に完全同期、それ以外は比率フォールバック）
      let section: 'intro' | 'verse_a' | 'verse_b' | 'chorus' | 'post_chorus' | 'verse_2' | 'bridge' | 'final_chorus' | 'outro' = 'verse_a';
      if (totalCuts === 30) {
        if (i <= 3) section = 'intro';              // Cut 1-3: intro (0:00-0:15)
        else if (i <= 9) section = 'verse_a';      // Cut 4-9: verse_a (0:15-0:45)
        else if (i <= 12) section = 'verse_b';     // Cut 10-12: verse_b / Pre-Chorus (0:45-1:00)
        else if (i <= 18) section = 'chorus';      // Cut 13-18: chorus (1:00-1:30 ★1番サビ30秒)
        else if (i <= 21) section = 'post_chorus'; // Cut 19-21: post_chorus (1:30-1:45 ★間奏・スキャットのみ)
        else if (i <= 25) section = 'verse_2';     // Cut 22-25: verse_2 (1:45-2:15)
        else if (i <= 27) section = 'bridge';      // Cut 26-27: bridge (2:15-2:30)
        else if (i <= 29) section = 'final_chorus';// Cut 28-29: final_chorus (2:30-2:48)
        else section = 'outro';                     // Cut 30: outro (2:48-3:00)
      } else {
        if (progress < 0.10) {
          section = 'intro';
        } else if (progress < 0.30) {
          section = 'verse_a';
        } else if (progress < 0.40) {
          section = 'verse_b';
        } else if (progress < 0.60) {
          section = 'chorus';
        } else if (progress < 0.70) {
          section = 'post_chorus';
        } else if (progress < 0.83) {
          section = 'verse_2';
        } else if (progress < 0.90) {
          section = 'bridge';
        } else if (progress < 0.97) {
          section = 'final_chorus';
        } else {
          section = 'outro';
        }
      }

      const isChorus = section === 'chorus' || section === 'final_chorus';
      const hint = visualMap[i] || '';

      // 伏線・象徴小道具カット: 30カット構成では、Aメロ終わりの転換点(Cut 10)と、ブリッジ/落ちサビ(Cut 26)の2箇所に配置し、
      // また演出ヒントに ★ がついているカットも完全自律で小道具・静物カットとして確立
      const bridgeStart = totalCuts === 30 ? 26 : Math.round(totalCuts * 0.80) + 1;
      const hasStarInHint = (hint && hint.includes('★')) || ((track.visual_hints || '').match(new RegExp(`Cut\\s*${i}[^:\n]*:\\s*\\[?\\s*★`)) !== null);
      const isPropCut = hasStarInHint || (totalCuts === 30 ? (i === 10 || i === 26) : (totalCuts >= 20 ? (i === 10 || i === bridgeStart) : (i === 10)));
      const isLastCut = i === totalCuts;

      // 動的歌詞配分（全カット均等ニアリー同期マッピング）
      let lyric = '';
      const allLines = lyricsSec._allLines || [];

      if (section === 'intro') {
        const idx = (i - 1) % Math.max(1, introLines.length);
        lyric = introLines[idx] || (allLines.length > 0 ? allLines[Math.min(allLines.length - 1, Math.floor(progress * allLines.length))] : (i === 1 ? '♪ (Intro Instrumental)' : '冷たい風が吹き抜ける'));
      } else if (section === 'verse_a') {
        const sectionOffset = totalCuts === 30 ? (i - 3) : (i - Math.round(totalCuts * 0.10));
        const idx = Math.max(0, sectionOffset - 1) % Math.max(1, verse1Lines.length);
        lyric = verse1Lines[idx] || (allLines.length > 0 ? allLines[Math.min(allLines.length - 1, Math.floor(progress * allLines.length))] : (isPropCut ? '静かに残された記憶の欠片' : '冷たい床に伸びる影'));
      } else if (section === 'verse_b') {
        const bPool = prechorusLines.length > 0 ? prechorusLines : verse2Lines;
        const sectionOffset = totalCuts === 30 ? (i - 9) : (i - Math.round(totalCuts * 0.30));
        const idx = Math.max(0, sectionOffset - 1) % Math.max(1, bPool.length);
        lyric = bPool[idx] || (allLines.length > 0 ? allLines[Math.min(allLines.length - 1, Math.floor(progress * allLines.length))] : '広くなった空間は');
      } else if (section === 'chorus') {
        const cPool = chorusLines.length > 0 ? chorusLines : (finalChorusLines.length > 0 ? finalChorusLines : []);
        const sectionOffset = totalCuts === 30 ? (i - 12) : (i - Math.round(totalCuts * 0.40));
        const idx = Math.max(0, sectionOffset - 1) % Math.max(1, cPool.length);
        lyric = cPool[idx] || (allLines.length > 0 ? allLines[Math.min(allLines.length - 1, Math.floor(progress * allLines.length))] : '透き通る風が駆け抜けて');
      } else if (section === 'post_chorus') {
        // ★ 間奏（Post-Chorus）: スキャット行があれば表示、無ければ空文字 ''（テロップ非表示で映像に集中）
        // ※ 本編歌詞（allLines）へのフォールバックは物理的に遮断！
        if (postChorusLines.length > 0) {
          const sectionOffset = totalCuts === 30 ? (i - 18) : (i - Math.round(totalCuts * 0.60));
          const idx = Math.max(0, sectionOffset - 1) % postChorusLines.length;
          lyric = postChorusLines[idx] || '';
        } else {
          lyric = '';
        }
      } else if (section === 'verse_2') {
        const v2Pool = verse2Lines.length > 0 ? verse2Lines : (verse1Lines.length > 0 ? verse1Lines : []);
        const sectionOffset = totalCuts === 30 ? (i - 21) : (i - Math.round(totalCuts * 0.70));
        const idx = Math.max(0, sectionOffset - 1) % Math.max(1, v2Pool.length);
        lyric = v2Pool[idx] || (allLines.length > 0 ? allLines[Math.min(allLines.length - 1, Math.floor(progress * allLines.length))] : '街の明かりが遠ざかる');
      } else if (section === 'bridge') {
        const brPool = bridgeLines.length > 0 ? bridgeLines : (verse2Lines.length > 0 ? verse2Lines : prechorusLines);
        const sectionOffset = totalCuts === 30 ? (i - 25) : (i - Math.round(totalCuts * 0.83));
        const idx = Math.max(0, sectionOffset - 1) % Math.max(1, brPool.length);
        lyric = brPool[idx] || (allLines.length > 0 ? allLines[Math.min(allLines.length - 1, Math.floor(progress * allLines.length))] : (isPropCut ? 'あの日置いてった銀の爪' : '隅に落ちてた銀の粒'));
      } else if (section === 'final_chorus') {
        const fcPool = finalChorusLines.length > 0 ? finalChorusLines : (chorusLines.length > 0 ? chorusLines : []);
        const sectionOffset = totalCuts === 30 ? (i - 27) : (i - Math.round(totalCuts * 0.90));
        const idx = Math.max(0, sectionOffset - 1) % Math.max(1, fcPool.length);
        lyric = fcPool[idx] || (allLines.length > 0 ? allLines[Math.min(allLines.length - 1, Math.floor(progress * allLines.length))] : 'もう一度あの空の向こうへ');
      } else {
        // outro
        const sectionOffset = totalCuts === 30 ? (i - 29) : (i - Math.round(totalCuts * 0.97));
        const idx = Math.max(0, sectionOffset - 1) % Math.max(1, outroLines.length);
        lyric = outroLines[idx] || (allLines.length > 0 ? allLines[Math.min(allLines.length - 1, Math.floor(progress * allLines.length))] : (isLastCut ? '♪ (Outro / Reverb Tail)' : '新しい明日へ歩き出す'));
      }

      // 映画的カメラアングル＆画角サイクルの解決
      const cineRule = UNIVERSAL_CINE_CYCLE[(i - 1) % UNIVERSAL_CINE_CYCLE.length];
      let shotScale = cineRule.scale;
      let cameraWork = cineRule.cameraWork;
      let cinematicAngle = cineRule.directive;
      let isObjectOnly = false;
      let telopStyle: any = 'mv-kinetic-pop';
      let telopTransition: any = 'gsap-kinetic-stagger';
      let telopPosition: any = 'bottom-center';

      if (i === 1) {
        // ★ 冒頭オープニング構図（ユーザー選定 案A: 曲ごとに表情・バスト・横顔・ドアップをローテーション）
        const rawNum = explicitEpisodeId ?? track.track_no ?? 1;
        const songIdx = Math.max(0, Number(rawNum) - 1);
        const introStyle = songIdx % 4;

        if (introStyle === 0) {
          shotScale = 'Medium Bust Shot';
          cameraWork = 'slow-push-in';
          cinematicAngle = 'Cinematic upper-body bust shot portrait from the chest up, expressive captivating eyes with natural highlights, beautifully styled hair fluttering softly in the ambient breeze, authentic attire details clearly visible, atmospheric scenic background with gorgeous cinematic depth and soft bokeh, perfectly balanced golden-ratio composition, highly aesthetic music video intro';
        } else if (introStyle === 1) {
          shotScale = 'Medium Close-Up Profile';
          cameraWork = 'cinematic-orbit';
          cinematicAngle = 'Artistic medium close-up profile and three-quarter view, gentle turn-back glance towards the camera, emotional silhouette and delicate facial contour, cinematic rim lighting against atmospheric scenic background, breeze blowing through hair, poetic and evocative storytelling frame';
        } else if (introStyle === 2) {
          shotScale = 'Extreme Close-Up';
          cameraWork = 'intimate-macro';
          cinematicAngle = UNIVERSAL_CINE_CYCLE[0].directive;
        } else {
          shotScale = 'Medium Shot';
          cameraWork = 'wide-establishing';
          cinematicAngle = 'Atmospheric medium shot capturing the protagonist standing gracefully within the scenic environment, full upper body and environment in harmonious balance, ambient breeze, cinematic filmic lighting and natural depth of field, poetic introductory scene';
        }
        telopPosition = 'bottom-center';
      } else if (isLastCut) {
        // ★ 不在の余韻 ＆ 無限ループ構図
        shotScale = 'Extreme Wide Panorama';
        cameraWork = 'wide-establishing';
        cinematicAngle = UNIVERSAL_CINE_CYCLE[4].directive;
        telopPosition = 'bottom-center';
      } else if (isPropCut) {
        // ★ 伏線・象徴小道具確定（人物除外・マクロ静物インサート）
        shotScale = 'Still-Life Object Macro';
        cameraWork = 'macro-reveal';
        cinematicAngle = UNIVERSAL_CINE_CYCLE[9].directive;
        isObjectOnly = true;
        telopStyle = 'mv-neon-glow';
        telopPosition = 'bottom-center';
      } else if (isChorus) {
        // ★ サビ演出: カメラワークに動的エナジーを付加
        cameraWork = (i % 2 === 0) ? 'cinematic-orbit' : 'dynamic-pan-zoom';
        telopPosition = 'center-stagger';
      }

      // 🎯 [歌詞動的シチュエーション解析: 構図・カメラワーク連動]
      if (!isPropCut) {
        if (/(ベッド|布団|シーツ|寝転が|ごろん|寝そべ|横たわ|まどろ|毛布|パジャマ|roomwear|bed|futon)/i.test(lyric)) {
          shotScale = 'Overhead Top-Down Bed Shot';
          cameraWork = 'slow-push-in';
          cinematicAngle = 'Top-down overhead perspective looking down from above at the cozy bed, soft wrinkled cotton sheets and plush blankets, subject lounging comfortably with loose hair spreading naturally across the pillows, cinematic warm ambient light';
        } else if (/(船|ボート|甲板|デッキ|航海|波しぶき|大漁|海原|vessel|ocean boat)/i.test(lyric)) {
          shotScale = 'Dynamic Low-Angle Maritime';
          cameraWork = 'handheld-sway';
          cinematicAngle = 'Dynamic low-angle medium shot on a swaying boat deck, high-octane ocean spray catching sunlight, authentic maritime momentum and kinetic energy';
        } else if (/(走る|ダッシュ|疾走|駆け抜け|スプリント|sprint|running)/i.test(lyric)) {
          shotScale = 'Dynamic Tracking Low-Angle';
          cameraWork = 'dynamic-pan-zoom';
          cinematicAngle = 'Dynamic low-angle tracking shot capturing full kinetic forward momentum, athletic motion, wind whipping through hair, dramatic motion blur in peripheral background';
        } else if (/(車|ドライブ|運転|ハンドル|高速道路|夜のハイウェイ|drive|highway)/i.test(lyric)) {
          shotScale = 'Cockpit Medium Shot';
          cameraWork = 'slow-push-in';
          cinematicAngle = 'Cinematic interior car cockpit shot, illuminated dashboard glow, neon city night lights streaking across the windshield, focused hands on steering wheel';
        } else if (/(ステージ|ライブ|マイク|ギター|演奏|スポットライト|stage|spotlight)/i.test(lyric)) {
          shotScale = 'Dynamic Medium Low-Angle';
          cameraWork = 'cinematic-orbit';
          cinematicAngle = 'Dramatic low-angle stage performance shot, brilliant piercing spotlights cutting through atmospheric haze, intense passionate musical energy';
        }
      }

      // 🛡️ [連続顔面アップ防止ガード] 直前と今回がともに顔面/瞳/口元マクロの場合、バストショットまたは全景へ自動シフト
      if (i > 1 && lastShotScale && isFaceMacroScale(lastShotScale, lastCinematicAngle) && isFaceMacroScale(shotScale, cinematicAngle)) {
        shotScale = 'Medium Bust Shot';
        cameraWork = 'slow-push-in';
        cinematicAngle = 'Cinematic upper-body bust shot portrait from the chest up, expressive captivating eyes with natural highlights, beautifully styled hair fluttering softly in the ambient breeze, authentic attire details clearly visible, atmospheric scenic background with gorgeous cinematic depth and soft bokeh, perfectly balanced golden-ratio composition';
      }

      lastShotScale = shotScale;
      lastCinematicAngle = cinematicAngle;

      const hl = extractHighlights(lyric);
      const visualPlot = extractLyricVisualPlot(lyric, hint, track.surface_theme || track.title, i, isPropCut, section);

      const promptEnComponents = [
        `Masterpiece, high production music video, authentic ${masterCat.pool.visual_contract.style_preset}.`,
        visualPlot,
      ];

      // 👘 歌詞連動衣装ダイナミック適応（パジャマ・スポーツウェア・作業着・水着・浴衣・冬服など）
      let dynamicWardrobeDirective = '';
      if (/(パジャマ|ルームウェア|もこもこ|部屋着|寝間着|pajama|roomwear|sleepwear)/i.test(lyric)) {
        dynamicWardrobeDirective = ' [WARDROBE OVERRIDE: wearing cozy oversized fluffy pastel roomwear pajamas]';
      } else if (/(合羽|カッパ|雨具|作業着|slicker|waterproof gear|protective gear)/i.test(lyric)) {
        dynamicWardrobeDirective = ' [WARDROBE OVERRIDE: wearing rugged waterproof oilskin slicker jacket and boots]';
      } else if (/(水着|ビキニ|海水浴|プール|swimwear|bikini)/i.test(lyric)) {
        dynamicWardrobeDirective = ' [WARDROBE OVERRIDE: wearing stylish summer beach swimwear]';
      } else if (/(浴衣|着物|夏祭り|yukata|kimono)/i.test(lyric)) {
        dynamicWardrobeDirective = ' [WARDROBE OVERRIDE: wearing elegant traditional Japanese cotton yukata with decorative obi sash]';
      } else if (/(ジャージ|ユニフォーム|スポーツウェア|ランニングウェア|sportswear|jersey|gym wear)/i.test(lyric)) {
        dynamicWardrobeDirective = ' [WARDROBE OVERRIDE: wearing sleek athletic performance sportswear]';
      } else if (/(エプロン|割烹着|料理|apron)/i.test(lyric)) {
        dynamicWardrobeDirective = ' [WARDROBE OVERRIDE: wearing casual domestic clothes with a stylish fabric apron]';
      } else if (/(コート|ダウン|マフラー|手袋|防寒|winter coat|down jacket|muffler)/i.test(lyric)) {
        dynamicWardrobeDirective = ' [WARDROBE OVERRIDE: wearing thick warm stylish winter coat with individual woolen scarf around neck, strictly separate independent scarves for each person]';
      }

      // キャストDNAおよび表情のインポート（歌詞の普遍的感情セマンティクスから100%動的に決定）
      if (selectedCharacter && !isPropCut && !isLastCut) {
        const lyricLower = (lyric || '').toLowerCase();
        let expressionPrompt = '';

        // 1. 喜び・高揚・はずむ・笑顔・愛着 (Joy & Upbeat Vitality)
        if (/(はずむ|弾む|笑顔|笑う|楽しい|うれしい|スキップ|跳ねる|喜|笑み|あわせて|光|希望|愛|抱きしめ|ぎゅっ|温もり|ぬくもり|手をつな|ふたりで|大好き|幸せ|smile|joy|happy|laugh|bounce|cheerful|love|bliss)/i.test(lyricLower)) {
          expressionPrompt = selectedCharacter.expressions?.['happy']?.promptModifierEn?.trim() || 'radiant genuine beaming smile, sparkling lively eyes, affectionate warm blushes';
        }
        // 2. 切なさ・哀愁・涙・孤独・別れ (Poignant Longing & Pathos)
        else if (/(涙|泣く|サヨナラ|さよなら|消える|遠ざかる|孤独|ひとり|独り|影|切ない|寂しい|雨|夜明け|暗がり|暗い|痛い|傷|悲しい|cry|tear|sad|lonely|heartbreak|grief)/i.test(lyricLower)) {
          expressionPrompt = selectedCharacter.expressions?.['sad']?.promptModifierEn?.trim() || 'poignant emotional gaze, gentle bittersweet sorrow, softly glistening eyes';
        }
        // 3. 驚き・ハッとする・気づき (Awe & Epiphany)
        else if (/(気づく|ハッ|息を呑む|目を見開|驚|奇跡|まさか|突然|急に|surprise|gasp|wide eyes|shock)/i.test(lyricLower)) {
          expressionPrompt = selectedCharacter.expressions?.['surprised']?.promptModifierEn?.trim() || 'wide captivated eyes, slightly parted lips in tender awe';
        }
        // 4. 決意・前進・疾走・情熱 (Resolution & Drive)
        else if (/(走る|駆け|挑む|誓う|信じる|立ち上が|進む|突き進|超えて|未来|明日へ|focus|determined|resolve|passion)/i.test(lyricLower)) {
          expressionPrompt = 'determined resolute gaze, intense focused expression, quiet unwavering confidence';
        }
        // 5. サビ（感情の解放）または平穏（Natural Baseline）
        else {
          const defaultMood = isChorus ? 'happy' : 'neutral';
          expressionPrompt = selectedCharacter.expressions?.[defaultMood]?.promptModifierEn?.trim() || 'gentle natural expression, clear thoughtful gaze, authentic candid presence';
        }

        let cleanDna = selectedCharacter.dnaPromptEn ? selectedCharacter.dnaPromptEn.trim().replace(/\.+$/, '') : '';
        if (dynamicWardrobeDirective) {
          // 衣装指定が歌詞にある場合、高校制服やスーツ等の硬直衣装をストリップしてダイナミック衣装で上書き
          cleanDna = cleanDna
            .replace(/\b(navy blue blazer uniform|blazer uniform|school uniform|blazer|pleated skirt|white collared shirt|loafers?|school bag|backpack)\b/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
          cleanDna = `${cleanDna}${dynamicWardrobeDirective}`;
        }

        const expressionPart = expressionPrompt ? ` [EXPRESSION]: ${expressionPrompt.replace(/\.+$/, '')}.` : '';
        if (cleanDna) {
          promptEnComponents.push(`[PROTAGONIST DNA]: ${cleanDna}.${expressionPart}`);
        }
      }

      // 🏠 情景・ロケーションコンテキスト（歌詞キーワードによる動的ロケーション上書き）
      const isMacroOrDetailCut = isPropCut ||
        shotScale.includes('Close-Up') ||
        shotScale.includes('Mouth') ||
        shotScale.includes('Hands') ||
        shotScale.includes('Footsteps');

      const hasBedroomInLyric = /(ベッド|布団|寝室|部屋の中|パジャマ|シーツ|枕|まどろみ|bedroom|bed)/i.test(lyric);
      const hasConbiniInLyric = /(コンビニ|レジ袋|深夜の明かり|24時間|conbini|convenience store)/i.test(lyric);
      const hasMaritimeInLyric = /(船|甲板|海の上|漁港|波しぶき|大漁|航海|デッキ|vessel|ocean boat|deck)/i.test(lyric);
      const hasKitchenInLyric = /(キッチン|台所|冷蔵庫|フライパン|湯気|kitchen)/i.test(lyric);
      const hasDrivingInLyric = /(車内|高速道路|ハイウェイ|ドライブ|ハンドル|運転席|cockpit|highway)/i.test(lyric);
      const hasStageInLyric = /(ステージ|ライブハウス|コンサート|スポットライト|stage|concert)/i.test(lyric);

      if (hasBedroomInLyric && !isPropCut) {
        promptEnComponents.push(`[INDOOR SCENE OVERRIDE]: Cozy tranquil quiet bedroom interior, soft clean bed sheets, gentle ambient room lighting, serene domestic room.`);
      } else if (hasConbiniInLyric && !isPropCut) {
        promptEnComponents.push(`[LOCATION OVERRIDE]: Convenience store bright fluorescent glow illuminating glass storefront, vivid snack aisles, midnight urban city.`);
      } else if (hasMaritimeInLyric && !isPropCut) {
        promptEnComponents.push(`[MARITIME SCENE OVERRIDE]: Open ocean waters aboard a weathered ship deck, crashing saltwater spray and churning sea.`);
      } else if (hasKitchenInLyric && !isPropCut) {
        promptEnComponents.push(`[LOCATION OVERRIDE]: Warm domestic kitchen interior, soft condensation and gentle cooking steam.`);
      } else if (hasDrivingInLyric && !isPropCut) {
        promptEnComponents.push(`[LOCATION OVERRIDE]: Night highway illuminated by amber streetlights and trailing neon city reflections.`);
      } else if (hasStageInLyric && !isPropCut) {
        promptEnComponents.push(`[LOCATION OVERRIDE]: Vibrant concert stage illuminated by piercing colorful spotlights and atmospheric haze.`);
      } else if (track.scene_context && !isMacroOrDetailCut) {
        promptEnComponents.push(`[WORLD AMBIENCE]: ${track.scene_context.trim().replace(/\.+$/, '')}.`);
      } else if (track.surface_theme && isMacroOrDetailCut && !isPropCut) {
        promptEnComponents.push(`[AMBIENT ATMOSPHERE]: Atmospheric lighting and subtle environment reflecting the world of "${track.surface_theme}".`);
      }

      // 登場人物詳細（character_setting）の画角連動インテリジェント注入
      if (track.character_setting && !isPropCut && !isLastCut) {
        let cleanSettingDna = track.character_setting
          .replace(/\b(standing|standing upright|upright|seated|sitting|holding an? umbrella|holding umbrellas?|with an? umbrella|holding hands?|walking straight|facing camera)\b/gi, '')
          .replace(/(傘を差して|傘を持ち|傘を持った|傘を差す|立っている|佇んでいる|佇む|直立して|正面を向いて)/g, '')
          .replace(/\s{2,}/g, ' ')
          .trim();

        if (dynamicWardrobeDirective) {
          cleanSettingDna = cleanSettingDna
            .replace(/\b(navy blue blazer uniform|blazer uniform|school uniform|blazer|pleated skirt|white collared shirt|loafers?|school bag|backpack)\b/gi, '')
            .replace(/\s{2,}/g, ' ')
            .trim();
        }

        if (cleanSettingDna) {
          if (shotScale.includes('Hands')) {
            promptEnComponents.push(`[TACTILE DETAILS]: Focused on hands, fingers, and tactile gestures matching the character's attire and setting, absolutely NO face.`);
          } else if (shotScale.includes('Footsteps')) {
            promptEnComponents.push(`[GROUND DETAILS]: Focused on footsteps, footwear, and terrain reflecting the setting, ground level only, absolutely NO face.`);
          } else if (shotScale.includes('Close-Up') || shotScale.includes('Profile') || shotScale.includes('Mouth')) {
            cleanSettingDna = cleanSettingDna.replace(/\b(full body|head-to-toe|shoes?|sneakers?|boots?|legs?|feet|bench|chair|seated)\b/gi, '').trim();
            promptEnComponents.push(`[CHARACTER PORTRAIT DETAILS]: ${cleanSettingDna.replace(/\.+$/, '')}.`);
          } else if (shotScale.includes('Wide') || shotScale.includes('Panorama')) {
            promptEnComponents.push(`[CHARACTER IN SCENERY]: Subtle atmospheric silhouette of protagonist, ${cleanSettingDna.replace(/\.+$/, '')}, naturally placed in the expansive landscape.`);
          } else {
            promptEnComponents.push(`[CHARACTER SETTING]: Protagonist, ${cleanSettingDna.replace(/\.+$/, '')}.`);
          }
        }
      }

      // 五感・小道具ディテール（sensory_details）の注入
      if (track.sensory_details && (isPropCut || shotScale.includes('Hands'))) {
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
        angle: c.cinematicAngle || c.cameraWork,
        prompt: c.promptEn
      })), shotScale) : '';

      // クリーンな絵コンテフィールド（Step 3コンパイラ用）
      const cleanAction = visualPlot;
      const cleanImagePrompt = visualPlot;
      const cleanLighting = hint || track.scene_context || '';
      const cleanComposition = `${shotScale}, ${cinematicAngle}`;

      cuts.push({
        id: i,
        promptEn: promptEn,
        cleanAction,
        cleanImagePrompt,
        cleanLighting,
        cleanComposition,
        negativePrompt: dynamicAntiPrev,
        narrationJp: lyric,
        narrationEn: '',
        shotScale: shotScale,
        cameraWork: cameraWork,
        cinematicAngle: cinematicAngle,
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
    characterDna: track.character_setting 
      ? track.character_setting
      : (selectedCharacter ? selectedCharacter.dnaPromptEn : undefined),
    extractedSongDna: undefined,
    characterTurnaroundBase64: selectedCharacter ? (selectedCharacter.turnaroundBase64 || selectedCharacter.avatarBase64) : undefined,
    characterTurnaroundMediaId: selectedCharacter ? selectedCharacter.turnaroundMediaId : undefined,
    characterTurnaroundPrompt: selectedCharacter ? selectedCharacter.turnaroundPromptEn : undefined,
    coverThemeVariant: coverThemeVariant,
    soundPrompt: track.sound_prompt,
    musicStyle: track.style,
    instrumentalTrack: track.instrumental_track
  };
}
