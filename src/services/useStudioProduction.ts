import { useState, useRef, useEffect, useCallback } from 'react';
import { Flow } from 'flow-sdk';
import { Episode, Cut, GeneratorSettings, VideoModelType, GenerationTask, SeriesManifest, SeriesEpisodePlan } from '../types';
import { 
  IMAGE_MODELS, 
  VIDEO_MODELS, 
  DEFAULT_ASPECT_RATIO, 
  CUTS_PER_EPISODE, 
  TASTES,
  resolveImageModel,
  resolveVideoModel,
  resolveCameraWork,
  resolveRecommendedTelopStaging,
  resolveRecommendedCameraWorkAndKenBurns
} from '../constants';
import { safeJsonParse, callWithRetry, formatErrorMessage, createDefaultCut, isCutSelectedForVideo } from './utils';
import { saveStory, getAllReferenceAssets, saveReferenceAsset } from './db';
import { downloadZip } from './exportService';
import { renderFullEpisodeMovie, renderKenBurnsVideo } from './browserVideoService';
import { 
  directShot, 
  buildImagePromptAndNegative, 
  buildCharacterScreeningPrompt, 
  buildGrandDesignPrompt, 
  buildNextEpisodePlanPrompt, 
  buildScriptPrompt,
  buildCompactScriptPrompt,
  extractHighlights,
  checkIsHistorical,
  PreviousShotInfo
} from './directorService';
import { 
  getStoryboardPreset, 
  buildDynamicAntiPreviousNegative, 
  isMvChorusCut, 
  MV_ANTI_CAMERA_LOOK_NEGATIVE 
} from './promptEngine';
import { LogEntry } from '../components/StudioLogs';
import { useEpisodeState } from './useEpisodeState';

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
            mimeType: (manifest.referenceAsset.mimeType || 'image/png') as any,
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
      
      const shotScale = existingCut?.shotScale || 'Wide';
      const cinematicAngle = existingCut?.cinematicAngle || 'Cinematic perspective';
      const promptEn = existingCut?.promptEn || task.prompt;
      
      // 直前カット対比ネガティブをミリ秒計算（AI通信ゼロ）
      let antiPreviousNegative = buildDynamicAntiPreviousNegative(previousShotInfo);
      const isAllowedEyeContact = settings.isMvMode && isMvChorusCut(task.cutId);
      if (settings.isMvMode && !isAllowedEyeContact) {
        antiPreviousNegative = antiPreviousNegative ? `${antiPreviousNegative}, ${MV_ANTI_CAMERA_LOOK_NEGATIVE}` : MV_ANTI_CAMERA_LOOK_NEGATIVE;
      }

      updateCut(task.epId, task.cutId, { 
        isDirecting: false,
        negativePrompt: antiPreviousNegative
      });

      previousShotInfo = {
        scale: shotScale,
        angle: cinematicAngle,
        prompt: promptEn,
        tag: existingCut?.cameraWork,
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
        (attempt, max, delay) => addLog(`Retrying Image (attempt ${attempt}/${max}) after ${delay} ms...`, 'warning'),
        5, 90000
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

  const generateVideo = async (epId: number, cutId: number, modelType: VideoModelType) => {
    const cut = episodesRef.current.find(e => e.id === epId)?.cuts.find(c => c.id === cutId);
    let mediaId = cut?.imageMediaId;
    if (!mediaId && cut?.imageBase64) {
      try {
        const cleanImg = cut.imageBase64.replace(/^data:[^;]+;base64,/, '');
        const up = await Flow.upload({ base64: cleanImg, mimeType: 'image/png', name: `Cut_${epId}_${cutId}` });
        mediaId = up.mediaId;
        updateCut(epId, cutId, { imageMediaId: mediaId });
      } catch (_) {}
    }
    if (!mediaId) {
      addLog(`⚠️ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 画像がないため動画生成をスキップ`, 'warning');
      updateCut(epId, cutId, { isGeneratingVideo: false });
      return;
    }
    // 動画モデル定義から安全に解決（デフォルト値・尺・コストを自動取得）
    const modelDef = resolveVideoModel(modelType);
    updateCut(epId, cutId, { isGeneratingVideo: true, videoModelUsed: modelDef.name, error: undefined });
    addLog(`🎥 Ep.${epId} C${cutId.toString().padStart(2, '0')}: 動画生成開始 (${modelDef.name})`, 'info');

    try {
      // カメラモーションを定義レジストリから解決して自然に注入
      const cameraMotionText = cut?.cameraMotion || (cut?.cameraWork ? resolveCameraWork(cut.cameraWork).motionPrompt : '');
      const cameraInstruction = cameraMotionText ? ` [Camera Motion: ${cameraMotionText}]` : '';
      const finalVideoPrompt = `${cut?.promptEn || ''}${cameraInstruction}`;

      const res = await callWithRetry<any>(
        () => Flow.generate.video({ 
          prompt: finalVideoPrompt, 
          firstFrameImageMediaId: mediaId, 
          modelDisplayName: modelDef.name, 
          durationSeconds: modelDef.defaultDuration, 
          aspectRatio: DEFAULT_ASPECT_RATIO as any 
        }),
        (attempt, max, delay) => addLog(`Retrying Video (attempt ${attempt}/${max}) after ${delay} ms...`, 'warning'),
        5, 180000, '動画生成'
      );
      const cleanVideoBase64 = res.base64 ? res.base64.replace(/^data:[^;]+;base64,/, '') : '';
      updateCut(epId, cutId, { 
        videoBase64: cleanVideoBase64, 
        videoMediaId: res.mediaId, 
        isGeneratingVideo: false, 
        error: undefined,
        videoDuration: modelDef.defaultDuration 
      });
      addLog(`🎬 Ep.${epId} C${cutId.toString().padStart(2, '0')}: 動画生成完了 (${modelDef.defaultDuration}s)`, 'success');
    } catch (err) {
      updateCut(epId, cutId, { isGeneratingVideo: false, error: '動画失敗' });
      addLog(`❌ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 動画失敗 - ${formatErrorMessage(err)}`, 'error');
    }
  };

  const generateBrowserVideo = async (epId: number, cutId: number) => {
    const cut = episodesRef.current.find(e => e.id === epId)?.cuts.find(c => c.id === cutId);
    if (!cut?.imageBase64) return;
    updateCut(epId, cutId, { isGeneratingVideo: true, videoModelUsed: 'Browser (0pt)', error: undefined });
    try {
      const isMvMode = episodesRef.current.find(e => e.id === epId)?.isMvMode || false;
      const base64 = await renderKenBurnsVideo(cut, 4, isMvMode);
      const cleanVideoBase64 = base64 ? base64.replace(/^data:[^;]+;base64,/, '') : '';
      updateCut(epId, cutId, { videoBase64: cleanVideoBase64, isGeneratingVideo: false, error: undefined, videoDuration: 4 });
      addLog(`🎬 Ep.${epId} C${cutId.toString().padStart(2, '0')}: ブラウザ動画化完了`, 'success');
    } catch (err) { 
      updateCut(epId, cutId, { isGeneratingVideo: false, error: '失敗' }); 
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
          const uploadRes = await Flow.upload({ base64: asset.base64, mimeType: asset.mimeType as any, name: `Ref: ${asset.name}` });
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

    try {
      if (settings.productionMode === 'style-matrix') {
        const allTasteKeys = Object.keys(TASTES);
        const targetTastes = allTasteKeys.slice(0, settings.episodeCount);
        addLog(`🎨 【画風比較モード】同じ物語で ${targetTastes.length} 種類の画風を同時生成・比較します！`, 'process');

        // 既存エピソードが存在するか確認（画面上にあるエピソードの脚本を最優先で100%流用）
        const existingEp = episodesRef.current.find(e => e.cuts && e.cuts.some(c => c.narrationJp || c.promptEn));
        
        let sharedScript: any = null;
        let baseCutsData: any[] = [];

        if (existingEp) {
          // 既存エピソードから【画風名】等のプレフィックスを取り除いた純粋なタイトルを取得
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
            isSelected: c.isSelectedForVideo ?? isCutSelectedForVideo(j, settings.videoRatio),
            highlights: c.telop?.highlights || extractHighlights(c.narrationJp, existingEp.highlightWords || [])
          }));
        } else {
          // 画面にエピソードがない場合は、選択中のテーマに沿った本格脚本を新規策定
          addLog(`📖 テーマ『${settings.theme}』に合わせた比較用脚本（12カット）をAIに執筆依頼中...`, 'process');
          
          const planPrompt = `Create a compelling episode 1 title and synopsis based on:
Country: ${settings.country}
Theme: ${settings.theme}
Era: ${settings.era}
Output JSON ONLY:
{
  "titleJp": "Japanese Episode Title",
  "titleEn": "English Episode Title",
  "summary": "Short 2-line summary"
}`;
          const planRes = await callWithRetry<any>(
            () => Flow.generate.text(planPrompt),
            undefined, 4
          );
          const generatedPlan = safeJsonParse<any>(planRes.text, {
            titleJp: settings.theme.split('（')[0].replace(/^[^\w\s\u4e00-\u9faf]+/, '').trim() || '運命の物語',
            titleEn: 'The Tale of Destiny',
            summary: `${settings.theme}の世界観で描かれるドラマ`
          });

          const scriptPrompt = buildScriptPrompt(1, generatedPlan as any, settings.country, settings.theme, settings.era, settings.isMangaMode, settings.isMvMode, settings.taste);
          const scriptRes = await callWithRetry<any>(
            () => Flow.generate.text(scriptPrompt),
            (attempt, max, delay, err) => addLog(`⚠️ 脚本リトライ (${attempt}/${max}) ${delay}ms後... 理由: ${formatErrorMessage(err)}`, 'warning'),
            5
          );
          const parsed = safeJsonParse<any>(scriptRes.text, { titleJp: generatedPlan.titleJp, titleEn: generatedPlan.titleEn, cuts: [] });
          sharedScript = {
            ...parsed,
            titleJp: parsed.titleJp || generatedPlan.titleJp,
            titleEn: parsed.titleEn || generatedPlan.titleEn
          };
          addLog(`✨ テーマに即した共通脚本が完成！『${sharedScript.titleJp}』（全${targetTastes.length}画風へ展開開始）`, 'success');

          const rawCuts = Array.isArray(sharedScript.cuts) ? sharedScript.cuts : (Array.isArray(sharedScript.scenes) ? sharedScript.scenes : []);
          baseCutsData = Array.from({ length: CUTS_PER_EPISODE }, (_, j) => {
            const cutData = rawCuts[j] || {};
            const narration = cutData.narrationJp || cutData.narration || '';
            const plot = cutData.basicPlot || cutData.promptEn || cutData.prompt || '';
            const cutHighlights = cutData.highlights || sharedScript.highlightWords || [];
            return {
              id: j + 1,
              narration,
              plot,
              isSelected: isCutSelectedForVideo(j, settings.videoRatio),
              highlights: extractHighlights(narration, cutHighlights)
            };
          });
        }

        // 各画風のエピソードカードを並列展開
        const matrixEpisodes: Episode[] = targetTastes.map((tasteKey, idx) => {
          const epId = idx + 1;
          const shortTaste = tasteKey.split(' (')[0].trim();
          return {
            id: epId,
            internalId: crypto.randomUUID(),
            titleJp: `【${shortTaste}】${sharedScript.titleJp}`,
            titleEn: sharedScript.titleEn,
            summary: sharedScript.summary,
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

        addLog(`🎉 全 ${targetTastes.length} 種類の画風比較マトリクスの制作が完了しました！見比べて最適な画風をお選びください！`, 'success');
        return;
      }

      // ── YouTubeバズ特化Shorts / MVモード（指定本数 × 各12カット） ──
      const shortsConfigMap: Record<string, { label: string; unit: string; icon: string }> = {
        mv: { label: '音楽MV', unit: '曲', icon: '🎵' },
        trivia: { label: '衝撃雑学Shorts', unit: '本', icon: '💡' },
        quotes: { label: '偉人名言Shorts', unit: '本', icon: '📜' },
        folklore: { label: '怪異・未解決Shorts', unit: '本', icon: '👻' },
        craft: { label: '職人魂ショート', unit: '本', icon: '🏯' }
      };
      const curMode = settings.productionMode || (settings.isMvMode ? 'mv' : 'episodes');
      if (curMode in shortsConfigMap) {
        const modeInfo = shortsConfigMap[curMode];
        const totalEpCount = Math.max(1, settings.episodeCount || 1);

        // 既存エピソードがある場合は上書きせず、末尾に追記（継続追加）する
        const existingEpisodes = episodesRef.current || [];
        const existingMaxId = existingEpisodes.length > 0 ? Math.max(...existingEpisodes.map(e => e.id)) : 0;
        const startEpIndex = existingMaxId + 1;
        const endEpIndex = existingMaxId + totalEpCount;
        const isContinuing = existingMaxId > 0;

        if (isContinuing) {
          addLog(`${modeInfo.icon} 【${modeInfo.label}モード】既存 ${existingMaxId} ${modeInfo.unit}を保持したまま、追加で全 ${totalEpCount} ${modeInfo.unit}（第${startEpIndex}〜${endEpIndex}${modeInfo.unit}）の制作を開始します！[世界観: ${settings.theme}]`, 'process');
        } else {
          addLog(`${modeInfo.icon} 【${modeInfo.label}モード】全 ${totalEpCount} ${modeInfo.unit}の制作を開始します！[世界観: ${settings.theme}]`, 'process');
        }

        const baseRawTitle = settings.theme.split('（')[0].replace(/^[^\w\s一-龯]+/, '').trim() || '情景の記録';
        const defaultEnTitle = 'Cinematic Story';

        for (let epIndex = startEpIndex; epIndex <= endEpIndex; epIndex++) {
          const currentBatchStep = epIndex - startEpIndex + 1;
          if (isAbortedRef.current) {
            addLog(`🛑 制作が中断されました（今回作成: ${currentBatchStep - 1}/${totalEpCount}${modeInfo.unit}完了）`, 'warning');
            break;
          }

          const rawTitle = (endEpIndex > 1) ? `${baseRawTitle} Vol.${epIndex}` : baseRawTitle;
          const currentEnTitle = (endEpIndex > 1) ? `${defaultEnTitle} Vol.${epIndex}` : defaultEnTitle;

          addLog(`${modeInfo.icon} 【第${epIndex}${modeInfo.unit} / 今回制作: ${currentBatchStep}曲目（全${totalEpCount}${modeInfo.unit}）】「${rawTitle}」の脚本・演出（12カット）を策定中...`, 'process');

          const curPlan = {
            epNumber: epIndex,
            titleJp: rawTitle,
            titleEn: currentEnTitle,
            summary: `${baseRawTitle}の世界観で紡がれる第${epIndex}の映像作品（全12カット）`
          };

          const fullScriptPrompt = buildScriptPrompt(
            epIndex, curPlan, settings.country, settings.theme, settings.era, false, curMode === 'mv', settings.taste, curMode, settings.isMultiPanel
          );

          let currentScriptPrompt = fullScriptPrompt;
          let scriptRes;
          try {
            scriptRes = await callWithRetry<any>(
              () => Flow.generate.text(currentScriptPrompt),
              (attempt, max, delay, err) => {
                console.error(`[Script Retry ${attempt}/${max}]`, err);
                if (attempt >= 2) {
                  // 2回目以降のリトライは軽量コンパクトプロンプトに切り替えてGoogle側の負荷・トークン制限・503を回避
                  currentScriptPrompt = buildCompactScriptPrompt(
                    epIndex, curPlan, settings.country, settings.theme, settings.era, false, curMode === 'mv', settings.taste, curMode, settings.isMultiPanel
                  );
                  addLog(`⚠️ 脚本リトライ (${attempt}/${max}): 軽量プロンプトに自動最適化して再試行中...`, 'process');
                } else {
                  addLog(`⚠️ 脚本リトライ (${attempt}/${max}) ${delay}ms後... 理由: ${formatErrorMessage(err)}`, 'warning');
                }
              },
              5
            );
          } catch (e: any) {
            const errorMsg = formatErrorMessage(e);
            console.error(`[Script Failed]`, e, { prompt: currentScriptPrompt });
            addLog(`❌ 第${epIndex}${modeInfo.unit}の脚本策定に失敗しました: ${errorMsg}`, 'error');
            continue;
          }

          const parsed = safeJsonParse<any>(scriptRes.text, {
            titleJp: rawTitle, titleEn: currentEnTitle, summary: `${rawTitle}の情景`,
            eraAnalysisJp: '演出構図とテロップ連動。', forbiddenAnachronisms: ['過剰な劇的演出'],
            authenticAttireEn: 'Cinematic style attire', forbiddenKeywordsEn: 'explosive drama',
            coverCatchphraseJp: '心揺さぶる一瞬の物語。', highlightWords: ['光'], cuts: []
          });

          const rawCuts = Array.isArray(parsed.cuts) ? parsed.cuts : (Array.isArray(parsed.scenes) ? parsed.scenes : []);
          const baseCutsData = Array.from({ length: CUTS_PER_EPISODE }, (_, j) => {
            const cutData = rawCuts[j] || {};
            const narration = cutData.narrationJp || cutData.narration || '';
            const plot = cutData.basicPlot || cutData.promptEn || cutData.prompt || '';
            const cutHighlights = cutData.highlights || parsed.highlightWords || [];
            const preset = getStoryboardPreset(j + 1, curMode === 'mv', false);
            const staging = resolveRecommendedTelopStaging(j + 1, curMode === 'mv', false, undefined, curMode);
            
            const cut = createDefaultCut(j + 1, narration, plot, isCutSelectedForVideo(j, settings.videoRatio));
            cut.shotScale = preset.scale;
            cut.cinematicAngle = preset.angle;
            cut.panelLayout = cutData.panelLayout || (settings.isMultiPanel ? 'dynamic-multi' : 'single');
            const recCw = resolveRecommendedCameraWorkAndKenBurns(j + 1, curMode, curMode === 'mv', settings.isMangaMode);
            cut.cameraWork = recCw.id;
            cut.cameraMotion = recCw.motionPrompt;
            cut.kenBurnsPreset = recCw.recommendedKenBurns;
            Object.assign(cut.telop, staging);
            cut.telop.highlights = extractHighlights(narration, cutHighlights);
            return cut;
          });

          const newEpisode: Episode = {
            id: epIndex, internalId: crypto.randomUUID(),
            titleJp: `${modeInfo.icon} ${parsed.titleJp || rawTitle}`, titleEn: parsed.titleEn || currentEnTitle,
            summary: parsed.summary || `${rawTitle}の情景`, eraAnalysis: parsed.eraAnalysisJp || '作品を引き立てる演出構図。',
            forbiddenAnachronisms: parsed.forbiddenAnachronisms || ['過剰な劇的演出'],
            authenticAttireEn: parsed.authenticAttireEn || 'Cinematic style attire', forbiddenKeywordsEn: 'explosive drama',
            coverCatchphraseJp: parsed.coverCatchphraseJp || '心揺さぶる一瞬の物語。', highlightWords: parsed.highlightWords || ['光'],
            cuts: baseCutsData, isGenerating: true, isGeneratingRemainingImages: false, isBatchGeneratingVideos: false,
            isPreviewDone: false, isDone: false, taste: settings.taste, era: settings.era, theme: settings.theme,
            isMvMode: curMode === 'mv', productionMode: curMode as any
          };

          setEpisodes(prev => [...prev.filter(e => e.id !== epIndex), newEpisode]);
          episodesRef.current = [...episodesRef.current.filter(e => e.id !== epIndex), newEpisode];
          addLog(`✨ 第${epIndex}${modeInfo.unit}『${newEpisode.titleJp}』全12カットの情景演出が確定！描画を開始します...`, 'success');

          const targetCutCount = Math.min(settings.previewCutCount, CUTS_PER_EPISODE);
          await runTasks(buildCutTasks(newEpisode, newEpisode.cuts.slice(0, targetCutCount)));

          const isAllDone = targetCutCount >= CUTS_PER_EPISODE;
          updateEpisode(epIndex, { 
            isGenerating: false, 
            isPreviewDone: true, 
            isDone: isAllDone 
          });
          addLog(`✅ 第${epIndex}${modeInfo.unit}『${newEpisode.titleJp}』先行${targetCutCount}カットの画像生成が完了しました！`, 'success');

          if (settings.autoVideo && !isAbortedRef.current) {
            const currentEpForVideo = episodesRef.current.find(e => e.id === epIndex);
            const selectedCuts = currentEpForVideo ? currentEpForVideo.cuts.slice(0, targetCutCount).filter(c => c.isSelectedForVideo) : [];
            if (selectedCuts.length > 0) {
              addLog(`🎬 第${epIndex}${modeInfo.unit}の自動動画化を開始します（対象: ${selectedCuts.length}カット）...`, 'process');
              await handleBulkVideo(epIndex);
            }
          }

          // 先行プレビュー＋動画化完了フラグを確実にONにして全ボタンを解放、かつ全カットのisGeneratingVideoを確実にクリア
          episodesRef.current = episodesRef.current.map(e => e.id === epIndex ? {
            ...e,
            isGenerating: false,
            isBatchGeneratingVideos: false,
            isPreviewDone: true,
            isDone: true,
            cuts: e.cuts.map(c => ({ ...c, isGeneratingVideo: false }))
          } : e);
          setEpisodes(prev => prev.map(e => e.id === epIndex ? {
            ...e,
            isGenerating: false,
            isBatchGeneratingVideos: false,
            isPreviewDone: true,
            isDone: true,
            cuts: e.cuts.map(c => ({ ...c, isGeneratingVideo: false }))
          } : e));

          // 自動ダウンロードがONの場合、パッケージング＆直接保存を実行（ポップアップモーダルなし）
          const freshEp = episodesRef.current.find(e => e.id === epIndex) || newEpisode;
          if (settings.autoDownload && !isAbortedRef.current) {
            addLog(`📦 第${epIndex}${modeInfo.unit}の完了時自動ダウンロードを開始します...`, 'process');
            const res = await downloadZip(freshEp, addLog, undefined);
            if (res) {
              updateEpisode(epIndex, {
                packageZipBlobUrl: res.blobUrl,
                packageZipFilename: res.filename,
                packageZipSizeStr: res.sizeStr
              });
            }
          }
          await saveStory({ titleJp: freshEp.titleJp, titleEn: freshEp.titleEn, country: settings.country, era: settings.era, theme: settings.theme, protagonistSummary: freshEp.summary || '', createdAt: new Date().toISOString() });
        }

        if (!isAbortedRef.current) {
          addLog(`🎉 全 ${totalEpCount} ${modeInfo.unit}の${modeInfo.label}制作がすべて完了しました！`, 'success');
        }
        return;
      }

      if (!seriesManifestRef.current) {
        const isHist = checkIsHistorical(settings.era, settings.theme);
        const genreLabel = settings.isMvMode ? '音楽MVシリーズ' : settings.isMangaMode ? '漫画シリーズ' : isHist ? '大河ドラマ' : '連続ドラマ';
        addLog(`📜 全${settings.episodeCount}話の${genreLabel}グランドデザインをAIに策定依頼中... [世界観・テーマ: ${settings.theme}]`, 'process');
        const designPrompt = buildGrandDesignPrompt(settings.episodeCount, settings.country, settings.theme, settings.era, settings.isMangaMode, settings.isMvMode);
        const designRes = await callWithRetry<any>(
          () => Flow.generate.text(designPrompt),
          (attempt, max, delay) => addLog(`Retrying Grand Design (attempt ${attempt}/${max}) after ${delay} ms...`, 'warning'),
          5
        );
        const design = safeJsonParse<any>(designRes.text, { seriesTitle: 'Untitled Series', overallSynopsis: '', episodesPlan: [] });

        seriesManifestRef.current = {
          seriesTitle: design.seriesTitle,
          totalEpisodes: settings.episodeCount,
          currentEpisodeId: 1,
          completedEpisodeIds: [],
          overallSynopsis: design.overallSynopsis,
          episodesPlan: design.episodesPlan,
          referenceAsset: currentAssetRef.current ? {
            ...currentAssetRef.current,
            characterDna: activeReferenceRef.current?.characterDna,
            styleDna: activeReferenceRef.current?.styleDna,
            antiPoseNegative: activeReferenceRef.current?.antiPoseNegative,
            eraNegative: activeReferenceRef.current?.eraNegative
          } : undefined,
          settings: settings
        };
        setActiveSeriesManifest({ ...seriesManifestRef.current });

        const initialEpisodes: Episode[] = design.episodesPlan.map(p => ({
          id: p.epNumber,
          internalId: crypto.randomUUID(),
          titleJp: p.titleJp,
          titleEn: p.titleEn,
          summary: p.summary,
          cuts: Array.from({ length: CUTS_PER_EPISODE }, (_, j) => createDefaultCut(j + 1, '脚本策定待ち...', '', false)),
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
        addLog(`🏛️ シリーズ設計図「${design.seriesTitle}」策定完了！（全${design.episodesPlan.length}話のプロット確定）`, 'success');
      }

      const manifest = seriesManifestRef.current!;

      // 続編・再開時の未策定エピソードの自動拡張
      const completedIds = manifest.completedEpisodeIds || [];
      const nextEpId = completedIds.length > 0 ? Math.max(...completedIds) + 1 : 1;
      const existingPlanCount = manifest.episodesPlan?.length || 0;
      // ユーザー設定の生成話数、または次に生成すべき話数（最低限次話）の大きい方を目標とする
      const targetMaxEpId = Math.max(nextEpId, existingPlanCount, settings.episodeCount);

      if (targetMaxEpId > existingPlanCount) {
        manifest.episodesPlan = manifest.episodesPlan || [];
        for (let epNum = existingPlanCount + 1; epNum <= targetMaxEpId; epNum++) {
          if (isAbortedRef.current) break;
          addLog(`📖 【第${epNum}話】これまでの展開を踏まえた続編プロットをAIに策定依頼中...`, 'process');

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
            const planRes = await callWithRetry<any>(
              () => Flow.generate.text(nextPlanPrompt),
              undefined, 4
            );
            newPlan = safeJsonParse<SeriesEpisodePlan>(planRes.text, {
              epNumber: epNum,
              titleJp: `第${epNum}話 運命の分岐点`,
              titleEn: `Episode ${epNum} Turning Point`,
              summary: `これまでの物語から続く新たなドラマと波乱の展開`
            });
          } catch (e) {
            newPlan = {
              epNumber: epNum,
              titleJp: `第${epNum}話 運命の継承`,
              titleEn: `Episode ${epNum} Destiny`,
              summary: `第${epNum - 1}話から続く物語`
            };
          }

          manifest.episodesPlan.push(newPlan);
          manifest.totalEpisodes = manifest.episodesPlan.length;

          const newEpisodeCard: Episode = {
            id: epNum,
            internalId: crypto.randomUUID(),
            titleJp: newPlan.titleJp,
            titleEn: newPlan.titleEn,
            summary: newPlan.summary,
            cuts: Array.from({ length: CUTS_PER_EPISODE }, (_, j) => createDefaultCut(j + 1, '脚本策定待ち...', '', false)),
            isGenerating: false,
            isGeneratingRemainingImages: false,
            isBatchGeneratingVideos: false,
            isPreviewDone: false,
            isDone: false,
            taste: settings.taste,
            era: settings.era,
            theme: settings.theme
          };

          setEpisodes(prev => {
            if (prev.some(e => e.id === epNum)) return prev;
            return [...prev, newEpisodeCard];
          });
          episodesRef.current = [...episodesRef.current.filter(e => e.id !== epNum), newEpisodeCard];
          addLog(`✨ 【第${epNum}話】プロット策定完了: 『${newPlan.titleJp}』`, 'success');
        }
        setActiveSeriesManifest({ ...manifest });
      }

      for (let i = 0; i < (manifest.episodesPlan?.length || 0); i++) {
        const currentPlan = manifest.episodesPlan[i];
        const epId = currentPlan.epNumber || (i + 1);
        if (manifest.completedEpisodeIds.includes(epId)) continue;
        if (isAbortedRef.current) break;

        try {
          addLog(`📖 【第${epId}話】「${currentPlan.titleJp}」の脚本・時代考証をAIに執筆依頼中...`, 'process');
          updateEpisode(epId, { isGenerating: true });

          let currentDramaPrompt = buildScriptPrompt(epId, currentPlan, settings.country, settings.theme, settings.era, settings.isMangaMode, settings.isMvMode, settings.taste, 'episodes', settings.isMultiPanel);
          let scriptRes;
          try {
            scriptRes = await callWithRetry<any>(
              () => Flow.generate.text(currentDramaPrompt),
              (attempt, max, delay, err) => {
                console.error(`[Drama Script Retry ${attempt}/${max}]`, err);
                if (attempt >= 2) {
                  currentDramaPrompt = buildCompactScriptPrompt(
                    epId, currentPlan, settings.country, settings.theme, settings.era, settings.isMangaMode, settings.isMvMode, settings.taste, 'episodes', settings.isMultiPanel
                  );
                  addLog(`⚠️ 第${epId}話 脚本リトライ (${attempt}/${max}): 軽量プロンプトに自動最適化して再試行中...`, 'process');
                } else {
                  addLog(`⚠️ 第${epId}話 脚本リトライ (${attempt}/${max}) ${delay}ms後... 理由: ${formatErrorMessage(err)}`, 'warning');
                }
              },
              5
            );
          } catch (e: any) {
            const errorMsg = formatErrorMessage(e);
            console.error(`[Drama Episode ${epId} Script Failed]`, e, { prompt: currentDramaPrompt });
            addLog(`⚠️ 第${epId}話の脚本AI生成が混雑のため、基本構成フォールバックで生成を続行します: ${errorMsg}`, 'warning');
            scriptRes = {
              text: JSON.stringify({
                titleJp: currentPlan.titleJp,
                titleEn: currentPlan.titleEn,
                summary: currentPlan.summary || `${currentPlan.titleJp}の物語`,
                eraAnalysisJp: '江戸の町人文化と人情の情景。',
                cuts: Array.from({ length: CUTS_PER_EPISODE }, (_, cIdx) => ({
                  id: cIdx + 1,
                  panelLayout: settings.isMultiPanel ? (cIdx % 2 === 0 ? 'split-2' : 'dynamic-multi') : 'single',
                  basicPlot: `Cinematic traditional Japanese drama scene, ${settings.theme}, episode ${epId} scene ${cIdx + 1}, authentic historical Edo period atmosphere, high quality visual composition`,
                  narrationJp: `第${epId}話 場面${cIdx + 1}の情景`
                }))
              })
            };
          }

          const sharedScript: any = safeJsonParse<any>(scriptRes.text, { titleJp: currentPlan.titleJp, titleEn: currentPlan.titleEn, cuts: [] });
          addLog(`✨ 【第${epId}話】脚本＆時代考証が完成！（考証: ${sharedScript.eraAnalysisJp?.slice(0, 24) || '完了'}...）`, 'success');

          const rawCuts = Array.isArray(sharedScript.cuts) ? sharedScript.cuts : (Array.isArray(sharedScript.scenes) ? sharedScript.scenes : (Array.isArray(sharedScript) ? sharedScript : []));

          const episodeCuts: Cut[] = Array.from({ length: CUTS_PER_EPISODE }, (_, j) => {
            const cutData = rawCuts[j] || {};
            const narration = cutData.narrationJp || cutData.narration || '';
            const plot = cutData.basicPlot || cutData.promptEn || cutData.prompt || '';
            const cut = createDefaultCut(j + 1, narration, plot, isCutSelectedForVideo(j, settings.videoRatio));
            cut.panelLayout = cutData.panelLayout || (settings.isMultiPanel ? 'dynamic-multi' : 'single');
            const preset = getStoryboardPreset(j + 1, false, settings.isMangaMode);
            cut.shotScale = cutData.shotScale || preset.scale;
            cut.cinematicAngle = cutData.cinematicAngle || preset.angle;
            const cwDef = cutData.cameraWork ? resolveCameraWork(cutData.cameraWork) : resolveRecommendedCameraWorkAndKenBurns(j + 1, 'episodes', false, settings.isMangaMode);
            cut.cameraWork = cwDef.id;
            cut.cameraMotion = cwDef.motionPrompt;
            cut.kenBurnsPreset = cwDef.recommendedKenBurns;
            const dramaStaging = resolveRecommendedTelopStaging(j + 1, false, false, undefined, 'episodes');
            Object.assign(cut.telop, dramaStaging);
            
            // AI指定のハイライト、またはエピソード代表キーワード、または漢字熟語自動抽出を適用
            const cutHighlights = cutData.highlights || sharedScript.highlightWords || [];
            cut.telop.highlights = extractHighlights(narration, cutHighlights);

            return cut;
          });

          updateEpisode(epId, {
            titleJp: sharedScript.titleJp, titleEn: sharedScript.titleEn, summary: sharedScript.summary,
            eraAnalysis: sharedScript.eraAnalysisJp, forbiddenAnachronisms: sharedScript.forbiddenAnachronisms,
            authenticAttireEn: sharedScript.authenticAttireEn, forbiddenKeywordsEn: sharedScript.forbiddenKeywordsEn,
            coverCatchphraseJp: sharedScript.coverCatchphraseJp, coverCatchphraseEn: sharedScript.coverCatchphraseEn,
            highlightWords: sharedScript.highlightWords || [], cuts: episodeCuts,
            taste: settings.taste, era: settings.era, theme: settings.theme, productionMode: 'episodes'
          });

          addLog(`🎨 【第${epId}話】先行プレビュー ${settings.previewCutCount} カットの描画タスクを開始...（並列度: ${settings.parallelCount}）`, 'process');
          const currentEp = episodesRef.current.find(e => e.id === epId)!;
          await runTasks(buildCutTasks(currentEp, episodeCuts.slice(0, settings.previewCutCount)));
          addLog(`🎉 【第${epId}話】「${currentPlan.titleJp}」の先行プレビュー制作が完了しました！`, 'success');

          const currentEpForVideo = episodesRef.current.find(e => e.id === epId);
          const cutsToAnimate = currentEpForVideo ? currentEpForVideo.cuts.filter(c => c.isSelectedForVideo) : [];
          if (settings.autoVideo && cutsToAnimate.length > 0 && !isAbortedRef.current) {
            updateEpisode(epId, { isBatchGeneratingVideos: true });
            for (const cutTask of cutsToAnimate) {
              if (isAbortedRef.current) break;
              const currentCut = episodesRef.current.find(e => e.id === epId)?.cuts.find(c => c.id === cutTask.id);
              if (currentCut && (currentCut.imageMediaId || currentCut.imageBase64)) {
                const targetModel = resolveVideoModel(currentCut.targetVideoModel || settings.videoModel).id;
                await generateVideo(epId, cutTask.id, targetModel as VideoModelType);
              }
            }
            updateEpisode(epId, { isBatchGeneratingVideos: false });
          }

          // 確実に全カットの isGeneratingVideo を解除し、先行プレビュー完了フラグをセット
          episodesRef.current = episodesRef.current.map(e => e.id === epId ? {
            ...e,
            isGenerating: false,
            isBatchGeneratingVideos: false,
            isPreviewDone: true,
            isDone: true,
            cuts: e.cuts.map(c => ({ ...c, isGeneratingVideo: false }))
          } : e);
          setEpisodes(prev => prev.map(e => e.id === epId ? {
            ...e,
            isGenerating: false,
            isBatchGeneratingVideos: false,
            isPreviewDone: true,
            isDone: true,
            cuts: e.cuts.map(c => ({ ...c, isGeneratingVideo: false }))
          } : e));

          manifest.completedEpisodeIds = Array.from(new Set([...manifest.completedEpisodeIds, epId]));
          manifest.currentEpisodeId = epId + 1;
          setActiveSeriesManifest({ ...manifest });

          const freshEp = episodesRef.current.find(e => e.id === epId)!;
          if (settings.autoDownload && !isAbortedRef.current) {
            const res = await downloadZip(freshEp, addLog, manifest);
            if (res) {
              updateEpisode(epId, {
                packageZipBlobUrl: res.blobUrl,
                packageZipFilename: res.filename,
                packageZipSizeStr: res.sizeStr
              });
            }
          }
          await saveStory({ titleJp: freshEp.titleJp, titleEn: freshEp.titleEn, country: settings.country, era: settings.era, theme: settings.theme, protagonistSummary: freshEp.summary || '', createdAt: new Date().toISOString() });
        } catch (epErr: any) {
          addLog(`⚠️ 第 ${epId} 話の生成中にエラーが発生しました。スキップして次へ進みます: ${formatErrorMessage(epErr)}`, 'warning');
          updateEpisode(epId, { isGenerating: false, error: '生成中断' });
          continue;
        }
      }
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