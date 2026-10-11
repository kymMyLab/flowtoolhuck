import { Cut, GeneratorSettings } from '../../types';
import { 
  resolveRecommendedCameraWorkAndKenBurns, 
  resolveRecommendedTelopStaging 
} from '../../constants';
import { getStoryboardPreset } from '../promptEngine';
import { createDefaultCut, isCutSelectedForVideo } from '../utils';
import { extractHighlights } from '../directorService';

/**
 * 脚本データおよび演出レジストリからカットメタデータを単一生成（重複排除・単一責務）
 */
export function createPipelineCut(
  cutIndex: number,
  cutData: any,
  sharedScript: any,
  settings: GeneratorSettings,
  effectiveMode: string,
  isMv: boolean,
  isManga: boolean
): Cut {
  const narration = cutData.narrationJp || '';
  const plot = cutData.basicPlot || '';
  const cut = createDefaultCut(cutIndex + 1, narration, plot, isCutSelectedForVideo(cutIndex, settings.videoRatio));

  // 多彩なマンガコマ割りローテーション（均等スライス完全排除）
  const dynamicLayoutCycle = ['diagonal-slash', 'l-shaped', 'panoramic-split', 'inset-reaction', 'vertical-split', 'split-2', 'single'];
  const chosenLayout = (cutData.panelLayout && cutData.panelLayout !== 'split-3' && cutData.panelLayout !== 'dynamic-multi')
    ? cutData.panelLayout
    : (settings.isMultiPanel ? dynamicLayoutCycle[cutIndex % dynamicLayoutCycle.length] : 'single');
  cut.panelLayout = chosenLayout;

  const preset = getStoryboardPreset(cutIndex + 1, isMv, isManga);
  cut.shotScale = preset.scale;
  cut.cinematicAngle = preset.angle;

  const cwDef = resolveRecommendedCameraWorkAndKenBurns(cutIndex + 1, effectiveMode, isMv, isManga);
  cut.cameraWork = cwDef.id;
  cut.cameraMotion = cwDef.motionPrompt;
  cut.kenBurnsPreset = cwDef.recommendedKenBurns;

  const dramaStaging = resolveRecommendedTelopStaging(cutIndex + 1, isMv, false, undefined, effectiveMode);
  Object.assign(cut.telop, dramaStaging);
  cut.telop.highlights = extractHighlights(narration, cutData.highlights || sharedScript.highlightWords);

  // 新仕様: 人物なし物体カット、9分割注視点構図、Veo補間用モーション
  cut.isObjectOnly = settings.enableObjectCut !== false ? (cutData.isObjectOnly || false) : false;
  cut.focalPoint = cutData.focalPoint;
  cut.compositionPrompt = cutData.compositionPrompt;
  cut.veoMotionPrompt = cutData.veoMotionPrompt;
  cut.endFramePromptEn = cutData.endFramePlot;

  return cut;
}
