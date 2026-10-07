import { MutableRefObject } from 'react';
import { Flow } from 'flow-sdk';
import { Episode, Cut, GeneratorSettings, VideoModelType } from '../types';
import { LogEntry } from '../components/StudioLogs';
import { DEFAULT_ASPECT_RATIO, resolveVideoModel } from '../constants';
import { callWithRetry, formatDurationMs, formatErrorMessage } from './utils';
import { resolveCameraWork } from '../config/studioDefinitions';
import { renderKenBurnsVideo } from './browserVideoService';

interface UseVideoGenerationProps {
  settings: GeneratorSettings;
  addLog: (message: string, type?: LogEntry['type']) => void;
  isAbortedRef: MutableRefObject<boolean>;
  episodesRef: MutableRefObject<Episode[]>;
  updateCut: (epId: number, cutId: number, updates: Partial<Cut>) => void;
}

export function useVideoGeneration({
  settings, addLog, isAbortedRef, episodesRef, updateCut
}: UseVideoGenerationProps) {
  
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
    
    let endMediaId = cut?.endFrameImageMediaId || (cut as any)?.endFrameMediaId;
    if (!endMediaId && (cut?.endFrameImageBase64 || (cut as any)?.endFrameBase64)) {
      try {
        const rawBase64 = cut?.endFrameImageBase64 || (cut as any)?.endFrameBase64 || '';
        const cleanEndImg = rawBase64.replace(/^data:[^;]+;base64,/, '');
        const upEnd = await Flow.upload({ base64: cleanEndImg, mimeType: 'image/png', name: `CutEnd_${epId}_${cutId}` });
        endMediaId = upEnd.mediaId;
        updateCut(epId, cutId, { 
          endFrameImageMediaId: endMediaId,
          endFrameMediaId: endMediaId 
        } as any);
      } catch (err) {
        addLog(`⚠️ Ep.${epId} C${cutId.toString().padStart(2, '0')}: End絵のアップロードに失敗しました`, 'warning');
      }
    }

    const modelDef = resolveVideoModel(modelType);
    updateCut(epId, cutId, { isGeneratingVideo: true, videoModelUsed: modelDef.name, error: undefined });
    
    addLog(`🎥 Ep.${epId} C${cutId.toString().padStart(2, '0')}: Start絵基準・プロンプト誘導型動画生成を開始 (${modelDef.name})`, 'info');

    try {
      // ユーザー指示: After絵の画像参照はモーフィング崩壊の害悪となるため無効化！
      // Start絵（画像1枚）のみを参照し、プロンプトだけで「初めに●●、次に■■、最後にAfterの状態」へと自然に進化させる
      const isMotionValid = cut?.veoMotionPrompt && /[a-zA-Z0-9]/.test(cut.veoMotionPrompt);
      const motionText = isMotionValid
        ? `[Temporal Scene Transition]: ${cut.veoMotionPrompt}`
        : (cut?.cameraMotion || (cut?.cameraWork ? resolveCameraWork(cut.cameraWork).motionPrompt : ''));
      
      const isEndFrameValid = cut?.endFramePromptEn && /[a-zA-Z0-9]/.test(cut.endFramePromptEn);
      const endDestinationText = isEndFrameValid ? ` [Destination Finale Scene]: ${cut.endFramePromptEn}` : '';

      // Start絵の構図 ＋ 三段時系列カメラ＆情景推移 ＋ 最終到達点（After）の情景プロンプト
      const finalVideoPrompt = `[Initial Starting Scene]: ${cut?.promptEn || ''} ${motionText}${endDestinationText}`.trim();

      const res = await callWithRetry<any>(
        () => Flow.generate.video({ 
          prompt: finalVideoPrompt, 
          firstFrameImageMediaId: mediaId, 
          // lastFrameImageMediaId: endMediaId || undefined, // ※ユーザー指示: After参照はモーフィング崩壊の害悪となるため無効化
          modelDisplayName: modelDef.name, 
          durationSeconds: modelDef.defaultDuration, 
          aspectRatio: DEFAULT_ASPECT_RATIO as "16:9" | "9:16" 
        }),
        (attempt, max, delay, err, isSuper) => {
          const waitStr = formatDurationMs(delay);
          const errMsg = formatErrorMessage(err);
          if (isSuper) {
            addLog(`🌙 Ep.${epId} C${cutId.toString().padStart(2, '0')}: [超指数バックオフ ${attempt - 5}/3] 深夜帯サーバー高負荷のため ${waitStr}待機して自動再開します... (理由: ${errMsg})`, 'warning');
          } else {
            addLog(`⚠️ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 動画リトライ (${attempt}/${max}) ${waitStr}後... (理由: ${errMsg})`, 'warning');
          }
        },
        {
          maxRetries: 5,
          timeoutMs: 180000,
          timeoutLabel: '動画生成',
          superBackoff: settings.superBackoff,
          abortCheck: () => isAbortedRef.current
        }
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
      updateCut(epId, cutId, { isGeneratingVideo: false, error: '失敗' });
      addLog(`❌ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 動画生成失敗 - ${formatErrorMessage(err)}`, 'error');
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

  return {
    generateVideo,
    generateBrowserVideo
  };
}
