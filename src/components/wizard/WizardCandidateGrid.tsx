import React from 'react';
import { TurnaroundCandidate } from '../../services/comicWizardService';

interface WizardCandidateGridProps {
  candidates: TurnaroundCandidate[];
  selectedCandidateId: string | null;
  currentCandidate: TurnaroundCandidate | null;
  onSelectCandidate: (id: string) => void;
  onProceedToStep2: (cand: TurnaroundCandidate) => void;
  onZoomImage: (img: { base64: string; title: string }) => void;
}

export const WizardCandidateGrid: React.FC<WizardCandidateGridProps> = ({
  candidates,
  selectedCandidateId,
  currentCandidate,
  onSelectCandidate,
  onProceedToStep2,
  onZoomImage,
}) => {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-indigo-500">grid_view</span>
          画風テイスト ＆ 主人公三面図候補（5体中から1枚を選択）
        </span>
        {selectedCandidateId && (
          <span className="text-[11px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            ✓ 「{currentCandidate?.name}」を選択中
          </span>
        )}
      </div>

      {candidates.length === 0 ? (
        <div className="bg-white p-8 rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center text-center gap-2 text-slate-400">
          <span className="material-symbols-outlined text-4xl text-slate-300">view_carousel</span>
          <span className="text-xs font-bold text-slate-600">まだ候補が生成されていません</span>
          <span className="text-[11px] text-slate-500">
            上の「🎨 三面図を一括AI作画」ボタンを押すと、5種類の画風と主人公三面図が自動作画されます。
          </span>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {candidates.map((cand, idx) => {
            const isSelected = cand.id === selectedCandidateId;
            const hasImage = Boolean(cand.turnaroundBase64);
            const isGenerating = cand.status === 'generating_image';

            return (
              <div
                key={cand.id}
                onClick={() => {
                  if (hasImage) {
                    onSelectCandidate(cand.id);
                  }
                }}
                className={`relative bg-white rounded-xl border-2 transition-all flex flex-col overflow-hidden shadow-2xs cursor-pointer ${
                  isSelected 
                    ? 'border-indigo-600 ring-2 ring-indigo-500/30 shadow-md' 
                    : hasImage 
                    ? 'border-slate-200 hover:border-indigo-300' 
                    : 'border-slate-200 opacity-80'
                }`}
              >
                {/* User Specified Badge */}
                {cand.isUserSpecified && (
                  <div className="absolute top-2 left-2 z-10 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
                    <span>🎯 指定画風</span>
                  </div>
                )}

                {/* Selected Badge */}
                {isSelected && !cand.isUserSpecified && (
                  <div className="absolute top-2 left-2 z-10 bg-indigo-600 text-white text-[10px] font-extrabold px-1.5 py-0.5 rounded shadow-sm flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[12px]">check</span>
                    <span>選択中</span>
                  </div>
                )}

                {/* Index Badge */}
                <div className="absolute top-2 right-2 z-10 bg-slate-900/70 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  候補 #{idx + 1}
                </div>

                {/* 16:9 Image Preview Box */}
                <div className="relative aspect-video w-full bg-slate-100 flex items-center justify-center overflow-hidden border-b border-slate-100 group">
                  {cand.turnaroundBase64 ? (
                    <>
                      <img
                        src={`data:image/png;base64,${cand.turnaroundBase64}`}
                        alt={cand.name}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onZoomImage({
                            base64: cand.turnaroundBase64!,
                            title: `📐 ${cand.tasteName} - ${cand.name} (三面図シート)`
                          });
                        }}
                        className="absolute bottom-1.5 right-1.5 px-2 py-0.5 rounded bg-slate-950/70 hover:bg-slate-950 text-white text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 shadow-sm cursor-pointer"
                        title="拡大表示"
                      >
                        <span className="material-symbols-outlined text-xs">zoom_in</span>
                        拡大
                      </button>
                    </>
                  ) : isGenerating ? (
                    <div className="flex flex-col items-center justify-center p-3 text-center gap-1 text-indigo-600">
                      <span className="material-symbols-outlined animate-spin text-2xl">autorenew</span>
                      <span className="text-[10px] font-bold">三面図を作画中...</span>
                    </div>
                  ) : cand.status === 'error' ? (
                    <div className="flex flex-col items-center justify-center p-3 text-center gap-1 text-rose-500">
                      <span className="material-symbols-outlined text-xl">error</span>
                      <span className="text-[10px]">作画エラー</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-3 text-center gap-1 text-slate-400">
                      <span className="material-symbols-outlined text-xl text-slate-300">hourglass_empty</span>
                      <span className="text-[10px]">作画待機中</span>
                    </div>
                  )}
                </div>

                {/* Candidate Info */}
                <div className="p-3 flex flex-col gap-1.5 flex-1 justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100 truncate" title={cand.tasteName}>
                      {cand.tasteName}
                    </span>
                    <h5 className="text-xs font-bold text-slate-900 truncate" title={cand.name}>
                      {cand.name}
                    </h5>
                    <p className="text-[11px] text-slate-500 leading-tight line-clamp-2" title={cand.concept}>
                      {cand.concept}
                    </p>
                  </div>

                  {/* Action Button inside card */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (!hasImage) return;
                      onProceedToStep2(cand);
                    }}
                    disabled={!hasImage}
                    className={`w-full py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 shadow-2xs cursor-pointer ${
                      isSelected 
                        ? 'bg-gradient-to-r from-emerald-600 to-indigo-600 hover:from-emerald-700 hover:to-indigo-700 text-white animate-pulse' 
                        : hasImage 
                        ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200' 
                        : 'bg-slate-50 text-slate-300 cursor-not-allowed border border-slate-100'
                    }`}
                  >
                    {isSelected ? (
                      <>
                        <span>🚀 この主人公で決定し次へ ➔</span>
                      </>
                    ) : hasImage ? (
                      'このキャラを選択'
                    ) : (
                      '作画中...'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
