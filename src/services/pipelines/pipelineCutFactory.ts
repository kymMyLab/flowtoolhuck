import { Cut, GeneratorSettings } from '../../types';
import { 
  resolveRecommendedCameraWorkAndKenBurns, 
  resolveRecommendedTelopStaging 
} from '../../constants';
import { getStoryboardPreset } from '../promptEngine';
import { createDefaultCut } from '../utils';
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
  const cut = createDefaultCut(cutIndex + 1, narration, plot, false);
  cut.panelLayout = 'single';

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
