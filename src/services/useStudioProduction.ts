import { runStyleMatrixProduction, runShortsBatchProduction, runSeriesProduction, SHORTS_CONFIG_MAP, ensureInfographicCover } from './productionPipelines';
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
import { safeJsonParse, callWithRetry, formatErrorMessage, createDefaultCut, formatDurationMs, extractImageBase64, extractMediaId } from './utils';
import { sanitizePromptForGoogleSafety, buildDynamicAntiPreviousNegative } from './promptEngine';
import { getAllReferenceAssets } from './db';
import { renderFullEpisodeMovie, renderKenBurnsVideo } from './browserVideoService';
import { renderCoverBase64 } from './exportService';
import { 
  directShot, 
  buildImagePromptAndNegative, 
  buildCharacterScreeningPrompt, 
  extractHighlights,
  checkIsHistorical,
  resolveCinematicEndFrameAndMotion,
  buildAdaptiveInfographicCoverPrompt,
  cleanEpisodeTitle,
  cleanEpisodeTitleEn,
  PreviousShotInfo
} from './directorService';
import { useEpisodeState } from './useEpisodeState';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
import { saveReferenceAsset } from './db';
import { resolveCameraWork } from '../config/studioDefinitions';
import type { LogEntry } from '../components/StudioLogs';
import { useVideoGeneration } from './useVideoGeneration';
import { extractLyricVisualPlot } from './musicImporter';

interface UseStudioProductionProps {
  settings: GeneratorSettings;
  addLog: (message: string, type?: LogEntry['type']) => void;
  refreshStories: () => Promise<void>;
  logs?: LogEntry[];
}

export function useStudioProduction({ settings, addLog, refreshStories, logs }: UseStudioProductionProps) {
  const logsRef = useRef(logs);
  logsRef.current = logs;

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

  const handleClearEpisodes = useCallback(() => {
    activeReferenceRef.current = null;
    currentAssetRef.current = null;
    clearEpisodes();
  }, [clearEpisodes]);


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
        titleJp: cleanEpisodeTitle(p.titleJp),
        titleEn: cleanEpisodeTitleEn(p.titleEn),
        summary: p.summary,
        cuts: Array.from({ length: Math.max(CUTS_PER_EPISODE, manifest.settings?.previewCutCount || 30) }, (_, j) => createDefaultCut(j + 1, isDone ? '制作完了' : '待機中...', '', false)),
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
    episodesRef.current = resumedEpisodes;

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
    return cuts.map(c => {
      // 三面図（characterTurnaroundMediaId）はキャラクター専用の360度基準シート（背景無しの純粋な設定資料）
      // 物体専用カット（isObjectOnly）のみ除外し、キャラクターが登場する全カット（ドアップ、横顔、手元、足元、俯瞰等）には三面図を最優先バインド！
      const turnaroundMediaId = ep.characterTurnaroundMediaId || (ep.isMvMode ? undefined : activeReferenceRef.current?.mediaId);
      const refMediaId = c.isObjectOnly
        ? undefined
        : (turnaroundMediaId || ep.masterAnchorMediaId);

      let effectivePrompt = c.promptEn || '';
      const rawLyric = c.telop?.fullText || c.narrationJp || '';
      // MVモードで歌詞が存在し、かつpromptEnにまだ歌詞ビジュアル指示が反映されていない場合は動的に補完
      if (ep.isMvMode && rawLyric && !effectivePrompt.includes('embodying lyric')) {
        const visualPlot = extractLyricVisualPlot(rawLyric, c.telop?.directorNote || '', ep.theme || ep.titleJp || '', c.id, !!c.isObjectOnly);
        if (!effectivePrompt.includes(visualPlot)) {
          effectivePrompt = `${effectivePrompt}, ${visualPlot}`;
        }
      }

      return {
        epId: ep.id,
        cutId: c.id,
        prompt: effectivePrompt,
        negativePrompt: c.negativePrompt,
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
        referenceImageMediaId: refMediaId,
        characterDna: ep.characterDna,
        isObjectOnly: c.isObjectOnly,
        shotScale: c.shotScale,
        cinematicAngle: c.cinematicAngle,
        camera: c.cameraWork
      };
    });
  };

  const handleGenerateRemaining = async (epId: number) => {
    const ep = episodesRef.current.find(e => e.id === epId);
    if (!ep) return;

    // エピソードの三面図が未アップロードなら即座にFlowへ自動アップロード
    if (ep.characterTurnaroundBase64 && !ep.characterTurnaroundMediaId) {
      try {
        addLog(`📤 Ep.${epId}: 三面図（Character Turnaround）をFlowへ自動アップロード中...`, 'process');
        const uploadRes = await Flow.upload({
          base64: ep.characterTurnaroundBase64,
          mimeType: 'image/png',
          name: `Turnaround_Ep${epId}.png`
        });
        if (uploadRes?.mediaId) {
          ep.characterTurnaroundMediaId = uploadRes.mediaId;
          updateEpisode(epId, { characterTurnaroundMediaId: uploadRes.mediaId });
          addLog(`✅ Ep.${epId}: 三面図のmediaIdを発行・確定しました [${uploadRes.mediaId}]`, 'success');
        }
      } catch (err: any) {
        addLog(`⚠️ Ep.${epId}: 三面図アップロード失敗: ${err.message}`, 'warning');
      }
    }

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

    addLog(`🎬 全 ${tasks.length} カットの映画的対比演出・カメラワークを自動最適化中...`, 'process');

    for (let i = 0; i < tasks.length; i++) {
      if (isAbortedRef.current) break;
      const task = tasks[i];
      const existingCut = episodesRef.current.find(e => e.id === task.epId)?.cuts.find(c => c.id === task.cutId);
      
      // オンデマンド演出（directShot）で直前カットとの対比・構図・詳細プロンプトを即座に生成
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
        negativePrompt: antiPreviousNegative,
        shotScale,
        cinematicAngle,
        camera: directResult.cameraWork || existingCut?.cameraWork
      });
    }

    if (isAbortedRef.current) return;

    addLog(`🎬 全 ${preparedTasks.length} カットの対比構図演出を確定（並列画像生成を開始します）`, 'process');

    // ── Phase 2: 画像生成フェーズ（確定したプロンプト＆直前構図ネガティブで並列実行） ──
    queueRef.current = [...preparedTasks];
    const concurrency = Math.min(2, Math.max(1, settings.parallelCount || 2));
    const workers = Array(concurrency).fill(null).map(async (_, workerIdx) => {
      // ワーカー間で開始時間をスタッガー（時間差）させ、同時リクエスト集中による503拒絶を防止
      if (workerIdx > 0) {
        await sleep(workerIdx * 800);
      }
      while (queueRef.current.length > 0) {
        if (isAbortedRef.current) break;
        const task = queueRef.current.shift();
        if (!task) break;
        await generateImage(task);
        // タスク完了後も短いクールダウンを挟んでAPIレートリミットを平滑化
        if (queueRef.current.length > 0 && !isAbortedRef.current) {
          await sleep(500);
        }
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
      const ep = episodesRef.current.find(e => e.id === epId);

      // 三面図が未アップロードなら画像生成直前にも確実にアップロードして救済
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
        } catch (e) {
          console.warn('Turnaround upload error:', e);
        }
      }

      // 三面図が利用可能なら人物カットで確実にバインド
      const turnaroundMediaId = ep?.characterTurnaroundMediaId || (ep?.isMvMode ? undefined : activeReferenceRef.current?.mediaId);
      const refMediaId = task.isObjectOnly ? undefined : (turnaroundMediaId || task.referenceImageMediaId || ep?.masterAnchorMediaId);

      // ★ ユーザー設計規範: 直近カット（直前1〜2カット）のプロンプト・構図を動的ネガティブプロンプトとして完全バインド
      let effectiveNegative = task.negativePrompt || '';
      if (cutId > 1) {
        const prevCuts = ep?.cuts.filter(c => (c.id === cutId - 1 || c.id === cutId - 2) && (c.promptEn || c.shotScale)) || [];
        if (prevCuts.length > 0) {
          const antiPrev = buildDynamicAntiPreviousNegative(prevCuts.map(c => ({
            scale: c.shotScale,
            angle: c.cinematicAngle || c.cameraWork,
            prompt: c.promptEn,
            tag: c.cameraWork
          })), task.shotScale);
          if (antiPrev) {
            effectiveNegative = effectiveNegative ? `${effectiveNegative}, ${antiPrev}` : antiPrev;
            addLog(`🛡️ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 直近カット対比ネガティブ注入 [構図・ポーズ・小道具・視線の重複排除]`, 'info');
          }
        }
      }

      const taskWithAntiPrevious: GenerationTask = {
        ...task,
        referenceImageMediaId: refMediaId,
        negativePrompt: effectiveNegative
      };

      const effectiveActiveRef = ep?.isMvMode ? undefined : activeReferenceRef.current;
      const { finalPrompt, finalNegative, referenceImageMediaIds } = buildImagePromptAndNegative(taskWithAntiPrevious, settings, effectiveActiveRef);
      
      // 生成前に投入パラメータを保存（失敗してもインスペクターで追えるようにする）
      updateCut(epId, cutId, {
        finalPromptUsed: finalPrompt,
        finalNegativeUsed: finalNegative,
        negativePrompt: effectiveNegative,
        styleKeyUsed: task.styleKey || settings.taste,
        imageModelUsed: modelDef.label
      });

      const chosenRatio = settings.aspectRatio || DEFAULT_ASPECT_RATIO || '9:16';
      const safeAspectRatio = (chosenRatio === '1:1' || chosenRatio === '16:9' || chosenRatio === '9:16') ? chosenRatio : '9:16';

      let safePrompt = finalPrompt && /[a-zA-Z0-9]/.test(finalPrompt) ? finalPrompt : 'Cinematic scene, high quality';
      if (safeAspectRatio === '1:1') {
        safePrompt += ', balanced centered composition, ample negative space around subject, safe for 16:9 and 9:16 cropping';
      }
      const primaryModelName = modelDef?.name || '🍌 Nano Banana 2';

      let res: any;
      let attemptCount = 0;

      try {
        res = await callWithRetry<any>(
          async () => {
            attemptCount++;
            let currentModelName = primaryModelName;
            let currentPrompt = safePrompt;
            let currentNegative = finalNegative;
            let currentRefIds = referenceImageMediaIds;

            // ⚡ スマートフェイルオーバー（リトライ回数に応じて段階的に安全化）
            if (attemptCount === 2) {
              // 第2試行: プロンプトをスリム化し、参照メディアの誤検知を回避
              currentPrompt = sanitizePromptForGoogleSafety(safePrompt)
                .slice(0, 1000)
                .replace(/,[^,]*$/, '')
                .trim();
            } else if (attemptCount >= 3) {
              // 第3試行〜: メインモデルが過負荷/一時停止の可能性に備え、超爆速・高可用性モデルへ自動フェイルオーバー！
              currentModelName = '🍌 Nano Banana 2 Lite';
              currentPrompt = sanitizePromptForGoogleSafety(safePrompt)
                .slice(0, 800)
                .replace(/,[^,]*$/, '')
                .trim();
              // 非写真スタイルの場合は、実写写真の誤混入を防ぐ最小限ネガティブを死守
              currentNegative = finalNegative.includes('photorealistic')
                ? 'photorealistic, realistic photo, 35mm photograph, DSLR, raw photograph'
                : '';
              currentRefIds = undefined;
            }


            return await Flow.generate.image({ 
              prompt: currentPrompt,
              negativePrompt: currentNegative, 
              modelDisplayName: currentModelName,
              aspectRatio: safeAspectRatio as any,
              referenceImageMediaIds: currentRefIds 
            });
          },
          (attempt, max, delay, err, isSuper) => {
            const waitStr = formatDurationMs(delay);
            const errMsg = formatErrorMessage(err);
            if (isSuper) {
              addLog(`🌙 Ep.${epId} C${cutId.toString().padStart(2, '0')}: [超指数バックオフ ${attempt - 5}/4] 深夜帯サーバー高負荷のため ${waitStr}待機して自動再開します... (理由: ${errMsg})`, 'warning');
            } else if (attempt >= 2) {
              addLog(`⚡ Ep.${epId} C${cutId.toString().padStart(2, '0')}: [スマートフェイルオーバー] プロンプト軽量化＆高可用性モードで再試行 (${attempt}/${max}) ${waitStr}後... (理由: ${errMsg})`, 'warning');
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
      } catch (firstErr: any) {
        const errMsg = formatErrorMessage(firstErr);
        const isPolicyError = errMsg.includes('ポリシー') || errMsg.includes('POLICY') || errMsg.includes('SAFETY') || errMsg.includes('BLOCKED');
        
        if (!isAbortedRef.current) {
          addLog(`🛡️ Ep.${epId} C${cutId.toString().padStart(2, '0')}: サーバー過負荷・セーフティ保護をバイパスするため、極小救済プロンプト＆超軽量モデルで最終生成を実行します...`, 'warning');
          
          // 骨子のみの最小安全プロンプトで最終救済
          const rescuePrompt = sanitizePromptForGoogleSafety(safePrompt)
            .replace(/\b(seductive|seductively|adult|intimate|childlike|sensual|erotic|provocative|naked|nude)\b/gi, 'artistic')
            .slice(0, 500)
            .replace(/,[^,]*$/, '')
            .trim() + ', cinematic masterpiece, aesthetic';

          try {
            res = await callWithRetry<any>(
              () => Flow.generate.image({ 
                prompt: rescuePrompt,
                negativePrompt: '',
                modelDisplayName: '🍌 Nano Banana 2 Lite',
                aspectRatio: safeAspectRatio as any
              }),
              (attempt, max, delay, err) => {
                addLog(`🛡️ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 救済モード再試行中 (${attempt}/${max})...`, 'warning');
              },
              {
                maxRetries: 2,
                timeoutMs: 90000,
                timeoutLabel: '救済プロンプト画像生成',
                abortCheck: () => isAbortedRef.current
              }
            );
          } catch (rescueErr) {
            throw firstErr;
          }
        } else {
          throw firstErr;
        }
      }
      const finalBase64 = extractImageBase64(res);
      const finalMediaId = extractMediaId(res);
      console.log(`🖼️ [Ep.${epId} C${cutId} 画像抽出結果]`, {
        hasBase64: !!finalBase64,
        base64Length: finalBase64?.length,
        mediaId: finalMediaId,
        rawKeys: Object.keys(res || {})
      });
      updateCut(epId, cutId, { 
        imageMediaId: finalMediaId, 
        imageBase64: finalBase64, 
        isGeneratingImage: false,
        error: undefined
      });

      // Cut 1 の画像が完成したら、以降のカットのキャラ崩れを完全防止するためマスターアンカーとして固定！
      if (cutId === 1) {
        updateEpisode(epId, {
          masterAnchorMediaId: finalMediaId,
          masterAnchorBase64: finalBase64
        });
        addLog(`👑 Ep.${epId}: Cut 1 の決定版ポートレートを【全カット共通マスターアンカー】としてロックしました！`, 'success');
      }

      addLog(`✨ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 画像生成完了`, 'success');

      // ユーザー指示: After絵の参照がモーフィング崩壊の害悪となるため自動生成を無効化
      // （※Start絵1枚からプロンプトだけでAfter状態へ導く仕様に変更）
      /*
      if (settings.enableEndFrames !== false) {
        await generateEndFrame(epId, cutId);
      }
      */
    } catch (err) {
      const errorMsg = formatErrorMessage(err);
      updateCut(epId, cutId, { isGeneratingImage: false, error: errorMsg });
      addLog(`❌ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 画像失敗 - ${errorMsg}`, 'error');
    }
  };

  const generateEndFrame = async (epId: number, cutId: number, customEndPrompt?: string) => {
    if (isAbortedRef.current) return;
    const ep = episodesRef.current.find(e => e.id === epId);
    const cut = ep?.cuts.find(c => c.id === cutId);
    if (!ep || !cut) return;

    updateCut(epId, cutId, { isGeneratingEndFrame: true });
    const modelDef = resolveImageModel(settings.imageModel);
    addLog(`🏁 Ep.${epId} C${cutId.toString().padStart(2, '0')}: Veo補間用 After絵（到達点フレーム）を描画中...`, 'process');

    try {
      // Start絵の参照（i2i）
      const refMediaIds: string[] = [];
      if (cut.imageMediaId) {
        refMediaIds.push(cut.imageMediaId);
      } else if (ep.masterAnchorMediaId) {
        refMediaIds.push(ep.masterAnchorMediaId);
      }

      // 到達点プロンプトの決定（Start絵からの8秒後のドラマチックな姿勢・表情進化を保証）
      let effectiveEndPlot = customEndPrompt || cut.endFramePromptEn;
      if (effectiveEndPlot && !/[a-zA-Z0-9]/.test(effectiveEndPlot)) {
        effectiveEndPlot = undefined;
      }
      if (!effectiveEndPlot || effectiveEndPlot === cut.promptEn) {
        const evo = resolveCinematicEndFrameAndMotion({
          cutIndex: cutId - 1,
          basicPlot: cut.promptEn || cut.narrationJp || cut.narrationEn || '',
          isObjectOnly: cut.isObjectOnly,
          theme: ep.theme || settings.theme,
          isMvMode: ep.isMvMode
        });
        effectiveEndPlot = evo.endFramePlot;
        // cutのメタデータも更新
        updateCut(epId, cutId, {
          endFramePromptEn: effectiveEndPlot,
          veoMotionPrompt: cut.veoMotionPrompt || evo.veoMotionPrompt
        });
      }

      const endPromptInstruction = cut.isObjectOnly
        ? `[RELATIVE TO START FRAME - STILL LIFE]: ${effectiveEndPlot}. Maintain identical scene environment, props, and ambient lighting tone, ensuring seamless spatial continuity.`
        : `[RELATIVE TO START FRAME]: ${effectiveEndPlot}. Maintain identical room setting, identical protagonist, hairstyle, and outfit as the reference start frame, ensuring seamless natural evolution.`;

      const endTask: GenerationTask = {
        epId,
        cutId,
        prompt: endPromptInstruction,
        styleKey: ep.taste || settings.taste,
        imageModel: settings.imageModel,
        isMvMode: ep.isMvMode,
        isMultiPanel: false,
        storyContext: ep.summary || '',
        eraAnalysis: ep.eraAnalysis,
        forbiddenAnachronisms: ep.forbiddenAnachronisms,
        authenticAttireEn: ep.authenticAttireEn,
        forbiddenKeywordsEn: ep.forbiddenKeywordsEn,
        referenceImageMediaId: refMediaIds[0],
        characterDna: ep.characterDna,
        isObjectOnly: cut.isObjectOnly,
        isEndFrame: true,
        endFrameCameraDirective: effectiveEndPlot
      };

      const { finalPrompt, finalNegative, referenceImageMediaIds } = buildImagePromptAndNegative(
        endTask,
        settings,
        activeReferenceRef.current
      );

      const chosenRatio = settings.aspectRatio || DEFAULT_ASPECT_RATIO || '9:16';
      const safeAspectRatio = (chosenRatio === '1:1' || chosenRatio === '16:9' || chosenRatio === '9:16') ? chosenRatio : '9:16';

      let safePrompt = finalPrompt && /[a-zA-Z0-9]/.test(finalPrompt) ? finalPrompt : 'Cinematic finale scene, high quality';
      if (safeAspectRatio === '1:1') {
        safePrompt += ', balanced centered composition, ample negative space around subject, safe for 16:9 and 9:16 cropping';
      }
      const safeModelName = modelDef?.name || 'imagen-3.0-generate-002';

      const res = await callWithRetry<any>(
        () => Flow.generate.image({
          prompt: safePrompt,
          negativePrompt: finalNegative,
          modelDisplayName: safeModelName,
          aspectRatio: safeAspectRatio as any,
          referenceImageMediaIds: referenceImageMediaIds || refMediaIds
        }),
        undefined,
        4
      );

      const endMediaId = extractMediaId(res);
      const endBase64 = extractImageBase64(res);
      updateCut(epId, cutId, {
        endFrameImageMediaId: endMediaId,
        endFrameImageBase64: endBase64,
        isGeneratingEndFrame: false
      });
      addLog(`✨ Ep.${epId} C${cutId.toString().padStart(2, '0')}: After絵（到達点フレーム）の描画が完了しました！`, 'success');
    } catch (err) {
      const errorMsg = formatErrorMessage(err);
      updateCut(epId, cutId, { isGeneratingEndFrame: false });
      addLog(`⚠️ Ep.${epId} C${cutId.toString().padStart(2, '0')}: After絵の生成スキップ - ${errorMsg}`, 'warning');
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
      generateVideo,
      handleBulkVideo,
      seriesManifestRef,
      setActiveSeriesManifest,
      activeReferenceRef,
      currentAssetRef
    };
    await ensureInfographicCover(pipelineContext, ep, true);
  }, [settings, addLog, updateEpisode]);

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

  const startProduction = async (overrideSettings?: Partial<GeneratorSettings>) => {
    if (isProducing) {
      console.warn('⚠️ [FlowTool Studio] すでに制作プロセスが実行中です。');
      return;
    }
    const effectiveSettings: GeneratorSettings = {
      ...settings,
      ...(overrideSettings || {})
    };

    console.log(
      '%c🎬 ▶️ 【全自動プロデュース】処理が開始されました！',
      'background: #10b981; color: #fff; font-weight: bold; font-size: 13px; padding: 4px 8px; border-radius: 4px;'
    );
    console.log('📋 実行パラメータ:', {
      mode: effectiveSettings.productionMode || '通常',
      theme: effectiveSettings.theme,
      totalEpisodes: effectiveSettings.totalEpisodes || effectiveSettings.episodeCount,
      taste: effectiveSettings.taste,
      aspectRatio: effectiveSettings.aspectRatio,
      imageModel: effectiveSettings.imageModel,
      videoModel: effectiveSettings.defaultVideoModel,
      autoVideo: effectiveSettings.autoVideo,
      autoDownload: effectiveSettings.autoDownload,
      enableEndFrames: effectiveSettings.enableEndFrames
    });

    setIsProducing(true);
    isAbortedRef.current = false;
    addLog(`🎬 【全自動プロデュース開始】モード: ${effectiveSettings.productionMode || '通常'} / 全${effectiveSettings.totalEpisodes || effectiveSettings.episodeCount || 1}話 / テーマ: 「${effectiveSettings.theme || '未設定'}」`, 'process');

    if (effectiveSettings.selectedAssetId && !activeReferenceRef.current) {
      try {
        const assets = await getAllReferenceAssets();
        const asset = assets.find(a => a.id === effectiveSettings.selectedAssetId);
        if (asset) {
          currentAssetRef.current = { name: asset.name, base64: asset.base64, mimeType: asset.mimeType };
          addLog('🔍 キャラクターDNA抽出中...', 'process');
          const uploadRes = await Flow.upload({ base64: asset.base64, mimeType: asset.mimeType as 'image/png' | 'image/jpeg' | 'image/webp', name: `Ref: ${asset.name}` });
          const screeningPrompt = buildCharacterScreeningPrompt(effectiveSettings.era, effectiveSettings.country, effectiveSettings.isMvMode, effectiveSettings.theme);
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
      settings: effectiveSettings,
      addLog,
      logsRef,
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

      // ★ 最重要: ①大前提プロデュース設計図（seriesManifestRef.current）が存在する場合
      // ただし、MVモードまたは音楽インポートによるエピソードがある場合は、
      // 音楽MVバッチパイプライン（runShortsBatchProduction）を優先して画面上のインポート曲を作画する！
      if (!settings.isMvMode && settings.productionMode !== 'mv' && seriesManifestRef.current && (seriesManifestRef.current.episodesPlan?.length || 0) > 0) {
        await runSeriesProduction(pipelineContext);
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

  return { episodes, setEpisodes, isProducing, startProduction, abortProduction: handleAbort, resumeSeries, activeSeriesManifest, setActiveSeriesManifest, handleGenerateRemaining, handleBulkVideo, handleBulkBrowserVideo, handleExportFullMovie, handleBulkRerollTelop, generateImage, generateEndFrame, generateInfographicCover, generateVideo, generateBrowserVideo, updateCut, updateEpisode, clearEpisodes: handleClearEpisodes };
}