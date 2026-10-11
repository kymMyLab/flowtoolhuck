/**
 * 映像制作パイプラインの統合ファサード
 * 各種パイプライン（単発・ショーツ、長編シリーズ、画風マトリクス、アセット工場）を再エクスポートします。
 * 後方互換性を100%維持しながら、内部を徹底的にモジュール分離しています。
 */

export * from './pipelines/pipelineTypes';
export * from './pipelines/pipelineCutFactory';
export * from './pipelines/pipelineAssetFactory';
export * from './pipelines/styleMatrixPipeline';
export * from './pipelines/shortsBatchPipeline';
export * from './pipelines/seriesProductionPipeline';
