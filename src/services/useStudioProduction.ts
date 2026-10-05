import { runStyleMatrixProduction, runShortsBatchProduction, runSeriesProduction, SHORTS_CONFIG_MAP } from './productionPipelines';
import { useRef, useCallback } from 'react';
import { Flow } from 'flow-sdk';
import { Episode, Cut, GeneratorSettings, VideoModelType, GenerationTask, SeriesManifest } from '../types';
import { 
  DEFAULT_ASPECT_RATIO, 
  CUTS_PER_EPISODE, 
  TASTES,
  resolveImageModel,
  resolveVideoModel,
  resolveRecommendedTelopStaging
} from '../constants';
import { safeJsonParse, callWithRetry, formatErrorMessage, createDefaultCut, formatDurationMs } from './utils';
import { getAllReferenceAssets } from './db';
import { renderFullEpisodeMovie, renderKenBurnsVideo } from './browserVideoService';
import { 
  directShot, 
  buildImagePromptAndNegative, 
  buildCharacterScreeningPrompt, 
  extractHighlights,
  checkIsHistorical,
  PreviousShotInfo
} from './directorService';
import { useEpisodeState } from './useEpisodeState';
import { saveReferenceAsset } from './db';
import { resolveCameraWork } from '../config/studioDefinitions';
import type { LogEntry } from '../components/StudioLogs';
import { useVideoGeneration } from './useVideoGeneration';

interface UseStudioProductionProps {
  settings: GeneratorSettings;
  addLog: (message: string, type?: LogEntry['type']) => void;
  refreshStories: () => Promise<void>;
  onPackageReady?: (data: {
    epId: number;
    titleJp: string;
    filename: string;
    blobUrl: string;
    sizeStr: string;
    videoCount: number;
    imageCount: number;
  }) => void;
}

export function useStudioProduction({ settings, addLog, refreshStories, onPackageReady }: UseStudioProductionProps) {

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

  const queueRef = useRef<GenerationTask[]>([]);

  const handleAbort = useCallback(() => {
    queueRef.current = [];
    abortProduction();
  }, [abortProduction]);

  const currentAssetRef = useRef<{ name: string; base64: string; mimeType: string } | null>(null);


  const activeReferenceRef = useRef<{
    mediaId: string;
    characterDna: string;
    styleDna: string;
    antiPoseNegative: string;
    eraNegative: string;
  } | null>(null);

  const { generateVideo, generateBrowserVideo } = useVideoGeneration({
    settings,
    addLog,
    isAbortedRef,
    episodesRef,
    updateCut
  });


  const resumeSeries = useCallback(async (manifest: SeriesManifest, onAssetRestored?: (assetId: number) => void) => {
    seriesManifestRef.current = manifest;
    setActiveSeriesManifest({ ...manifest });
    addLog(`📂 シリーズ「${manifest.seriesTitle}」の設計図を読込（全${manifest.totalEpisodes}話中 ${manifest.completedEpisodeIds?.length || 0}話完了済み）。`, 'process');
    
    const resumedEpisodes: Episode[] = manifest.episodesPlan.map(p => {
      const isDone = manifest.completedEpisodeIds.includes(p.epNumber);
      return {
        id: p.epNumber,
        internalId: crypto.randomUUID(),
        titleJp: p.titleJp,
        titleEn: p.titleEn,
        summary: p.summary,
        cuts: Array.from({ length: CUTS_PER_EPISODE }, (_, j) => createDefaultCut(j + 1, isDone ? '制作完了' : '待機中...', '', false)),
        isGenerating: false,
        isGeneratingRemainingImages: false,
        isBatchGeneratingVideos: false,
        isPreviewDone: isDone,
        isDone: isDone,
        taste: manifest.settings?.taste,
        era: manifest.settings?.era,
        theme: manifest.settings?.theme
      };
    });
    setEpisodes(resumedEpisodes);

    if (manifest.referenceAsset && manifest.referenceAsset.base64) {
      try {
        const assets = await getAllReferenceAssets();
        let matched = assets.find(a => a.name === manifest.referenceAsset!.name && a.base64.slice(0, 50) === manifest.referenceAsset!.base64.slice(0, 50));
        let assetId = matched?.id;
        if (!assetId) {
          assetId = await saveReferenceAsset({
            name: manifest.referenceAsset.name || 'Restored_Character',
            base64: manifest.referenceAsset.base64,
            mimeType: manifest.referenceAsset.mimeType || 'image/png',
            createdAt: new Date().toISOString()
          });
          addLog(`✨ キャラクター画像を保管庫(Vault)に自動復元しました。`, 'success');
        }

        currentAssetRef.current = {
          name: manifest.referenceAsset.name || 'Character',
          base64: manifest.referenceAsset.base64,
          mimeType: manifest.referenceAsset.mimeType || 'image/png'
        };

        if (manifest.referenceAsset.characterDna) {
          const uploadRes = await Flow.upload({
            base64: manifest.referenceAsset.base64,
            mimeType: (manifest.referenceAsset.mimeType || 'image/png') as 'image/png' | 'image/jpeg' | 'image/webp',
            name: `Ref: ${manifest.referenceAsset.name || 'Character'}`
          });
          activeReferenceRef.current = {
            mediaId: uploadRes.mediaId,
            characterDna: manifest.referenceAsset.characterDna,
            styleDna: manifest.referenceAsset.styleDna || '',
            antiPoseNegative: manifest.referenceAsset.antiPoseNegative || '',
            eraNegative: manifest.referenceAsset.eraNegative || ''
          };
          addLog(`✨ キャラクターDNAと画風DNAを完全復元しました。`, 'success');
        }

        if (assetId && onAssetRestored) onAssetRestored(assetId);
      } catch (err: any) {
        addLog(`⚠️ 画像・DNAの復元スキップ: ${err.message}`, 'warning');
      }
    }

    const nextEpNumber = (manifest.completedEpisodeIds && manifest.completedEpisodeIds.length > 0)
      ? Math.max(...manifest.completedEpisodeIds) + 1
      : 1;
    addLog(`🚀 第 ${nextEpNumber} 話から自動再開できます。「生成開始」を押してください。`, 'info');
  }, [addLog]);

  const buildCutTasks = (ep: Episode, cuts: Cut[], styleKey?: string): GenerationTask[] => {
    return cuts.map(c => ({
      epId: ep.id,
      cutId: c.id,
      prompt: c.promptEn,
      styleKey: styleKey || ep.taste || settings.taste,
      imageModel: settings.imageModel,
      isMvMode: ep.isMvMode,
      isMultiPanel: settings.isMultiPanel,
      panelLayout: c.panelLayout,
      storyContext: ep.summary || '',
      eraAnalysis: ep.eraAnalysis,
      forbiddenAnachronisms: ep.forbiddenAnachronisms,
      authenticAttireEn: ep.authenticAttireEn,
      forbiddenKeywordsEn: ep.forbiddenKeywordsEn,
      referenceImageMediaId: activeReferenceRef.current?.mediaId
    }));
  };

  const handleGenerateRemaining = async (epId: number) => {
    const ep = episodesRef.current.find(e => e.id === epId);
    if (!ep) return;
    const remainingCuts = ep.cuts.filter(c => !c.imageBase64);
    if (remainingCuts.length === 0) {
      addLog(`Ep.${epId}: すべての画像が生成済みです。`, 'info');
      return;
    }
    updateEpisode(epId, { isGeneratingRemainingImages: true });
    addLog(`🎨 Ep.${epId}: 残り ${remainingCuts.length} 枚の画像生成を開始...`, 'process');
    await runTasks(buildCutTasks(ep, remainingCuts));
    updateEpisode(epId, { isGeneratingRemainingImages: false });
    addLog(`✅ Ep.${epId}: すべての画像生成が完了しました。`, 'success');
    if (settings.autoVideo && !isAbortedRef.current) {
      handleBulkBrowserVideo(epId);
    }
  };

  const handleExportFullMovie = async (epId: number) => {
    const ep = episodesRef.current.find(e => e.id === epId);
    if (!ep) return;
    addLog(`🎬 Ep.${epId}: 映像結合を開始...`, 'process');
    updateEpisode(epId, { isExportingMovie: true });
    try {
      const movieBlob = await renderFullEpisodeMovie(ep, (idx, total) => {
        addLog(`🎞️ 映像レンダリング中... ${idx}/${total}`, 'info');
      });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        updateEpisode(epId, { fullMovieBase64: base64 });
        await Flow.download({ base64, mimeType: 'video/mp4', filename: `Episode_${epId}_Export.mp4` });
        addLog(`✅ Ep.${epId}: 動画の出力に成功しました。`, 'success');
      };
      reader.readAsDataURL(movieBlob);
    } catch (err) {
      addLog(`❌ レンダリング失敗: ${formatErrorMessage(err)}`, 'error');
    } finally {
      updateEpisode(epId, { isExportingMovie: false });
    }
  };

  const runTasks = async (tasks: GenerationTask[]) => {
    // ── Phase 1: 演出・構図決定フェーズ（直列連鎖で前カットの構図を完全に追跡＆ネガティブ化） ──
    const preparedTasks: GenerationTask[] = [];
    let previousShotInfo: PreviousShotInfo | undefined = undefined;

    // 最初のタスクの直前カットが既存エピソードにあれば初期値として設定
    if (tasks.length > 0) {
      const firstTask = tasks[0];
      const prevCut = episodesRef.current.find(e => e.id === firstTask.epId)?.cuts.find(c => c.id === firstTask.cutId - 1);
      if (prevCut && prevCut.shotScale) {
        previousShotInfo = {
          scale: prevCut.shotScale,
          angle: prevCut.cinematicAngle,
          prompt: prevCut.promptEn,
          tag: prevCut.cameraWork
        };
      }
    }

    for (let i = 0; i < tasks.length; i++) {
      if (isAbortedRef.current) break;
      const task = tasks[i];
      const existingCut = episodesRef.current.find(e => e.id === task.epId)?.cuts.find(c => c.id === task.cutId);
      
      updateCut(task.epId, task.cutId, { isDirecting: true });
      addLog(`🎬 Ep.${task.epId} C${task.cutId.toString().padStart(2, '0')}: 直前構図との対比演出をAIディレクション中...`, 'process');

      // オンデマンド演出AI（directShot）で直前カットとの対比・構図・詳細プロンプトを生成
      const directResult = await directShot(
        task,
        settings,
        activeReferenceRef.current,
        previousShotInfo,
        addLog
      );

      const shotScale = directResult.shotScale || existingCut?.shotScale || 'Wide';
      const cinematicAngle = directResult.cinematicAngle || existingCut?.cinematicAngle || 'Cinematic perspective';
      const promptEn = directResult.promptEn || existingCut?.promptEn || task.prompt;
      const antiPreviousNegative = directResult.negativePrompt || '';

      updateCut(task.epId, task.cutId, { 
        isDirecting: false,
        promptEn,
        shotScale,
        cinematicAngle,
        cameraWork: directResult.cameraWork || existingCut?.cameraWork,
        cameraMotion: directResult.cameraMotion || existingCut?.cameraMotion,
        kenBurnsPreset: directResult.kenBurnsPreset || existingCut?.kenBurnsPreset,
        telop: directResult.telop ? { ...existingCut?.telop, ...directResult.telop } : existingCut?.telop,
        negativePrompt: antiPreviousNegative
      });

      previousShotInfo = {
        scale: shotScale,
        angle: cinematicAngle,
        prompt: promptEn,
        tag: directResult.cameraWork || existingCut?.cameraWork,
        telop: existingCut?.telop
      };

      preparedTasks.push({
        ...task,
        prompt: promptEn,
        negativePrompt: antiPreviousNegative
      });
    }

    if (isAbortedRef.current) return;

    addLog(`🎬 全 ${preparedTasks.length} カットの対比構図演出を確定（並列画像生成を開始します）`, 'process');

    // ── Phase 2: 画像生成フェーズ（確定したプロンプト＆直前構図ネガティブで並列実行） ──
    queueRef.current = [...preparedTasks];
    const concurrency = Math.max(1, settings.parallelCount || 2);
    const workers = Array(concurrency).fill(null).map(async () => {
      while (queueRef.current.length > 0) {
        if (isAbortedRef.current) break;
        const task = queueRef.current.shift();
        if (!task) break;
        await generateImage(task);
      }
    });
    await Promise.all(workers);
  };

  const generateImage = async (task: GenerationTask) => {
    if (isAbortedRef.current) return;
    const { epId, cutId } = task;
    updateCut(epId, cutId, { isGeneratingImage: true });

    // 定義レジストリから完全解決（キー、ラベル、表示名のいずれからでも確実に解決）
    const modelDef = resolveImageModel(task.imageModel || settings.imageModel);

    addLog(`🎨 Ep.${epId} C${cutId.toString().padStart(2, '0')}: 画像生成中 [${modelDef.label}]...`, 'process');

    try {
      const { finalPrompt, finalNegative, referenceImageMediaIds } = buildImagePromptAndNegative(task, settings, activeReferenceRef.current);
      
      // 生成前に投入パラメータを保存（失敗してもインスペクターで追えるようにする）
      updateCut(epId, cutId, {
        finalPromptUsed: finalPrompt,
        finalNegativeUsed: finalNegative,
        styleKeyUsed: task.styleKey || settings.taste,
        imageModelUsed: modelDef.label
      });

      const res = await callWithRetry<any>(
        () => Flow.generate.image({ 
          prompt: finalPrompt, 
          negativePrompt: finalNegative, 
          modelDisplayName: modelDef.name, 
          aspectRatio: DEFAULT_ASPECT_RATIO as any, 
          referenceImageMediaIds 
        }),
        (attempt, max, delay, err, isSuper) => {
          const waitStr = formatDurationMs(delay);
          const errMsg = formatErrorMessage(err);
          if (isSuper) {
            addLog(`🌙 Ep.${epId} C${cutId.toString().padStart(2, '0')}: [超指数バックオフ ${attempt - 5}/3] 深夜帯サーバー高負荷のため ${waitStr}待機して自動再開します... (理由: ${errMsg})`, 'warning');
          } else {
            addLog(`⚠️ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 画像リトライ (${attempt}/${max}) ${waitStr}後... (理由: ${errMsg})`, 'warning');
          }
        },
        {
          maxRetries: 5,
          timeoutMs: 90000,
          timeoutLabel: '画像生成',
          superBackoff: settings.superBackoff,
          abortCheck: () => isAbortedRef.current
        }
      );
      updateCut(epId, cutId, { 
        imageMediaId: res.mediaId, 
        imageBase64: res.base64, 
        isGeneratingImage: false,
        error: undefined
      });
      addLog(`✨ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 画像生成完了`, 'success');
    } catch (err) {
      const errorMsg = formatErrorMessage(err);
      updateCut(epId, cutId, { isGeneratingImage: false, error: errorMsg });
      addLog(`❌ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 画像失敗 - ${errorMsg}`, 'error');
    }
  };

  const handleBulkVideo = async (epId: number) => {
    const ep = episodesRef.current.find(e => e.id === epId);
    if (!ep) return;
    setIsProducing(true);
    updateEpisode(epId, { isBatchGeneratingVideos: true });
    for (const cut of ep.cuts) {
      if (isAbortedRef.current) break;
      const currentCut = episodesRef.current.find(e => e.id === epId)?.cuts.find(c => c.id === cut.id);
      if (currentCut?.isSelectedForVideo && !currentCut.videoBase64 && !currentCut.videoMediaId) {
        const targetModel = resolveVideoModel(currentCut.targetVideoModel || settings.videoModel).id;
        await generateVideo(epId, currentCut.id, targetModel as VideoModelType);
      }
    }
    // 確実に全カットの isGeneratingVideo を解除し、バッチフラグをOFFにする
    episodesRef.current = episodesRef.current.map(e => e.id === epId ? {
      ...e,
      isBatchGeneratingVideos: false,
      cuts: e.cuts.map(c => ({ ...c, isGeneratingVideo: false }))
    } : e);
    setEpisodes(prev => prev.map(e => e.id === epId ? {
      ...e,
      isBatchGeneratingVideos: false,
      cuts: e.cuts.map(c => ({ ...c, isGeneratingVideo: false }))
    } : e));
    setIsProducing(false);
  };

  const handleBulkBrowserVideo = async (epId: number) => {
    const ep = episodesRef.current.find(e => e.id === epId);
    if (!ep) return;
    const targets = ep.cuts.filter(c => !c.videoBase64);
    setIsProducing(true);
    updateEpisode(epId, { isBatchGeneratingVideos: true });
    for (const cut of targets) await generateBrowserVideo(epId, cut.id);
    updateEpisode(epId, { isBatchGeneratingVideos: false });
    setIsProducing(false);
  };

  const startProduction = async () => {
    if (isProducing) return;
    setIsProducing(true);
    isAbortedRef.current = false;

    if (settings.selectedAssetId && !activeReferenceRef.current) {
      try {
        const assets = await getAllReferenceAssets();
        const asset = assets.find(a => a.id === settings.selectedAssetId);
        if (asset) {
          currentAssetRef.current = { name: asset.name, base64: asset.base64, mimeType: asset.mimeType };
          addLog('🔍 キャラクターDNA抽出中...', 'process');
          const uploadRes = await Flow.upload({ base64: asset.base64, mimeType: asset.mimeType as 'image/png' | 'image/jpeg' | 'image/webp', name: `Ref: ${asset.name}` });
          const screeningPrompt = buildCharacterScreeningPrompt(settings.era, settings.country, settings.isMvMode, settings.theme);
          const screenRes = await callWithRetry<any>(
            () => Flow.generate.text(screeningPrompt, { images: [{ base64: asset.base64, mimeType: asset.mimeType }] }),
            (attempt, max, delay) => addLog(`Retrying DNA Analysis (attempt ${attempt}/${max}) after ${delay} ms...`, 'warning'),
            5
          );
          const screening = safeJsonParse<any>(screenRes.text, { characterDna: '', styleDna: '', antiPoseNegative: '', eraNegative: '' });
          activeReferenceRef.current = {
            mediaId: uploadRes.mediaId,
            characterDna: screening.characterDna,
            styleDna: screening.styleDna,
            antiPoseNegative: screening.antiPoseNegative,
            eraNegative: screening.eraNegative
          };
          addLog('✨ DNA確立完了。', 'success');
        }
      } catch (err) { addLog('⚠️ DNA解析失敗。', 'warning'); }
    }

    const pipelineContext = {
      settings,
      addLog,
      isAbortedRef,
      episodesRef,
      setEpisodes,
      updateEpisode,
      runTasks,
      buildCutTasks,
      generateVideo,
      handleBulkVideo,
      seriesManifestRef,
      setActiveSeriesManifest,
      activeReferenceRef,
      currentAssetRef
    };

    try {
      if (settings.productionMode === 'style-matrix') {
        await runStyleMatrixProduction(pipelineContext);
        return;
      }

      const curMode = settings.productionMode || (settings.isMvMode ? 'mv' : 'episodes');
      if (curMode in SHORTS_CONFIG_MAP) {
        await runShortsBatchProduction(pipelineContext, curMode);
        return;
      }

      await runSeriesProduction(pipelineContext);
    } catch (err: any) {
      console.error('Fatal Production Error:', err);
      const detail = err.stack ? err.stack.split('\n')[0] + ' (' + err.message + ')' : formatErrorMessage(err);
      addLog(`❌ 制作エラー: ${detail}`, 'error');
    } finally {
      setIsProducing(false);
      refreshStories();
    }
  };

  const handleBulkRerollTelop = useCallback((epId: number) => {
    const targetEp = episodesRef.current.find(e => e.id === epId);
    if (!targetEp) return;
    let prevStaging: any = undefined;
    const isMv = !!targetEp.isMvMode || targetEp.titleJp.startsWith('🎵');
    const isHist = checkIsHistorical(targetEp.era, targetEp.theme);
    const updatedCuts = targetEp.cuts.map((c) => {
      const staging = resolveRecommendedTelopStaging(c.id, isMv, isHist, prevStaging);
      prevStaging = { transition: staging.transition, position: staging.position, style: staging.style };
      const rawText = c.telop?.fullText || c.narrationJp || '';
      const existingHighlights = c.telop?.highlights || [];
      const highlights = existingHighlights.length > 0 ? existingHighlights : extractHighlights(rawText);
      return {
        ...c,
        telop: { fullText: rawText, highlights, style: staging.style, transition: staging.transition, position: staging.position, directorNote: staging.directorNote }
      };
    });
    setEpisodes(prev => prev.map(e => e.id === epId ? { ...e, cuts: updatedCuts } : e));
    episodesRef.current = episodesRef.current.map(e => e.id === epId ? { ...e, cuts: updatedCuts } : e);
    addLog(`🎲 第 ${epId} 話: 全12カットのテロップ演出（動き・配置）を一括再抽選しました！（画像は保持）`, 'success');
  }, [addLog]);

  return { episodes, isProducing, startProduction, abortProduction: handleAbort, resumeSeries, activeSeriesManifest, handleGenerateRemaining, handleBulkVideo, handleBulkBrowserVideo, handleExportFullMovie, handleBulkRerollTelop, generateImage, generateVideo, generateBrowserVideo, updateCut, updateEpisode, clearEpisodes };
}