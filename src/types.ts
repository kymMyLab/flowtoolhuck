export type VideoModelType = 'veo-lite' | 'omni-flash' | 'veo-fast' | 'browser-0pt';
export type ProductionMode = 'episodes' | 'mv' | 'trivia' | 'quotes' | 'folklore' | 'craft' | 'style-matrix';
export type RecommendationModel = VideoModelType | 'none';
export type VideoRatio = 'none' | '30%' | '50%' | '100%';

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

export interface Cut {
  id: number;
  promptEn: string;
  narrationJp: string;
  narrationEn?: string;
  negativePrompt?: string; 
  
  shotScale?: string;
  cinematicAngle?: string;
  cameraWork?: string;
  scenePlot?: string;
  comicPanel?: ComicPanelMeta;

  kenBurnsPreset?: KenBurnsPreset; 
  cameraMotion?: string;

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
  styleKeyUsed?: string;
  imageModelUsed?: string;
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

  coverCatchphraseJp?: string;
  coverCatchphraseEn?: string;
  coverBase64?: string;
  
  cuts: Cut[];
  isGenerating: boolean;
  isGeneratingRemainingImages: boolean;
  isBatchGeneratingVideos: boolean;
  isExportingMovie?: boolean; 
  fullMovieBase64?: string;   
  isPreviewDone: boolean;
  isDone: boolean;
  error?: string;

  // 時代・画風の固定用
  taste?: string;
  era?: string;
  theme?: string;
  isMvMode?: boolean;
  productionMode?: ProductionMode;

  // 生成済みZIPパッケージキャッシュ
  packageZipBlobUrl?: string;
  packageZipFilename?: string;
  packageZipSizeStr?: string;
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
  previewCutCount: number; 
  parallelCount: number;
  autoVideo: boolean;
  autoDownload: boolean;
  selectedAssetId?: number;
}

export interface GenerationTask {
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
}

/** 
 * 大河ドラマ・全話グランドデザイン用 
 */
export interface SeriesEpisodePlan {
  epNumber: number;
  titleJp: string;
  titleEn: string;
  summary: string;
}

/** 
 * シリーズ全体のマニフェスト（レジューム用）
 */
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
  };
  settings?: Partial<GeneratorSettings>;
}