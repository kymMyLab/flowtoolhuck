import { MutableRefObject, Dispatch, SetStateAction } from 'react';
import { Flow } from 'flow-sdk';
import { Episode, Cut, GeneratorSettings, GenerationTask, SeriesManifest, SeriesEpisodePlan, VideoModelType } from '../types';
import { 
  CUTS_PER_EPISODE, 
  TASTES, 
  resolveRecommendedCameraWorkAndKenBurns, 
  resolveRecommendedTelopStaging, 
  resolveVideoModel,
  resolveImageModel
} from '../constants';
import { getStoryboardPreset } from './promptEngine';
import { createDefaultCut, isCutSelectedForVideo, safeJsonParse, callWithRetry, formatErrorMessage } from './utils';
import { saveStory } from './db';
import { downloadZip, renderCoverBase64 } from './exportService';
import { 
  generateSafeEpisodeScript, 
  extractHighlights, 
  checkIsHistorical, 
  sanitizeForYouTubeSafety, 
  buildGrandDesignPrompt, 
  buildNextEpisodePlanPrompt,
  buildCharacterTurnaroundPrompt,
  buildAdaptiveInfographicCoverPrompt
} from './directorService';
import { LogEntry } from '../components/StudioLogs';

/**
 * 1話完了時のクリーンアップ処理（メモリリーク対策用）
 */
function cleanupEpisodeMemory() {
  if (typeof window !== 'undefined' && (window as any).gc) {
    try { (window as any).gc(); } catch (e) {}
  }
}

/**
 * 主人公キャラクターの三面図マスターシートを生成・登録
 */
async function ensureCharacterTurnaround(
  ctx: ProductionPipelineContext,
  ep: Episode
): Promise<{ mediaId?: string; base64?: string }> {
  const { settings, addLog, isAbortedRef, activeReferenceRef } = ctx;

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

    if (res && res.mediaId) {
      addLog(`✨ 【三面図マスター確定】主人公の三面図シートが完成！全カットの基準アセットとして登録しました。`, 'success');
      return { mediaId: res.mediaId, base64: res.base64 };
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
async function ensureInfographicCover(
  ctx: ProductionPipelineContext,
  ep: Episode
): Promise<{ mediaId?: string; base64?: string; promptEn?: string }> {
  const { settings, addLog, isAbortedRef, activeReferenceRef, updateEpisode, episodesRef, setEpisodes } = ctx;

  if (isAbortedRef.current) return {};

  const freshEp = episodesRef.current.find(e => e.id === ep.id) || ep;
  if (freshEp.coverMediaId || freshEp.coverBase64) {
    return { mediaId: freshEp.coverMediaId, base64: freshEp.coverBase64, promptEn: freshEp.coverPromptEn };
  }

  try {
    addLog(`🎨 Ep.${freshEp.id}: 【扉絵自動生成】世界観適応インフォグラフィック扉絵（9:16特大ポスター）を描画中...`, 'process');
    updateEpisode(freshEp.id, { isGeneratingCover: true });

    const coverPromptObj = buildAdaptiveInfographicCoverPrompt({
      titleJp: freshEp.titleJp,
      titleEn: freshEp.titleEn,
      coverCatchphraseJp: freshEp.coverCatchphraseJp,
      coverCatchphraseEn: freshEp.coverCatchphraseEn,
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

    if (res && (res.mediaId || res.base64)) {
      updateEpisode(freshEp.id, {
        coverMediaId: res.mediaId,
        coverBase64: res.base64,
        coverPromptEn: coverPromptObj.promptEn,
        isGeneratingCover: false
      });
      episodesRef.current = episodesRef.current.map(e => e.id === freshEp.id ? {
        ...e,
        coverMediaId: res.mediaId,
        coverBase64: res.base64,
        coverPromptEn: coverPromptObj.promptEn,
        isGeneratingCover: false
      } : e);
      setEpisodes(prev => prev.map(e => e.id === freshEp.id ? {
        ...e,
        coverMediaId: res.mediaId,
        coverBase64: res.base64,
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



export interface ProductionPipelineContext {
  settings: GeneratorSettings;
  addLog: (message: string, type?: LogEntry['type']) => void;
  logsRef?: MutableRefObject<LogEntry[] | undefined>;
  isAbortedRef: MutableRefObject<boolean>;
  episodesRef: MutableRefObject<Episode[]>;
  setEpisodes: Dispatch<SetStateAction<Episode[]>>;
  updateEpisode: (epId: number, data: Partial<Episode>) => void;
  runTasks: (tasks: GenerationTask[]) => Promise<void>;
  buildCutTasks: (ep: Episode, cuts: Cut[], styleKey?: string) => GenerationTask[];
  generateVideo: (epId: number, cutId: number, modelType: VideoModelType) => Promise<void>;
  handleBulkVideo: (epId: number) => Promise<void>;
  seriesManifestRef: MutableRefObject<SeriesManifest | null>;
  setActiveSeriesManifest: Dispatch<SetStateAction<SeriesManifest | null>>;
  activeReferenceRef: MutableRefObject<{
    mediaId: string;
    characterDna: string;
    styleDna: string;
    antiPoseNegative: string;
    eraNegative: string;
  } | null>;
  currentAssetRef: MutableRefObject<{ name: string; base64: string; mimeType: string } | null>;
}

export const SHORTS_CONFIG_MAP: Record<string, { label: string; unit: string; icon: string }> = {
  mv: { label: '音楽MV', unit: '曲', icon: '🎵' },
  trivia: { label: '衝撃雑学Shorts', unit: '本', icon: '💡' },
  quotes: { label: '偉人名言Shorts', unit: '本', icon: '📜' },
  folklore: { label: '怪異・未解決Shorts', unit: '本', icon: '👻' },
  craft: { label: '職人魂ショート', unit: '本', icon: '🏯' }
};

/**
 * ── 1. 画風比較（Style Matrix）制作パイプライン ──
 * 同じ物語の脚本で、最大N種類の画風（Anime, Cyberpunk, Ghibli等）を同時に比較生成
 */
export async function runStyleMatrixProduction(ctx: ProductionPipelineContext): Promise<void> {
  const { settings, addLog, isAbortedRef, episodesRef, setEpisodes, updateEpisode, runTasks, buildCutTasks } = ctx;

  const allTasteKeys = Object.keys(TASTES);
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
      const narration = cutData.narrationJp || '';
      const plot = cutData.basicPlot || '';
      const cutHighlights = cutData.highlights || sharedScript.highlightWords || [];
      const preset = getStoryboardPreset(j + 1, false, false);
      const staging = resolveRecommendedTelopStaging(j + 1, false, false, undefined, 'style-matrix');
      
      const cut = createDefaultCut(j + 1, narration, plot, isCutSelectedForVideo(j, settings.videoRatio));
      cut.shotScale = preset.scale;
      cut.cinematicAngle = preset.angle;
      cut.panelLayout = cutData.panelLayout || (settings.isMultiPanel ? 'dynamic-multi' : 'single');
      const recCw = resolveRecommendedCameraWorkAndKenBurns(j + 1, 'style-matrix', false, false);
      cut.cameraWork = recCw.id;
      cut.cameraMotion = recCw.motionPrompt;
      cut.kenBurnsPreset = recCw.recommendedKenBurns;
      Object.assign(cut.telop, staging);
      cut.telop.highlights = extractHighlights(narration, cutHighlights);
      return cut;
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

/**
 * ── 2. YouTube Shorts / 音楽MV（指定本数 × 各12カット）制作パイプライン ──
 */
export async function runShortsBatchProduction(ctx: ProductionPipelineContext, curMode: string): Promise<void> {
  const { settings, addLog, isAbortedRef, episodesRef, setEpisodes, updateEpisode, runTasks, buildCutTasks, handleBulkVideo } = ctx;
  const modeInfo = SHORTS_CONFIG_MAP[curMode] || { label: 'Shorts', unit: '本', icon: '🎬' };
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

    // 既出タイトルの収集（ネタ・お題の重複被り防止）
    const existingTitles = episodesRef.current
      .map(e => e.titleJp.replace(/^[^\w\s一-龯]+/, '').trim())
      .filter(Boolean);

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

    const baseCutsData = Array.from({ length: CUTS_PER_EPISODE }, (_, j) => {
      const cutData = parsed.cuts[j] || {} as any;
      const narration = cutData.narrationJp || '';
      const plot = cutData.basicPlot || '';
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

      // 新仕様: 人物なし物体カット、9分割注視点構図、Veo補間用モーション
      cut.isObjectOnly = cutData.isObjectOnly || false;
      cut.focalPoint = cutData.focalPoint;
      cut.compositionPrompt = cutData.compositionPrompt;
      cut.veoMotionPrompt = cutData.veoMotionPrompt;
      cut.endFramePromptEn = cutData.endFramePlot;

      return cut;
    });

    // 各話固有のお題（サブタイトル）を整形（削除による欠番事故を防ぐため、Vol.Xや第X話などの連番は一切入れない）
    const cleanParsedTitle = (parsed.titleJp || '')
      .replace(/^【.*?】\s*/, '')
      .replace(/^(第\d+話|第\d+曲|Vol\.\d+|Track\s*\d+|Episode\s*\d+)[:：\s]*/i, '')
      .replace(/\s*\(?(Vol\.\d+|第\d+話)\)?\s*$/i, '')
      .trim();
    const safeTopicJp = sanitizeForYouTubeSafety(cleanParsedTitle && cleanParsedTitle !== baseRawTitle ? cleanParsedTitle : `情景の断章`);
    const displayTitleJp = `${modeInfo.icon} ${safeTopicJp}`;

    const cleanParsedEn = (parsed.titleEn || '')
      .replace(/^(Vol\.\d+|Track\s*\d+|Episode\s*\d+)[:：\s]*/i, '')
      .replace(/\s*\(?(Vol\.\d+|Ep\.\d+)\)?\s*$/i, '')
      .trim();
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

    // 三面図マスターシートの自動生成（360度キャラ崩れ完全防止）
    const turnaround = await ensureCharacterTurnaround(ctx, newEpisode);
    if (turnaround.mediaId) {
      newEpisode.characterTurnaroundMediaId = turnaround.mediaId;
      newEpisode.characterTurnaroundBase64 = turnaround.base64;
    }

    setEpisodes(prev => [...prev.filter(e => e.id !== epIndex), newEpisode]);
    episodesRef.current = [...episodesRef.current.filter(e => e.id !== epIndex), newEpisode];
    addLog(`✨ 第${epIndex}${modeInfo.unit}のお題決定！『${newEpisode.titleJp}』全12カットの情景演出が確定！描画を開始します...`, 'success');

    const targetCutCount = Math.min(settings.previewCutCount, CUTS_PER_EPISODE);
    await runTasks(buildCutTasks(newEpisode, newEpisode.cuts.slice(0, targetCutCount)));

    const isAllDone = targetCutCount >= CUTS_PER_EPISODE;
    updateEpisode(epIndex, { 
      isGenerating: false, 
      isPreviewDone: true, 
      isDone: isAllDone 
    });
    addLog(`✅ 第${epIndex}${modeInfo.unit}『${newEpisode.titleJp}』先行${targetCutCount}カットの画像生成が完了しました！`, 'success');

    // ★インフォグラフィック扉絵（9:16特大ポスター）を全自動生成！
    await ensureInfographicCover(ctx, episodesRef.current.find(e => e.id === epIndex) || newEpisode);

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

    // 自動ダウンロードがONの場合、パッケージング＆直接保存を実行
    const freshEp = episodesRef.current.find(e => e.id === epIndex) || newEpisode;
    if (settings.autoDownload && !isAbortedRef.current) {
      addLog(`📦 第${epIndex}${modeInfo.unit}の完了時自動ダウンロードを開始します...`, 'process');
      const currentLogs = ctx.logsRef?.current || ((typeof window !== 'undefined' && (window as any).__STUDIO_LOGS__) || []);
      const res = await downloadZip(freshEp, addLog, undefined, currentLogs);
      if (res) {
        updateEpisode(epIndex, {
          packageZipBlobUrl: res.blobUrl,
          packageZipFilename: res.filename,
          packageZipSizeStr: res.sizeStr
        });
      }
    }
    await saveStory({ titleJp: freshEp.titleJp, titleEn: freshEp.titleEn, country: settings.country, era: settings.era, theme: settings.theme, protagonistSummary: freshEp.summary || '', createdAt: new Date().toISOString() });
    cleanupEpisodeMemory();
  }

  if (!isAbortedRef.current) {
    addLog(`🎉 全 ${totalEpCount} ${modeInfo.unit}の${modeInfo.label}制作がすべて完了しました！`, 'success');
  }
}

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

      const sharedScript = await generateSafeEpisodeScript({
        epId,
        currentPlan,
        country: settings.country,
        theme: settings.theme,
        era: settings.era,
        isMangaMode: settings.isMangaMode,
        isMvMode: settings.isMvMode,
        taste: settings.taste,
        productionMode: 'episodes',
        isMultiPanel: settings.isMultiPanel,
        superBackoff: settings.superBackoff,
        abortCheck: () => isAbortedRef.current,
        addLog
      });

      addLog(`✨ 【第${epId}話】脚本＆時代考証が完成！（考証: ${sharedScript.eraAnalysisJp?.slice(0, 24) || '完了'}...）`, 'success');

      const episodeCuts: Cut[] = Array.from({ length: CUTS_PER_EPISODE }, (_, j) => {
        const cutData = sharedScript.cuts[j] || {} as any;
        const narration = cutData.narrationJp || '';
        const plot = cutData.basicPlot || '';
        const cut = createDefaultCut(j + 1, narration, plot, isCutSelectedForVideo(j, settings.videoRatio));
        cut.panelLayout = cutData.panelLayout || (settings.isMultiPanel ? 'dynamic-multi' : 'single');
        const preset = getStoryboardPreset(j + 1, false, settings.isMangaMode);
        cut.shotScale = preset.scale;
        cut.cinematicAngle = preset.angle;
        const cwDef = resolveRecommendedCameraWorkAndKenBurns(j + 1, 'episodes', false, settings.isMangaMode);
        cut.cameraWork = cwDef.id;
        cut.cameraMotion = cwDef.motionPrompt;
        cut.kenBurnsPreset = cwDef.recommendedKenBurns;
        const dramaStaging = resolveRecommendedTelopStaging(j + 1, false, false, undefined, 'episodes');
        Object.assign(cut.telop, dramaStaging);
        cut.telop.highlights = extractHighlights(narration, cutData.highlights || sharedScript.highlightWords);

        // 新仕様: 人物なし物体カット、9分割注視点構図、Veo補間用モーション
        cut.isObjectOnly = cutData.isObjectOnly || false;
        cut.focalPoint = cutData.focalPoint;
        cut.compositionPrompt = cutData.compositionPrompt;
        cut.veoMotionPrompt = cutData.veoMotionPrompt;
        cut.endFramePromptEn = cutData.endFramePlot;

        return cut;
      });

      const currentEpObj = episodesRef.current.find(e => e.id === epId);
      if (currentEpObj) {
        currentEpObj.characterDna = sharedScript.characterDna;
      }
      let turnaroundMediaId = currentEpObj?.characterTurnaroundMediaId;
      let turnaroundBase64 = currentEpObj?.characterTurnaroundBase64;
      if (!turnaroundMediaId && currentEpObj) {
        const turnaround = await ensureCharacterTurnaround(ctx, currentEpObj);
        turnaroundMediaId = turnaround.mediaId;
        turnaroundBase64 = turnaround.base64;
      }

      updateEpisode(epId, {
        titleJp: sharedScript.titleJp, titleEn: sharedScript.titleEn, summary: sharedScript.summary,
        characterDna: sharedScript.characterDna,
        eraAnalysis: sharedScript.eraAnalysisJp, forbiddenAnachronisms: sharedScript.forbiddenAnachronisms,
        authenticAttireEn: sharedScript.authenticAttireEn, forbiddenKeywordsEn: sharedScript.forbiddenKeywordsEn,
        coverCatchphraseJp: sharedScript.coverCatchphraseJp, coverCatchphraseEn: sharedScript.coverCatchphraseEn,
        highlightWords: sharedScript.highlightWords || [], cuts: episodeCuts,
        characterTurnaroundMediaId: turnaroundMediaId,
        characterTurnaroundBase64: turnaroundBase64,
        taste: settings.taste, era: settings.era, theme: settings.theme, productionMode: 'episodes'
      });

      addLog(`🎨 【第${epId}話】先行プレビュー ${settings.previewCutCount} カットの描画タスクを開始...（並列度: ${settings.parallelCount}）`, 'process');
      const currentEp = episodesRef.current.find(e => e.id === epId)!;
      await runTasks(buildCutTasks(currentEp, episodeCuts.slice(0, settings.previewCutCount)));
      addLog(`🎉 【第${epId}話】「${currentPlan.titleJp}」の先行プレビュー制作が完了しました！`, 'success');

      // ★インフォグラフィック扉絵（9:16特大ポスター）を全自動生成！
      await ensureInfographicCover(ctx, episodesRef.current.find(e => e.id === epId) || currentEp);

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

      const freshEp = episodesRef.current.find(e => e.id === epId) || currentEp;
      if (settings.autoDownload && !isAbortedRef.current) {
        const currentLogs = ctx.logsRef?.current || ((typeof window !== 'undefined' && (window as any).__STUDIO_LOGS__) || []);
        const res = await downloadZip(freshEp, addLog, manifest, currentLogs);
        if (res) {
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
      updateEpisode(epId, { isGenerating: false, error: '生成中断' });
      continue;
    }
  }
}
