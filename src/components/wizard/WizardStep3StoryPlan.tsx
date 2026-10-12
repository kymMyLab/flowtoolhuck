import React from 'react';
import { ProductionMode, SeriesEpisodePlan } from '../../types';
import { TurnaroundCandidate } from '../../services/comicWizardService';

interface WizardStep3StoryPlanProps {
  currentCandidate: TurnaroundCandidate;
  currentModeConfig: any;
  productionMode: ProductionMode;
  episodeCount: number;
  onEpisodeCountChange: (count: number) => void;
  cutsPerEpisode: number;
  onCutsPerEpisodeChange: (cuts: number) => void;
  seriesTitle: string;
  overallSynopsis: string;
  episodesPlan: SeriesEpisodePlan[];
  displayedEpisodes: SeriesEpisodePlan[];
  isGeneratingPlan: boolean;
  onGenerateStoryPlan: () => void;
}

export const WizardStep3StoryPlan: React.FC<WizardStep3StoryPlanProps> = ({
  currentCandidate,
  currentModeConfig,
  productionMode,
  episodeCount,
  onEpisodeCountChange,
  cutsPerEpisode,
  onCutsPerEpisodeChange,
  seriesTitle,
  overallSynopsis,
  episodesPlan,
  displayedEpisodes,
  isGeneratingPlan,
  onGenerateStoryPlan,
}) => {
  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      {/* Volume & Cuts Guidance */}
      <div className="bg-amber-50/70 border border-amber-200/80 p-3.5 rounded-xl flex items-start gap-3 text-amber-950 shadow-2xs">
        <span className="material-symbols-outlined text-amber-600 mt-0.5 text-xl">tune</span>
        <div className="text-xs leading-relaxed">
          <p className="font-bold">【{currentModeConfig.label}】制作ボリューム（{currentModeConfig.unit}数・カット数）を設定し、全体の構成プロットを確定します。</p>
          <p className="text-amber-800 mt-0.5">
            大枠「{currentModeConfig.label}」に沿った演出・テロップ（{currentModeConfig.telopNote}）で制作されます。
          </p>
        </div>
      </div>

      {/* Episode & Cut Sliders */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-2.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-indigo-500">format_list_numbered</span>
              制作ボリューム ({currentModeConfig.unit}数)
            </label>
            <span className="text-xs font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-200">
              全 {episodeCount} {currentModeConfig.unit}
            </span>
          </div>
          <input
            type="range"
            min="1"
            max="50"
            value={episodeCount}
            onChange={e => onEpisodeCountChange(Number(e.target.value))}
            className="w-full accent-indigo-600 cursor-pointer"
          />
          <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold px-0.5">
            <button type="button" onClick={() => onEpisodeCountChange(1)} className={`hover:text-indigo-600 transition-colors cursor-pointer ${episodeCount === 1 ? 'text-indigo-600 font-black underline' : ''}`}>1{currentModeConfig.unit} {productionMode === 'mv' ? '(単曲)' : '(読切)'}</button>
            <button type="button" onClick={() => onEpisodeCountChange(2)} className={`hover:text-indigo-600 transition-colors cursor-pointer ${episodeCount === 2 ? 'text-indigo-600 font-black underline' : ''}`}>2{currentModeConfig.unit}</button>
            <button type="button" onClick={() => onEpisodeCountChange(4)} className={`hover:text-indigo-600 transition-colors cursor-pointer ${episodeCount === 4 ? 'text-indigo-600 font-black underline' : ''}`}>4{currentModeConfig.unit} {productionMode === 'mv' ? '(EP盤)' : '(起承転結)'}</button>
            <button type="button" onClick={() => onEpisodeCountChange(10)} className={`hover:text-indigo-600 transition-colors cursor-pointer ${episodeCount === 10 ? 'text-indigo-600 font-black underline' : ''}`}>10{currentModeConfig.unit}</button>
            <button type="button" onClick={() => onEpisodeCountChange(20)} className={`hover:text-indigo-600 transition-colors cursor-pointer ${episodeCount === 20 ? 'text-indigo-600 font-black underline' : ''}`}>20{currentModeConfig.unit}</button>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-2.5 shadow-2xs">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm text-purple-500">movie</span>
              1{currentModeConfig.unit}あたりの作画カット数
            </label>
            <span className="text-xs font-extrabold text-purple-600 bg-purple-50 px-2.5 py-0.5 rounded-full border border-purple-200">
              {cutsPerEpisode} Cut
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {[5, 12, 24, 30].map(cnt => (
              <button
                key={cnt}
                type="button"
                onClick={() => onCutsPerEpisodeChange(cnt)}
                className={`py-2 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
                  cutsPerEpisode === cnt
                    ? 'bg-purple-600 text-white border-purple-600 shadow-2xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                {cnt} Cut {cnt === (productionMode === 'mv' ? 12 : 30) ? '★' : ''}
              </button>
            ))}
          </div>
          <span className="text-[10px] text-slate-500 leading-tight">
            ※ 大枠「{currentModeConfig.label}」の推奨カット数に合わせて設定できます。
          </span>
        </div>
      </div>

      {/* Series Plot Container */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-2xs">
        <div className="flex items-center justify-between flex-wrap gap-2 min-h-[36px]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-500 text-sm">history_edu</span>
            <h4 className="text-xs font-bold text-slate-800">
              シリーズ構成プロット {episodesPlan.length > 0 ? `(全 ${episodeCount} ${currentModeConfig.unit}構成 / ${displayedEpisodes.length}${currentModeConfig.unit}表示)` : `(全 ${episodeCount} ${currentModeConfig.unit}設定中)`}
            </h4>
          </div>

          {episodesPlan.length > 0 && (
            <button
              type="button"
              onClick={onGenerateStoryPlan}
              disabled={isGeneratingPlan}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer"
            >
              <span className={`material-symbols-outlined text-[15px] ${isGeneratingPlan ? 'animate-spin' : ''}`}>
                {isGeneratingPlan ? 'autorenew' : 'refresh'}
              </span>
              <span>
                {isGeneratingPlan ? '再構築中...' : `🔄 全${episodeCount}${currentModeConfig.unit}でプロット再生成`}
              </span>
            </button>
          )}
        </div>

        {/* 話数変更時のリマインダー */}
        {episodesPlan.length > 0 && episodesPlan.length !== episodeCount && (
          <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between text-xs text-amber-800">
            <span className="flex items-center gap-1.5 font-bold">
              <span className="material-symbols-outlined text-amber-600 text-sm">warning</span>
              設定が【全 {episodeCount} {currentModeConfig.unit}】に変更されました。最新プロットを反映するには右上の「再生成」を押してください。
            </span>
          </div>
        )}

        {seriesTitle && (
          <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex flex-col gap-1">
            <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">確定タイトル</span>
            <h3 className="text-sm font-black text-slate-900">『{seriesTitle}』</h3>
            {overallSynopsis && (
              <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{overallSynopsis}</p>
            )}
          </div>
        )}

        {/* Episodes Plan List or Placeholder Guide */}
        {episodesPlan.length === 0 ? (
          <div className="py-8 px-4 bg-slate-50 border border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center text-center gap-3">
            <span className="material-symbols-outlined text-4xl text-indigo-500">history_edu</span>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-bold text-slate-800">プロットはまだ生成されていません</p>
              <p className="text-xs text-slate-500 max-w-md">
                上の設定で<strong>ボリューム（全{episodeCount}{currentModeConfig.unit}）</strong>と<strong>作画カット数（{cutsPerEpisode}Cut）</strong>を決めた後、下のボタンを押してください。
              </p>
            </div>
            <button
              type="button"
              onClick={onGenerateStoryPlan}
              disabled={isGeneratingPlan}
              style={{
                backgroundColor: '#4f46e5',
                color: '#ffffff'
              }}
              className="mt-1 px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <span className={`material-symbols-outlined text-base ${isGeneratingPlan ? 'animate-spin' : ''}`}>
                {isGeneratingPlan ? 'autorenew' : 'auto_awesome'}
              </span>
              <span>
                {isGeneratingPlan 
                  ? 'AIが全話プロットを構築中...' 
                  : `✨ 全${episodeCount}${currentModeConfig.unit}のプロットをAI生成する`}
              </span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {displayedEpisodes.map((ep) => (
              <div key={ep.epNumber} className="p-2.5 bg-slate-50 hover:bg-slate-100/80 rounded-lg border border-slate-200/80 flex items-start gap-2.5 transition-colors">
                <span className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10px] font-black shrink-0 mt-0.5">
                  第 {ep.epNumber} 話
                </span>
                <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                  <span className="text-xs font-bold text-slate-800">{ep.titleJp}</span>
                  <p className="text-[11px] text-slate-500 leading-snug line-clamp-1">{ep.summary}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
