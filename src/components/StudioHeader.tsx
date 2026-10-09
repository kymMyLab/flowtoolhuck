import React from 'react';
import { FieldDropdown, PillButton } from './Primitives';
import { GeneratorSettings, ProductionMode } from '../types';
import { PRODUCTION_MODES, THEMES, MV_THEMES, TRIVIA_THEMES, QUOTES_THEMES, CRAFT_THEMES, THEME_CATEGORIES } from '../constants';
import { CustomThemeMap } from '../services/themeStorage';

interface StudioHeaderProps {
  settings: GeneratorSettings;
  setSettings: React.Dispatch<React.SetStateAction<GeneratorSettings>>;
  isProducing: boolean;
  onStart: () => void;
  onAbort: () => void;
  onClear: () => void;
  onOpenArchive: () => void;
  onToggleLogs: () => void;
  customThemes: CustomThemeMap;
  customTastes: Record<string, any>;
  onOpenThemeEditor: () => void;
  onOpenTasteEditor: () => void;
  activeSeriesManifest?: any;
  onResumeClick?: () => void;
  isLogDrawerOpen: boolean;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  settings, setSettings, isProducing, onStart, onAbort, onClear, onOpenArchive, onToggleLogs, customThemes, customTastes, onOpenThemeEditor, onOpenTasteEditor, activeSeriesManifest, onResumeClick, isLogDrawerOpen
}) => {
  const currentModeDef = PRODUCTION_MODES.find(m => m.value === settings.productionMode) || PRODUCTION_MODES[0];

  const handleModeChange = (modeVal: string) => {
    const matched = PRODUCTION_MODES.find(m => m.label === modeVal || m.value === modeVal);
    const mode = (matched ? matched.value : modeVal) as ProductionMode;
    const modeList = customThemes[mode] || [];
    let defaultTheme = modeList[0] || THEMES[0];

    setSettings(s => ({
      ...s,
      productionMode: mode,
      isMvMode: mode === 'mv',
      episodeCount: mode === 'style-matrix'
        ? ([3, 5, 8, 10].includes(s.episodeCount) ? s.episodeCount : 3)
        : ([1, 5, 10, 20, 50].includes(s.episodeCount) ? s.episodeCount : 1),
      theme: defaultTheme,
      era: defaultTheme,
    }));
  };

  const getThemeConfig = () => {
    const modeList = customThemes[settings.productionMode];
    switch (settings.productionMode) {
      case 'mv': return { options: modeList || MV_THEMES, groups: undefined, label: `MV世界観 (${(modeList || MV_THEMES).length}選)` };
      case 'trivia': return { options: modeList || TRIVIA_THEMES, groups: undefined, label: `💡 雑学 (${(modeList || TRIVIA_THEMES).length}選)` };
      case 'quotes': return { options: modeList || QUOTES_THEMES, groups: undefined, label: `📜 偉人名言 (${(modeList || QUOTES_THEMES).length}選)` };
      case 'craft': return { options: modeList || CRAFT_THEMES, groups: undefined, label: `🏯 職人技巧 (${(modeList || CRAFT_THEMES).length}選)` };
      default: return { options: undefined, groups: THEME_CATEGORIES.map(c => ({ label: c.category, items: c.items })), label: '世界観・テーマ' };
    }
  };

  const themeConfig = getThemeConfig();

  const getStartButtonConfig = () => {
    switch (settings.productionMode) {
      case 'mv':
        return { className: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm', icon: 'music_note', label: 'MV生成開始' };
      case 'style-matrix':
        return { className: 'bg-pink-600 hover:bg-pink-700 text-white shadow-sm', icon: 'auto_awesome_mosaic', label: 'マトリクス生成' };
      case 'trivia':
      case 'quotes':
      case 'folklore':
      case 'craft':
        return { className: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm', icon: 'smart_toy', label: '自動生成開始' };
      default:
        return { className: 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm', icon: 'movie_edit', label: 'ドラマ生成開始' };
    }
  };
  const startBtn = getStartButtonConfig();

  return (
    <header className="h-[64px] bg-white border-b border-slate-200 px-4 flex items-center justify-between shrink-0 z-40 relative shadow-sm">
      {/* Left: Logo & Mode */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-slate-800">
          <span className="material-symbols-outlined text-amber-500">movie_edit</span>
          <h1 className="text-lg font-black italic tracking-tighter uppercase">Studio Pro</h1>
        </div>
        <div className="flex items-center gap-3">
          <FieldDropdown 
            label=""
            value={currentModeDef.label}
            options={PRODUCTION_MODES.map(m => m.label)}
            onChange={label => {
              const matched = PRODUCTION_MODES.find(m => m.label === label);
              if (matched) handleModeChange(matched.value);
            }}
            disabled={isProducing}
            className="w-[180px]"
          />
          <div className="flex flex-col min-w-0">
             <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200 inline-block">
               {currentModeDef.badge}
             </span>
          </div>
        </div>
      </div>

      {/* Center: Themes & Tastes */}
      <div className="flex items-center gap-4 flex-1 justify-center px-4">
        <div className="flex items-center gap-2">
          <FieldDropdown 
            label={themeConfig.label} 
            value={settings.theme} 
            options={themeConfig.options}
            groups={themeConfig.groups}
            onChange={v => setSettings(s => ({ ...s, theme: v, era: v }))} 
            disabled={isProducing} 
            className="w-[200px]"
          />
          <button
            type="button"
            onClick={onOpenThemeEditor}
            disabled={isProducing}
            className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200 flex items-center justify-center transition-colors"
            title="テーマ編集"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
          </button>
        </div>
        <div className="w-px h-8 bg-slate-200 mx-2"></div>
        <div className="flex items-center gap-2">
          <FieldDropdown 
            label="画風・テイスト" 
            value={settings.productionMode === 'style-matrix' ? '🎨 マトリクス比較中' : (settings.selectedAssetId ? '🎨 参照画像同期中' : settings.taste)} 
            options={Object.keys(customTastes)} 
            onChange={v => setSettings(s => ({ ...s, taste: v }))} 
            disabled={isProducing || settings.productionMode === 'style-matrix' || !!settings.selectedAssetId} 
            className="w-[180px]"
          />
          <button
            type="button"
            onClick={onOpenTasteEditor}
            disabled={isProducing || settings.productionMode === 'style-matrix' || !!settings.selectedAssetId}
            className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 hover:bg-purple-100 border border-purple-200 flex items-center justify-center transition-colors disabled:opacity-40"
            title="画風プロンプト編集(JSON)"
          >
            <span className="material-symbols-outlined text-[16px]">data_object</span>
          </button>
        </div>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {activeSeriesManifest && settings.productionMode === 'episodes' && (
          <button 
            type="button" 
            disabled={isProducing}
            onClick={onResumeClick}
            className="px-3 py-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">file_open</span>
            レジューム ({activeSeriesManifest.completedEpisodeIds?.length || 0}/{activeSeriesManifest.totalEpisodes})
          </button>
        )}
        <button 
          type="button"
          onClick={onOpenArchive} 
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200" 
          title="アーカイブ"
        >
          <span className="material-symbols-outlined text-[20px]">folder</span>
        </button>
        
        {isProducing ? (
          <button 
            type="button"
            className="h-10 px-6 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-sm uppercase tracking-widest animate-pulse shadow-sm flex items-center gap-2"
            onClick={onAbort}
          >
            <span className="material-symbols-outlined text-[20px]">stop_circle</span>
            Abort
          </button>
        ) : (
          <button 
            type="button"
            disabled={isProducing}
            onClick={onStart}
            className={`h-10 px-6 rounded-xl flex items-center gap-2 font-black text-sm uppercase tracking-wider transition-all select-none shadow-sm active:scale-95 ${startBtn.className}`}
          >
            <span className="material-symbols-outlined text-[20px]">{startBtn.icon}</span>
            {startBtn.label}
          </button>
        )}

        <button 
          type="button"
          disabled={isProducing}
          onClick={onClear} 
          className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors border border-red-200" 
          title="全消去"
        >
          <span className="material-symbols-outlined text-[20px]">delete</span>
        </button>
        <div className="w-px h-8 bg-slate-200 mx-1"></div>
        <button 
          type="button"
          onClick={onToggleLogs} 
          className={`w-10 h-10 flex items-center justify-center rounded-xl transition-colors border ${isLogDrawerOpen ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`} 
          title="ログ表示"
        >
          <span className="material-symbols-outlined text-[20px]">subject</span>
        </button>
      </div>
    </header>
  );
};
