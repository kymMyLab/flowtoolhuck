import { Episode } from '../../types';
import { CUTS_PER_EPISODE } from '../../constants';
import { saveStory } from '../db';
import { downloadZip } from '../exportService';
import { 
  generateSafeEpisodeScript, 
  cleanEpisodeTitle, 
  cleanEpisodeTitleEn, 
  sanitizeForYouTubeSafety 
} from '../directorService';
import { ProductionPipelineContext, SHORTS_CONFIG_MAP, cleanupEpisodeMemory } from './pipelineTypes';
import { createPipelineCut } from './pipelineCutFactory';
import { ensureCharacterTurnaround, ensureInfographicCover } from './pipelineAssetFactory';
import { isCutSelectedForVideo } from '../utils';

/**
 * ── 2. YouTube Shorts / 音楽MV（指定本数 × 各12カット）制作パイプライン ──
 */
export async function runShortsBatchProduction(ctx: ProductionPipelineContext, curMode: string): Promise<void> {
  const { settings, addLog, isAbortedRef, episodesRef, setEpisodes, updateEpisode, runTasks, buildCutTasks, ensureLyricVisualAnalysis, handleBulkVideo } = ctx;
  const modeInfo = SHORTS_CONFIG_MAP[curMode] || { label: 'Shorts', unit: '本', icon: '🎬' };
  const totalEpCount = Math.max(1, settings.episodeCount || 1);

  // 既存エピソードがある場合は上書きせず、末尾に追記（継続追加）する
  const existingEpisodes = episodesRef.current || [];
  // 画像が生成済みのエピソードのみを完了済みとみなし、未生成の枠があればそこから開始する
  const completedEpisodes = existingEpisodes.filter(e => e.cuts.some(c => !!(c.imageBase64 || c.imageMediaId)));
  const existingMaxId = completedEpisodes.length > 0 ? Math.max(...completedEpisodes.map(e => e.id)) : 0;
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

    // 既出タイトルの収集（ネタ・お題の重複被り防止）
    const existingTitles = episodesRef.current
      .map(e => e.titleJp.replace(/^[^\w\s一-龯]+/, '').trim())
      .filter(Boolean);

    // ★ 最重要: すでにインポートされた絵コンテ（CT198楽曲等）が既に存在するか判定！
    const existingEp = episodesRef.current.find(e => Number(e.id) === Number(epIndex));
    const hasPreloadedStory = existingEp && existingEp.cuts.length > 0 && existingEp.cuts.some(c => c.narrationJp || c.telop?.fullText);

    if (hasPreloadedStory) {
      addLog(`${modeInfo.icon} 【第${epIndex}${modeInfo.unit} / 今回制作: ${currentBatchStep}${modeInfo.unit}目】インポート済み楽曲『${existingEp.titleJp}』の作画を開始します！`, 'process');
      updateEpisode(epIndex, { isGenerating: true });

      // 三面図マスターシートの自動生成（未生成かつ設定有効時）
      if (!existingEp.characterTurnaroundMediaId && settings.enableTurnaroundSheet) {
        const turnaround = await ensureCharacterTurnaround(ctx, existingEp);
        if (turnaround.mediaId) {
          existingEp.characterTurnaroundMediaId = turnaround.mediaId;
          existingEp.characterTurnaroundBase64 = turnaround.base64;
          updateEpisode(epIndex, {
            characterTurnaroundMediaId: turnaround.mediaId,
            characterTurnaroundBase64: turnaround.base64
          });
        }
      }

      // 先行カット数分の描画を実行
      const cutsCount = existingEp.cuts.length;
      const targetCutCount = Math.min(settings.previewCutCount || cutsCount, cutsCount);
      const pendingCuts = existingEp.cuts.slice(0, targetCutCount).filter(c => !(c.imageBase64 || c.imageMediaId));
      if (pendingCuts.length > 0) {
        if (existingEp.isMvMode && !existingEp.isLyricAnalyzed && ensureLyricVisualAnalysis) {
          await ensureLyricVisualAnalysis(existingEp);
        }
        await runTasks(buildCutTasks(existingEp, pendingCuts));
      }

      if (isAbortedRef.current) {
        updateEpisode(epIndex, { isGenerating: false });
        break;
      }

      // 実際に生成が完了したカット数を再集計
      const freshEp = episodesRef.current.find(e => Number(e.id) === Number(epIndex)) || existingEp;
      const completedCutsCount = freshEp.cuts.slice(0, targetCutCount).filter(c => c.imageBase64 || c.imageMediaId).length;
      const isAllDone = completedCutsCount >= cutsCount;
      const isPreviewSuccessful = completedCutsCount >= targetCutCount;

      updateEpisode(epIndex, { 
        isGenerating: false, 
        isPreviewDone: isPreviewSuccessful, 
        isDone: isAllDone 
      });

      if (isPreviewSuccessful) {
        addLog(`✅ 第${epIndex}${modeInfo.unit}『${existingEp.titleJp}』先行${targetCutCount}カットの画像生成が完了しました！`, 'success');
        // インフォグラフィック扉絵
        await ensureInfographicCover(ctx, freshEp);
      } else {
        addLog(`⚠️ 第${epIndex}${modeInfo.unit}『${existingEp.titleJp}』画像生成が一部未完了（${completedCutsCount}/${targetCutCount}カット）です。右側の「未生成カットを生成」から再開できます。`, 'warning');
      }

      cleanupEpisodeMemory();
      continue; // インポート済みエピソードの作画完了、次の曲へ
    }

    addLog(`${modeInfo.icon} 【第${epIndex}${modeInfo.unit} / 今回制作: ${currentBatchStep}${modeInfo.unit}目（全${totalEpCount}${modeInfo.unit}）】「${baseRawTitle}」第${epIndex}弾のお題＆脚本（12カット）をAIが考案中...`, 'process');

    const curPlan = {
      epNumber: epIndex,
      titleJp: rawTitle,
      titleEn: currentEnTitle,
      summary: `${baseRawTitle}の世界観で紡がれる第${epIndex}の映像作品（全12カット）`
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
      isMultiPanel: settings.isMultiPanel,
      existingTitles,
      superBackoff: settings.superBackoff,
      abortCheck: () => isAbortedRef.current,
      addLog
    });

    const cutsCount = Math.max(CUTS_PER_EPISODE, settings.previewCutCount || (curMode === 'mv' ? 30 : 12), curMode === 'mv' ? 30 : curMode === 'manga' ? 24 : 12);
    const baseCutsData = Array.from({ length: cutsCount }, (_, j) => {
      const cutData = parsed.cuts[j] || {} as any;
      return createPipelineCut(j, cutData, parsed, settings, curMode, curMode === 'mv', curMode === 'manga' || settings.isMangaMode);
    });

    // 各話固有のお題（サブタイトル）を整形（削除による欠番事故を防ぐため、Vol.Xや第X話などの連番は一切入れない）
    const cleanParsedTitle = cleanEpisodeTitle(parsed.titleJp || '');
    const safeTopicJp = sanitizeForYouTubeSafety(cleanParsedTitle && cleanParsedTitle !== baseRawTitle ? cleanParsedTitle : `情景の断章`);
    const displayTitleJp = `${modeInfo.icon} ${safeTopicJp}`;

    const cleanParsedEn = cleanEpisodeTitleEn(parsed.titleEn || '');
    const cleanTopicEn = cleanParsedEn && cleanParsedEn !== defaultEnTitle ? cleanParsedEn : 'Cinematic Story';
    const displayTitleEn = cleanTopicEn;

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
      isPreviewDone: false, isDone: false, taste: settings.taste, era: settings.era, theme: settings.theme,
      isMvMode: curMode === 'mv', productionMode: curMode as any
    };

    // Reset character reference for independent episodes so each gets a unique character
    if (!newEpisode.isMvMode && !settings.isMvMode) {
       ctx.activeReferenceRef.current = undefined;
    }

    // 三面図マスターシートの自動生成（360度キャラ崩れ完全防止）
    const turnaround = await ensureCharacterTurnaround(ctx, newEpisode);
    if (turnaround.mediaId) {
      newEpisode.characterTurnaroundMediaId = turnaround.mediaId;
      newEpisode.characterTurnaroundBase64 = turnaround.base64;
    }

    setEpisodes(prev => [...prev.filter(e => e.id !== epIndex), newEpisode]);
    episodesRef.current = [...episodesRef.current.filter(e => e.id !== epIndex), newEpisode];
    addLog(`✨ 第${epIndex}${modeInfo.unit}のお題決定！『${newEpisode.titleJp}』全${cutsCount}カットの情景演出が確定！描画を開始します...`, 'success');

    if (newEpisode.isMvMode && !newEpisode.isLyricAnalyzed && ensureLyricVisualAnalysis) {
      await ensureLyricVisualAnalysis(newEpisode);
    }
    const targetCutCount = Math.min(settings.previewCutCount, cutsCount);
    await runTasks(buildCutTasks(newEpisode, newEpisode.cuts.slice(0, targetCutCount)));

    if (isAbortedRef.current) {
      updateEpisode(epIndex, { isGenerating: false });
      break;
    }

    const freshNewEp = episodesRef.current.find(e => e.id === epIndex) || newEpisode;
    const completedCount = freshNewEp.cuts.slice(0, targetCutCount).filter(c => c.imageBase64 || c.imageMediaId).length;
    const isAllDone = completedCount >= cutsCount;
    const isPreviewSuccessful = completedCount >= targetCutCount;

    updateEpisode(epIndex, { 
      isGenerating: false, 
      isPreviewDone: isPreviewSuccessful, 
      isDone: isAllDone 
    });

    if (isPreviewSuccessful) {
      addLog(`✅ 第${epIndex}${modeInfo.unit}『${newEpisode.titleJp}』先行${targetCutCount}カットの画像生成が完了しました！`, 'success');
      // ★インフォグラフィック扉絵（9:16特大ポスター）を全自動生成！
      await ensureInfographicCover(ctx, freshNewEp);
    } else {
      addLog(`⚠️ 第${epIndex}${modeInfo.unit}『${newEpisode.titleJp}』画像生成が一部未完了（${completedCount}/${targetCutCount}カット）です。右側の「未生成カットを生成」から再開できます。`, 'warning');
    }

    await saveStory({ titleJp: newEpisode.titleJp, titleEn: newEpisode.titleEn, country: settings.country, era: settings.era, theme: settings.theme, protagonistSummary: newEpisode.summary || '', createdAt: new Date().toISOString() });
    cleanupEpisodeMemory();
  }

  // ── Phase 2: 自動動画化フェーズ（全エピソードの画像生成が完了した後に4多重で安全に並列実行） ──
  if (settings.autoVideo && !isAbortedRef.current) {
    addLog(`🎬 【自動動画化フェーズ】全${modeInfo.unit}の画像作画が完了しました。キメカットの並列動画化を開始します...`, 'process');
    for (let epIndex = startEpIndex; epIndex <= endEpIndex; epIndex++) {
      if (isAbortedRef.current) break;
      const currentEpForVideo = episodesRef.current.find(e => Number(e.id) === Number(epIndex));
      if (!currentEpForVideo) continue;

      const cutsCount = currentEpForVideo.cuts.length;
      const targetCutCount = Math.min(settings.previewCutCount || cutsCount, cutsCount);
      let selectedCuts = currentEpForVideo.cuts.slice(0, targetCutCount).filter(c => c.isSelectedForVideo);

      // セーフティネット: autoVideoがONなのに全カット未選択の場合、videoRatioに基づき自動救済選定
      if (selectedCuts.length === 0 && settings.videoRatio !== 'none') {
        addLog(`💡 [動画化自動救済] 第${epIndex}${modeInfo.unit}のカット選択が0枚のため、設定割合「${settings.videoRatio || '30%'}」に基づきキメカットを自動選定します`, 'info');
        currentEpForVideo.cuts.forEach((c, idx) => {
          if (isCutSelectedForVideo(idx, settings.videoRatio || '30%')) {
            c.isSelectedForVideo = true;
          }
        });
        setEpisodes(prev => prev.map(e => Number(e.id) === Number(epIndex) ? { ...e, cuts: currentEpForVideo.cuts } : e));
        selectedCuts = currentEpForVideo.cuts.slice(0, targetCutCount).filter(c => c.isSelectedForVideo);
      }

      if (selectedCuts.length > 0) {
        addLog(`🎬 第${epIndex}${modeInfo.unit}『${currentEpForVideo.titleJp}』の並列動画化を開始（対象: ${selectedCuts.length}カット）...`, 'process');
        await handleBulkVideo(epIndex);
      }
    }
  }

  // ── Phase 3: 自動ダウンロードフェーズ ──
  if (settings.autoDownload && !isAbortedRef.current) {
    for (let epIndex = startEpIndex; epIndex <= endEpIndex; epIndex++) {
      if (isAbortedRef.current) break;
      const freshEp = episodesRef.current.find(e => Number(e.id) === Number(epIndex));
      if (!freshEp) continue;
      addLog(`📦 第${epIndex}${modeInfo.unit}『${freshEp.titleJp}』の完了時自動ダウンロードを開始します...`, 'process');
      const currentLogs = ctx.logsRef?.current || ((typeof window !== 'undefined' && (window as any).__STUDIO_LOGS__) || []);
      const res = await downloadZip(freshEp, addLog, undefined, currentLogs);
      if (res) {
        if (freshEp.packageZipBlobUrl) {
          try { URL.revokeObjectURL(freshEp.packageZipBlobUrl); } catch (_) {}
        }
        updateEpisode(epIndex, {
          packageZipBlobUrl: res.blobUrl,
          packageZipFilename: res.filename,
          packageZipSizeStr: res.sizeStr
        });
      }
    }
  }

  if (!isAbortedRef.current) {
    addLog(`🎉 全 ${totalEpCount} ${modeInfo.unit}の${modeInfo.label}制作がすべて完了しました！`, 'success');
  }
}
