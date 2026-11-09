// ── Google Flow SDK グローバル型宣言 ──
declare global {
  const Flow: any;
}

export type VideoModelType = 'veo-lite' | 'omni-flash' | 'veo-fast' | 'browser-0pt';
export type ProductionMode = 'episodes' | 'manga' | 'mv' | 'trivia' | 'quotes' | 'folklore' | 'craft' | 'style-matrix' | 'manzai';
export type RecommendationModel = VideoModelType | 'none';
export type VideoRatio = 'none' | 'cut2' | '30%' | '50%' | '100%';
export type KenBurnsPreset = 'none' | 'zoom-in' | 'zoom-out' | 'pan-left' | 'pan-right' | 'tilt-up' | 'tilt-down';
export type TelopStyle = 'mv-blur-slide' | 'mv-kinetic-pop' | 'mv-neon-glow' | 'cinema-subtle' | 'traditional-sumi' | 'brush-impact' | 'mv-vertical-lyric' | 'mv-center-climax';
export type TelopTransition = 'blur-slide-left' | 'blur-slide-up' | 'blur-slide-right' | 'zoom-in-bounce' | 'glow-fade' | 'glitch-pop' | 'animista-slide-bck' | 'aos-fade-soft' | 'gsap-kinetic-stagger';
export type TelopPosition = 'bottom-left' | 'bottom-center' | 'center-stagger' | 'bottom-right' | 'top-cinema' | 'vertical-right' | 'vertical-left' | 'center-climax';
export interface TelopConfig {
  fullText: string;
  highlights?: Array<{ word: string; color: string; sizeScale: number }>;
  style?: TelopStyle;
  transition?: TelopTransition;
  position?: TelopPosition;
  directorNote?: string;
}
export interface ReferenceAsset {
  id?: number;
  name: string;
  base64: string;
  mimeType: string;
  mediaId?: string; 
  styleAnalysis?: string;
  characterAnalysis?: string;
  createdAt: string;
}
export type ComicPanelLayout = 'splash' | 'vertical-split' | 'horizontal-split' | 'focus-grid' | 'standard';
export interface ComicPanelMeta {
  layout: ComicPanelLayout;
  isDoublePageSplash?: boolean;
  sfxOnomatopoeia?: string;
  dialogueType?: 'monologue' | 'shout' | 'whisper' | 'narration';
}
export type CompositionGrid = 
  | 'top-left' | 'top-center' | 'top-right'
  | 'center-left' | 'center' | 'center-right'
  | 'bottom-left' | 'bottom-center' | 'bottom-right';
export interface FocalPoint {
  grid: CompositionGrid;
  normalizedCoord: [number, number]; // [x, y] 0.0〜1.0 (例: [0.5, 0.28])
  focalSubject: string;
}
export interface Cut {
  id: number;
  promptEn: string;
  narrationJp: string;
  narrationEn?: string;
  negativePrompt?: string; 
  duration?: number;
  
  shotScale?: string;
  cinematicAngle?: string;
  cameraWork?: string;
  scenePlot?: string;
  cleanAction?: string;
  cleanImagePrompt?: string;
  cleanLighting?: string;
  cleanComposition?: string;
  panelLayout?: 'single' | 'split-2' | 'split-3' | 'diagonal-slash' | 'l-shaped' | 'panoramic-split' | 'inset-reaction' | 'vertical-split' | 'dynamic-multi' | string;
  comicPanel?: ComicPanelMeta;
  kenBurnsPreset?: KenBurnsPreset; 
  cameraMotion?: string;
  focalPoint?: FocalPoint;
  compositionPrompt?: string;
  isObjectOnly?: boolean;
  veoMotionPrompt?: string;
  endFramePromptEn?: string;
  endFrameImageMediaId?: string;
  endFrameImageBase64?: string;
  isGeneratingEndFrame?: boolean;
  summary?: string;
  isKeyScene?: boolean;
  imageMediaId?: string;
  imageBase64?: string;
  videoMediaId?: string;
  videoBase64?: string;
  videoModelUsed?: string;
  videoDuration?: number;
  telop?: TelopConfig;
  isDirecting: boolean; 
  isGeneratingImage: boolean;
  isGeneratingVideo: boolean;
  isQueued: boolean;
  isSelectedForVideo: boolean;
  targetVideoModel: RecommendationModel;
  error?: string;
  bgmMediaId?: string;
  voiceId?: string;
  isMvMode?: boolean;
  finalPromptUsed?: string;
  finalNegativeUsed?: string;
  geminiVisualPrompt?: string;
  stagingType?: 'character_with_props' | 'character_focused' | 'scenic_prop_insert';
  characterPresence?: CharacterPresenceType;
  veoPriorityRank?: number;
  styleKeyUsed?: string;
  imageModelUsed?: string;
}
export type CharacterPresenceType =
  | '1_protagonist_solo_focus'
  | '2_protagonist_or_pair_wide'
  | '3_two_characters_asymmetric'
  | '4_hands_or_feet_detail'
  | '5_scenic_or_still_life';
export interface ExtractedSongDna {
  protagonistDna: string;
  protagonistWardrobeDna?: string;
  partnerDna?: string;
  keyPropsDna?: string;
}
export interface Episode {
  id: number;
  internalId: string;
  titleJp: string;
  titleEn: string;
  summary?: string;
  eraAnalysis?: string;
  forbiddenAnachronisms?: string[];
  authenticAttireEn?: string;
  forbiddenKeywordsEn?: string;
  highlightWords?: string[];
  // 9:16 縦ロング扉絵
  coverCatchphraseJp?: string;
  coverCatchphraseEn?: string;
  coverBase64?: string;
  coverMediaId?: string;
  coverPromptEn?: string;
  coverThemeVariant?: string;
  isGeneratingCover?: boolean;
  // 16:9 横型マスターカバー（横動画・YouTube用サムネイル看板）
  coverHorizontalBase64?: string;
  coverHorizontalMediaId?: string;
  coverHorizontalPromptEn?: string;
  characterDna?: string;
  extractedSongDna?: ExtractedSongDna;
  characterTurnaroundMediaId?: string;
  characterTurnaroundBase64?: string;
  characterTurnaroundPrompt?: string;
  masterAnchorMediaId?: string;
  masterAnchorBase64?: string;
  
  cuts: Cut[];
  isGenerating: boolean;
  isGeneratingRemainingImages: boolean;
  isLyricAnalyzed?: boolean;
  isBatchGeneratingVideos: boolean;
  isExportingMovie?: boolean; 
  fullMovieBase64?: string;   
  isPreviewDone: boolean;
  isDone: boolean;
  error?: string;
  characterId?: string;
  taste?: string;
  era?: string;
  theme?: string;
  isMvMode?: boolean;
  productionMode?: ProductionMode;
  packageZipBlobUrl?: string;
  packageZipFilename?: string;
  packageZipSizeStr?: string;
  soundPrompt?: string;
  musicStyle?: string;
  instrumentalTrack?: unknown;
}
export interface GeneratorSettings {
  productionMode: ProductionMode; 
  country: string;
  customCountry?: string;
  era?: string;
  customEra?: string;
  theme: string;
  customTheme?: string;
  taste: string;
  customTaste?: string;
  isMangaMode?: boolean;
  isMvMode?: boolean;
  imageModel: string;
  defaultVideoModel: string;
  videoModel?: string;
  videoRatio: VideoRatio;
  episodeCount: number;
  cutCount?: number;
  totalEpisodes?: number;
  previewCutCount: number; 
  parallelCount: number;
  autoVideo: boolean;
  autoDownload: boolean;
  superBackoff?: boolean;
  aspectRatio?: '9:16' | '1:1' | '16:9';
  characterId?: string;
  runModeProfile?: 'night' | 'daytime';
  enableTurnaroundSheet?: boolean;
  autoApproveTurnaround?: boolean;
  enableObjectCut?: boolean;
  enableEndFrames?: boolean;
}
export interface GenerationTask {
  id?: string | number;
  epId: number;
  cutId: number;
  prompt: string;
  negativePrompt?: string;
  styleKey: string;
  imageModel: string;
  isMvMode?: boolean;
  eraAnalysis?: string;
  forbiddenAnachronisms?: string[];
  authenticAttireEn?: string;
  forbiddenKeywordsEn?: string;
  referenceImageMediaId?: string;
  storyContext?: string;
  characterDna?: string;
  isObjectOnly?: boolean;
  characterPresence?: CharacterPresenceType;
  extractedSongDna?: ExtractedSongDna;
  focalSubject?: string;
  isEndFrame?: boolean;
  endFrameCameraDirective?: string;
  shotScale?: string;
  cinematicAngle?: string;
  camera?: string;
  previousContexts?: any;
  antiPreviousMandate?: string;
}
export interface ProductionPipelineContext {
  settings: GeneratorSettings;
  addLog: (message: string, type?: LogEntry['type']) => void;
  logsRef?: any;
  isAbortedRef: any;
  episodesRef: any;
  setEpisodes: any;
  updateEpisode: (epId: number, data: Partial<Episode>) => void;
  runTasks: (tasks: GenerationTask[]) => Promise<void>;
  buildCutTasks: (ep: Episode, cuts: Cut[], styleKey?: string) => GenerationTask[];
  seriesManifestRef: any;
  setActiveSeriesManifest: any;
  activeReferenceRef: any;
  currentAssetRef: any;
}
export const SHORTS_CONFIG_MAP: Record<string, { label: string; unit: string; icon: string }> = {
  mv: { label: '音楽MV', unit: '曲', icon: '🎵' },
  trivia: { label: '衝撃雑学Shorts', unit: '本', icon: '💡' },
  quotes: { label: '偉人名言Shorts', unit: '本', icon: '📜' },
  folklore: { label: '怪異・未解決Shorts', unit: '本', icon: '👻' },
  craft: { label: '職人魂ショート', unit: '本', icon: '🏯' }
};
export function cleanupEpisodeMemory() {
  if (typeof window !== 'undefined' && (window as any).gc) {
    try { (window as any).gc(); } catch (e) {}
  }
}
export interface SeriesEpisodePlan {
  epNumber: number;
  titleJp: string;
  titleEn: string;
  summary: string;
}
export interface SeriesManifest {
  seriesTitle: string;
  totalEpisodes: number;
  currentEpisodeId: number;
  completedEpisodeIds: number[];
  overallSynopsis: string;
  episodesPlan: SeriesEpisodePlan[];
  referenceAsset?: {
    name: string;
    base64: string;
    mimeType: string;
    characterDna?: string;
    styleDna?: string;
    antiPoseNegative?: string;
    eraNegative?: string;
    characterTurnaroundMediaId?: string;
    characterTurnaroundBase64?: string;
  };
  settings?: Partial<GeneratorSettings>;
}
export interface LogEntry {
  id: string;
  message: string;
  type: 'info' | 'process' | 'success' | 'warning' | 'error';
}

