import React from 'react';
import { THEME_CATEGORIES } from '../../constants';

interface WizardThemeSelectorProps {
  currentModeConfig: { label: string; themeLabel?: string; themes?: string[]; [key: string]: any };
  selectedTheme: string;
  onThemeChange: (theme: string) => void;
  selectedThemeCategory: string;
  onThemeCategoryChange: (cat: string) => void;
  onRandomTheme: () => void;
}

export const WizardThemeSelector: React.FC<WizardThemeSelectorProps> = ({
  currentModeConfig,
  selectedTheme,
  onThemeChange,
  selectedThemeCategory,
  onThemeCategoryChange,
  onRandomTheme,
}) => {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-2xs">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-amber-500">public</span>
            {currentModeConfig.themeLabel || '世界観・テーマ'} ({currentModeConfig.label})
          </label>
          <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60 font-semibold">
            ※ 選択した世界観から全話・全トラックの大河連載を展開可能
          </span>
        </div>
        <button
          type="button"
          onClick={onRandomTheme}
          className="px-3 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-sm">casino</span>
          🎲 ランダムに選定
        </button>
      </div>

      {/* ジャンル区切りフィルタ・タブ */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
        {(!currentModeConfig.themes || currentModeConfig.themes.length === 0) ? (
          THEME_CATEGORIES.map((cat, idx) => {
            const isSelected = selectedThemeCategory === cat.category;
            const shortLabel = cat.category.split('・')[0] || cat.category;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onThemeCategoryChange(cat.category)}
                className={`px-2 py-1 rounded-lg text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                }`}
                title={cat.category}
              >
                {shortLabel} ({cat.items.length})
              </button>
            );
          })
        ) : (
          <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-200 flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
            {currentModeConfig.label} に特化した厳選テーマ（全{currentModeConfig.themes.length}選）
          </span>
        )}
      </div>

      {/* 世界観ドロップダウン（モード固有テーマ または カテゴリ別テーマ） */}
      <div className="flex items-center gap-3">
        <select
          value={selectedTheme}
          onChange={e => onThemeChange(e.target.value)}
          className="flex-1 px-3 py-2.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-slate-900 font-bold leading-relaxed cursor-pointer"
        >
          {currentModeConfig.themes && currentModeConfig.themes.length > 0 ? (
            <optgroup label={`━━━ ${currentModeConfig.label} 厳選テーマ一覧 ━━━`} className="font-extrabold text-indigo-900 bg-slate-100 py-1">
              {currentModeConfig.themes.map((themeItem, idx) => (
                <option key={idx} value={themeItem} className="text-slate-800 bg-white font-medium py-1">
                  {themeItem}
                </option>
              ))}
            </optgroup>
          ) : (
            THEME_CATEGORIES.filter(c => selectedThemeCategory === 'all' || selectedThemeCategory === c.category).map((cat, cIdx) => (
              <optgroup key={cIdx} label={`━━━ ${cat.category} ━━━`} className="font-extrabold text-indigo-900 bg-slate-100 py-1">
                {cat.items.map((themeItem, idx) => (
                  <option key={idx} value={themeItem} className="text-slate-800 bg-white font-medium py-1">
                    {themeItem}
                  </option>
                ))}
              </optgroup>
            ))
          )}
        </select>
      </div>
    </div>
  );
};
