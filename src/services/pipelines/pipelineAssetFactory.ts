import { Flow } from 'flow-sdk';
import { Episode } from '../../types';
import { resolveImageModel } from '../../constants';
import { callWithRetry, formatErrorMessage, extractImageBase64, extractMediaId } from '../utils';
import { ProductionPipelineContext } from './pipelineTypes';
import { 
  buildCharacterTurnaroundPrompt, 
  buildAdaptiveInfographicCoverPrompt, 
  cleanEpisodeTitle, 
  cleanEpisodeTitleEn 
} from '../directorService';

/**
 * 主人公キャラクターの三面図マスターシートを生成・登録
 */
export async function ensureCharacterTurnaround(
  ctx: ProductionPipelineContext,
  ep: Episode
): Promise<{ mediaId?: string; base64?: string }> {
  const { settings, addLog, activeReferenceRef } = ctx;

  // すでに三面図または保管庫参照画像があればスキップ
  if (ep.characterTurnaroundMediaId) {
    return { mediaId: ep.characterTurnaroundMediaId, base64: ep.characterTurnaroundBase64 };
  }
  if (activeReferenceRef.current?.mediaId) {
    return { mediaId: activeReferenceRef.current.mediaId };
  }

  // 三面図が無効化されている場合はスキップ
  if (settings.enableTurnaroundSheet === false) {
    return {};
  }

  try {
    addLog(`🎨 【三面図マスター生成】360度キャラ一貫性を保証する主人公の三面図（正面・横顔・後ろ姿）を設計中...`, 'process');
    const turnaroundPrompt = buildCharacterTurnaroundPrompt(
      settings.theme,
      settings.country,
      settings.era,
      settings.taste,
      ep.characterDna
    );

    const modelDef = resolveImageModel(settings.imageModel);
    let safePrompt = turnaroundPrompt && /[a-zA-Z0-9]/.test(turnaroundPrompt) ? turnaroundPrompt : 'Character turnaround sheet, front side back views';
    const safeModelName = modelDef?.name || 'imagen-3.0-generate-002';

    const res = await callWithRetry<any>(
      () => Flow.generate.image({
        prompt: safePrompt,
        modelDisplayName: safeModelName,
        aspectRatio: '16:9' as any
      }),
      undefined,
      4
    );

    const base64 = extractImageBase64(res);
    const mediaId = extractMediaId(res);

    if (mediaId || base64) {
      addLog(`✨ 【三面図マスター確定】主人公の三面図シートが完成！全カットの基準アセットとして登録しました。`, 'success');
      return { mediaId, base64 };
    }
  } catch (err: any) {
    addLog(`⚠️ 三面図の自動生成をスキップし通常描画を継続します: ${formatErrorMessage(err)}`, 'warning');
  }

  return {};
}

/**
 * 世界観適応インフォグラフィック扉絵（9:16特大ポスター）を自動生成・登録
 * （Google AI Ultra Direct により、Cut 1マスターアンカーを参照しつつ上部25%看板＋下部被りゼロ配置の本格アートを描画）
 */
export async function ensureInfographicCover(
  ctx: ProductionPipelineContext,
  ep: Episode,
  force = false
): Promise<{ mediaId?: string; base64?: string; promptEn?: string }> {
  const { settings, addLog, isAbortedRef, activeReferenceRef, updateEpisode, episodesRef, setEpisodes } = ctx;

  if (isAbortedRef.current) return {};

  const freshEp = episodesRef.current.find(e => e.id === ep.id) || ep;
  if (!force && (freshEp.coverMediaId || freshEp.coverBase64)) {
    return { mediaId: freshEp.coverMediaId, base64: freshEp.coverBase64, promptEn: freshEp.coverPromptEn };
  }

  try {
    addLog(`🎨 Ep.${freshEp.id}: 【扉絵自動生成】世界観適応インフォグラフィック扉絵（9:16特大ポスター）を描画中...`, 'process');
    updateEpisode(freshEp.id, { isGeneratingCover: true });

    const coverPromptObj = buildAdaptiveInfographicCoverPrompt({
      titleJp: cleanEpisodeTitle(freshEp.titleJp),
      titleEn: cleanEpisodeTitleEn(freshEp.titleEn),
      coverCatchphraseJp: cleanEpisodeTitle(freshEp.coverCatchphraseJp),
      coverCatchphraseEn: cleanEpisodeTitleEn(freshEp.coverCatchphraseEn),
      theme: freshEp.theme || settings.theme,
      era: freshEp.era || settings.era,
      taste: freshEp.taste || settings.taste,
      country: settings.country,
      productionMode: freshEp.productionMode || settings.productionMode,
      characterDna: freshEp.characterDna,
      styleDna: activeReferenceRef.current?.styleDna,
      forbiddenAnachronisms: freshEp.forbiddenAnachronisms,
      authenticAttireEn: freshEp.authenticAttireEn
    });

    // 参照画像があれば渡す（Cut 1マスターアンカー、または三面図、または手動リファレンス）
    const refMediaIds: string[] = [];
    if (freshEp.masterAnchorMediaId) {
      refMediaIds.push(freshEp.masterAnchorMediaId);
    } else if (freshEp.characterTurnaroundMediaId) {
      refMediaIds.push(freshEp.characterTurnaroundMediaId);
    } else if (activeReferenceRef.current?.mediaId) {
      refMediaIds.push(activeReferenceRef.current.mediaId);
    }

    const modelDef = resolveImageModel(settings.imageModel);
    let safePrompt = coverPromptObj.promptEn && /[a-zA-Z0-9]/.test(coverPromptObj.promptEn) ? coverPromptObj.promptEn : 'Cinematic poster, high quality';
    const safeModelName = modelDef?.name || 'imagen-3.0-generate-002';

    const res = await callWithRetry<any>(
      () => Flow.generate.image({
        prompt: safePrompt,
        negativePrompt: coverPromptObj.negativePromptEn,
        modelDisplayName: safeModelName,
        aspectRatio: '9:16' as any,
        referenceImageMediaIds: refMediaIds.length > 0 ? refMediaIds : undefined
      }),
      undefined,
      4
    );

    const coverBase64 = extractImageBase64(res);
    const coverMediaId = extractMediaId(res);

    if (coverMediaId || coverBase64) {
      updateEpisode(freshEp.id, {
        coverMediaId: coverMediaId,
        coverBase64: coverBase64,
        coverPromptEn: coverPromptObj.promptEn,
        isGeneratingCover: false
      });
      episodesRef.current = episodesRef.current.map(e => e.id === freshEp.id ? {
        ...e,
        coverMediaId: coverMediaId,
        coverBase64: coverBase64,
        coverPromptEn: coverPromptObj.promptEn,
        isGeneratingCover: false
      } : e);
      setEpisodes(prev => prev.map(e => e.id === freshEp.id ? {
        ...e,
        coverMediaId: coverMediaId,
        coverBase64: coverBase64,
        coverPromptEn: coverPromptObj.promptEn,
        isGeneratingCover: false
      } : e));

      addLog(`✨ Ep.${freshEp.id}: 【扉絵自動生成完了】世界観適応インフォグラフィック扉絵が完成しました！（被りゼロ本格ポスター）`, 'success');
      return { mediaId: res.mediaId, base64: res.base64, promptEn: coverPromptObj.promptEn };
    }
  } catch (err: any) {
    updateEpisode(freshEp.id, { isGeneratingCover: false });
    addLog(`⚠️ Ep.${freshEp.id}: 扉絵の自動生成スキップ: ${formatErrorMessage(err)}`, 'warning');
  }

  return {};
}
