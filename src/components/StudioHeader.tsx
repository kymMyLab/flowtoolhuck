import React from 'react';
import { FieldDropdown, FieldDropdownOption } from './Primitives';
import { GeneratorSettings, ProductionMode } from '../types';
import { PRODUCTION_MODES, THEMES, MV_THEMES, TRIVIA_THEMES, QUOTES_THEMES, CRAFT_THEMES, THEME_CATEGORIES, TASTES } from '../constants';

interface StudioHeaderProps {
  settings: GeneratorSettings;
  setSettings: React.Dispatch<React.SetStateAction<GeneratorSettings>>;
  isProducing: boolean;
  onStart: () => void;
  onAbort: () => void;
  activeSeriesManifest?: any;
  onResumeClick?: () => void;
  isWaitingForStart?: boolean;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  settings, setSettings, isProducing, onStart, onAbort, activeSeriesManifest, onResumeClick, isWaitingForStart = false
}) => {
  const availableModes = PRODUCTION_MODES.filter(m => m.value !== 'style-matrix');
  const currentModeDef = availableModes.find(m => m.value === settings.productionMode) || availableModes[0];

  const handleModeChange = (modeVal: string) => {
    const matched = availableModes.find(m => m.label === modeVal || m.value === modeVal);
    const mode = (matched ? matched.value : modeVal) as ProductionMode;
    let defaultTheme = THEMES[0];
    if (mode === 'mv') defaultTheme = MV_THEMES[0];
    else if (mode === 'trivia') defaultTheme = TRIVIA_THEMES[0];
    else if (mode === 'quotes') defaultTheme = QUOTES_THEMES[0];
    else if (mode === 'craft') defaultTheme = CRAFT_THEMES[0];

    setSettings(s => ({
      ...s,
      productionMode: mode,
      isMvMode: mode === 'mv',
      theme: defaultTheme,
      era: defaultTheme,
    }));
  };

  const getThemeConfig = () => {
    switch (settings.productionMode) {
      case 'mv': return { options: MV_THEMES, groups: undefined };
      case 'trivia': return { options: TRIVIA_THEMES, groups: undefined };
      case 'quotes': return { options: QUOTES_THEMES, groups: undefined };
      case 'craft': return { options: CRAFT_THEMES, groups: undefined };
      default: return { options: undefined, groups: THEME_CATEGORIES.map(c => ({ label: c.category, items: c.items })) };
    }
  };

  const themeConfig = getThemeConfig();

  const tasteOptions: FieldDropdownOption[] = React.useMemo(() => {
    return Object.keys(TASTES).map(k => ({
      value: k,
      label: k.split(' (')[0],
      sublabel: k.split(' (')[1]?.replace(')', '')
    }));
  }, []);

  return (
    <header className="bg-white border-b border-slate-200 px-3 py-2 flex items-center justify-between gap-2 shrink-0 z-40 relative shadow-sm flex-wrap">
      {/* 左側: ロゴ & ざっくり設定（モード・テーマ・画風） */}
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <div className="flex items-center gap-1.5 shrink-0 text-slate-800">
          <span className="material-symbols-outlined text-amber-500 text-xl">movie_edit</span>
          <h1 className="text-sm font-black italic tracking-tighter uppercase whitespace-nowrap">Studio Pro</h1>
        </div>

        <div className="flex items-center gap-1.5 p-1 bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-emerald-50/80 rounded-xl border border-emerald-300/80 shadow-2xs shrink-0 flex-wrap">
          {/* 制作モード */}
          <FieldDropdown 
            label=""
            value={currentModeDef.label}
            options={availableModes.map(m => m.label)}
            onChange={label => {
              const matched = availableModes.find(m => m.label === label);
              if (matched) handleModeChange(matched.value);
            }}
            disabled={isProducing}
            className="w-[120px]"
          />

          <div className="w-px h-5 bg-emerald-200/90 shrink-0" />

          {/* テーマ選択 */}
          <FieldDropdown 
            label="" 
            value={settings.theme} 
            options={themeConfig.options}
            groups={themeConfig.groups}
            onChange={v => setSettings(s => ({ ...s, theme: v, era: v }))} 
            disabled={isProducing} 
            className="w-[175px]"
          />

          <div className="w-px h-5 bg-emerald-200/90 shrink-0" />

          {/* 画風選択 */}
          <FieldDropdown 
            label="" 
            value={settings.taste} 
            options={tasteOptions} 
            onChange={v => setSettings(s => ({ ...s, taste: v }))} 
            disabled={isProducing} 
            className="w-[195px]"
          />
        </div>
      </div>

      {/* 右側: 作成開始 / 中止 ボタン */}
      <div className="flex items-center gap-2 shrink-0">
        {isProducing ? (
          <button 
            type="button"
            className="h-9 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider animate-pulse shadow-md flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
            onClick={() => onAbort()}
          >
            <span className="material-symbols-outlined text-[18px]">stop_circle</span>
            <span>中止</span>
          </button>
        ) : (
          <button 
            type="button"
            disabled={isProducing}
            onClick={() => onStart()}
            className={`h-9 px-4 rounded-xl flex items-center gap-1.5 font-black text-xs uppercase tracking-wider transition-all select-none cursor-pointer shrink-0 whitespace-nowrap relative ${
              isWaitingForStart
                ? 'ring-4 ring-pink-400 ring-offset-2 animate-pulse shadow-[0_0_25px_rgba(236,72,153,0.8)] brightness-110 !bg-gradient-to-r !from-indigo-600 !via-purple-600 !to-pink-600 text-white hover:brightness-125 hover:scale-105 active:scale-95'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg active:scale-95'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {isWaitingForStart ? 'play_arrow' : 'movie_edit'}
            </span>
            <span>作成開始</span>
          </button>
        )}

        {activeSeriesManifest && (
          <button 
            type="button" 
            disabled={isProducing}
            onClick={onResumeClick}
            className="h-9 px-2.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap cursor-pointer shadow-2xs"
            title="中断した連載制作を再開"
          >
            <span className="material-symbols-outlined text-[16px]">file_open</span>
            <span>再開</span>
          </button>
        )}
      </div>
    </header>
  );
};
