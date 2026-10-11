import React, { useRef } from 'react';
import { FieldDropdown, PillButton } from './Primitives';
import { GeneratorSettings, ProductionMode } from '../types';
import { PRODUCTION_MODES, THEMES, MV_THEMES, TRIVIA_THEMES, QUOTES_THEMES, CRAFT_THEMES, THEME_CATEGORIES, TASTES } from '../constants';
import { CustomThemeMap } from '../services/themeStorage';
import { exportProjectJson, importProjectJson, loadMangaProject, saveMangaProject } from '../services/castStorage';

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
  const jsonFileInputRef = useRef<HTMLInputElement>(null);

  const handleExportJson = () => {
    try {
      const proj = loadMangaProject();
      exportProjectJson(proj);
    } catch (e) {
      console.error('Failed to export JSON', e);
    }
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const proj = await importProjectJson(file);
      saveMangaProject(proj);
      alert(`✅ プロジェクト設定・キャスト（${proj.characters?.length || 0}人）を正常に復元しました！`);
      window.location.reload();
    } catch (err: any) {
      alert(`❌ JSON復元エラー: ${err?.message || err}`);
    } finally {
      if (e.target) e.target.value = '';
    }
  };
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
        : ([1, 2, 4, 5, 10, 20, 50].includes(s.episodeCount) ? s.episodeCount : s.episodeCount || 1),
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
    <header className="h-[64px] bg-white border-b border-slate-200 px-3.5 flex items-center justify-between gap-3 shrink-0 z-40 relative shadow-sm">
      {/* Left: Logo */}
      <div className="flex items-center gap-2 shrink-0 text-slate-800">
        <span className="material-symbols-outlined text-amber-500 text-2xl">movie_edit</span>
        <h1 className="text-base font-black italic tracking-tighter uppercase whitespace-nowrap">Studio Pro</h1>
      </div>

      <div className="w-px h-7 bg-slate-200 shrink-0"></div>

      {/* ① 先頭: プロデュースボタン (大前提) */}
      {onOpenComicWizard && (
        <button 
          type="button"
          disabled={isProducing}
          onClick={onOpenComicWizard}
          className={`h-10 px-3.5 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0 whitespace-nowrap active:scale-95 ${
            activeSeriesManifest 
              ? 'bg-gradient-to-r from-purple-700 via-indigo-600 to-emerald-600 text-white ring-2 ring-purple-400/50'
              : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 hover:brightness-110 text-white'
          }`}
          title={
            activeSeriesManifest
              ? `大前提プロデュース設定済: 『${activeSeriesManifest.seriesTitle || '連載'}』(クリックで再編集)`
              : '主人公三面図・配役・全話プロットを事前決定し、作品の方向性を確立（大前提設定）'
          }
        >
          <span className="material-symbols-outlined text-[18px]">
            {activeSeriesManifest ? 'verified' : 'auto_stories'}
          </span>
          <span>① プロデュース</span>
          <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
            activeSeriesManifest ? 'bg-emerald-400 text-emerald-950' : 'bg-white/20 text-white'
          }`}>
            {activeSeriesManifest ? '大前提: 確定済 ✓' : '大前提'}
          </span>
        </button>
      )}

      <div className="w-px h-7 bg-slate-200 shrink-0"></div>

      {/* ② 次にざっくり設定エリア (モード・テーマ・画風を今まで通り自由に選べる) */}
      <div className="flex items-center gap-2 p-1 bg-gradient-to-r from-emerald-50 via-teal-50 to-emerald-50 rounded-xl border border-emerald-300/90 shadow-2xs shrink-0">
        <div className="flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-100/90 px-2 py-1 rounded-lg border border-emerald-300/80 whitespace-nowrap shadow-2xs">
          <span className="material-symbols-outlined text-sm text-emerald-600">tune</span>
          <span>② ざっくり設定</span>
        </div>

        {/* 制作モード（ドラマ連番など） */}
        <div className="flex items-center gap-1.5">
          <FieldDropdown 
            label=""
            value={currentModeDef.label}
            options={PRODUCTION_MODES.map(m => m.label)}
            onChange={label => {
              const matched = PRODUCTION_MODES.find(m => m.label === label);
              if (matched) handleModeChange(matched.value);
            }}
            disabled={isProducing}
            className="w-[130px]"
          />
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white text-emerald-800 font-bold border border-emerald-200 whitespace-nowrap shadow-2xs">
            {currentModeDef.badge}
          </span>
        </div>

        <div className="w-px h-6 bg-emerald-200/90 shrink-0"></div>

        {/* テーマ選択 */}
        <div className="flex items-center gap-1">
          <FieldDropdown 
            label="" 
            value={settings.theme} 
            options={themeConfig.options}
            groups={themeConfig.groups}
            onChange={v => setSettings(s => ({ ...s, theme: v, era: v }))} 
            disabled={isProducing} 
            className="w-[180px]"
          />
          <button
            type="button"
            onClick={onOpenThemeEditor}
            disabled={isProducing}
            className="w-8 h-8 rounded-lg bg-emerald-100/80 text-emerald-800 hover:bg-emerald-200 border border-emerald-300 flex items-center justify-center transition-colors shadow-2xs cursor-pointer shrink-0"
            title="テーマ編集"
          >
            <span className="material-symbols-outlined text-[16px]">edit</span>
          </button>
        </div>

        <div className="w-px h-6 bg-emerald-200/90 shrink-0"></div>

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
                className="w-[170px]"
              />
            );
          })()}
          <button
            type="button"
            onClick={onOpenTasteEditor}
            disabled={isProducing || settings.productionMode === 'style-matrix' || !!settings.selectedAssetId}
            className="w-8 h-8 rounded-lg bg-teal-100/80 text-teal-800 hover:bg-teal-200 border border-teal-300 flex items-center justify-center transition-colors disabled:opacity-40 shadow-2xs cursor-pointer shrink-0"
            title="画風プロンプト編集(JSON)"
          >
            <span className="material-symbols-outlined text-[16px]">data_object</span>
          </button>
        </div>
      </div>

      <div className="w-px h-7 bg-slate-200 shrink-0"></div>

      {/* ③ 最重要メインアクション: 作成開始ボタン (絶対に画面外に見切れない位置に配置) */}
      <div className="flex items-center gap-1.5 shrink-0">
        {isProducing ? (
          <button 
            type="button"
            className="h-10 px-4 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider animate-pulse shadow-md flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
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
            title="設定された内容（大前提またはざっくり）で作成を開始します"
          >
            <span className="material-symbols-outlined text-[18px]">{startBtn.icon}</span>
            <span>③ 作成開始</span>
          </button>
        )}

        {activeSeriesManifest && settings.productionMode === 'episodes' && (
          <button 
            type="button" 
            disabled={isProducing}
            onClick={onResumeClick}
            className="h-10 px-3 text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl flex items-center gap-1 transition-colors shrink-0 whitespace-nowrap cursor-pointer shadow-2xs"
            title="中断した連載制作を再開"
          >
            <span className="material-symbols-outlined text-[16px]">file_open</span>
            <span>再開</span>
          </button>
        )}
      </div>

      <div className="w-px h-7 bg-slate-200 shrink-0"></div>

      {/* 右側サブツール群 (JSON保存/読込, 台帳, アーカイブ, 全消去, ログ) */}
      <div className="flex items-center gap-1.5 shrink-0">
        {/* JSON 保存・復元 (リロードしても消えないようにダウンロード/アップロード) */}
        <input 
          type="file" 
          ref={jsonFileInputRef} 
          onChange={handleImportJson} 
          accept=".json" 
          className="hidden" 
        />
        <button 
          type="button"
          onClick={handleExportJson}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 transition-colors border border-slate-200 shrink-0 cursor-pointer"
          title="プロジェクト設定・キャスト・プロットをJSONダウンロード保存"
        >
          <span className="material-symbols-outlined text-[18px]">download</span>
        </button>
        <button 
          type="button"
          onClick={() => jsonFileInputRef.current?.click()}
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 transition-colors border border-slate-200 shrink-0 cursor-pointer"
          title="保存済みJSON設定ファイルをアップロードして復元"
        >
          <span className="material-symbols-outlined text-[18px]">file_upload</span>
        </button>

        {onOpenCastModal && (
          <button 
            type="button"
            disabled={isProducing}
            onClick={onOpenCastModal}
            className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700 border border-slate-200 shrink-0 cursor-pointer transition-colors"
            title={`登場人物キャスト台帳を開く (${castCount}人)`}
          >
            <span className="material-symbols-outlined text-[18px]">theater_comedy</span>
          </button>
        )}

        <button 
          type="button"
          onClick={onOpenArchive} 
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors border border-slate-200 shrink-0 cursor-pointer" 
          title="アーカイブ"
        >
          <span className="material-symbols-outlined text-[18px]">folder</span>
        </button>

        <button 
          type="button"
          disabled={isProducing}
          onClick={onClear} 
          className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition-colors border border-red-200 shrink-0 cursor-pointer" 
          title="全消去"
        >
          <span className="material-symbols-outlined text-[18px]">delete</span>
        </button>

        <button 
          type="button"
          onClick={onToggleLogs} 
          className={`w-9 h-9 flex items-center justify-center rounded-xl transition-colors border shrink-0 cursor-pointer ${isLogDrawerOpen ? 'bg-indigo-100 border-indigo-200 text-indigo-700' : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'}`} 
          title="ログ表示"
        >
          <span className="material-symbols-outlined text-[18px]">subject</span>
        </button>
      </div>
    </header>
  );
};
