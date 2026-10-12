import React from 'react';
import { TurnaroundCandidate } from '../../services/comicWizardService';
import { SeriesEpisodePlan } from '../../types';

interface WizardFooterProps {
  step: 1 | 2 | 3;
  onSetStep: (step: 1 | 2 | 3 | ((prev: 1 | 2 | 3) => 1 | 2 | 3)) => void;
  currentCandidate: TurnaroundCandidate | null;
  episodeCount: number;
  cutsPerEpisode: number;
  episodesPlan: SeriesEpisodePlan[];
  isGeneratingSubs: boolean;
  isGeneratingPlan: boolean;
  onProceedToStep2: () => void;
  onProceedToStep3: () => void;
  onLaunch: () => void;
}

export const WizardFooter: React.FC<WizardFooterProps> = ({
  step,
  onSetStep,
  currentCandidate,
  episodeCount,
  cutsPerEpisode,
  episodesPlan,
  isGeneratingSubs,
  isGeneratingPlan,
  onProceedToStep2,
  onProceedToStep3,
  onLaunch,
}) => {
  return (
    <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 shadow-lg z-20">
      {/* Left Info / Back Button */}
      <div>
        {step === 1 ? (
          currentCandidate && currentCandidate.turnaroundBase64 ? (
            <div className="flex items-center gap-3">
              <img
                src={`data:image/png;base64,${currentCandidate.turnaroundBase64}`}
                alt="Current"
                className="w-12 h-8 object-cover rounded border border-indigo-200 shrink-0"
              />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>選択中:</span>
                  <span className="text-indigo-600 font-extrabold">{currentCandidate.name}</span>
                </span>
                <span className="text-[11px] text-slate-500 truncate max-w-xs">{currentCandidate.tasteName}</span>
              </div>
            </div>
          ) : (
            <span className="text-xs text-slate-400 font-medium">三面図を作画し、お気に入りのキャラクターを選んでください</span>
          )
        ) : (
          <button
            type="button"
            onClick={() => onSetStep(prev => Math.max(1, prev - 1) as any)}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>戻る</span>
          </button>
        )}
      </div>

      {/* Right Primary Action Button */}
      <div>
        {step === 1 && (
          <button
            type="button"
            onClick={onProceedToStep2}
            disabled={!currentCandidate || !currentCandidate.turnaroundBase64}
            style={{
              color: !currentCandidate || !currentCandidate.turnaroundBase64 ? '#94a3b8' : '#ffffff'
            }}
            className={`px-6 py-2.5 rounded-xl text-xs font-black flex items-center gap-2 transition-all select-none ${
              !currentCandidate || !currentCandidate.turnaroundBase64
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:brightness-110 active:brightness-95 text-white shadow-md hover:shadow-lg cursor-pointer transform hover:scale-102'
            }`}
          >
            <span>この主人公で決定し、お友達・サブキャラ配役へ</span>
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        )}

        {step === 2 && (
          <button
            type="button"
            onClick={onProceedToStep3}
            disabled={isGeneratingSubs}
            style={{
              color: isGeneratingSubs ? '#94a3b8' : '#ffffff'
            }}
            className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all select-none ${
              isGeneratingSubs
                ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:brightness-110 active:brightness-95 text-white shadow-md hover:shadow-lg cursor-pointer'
            }`}
          >
            <span>次へ：全話プロット構築＆連載設定</span>
            <span className="material-symbols-outlined text-base">arrow_forward</span>
          </button>
        )}

        {step === 3 && (
          <div className="flex flex-col items-end gap-1.5">
            <button
              type="button"
              onClick={onLaunch}
              disabled={isGeneratingPlan || episodesPlan.length === 0}
              style={{
                color: isGeneratingPlan || episodesPlan.length === 0 ? '#94a3b8' : '#ffffff'
              }}
              className={`px-7 py-3 rounded-xl text-xs font-black flex items-center gap-2 transition-all select-none ${
                isGeneratingPlan || episodesPlan.length === 0
                  ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed shadow-none'
                  : 'bg-gradient-to-r from-emerald-600 via-indigo-600 to-purple-600 hover:brightness-110 active:brightness-95 text-white shadow-lg hover:shadow-xl cursor-pointer transform hover:scale-102'
              }`}
              title={episodesPlan.length === 0 ? '先にプロットをAI生成してください' : '大前提プロデュース設定を確定して画面を閉じます'}
            >
              <span className="material-symbols-outlined text-lg">check_circle</span>
              <span>
                {episodesPlan.length === 0
                  ? `⚠️ 先にプロットを生成してください（${cutsPerEpisode}Cut × 全${episodeCount}話）`
                  : `✅ この設定を大前提として確定する（全${episodeCount}話 × ${cutsPerEpisode}Cut）`}
              </span>
            </button>
            {episodesPlan.length > 0 && (
              <span className="text-[10px] text-slate-500 font-medium">
                ※ 確定するとモーダルが閉じます。サイドバーでアスペクト比や動画化を確認後、【③ 作成開始】を押してください。
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
