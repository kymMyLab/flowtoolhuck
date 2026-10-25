import { MutableRefObject } from 'react';
import { Flow } from 'flow-sdk';
import { Episode, Cut, GeneratorSettings, VideoModelType } from '../types';
import { LogEntry } from '../components/StudioLogs';
import { DEFAULT_ASPECT_RATIO, resolveVideoModel } from '../constants';
import { callWithRetry, formatDurationMs, formatErrorMessage } from './utils';
import { resolveCameraWork } from '../config/studioDefinitions';
import { renderKenBurnsVideo } from './browserVideoService';
import { sanitizePromptForGoogleSafety } from './promptEngine';

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
      const rawLyric = `${cut?.narrationJp || ''} ${cut?.telop?.fullText || ''}`;
      const isMotionValid = Boolean(cut?.veoMotionPrompt && /[a-zA-Z0-9]/.test(cut.veoMotionPrompt));
      let motionText = isMotionValid
        ? `[Temporal Scene Transition]: ${cut.veoMotionPrompt}`
        : (cut?.cameraMotion || (cut?.cameraWork ? resolveCameraWork(cut.cameraWork).motionPrompt : ''));

      // 🌿 普遍的マイクロモーション規約（原画の神作画を100%維持し、突拍子もない奇行・手足の崩壊を完全根絶）
      if (!isMotionValid || cut?.veoMotionPrompt?.includes('subtle organic character breathing') || cut?.veoMotionPrompt?.includes('walking motion') || cut?.veoMotionPrompt?.includes('sprints')) {
        const isJoyfulLyric = /(はずむ|弾む|あしどり|足取り|ステップ|スキップ|あわせて|笑顔|笑う|楽しい|うれしい|光|smile|joy|happy|bounce)/i.test(rawLyric);
        const isPoignantLyric = /(涙|泣く|サヨナラ|さよなら|消える|遠ざかる|孤独|ひとり|切ない|寂しい|雨|tear|crying|sad)/i.test(rawLyric);

        if (isJoyfulLyric) {
          motionText = '[Temporal Scene Transition]: Stable cinematic micro-motion: character pose firmly preserved, radiant genuine smile gently deepening, sparkling eyes blinking naturally, hair strands fluttering softly in the breeze, subtle cinematic camera push-in';
        } else if (isPoignantLyric) {
          motionText = '[Temporal Scene Transition]: Stable cinematic micro-motion: character pose firmly preserved, subtle emotional shift in gaze, eyes glistening softly with natural blinking, parted lips catching breath, gentle ambient breeze swaying hair';
        } else {
          motionText = '[Temporal Scene Transition]: Stable cinematic micro-motion: character pose stably preserved, natural gentle blinking, soft breeze gently swaying hair strands and clothing fabric, subtle organic ambient breathing, smooth cinematic camera drift';
        }
      }
      
      const isEndFrameValid = cut?.endFramePromptEn && /[a-zA-Z0-9]/.test(cut.endFramePromptEn);
      const endDestinationText = isEndFrameValid ? ` [Destination Finale Scene]: ${cut.endFramePromptEn}` : '';

      // Start絵の構図 ＋ 三段時系列カメラ＆情景推移 ＋ 最終到達点（After）の情景プロンプト
      const stylePreservationMandate = '[MASTER ART STYLE MANDATE]: Strictly maintain the identical rendering medium, visual aesthetic, and artistic art style of the first frame image throughout the entire duration. Zero drift into photorealism or 3D CG textures.';
      let finalVideoPrompt = `${stylePreservationMandate} [Initial Starting Scene]: ${cut?.promptEn || ''} ${motionText}${endDestinationText}`.trim();

      if (finalVideoPrompt.includes('undefined') || !/[a-zA-Z0-9]/.test(finalVideoPrompt)) {
        finalVideoPrompt = `${stylePreservationMandate} Cinematic moving shot, high quality`;
      }

      // Filter out photorealistic keywords if the cut is not photorealistic (check prompt or style)
      // Since we don't have direct access to isPhotoStyle here without importing, we check if the image prompt explicitly requested a stylized medium.
      const isStylized = finalVideoPrompt.match(/anime|manga|illustration|cel|pixel|8-bit|16-bit|watercolor|oil painting|ukiyo-e|woodblock|art nouveau|chibi|ligne claire|drawing|sketch|vector|lo-fi/i)
                        || (cut?.styleKeyUsed && !cut.styleKeyUsed.match(/photo|実写|dslr/i));

      if (isStylized) {
        finalVideoPrompt = finalVideoPrompt.replace(/\b(photoreal|photorealistic|hyper-detailed reflections|35mm DSLR|35mm photograph|live-action|raw photograph|realistic human photo|western live-action film)\b/gi, '');
      }

      // 🧣 物理破綻防止: 「二人羽織マフラー（首と首が一本の布で連結されるバグ）」を動画プロンプトから完全除去＆分離強制
      finalVideoPrompt = finalVideoPrompt
        .replace(/sharing\s+(a\s+)?(scarf|muffler)/gi, 'each wearing an independent $2')
        .replace(/one\s+(scarf|muffler)\s+wrapped\s+around\s+both/gi, 'each wearing their own separate $1');
      if (/(two characters|couple|pair|two people|boy and girl)/i.test(finalVideoPrompt) && /(scarf|muffler)/i.test(finalVideoPrompt)) {
        finalVideoPrompt += ', each character wearing their own completely separate scarf around neck, two physically independent scarves, strictly no cloth connecting two necks';
      }

      // Google Veoセーフティ保護: VeoでNGワードになりやすい過剰検閲単語を事前中和
      finalVideoPrompt = sanitizePromptForGoogleSafety(finalVideoPrompt)
        .replace(/\b(seductive|seductively|adult|intimate|childlike|sensual|erotic|provocative|naked|nude|bedroom lingerie|feverish)\b/gi, 'artistic')
        .replace(/\b(intimate quiet bedroom|intimate bedroom|intimate)\b/gi, 'cozy peaceful bedroom')
        .replace(/,\s*,/g, ', ')
        .trim();

      // ユーザー絶対方針: 動画は横動画(16:9)を基本とする（横→縦のクロップは容易だが、縦→横は困難なため）
      const targetAspectRatio: "16:9" | "9:16" = settings.aspectRatio === '9:16' ? '9:16' : '16:9';
      const safeVideoModelName = modelDef.name || 'Veo 3.1 - Fast';

      let res: any;
      try {
        res = await callWithRetry<any>(
          async () => {
            // Google Flow内部仕様: Flow.generate.videoはmodelDisplayNameを指定すると「利用できません」エラーになるため、指定なし(デフォルト)で呼び出すのが正規仕様
            return await Flow.generate.video({ 
              prompt: finalVideoPrompt, 
              firstFrameImageMediaId: mediaId, 
              // lastFrameImageMediaId: endMediaId || undefined, // ※ユーザー指示: After参照はモーフィング崩壊の害悪となるため無効化
              durationSeconds: modelDef.defaultDuration || 8, 
              aspectRatio: targetAspectRatio 
            });
          },
          (attempt, max, delay, err) => {
            const waitStr = formatDurationMs(delay);
            const errMsg = formatErrorMessage(err);
            addLog(`⚠️ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 動画リトライ (${attempt}/${max}) ${waitStr}後... (理由: ${errMsg})`, 'warning');
          },
          {
            maxRetries: 3,
            timeoutMs: 180000,
            timeoutLabel: '動画生成',
            superBackoff: false, // ★ 初回は10〜30分待たせず、まず3回短時間で迅速検証
            abortCheck: () => isAbortedRef.current
          }
        );
      } catch (firstErr: any) {
        const errMsg = formatErrorMessage(firstErr);
        
        if (!isAbortedRef.current) {
          addLog(`🛡️ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 動画生成サーバー拒否または過負荷を検知。プロンプト極小安全化モードで即時救済を試みます...`, 'warning');
          
          // Google Veoセーフティを100%通過させるための骨子のみの超軽量・安全プロンプト
          const ultraSafePrompt = `[MASTER ART STYLE MANDATE]: Maintain exact anime MV art style of first frame image. Cinematic camera motion, gentle organic movement, atmospheric cinematic lighting.`
            .trim();

          res = await callWithRetry<any>(
            async () => {
              return await Flow.generate.video({
                prompt: ultraSafePrompt,
                firstFrameImageMediaId: mediaId,
                durationSeconds: modelDef.defaultDuration || 8,
                aspectRatio: targetAspectRatio
              });
            },
            (attempt, max, delay, err, isSuper) => {
              const waitStr = formatDurationMs(delay);
              const safeErrMsg = formatErrorMessage(err);
              if (isSuper) {
                addLog(`🌙 Ep.${epId} C${cutId.toString().padStart(2, '0')}: [超指数バックオフ ${attempt - 3}/4] 深夜帯サーバー高負荷のため ${waitStr}待機して自動再開します... (理由: ${safeErrMsg})`, 'warning');
              } else {
                addLog(`⚡ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 安全版動画リトライ (${attempt}/${max}) ${waitStr}後... (理由: ${safeErrMsg})`, 'warning');
              }
            },
            {
              maxRetries: 3,
              timeoutMs: 180000,
              timeoutLabel: '安全プロンプト動画生成',
              superBackoff: settings.superBackoff, // ★ 安全プロンプトでも落ちる場合のみ、真のサーバー過負荷として超指数バックオフを適用
              abortCheck: () => isAbortedRef.current
            }
          );
        } else {
          throw firstErr;
        }
      }
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
    const ep = episodesRef.current.find(e => e.id === epId);
    const cut = ep?.cuts.find(c => c.id === cutId);
    const rawImage = cut?.imageBase64 || (cut as any)?.image;
    if (!rawImage) {
      addLog(`⚠️ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 静止画が見つからないためスキップしました`, 'warning');
      return;
    }
    updateCut(epId, cutId, { isGeneratingVideo: true, videoModelUsed: 'Browser (0pt)', error: undefined });
    addLog(`⚡ Ep.${epId} C${cutId.toString().padStart(2, '0')}: ブラウザ動画化中（Ken Burns＆テロップ合成）...`, 'process');
    try {
      const isMvMode = ep?.isMvMode || false;
      const isHorizontal = settings.aspectRatio !== '9:16';
      const duration = cut?.duration || 4;
      const base64 = await renderKenBurnsVideo(cut!, duration, isMvMode, isHorizontal);
      const cleanVideoBase64 = base64 ? base64.replace(/^data:[^;]+;base64,/, '') : '';
      updateCut(epId, cutId, { videoBase64: cleanVideoBase64, isGeneratingVideo: false, error: undefined, videoDuration: duration });
      addLog(`🎬 Ep.${epId} C${cutId.toString().padStart(2, '0')}: ブラウザ動画化完了！`, 'success');
    } catch (err: any) { 
      console.error(`❌ Ep.${epId} C${cutId} ブラウザ動画化エラー:`, err);
      updateCut(epId, cutId, { isGeneratingVideo: false, error: err?.message || '失敗' }); 
      addLog(`❌ Ep.${epId} C${cutId.toString().padStart(2, '0')}: 動画化失敗 - ${err?.message || err}`, 'error');
    }
  };

  return {
    generateVideo,
    generateBrowserVideo
  };
}
