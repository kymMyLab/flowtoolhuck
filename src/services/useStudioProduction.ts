import { runStyleMatrixProduction, runShortsBatchProduction, runSeriesProduction, SHORTS_CONFIG_MAP, ensureInfographicCover, ensureCharacterTurnaround } from './productionPipelines';
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
import { sanitizePromptForGoogleSafety, buildDynamicAntiPreviousNegative, isFaceMacroScale, buildPositiveAntiPreviousMandate, isMvChorusCut } from './promptEngine';
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
  PreviousShotInfo,
  analyzeLyricVisualsWithGemini
} from './directorService';
import { extractSongDnaWithGemini, compileStoryboardWithGemini } from './directorCompilerService';
import { isCutSelectedForVideo } from './utils';
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
  const lastErrorRef = useRef<string>('');
  const hasRateLimitedBanana2Ref = useRef<boolean>(false);

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
      // MVモードで歌詞が存在する場合のプロンプト補完・置換（コンパイル済みのときは重複追加しない）
      if (ep.isMvMode && rawLyric && !ep.isLyricAnalyzed && !c.characterPresence) {
        if (c.geminiVisualPrompt) {
          if (!effectivePrompt.includes(c.geminiVisualPrompt)) {
            if (effectivePrompt.includes('embodying lyric')) {
              effectivePrompt = effectivePrompt.replace(/Scene visually embodying lyric "[^"]*", set within the world of "[^"]*"\.?/g, c.geminiVisualPrompt);
            } else {
              effectivePrompt = `${effectivePrompt}, ${c.geminiVisualPrompt}`;
            }
          }
        } else if (!effectivePrompt.includes('embodying lyric')) {
          const visualPlot = extractLyricVisualPlot(rawLyric, c.telop?.directorNote || '', ep.theme || ep.titleJp || '', c.id, !!c.isObjectOnly);
          if (!effectivePrompt.includes(visualPlot)) {
            effectivePrompt = `${effectivePrompt}, ${visualPlot}`;
          }
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
        characterPresence: c.characterPresence,
        extractedSongDna: ep.extractedSongDna,
        focalSubject: c.focalPoint?.focalSubject,
        shotScale: c.shotScale,
        cinematicAngle: c.cinematicAngle,
        camera: c.cameraWork
      };
    });
  };

  const ensureLyricVisualAnalysis = async (ep: Episode): Promise<void> => {
    if (!ep.isMvMode || ep.isLyricAnalyzed) return;

    // ── Step 2.5: 楽曲DNAの抽出とキャッシュパージ ──
    let extractedDna = ep.extractedSongDna;
    if (!extractedDna) {
      extractedDna = await extractSongDnaWithGemini({
        character_setting: ep.characterDna || ep.summary,
        surface_theme: ep.theme || ep.titleJp,
        sensory_details: ep.summary
      }, addLog);
      ep.extractedSongDna = extractedDna;
      ep.characterDna = extractedDna.protagonistDna;
      updateEpisode(ep.id, {
        extractedSongDna: extractedDna,
        characterDna: extractedDna.protagonistDna
      });
    }

    // ── Step 3: 映像総監督Geminiによる30カット絵コンテ一括コンパイル ──
    const rawStoryboard = ep.cuts.map(c => ({
      cut_number: c.id,
      lyrics_part: c.narrationJp || c.telop?.fullText || '',
      camera_composition: c.cleanComposition || c.cinematicAngle || c.cameraWork || '',
      character_action: c.cleanAction || c.scenePlot || c.promptEn || '',
      lighting_scene: c.cleanLighting || c.telop?.directorNote || '',
      image_prompt: c.cleanImagePrompt || c.promptEn || ''
    }));

    const compiledCuts = await compileStoryboardWithGemini(
      rawStoryboard,
      extractedDna,
      ep.theme || ep.titleJp || '',
      addLog
    );

    if (compiledCuts && compiledCuts.length > 0) {
      const newCuts = ep.cuts.map(c => {
        const res = compiledCuts.find(a => a.cutId === c.id);
        if (!res) return c;

        const isScenicProp = res.character_presence === '5_scenic_or_still_life';
        const isSelectedForVideo = isCutSelectedForVideo(c.id - 1, settings.videoRatio, res.veo_priority_rank, ep.cuts.length);

        const lowerPrompt = (res.compiled_prompt_en || '').toLowerCase();
        let derivedShotScale = c.shotScale || 'Medium Shot';
        if (res.character_presence === '1_protagonist_solo_focus') {
          derivedShotScale = (lowerPrompt.includes('extreme close') || lowerPrompt.includes('macro') || lowerPrompt.includes('eyes'))
            ? 'Extreme Close-Up'
            : 'Medium Bust Shot';
        } else if (res.character_presence === '2_protagonist_or_pair_wide') {
          derivedShotScale = 'Wide Shot';
        } else if (res.character_presence === '3_two_characters_asymmetric') {
          derivedShotScale = 'Medium Shot';
        } else if (res.character_presence === '4_hands_or_feet_detail') {
          derivedShotScale = lowerPrompt.includes('foot') || lowerPrompt.includes('shoes') || lowerPrompt.includes('footsteps') ? 'Low-Angle Footsteps' : 'Macro Hands';
        } else if (res.character_presence === '5_scenic_or_still_life') {
          derivedShotScale = 'Still-Life Object Macro';
        }

        const updatedCut: Cut = {
          ...c,
          characterPresence: res.character_presence,
          focalPoint: { grid: 'center', normalizedCoord: [0.5, 0.5], focalSubject: res.focal_subject },
          veoPriorityRank: res.veo_priority_rank,
          cameraWork: res.camera_work,
          cinematicAngle: res.camera_work,
          shotScale: derivedShotScale,
          panelLayout: res.panel_layout,
          veoMotionPrompt: res.veo_motion_and_end_frame_prompt,
          promptEn: res.compiled_prompt_en,
          isObjectOnly: isScenicProp,
          isSelectedForVideo: isSelectedForVideo,
          targetVideoModel: isSelectedForVideo ? 'veo-fast' : c.targetVideoModel,
          telop: c.telop ? {
            ...c.telop,
            highlights: [{ word: c.telop.fullText, color: res.telop_neon_color, sizeScale: 1.1 }]
          } : undefined
        };

        updateCut(ep.id, c.id, {
          characterPresence: res.character_presence,
          focalPoint: updatedCut.focalPoint,
          veoPriorityRank: res.veo_priority_rank,
          cameraWork: res.camera_work,
          cinematicAngle: res.camera_work,
          shotScale: derivedShotScale,
          panelLayout: res.panel_layout,
          veoMotionPrompt: res.veo_motion_and_end_frame_prompt,
          promptEn: res.compiled_prompt_en,
          isObjectOnly: isScenicProp,
          isSelectedForVideo: isSelectedForVideo,
          targetVideoModel: updatedCut.targetVideoModel,
          telop: updatedCut.telop
        });

        return updatedCut;
      });

      ep.cuts = newCuts;
      ep.isLyricAnalyzed = true;
      updateEpisode(ep.id, { isLyricAnalyzed: true });
      addLog(`✨ Ep.${ep.id}: 映画的緩急＆5段階ルーティング（映像総監督Gemini）を全カットに適用しました！`, 'success');
      return;
    }

    // ── フォールバック: 既存歌詞解析 ──
    const lyricLines = ep.cuts
      .filter(c => c.narrationJp || c.telop?.fullText)
      .map(c => ({
        cutId: c.id,
        lyric: c.narrationJp || c.telop?.fullText || '',
        section: (c.telop?.directorNote?.toLowerCase().includes('chorus') || isMvChorusCut(c.id)) ? 'chorus' : 'verse'
      }));

    if (lyricLines.length === 0) return;

    addLog(`🧠 Ep.${ep.id}: 歌詞ビジュアルをGeminiで全体解析中（映画的緩急バランス判定）...`, 'process');
    const charCtx = ep.characterDna || activeReferenceRef.current?.characterDna || 'Protagonist';
    const analysis = await analyzeLyricVisualsWithGemini(lyricLines, ep.theme || ep.titleJp || '', charCtx, addLog);

    if (analysis && analysis.length > 0) {
      const newCuts = ep.cuts.map(c => {
        const res = analysis.find(a => a.cutId === c.id);
        if (!res) return c;

        const isScenicProp = res.stagingType === 'scenic_prop_insert';
        let updatedPromptEn = c.promptEn || '';
        if (res.visualPromptEn) {
          if (updatedPromptEn.includes('embodying lyric')) {
            updatedPromptEn = updatedPromptEn.replace(/Scene visually embodying lyric "[^"]*", set within the world of "[^"]*"\.?/g, res.visualPromptEn);
          } else if (!updatedPromptEn.includes(res.visualPromptEn)) {
            updatedPromptEn = updatedPromptEn ? `${updatedPromptEn}, ${res.visualPromptEn}` : res.visualPromptEn;
          }
        }

        const updatedCut: Cut = {
          ...c,
          geminiVisualPrompt: res.visualPromptEn,
          stagingType: res.stagingType,
          isObjectOnly: isScenicProp,
          promptEn: updatedPromptEn
        };
        updateCut(ep.id, c.id, {
          geminiVisualPrompt: res.visualPromptEn,
          stagingType: res.stagingType,
          isObjectOnly: isScenicProp,
          promptEn: updatedPromptEn
        });
        return updatedCut;
      });
      ep.cuts = newCuts;
      ep.isLyricAnalyzed = true;
      updateEpisode(ep.id, { isLyricAnalyzed: true });
      addLog(`✨ Ep.${ep.id}: 歌詞の映画的緩急バランス（Gemini自律判断）を反映しました！ [人物主導/静物インサート最適化]`, 'success');
    } else {
      addLog(`⚠️ Ep.${ep.id}: 歌詞解析をスキップしました (決定論的フォールバックを使用)`, 'warning');
    }
  };

  const handleGenerateRemaining = async (epId: number) => {
    isAbortedRef.current = false;
    const ep = episodesRef.current.find(e => e.id === epId);
    if (!ep) return;

    // MVモード未解析ならバッチ画像生成前にGeminiで全体解析（映画的緩急バランス判定）
    if (ep.isMvMode && !ep.isLyricAnalyzed) {
      await ensureLyricVisualAnalysis(ep);
    }

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
    
    const freshEp = episodesRef.current.find(e => e.id === epId) || ep;
    const stillRemaining = freshEp.cuts.filter(c => !c.imageBase64 && !c.imageMediaId).length;
    
    if (stillRemaining === 0) {
      updateEpisode(epId, { isGeneratingRemainingImages: false, isDone: true, isPreviewDone: true });
      addLog(`✅ Ep.${epId}: すべての画像生成（全${ep.cuts.length}カット）が完了しました！`, 'success');
      if (settings.autoVideo && !isAbortedRef.current) {
        handleBulkBrowserVideo(epId);
      }
    } else {
      updateEpisode(epId, { isGeneratingRemainingImages: false });
      if (!isAbortedRef.current) {
        addLog(`⚠️ Ep.${epId}: 一部の画像が未完了（残り ${stillRemaining} 枚）です。もう一度実行して再開できます。`, 'warning');
      }
    }
  };

  const handleExportFullMovie = async (epId: number) => {
    const ep = episodesRef.current.find(e => e.id === epId);
    if (!ep) return;
    addLog(`🎬 Ep.${epId}: 映像結合を開始...`, 'process');
    updateEpisode(epId, { isExportingMovie: true });
    try {
      const isHorizontal = settings.aspectRatio !== '9:16';
      const movieBlob = await renderFullEpisodeMovie(ep, (idx, total) => {
        addLog(`🎞️ 映像レンダリング中... ${idx}/${total}`, 'info');
      }, isHorizontal);
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
        // 未コンパイルカットのみオンデマンド演出（directShot）を実行
        const directResult = await directShot(
          task,
          settings,
          activeReferenceRef.current,
          previousShotInfo,
          addLog
        );

        shotScale = directResult.shotScale || shotScale;
        cinematicAngle = directResult.cinematicAngle || cinematicAngle;
        promptEn = directResult.promptEn || promptEn;
        antiPreviousNegative = directResult.negativePrompt || antiPreviousNegative;
        cameraWork = directResult.cameraWork || cameraWork;
        cameraMotion = directResult.cameraMotion || cameraMotion;
        kenBurnsPreset = directResult.kenBurnsPreset || kenBurnsPreset;
        telop = directResult.telop ? { ...existingCut?.telop, ...directResult.telop } : existingCut?.telop;
      } else if (previousShotInfo) {
        // コンパイル済みMVカット: directShotでの演出破壊をスキップし、直前対比ネガティブのみを動的注入
        const dynamicAnti = buildDynamicAntiPreviousNegative(previousShotInfo, shotScale);
        if (dynamicAnti) {
          antiPreviousNegative = antiPreviousNegative ? `${antiPreviousNegative}, ${dynamicAnti}` : dynamicAnti;
        }
      }

      // 🛡️ [Tier 2 構図被り防止ガード: フェイスアップ連続の絶対遮断]
      if (previousShotInfo && isFaceMacroScale(previousShotInfo.scale, previousShotInfo.angle) && isFaceMacroScale(shotScale, cinematicAngle)) {
        addLog(`🛡️ [構図被り防止ガード] Ep.${task.epId} C${task.cutId.toString().padStart(2, '0')}: 顔面アップの連続（直前: ${previousShotInfo.scale}）を検知。バストアップ構図へ自動シフトしました`, 'info');
        shotScale = 'Medium Bust Shot';
        cinematicAngle = 'Candid cinematic chest-up framing capturing authentic posture, upper-body clothing, and natural atmospheric presence within the environment, unposed natural aesthetic, rich rim lighting, rule-of-thirds composition, head and shoulders visible with comfortable breathing room';
      }

      updateCut(task.epId, task.cutId, { 
        promptEn,
        shotScale,
        cinematicAngle,
        cameraWork,
        cameraMotion,
        kenBurnsPreset,
        telop,
        negativePrompt: antiPreviousNegative
      });

      previousShotInfo = {
        scale: shotScale,
        angle: cinematicAngle,
        prompt: promptEn,
        tag: cameraWork,
        telop
      };

      preparedTasks.push({
        ...task,
        prompt: promptEn,
        negativePrompt: antiPreviousNegative,
        shotScale,
        cinematicAngle,
        camera: cameraWork
      });
    }

    if (isAbortedRef.current) return;

    addLog(`🎬 全 ${preparedTasks.length} カットの対比構図演出を確定（並列画像生成を開始します）`, 'process');

    // ── Phase 2: 画像生成フェーズ（確定したプロンプト＆直前構図ネガティブで並列実行） ──
    // 👑 マスターアンカー先行確定ガード:
    // Cut 1 が未生成（masterAnchorMediaId未確定）の場合、まず Cut 1 を単独で先行生成する。
    // Cut 1 の決定版ポートレートが完成・アンカーロックされてから Cut 2 以降を並列ワーカーで一斉稼働させることで、
    // Cut 2 が Cut 1 より先に走ってキャラがブレる事故を物理的に完全根絶！
    const epId = preparedTasks[0]?.epId;
    const currentEp = episodesRef.current.find(e => e.id === epId);
    const cut1Index = preparedTasks.findIndex(t => t.cutId === 1);

    // MVモード（または三面図が存在する場合）は、純白背景の三面図が唯一の絶対アンカーとなるため、Cut 1のアンカー先行待機は不要
    const needsCut1Anchor = !currentEp?.isMvMode && !currentEp?.characterTurnaroundMediaId && !currentEp?.masterAnchorMediaId;
    if (cut1Index !== -1 && needsCut1Anchor) {
      const cut1Task = preparedTasks.splice(cut1Index, 1)[0];
      addLog(`👑 Ep.${epId}: まず Cut 1（マスターアンカー）を単独先行生成してキャラクター基準を確立します...`, 'process');
      await generateImage(cut1Task);
      if (isAbortedRef.current) return;
    }

    queueRef.current = [...preparedTasks];
    // 並列度はユーザー設定（デフォルト2）を尊重し、ユーザーの意思で増減可能
    const concurrency = Math.max(1, settings.parallelCount || 2);
    const workers = Array(concurrency).fill(null).map(async (_, workerIdx) => {
      // ワーカー間で開始時間をスタッガー（時間差5.0秒）させ、同時リクエスト集中による429/503を防止
      if (workerIdx > 0) {
        await sleep(workerIdx * 5000);
      }
      while (queueRef.current.length > 0) {
        if (isAbortedRef.current) break;
        const task = queueRef.current.shift();
        if (!task) break;
        await generateImage(task);
        // タスク完了後は 10秒〜15秒 のクールダウン（＋ランダムゆらぎ）をしっかり挟んでAPIレートリミット（動的RPM減衰）を回避
        if (queueRef.current.length > 0 && !isAbortedRef.current) {
          const cooldownMs = 10000 + Math.random() * 5000;
          await sleep(cooldownMs);
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

      // 三面図が利用可能なら人物カットで確実にバインド（純白背景の三面図のみを渡し、Cut 01の夕暮れ汚染を物理排除）
      const currentCutObj = ep?.cuts.find(c => c.id === cutId);
      const isAnchorExcluded = task.isObjectOnly || 
        currentCutObj?.characterPresence === '4_hands_or_feet_detail' || 
        currentCutObj?.characterPresence === '5_scenic_or_still_life';

      const turnaroundMediaId = ep?.characterTurnaroundMediaId || (ep?.isMvMode ? undefined : activeReferenceRef.current?.mediaId);
      const fallbackAnchor = ep?.isMvMode ? undefined : ep?.masterAnchorMediaId;
      const refMediaId = isAnchorExcluded ? undefined : (turnaroundMediaId || task.referenceImageMediaId || fallbackAnchor);

      // ★ ユーザー設計規範: 直近カット（直前1〜2カット）のプロンプト・構図を動的ネガティブプロンプトとして完全バインド
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
          if (antiPrev) {
            effectiveNegative = effectiveNegative ? `${effectiveNegative}, ${antiPrev}` : antiPrev;
            addLog(`🛡️ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 直近カット対比ネガティブ注入 [構図・ポーズ・小道具・視線の重複排除]`, 'info');
          }
          // ★ 第2段セーフティ: 直前構図反復禁止のポジティブ指令も生成！
          positiveMandate = buildPositiveAntiPreviousMandate(prevContexts);
        }
      }

      const taskWithAntiPrevious: GenerationTask = {
        ...task,
        characterPresence: currentCutObj?.characterPresence,
        extractedSongDna: ep?.extractedSongDna,
        focalSubject: currentCutObj?.focalPoint?.focalSubject,
        referenceImageMediaId: refMediaId,
        negativePrompt: effectiveNegative,
        antiPreviousMandate: positiveMandate
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

            // 👑 独立別枠クォータへの自動昇格:
            // 既にBanana 2のレート上限を経験しているか、直前エラーが上限(429/RESOURCE_EXHAUSTED)の場合、
            // 完全に独立した別枠クォータを持つ「🍌 Nano Banana Pro」へ自動フェイルオーバー！
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

            // ⚡ プロンプト軽量化はポリシー違反・セーフティ起因の時のみ発動させ、
            // 「使用量上限（429/レートリミット）」の時は元の高品質プロンプト・三面図・モデルを100%維持！
            const isPolicyIssue = lastErrorRef.current && (
              lastErrorRef.current.includes('SAFETY') || 
              lastErrorRef.current.includes('BLOCKED') || 
              lastErrorRef.current.includes('ポリシー') || 
              lastErrorRef.current.includes('POLICY')
            );

            if (isPolicyIssue) {
              // 抽出: マスターアートスタイルアンカーを維持
              const masterStyleMatch = safePrompt.match(/\[MASTER ART STYLE:[^\]]+\]/);
              const masterStylePrefix = masterStyleMatch ? masterStyleMatch[0] + ' ' : '';

              if (attemptCount === 2) {
                const sanitized = sanitizePromptForGoogleSafety(safePrompt);
                let trimmed = sanitized.slice(0, 1000).replace(/,[^,]*$/, '').trim();
                if (masterStyleMatch && !trimmed.includes('[MASTER ART STYLE')) {
                  trimmed = masterStylePrefix + trimmed;
                }
                currentPrompt = trimmed;
              } else if (attemptCount >= 3) {
                currentModelName = '🍌 Nano Banana 2 Lite';
                const sanitized = sanitizePromptForGoogleSafety(safePrompt);
                let trimmed = sanitized.slice(0, 800).replace(/,[^,]*$/, '').trim();
                if (masterStyleMatch && !trimmed.includes('[MASTER ART STYLE')) {
                  trimmed = masterStylePrefix + trimmed;
                }
                currentPrompt = trimmed;

                // Keep negative prompt strong if it includes photo exclusion
                if (finalNegative.includes('photorealistic')) {
                  // Keep essential exclusions
                  currentNegative = 'photorealistic, realistic photo, 35mm photograph, DSLR, raw photograph, 3d render, cgi';
                }
                // Do NOT set currentRefIds to undefined here to preserve turnaround sheet
              }
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
            lastErrorRef.current = errMsg;
            const isRateLimit = errMsg.includes('使用量の上限') || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('403');

            if (isRateLimit && !hasRateLimitedBanana2Ref.current) {
              hasRateLimitedBanana2Ref.current = true;
              addLog(`👑 Ep.${epId} C${cutId.toString().padStart(2, '0')}: [別枠クォータ自動昇格] Banana 2の上限を検知！独立した別枠クォータを持つ「🍌 Nano Banana Pro」へ自動昇格して次回試行より続行します！`, 'success');
            }

            if (isSuper) {
              addLog(`🌙 Ep.${epId} C${cutId.toString().padStart(2, '0')}: [超指数バックオフ ${attempt - 5}/4] 深夜帯サーバー高負荷のため ${waitStr}待機して自動再開します... (理由: ${errMsg})`, 'warning');
            } else if (isRateLimit) {
              addLog(`⏳ Ep.${epId} C${cutId.toString().padStart(2, '0')}: [クォータ回復＆Pro昇格待機] 品質を維持したまま ${waitStr}待機して再開 (${attempt}/${max})... (理由: ${errMsg})`, 'warning');
            } else if (attempt >= 2) {
              addLog(`⚡ Ep.${epId} C${cutId.toString().padStart(2, '0')}: [セーフティ回避] プロンプト安全化モードで再試行 (${attempt}/${max}) ${waitStr}後... (理由: ${errMsg})`, 'warning');
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
          const masterStyleMatch = safePrompt.match(/\[MASTER ART STYLE:[^\]]+\]/);
          const masterStylePrefix = masterStyleMatch ? masterStyleMatch[0] + ' ' : '';

          let rescuePrompt = sanitizePromptForGoogleSafety(safePrompt)
            .replace(/\b(seductive|seductively|adult|intimate|childlike|sensual|erotic|provocative|naked|nude)\b/gi, 'artistic')
            .slice(0, 500)
            .replace(/,[^,]*$/, '')
            .trim() + ', cinematic masterpiece, aesthetic';

          if (masterStyleMatch && !rescuePrompt.includes('[MASTER ART STYLE')) {
            rescuePrompt = masterStylePrefix + rescuePrompt;
          }

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

      // Cut 1 の画像が完成した場合:
      // MVモードでは背景（夕暮れ空・坂道）の引きずり・金太郎飴化を防止するため、Cut 1 をマスターアンカーに設定せず三面図のみを信託する！
      if (cutId === 1 && !ep?.isMvMode && !ep?.characterTurnaroundMediaId) {
        updateEpisode(epId, {
          masterAnchorMediaId: finalMediaId,
          masterAnchorBase64: finalBase64
        });
        addLog(`👑 Ep.${epId}: Cut 1 の決定版ポートレートをマスターアンカーとして固定しました`, 'success');
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
      ensureLyricVisualAnalysis,
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

    const targets = ep.cuts.filter(c => c.isSelectedForVideo && !c.videoBase64 && !c.videoMediaId);
    const videoQueue = [...targets];
    const videoConcurrency = Math.min(4, Math.max(1, settings.parallelCount || 2));

    const workers = Array(videoConcurrency).fill(null).map(async (_, wIdx) => {
      if (wIdx > 0) await sleep(wIdx * 1500);
      while (videoQueue.length > 0) {
        if (isAbortedRef.current) break;
        const currentCut = videoQueue.shift();
        if (!currentCut) break;
        const targetModel = resolveVideoModel(currentCut.targetVideoModel || settings.videoModel).id;
        try {
          await generateVideo(epId, currentCut.id, targetModel as VideoModelType);
        } catch (err) {
          console.error(`Video generation error on cut ${currentCut.id}:`, err);
        }
        if (videoQueue.length > 0 && !isAbortedRef.current) {
          await sleep(1500);
        }
      }
    });
    await Promise.all(workers);

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
    if (!ep) {
      addLog(`⚠️ エピソードが見つかりません`, 'warning');
      return;
    }
    const availableCuts = ep.cuts.filter(c => !!(c.imageBase64 || (c as any)?.image));
    if (availableCuts.length === 0) {
      addLog(`⚠️ 動画化できる静止画がまだ生成されていません。「③ 作成開始」で画像を生成してください`, 'warning');
      return;
    }
    const targets = availableCuts.filter(c => !c.videoBase64);
    if (targets.length === 0) {
      addLog(`ℹ️ 全${availableCuts.length}カットがすでに動画化済みです`, 'info');
      return;
    }
    addLog(`⚡ 全${targets.length}カットのブラウザ動画化（0pt Ken Burns＆字幕焼き込み）を開始します...`, 'process');
    setIsProducing(true);
    isAbortedRef.current = false;
    updateEpisode(epId, { isBatchGeneratingVideos: true });
    try {
      for (const cut of targets) {
        if (isAbortedRef.current) {
          addLog(`🛑 ブラウザ動画化を一括中止しました`, 'warning');
          break;
        }
        await generateBrowserVideo(epId, cut.id);
      }
    } finally {
      updateEpisode(epId, { isBatchGeneratingVideos: false });
      setIsProducing(false);
    }
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
      ensureLyricVisualAnalysis,
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

    // 1. 各カットの画像データをクリア（歌詞・画角・カメラワーク・演出指示・小道具設定は100%保持）
    const resetCuts: Cut[] = ep.cuts.map(c => ({
      ...c,
      imageBase64: undefined,
      imageMediaId: undefined,
      styleKeyUsed: undefined,
      finalPromptUsed: undefined,
      finalNegativeUsed: undefined,
      isGeneratingImage: false,
      isGeneratingVideo: false
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
      ensureLyricVisualAnalysis,
      generateVideo,
      handleBulkVideo,
      seriesManifestRef,
      setActiveSeriesManifest,
      activeReferenceRef,
      currentAssetRef
    };

    try {
      // 1. 先に歌詞ビジュアル解析（楽曲DNA抽出＆Step 3絵コンテコンパイル）を完了させて主人公DNAを確定
      if (updatedEp.isMvMode && !updatedEp.isLyricAnalyzed && ensureLyricVisualAnalysis) {
        addLog(`🧬 第${epId}話: 楽曲DNAの抽出と絵コンテの事前コンパイルを実行中...`, 'process');
        await ensureLyricVisualAnalysis(updatedEp);
      }

      if (isAbortedRef.current) return;

      // 2. 確定した主人公DNAを用いて、新画風での三面図マスター生成
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

      // 3. 先行カット（targetCutCount枚）の画像生成
      const pendingCuts = updatedEp.cuts.slice(0, targetCutCount);
      addLog(`🎨 第${epId}話: 新画風「${shortName}」で先行${targetCutCount}カットの作画を開始...`, 'process');

      await runTasks(buildCutTasks(updatedEp, pendingCuts, newTaste));

      if (isAbortedRef.current) return;

      // 4. 新画風でのインフォグラフィック特大扉絵（ポスター）生成
      const freshEp = episodesRef.current.find(e => e.id === epId) || updatedEp;
      await ensureInfographicCover(pipelineCtx as any, freshEp);

      const completedCount = freshEp.cuts.slice(0, targetCutCount).filter(c => c.imageBase64 || c.imageMediaId).length;
      const isAllDone = completedCount >= updatedEp.cuts.length;

      updateEpisode(epId, {
        isGenerating: false,
        isPreviewDone: completedCount >= targetCutCount,
        isDone: isAllDone
      });

      addLog(`✨ 第${epId}話: 画風「${shortName}」への切り替え＆先行${targetCutCount}カット再作成が完了しました！`, 'success');
    } catch (err: any) {
      addLog(`❌ 画風切り替え再作成エラー: ${formatErrorMessage(err)}`, 'error');
    } finally {
      setIsProducing(false);
      refreshStories();
    }
  };

  return { episodes, setEpisodes, isProducing, startProduction, abortProduction: handleAbort, resumeSeries, activeSeriesManifest, setActiveSeriesManifest, handleGenerateRemaining, handleBulkVideo, handleBulkBrowserVideo, handleExportFullMovie, handleBulkRerollTelop, handleRerollTasteProduction, generateImage, generateEndFrame, generateInfographicCover, generateVideo, generateBrowserVideo, updateCut, updateEpisode, clearEpisodes: handleClearEpisodes };
}