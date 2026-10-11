import React from 'react';
import { FieldDropdown, PillButton } from './Primitives';
import { GeneratorSettings, ProductionMode } from '../types';
import { PRODUCTION_MODES, THEMES, MV_THEMES, TRIVIA_THEMES, QUOTES_THEMES, CRAFT_THEMES, THEME_CATEGORIES, TASTES } from '../constants';
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
  onOpenCastModal?: () => void;
  onOpenComicWizard?: () => void;
  castCount?: number;
  activeSeriesManifest?: any;
  onResumeClick?: () => void;
  isLogDrawerOpen: boolean;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  settings, setSettings, isProducing, onStart, onAbort, onClear, onOpenArchive, onToggleLogs, customThemes, customTastes, onOpenThemeEditor, onOpenTasteEditor, onOpenCastModal, onOpenComicWizard, castCount = 3, activeSeriesManifest, onResumeClick, isLogDrawerOpen
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
    <header className="h-[64px] bg-white border-b border-slate-200 px-3.5 flex items-center justify-between gap-3 shrink-0 z-40 relative shadow-sm overflow-x-auto">
      {/* Left: Logo & Mode */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="flex items-center gap-1.5 text-slate-800">
          <span className="material-symbols-outlined text-amber-500 text-2xl">movie_edit</span>
          <h1 className="text-base font-black italic tracking-tighter uppercase whitespace-nowrap">Studio Pro</h1>
        </div>
        <div className="flex items-center gap-2">
          <FieldDropdown 
            label=""
            value={currentModeDef.label}
            options={PRODUCTION_MODES.map(m => m.label)}
            onChange={label => {
              const matched = PRODUCTION_MODES.find(m => m.label === label);
              if (matched) handleModeChange(matched.value);
            }}
            disabled={isProducing}
            className="w-[145px]"
          />
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-bold border border-slate-200 whitespace-nowrap">
            {currentModeDef.badge}
          </span>
        </div>
      </div>

      <div className="w-px h-7 bg-slate-200 shrink-0"></div>

      {/* ① 先頭: プロデュースボタン (大前提) */}
      {onOpenComicWizard && (
        <button 
          type="button"
          disabled={isProducing}
          onClick={onOpenComicWizard}
          className="h-10 px-3.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 hover:brightness-110 active:scale-95 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0 whitespace-nowrap"
          title="主人公三面図・配役・全話プロットを事前決定し、作品の方向性を確立（大前提設定）"
        >
          <span className="material-symbols-outlined text-[18px]">auto_stories</span>
          <span>① プロデュース</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-black">
            大前提
          </span>
        </button>
      )}

      <div className="w-px h-7 bg-slate-200 shrink-0"></div>

      {/* ② 次にお任せエリア (お任せと言いつつ今まで通り選べる) */}
      <div className="flex items-center gap-2 p-1 bg-slate-50/80 rounded-xl border border-slate-200/80 shrink-0">
        <div className="flex items-center gap-1 text-[11px] font-black text-slate-500 px-1 whitespace-nowrap">
          <span className="material-symbols-outlined text-sm text-indigo-500">casino</span>
          <span>② お任せ設定</span>
        </div>

        {/* テーマ選択 */}
        <div className="flex items-center gap-1">
          <FieldDropdown 
            label="" 
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
            className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200 flex items-center justify-center transition-colors shadow-xs cursor-pointer shrink-0"
            title="テーマ編集"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
          </button>
        </div>

        <div className="w-px h-6 bg-slate-200 shrink-0"></div>

        {/* 画風選択 */}
        <div className="flex items-center gap-1">
          {(() => {
            const tasteKeys = Object.keys(customTastes || {});
            const tasteOptions = tasteKeys.length > 0 ? tasteKeys : Object.keys(TASTES);
            return (
              <FieldDropdown 
                label="" 
                value={settings.productionMode === 'style-matrix' ? '🎨 マトリクス比較中' : (settings.selectedAssetId ? '🎨 参照画像同期中' : settings.taste)} 
                options={tasteOptions} 
                onChange={v => setSettings(s => ({ ...s, taste: v }))} 
                disabled={isProducing || settings.productionMode === 'style-matrix' || !!settings.selectedAssetId} 
                className="w-[190px]"
              />
            );
          })()}
          <button
            type="button"
            onClick={onOpenTasteEditor}
            disabled={isProducing || settings.productionMode === 'style-matrix' || !!settings.selectedAssetId}
            className="w-8 h-8 rounded-lg bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 flex items-center justify-center transition-colors disabled:opacity-40 shadow-xs cursor-pointer shrink-0"
            title="画風プロンプト編集(JSON)"
          >
            <span className="material-symbols-outlined text-[16px]">data_object</span>
          </button>
        </div>
      </div>

      <div className="w-px h-7 bg-slate-200 shrink-0"></div>

      {/* ③ 最後に作成ボタン ＆ ツール群 */}
      <div className="flex items-center gap-2 shrink-0">
        {onOpenCastModal && (
          <button 
            type="button"
            disabled={isProducing}
            onClick={onOpenCastModal}
            className="h-10 px-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300/80 flex items-center gap-1 font-bold text-xs transition-all shadow-xs active:scale-95 cursor-pointer shrink-0 whitespace-nowrap"
            title="キャスト台帳＆登場人物管理を開く"
          >
            <span className="material-symbols-outlined text-[18px] text-amber-600">theater_comedy</span>
            <span>台帳</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-amber-200 text-amber-900 font-black">
              {castCount}人
            </span>
          </button>
        )}

        {activeSeriesManifest && settings.productionMode === 'episodes' && (
          <button 
            type="button" 
            disabled={isProducing}
            onClick={onResumeClick}
            className="px-2.5 py-1.5 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-[16px]">file_open</span>
            <span>再開</span>
          </button>
        )}

        <button 
          type="button"
          onClick={onOpenArchive} 
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 shrink-0" 
          title="アーカイブ"
        >
          <span className="material-symbols-outlined text-[18px]">folder</span>
        </button>
        
        {/* ③ 作成ボタン (START PRODUCTION) */}
        {isProducing ? (
          <button 
            type="button"
            className="h-10 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider animate-pulse shadow-sm flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
            onClick={onAbort}
          >
            <span className="material-symbols-outlined text-[18px]">stop_circle</span>
            <span>中止</span>
          </button>
        ) : (
          <button 
            type="button"
            disabled={isProducing}
            onClick={onStart}
            className={`h-10 px-4.5 rounded-xl flex items-center gap-1.5 font-black text-xs uppercase tracking-wider transition-all select-none shadow-md hover:shadow-lg active:scale-95 shrink-0 whitespace-nowrap cursor-pointer ${startBtn.className}`}
            title="設定された内容（大前提またはお任せ）で作成を開始します"
          >
            <span className="material-symbols-outlined text-[18px]">{startBtn.icon}</span>
            <span>③ 作成開始</span>
          </button>
        )}

        <button 
          type="button"
          disabled={isProducing}
          onClick={onClear} 
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors border border-red-200 shrink-0" 
          title="全消去"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>

        <button 
          type="button"
          onClick={onToggleLogs} 
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors border shrink-0 ${isLogDrawerOpen ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`} 
          title="ログ表示"
        >
          <span className="material-symbols-outlined text-[18px]">subject</span>
        </button>
      </div>
    </header>
  );
};
