import { Flow } from 'flow-sdk';
import { Episode, Cut, SeriesEpisodePlan, VideoModelType } from '../../types';
import { CUTS_PER_EPISODE, resolveVideoModel } from '../../constants';
import { createDefaultCut, safeJsonParse, callWithRetry, formatErrorMessage, isCutSelectedForVideo } from '../utils';
import { saveStory } from '../db';
import { downloadZip, downloadManifestFile } from '../exportService';
import { 
  generateSafeEpisodeScript, 
  checkIsHistorical, 
  buildGrandDesignPrompt, 
  buildNextEpisodePlanPrompt, 
  cleanEpisodeTitle, 
  cleanEpisodeTitleEn 
} from '../directorService';
import { ProductionPipelineContext, cleanupEpisodeMemory } from './pipelineTypes';
import { createPipelineCut } from './pipelineCutFactory';
import { ensureCharacterTurnaround, ensureInfographicCover } from './pipelineAssetFactory';

/**
 * ── 3. 連続ドラマ・漫画シリーズ（グランドデザイン＆全話プロット展開）制作パイプライン ──
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
    generateVideo, 
    seriesManifestRef, 
    setActiveSeriesManifest, 
    currentAssetRef, 
    activeReferenceRef 
  } = ctx;

  if (!seriesManifestRef.current) {
    const isHist = checkIsHistorical(settings.era, settings.theme);
    const isMv = settings.isMvMode || settings.productionMode === 'mv';
    const isManga = settings.isMangaMode || settings.productionMode === 'manga';
    const genreLabel = isMv ? '音楽MVシリーズ' : isManga ? '漫画シリーズ' : isHist ? '大河ドラマ' : '連続ドラマ';
    const totalEps = settings.totalEpisodes || settings.episodeCount || 1;
    addLog(`📜 全${totalEps}話の${genreLabel}グランドデザインをAIに策定依頼中... [世界観・テーマ: ${settings.theme}]`, 'process');
    const designPrompt = buildGrandDesignPrompt(totalEps, settings.country, settings.theme, settings.era, isManga, isMv);
    const designStartTime = Date.now();
    let designHeartbeat: any = setInterval(() => {
      const elapsed = Math.round((Date.now() - designStartTime) / 1000);
      addLog(`⏳ シリーズ設計図をAI思考中...（${elapsed}秒経過: 全${totalEps}話の伏線・プロットを構成中）`, 'process');
    }, 5000);

    let designRes: any;
    try {
      designRes = await callWithRetry<any>(
        () => Flow.generate.text(designPrompt),
        (attempt, max, delay) => addLog(`Retrying Grand Design (attempt ${attempt}/${max}) after ${delay} ms...`, 'warning'),
        5
      );
      const elapsed = ((Date.now() - designStartTime) / 1000).toFixed(1);
      addLog(`📥 シリーズ設計図のAI応答を受信（応答時間: ${elapsed}秒）`, 'process');
    } finally {
      clearInterval(designHeartbeat);
    }
    const design = safeJsonParse<any>(designRes.text, { seriesTitle: 'Untitled Series', overallSynopsis: '', episodesPlan: [] });

    seriesManifestRef.current = {
      seriesTitle: design.seriesTitle,
      totalEpisodes: totalEps,
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
      cuts: Array.from({ length: Math.max(CUTS_PER_EPISODE, settings.previewCutCount || (settings.productionMode === 'mv' ? 30 : 12)) }, (_, j) => createDefaultCut(j + 1, '脚本策定待ち...', '', false)),
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
        const rawPlan = safeJsonParse<SeriesEpisodePlan>(planRes.text, {
          epNumber: epNum,
          titleJp: '運命の分岐点',
          titleEn: 'Turning Point',
          summary: `これまでの物語から続く新たなドラマと波乱の展開`
        });
        newPlan = {
          ...rawPlan,
          titleJp: cleanEpisodeTitle(rawPlan.titleJp) || '運命の分岐点',
          titleEn: cleanEpisodeTitleEn(rawPlan.titleEn) || 'Turning Point'
        };
      } catch (e) {
        newPlan = {
          epNumber: epNum,
          titleJp: '運命の継承',
          titleEn: 'Destiny',
          summary: `第${epNum - 1}話から続く物語`
        };
      }

      manifest.episodesPlan.push(newPlan);
      manifest.totalEpisodes = manifest.episodesPlan.length;

      const newEpisodeCard: Episode = {
        id: epNum,
        internalId: crypto.randomUUID(),
        titleJp: cleanEpisodeTitle(newPlan.titleJp),
        titleEn: cleanEpisodeTitleEn(newPlan.titleEn),
        summary: newPlan.summary,
        cuts: Array.from({ length: Math.max(CUTS_PER_EPISODE, settings.previewCutCount || (settings.productionMode === 'mv' ? 30 : 12)) }, (_, j) => createDefaultCut(j + 1, '脚本策定待ち...', '', false)),
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

    const isMv = settings.isMvMode || settings.productionMode === 'mv';
    const isManga = settings.isMangaMode || settings.productionMode === 'manga';
    const effectiveMode = settings.productionMode || (isMv ? 'mv' : isManga ? 'manga' : 'episodes');
    const unitLabel = isMv ? '曲' : '話';

    // 既出タイトルの収集（話数・曲数間でのネタ・シチュエーション被り防止）
    const existingTitles = episodesRef.current
      .map(e => (e.titleJp || '').replace(/^[^\w\s一-龯]+/, '').trim())
      .filter(Boolean);

    try {
      addLog(`📖 【第${epId}${unitLabel}】「${currentPlan.titleJp}」の脚本・演出構成をAIに執筆依頼中...`, 'process');
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
        isMultiPanel: settings.isMultiPanel,
        existingTitles,
        superBackoff: settings.superBackoff,
        abortCheck: () => isAbortedRef.current,
        addLog
      });

      addLog(`✨ 【第${epId}${unitLabel}】脚本＆演出構成が完成！（考証: ${sharedScript.eraAnalysisJp?.slice(0, 24) || '完了'}...）`, 'success');

      const seriesCutsCount = Math.max(CUTS_PER_EPISODE, settings.previewCutCount || (isMv ? 30 : 12));
      const episodeCuts: Cut[] = Array.from({ length: seriesCutsCount }, (_, j) => {
        const cutData = sharedScript.cuts[j] || {} as any;
        return createPipelineCut(j, cutData, sharedScript, settings, effectiveMode, isMv, isManga);
      });

      const currentEpObj = episodesRef.current.find(e => e.id === epId);
      if (currentEpObj) {
        currentEpObj.characterDna = sharedScript.characterDna;
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

      const rawTitleJp = (currentPlan.titleJp && !currentPlan.titleJp.match(/^(第\d+話|第\d+曲|Vol\.\d+|Episode\s*\d+|Untitled)/i))
        ? currentPlan.titleJp
        : (sharedScript.titleJp || currentPlan.titleJp);
      const rawTitleEn = (currentPlan.titleEn && !currentPlan.titleEn.match(/^(Episode\s*\d+|Track\s*\d+|Untitled)/i))
        ? currentPlan.titleEn
        : (sharedScript.titleEn || currentPlan.titleEn);

      const finalTitleJp = cleanEpisodeTitle(rawTitleJp);
      const finalTitleEn = cleanEpisodeTitleEn(rawTitleEn);

      updateEpisode(epId, {
        titleJp: finalTitleJp, 
        titleEn: finalTitleEn, 
        summary: currentPlan.summary || sharedScript.summary,
        characterDna: sharedScript.characterDna,
        eraAnalysis: sharedScript.eraAnalysisJp, forbiddenAnachronisms: sharedScript.forbiddenAnachronisms,
        authenticAttireEn: sharedScript.authenticAttireEn, forbiddenKeywordsEn: sharedScript.forbiddenKeywordsEn,
        coverCatchphraseJp: sharedScript.coverCatchphraseJp, coverCatchphraseEn: sharedScript.coverCatchphraseEn,
        highlightWords: sharedScript.highlightWords || [], cuts: episodeCuts,
        characterTurnaroundMediaId: turnaroundMediaId,
        characterTurnaroundBase64: turnaroundBase64,
        taste: settings.taste, era: settings.era, theme: settings.theme, productionMode: effectiveMode, isMvMode: isMv
      });

      addLog(`🎨 【第${epId}${unitLabel}】先行プレビュー ${settings.previewCutCount} カットの描画タスクを開始...（並列度: ${settings.parallelCount}）`, 'process');
      const currentEp = episodesRef.current.find(e => e.id === epId)!;
      await runTasks(buildCutTasks(currentEp, episodeCuts.slice(0, settings.previewCutCount)));
      addLog(`🎉 【第${epId}${unitLabel}】「${currentPlan.titleJp}」の先行プレビュー制作が完了しました！`, 'success');

      // ★インフォグラフィック扉絵（9:16特大ポスター）を全自動生成！
      await ensureInfographicCover(ctx, episodesRef.current.find(e => e.id === epId) || currentEp);

      const currentEpForVideo = episodesRef.current.find(e => e.id === epId);
      let cutsToAnimate = currentEpForVideo ? currentEpForVideo.cuts.filter(c => c.isSelectedForVideo) : [];

      // ★ セーフティネット: autoVideoがONなのに全カット未選択の場合、videoRatioに基づき自動救済選定
      if (settings.autoVideo && cutsToAnimate.length === 0 && settings.videoRatio !== 'none' && currentEpForVideo) {
        addLog(`💡 [動画化自動救済] カット選択が0枚のため、設定割合「${settings.videoRatio || '30%'}」に基づきキメカットを自動選定して動画化を開始します`, 'info');
        currentEpForVideo.cuts.forEach((c, idx) => {
          if (isCutSelectedForVideo(idx, settings.videoRatio || '30%')) {
            c.isSelectedForVideo = true;
          }
        });
        setEpisodes(prev => prev.map(e => e.id === epId ? { ...e, cuts: currentEpForVideo.cuts } : e));
        cutsToAnimate = currentEpForVideo.cuts.filter(c => c.isSelectedForVideo);
      }

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

      // ★ 確実にレジューム可能にするため、1話完了ごとに自動で manifest をバックアップ保存
      if (settings.autoDownload && !isAbortedRef.current) {
        try {
          await downloadManifestFile(manifest, addLog);
        } catch (_) {}
      }

      const freshEp = episodesRef.current.find(e => e.id === epId) || currentEp;
      if (settings.autoDownload && !isAbortedRef.current) {
        const currentLogs = ctx.logsRef?.current || ((typeof window !== 'undefined' && (window as any).__STUDIO_LOGS__) || []);
        const res = await downloadZip(freshEp, addLog, manifest, currentLogs);
        if (res) {
          if (freshEp.packageZipBlobUrl) {
            try { URL.revokeObjectURL(freshEp.packageZipBlobUrl); } catch (_) {}
          }
          updateEpisode(epId, {
            packageZipBlobUrl: res.blobUrl,
            packageZipFilename: res.filename,
            packageZipSizeStr: res.sizeStr
          });
        }
      }
      await saveStory({ titleJp: freshEp.titleJp, titleEn: freshEp.titleEn, country: settings.country, era: settings.era, theme: settings.theme, protagonistSummary: freshEp.summary || '', createdAt: new Date().toISOString() });
      cleanupEpisodeMemory();
    } catch (epErr: any) {
      addLog(`⚠️ 第 ${epId} 話の生成中にエラーが発生しました。スキップして次へ進みます: ${formatErrorMessage(epErr)}`, 'warning');
      episodesRef.current = episodesRef.current.map(e => e.id === epId ? {
        ...e,
        isGenerating: false,
        isBatchGeneratingVideos: false,
        error: '生成中断',
        cuts: e.cuts.map(c => ({ ...c, isGeneratingImage: false, isGeneratingVideo: false, isGeneratingEndFrame: false }))
      } : e);
      setEpisodes(prev => prev.map(e => e.id === epId ? {
        ...e,
        isGenerating: false,
        isBatchGeneratingVideos: false,
        error: '生成中断',
        cuts: e.cuts.map(c => ({ ...c, isGeneratingImage: false, isGeneratingVideo: false, isGeneratingEndFrame: false }))
      } : e));
      cleanupEpisodeMemory();
      continue;
    }
  }
}
