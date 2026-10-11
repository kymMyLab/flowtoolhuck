import { Episode } from '../../types';
import { CUTS_PER_EPISODE, TASTES } from '../../constants';
import { loadCustomTastes } from '../tasteStorage';
import { createDefaultCut, isCutSelectedForVideo } from '../utils';
import { generateSafeEpisodeScript } from '../directorService';
import { ProductionPipelineContext } from './pipelineTypes';
import { createPipelineCut } from './pipelineCutFactory';

/**
 * ── 1. 画風比較（Style Matrix）制作パイプライン ──
 * 同じ物語の脚本で、最大N種類の画風を同時に比較生成
 */
export async function runStyleMatrixProduction(ctx: ProductionPipelineContext): Promise<void> {
  const { settings, addLog, isAbortedRef, episodesRef, setEpisodes, updateEpisode, runTasks, buildCutTasks } = ctx;

  const customTastes = loadCustomTastes();
  const allTasteKeys = Object.keys({ ...TASTES, ...customTastes });
  const targetTastes = allTasteKeys.slice(0, settings.episodeCount);
  addLog(`🎨 【画風比較モード】同じ物語で ${targetTastes.length} 種類の画風を同時生成・比較します！`, 'process');

  // 既存エピソードが存在するか確認（画面上にあるエピソードの脚本を最優先で100%流用）
  const existingEp = episodesRef.current.find(e => e.cuts && e.cuts.some(c => c.narrationJp || c.promptEn));
  
  let sharedScript: any = null;
  let baseCutsData: any[] = [];

  if (existingEp) {
    const cleanTitleJp = existingEp.titleJp.replace(/^【.*?】\s*/, '');
    addLog(`📖 画面上のエピソード『${cleanTitleJp}』の脚本（全${existingEp.cuts.length}カット）をそのまま各画風へ展開します！`, 'success');

    sharedScript = {
      titleJp: cleanTitleJp,
      titleEn: existingEp.titleEn || 'The Story',
      summary: existingEp.summary || '',
      eraAnalysisJp: existingEp.eraAnalysis || '',
      forbiddenAnachronisms: existingEp.forbiddenAnachronisms || [],
      authenticAttireEn: existingEp.authenticAttireEn || '',
      forbiddenKeywordsEn: existingEp.forbiddenKeywordsEn || '',
      coverCatchphraseJp: existingEp.coverCatchphraseJp || '',
      coverCatchphraseEn: existingEp.coverCatchphraseEn || '',
      highlightWords: existingEp.highlightWords || []
    };

    baseCutsData = existingEp.cuts.map((c, j) => ({
      id: c.id,
      narration: c.narrationJp,
      plot: c.promptEn || c.scenePlot || '',
      highlights: c.telop?.highlights || [],
      isSelected: isCutSelectedForVideo(j, settings.videoRatio)
    }));
  } else {
    // 既存がない場合は新規に1話分のマスター脚本を策定
    addLog(`📖 画風比較用の共通マスター脚本（全12カット）をAIに執筆依頼中... [テーマ: ${settings.theme}]`, 'process');
    const masterPlan = {
      epNumber: 1,
      titleJp: settings.theme.split('（')[0].replace(/^[^\w\s一-龯]+/, '').trim() || '美しき瞬間',
      titleEn: 'Cinematic Story',
      summary: `${settings.theme}をテーマにした映像美の追求`
    };

    sharedScript = await generateSafeEpisodeScript({
      epId: 1,
      currentPlan: masterPlan,
      country: settings.country,
      theme: settings.theme,
      era: settings.era,
      isMangaMode: false,
      isMvMode: false,
      taste: settings.taste,
      productionMode: 'style-matrix',
      isMultiPanel: settings.isMultiPanel,
      superBackoff: settings.superBackoff,
      abortCheck: () => isAbortedRef.current,
      addLog
    });

    addLog(`✨ 共通マスター脚本『${sharedScript.titleJp}』が完成しました！`, 'success');

    baseCutsData = Array.from({ length: CUTS_PER_EPISODE }, (_, j) => {
      const cutData = sharedScript.cuts[j] || {} as any;
      return createPipelineCut(j, cutData, sharedScript, settings, 'style-matrix', false, false);
    });
  }

  // 画風比較エピソードカード群の初期化
  const matrixEpisodes: Episode[] = targetTastes.map((tasteKey, idx) => {
    const epId = idx + 1;
    const shortTaste = tasteKey.split(' (')[0].trim();
    return {
      id: epId,
      internalId: crypto.randomUUID(),
      titleJp: `【${shortTaste}】${sharedScript.titleJp}`,
      titleEn: sharedScript.titleEn,
      summary: sharedScript.summary,
      characterDna: sharedScript.characterDna,
      eraAnalysis: sharedScript.eraAnalysisJp,
      forbiddenAnachronisms: sharedScript.forbiddenAnachronisms,
      authenticAttireEn: sharedScript.authenticAttireEn,
      forbiddenKeywordsEn: sharedScript.forbiddenKeywordsEn,
      coverCatchphraseJp: sharedScript.coverCatchphraseJp,
      coverCatchphraseEn: sharedScript.coverCatchphraseEn,
      highlightWords: sharedScript.highlightWords || [],
      cuts: baseCutsData.map(c => {
        const cut = createDefaultCut(c.id, c.narration, c.plot, c.isSelected);
        cut.telop.highlights = c.highlights;
        return cut;
      }),
      isGenerating: true,
      isGeneratingRemainingImages: false,
      isBatchGeneratingVideos: false,
      isPreviewDone: false,
      isDone: false,
      taste: tasteKey,
      era: existingEp?.era || settings.era,
      theme: existingEp?.theme || settings.theme
    };
  });
  setEpisodes(matrixEpisodes);

  // 各画風ごとにカットを描画
  for (let idx = 0; idx < targetTastes.length; idx++) {
    if (isAbortedRef.current) break;
    const epId = idx + 1;
    const tasteKey = targetTastes[idx];
    const shortTaste = tasteKey.split(' (')[0].trim();

    const compareCutCount = 2; // 画風比較は強制2カット（動画化なし）
    addLog(`🎨 [${idx + 1}/${targetTastes.length}] 画風「${shortTaste}」の比較描画タスクを開始...（固定2カット）`, 'process');
    const currentEp = matrixEpisodes[idx];
    await runTasks(buildCutTasks(currentEp, currentEp.cuts.slice(0, compareCutCount), tasteKey));
    updateEpisode(epId, { isGenerating: false, isPreviewDone: true, isDone: true });
    addLog(`✅ 画風「${shortTaste}」の生成が完了しました！`, 'success');
  }

  if (!isAbortedRef.current) {
    addLog(`🎉 全 ${targetTastes.length} 種類の画風比較生成が完了しました！`, 'success');
  }
}
