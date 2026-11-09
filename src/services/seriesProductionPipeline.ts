import { 
  Episode, 
  Cut, 
  SeriesEpisodePlan, 
  GeneratorSettings, 
  ProductionPipelineContext, 
  SeriesManifest, 
  cleanupEpisodeMemory, 
  SHORTS_CONFIG_MAP 
} from '../types';
import { 
  SAFE_CHARACTERS, 
  CUTS_PER_EPISODE, 
  resolveImageModel, 
  resolveRecommendedCameraWorkAndKenBurns, 
  resolveRecommendedTelopStaging 
} from '../constants';
import { 
  createDefaultCut, 
  safeJsonParse, 
  callWithRetry, 
  formatErrorMessage, 
  extractImageBase64, 
  extractMediaId,
  sleepWithAbortCheck
} from './utils';
import { 
  generateSafeEpisodeScript, 
  checkIsHistorical, 
  buildGrandDesignChunkPrompt, 
  buildNextEpisodePlanPrompt, 
  cleanEpisodeTitle, 
  cleanEpisodeTitleEn, 
  extractHighlights, 
  sanitizeForYouTubeSafety, 
  buildCharacterTurnaroundPrompt, 
  buildAdaptiveInfographicCoverPrompt,
  FALLBACK_EPISODE_SUBTITLES
} from './directorService';
import { getStoryboardPreset } from './promptEngine';
import { downloadZip } from './zipPackager';
import { Flow } from 'flow-sdk';
export { cleanupEpisodeMemory, SHORTS_CONFIG_MAP };
/**
 * ── 1. パイプライン内カット生成ファクトリ ──
 */
export function createPipelineCut(
  cutIndex: number,
  cutData: any,
  sharedScript: any,
  settings: GeneratorSettings,
  effectiveMode: string,
  isMv: boolean,
  isManga: boolean
): Cut {
  const narration = cutData.narrationJp || '';
  const plot = cutData.basicPlot || '';
  const cut = createDefaultCut(cutIndex + 1, narration, plot, false);
  cut.panelLayout = 'single';
  const preset = getStoryboardPreset(cutIndex + 1, isMv, isManga);
  cut.shotScale = preset.scale;
  cut.cinematicAngle = preset.angle;
  const cwDef = resolveRecommendedCameraWorkAndKenBurns(cutIndex + 1, effectiveMode, isMv, isManga);
  cut.cameraWork = cwDef.id;
  cut.cameraMotion = cwDef.motionPrompt;
  cut.kenBurnsPreset = cwDef.recommendedKenBurns;
  const dramaStaging = resolveRecommendedTelopStaging(cutIndex + 1, isMv, false, undefined, effectiveMode);
  Object.assign(cut.telop, dramaStaging);
  cut.telop.highlights = extractHighlights(narration, cutData.highlights || sharedScript.highlightWords);
  cut.isObjectOnly = settings.enableObjectCut !== false ? (cutData.isObjectOnly || false) : false;
  cut.focalPoint = cutData.focalPoint;
  cut.compositionPrompt = cutData.compositionPrompt;
  cut.veoMotionPrompt = cutData.veoMotionPrompt;
  cut.endFramePromptEn = cutData.endFramePlot;
  return cut;
}
/**
 * ── 2. 主人公キャラクターの三面図マスターシート生成 ──
 */
export async function ensureCharacterTurnaround(
  ctx: ProductionPipelineContext,
  ep: Episode
): Promise<{ mediaId?: string; base64?: string }> {
  const { settings, addLog, activeReferenceRef } = ctx;
  if (ep.characterTurnaroundMediaId) {
    return { mediaId: ep.characterTurnaroundMediaId, base64: ep.characterTurnaroundBase64 };
  }
  if (!ep.isMvMode && !settings.isMvMode && activeReferenceRef.current?.mediaId) {
    return { mediaId: activeReferenceRef.current.mediaId };
  }
  if (settings.enableTurnaroundSheet === false) return {};
  try {
    const charId = ep.characterId || settings.characterId;
    const fixedChar = (charId && charId !== 'auto') ? SAFE_CHARACTERS.find(c => c.id === charId) : undefined;
    addLog(`🎨 【三面図マスター生成】主人公（${fixedChar ? fixedChar.nameJa : '主人公'}）の三面図を設計中...`, 'process');
    const turnaroundPrompt = buildCharacterTurnaroundPrompt(
      ep.theme || settings.theme,
      settings.country,
      ep.era || settings.era,
      ep.taste || settings.taste,
      fixedChar?.dnaPromptEn || ep.characterDna,
      charId
    );
    const modelDef = resolveImageModel(settings.imageModel);
    const safePrompt = turnaroundPrompt && /[a-zA-Z0-9]/.test(turnaroundPrompt) ? turnaroundPrompt : 'Character turnaround sheet, front side back views';
    let safeModelName = modelDef?.name || '🍌 Nano Banana Pro';
    let res: any;
    try {
      res = await callWithRetry<any>(
        () => Flow.generate.image({
          prompt: safePrompt,
          modelDisplayName: safeModelName,
          aspectRatio: '16:9' as any
        }),
        (attempt, max, delay, err) => {
          const errMsg = formatErrorMessage(err);
          if (errMsg.includes('使用量の上限') || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED')) {
            safeModelName = '🍌 Nano Banana Pro';
            addLog(`👑 【三面図】上限検知！「🍌 Nano Banana Pro」へ自動昇格します`, 'success');
          }
        },
      );
    } catch (_) {
      safeModelName = '🍌 Nano Banana Pro';
      res = await Flow.generate.image({
        prompt: safePrompt,
        modelDisplayName: safeModelName,
        aspectRatio: '16:9' as any
      });
    }
    let base64 = extractImageBase64(res);
    const mediaId = extractMediaId(res);
    if (!base64 && mediaId && typeof (Flow as any)?.media?.getBase64 === 'function') {
      try { base64 = extractImageBase64(await (Flow as any).media.getBase64(mediaId)); } catch (_) {}
    }
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
 * ── 3. 世界観適応 9:16縦型扉絵 ＆ 16:9横型マスターカバーの自動生成 ──
 */
export async function ensureInfographicCover(
  ctx: ProductionPipelineContext,
  ep: Episode,
  force = false
): Promise<{ 
  coverVertical?: { mediaId?: string; base64?: string };
  coverHorizontal?: { mediaId?: string; base64?: string };
}> {
  const { settings, addLog, isAbortedRef, activeReferenceRef, updateEpisode, episodesRef, setEpisodes } = ctx;
  if (isAbortedRef.current) return {};
  const freshEp = episodesRef.current.find((e: Episode) => e.id === ep.id) || ep;
  const hasVertical = !!(freshEp.coverMediaId || freshEp.coverBase64);
  const hasHorizontal = !!(freshEp.coverHorizontalMediaId || freshEp.coverHorizontalBase64);
  if (!force && hasVertical && hasHorizontal) {
    return {
      coverVertical: { mediaId: freshEp.coverMediaId, base64: freshEp.coverBase64 },
      coverHorizontal: { mediaId: freshEp.coverHorizontalMediaId, base64: freshEp.coverHorizontalBase64 }
    };
  }
  try {
    addLog(`🎨 Ep.${freshEp.id}: 【扉絵＆16:9看板生成】世界観適応の9:16縦扉絵および16:9マスターカバーを描画中...`, 'process');
    updateEpisode(freshEp.id, { isGeneratingCover: true });
    const charId = freshEp.characterId || settings.characterId;
    const fixedChar = (charId && charId !== 'auto') ? SAFE_CHARACTERS.find(c => c.id === charId) : undefined;
    
    const refMediaIds: string[] = [];
    if (freshEp.masterAnchorMediaId) {
      refMediaIds.push(freshEp.masterAnchorMediaId);
    } else if (freshEp.characterTurnaroundMediaId) {
      refMediaIds.push(freshEp.characterTurnaroundMediaId);
    } else if (activeReferenceRef.current?.mediaId) {
      refMediaIds.push(activeReferenceRef.current.mediaId);
    }
    const modelDef = resolveImageModel(settings.imageModel);
    let safeModelName = modelDef?.name || '🍌 Nano Banana Pro';
    let verticalMediaId = freshEp.coverMediaId;
    let verticalBase64 = freshEp.coverBase64;
    let verticalPromptEn = freshEp.coverPromptEn;
    let horizontalMediaId = freshEp.coverHorizontalMediaId;
    let horizontalBase64 = freshEp.coverHorizontalBase64;
    let horizontalPromptEn = freshEp.coverHorizontalPromptEn;
    // A. 9:16 縦ロング扉絵の生成
    if (force || !hasVertical) {
      const coverPromptObj = buildAdaptiveInfographicCoverPrompt({
        titleJp: cleanEpisodeTitle(freshEp.titleJp),
        titleEn: cleanEpisodeTitleEn(freshEp.titleEn),
        coverCatchphraseJp: cleanEpisodeTitle(freshEp.coverCatchphraseJp || ''),
        coverCatchphraseEn: cleanEpisodeTitleEn(freshEp.coverCatchphraseEn || ''),
        theme: freshEp.theme || settings.theme,
        era: freshEp.era || settings.era,
        taste: freshEp.taste || settings.taste,
        country: settings.country,
        productionMode: freshEp.productionMode || settings.productionMode,
        characterDna: fixedChar?.dnaPromptEn || freshEp.characterDna,
        styleDna: activeReferenceRef.current?.styleDna,
        forbiddenAnachronisms: freshEp.forbiddenAnachronisms,
        authenticAttireEn: freshEp.authenticAttireEn,
        isHorizontal: false
      });
      verticalPromptEn = coverPromptObj.promptEn;
      try {
        const resV: any = await Flow.generate.image({
          prompt: coverPromptObj.promptEn,
          modelDisplayName: safeModelName,
          aspectRatio: '9:16' as any,
          referenceImageMediaIds: refMediaIds.length > 0 ? refMediaIds : undefined
        });
        verticalBase64 = extractImageBase64(resV);
        verticalMediaId = extractMediaId(resV);
        if (!verticalBase64 && verticalMediaId && typeof (Flow as any)?.media?.getBase64 === 'function') {
          try { verticalBase64 = extractImageBase64(await (Flow as any).media.getBase64(verticalMediaId)); } catch (_) {}
        }
      } catch (err: any) {
        console.warn('Vertical cover gen error:', err);
      }
    }
    // B. 16:9 横型マスターカバー（横動画サムネイル看板）の生成
    if (force || !hasHorizontal) {
      const coverPromptH = buildAdaptiveInfographicCoverPrompt({
        titleJp: cleanEpisodeTitle(freshEp.titleJp),
        titleEn: cleanEpisodeTitleEn(freshEp.titleEn),
        coverCatchphraseJp: cleanEpisodeTitle(freshEp.coverCatchphraseJp || ''),
        coverCatchphraseEn: cleanEpisodeTitleEn(freshEp.coverCatchphraseEn || ''),
        theme: freshEp.theme || settings.theme,
        era: freshEp.era || settings.era,
        taste: freshEp.taste || settings.taste,
        country: settings.country,
        productionMode: freshEp.productionMode || settings.productionMode,
        characterDna: fixedChar?.dnaPromptEn || freshEp.characterDna,
        styleDna: activeReferenceRef.current?.styleDna,
        forbiddenAnachronisms: freshEp.forbiddenAnachronisms,
        authenticAttireEn: freshEp.authenticAttireEn,
        isHorizontal: true
      });
      horizontalPromptEn = coverPromptH.promptEn;
      try {
        const resH: any = await Flow.generate.image({
          prompt: coverPromptH.promptEn,
          modelDisplayName: safeModelName,
          aspectRatio: '16:9' as any,
          referenceImageMediaIds: refMediaIds.length > 0 ? refMediaIds : undefined
        });
        horizontalBase64 = extractImageBase64(resH);
        horizontalMediaId = extractMediaId(resH);
        if (!horizontalBase64 && horizontalMediaId && typeof (Flow as any)?.media?.getBase64 === 'function') {
          try { horizontalBase64 = extractImageBase64(await (Flow as any).media.getBase64(horizontalMediaId)); } catch (_) {}
        }
      } catch (err: any) {
        console.warn('Horizontal cover gen error:', err);
      }
    }
    const updates = {
      coverMediaId: verticalMediaId,
      coverBase64: verticalBase64,
      coverPromptEn: verticalPromptEn,
      coverHorizontalMediaId: horizontalMediaId,
      coverHorizontalBase64: horizontalBase64,
      coverHorizontalPromptEn: horizontalPromptEn,
      isGeneratingCover: false
    };
    updateEpisode(freshEp.id, updates);
    episodesRef.current = episodesRef.current.map((e: Episode) => e.id === freshEp.id ? { ...e, ...updates } : e);
    setEpisodes((prev: Episode[]) => prev.map((e: Episode) => e.id === freshEp.id ? { ...e, ...updates } : e));
    addLog(`✨ Ep.${freshEp.id}: 【看板完成】9:16縦扉絵および16:9横型マスターカバーが完成しました！`, 'success');
    return {
      coverVertical: { mediaId: verticalMediaId, base64: verticalBase64 },
      coverHorizontal: { mediaId: horizontalMediaId, base64: horizontalBase64 }
    };
  } catch (err: any) {
    updateEpisode(freshEp.id, { isGeneratingCover: false });
    addLog(`⚠️ Ep.${freshEp.id}: 扉絵・16:9看板生成スキップ: ${formatErrorMessage(err)}`, 'warning');
  }
  return {};
}
/**
 * ── 4. 1話完結ライフサイクル共通モジュール ──
 */
export interface FinalizeEpisodeOptions {
  unitLabel?: string;
  title?: string;
  manifest?: SeriesManifest | null;
  onDownloaded?: (blobUrl: string, filename: string, sizeStr: string) => void;
}
export async function finalizeAndProcessEpisode(
  ctx: ProductionPipelineContext,
  epId: number,
  options?: FinalizeEpisodeOptions
): Promise<void> {
  const { settings, addLog, isAbortedRef, episodesRef, setEpisodes, updateEpisode } = ctx;
  const unitLabel = options?.unitLabel || '話';
  if (isAbortedRef.current) return;
  const currentEp = episodesRef.current.find((e: Episode) => Number(e.id) === Number(epId));
  if (!currentEp) return;
  const epTitle = options?.title || currentEp.titleJp || `第${epId}${unitLabel}`;
  const allCutsCompleted = currentEp.cuts.every(c => !!(c.imageBase64 || c.imageMediaId));
  const stateUpdate = {
    isGenerating: false,
    isBatchGeneratingVideos: false,
    isPreviewDone: true,
    isDone: allCutsCompleted
  };
  updateEpisode(epId, stateUpdate);
  episodesRef.current = episodesRef.current.map((e: Episode) => Number(e.id) === Number(epId) ? {
    ...e, ...stateUpdate, cuts: e.cuts.map(c => ({ ...c, isGeneratingVideo: false }))
  } : e);
  setEpisodes((prev: Episode[]) => prev.map((e: Episode) => Number(e.id) === Number(epId) ? {
    ...e, ...stateUpdate, cuts: e.cuts.map(c => ({ ...c, isGeneratingVideo: false }))
  } : e));
  const manifest = options?.manifest || ctx.seriesManifestRef?.current;
  if (manifest && allCutsCompleted) {
    manifest.completedEpisodeIds = Array.from(new Set([...(manifest.completedEpisodeIds || []), epId]));
    manifest.currentEpisodeId = epId + 1;
    if (ctx.setActiveSeriesManifest) {
      ctx.setActiveSeriesManifest({ ...manifest });
    }
  }
  const freshEp = episodesRef.current.find((e: Episode) => Number(e.id) === Number(epId)) || currentEp;
  // ■ 4. 先行カット待機時の「早すぎるZIP自動ダウンロード」の防止
  // 全カットが描き切れた（allCutsCompleted === true）場合にのみ自動ダウンロードを発火
  if (settings.autoDownload && !isAbortedRef.current && allCutsCompleted) {
    addLog(`📦 【第${epId}${unitLabel}】『${epTitle}』全カット完成！自動ZIPパッケージングを開始...`, 'process');
    const currentLogs = ctx.logsRef?.current || ((typeof window !== 'undefined' && (window as any).__STUDIO_LOGS__) || []);
    try {
      const res = await downloadZip(freshEp, addLog, manifest || undefined, currentLogs);
      if (res) {
        if (freshEp.packageZipBlobUrl) {
          try { URL.revokeObjectURL(freshEp.packageZipBlobUrl); } catch (_) {}
        }
        updateEpisode(epId, {
          packageZipBlobUrl: res.blobUrl,
          packageZipFilename: res.filename,
          packageZipSizeStr: res.sizeStr
        });
        if (options?.onDownloaded) {
          options.onDownloaded(res.blobUrl, res.filename, res.sizeStr);
        }
        addLog(`💾 【第${epId}${unitLabel}】『${epTitle}』完成版ZIPパッケージの保存が完了しました（${res.sizeStr}）！`, 'success');
      }
    } catch (zipErr) {
      console.error(`Failed to auto-download zip for episode ${epId}:`, zipErr);
      addLog(`⚠️ 第${epId}${unitLabel}の自動ダウンロード中に一時的エラーが発生しました`, 'warning');
    }
  } else if (!allCutsCompleted) {
    addLog(`⏸️ 【第${epId}${unitLabel}】『${epTitle}』先行確認完了（残りカットはSTANDBY待機のため、ZIP自動保存は全カット描画完了まで保留します）。`, 'info');
  }
  cleanupEpisodeMemory();
  addLog(`🏁 【第${epId}${unitLabel}】『${epTitle}』パイプライン待機完了！`, 'info');
}
/**
 * ── 5. YouTube Shorts / 音楽MV制作パイプライン ──
 */
export async function runShortsBatchProduction(ctx: ProductionPipelineContext, curMode: string): Promise<void> {
  const { settings, addLog, isAbortedRef, episodesRef, setEpisodes, updateEpisode, runTasks, buildCutTasks } = ctx;
  const modeInfo = SHORTS_CONFIG_MAP[curMode] || { label: 'Shorts', unit: '本', icon: '🎬' };
  const totalEpCount = Math.max(1, settings.episodeCount || 1);
  const existingEpisodes: Episode[] = episodesRef.current || [];
  const completedEpisodes = existingEpisodes.filter(e => e.cuts.some(c => !!(c.imageBase64 || c.imageMediaId)));
  const existingMaxId = completedEpisodes.length > 0 ? Math.max(...completedEpisodes.map(e => e.id)) : 0;
  const startEpIndex = existingMaxId + 1;
  const endEpIndex = existingMaxId + totalEpCount;
  const totalCutsPerEpisode = settings.cutCount || CUTS_PER_EPISODE;
  addLog(`${modeInfo.icon} 【${modeInfo.label}モード】全 ${totalEpCount} ${modeInfo.unit}（各${totalCutsPerEpisode}Cut / 先行${settings.previewCutCount}枚描画）の制作を開始します！`, 'process');
  const baseRawTitle = settings.theme.split('（')[0].replace(/^[^\w\s一-龯]+/, '').trim() || '情景の記録';
  const defaultEnTitle = 'Cinematic Story';
  for (let epIndex = startEpIndex; epIndex <= endEpIndex; epIndex++) {
    const currentBatchStep = epIndex - startEpIndex + 1;
    if (isAbortedRef.current) {
      addLog(`🛑 制作が中断されました（${currentBatchStep - 1}/${totalEpCount}${modeInfo.unit}完了）`, 'warning');
      break;
    }
    const rawTitle = (endEpIndex > 1) ? `${baseRawTitle} Vol.${epIndex}` : baseRawTitle;
    const currentEnTitle = (endEpIndex > 1) ? `${defaultEnTitle} Vol.${epIndex}` : defaultEnTitle;
    const existingTitles = episodesRef.current
      .map((e: Episode) => e.titleJp.replace(/^[^\w\s一-龯]+/, '').trim())
      .filter(Boolean);
    addLog(`${modeInfo.icon} 【第${epIndex}${modeInfo.unit}】脚本をリレー生成中（全${totalCutsPerEpisode}Cut策定）...`, 'process');
    const curPlan = {
      epNumber: epIndex,
      titleJp: rawTitle,
      titleEn: currentEnTitle,
      summary: `${baseRawTitle}の世界観で紡がれる第${epIndex}の映像作品`
    };
    const parsed = await generateSafeEpisodeScript({
      epId: epIndex,
      currentPlan: curPlan,
      country: settings.country,
      theme: settings.theme,
      era: settings.era,
      isMangaMode: false,
      isMvMode: curMode === 'mv',
      taste: settings.taste,
      productionMode: curMode,
      existingTitles,
      characterId: settings.characterId,
      targetCutCount: totalCutsPerEpisode,
      superBackoff: settings.superBackoff,
      abortCheck: () => isAbortedRef.current,
      addLog
    });
    const cutsCount = totalCutsPerEpisode;
    const baseCutsData = Array.from({ length: cutsCount }, (_, j) => {
      const cutData = parsed.cuts[j] || {} as any;
      return createPipelineCut(j, cutData, parsed, settings, curMode, curMode === 'mv', curMode === 'manga' || settings.isMangaMode);
    });
    const cleanParsedTitle = cleanEpisodeTitle(parsed.titleJp || '');
    const safeTopicJp = sanitizeForYouTubeSafety(cleanParsedTitle && cleanParsedTitle !== baseRawTitle ? cleanParsedTitle : `情景の断章`);
    const displayTitleJp = `${modeInfo.icon} ${safeTopicJp}`;
    const cleanParsedEn = cleanEpisodeTitleEn(parsed.titleEn || '');
    const displayTitleEn = cleanParsedEn && cleanParsedEn !== defaultEnTitle ? cleanParsedEn : 'Cinematic Story';
    const newEpisode: Episode = {
      id: epIndex, internalId: crypto.randomUUID(),
      titleJp: displayTitleJp, titleEn: displayTitleEn,
      summary: parsed.summary || `${safeTopicJp}の情景`, 
      characterDna: parsed.characterDna,
      eraAnalysis: parsed.eraAnalysisJp || '作品を引き立てる演出構図。',
      forbiddenAnachronisms: parsed.forbiddenAnachronisms || ['過剰な劇的演出'],
      authenticAttireEn: parsed.authenticAttireEn || 'Cinematic style attire', forbiddenKeywordsEn: 'explosive drama',
      coverCatchphraseJp: parsed.coverCatchphraseJp || '心揺さぶる一瞬の物語。', highlightWords: parsed.highlightWords || ['光'],
      cuts: baseCutsData, isGenerating: true, isGeneratingRemainingImages: false, isBatchGeneratingVideos: false,
      isPreviewDone: false, isDone: false, characterId: settings.characterId, taste: settings.taste, era: settings.era, theme: settings.theme,
      isMvMode: curMode === 'mv', productionMode: curMode as any
    };
    if (!newEpisode.isMvMode && !settings.isMvMode) {
      ctx.activeReferenceRef.current = undefined;
    }
    const turnaround = await ensureCharacterTurnaround(ctx, newEpisode);
    if (turnaround.mediaId) {
      newEpisode.characterTurnaroundMediaId = turnaround.mediaId;
      newEpisode.characterTurnaroundBase64 = turnaround.base64;
    }
    // 全カット（C01〜最終カット）を即座にUIへ反映して横並びSTANDBY展開
    setEpisodes((prev: Episode[]) => [...prev.filter(e => e.id !== epIndex), newEpisode]);
    episodesRef.current = [...episodesRef.current.filter((e: Episode) => e.id !== epIndex), newEpisode];
    addLog(`✨ 第${epIndex}${modeInfo.unit}『${newEpisode.titleJp}』全${cutsCount}カットの脚本確定！（C01〜C${String(cutsCount).padStart(2, '0')}を配置、先行${settings.previewCutCount}枚を描画開始）`, 'success');
    const targetCutCount = Math.min(settings.previewCutCount, cutsCount);
    await runTasks(buildCutTasks(newEpisode, newEpisode.cuts.slice(0, targetCutCount)));
    if (isAbortedRef.current) {
      updateEpisode(epIndex, { isGenerating: false });
      break;
    }
    const freshNewEp = episodesRef.current.find((e: Episode) => e.id === epIndex) || newEpisode;
    const completedCount = freshNewEp.cuts.slice(0, targetCutCount).filter(c => c.imageBase64 || c.imageMediaId).length;
    const isAllDone = completedCount >= cutsCount;
    const isPreviewSuccessful = completedCount >= targetCutCount;
    updateEpisode(epIndex, { 
      isGenerating: false, 
      isPreviewDone: isPreviewSuccessful, 
      isDone: isAllDone 
    });
    if (isPreviewSuccessful) {
      addLog(`✅ 第${epIndex}${modeInfo.unit}『${newEpisode.titleJp}』先行${targetCutCount}カットの画像生成が完了しました！（残り${cutsCount - targetCutCount}カットはSTANDBY待機）`, 'success');
      await ensureInfographicCover(ctx, freshNewEp);
    }
    await finalizeAndProcessEpisode(ctx, epIndex, {
      unitLabel: modeInfo.unit,
      title: newEpisode.titleJp
    });
  }
  if (!isAbortedRef.current) {
    addLog(`🎉 全 ${totalEpCount} ${modeInfo.unit}の${modeInfo.label}先行制作が完了しました！`, 'success');
  }
}
/**
 * ── 6. 連続ドラマ・漫画シリーズ制作パイプライン ──
 */
export async function runSeriesProduction(ctx: ProductionPipelineContext): Promise<void> {
  const { 
    settings, 
    addLog, 
    isAbortedRef, 
    episodesRef, 
    setEpisodes, 
    updateEpisode, 
    runTasks, 
    buildCutTasks, 
    seriesManifestRef, 
    setActiveSeriesManifest, 
    currentAssetRef, 
    activeReferenceRef 
  } = ctx;
  const fixedChar = (settings.characterId && settings.characterId !== 'auto')
    ? SAFE_CHARACTERS.find(c => c.id === settings.characterId)
    : undefined;
  const totalCutsPerEpisode = settings.cutCount || CUTS_PER_EPISODE;
  if (!seriesManifestRef.current) {
    const isHist = checkIsHistorical(settings.era, settings.theme);
    const isMv = settings.isMvMode || settings.productionMode === 'mv';
    const isManga = settings.isMangaMode || settings.productionMode === 'manga';
    const genreLabel = isMv ? '音楽MVシリーズ' : isManga ? '漫画シリーズ' : isHist ? '大河ドラマ' : '連続ドラマ';
    const totalEps = settings.totalEpisodes || settings.episodeCount || 1;
    addLog(`📜 全${totalEps}話の${genreLabel}グランドデザインをAIに策定依頼中... [世界観: ${settings.theme}]`, 'process');
    const EP_CHUNK_SIZE = 20;
    const epChunks = Math.ceil(totalEps / EP_CHUNK_SIZE);
    let allEpisodesPlan: SeriesEpisodePlan[] = [];
    let seriesTitle = settings.theme.split('（')[0].replace(/^[^\w\s一-龯]+/, '').trim() || '物語の記録';
    let overallSynopsis = `${settings.theme}の世界観で描かれる物語`;
    for (let cIdx = 0; cIdx < epChunks; cIdx++) {
      if (isAbortedRef.current) break;
      const startEp = cIdx * EP_CHUNK_SIZE + 1;
      const endEp = Math.min((cIdx + 1) * EP_CHUNK_SIZE, totalEps);
      const prevHeaders = allEpisodesPlan.length > 0
        ? allEpisodesPlan.map(p => `[第${p.epNumber}話] ${p.titleJp}: ${p.summary}`).join('\n')
        : '';
      const designPrompt = buildGrandDesignChunkPrompt(
        startEp,
        endEp,
        totalEps,
        settings.country,
        settings.theme,
        settings.era,
        isManga,
        isMv,
        fixedChar?.dnaPromptEn,
        fixedChar?.nameJa,
        prevHeaders
      );
      let designRes: any;
      try {
        designRes = await callWithRetry<any>(() => Flow.generate.text(designPrompt), undefined, 2);
      } catch (_) {
        designRes = { text: '' };
      }
      const parsedDesign = safeJsonParse<any>(designRes?.text || '', {});
      if (cIdx === 0 && parsedDesign.seriesTitle) seriesTitle = parsedDesign.seriesTitle;
      if (cIdx === 0 && parsedDesign.overallSynopsis) overallSynopsis = parsedDesign.overallSynopsis;
      const rawPlanList: SeriesEpisodePlan[] = Array.isArray(parsedDesign.episodesPlan) ? parsedDesign.episodesPlan : [];
      for (let eNum = startEp; eNum <= endEp; eNum++) {
        const found = rawPlanList.find((p: any) => p.epNumber === eNum);
        const fbSub = FALLBACK_EPISODE_SUBTITLES[eNum] || { jp: `第${eNum}幕の波乱`, en: `Act ${eNum}` };
        allEpisodesPlan.push({
          epNumber: eNum,
          titleJp: found?.titleJp ? cleanEpisodeTitle(found.titleJp) : (totalEps > 1 ? `${seriesTitle}〜${fbSub.jp}` : seriesTitle),
          titleEn: found?.titleEn ? cleanEpisodeTitleEn(found.titleEn) : fbSub.en,
          summary: found?.summary || `${settings.theme}の世界観で描かれる物語`
        });
      }
    }
    seriesManifestRef.current = {
      seriesTitle,
      totalEpisodes: totalEps,
      currentEpisodeId: 1,
      completedEpisodeIds: [],
      overallSynopsis,
      episodesPlan: allEpisodesPlan,
      referenceAsset: currentAssetRef.current ? {
        ...currentAssetRef.current,
        characterDna: activeReferenceRef.current?.characterDna,
        styleDna: activeReferenceRef.current?.styleDna,
        antiPoseNegative: activeReferenceRef.current?.antiPoseNegative,
        eraNegative: activeReferenceRef.current?.eraNegative
      } : undefined,
      settings
    };
    setActiveSeriesManifest({ ...seriesManifestRef.current });
    const initialEpisodes: Episode[] = allEpisodesPlan.map(p => ({
      id: p.epNumber,
      internalId: crypto.randomUUID(),
      titleJp: p.titleJp,
      titleEn: p.titleEn,
      summary: p.summary,
      cuts: Array.from({ length: totalCutsPerEpisode }, (_, j) => createDefaultCut(j + 1, '脚本策定待ち...', '', false)),
      isGenerating: false,
      isGeneratingRemainingImages: false,
      isBatchGeneratingVideos: false,
      isPreviewDone: false,
      isDone: false,
      taste: settings.taste,
      era: settings.era,
      theme: settings.theme
    }));
    setEpisodes(initialEpisodes);
    episodesRef.current = initialEpisodes;
    addLog(`🏛️ シリーズ設計図「${seriesTitle}」策定完了！（全${allEpisodesPlan.length}話プロット確定 / 1話${totalCutsPerEpisode}Cut構成）`, 'success');
  }
  const manifest = seriesManifestRef.current!;
  const completedIds = manifest.completedEpisodeIds || [];
  const nextEpId = completedIds.length > 0 ? Math.max(...completedIds) + 1 : 1;
  const existingPlanCount = manifest.episodesPlan?.length || 0;
  const targetMaxEpId = Math.max(nextEpId, existingPlanCount, settings.episodeCount);
  if (targetMaxEpId > existingPlanCount) {
    manifest.episodesPlan = manifest.episodesPlan || [];
    for (let epNum = existingPlanCount + 1; epNum <= targetMaxEpId; epNum++) {
      if (isAbortedRef.current) break;
      addLog(`📖 【第${epNum}話】続編プロットをAIに策定依頼中...`, 'process');
      const nextPlanPrompt = buildNextEpisodePlanPrompt(
        epNum,
        manifest.seriesTitle,
        manifest.overallSynopsis || '',
        manifest.episodesPlan.map(p => ({ epNumber: p.epNumber, titleJp: p.titleJp, summary: p.summary })),
        settings.country,
        settings.theme,
        settings.era,
        settings.isMangaMode
      );
      let newPlan: SeriesEpisodePlan;
      try {
        const planRes = await callWithRetry<any>(() => Flow.generate.text(nextPlanPrompt), undefined, 4);
        const rawPlan = safeJsonParse<SeriesEpisodePlan>(planRes.text, {
          epNumber: epNum, titleJp: '運命の分岐点', titleEn: 'Turning Point', summary: '波乱の展開'
        });
        newPlan = {
          ...rawPlan,
          titleJp: cleanEpisodeTitle(rawPlan.titleJp) || '運命の分岐点',
          titleEn: cleanEpisodeTitleEn(rawPlan.titleEn) || 'Turning Point'
        };
      } catch (_) {
        newPlan = { epNumber: epNum, titleJp: '運命の継承', titleEn: 'Destiny', summary: `第${epNum - 1}話から続く物語` };
      }
      manifest.episodesPlan.push(newPlan);
      manifest.totalEpisodes = manifest.episodesPlan.length;
      const newEpisodeCard: Episode = {
        id: epNum, internalId: crypto.randomUUID(),
        titleJp: cleanEpisodeTitle(newPlan.titleJp), titleEn: cleanEpisodeTitleEn(newPlan.titleEn),
        summary: newPlan.summary,
        cuts: Array.from({ length: totalCutsPerEpisode }, (_, j) => createDefaultCut(j + 1, '脚本策定待ち...', '', false)),
        isGenerating: false, isGeneratingRemainingImages: false, isBatchGeneratingVideos: false,
        isPreviewDone: false, isDone: false, taste: settings.taste, era: settings.era, theme: settings.theme
      };
      setEpisodes((prev: Episode[]) => prev.some(e => e.id === epNum) ? prev : [...prev, newEpisodeCard]);
      episodesRef.current = [...episodesRef.current.filter((e: Episode) => e.id !== epNum), newEpisodeCard];
    }
    setActiveSeriesManifest({ ...manifest });
  }
  for (let i = 0; i < (manifest.episodesPlan?.length || 0); i++) {
    const currentPlan = manifest.episodesPlan[i];
    const epId = currentPlan.epNumber || (i + 1);
    if (manifest.completedEpisodeIds.includes(epId)) continue;
    if (isAbortedRef.current) break;
    const isMv = settings.isMvMode || settings.productionMode === 'mv';
    const isManga = settings.isMangaMode || settings.productionMode === 'manga';
    const effectiveMode = settings.productionMode || (isMv ? 'mv' : isManga ? 'manga' : 'episodes');
    const unitLabel = isMv ? '曲' : '話';
    const existingTitles = episodesRef.current
      .map((e: Episode) => (e.titleJp || '').replace(/^[^\w\s一-龯]+/, '').trim())
      .filter(Boolean);
    try {
      addLog(`📖 【第${epId}${unitLabel}】「${currentPlan.titleJp}」の全${totalCutsPerEpisode}Cutをリレー生成中...`, 'process');
      updateEpisode(epId, { isGenerating: true });
      const sharedScript = await generateSafeEpisodeScript({
        epId,
        currentPlan,
        country: settings.country,
        theme: settings.theme,
        era: settings.era,
        isMangaMode: isManga,
        isMvMode: isMv,
        taste: settings.taste,
        productionMode: effectiveMode,
        existingTitles,
        characterId: settings.characterId,
        targetCutCount: totalCutsPerEpisode,
        superBackoff: settings.superBackoff,
        abortCheck: () => isAbortedRef.current,
        addLog
      });
      const seriesCutsCount = totalCutsPerEpisode;
      const episodeCuts: Cut[] = Array.from({ length: seriesCutsCount }, (_, j) => {
        const cutData = sharedScript.cuts[j] || {} as any;
        return createPipelineCut(j, cutData, sharedScript, settings, effectiveMode, isMv, isManga);
      });
      const currentEpObj = episodesRef.current.find((e: Episode) => e.id === epId);
      if (currentEpObj) {
        currentEpObj.characterDna = fixedChar?.dnaPromptEn || sharedScript.characterDna;
        currentEpObj.characterId = settings.characterId;
      }
      let turnaroundMediaId = currentEpObj?.characterTurnaroundMediaId || manifest.referenceAsset?.characterTurnaroundMediaId || activeReferenceRef.current?.mediaId;
      let turnaroundBase64 = currentEpObj?.characterTurnaroundBase64 || manifest.referenceAsset?.characterTurnaroundBase64;
      if (!turnaroundMediaId && currentEpObj) {
        const turnaround = await ensureCharacterTurnaround(ctx, currentEpObj);
        turnaroundMediaId = turnaround.mediaId;
        turnaroundBase64 = turnaround.base64;
        if (turnaround.mediaId && manifest.referenceAsset) {
          manifest.referenceAsset.characterTurnaroundMediaId = turnaround.mediaId;
          manifest.referenceAsset.characterTurnaroundBase64 = turnaround.base64;
        }
      }
      if (turnaroundMediaId && currentEpObj) {
        currentEpObj.characterTurnaroundMediaId = turnaroundMediaId;
        currentEpObj.characterTurnaroundBase64 = turnaroundBase64;
      }
      // AIが命名した各話固有の劇的サブタイトルを最優先採用（テーマ名そのままは除外）
      const themeShort = (settings.theme || '').split('（')[0].trim();
      const isScriptTitleValid = sharedScript.titleJp && 
        !sharedScript.titleJp.includes('劇的サブタイトル') && 
        sharedScript.titleJp !== themeShort;
      
      const rawTitleJp = isScriptTitleValid 
        ? sharedScript.titleJp 
        : (currentPlan.titleJp || `第${epId}話`);
      const rawTitleEn = sharedScript.titleEn || currentPlan.titleEn || `Episode ${epId}`;
      const finalTitleJp = cleanEpisodeTitle(rawTitleJp);
      const finalTitleEn = cleanEpisodeTitleEn(rawTitleEn);
      updateEpisode(epId, {
        titleJp: finalTitleJp, 
        titleEn: finalTitleEn, 
        summary: currentPlan.summary || sharedScript.summary,
        characterDna: sharedScript.characterDna,
        eraAnalysis: sharedScript.eraAnalysisJp,
        forbiddenAnachronisms: sharedScript.forbiddenAnachronisms,
        authenticAttireEn: sharedScript.authenticAttireEn,
        forbiddenKeywordsEn: sharedScript.forbiddenKeywordsEn,
        coverCatchphraseJp: sharedScript.coverCatchphraseJp,
        coverCatchphraseEn: sharedScript.coverCatchphraseEn,
        highlightWords: sharedScript.highlightWords || [],
        cuts: episodeCuts,
        characterTurnaroundMediaId: turnaroundMediaId,
        characterTurnaroundBase64: turnaroundBase64,
        characterId: settings.characterId,
        taste: settings.taste,
        era: settings.era,
        theme: settings.theme,
        productionMode: effectiveMode,
        isMvMode: isMv
      });
      const previewCount = Math.min(settings.previewCutCount || 2, seriesCutsCount);
      addLog(`🎨 【第${epId}${unitLabel}】全${seriesCutsCount}カット配置完了！先行 ${previewCount} カットの描画タスクを開始...（${previewCount + 1}カット目以降はSTANDBY待機）`, 'process');
      const currentEp = episodesRef.current.find((e: Episode) => e.id === epId)!;
      await runTasks(buildCutTasks(currentEp, episodeCuts.slice(0, previewCount)));
      addLog(`🎉 【第${epId}${unitLabel}】「${finalTitleJp}」の先行プレビュー制作が完了しました！`, 'success');
      await ensureInfographicCover(ctx, episodesRef.current.find((e: Episode) => e.id === epId) || currentEp);
      await finalizeAndProcessEpisode(ctx, epId, {
        unitLabel,
        title: finalTitleJp,
        manifest
      });
      // 🌙 夜間放置モードまたは土日モードに応じたエピソード間クールダウン待機
      if (i < (manifest.episodesPlan?.length || 0) - 1 && !isAbortedRef.current) {
        const epCooldown = settings.runModeProfile === 'night' ? 60000 : 10000;
        addLog(`☕ 第${epId + 1}${unitLabel}の脚本策定まで安定冷却待機中（${Math.round(epCooldown / 1000)}秒）...`, 'info');
        await sleepWithAbortCheck(epCooldown, () => isAbortedRef.current);
      }
    } catch (epErr: any) {
      addLog(`⚠️ 第 ${epId} 話の生成中にエラーが発生しました: ${formatErrorMessage(epErr)}`, 'warning');
      cleanupEpisodeMemory();
      continue;
    }
  }
}

