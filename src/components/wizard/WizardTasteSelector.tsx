import React from 'react';

interface WizardTasteSelectorProps {
  tasteMode: 'ai_auto' | 'custom_pick';
  onTasteModeChange: (mode: 'ai_auto' | 'custom_pick') => void;
  selectedCustomTastes: string[];
  onToggleTaste: (key: string) => void;
  onClearCustomTastes: () => void;
  tasteSearchQuery: string;
  onTasteSearchQueryChange: (q: string) => void;
  filteredTasteKeys: string[];
  onGenerateCandidates: () => void;
  isBrainstormingCandidates: boolean;
  activeGeneratingIndex: number | null;
}

export const WizardTasteSelector: React.FC<WizardTasteSelectorProps> = ({
  tasteMode,
  onTasteModeChange,
  selectedCustomTastes,
  onToggleTaste,
  onClearCustomTastes,
  tasteSearchQuery,
  onTasteSearchQueryChange,
  filteredTasteKeys,
  onGenerateCandidates,
  isBrainstormingCandidates,
  activeGeneratingIndex,
}) => {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-2xs">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-sm text-indigo-500">palette</span>
          画風テイストの決定方法
        </label>

        {/* Mode Switch Tabs */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
          <button
            type="button"
            onClick={() => onTasteModeChange('ai_auto')}
            className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              tasteMode === 'ai_auto'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-xs">casino</span>
            🎲 AIおまかせ (世界観最適5選)
          </button>
          <button
            type="button"
            onClick={() => onTasteModeChange('custom_pick')}
            className={`px-3 py-1 rounded-md text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              tasteMode === 'custom_pick'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span className="material-symbols-outlined text-xs">checklist</span>
            🎯 自分で画風を指定 ({selectedCustomTastes.length}/5)
          </button>
        </div>
      </div>

      {/* Custom Pick Panel */}
      {tasteMode === 'custom_pick' && (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col gap-2.5 animate-fadeIn">
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <span className="text-slate-600 font-bold">
              好きな画風を <strong>1〜5個</strong> クリックして選択してください（指定画風が候補1から順に確実に採用されます）:
            </span>
            {selectedCustomTastes.length > 0 && (
              <button
                type="button"
                onClick={onClearCustomTastes}
                className="text-[11px] text-rose-600 hover:underline font-bold cursor-pointer"
              >
                全選択解除
              </button>
            )}
          </div>

          {/* Selected Badges */}
          {selectedCustomTastes.length > 0 && (
            <div className="flex items-center flex-wrap gap-1.5 p-2 bg-white rounded-lg border border-indigo-100">
              <span className="text-[10px] font-bold text-indigo-500 mr-1">指定中:</span>
              {selectedCustomTastes.map((tKey, idx) => (
                <span
                  key={tKey}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-800 text-[11px] font-bold shadow-2xs"
                >
                  <span className="w-3.5 h-3.5 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center font-black">
                    {idx + 1}
                  </span>
                  <span className="truncate max-w-[200px]">{tKey}</span>
                  <button
                    type="button"
                    onClick={() => onToggleTaste(tKey)}
                    className="text-slate-400 hover:text-rose-600 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">close</span>
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Filter Input */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-2.5 top-2 text-slate-400 text-sm">search</span>
            <input
              type="text"
              placeholder="画風名やキーワードで絞り込み（例: レトロ、線画、アトリエ、水彩...）"
              value={tasteSearchQuery}
              onChange={e => onTasteSearchQueryChange(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-slate-800"
            />
          </div>

          {/* Tastes Chips List */}
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
            {filteredTasteKeys.map(tKey => {
              const isSelected = selectedCustomTastes.includes(tKey);
              return (
                <button
                  key={tKey}
                  type="button"
                  onClick={() => onToggleTaste(tKey)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all text-left flex items-center gap-1 cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                  }`}
                >
                  <span className="material-symbols-outlined text-xs">
                    {isSelected ? 'check_circle' : 'palette'}
                  </span>
                  <span className="truncate max-w-[240px]">{tKey}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Primary Action Button: 5組の三面図を一括AI作画 */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onGenerateCandidates}
          disabled={isBrainstormingCandidates || activeGeneratingIndex !== null}
          style={{ color: isBrainstormingCandidates || activeGeneratingIndex !== null ? '#475569' : '#ffffff' }}
          className={`w-full py-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all select-none ${
            isBrainstormingCandidates || activeGeneratingIndex !== null
              ? 'bg-slate-200 text-slate-600 border border-slate-300 shadow-none cursor-wait'
              : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:brightness-110 active:brightness-95 text-white shadow-md hover:shadow-lg cursor-pointer'
          }`}
        >
          <span className={`material-symbols-outlined text-lg ${isBrainstormingCandidates || activeGeneratingIndex !== null ? 'animate-spin' : ''}`}>
            {isBrainstormingCandidates || activeGeneratingIndex !== null ? 'autorenew' : 'palette'}
          </span>
          <span className="font-extrabold tracking-wide">
            {isBrainstormingCandidates 
              ? '最適な画風＆主人公設定をAI考案中...' 
              : activeGeneratingIndex !== null 
              ? `三面図を作画中 (${activeGeneratingIndex + 1}/5)...` 
              : tasteMode === 'custom_pick' && selectedCustomTastes.length > 0
              ? `🎨 指定した画風(${selectedCustomTastes.length}選)＋AI補完で三面図を作画！`
              : '🎨 最適画風5選＆三面図を一括AI作画！'}
          </span>
        </button>
      </div>
    </div>
  );
};
