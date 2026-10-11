import React from 'react';
import { MangaStoryConcept } from '../../types';

interface CastBrainstormModalProps {
  concepts: MangaStoryConcept[] | null;
  currentTaste?: string;
  onSelectConcept: (concept: MangaStoryConcept) => void;
  onClose: () => void;
}

export const CastBrainstormModal: React.FC<CastBrainstormModalProps> = ({
  concepts,
  currentTaste,
  onSelectConcept,
  onClose,
}) => {
  if (!concepts) return null;

  return (
    <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 to-indigo-950 text-white shrink-0">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 material-symbols-outlined text-2xl">
              casino
            </span>
            <div>
              <h3 className="text-base font-bold flex items-center gap-2">
                <span>AIが発案した物語企画・世界観（10選）</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/30 text-amber-300 font-semibold border border-amber-400/40">
                  1話完結・短編マンガ
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                お好きな企画を1つ選ぶと、タイトル・あらすじ・主要キャスト3名がキャスト台帳に自動配役されます。
                {currentTaste && <span className="ml-2 text-amber-300 font-semibold">（対象画風: {currentTaste}）</span>}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Concepts Grid Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50">
          {concepts.map((concept, idx) => (
            <div 
              key={concept.id || idx}
              className="bg-white border border-slate-200/90 rounded-xl p-4 flex flex-col justify-between hover:border-indigo-400 hover:shadow-md transition-all group"
            >
              <div className="flex flex-col gap-2">
                {/* Genre & Title */}
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                    {concept.genre}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">PLAN #{idx + 1}</span>
                </div>

                <h4 className="text-sm font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  {concept.title}
                </h4>

                <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  {concept.logline}
                </p>

                {/* Characters List */}
                <div className="flex flex-col gap-1.5 mt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">配役キャスト (3名)</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {concept.characters.map((c, cIdx) => {
                      const roleBadge = 
                        c.role === 'protagonist' ? 'bg-amber-100 text-amber-800' :
                        c.role === 'partner' ? 'bg-indigo-100 text-indigo-800' : 'bg-rose-100 text-rose-800';
                      const roleName = 
                        c.role === 'protagonist' ? '主人公' :
                        c.role === 'partner' ? '相棒' : '宿敵';

                      return (
                        <div key={cIdx} className="bg-slate-50 p-1.5 rounded border border-slate-200/70 flex flex-col gap-0.5">
                          <span className={`text-[9px] px-1 py-0.2 rounded font-bold self-start ${roleBadge}`}>
                            {roleName}
                          </span>
                          <span className="text-[11px] font-bold text-slate-800 truncate" title={c.name}>
                            {c.name}
                          </span>
                          <span className="text-[9px] text-slate-500 line-clamp-2 leading-tight" title={c.concept}>
                            {c.concept}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Select Button */}
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-end">
                <button
                  onClick={() => onSelectConcept(concept)}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-amber-600 hover:from-indigo-700 hover:to-amber-700 text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all"
                >
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  <span>この企画を採用（キャスト自動配役）</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-200 bg-white flex items-center justify-between shrink-0">
          <span className="text-xs text-slate-500">
            気に入った企画がない場合は、もう一度「🎲 物語企画をAI発案」を押すと別の10選を即座に再ブレストします。
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-colors"
          >
            キャンセル
          </button>
        </div>

      </div>
    </div>
  );
};
