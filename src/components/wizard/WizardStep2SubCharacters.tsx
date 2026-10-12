import React from 'react';
import { CastCharacter } from '../../types';
import { TurnaroundCandidate } from '../../services/comicWizardService';

interface WizardStep2SubCharactersProps {
  currentCandidate: TurnaroundCandidate;
  subCharacters: CastCharacter[];
  isGeneratingSubs: boolean;
  onRerollSubCharacters: () => void;
}

export const WizardStep2SubCharacters: React.FC<WizardStep2SubCharactersProps> = ({
  currentCandidate,
  subCharacters,
  isGeneratingSubs,
  onRerollSubCharacters,
}) => {
  return (
    <div className="flex flex-col gap-4 animate-fadeIn">
      {/* Guidance Box */}
      <div className="bg-gradient-to-r from-emerald-50 to-indigo-50 border border-emerald-200/80 p-3.5 rounded-xl flex items-start gap-3 text-emerald-950 shadow-2xs">
        <span className="material-symbols-outlined text-emerald-600 mt-0.5 text-xl">group</span>
        <div className="text-xs leading-relaxed">
          <p className="font-bold">主人公「{currentCandidate.name}」を取り巻くお友達・サブキャラクターを配役します。</p>
          <p className="text-emerald-700 mt-0.5">
            物語に深みを与える「頼れる相棒・親友」「ヒロイン」「宿命のライバル」をAIが自動考案しました。漫画のコマ割りや掛け合いカットで活躍します。
          </p>
        </div>
      </div>

      {/* Sub-Characters Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {subCharacters.map((sub, idx) => (
          <div key={sub.id} className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col justify-between gap-3 shadow-2xs">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  sub.role === 'partner' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {sub.role === 'partner' ? '🤝 相棒・お友達' : '⚔️ 宿敵・ライバル'}
                </span>
                <span className="text-[10px] text-slate-400">サブキャラ #{idx + 1}</span>
              </div>
              <h4 className="text-xs font-bold text-slate-900">{sub.name}</h4>
              <p className="text-[11px] text-slate-600 leading-relaxed">{sub.dnaPromptEn}</p>
            </div>

            <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-[10px] text-slate-500">
              💡 主人公「{currentCandidate.name}」と同一画風・世界観で自動作画されます
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onRerollSubCharacters}
          disabled={isGeneratingSubs}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <span className={`material-symbols-outlined text-sm ${isGeneratingSubs ? 'animate-spin' : ''}`}>
            {isGeneratingSubs ? 'autorenew' : 'shuffle'}
          </span>
          <span>サブキャラを再考案（リロール）</span>
        </button>
      </div>
    </div>
  );
};
