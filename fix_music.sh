#!/bin/bash
cat << 'PATCH_EOF' > fix_music.diff
<<<<<<< SEARCH
import { Episode, Cut, ProductionMode } from '../types';
import { extractHighlights } from './directorService';
=======
import { Episode, Cut, ProductionMode, CastCharacter, ExpressionType } from '../types';
import { extractHighlights } from './directorService';
>>>>>>> REPLACE
<<<<<<< SEARCH
    case 8:
      defaultCutAction = 'Cinematic wide climax, protagonist walking forward through the glowing hallway, seen from behind or three-quarter view, bathed in dramatic illumination, resolute forward motion';
    case 9:
=======
    case 8:
      defaultCutAction = 'Cinematic wide climax, protagonist walking forward through the glowing hallway, seen from behind or three-quarter view, bathed in dramatic illumination, resolute forward motion';
      break;
    case 9:
>>>>>>> REPLACE
<<<<<<< SEARCH
/**
 * CT198のインポートトラックから、FlowToolの完全な 12カット MV Episode を自動錬成
 */
export function convertTrackToEpisode(track: ImportedTrack, videoRatio: string = '30%'): Episode {
  const visualMap = parseVisualHints(track.visual_hints || '');
=======
/**
 * CT198のインポートトラックから、FlowToolの完全な 12カット MV Episode を自動錬成
 */
export function convertTrackToEpisode(track: ImportedTrack, videoRatio: string = '30%', selectedCharacter?: CastCharacter): Episode {
  const visualMap = parseVisualHints(track.visual_hints || '');
>>>>>>> REPLACE
<<<<<<< SEARCH
    const hl = extractHighlights(lyric);
    const visualPlot = extractLyricVisualPlot(lyric, hint, track.surface_theme || track.title, i, isPropCut);

    const promptEn = [
      `Masterpiece, high production music video, authentic ${masterCat.pool.visual_contract.style_preset},`,
      visualPlot,
      isPropCut
        ? `Shallow depth of field, dramatic dust motes in sunbeam, crisp macro reflections.`
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
      isSelectedForVideo: isCutSelectedForVideo(i - 1, videoRatio),
=======
    const hl = extractHighlights(lyric);
    const visualPlot = extractLyricVisualPlot(lyric, hint, track.surface_theme || track.title, i, isPropCut);

    let finalPromptEn = [
      `Masterpiece, high production music video, authentic ${masterCat.pool.visual_contract.style_preset},`,
      visualPlot,
      isPropCut
        ? `Shallow depth of field, dramatic dust motes in sunbeam, crisp macro reflections.`
        : `Atmospheric cinematography, 8k resolution, cinematic lighting, photorealistic texture.`
    ].join(' ');

    // ★ CAST DNA & EXPRESSION SYNC (if selected)
    if (selectedCharacter && !isPropCut && i !== 12) {
      // Expression modifier
      let expMod = selectedCharacter.expressions['neutral']?.promptModifierEn || '';
      if (i === 1) {
        expMod = selectedCharacter.expressions['sad']?.promptModifierEn || selectedCharacter.expressions['neutral']?.promptModifierEn || '';
      } else if (i === 4) {
        expMod = selectedCharacter.expressions['neutral']?.promptModifierEn || '';
      } else if (i >= 5 && i <= 8) {
        expMod = selectedCharacter.expressions['happy']?.promptModifierEn || selectedCharacter.expressions['neutral']?.promptModifierEn || '';
      } else if (i === 11) {
        expMod = selectedCharacter.expressions['happy']?.promptModifierEn || selectedCharacter.expressions['neutral']?.promptModifierEn || '';
      }

      const dnaInjection = `[PROTAGONIST DNA]: ${selectedCharacter.dnaPromptEn}. ${expMod}`;
      finalPromptEn = `${dnaInjection} ${finalPromptEn}`;
    }

    cuts.push({
      id: i,
      promptEn: finalPromptEn,
      narrationJp: lyric,
      narrationEn: '',
      shotScale: shotScale,
      cameraWork: cameraWork,
      isObjectOnly: isObjectOnly,
      panelLayout: isPropCut ? 'single' : (isChorus ? 'diagonal-slash' : 'single'),
      focalPoint: isPropCut ? { grid: 'center', normalizedCoord: [0.5, 0.5], focalSubject: 'key_prop' } : undefined,
      // @ts-ignore
      duration: isChorus ? 7.5 : 5.0,
      isSelectedForVideo: isCutSelectedForVideo(i - 1, videoRatio),
>>>>>>> REPLACE
<<<<<<< SEARCH
  const episodeId = track.track_no || 1;
  const uniqueId = `ep_mv_${Date.now()}_${track.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`;

  return {
    id: episodeId,
    internalId: uniqueId,
=======
  const episodeId = track.track_no || 1;
  const uniqueId = `ep_mv_${Date.now()}_${track.id.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)}`;

  const episode: Episode = {
    id: episodeId,
    internalId: uniqueId,
>>>>>>> REPLACE
<<<<<<< SEARCH
    isDone: false,
    coverCatchphraseJp: track.title,
    coverCatchphraseEn: track.title
  };
}
=======
    isDone: false,
    coverCatchphraseJp: track.title,
    coverCatchphraseEn: track.title
  };

  if (selectedCharacter) {
    episode.characterDna = selectedCharacter.dnaPromptEn;
    episode.characterTurnaroundBase64 = selectedCharacter.turnaroundBase64 || selectedCharacter.avatarBase64;
    episode.characterTurnaroundMediaId = selectedCharacter.turnaroundMediaId;
    episode.characterTurnaroundPrompt = selectedCharacter.turnaroundPromptEn;
  }

  return episode;
}
>>>>>>> REPLACE
PATCH_EOF
patch src/services/musicImporter.ts fix_music.diff
