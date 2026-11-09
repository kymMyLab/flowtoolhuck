import { runShortsBatchProduction, runSeriesProduction, SHORTS_CONFIG_MAP, ensureInfographicCover, ensureCharacterTurnaround } from './seriesProductionPipeline';
import { useState, useEffect, useRef, useCallback } from 'react';
import { Episode, Cut, GeneratorSettings, GenerationTask, SeriesManifest, LogEntry } from '../types';
import { CUTS_PER_EPISODE, resolveImageModel, SAFE_CHARACTERS } from '../constants';
import { safeJsonParse, callWithRetry, formatErrorMessage, createDefaultCut, formatDurationMs, extractImageBase64, extractMediaId, getAllReferenceAssets, saveReferenceAsset, sleepWithAbortCheck } from './utils';
import { 
  directShot, 
  buildImagePromptAndNegative, 
  cleanEpisodeTitle, 
  cleanEpisodeTitleEn, 
  PreviousShotInfo 
} from './directorService';
import { sanitizePromptForGoogleSafety, buildDynamicAntiPreviousNegative, isFaceMacroScale, buildPositiveAntiPreviousMandate } from './promptEngine';
import { downloadZip } from './zipPackager';
import { Flow } from 'flow-sdk';
function useEpisodeState(addLog: (msg: string, type?: any) => void) {
  const [episodes, setEpisodes] = useState<Episode[]>(() => {
    if (typeof window !== 'undefined') {
      const existing = (window as any).__STUDIO_EPISODES__ || (window as any).__STUDIO_EPISODES_BACKUP__;
      if (Array.isArray(existing) && existing.length > 0) return existing;
    }
    return [];
  });
  const episodesRef = useRef<Episode[]>(episodes);
  const [isProducing, setIsProducing] = useState(false);
  const isAbortedRef = useRef(false);
  const [activeSeriesManifest, setActiveSeriesManifest] = useState<SeriesManifest | null>(() => {
    if (typeof window !== 'undefined') return (window as any).__STUDIO_SERIES_MANIFEST__ || null;
    return null;
  });
  const seriesManifestRef = useRef<SeriesManifest | null>(activeSeriesManifest);
  useEffect(() => {
    seriesManifestRef.current = activeSeriesManifest;
    if (typeof window !== 'undefined' && activeSeriesManifest) {
      (window as any).__STUDIO_SERIES_MANIFEST__ = activeSeriesManifest;
    }
  }, [activeSeriesManifest]);
  useEffect(() => {
    episodesRef.current = episodes;
    if (typeof window !== 'undefined' && episodes.length > 0) {
      (window as any).__STUDIO_EPISODES__ = episodes;
      (window as any).__STUDIO_EPISODES_BACKUP__ = episodes;
    }
  }, [episodes]);
  useEffect(() => {
    if (episodes.length > 0) {
      addLog(`🔄 前回の制作セッションから全${episodes.length}話を自動復元しました！`, 'success');
    }
  }, []);
  const updateCut = useCallback((epId: number, cutId: number, updates: Partial<Cut>) => {
    const targetEpId = Number(epId);
    const targetCutId = Number(cutId);
    episodesRef.current = episodesRef.current.map(ep =>
      Number(ep.id) === targetEpId
        ? { ...ep, cuts: ep.cuts.map(c => Number(c.id) === targetCutId ? { ...c, ...updates } : c) }
        : ep
    );
    setEpisodes(prev => prev.map(ep =>
      Number(ep.id) === targetEpId
        ? { ...ep, cuts: ep.cuts.map(c => Number(c.id) === targetCutId ? { ...c, ...updates } : c) }
        : ep
    ));
  }, []);
  const updateEpisode = useCallback((epId: number, updates: Partial<Episode>) => {
    const targetEpId = Number(epId);
    episodesRef.current = episodesRef.current.map(ep =>
      Number(ep.id) === targetEpId ? { ...ep, ...updates } : ep
    );
    setEpisodes(prev => prev.map(ep =>
      Number(ep.id) === targetEpId ? { ...ep, ...updates } : ep
    ));
  }, []);
  const clearEpisodes = useCallback(() => {
    isAbortedRef.current = true;
    episodesRef.current = [];
    setEpisodes([]);
    setActiveSeriesManifest(null);
    seriesManifestRef.current = null;
    if (typeof window !== 'undefined') {
      delete (window as any).__STUDIO_EPISODES__;
      delete (window as any).__STUDIO_EPISODES_BACKUP__;
      delete (window as any).__STUDIO_SERIES_MANIFEST__;
      delete (window as any).__STUDIO_SERIES_HASH__;
    }
    addLog('🧹 制作データを全消去しました。', 'info');
  }, [addLog]);
  const abortProduction = useCallback(() => {
    isAbortedRef.current = true;
    setIsProducing(false);
    const resetEp = (ep: Episode): Episode => {
      const hasContent = ep.cuts.some(c => !!(c.promptEn || c.imageBase64 || c.imageMediaId));
      return {
        ...ep,
        isGenerating: false,
        isGeneratingRemainingImages: false,
        isPreviewDone: ep.isPreviewDone || hasContent,
        cuts: ep.cuts.map(c => ({
          ...c,
          isGeneratingImage: false,
          isDirecting: false
        }))
      };
    };
    episodesRef.current = episodesRef.current.map(resetEp);
    setEpisodes(prev => prev.map(resetEp));
    addLog('🛑 ユーザーによって制作が中断されました（以降のタスクを安全破棄）。', 'warning');
  }, [addLog]);
  return {
    episodes,
    setEpisodes,
    episodesRef,
    isProducing,
    setIsProducing,
    isAbortedRef,
    activeSeriesManifest,
    setActiveSeriesManifest,
    seriesManifestRef,
    updateCut,
    updateEpisode,
    clearEpisodes,
    abortProduction
  };
}
interface UseStudioProductionProps {
  settings: GeneratorSettings;
  addLog: (message: string, type?: LogEntry['type']) => void;
  logs?: LogEntry[];
}
export function useStudioProduction({ settings, addLog, logs }: UseStudioProductionProps) {
  const {
    episodes,
    setEpisodes,
    episodesRef,
    isProducing,
    setIsProducing,
    isAbortedRef,
    activeSeriesManifest,
    setActiveSeriesManifest,
    seriesManifestRef,
    updateCut,
    updateEpisode,
    clearEpisodes,
    abortProduction
  } = useEpisodeState(addLog);
  const logsRef = useRef(logs);
  useEffect(() => { logsRef.current = logs; }, [logs]);
  const activeReferenceRef = useRef<{ mediaId?: string; characterDna?: string; styleDna?: string; antiPoseNegative?: string; eraNegative?: string } | undefined>(undefined);
  const currentAssetRef = useRef<any>(undefined);
  const queueRef = useRef<GenerationTask[]>([]);
  const seriesQueueRef = useRef<GeneratorSettings[]>([]);
  const [queuedSeriesCount, setQueuedSeriesCount] = useState(0);
  const isProducingRef = useRef(false);
  const hasRateLimitedBanana2Ref = useRef(false);
  const lastErrorRef = useRef<string | null>(null);
  const handleClearEpisodes = useCallback(() => {
    isAbortedRef.current = true;
    activeReferenceRef.current = undefined;
    currentAssetRef.current = undefined;
    queueRef.current = [];
    seriesQueueRef.current = [];
    setQueuedSeriesCount(0);
    clearEpisodes();
  }, [clearEpisodes]);
  const handleAbort = useCallback(() => {
    isAbortedRef.current = true;
    queueRef.current = [];
    seriesQueueRef.current = [];
    setQueuedSeriesCount(0);
    isProducingRef.current = false;
    abortProduction();
  }, [abortProduction]);
  const resumeSeries = async (manifest: SeriesManifest, onAssetRestored?: (assetId: number) => void) => {
    setActiveSeriesManifest(manifest);
    seriesManifestRef.current = manifest;
    const completedIds = manifest.completedEpisodeIds || [];
    const resumedEpisodes: Episode[] = (manifest.episodesPlan || []).map(p => {
      const isDone = completedIds.includes(p.epNumber);
      return {
        id: p.epNumber,
        internalId: crypto.randomUUID(),
        titleJp: cleanEpisodeTitle(p.titleJp),
        titleEn: cleanEpisodeTitleEn(p.titleEn),
        summary: p.summary,
        cuts: Array.from({ length: Math.max(CUTS_PER_EPISODE, manifest.settings?.previewCutCount || 30) }, (_, j) => createDefaultCut(j + 1, isDone ? '制作完了' : '待機中...', '', false)),
        isGenerating: false,
        isGeneratingRemainingImages: false,
        isBatchGeneratingVideos: false,
        isPreviewDone: isDone,
        isDone,
        taste: manifest.settings?.taste,
        era: manifest.settings?.era,
        theme: manifest.settings?.theme
      };
    });
    setEpisodes(resumedEpisodes);
    episodesRef.current = resumedEpisodes;
    if (manifest.referenceAsset?.base64) {
      try {
        const assets = await getAllReferenceAssets();
        let matched = assets.find(a => a.name === manifest.referenceAsset!.name && a.base64.slice(0, 50) === manifest.referenceAsset!.base64.slice(0, 50));
        let assetId = matched?.id;
        if (!assetId) {
          assetId = await saveReferenceAsset({ name: manifest.referenceAsset.name, base64: manifest.referenceAsset.base64 });
        }
        if (assetId && onAssetRestored) onAssetRestored(assetId);
        currentAssetRef.current = { id: assetId, name: manifest.referenceAsset.name, base64: manifest.referenceAsset.base64 };
        activeReferenceRef.current = {
          characterDna: manifest.referenceAsset.characterDna,
          styleDna: manifest.referenceAsset.styleDna,
          antiPoseNegative: manifest.referenceAsset.antiPoseNegative,
          eraNegative: manifest.referenceAsset.eraNegative
        };
      } catch (e) {
        console.warn('Reference asset restore error:', e);
      }
    }
    addLog(`📂 シリーズ「${manifest.seriesTitle}」を復元しました（全${manifest.totalEpisodes}話 / 完了: ${completedIds.length}話）`, 'success');
  };
  const buildCutTasks = (ep: Episode, cutsToGenerate: Cut[], styleKey?: string): GenerationTask[] => {
    const fixedChar = (ep.characterId && ep.characterId !== 'auto' && ep.characterId !== 'random') 
      ? SAFE_CHARACTERS.find(c => c.id === ep.characterId) 
      : undefined;
    const refMediaId = ep.characterTurnaroundMediaId || ep.masterAnchorMediaId || (ep.isMvMode ? undefined : activeReferenceRef.current?.mediaId);
    return cutsToGenerate.map(c => {
      const promptCandidates = [c.cleanImagePrompt, c.promptEn, c.scenePlot, c.narrationJp].filter(Boolean);
      const effectivePrompt = promptCandidates[0] || 'Cinematic anime visual scene';
      return {
        epId: ep.id,
        cutId: c.id,
        prompt: effectivePrompt,
        negativePrompt: c.negativePrompt,
        styleKey: styleKey || ep.taste || settings.taste,
        imageModel: settings.imageModel,
        isMvMode: ep.isMvMode,
        panelLayout: c.panelLayout,
        storyContext: ep.summary || '',
        eraAnalysis: ep.eraAnalysis,
        forbiddenAnachronisms: ep.forbiddenAnachronisms,
        authenticAttireEn: ep.authenticAttireEn,
        forbiddenKeywordsEn: ep.forbiddenKeywordsEn,
        referenceImageMediaId: refMediaId,
        characterDna: fixedChar?.dnaPromptEn || ep.characterDna,
        isObjectOnly: c.isObjectOnly,
        focalSubject: c.focalPoint?.focalSubject,
        shotScale: c.shotScale,
        cinematicAngle: c.cinematicAngle,
        camera: c.cameraWork
      };
    });
  };
  const handleGenerateRemaining = async (epId: number) => {
    isAbortedRef.current = false;
    const ep = episodesRef.current.find(e => e.id === epId);
    if (!ep) return;
    if (ep.characterTurnaroundBase64 && !ep.characterTurnaroundMediaId) {
      try {
        const uploadRes = await Flow.upload({
          base64: ep.characterTurnaroundBase64,
          mimeType: 'image/png',
          name: `Turnaround_Ep${epId}.png`
        });
        if (uploadRes?.mediaId) {
          ep.characterTurnaroundMediaId = uploadRes.mediaId;
          updateEpisode(epId, { characterTurnaroundMediaId: uploadRes.mediaId });
        }
      } catch (err: any) {
        console.warn('Turnaround upload error:', err);
      }
    }
    const remainingCuts = ep.cuts.filter(c => !c.imageBase64 && !c.imageMediaId);
    if (remainingCuts.length === 0) {
      addLog(`Ep.${epId}: すべての画像が生成済みです。`, 'info');
      return;
    }
    updateEpisode(epId, { isGeneratingRemainingImages: true });
    addLog(`🎨 Ep.${epId}: 残り ${remainingCuts.length} 枚の画像生成を開始...`, 'process');
    await runTasks(buildCutTasks(ep, remainingCuts));
    
    if (isAbortedRef.current) {
      updateEpisode(epId, { isGeneratingRemainingImages: false });
      return;
    }
    const freshEp = episodesRef.current.find(e => e.id === epId) || ep;
    const stillRemaining = freshEp.cuts.filter(c => !c.imageBase64 && !c.imageMediaId).length;
    
    if (stillRemaining === 0) {
      updateEpisode(epId, { isGeneratingRemainingImages: false, isDone: true, isPreviewDone: true });
      addLog(`✅ Ep.${epId}: 全${ep.cuts.length}カットの画像生成がすべて完了しました！`, 'success');
      if (settings.autoDownload && !isAbortedRef.current) {
        addLog(`📦 【第${epId}話】全カット描画完了に伴い、完成版ZIPパッケージを自動保存中...`, 'process');
        const currentLogs = logsRef.current || [];
        try {
          const res = await downloadZip(freshEp, addLog, seriesManifestRef.current || undefined, currentLogs);
          if (res) {
            updateEpisode(epId, {
              packageZipBlobUrl: res.blobUrl,
              packageZipFilename: res.filename,
              packageZipSizeStr: res.sizeStr
            });
            addLog(`💾 【第${epId}話】完成版パッケージの自動ダウンロードが完了しました（${res.sizeStr}）！`, 'success');
          }
        } catch (err) {
          console.error('Auto download after remaining cuts failed:', err);
        }
      }
    } else {
      updateEpisode(epId, { isGeneratingRemainingImages: false });
      if (!isAbortedRef.current) {
        addLog(`⚠️ Ep.${epId}: 一部未完了（残り ${stillRemaining} 枚）です。`, 'warning');
      }
    }
  };
  const runTasks = async (tasks: GenerationTask[]) => {
    if (isAbortedRef.current || tasks.length === 0) return;
    const isNightProfile = settings.executionProfile === 'night_safe';
    const preparedTasks: GenerationTask[] = [];
    let previousShotInfo: PreviousShotInfo | undefined = undefined;
    const firstTask = tasks[0];
    const prevCut = episodesRef.current.find(e => e.id === firstTask.epId)?.cuts.find(c => c.id === firstTask.cutId - 1);
    if (prevCut?.shotScale) {
      previousShotInfo = {
        scale: prevCut.shotScale,
        angle: prevCut.cinematicAngle,
        prompt: prevCut.promptEn,
        tag: prevCut.cameraWork
      };
    }
    addLog(`🎬 全 ${tasks.length} カットの映画的対比演出を自動最適化中...`, 'process');
    for (let i = 0; i < tasks.length; i++) {
      if (isAbortedRef.current) break;
      const task = tasks[i];
      const existingCut = episodesRef.current.find(e => e.id === task.epId)?.cuts.find(c => c.id === task.cutId);
      const isCompiledMv = !!(task.isMvMode && (existingCut?.characterPresence || task.characterPresence));
      let shotScale = existingCut?.shotScale || task.shotScale || 'Wide';
      let cinematicAngle = existingCut?.cinematicAngle || task.cinematicAngle || 'Cinematic perspective';
      let promptEn = existingCut?.promptEn || task.prompt;
      let antiPreviousNegative = existingCut?.negativePrompt || task.negativePrompt || '';
      let cameraWork = existingCut?.cameraWork || task.camera;
      let cameraMotion = existingCut?.cameraMotion;
      let kenBurnsPreset = existingCut?.kenBurnsPreset;
      let telop = existingCut?.telop;
      if (!isCompiledMv) {
        const directResult = await directShot(task, settings, activeReferenceRef.current, previousShotInfo);
        shotScale = directResult.shotScale || shotScale;
        cinematicAngle = directResult.cinematicAngle || cinematicAngle;
        promptEn = directResult.promptEn || promptEn;
        antiPreviousNegative = directResult.negativePrompt || antiPreviousNegative;
        cameraWork = directResult.cameraWork || cameraWork;
        cameraMotion = directResult.cameraMotion || cameraMotion;
        kenBurnsPreset = directResult.kenBurnsPreset || kenBurnsPreset;
        telop = directResult.telop ? { ...existingCut?.telop, ...directResult.telop } : existingCut?.telop;
      } else if (previousShotInfo) {
        const dynamicAnti = buildDynamicAntiPreviousNegative(previousShotInfo, shotScale);
        if (dynamicAnti) {
          antiPreviousNegative = antiPreviousNegative ? `${antiPreviousNegative}, ${dynamicAnti}` : dynamicAnti;
        }
      }
      if (previousShotInfo && isFaceMacroScale(previousShotInfo.scale, previousShotInfo.angle) && isFaceMacroScale(shotScale, cinematicAngle)) {
        addLog(`🛡️ [構図被り防止] Ep.${task.epId} C${task.cutId}: 顔面アップ連続を検知。バストアップ構図へ自動シフト`, 'info');
        shotScale = 'Medium Bust Shot';
        cinematicAngle = 'Candid cinematic chest-up framing capturing authentic posture, rich rim lighting, rule-of-thirds';
      }
      updateCut(task.epId, task.cutId, { 
        promptEn, shotScale, cinematicAngle, cameraWork, cameraMotion, kenBurnsPreset, telop, negativePrompt: antiPreviousNegative
      });
      previousShotInfo = { scale: shotScale, angle: cinematicAngle, prompt: promptEn, tag: cameraWork, telop };
      preparedTasks.push({ ...task, prompt: promptEn, negativePrompt: antiPreviousNegative, shotScale, cinematicAngle, camera: cameraWork });
    }
    if (isAbortedRef.current) return;
    const epId = preparedTasks[0]?.epId;
    const currentEp = episodesRef.current.find(e => e.id === epId);
    const cut1Index = preparedTasks.findIndex(t => t.cutId === 1);
    const needsCut1Anchor = !currentEp?.isMvMode && !currentEp?.characterTurnaroundMediaId && !currentEp?.masterAnchorMediaId;
    if (cut1Index !== -1 && needsCut1Anchor) {
      const cut1Task = preparedTasks.splice(cut1Index, 1)[0];
      addLog(`👑 Ep.${epId}: Cut 1（マスターアンカー）を先行生成中...`, 'process');
      await generateImage(cut1Task);
      if (isAbortedRef.current) return;
      // Cut 1 後のインターバル
      const initialDelay = isNightProfile ? 50000 : 10000;
      await sleepWithAbortCheck(initialDelay, () => isAbortedRef.current);
      if (isAbortedRef.current) return;
    }
    queueRef.current = [...preparedTasks];
    // 🌙 平日夜間時は 1並列・50秒間隔の完全直列安全運転。⚡土日・日中は 2並列・10秒間隔
    const concurrency = isNightProfile ? 1 : Math.max(1, settings.parallelCount || 2);
    const baseIntervalMs = isNightProfile ? 50000 : 10000;
    addLog(`⚙️ 実行モード: ${isNightProfile ? '🌙 平日夜間 (1並列 / 50s間隔安全直列)' : '⚡ 土日・日中 (2並列 / 快速)'}`, 'info');
    const workers = Array(concurrency).fill(null).map(async (_, workerIdx) => {
      if (workerIdx > 0) {
        await sleepWithAbortCheck(workerIdx * 5000, () => isAbortedRef.current);
      }
      while (queueRef.current.length > 0) {
        if (isAbortedRef.current) {
          queueRef.current = [];
          break;
        }
        const task = queueRef.current.shift();
        if (!task) break;
        await generateImage(task);
        if (queueRef.current.length > 0 && !isAbortedRef.current) {
          const jitter = Math.random() * (isNightProfile ? 15000 : 5000);
          const waitTime = Math.round(baseIntervalMs + jitter);
          addLog(`⏳ クォータ安全待機中 (${Math.round(waitTime / 1000)}秒)...`, 'process');
          const completedWait = await sleepWithAbortCheck(waitTime, () => isAbortedRef.current);
          if (!completedWait || isAbortedRef.current) {
            queueRef.current = [];
            break;
          }
        }
      }
    });
    await Promise.all(workers);
  };
  const generateImage = async (task: GenerationTask, isManualRetry = false) => {
    if (isManualRetry) {
      isAbortedRef.current = false;
    }
    if (isAbortedRef.current) return;
    const { epId, cutId } = task;
    updateCut(epId, cutId, { isGeneratingImage: true });
    const modelDef = resolveImageModel(task.imageModel || settings.imageModel);
    addLog(`🎨 Ep.${epId} C${cutId.toString().padStart(2, '0')}: 画像生成中 [${modelDef.label}]...`, 'process');
    try {
      const ep = episodesRef.current.find(e => e.id === epId);
      if (ep?.characterTurnaroundBase64 && !ep.characterTurnaroundMediaId) {
        try {
          const uploadRes = await Flow.upload({
            base64: ep.characterTurnaroundBase64,
            mimeType: 'image/png',
            name: `Turnaround_Ep${epId}.png`
          });
          if (uploadRes?.mediaId) {
            ep.characterTurnaroundMediaId = uploadRes.mediaId;
            updateEpisode(epId, { characterTurnaroundMediaId: uploadRes.mediaId });
          }
        } catch (_) {}
      }
      if (isAbortedRef.current) {
        updateCut(epId, cutId, { isGeneratingImage: false });
        return;
      }
      const currentCutObj = ep?.cuts.find(c => c.id === cutId);
      const isAnchorExcluded = task.isObjectOnly || 
        currentCutObj?.characterPresence === '4_hands_or_feet_detail' || 
        currentCutObj?.characterPresence === '5_scenic_or_still_life';
      const turnaroundMediaId = ep?.characterTurnaroundMediaId || (ep?.isMvMode ? undefined : activeReferenceRef.current?.mediaId);
      const fallbackAnchor = ep?.isMvMode ? undefined : ep?.masterAnchorMediaId;
      const refMediaId = isAnchorExcluded ? undefined : (turnaroundMediaId || task.referenceImageMediaId || fallbackAnchor);
      let effectiveNegative = task.negativePrompt || '';
      let positiveMandate = '';
      if (cutId > 1) {
        const prevCuts = ep?.cuts.filter(c => (c.id === cutId - 1 || c.id === cutId - 2) && (c.promptEn || c.shotScale)) || [];
        if (prevCuts.length > 0) {
          const prevContexts = prevCuts.map(c => ({
            scale: c.shotScale,
            angle: c.cinematicAngle || c.cameraWork,
            prompt: c.promptEn,
            tag: c.cameraWork
          }));
          const antiPrev = buildDynamicAntiPreviousNegative(prevContexts, task.shotScale);
          if (antiPrev) effectiveNegative = effectiveNegative ? `${effectiveNegative}, ${antiPrev}` : antiPrev;
          positiveMandate = buildPositiveAntiPreviousMandate(prevContexts);
        }
      }
      const charId = ep?.characterId || settings.characterId;
      const fixedChar = (charId && charId !== 'auto' && charId !== 'random') 
        ? SAFE_CHARACTERS.find(c => c.id === charId) 
        : undefined;
      const taskWithAntiPrevious: GenerationTask = {
        ...task,
        characterDna: fixedChar?.dnaPromptEn || task.characterDna || ep?.characterDna,
        focalSubject: currentCutObj?.focalPoint?.focalSubject,
        referenceImageMediaId: refMediaId,
        negativePrompt: effectiveNegative,
        antiPreviousMandate: positiveMandate
      };
      const effectiveActiveRef = ep?.isMvMode ? undefined : activeReferenceRef.current;
      const { finalPrompt, finalNegative, referenceImageMediaIds } = buildImagePromptAndNegative(taskWithAntiPrevious, settings, effectiveActiveRef);
      
      updateCut(epId, cutId, {
        finalPromptUsed: finalPrompt,
        finalNegativeUsed: finalNegative,
        negativePrompt: effectiveNegative,
        styleKeyUsed: task.styleKey || settings.taste,
        imageModelUsed: modelDef.label
      });
      const safeAspectRatio = '1:1';
      let safePrompt = finalPrompt && /[a-zA-Z0-9]/.test(finalPrompt) ? finalPrompt : 'Cinematic scene, high quality';
      safePrompt += ', balanced centered composition, ample negative space';
      const primaryModelName = modelDef?.name || '🍌 Nano Banana 2.1';
      let res: any;
      let attemptCount = 0;
      const retryVariations = [
        'masterpiece cinematic composition, atmospheric depth, fine details',
        'authentic visual storytelling, balanced framing, natural lighting',
        'vivid cinematic scene, rich environmental texture, dramatic perspective',
        'expressive anime cinematography, clean linework, harmonious color palette'
      ];
      try {
        res = await callWithRetry<any>(
          async () => {
            if (isAbortedRef.current) {
              throw new Error('処理が中断されました (Aborted)');
            }
            attemptCount++;
            let currentModelName = primaryModelName;
            let currentPrompt = safePrompt;
            let currentNegative = finalNegative;
            let currentRefIds = referenceImageMediaIds;
            const isRateLimitError = lastErrorRef.current && (
              lastErrorRef.current.includes('使用量の上限') || 
              lastErrorRef.current.includes('429') || 
              lastErrorRef.current.includes('RESOURCE_EXHAUSTED') ||
              lastErrorRef.current.includes('403')
            );
            if ((hasRateLimitedBanana2Ref.current || isRateLimitError) && !currentModelName.includes('Pro')) {
              hasRateLimitedBanana2Ref.current = true;
              currentModelName = '🍌 Nano Banana Pro';
            }
            if (attemptCount > 1) {
              const variation = retryVariations[(attemptCount - 2) % retryVariations.length];
              const sanitized = sanitizePromptForGoogleSafety(safePrompt);
              const maxLen = Math.max(400, 900 - attemptCount * 100);
              const trimmed = sanitized.slice(0, maxLen).replace(/,[^,]*$/, '').trim();
              currentPrompt = `${variation}, ${trimmed}`;
              if (attemptCount === 2 && !currentModelName.includes('Pro')) {
                currentModelName = '🍌 Nano Banana Pro';
              } else if (attemptCount >= 3) {
                currentModelName = '🍌 Nano Banana 2 Lite';
              }
            }
            const isPolicyIssue = lastErrorRef.current && (
              lastErrorRef.current.includes('SAFETY') || 
              lastErrorRef.current.includes('BLOCKED') || 
              lastErrorRef.current.includes('ポリシー') || 
              lastErrorRef.current.includes('POLICY')
            );
            if (isPolicyIssue) {
              const sanitized = sanitizePromptForGoogleSafety(safePrompt);
              currentPrompt = sanitized.slice(0, 800).replace(/,[^,]*$/, '').trim();
              if (attemptCount >= 3) currentModelName = '🍌 Nano Banana 2 Lite';
            }
            return await Flow.generate.image({ 
              prompt: currentPrompt,
              negativePrompt: currentNegative, 
              modelDisplayName: currentModelName,
              aspectRatio: safeAspectRatio as any,
              referenceImageMediaIds: currentRefIds 
            });
          },
          (attempt, max, delay, err) => {
            const waitStr = formatDurationMs(delay);
            const errMsg = formatErrorMessage(err);
            lastErrorRef.current = errMsg;
            const isRateLimit = errMsg.includes('使用量の上限') || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('403');
            if (isRateLimit && !hasRateLimitedBanana2Ref.current) {
              hasRateLimitedBanana2Ref.current = true;
              addLog(`👑 Ep.${epId} C${cutId}: [自動昇格] 独立別枠クォータを持つ「🍌 Nano Banana Pro」へ自動昇格します！`, 'success');
            }
            if (isRateLimit) {
              addLog(`⏳ Ep.${epId} C${cutId}: [クォータ回復待機] ${waitStr}待機中 (${attempt}/${max})...`, 'warning');
            } else {
              addLog(`⚠️ Ep.${epId} C${cutId}: 画像リトライ (${attempt}/${max}) ${waitStr}後...`, 'warning');
            }
          },
          { maxRetries: 3, timeoutMs: 90000, timeoutLabel: '画像生成', superBackoff: false, abortCheck: () => isAbortedRef.current }
        );
      } catch (firstErr: any) {
        if (!isAbortedRef.current) {
          addLog(`🛡️ Ep.${epId} C${cutId}: 救済プロンプト＆超軽量モデルで最終生成を実行中...`, 'warning');
          const rescuePrompt = sanitizePromptForGoogleSafety(safePrompt).slice(0, 400) + ', cinematic aesthetic';
          res = await callWithRetry<any>(
            () => Flow.generate.image({ 
              prompt: rescuePrompt,
              negativePrompt: '',
              modelDisplayName: '🍌 Nano Banana 2 Lite',
              aspectRatio: safeAspectRatio as any
            }),
            undefined,
            { maxRetries: 2, timeoutMs: 90000, abortCheck: () => isAbortedRef.current }
          );
        } else {
          throw firstErr;
        }
      }
      if (isAbortedRef.current) {
        updateCut(epId, cutId, { isGeneratingImage: false });
        return;
      }
      let finalBase64 = extractImageBase64(res);
      const finalMediaId = extractMediaId(res);
      if (!finalBase64 && finalMediaId && typeof (Flow as any)?.media?.getBase64 === 'function') {
        try { finalBase64 = extractImageBase64(await (Flow as any).media.getBase64(finalMediaId)); } catch (_) {}
      }
      updateCut(epId, cutId, { 
        imageMediaId: finalMediaId, 
        imageBase64: finalBase64, 
        isGeneratingImage: false,
        error: undefined
      });
      if (cutId === 1 && !ep?.isMvMode && !ep?.characterTurnaroundMediaId) {
        updateEpisode(epId, { masterAnchorMediaId: finalMediaId, masterAnchorBase64: finalBase64 });
        addLog(`👑 Ep.${epId}: Cut 1 の決定版ポートレートをマスターアンカーとして固定しました`, 'success');
      }
      addLog(`✨ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 画像生成完了`, 'success');
    } catch (err) {
      if (isAbortedRef.current) {
        updateCut(epId, cutId, { isGeneratingImage: false });
        return;
      }
      const errorMsg = formatErrorMessage(err);
      updateCut(epId, cutId, { isGeneratingImage: false, error: errorMsg });
      addLog(`❌ Ep.${epId} C${cutId}: 画像失敗 - ${errorMsg}`, 'error');
    }
  };
  const generateInfographicCover = useCallback(async (epId: number) => {
    if (isAbortedRef.current) return;
    const ep = episodesRef.current.find(e => e.id === epId);
    if (!ep) return;
    const pipelineContext = {
      settings,
      addLog,
      logsRef,
      isAbortedRef,
      episodesRef,
      setEpisodes,
      updateEpisode,
      runTasks,
      buildCutTasks,
      seriesManifestRef,
      setActiveSeriesManifest,
      activeReferenceRef,
      currentAssetRef
    };
    await ensureInfographicCover(pipelineContext, ep, true);
  }, [settings, addLog, updateEpisode]);
  const startProduction = async (overrideSettings?: Partial<GeneratorSettings>) => {
    const isValidOverride =
      overrideSettings &&
      typeof overrideSettings === 'object' &&
      !('nativeEvent' in (overrideSettings as any)) &&
      !('target' in (overrideSettings as any));
    const effectiveSettings: GeneratorSettings = {
      ...settings,
      ...(isValidOverride ? overrideSettings : {})
    };
    if (!effectiveSettings.characterId || effectiveSettings.characterId === 'random') {
      const charIds = SAFE_CHARACTERS.map(c => c.id);
      const chosenCharId = charIds[Math.floor(Math.random() * charIds.length)];
      const chosenChar = SAFE_CHARACTERS.find(c => c.id === chosenCharId);
      effectiveSettings.characterId = chosenCharId;
      addLog(`🎲 キャラクター自動抽選: 【${chosenChar?.icon || ''} ${chosenChar?.nameJa || chosenCharId}】に決定！`, 'success');
    }
    if (isProducingRef.current) {
      seriesQueueRef.current.push({ ...effectiveSettings });
      setQueuedSeriesCount(seriesQueueRef.current.length);
      const foundChar = SAFE_CHARACTERS.find(c => c.id === effectiveSettings.characterId);
      const themeShort = (effectiveSettings.theme || '').split('（')[0].trim();
      addLog(`📥 【連続投入】次シリーズ予約を追加しました！（待機キュー: ${seriesQueueRef.current.length}件目 / キャラ: ${foundChar?.nameJa || effectiveSettings.characterId} / テーマ: ${themeShort}）`, 'success');
      return;
    }
    isProducingRef.current = true;
    setIsProducing(true);
    isAbortedRef.current = false;
    let currentRunSettings: GeneratorSettings | undefined = effectiveSettings;
    let isFirstSeries = true;
    try {
      while (currentRunSettings && !isAbortedRef.current) {
        const existingEps = episodesRef.current;
        const prevEp = existingEps[0];
        const prevChar = prevEp?.characterId || (seriesManifestRef.current as any)?.characterId;
        const prevTheme = prevEp?.theme || seriesManifestRef.current?.settings?.theme || seriesManifestRef.current?.seriesTitle;
        const isCharChanged = Boolean(prevChar && currentRunSettings.characterId && prevChar !== currentRunSettings.characterId);
        const isThemeChanged = Boolean(prevTheme && currentRunSettings.theme && prevTheme !== currentRunSettings.theme && currentRunSettings.theme !== '🎲 ランダム（おまかせ）');
        const isAllPreviousCompleted = existingEps.length > 0 && existingEps.every(ep => {
          const cuts = ep.cuts || [];
          return cuts.length > 0 && cuts.every(c => !!(c.imageBase64 || c.imageMediaId));
        });
        if (!isFirstSeries || (existingEps.length > 0 && (isCharChanged || isThemeChanged || isAllPreviousCompleted))) {
          const reasonMsg = !isFirstSeries
            ? '連続投入・次シリーズ開始'
            : isAllPreviousCompleted 
              ? '前回の全エピソード完了（全カット描画済）' 
              : isCharChanged 
                ? 'キャラクター変更' 
                : 'テーマ変更';
          addLog(`🔄 【新シリーズ自動検出】${reasonMsg}を検出したため、前回の制作データを自動クリアし新規第1話からクリーンスタートします。`, 'process');
          episodesRef.current = [];
          setEpisodes([]);
          setActiveSeriesManifest(null);
          seriesManifestRef.current = null;
          activeReferenceRef.current = undefined;
          currentAssetRef.current = undefined;
          hasRateLimitedBanana2Ref.current = false;
          if (typeof window !== 'undefined') {
            delete (window as any).__STUDIO_EPISODES__;
            delete (window as any).__STUDIO_EPISODES_BACKUP__;
            delete (window as any).__STUDIO_SERIES_MANIFEST__;
            delete (window as any).__STUDIO_SERIES_HASH__;
          }
        }
        if (typeof window !== 'undefined' && (episodesRef.current.length === 0 || !(window as any).__STUDIO_SERIES_HASH__)) {
          const hashChars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
          const newSeriesHash = Array.from({ length: 4 }, () => hashChars[Math.floor(Math.random() * hashChars.length)]).join('');
          (window as any).__STUDIO_SERIES_HASH__ = newSeriesHash;
        }
        const isNight = currentRunSettings.executionProfile === 'night_safe';
        addLog(`🎬 【全自動プロデュース開始】プロファイル: ${isNight ? '🌙平日夜間 (6h安全・1並列・50s間隔)' : '⚡土日・日中 (快速・2並列)'} / 全${currentRunSettings.totalEpisodes || currentRunSettings.episodeCount || 1}話`, 'process');
        const pipelineContext = {
          settings: currentRunSettings,
          addLog,
          logsRef,
          isAbortedRef,
          episodesRef,
          setEpisodes,
          updateEpisode,
          runTasks,
          buildCutTasks,
          seriesManifestRef,
          setActiveSeriesManifest,
          activeReferenceRef,
          currentAssetRef
        };
        try {
          if (!currentRunSettings.isMvMode && currentRunSettings.productionMode !== 'mv' && seriesManifestRef.current && (seriesManifestRef.current.episodesPlan?.length || 0) > 0) {
            await runSeriesProduction(pipelineContext);
          } else {
            const curMode = currentRunSettings.productionMode || (currentRunSettings.isMvMode ? 'mv' : 'episodes');
            if (curMode in SHORTS_CONFIG_MAP) {
              await runShortsBatchProduction(pipelineContext, curMode);
            } else {
              await runSeriesProduction(pipelineContext);
            }
          }
        } catch (err: any) {
          if (!isAbortedRef.current) {
            addLog(`❌ 制作エラー: ${formatErrorMessage(err)}`, 'error');
          }
        }
        isFirstSeries = false;
        // 次のキューがあるかチェック（中止された場合は即時終了してゾンビ化防止）
        if (isAbortedRef.current) {
          seriesQueueRef.current = [];
          setQueuedSeriesCount(0);
          currentRunSettings = undefined;
          break;
        }
        if (seriesQueueRef.current.length > 0) {
          const nextSettings = seriesQueueRef.current.shift()!;
          setQueuedSeriesCount(seriesQueueRef.current.length);
          const seriesWaitMs = isNight ? 120000 : 5000;
          addLog(`⏭️ 【連続投入】次シリーズ待機中（${Math.round(seriesWaitMs / 1000)}秒安全待機 / 残り予約: ${seriesQueueRef.current.length}件）...`, 'process');
          const completedWait = await sleepWithAbortCheck(seriesWaitMs, () => isAbortedRef.current);
          if (!completedWait || isAbortedRef.current) {
            seriesQueueRef.current = [];
            setQueuedSeriesCount(0);
            currentRunSettings = undefined;
            break;
          }
          currentRunSettings = nextSettings;
        } else {
          currentRunSettings = undefined;
        }
      }
    } finally {
      isProducingRef.current = false;
      setIsProducing(false);
    }
  };
  const handleRerollTasteProduction = async (epId: number, targetTaste?: string) => {
    isAbortedRef.current = false;
    const ep = episodesRef.current.find(e => e.id === epId);
    if (!ep) return;
    const newTaste = targetTaste || settings.taste;
    if (!newTaste) return;
    const shortName = newTaste.split(' (')[0].split('（')[0];
    const targetCutCount = Math.min(settings.previewCutCount || 5, ep.cuts.length);
    addLog(`🎨 第${epId}話: 画風を「${shortName}」に変更し、先行${targetCutCount}カットの再作成を開始します！`, 'process');
    setIsProducing(true);
    const resetCuts: Cut[] = ep.cuts.map(c => ({
      ...c,
      imageBase64: undefined,
      imageMediaId: undefined,
      videoBase64: undefined,
      videoMediaId: undefined,
      styleKeyUsed: undefined,
      finalPromptUsed: undefined,
      finalNegativeUsed: undefined,
      isGeneratingImage: false,
      isGeneratingVideo: false,
      error: undefined
    }));
    const updatedEp: Episode = {
      ...ep,
      taste: newTaste,
      characterTurnaroundBase64: undefined,
      characterTurnaroundMediaId: undefined,
      masterAnchorBase64: undefined,
      masterAnchorMediaId: undefined,
      coverBase64: undefined,
      coverMediaId: undefined,
      cuts: resetCuts,
      isGenerating: true,
      isPreviewDone: false,
      isDone: false
    };
    updateEpisode(epId, updatedEp);
    setEpisodes(prev => prev.map(e => e.id === epId ? updatedEp : e));
    episodesRef.current = episodesRef.current.map(e => e.id === epId ? updatedEp : e);
    const pipelineCtx = {
      settings: { ...settings, taste: newTaste },
      addLog,
      logsRef,
      isAbortedRef,
      episodesRef,
      setEpisodes,
      updateEpisode,
      runTasks,
      buildCutTasks: (e: Episode, cuts: Cut[], styleKey?: string) => buildCutTasks(e, cuts, styleKey || newTaste),
      seriesManifestRef,
      setActiveSeriesManifest,
      activeReferenceRef,
      currentAssetRef
    };
    try {
      if (settings.enableTurnaroundSheet !== false) {
        addLog(`🎨 第${epId}話: 新画風「${shortName}」での主人公三面図マスターを設計中...`, 'process');
        const turnaround = await ensureCharacterTurnaround(pipelineCtx as any, updatedEp);
        if (turnaround.mediaId) {
          updatedEp.characterTurnaroundMediaId = turnaround.mediaId;
          updatedEp.characterTurnaroundBase64 = turnaround.base64;
          updateEpisode(epId, {
            characterTurnaroundMediaId: turnaround.mediaId,
            characterTurnaroundBase64: turnaround.base64
          });
        }
      }
      if (isAbortedRef.current) return;
      const pendingCuts = updatedEp.cuts.slice(0, targetCutCount);
      await runTasks(buildCutTasks(updatedEp, pendingCuts, newTaste));
      if (isAbortedRef.current) return;
      const freshEp = episodesRef.current.find(e => e.id === epId) || updatedEp;
      await ensureInfographicCover(pipelineCtx as any, freshEp);
      const completedCount = freshEp.cuts.slice(0, targetCutCount).filter(c => c.imageBase64 || c.imageMediaId).length;
      updateEpisode(epId, {
        isGenerating: false,
        isPreviewDone: completedCount >= targetCutCount,
        isDone: completedCount >= updatedEp.cuts.length
      });
      addLog(`✨ 第${epId}話: 画風「${shortName}」への切り替え＆先行${targetCutCount}カット再作成完了！`, 'success');
    } catch (err: any) {
      addLog(`❌ 画風切り替えエラー: ${formatErrorMessage(err)}`, 'error');
    } finally {
      setIsProducing(false);
    }
  };
  return { 
    episodes, 
    setEpisodes, 
    isProducing, 
    queuedSeriesCount,
    startProduction, 
    abortProduction: handleAbort, 
    resumeSeries, 
    activeSeriesManifest, 
    setActiveSeriesManifest, 
    handleGenerateRemaining, 
    handleRerollTasteProduction, 
    generateImage, 
    generateInfographicCover, 
    updateCut, 
    updateEpisode, 
    clearEpisodes: handleClearEpisodes 
  };
}

