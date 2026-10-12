import { Episode, Cut, ProductionMode } from '../types';
import { extractHighlights } from './directorService';
import { resolveMasterCategory } from '../config/masterCategories';
import { CAMERA_WORK_REGISTRY } from '../constants';

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
  bpm?: number;
  surface_theme?: string;
  hidden_drama?: string;
  visual_hints?: string;
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
 * CT198からエクスポートされたJSONテキスト（単体または配列）をパースして正規化
 */
export function parseMusicTracksJson(rawText: string): ImportedTrack[] {
  try {
    const parsed = JSON.parse(rawText.trim());
    let list: any[] = [];
    if (Array.isArray(parsed)) {
      list = parsed;
    } else if (parsed && Array.isArray(parsed.tracks)) {
      list = parsed.tracks;
    } else if (parsed && typeof parsed === 'object') {
      list = [parsed];
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
        track_no: item.track_no || idx + 1,
        title: item.title || '無題のトラック',
        format: item.format || '🎵 音楽MV (12カット)',
        track_type: item.track_type || 'Vocal',
        pool_code: poolCode,
        style_code: styleCode,
        taste: item.taste || 'youth_pop',
        bpm: Number(item.bpm) || 125,
        surface_theme: item.surface_theme || '',
        hidden_drama: item.hidden_drama || '',
        visual_hints: item.visual_hints || '',
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
    console.error('Failed to parse music tracks JSON:', err);
    throw new Error(`JSONの解析に失敗しました: ${err.message}`);
  }
}

/**
 * visual_hints 文字列（例: "Cut 1-3: [...], Cut 4-9: [...], Cut 10: [★...], Cut 11-12: [...]"）をカット番号（1〜12）へマッピング
 */
export function parseVisualHints(visualHintsText: string): Record<number, string> {
  const map: Record<number, string> = {};
  if (!visualHintsText) return map;

  // 正規表現: Cut\s*(\d+)(?:-(\d+))?:\s*\[([^\]]+)\]
  const regex = /Cut\s*(\d+)(?:\s*[-〜~]\s*(\d+))?:\s*\[([^\]]+)\]/gi;
  let match;
  while ((match = regex.exec(visualHintsText)) !== null) {
    const startCut = parseInt(match[1], 10);
    const endCut = match[2] ? parseInt(match[2], 10) : startCut;
    const content = match[3].trim();

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
 * CT198のインポートトラックから、FlowToolの完全な 12カット MV Episode を自動錬成
 */
export function convertTrackToEpisode(track: ImportedTrack): Episode {
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
    2: lyricsSec['verse1']?.slice(0, 2).join(' ') || '冷たい床に伸びる影',
    3: lyricsSec['verse1']?.slice(2, 4).join(' ') || 'べたつく音が響くたび',
    4: lyricsSec['prechorus']?.slice(0, 2).join(' ') || '広くなった空間は',
    5: chorusLines[0] || '透き通る風が駆け抜けて',
    6: chorusLines[1] || '何もない部屋に日が落ちる',
    7: chorusLines[2] || '右手に残る錆びた艶',
    8: chorusLines[3] || '開かない扉の幻を',
    9: lyricsSec['verse2']?.slice(0, 2).join(' ') || '隅に落ちてた銀の粒',
    10: lyricsSec['bridge']?.slice(0, 2).join(' ') || 'あの日置いてった銀の爪',
    11: lyricsSec['final_chorus']?.slice(0, 2).join(' ') || '新しい明日へ歩き出す',
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
      shotScale = 'Cinematic Wide';
      cameraWork = 'cinematic-pan';
    } else if (i === 2 || i === 3) {
      shotScale = 'Medium Close-Up';
      cameraWork = 'push-in';
    } else if (i === 4) {
      shotScale = 'Dutch Angle Medium';
      cameraWork = 'dutch-tilt';
    } else if (isChorus) {
      shotScale = i === 5 ? 'Extreme Wide' : (i === 6 ? 'Medium Dynamic' : (i === 7 ? 'Close-Up' : 'Wide Dynamic'));
      cameraWork = i % 2 === 0 ? 'cinematic-orbit' : 'dynamic-pan-zoom';
      telopPosition = 'center-stagger';
    } else if (i === 9) {
      shotScale = 'Low Angle Medium';
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
      shotScale = 'Extreme Wide';
      cameraWork = 'crane-up-fade';
    }

    const hl = extractHighlights(lyric);
    const promptEn = [
      `Masterpiece, high production music video, authentic ${masterCat.pool.visual_contract.style_preset},`,
      `${hint || track.surface_theme || track.title}.`,
      isPropCut 
        ? `Extreme close-up macro product photography of the key symbolic prop (${hint.replace('★', '')}), shallow depth of field, dramatic dust motes in sunbeam, dramatic reflections.` 
        : `Atmospheric cinematography, 8k resolution, cinematic lighting, photorealistic texture.`
    ].join(' ');

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
      telop: {
        fullText: lyric,
        highlights: hl,
        style: telopStyle,
        transition: telopTransition,
        position: telopPosition,
        directorNote: hint ? `[CT198 Direct] ${hint}` : `Music Video Cut #${i}`
      }
    });
  }

  const episodeId = track.track_no || 1;
  const uniqueId = `ep_mv_${Date.now()}_${track.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`;

  return {
    id: episodeId,
    internalId: uniqueId,
    titleJp: track.title,
    titleEn: track.title,
    summary: track.hidden_drama || track.surface_theme || '',
    theme: track.surface_theme || track.title,
    taste: track.taste || 'youth_pop',
    isMvMode: true,
    productionMode: 'mv',
    cuts: cuts,
    isGenerating: false,
    isGeneratingRemainingImages: false,
    isBatchGeneratingVideos: false,
    isPreviewDone: false,
    isDone: false,
    coverCatchphraseJp: track.title,
    coverCatchphraseEn: track.title
  };
}
