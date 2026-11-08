import React from 'react';
import { Cut } from '../types';
interface CutCardProps {
  cut: Cut;
  cutIndex: number;
  onPreview: (cut: Cut) => void;
  onGenerateImage?: (cut: Cut) => void;
  onGenerateVideo?: (cut: Cut) => void;
}
export const CutCard: React.FC<CutCardProps> = ({
  cut,
  cutIndex,
  onPreview,
  onGenerateImage,
  onGenerateVideo,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col group hover:border-slate-700 transition-all shadow-md">
      {/* プレビューエリア */}
      <div
        onClick={() => onPreview(cut)}
        className="relative aspect-video bg-slate-950 border-b border-slate-800/80 flex items-center justify-center cursor-pointer group-hover:bg-slate-900/60 transition-colors overflow-hidden"
      >
        {cut.imageBase64 ? (
          <img
            src={`data:image/png;base64,${cut.imageBase64}`}
            alt={`Cut ${cut.id}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-600">
            <span className="material-symbols-outlined text-2xl">movie</span>
            <span className="text-[11px] font-mono">未生成カット</span>
          </div>
        )}
        {/* カット番号バッジ */}
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur text-[10px] font-mono text-slate-300 border border-white/10">
          CUT #{String(cutIndex + 1).padStart(2, '0')}
        </div>
        {/* カメラ・アングルバッジ */}
        {cut.cinematicAngle && (
          <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-black/75 backdrop-blur text-[10px] text-slate-400 border border-white/10">
            {cut.cinematicAngle}
          </div>
        )}
        {/* 生成ステータスインジケーター */}
        {(cut.isGeneratingImage || cut.isGeneratingVideo) && (
          <div className="absolute inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center gap-2">
            <span className="material-symbols-outlined animate-spin text-indigo-400 text-lg">
              progress_activity
            </span>
            <span className="text-xs font-mono text-indigo-300">
              {cut.isGeneratingImage ? '画像生成中...' : '動画生成中...'}
            </span>
          </div>
        )}
      </div>
      {/* 詳細・演出テキスト */}
      <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
        <div className="space-y-1.5">
          <p className="text-xs text-slate-200 font-medium line-clamp-2 leading-relaxed">
            {cut.narrationJp || cut.scenePlot || '演出指示が設定されていません'}
          </p>
          {cut.telop?.fullText && (
            <div className="text-[11px] text-indigo-300 bg-indigo-950/40 border border-indigo-900/30 rounded px-2 py-1">
              <span className="text-[10px] text-indigo-400 block font-semibold mb-0.5">テロップ:</span>
              「{cut.telop.fullText}」
            </div>
          )}
        </div>
        {/* コントロール・フッター */}
        <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px]">
          <span className="text-slate-500 font-mono">
            {cut.duration ? `${cut.duration}s` : 'Auto'}
          </span>
          <div className="flex items-center gap-1.5">
            {onGenerateImage && (
              <button
                disabled={cut.isGeneratingImage}
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateImage(cut);
                }}
                className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] transition-colors border border-slate-700 disabled:opacity-50"
              >
                画像生成
              </button>
            )}
            {onGenerateVideo && (
              <button
                disabled={cut.isGeneratingVideo}
                onClick={(e) => {
                  e.stopPropagation();
                  onGenerateVideo(cut);
                }}
                className="px-2 py-1 rounded bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 text-[10px] transition-colors border border-indigo-500/40 disabled:opacity-50"
              >
                動画化
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

