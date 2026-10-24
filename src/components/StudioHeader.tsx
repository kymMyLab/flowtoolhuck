import React, { useRef } from 'react';
import { FieldDropdown, PillButton, FieldDropdownOption } from './Primitives';
import { GeneratorSettings, ProductionMode } from '../types';
import { PRODUCTION_MODES, THEMES, MV_THEMES, TRIVIA_THEMES, QUOTES_THEMES, CRAFT_THEMES, THEME_CATEGORIES, TASTES } from '../constants';
import { CustomThemeMap } from '../services/themeStorage';
import { exportProjectJson, importProjectJson, loadMangaProject, saveMangaProject } from '../services/castStorage';
import { getTasteSampleCut, TASTE_GALLERY_DATA } from '../config/tasteGalleryData';

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
  onOpenTasteShowroom?: () => void;
  onOpenCastModal?: () => void;
  onOpenComicWizard?: () => void;
  onOpenMusicImport?: () => void;
  isMusicImportOpen?: boolean;
  isComicWizardOpen?: boolean;
  castCount?: number;
  activeSeriesManifest?: any;
  onResumeClick?: () => void;
  isLogDrawerOpen: boolean;
  isWaitingForStart?: boolean;
}

export const StudioHeader: React.FC<StudioHeaderProps> = ({
  settings, setSettings, isProducing, onStart, onAbort, onClear, onOpenArchive, onToggleLogs, customThemes, customTastes, onOpenThemeEditor, onOpenTasteEditor, onOpenTasteShowroom, onOpenCastModal, onOpenComicWizard, onOpenMusicImport, isMusicImportOpen = false, isComicWizardOpen = false, castCount = 3, activeSeriesManifest, onResumeClick, isLogDrawerOpen, isWaitingForStart = false
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
    <header className="bg-white border-b border-slate-200 px-3.5 py-2 flex flex-col gap-2 shrink-0 z-40 relative shadow-sm">
      {/* 上段（Row 1）: ロゴ、進行ステップ（音楽インポート・プロデュース・作成開始）、右端ユーティリティ群 */}
      <div className="flex items-center justify-between gap-3 w-full">
        {/* 左側: ロゴ & 主要制作アクション */}
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0 text-slate-800">
            <span className="material-symbols-outlined text-amber-500 text-2xl">movie_edit</span>
            <h1 className="text-base font-black italic tracking-tighter uppercase whitespace-nowrap">Studio Pro</h1>
          </div>

          <div className="w-px h-6 bg-slate-200 shrink-0"></div>

          {/* 音楽インポート (アコーディオン開閉トグル) */}
          {onOpenMusicImport && (
            <button 
              type="button"
              disabled={isProducing}
              onClick={onOpenMusicImport}
              className={`h-9 px-3 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0 whitespace-nowrap active:scale-95 border ${
                isMusicImportOpen
                  ? 'bg-amber-400 text-slate-950 border-amber-300 ring-4 ring-amber-400/40 shadow-lg scale-105'
                  : 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-700 hover:brightness-110 text-white border-purple-400/40 ring-2 ring-purple-400/30'
              }`}
              title="CT198楽曲JSONインポート (クリックでアコーディオン開閉)"
            >
              <span className={`material-symbols-outlined text-[18px] ${isMusicImportOpen ? 'text-slate-950 animate-bounce' : 'text-amber-300'}`}>
                {isMusicImportOpen ? 'expand_less' : 'library_music'}
              </span>
              <span>🎵 音楽インポート</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                isMusicImportOpen ? 'bg-black text-amber-300' : 'bg-purple-900/60 text-purple-200'
              }`}>
                {isMusicImportOpen ? '展開中 ▲' : '開く ▼'}
              </span>
            </button>
          )}

          <div className="w-px h-6 bg-slate-200 shrink-0"></div>

          {/* ① 先頭: プロデュースボタン (アコーディオン開閉トグル) */}
          {onOpenComicWizard && (
            <button 
              type="button"
              disabled={isProducing}
              onClick={onOpenComicWizard}
              className={`h-9 px-3 rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer shrink-0 whitespace-nowrap active:scale-95 border ${
                isComicWizardOpen
                  ? 'bg-indigo-600 text-white border-indigo-400 ring-4 ring-indigo-400/40 shadow-lg scale-105'
                  : activeSeriesManifest 
                    ? 'bg-gradient-to-r from-purple-700 via-indigo-600 to-emerald-600 text-white ring-2 ring-purple-400/50 border-purple-400/40'
                    : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-amber-500 hover:brightness-110 text-white border-indigo-400/40'
              }`}
              title={
                activeSeriesManifest
                  ? `大前提プロデュース設定済: 『${activeSeriesManifest.seriesTitle || '連載'}』(クリックでアコーディオン開閉)`
                  : '主人公三面図・配役・全話プロットを事前決定し、作品の方向性を確立（クリックでアコーディオン開閉）'
              }
            >
              <span className="material-symbols-outlined text-[18px]">
                {isComicWizardOpen ? 'expand_less' : activeSeriesManifest ? 'verified' : 'auto_stories'}
              </span>
              <span>① プロデュース</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                isComicWizardOpen 
                  ? 'bg-black text-indigo-300' 
                  : activeSeriesManifest ? 'bg-emerald-400 text-emerald-950' : 'bg-white/20 text-white'
              }`}>
                {isComicWizardOpen ? '展開中 ▲' : activeSeriesManifest ? '確定済 ✓' : '大前提 ▼'}
              </span>
            </button>
          )}

          <div className="w-px h-6 bg-slate-200 shrink-0"></div>

          {/* ③ 最重要メインアクション: 作成開始ボタン */}
          <div className="flex items-center gap-1.5 shrink-0">
            {isProducing ? (
              <button 
                type="button"
                className="h-9 px-3.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-wider animate-pulse shadow-md flex items-center gap-1.5 shrink-0 whitespace-nowrap cursor-pointer"
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
                className={`h-9 px-4 rounded-xl flex items-center gap-1.5 font-black text-xs uppercase tracking-wider transition-all select-none cursor-pointer shrink-0 whitespace-nowrap relative ${
                  isWaitingForStart
                    ? 'ring-4 ring-pink-400 ring-offset-2 animate-pulse shadow-[0_0_25px_rgba(236,72,153,0.8)] brightness-110 !bg-gradient-to-r !from-indigo-600 !via-purple-600 !to-pink-600 text-white hover:brightness-125 hover:scale-105 active:scale-95'
                    : `shadow-md hover:shadow-lg active:scale-95 ${startBtn.className}`
                }`}
                title={isWaitingForStart ? "スタンバイ完了！クリックして本編の作成を開始します" : "設定された内容で作成を開始します"}
              >
                {isWaitingForStart && (
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-80"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-pink-500 border border-white"></span>
                  </span>
                )}
                <span className="material-symbols-outlined text-[18px]">
                  {isWaitingForStart ? 'play_arrow' : startBtn.icon}
                </span>
                <span>③ 作成開始</span>
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
        </div>

        {/* 右側サブツール群 (JSON保存/読込, 台帳, アーカイブ, 全消去, ログ) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* JSON 保存・復元 */}
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
            className="h-9 px-2.5 flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 transition-colors border border-slate-200 shrink-0 cursor-pointer text-xs font-semibold"
            title="プロジェクト設定・キャスト・プロットをJSONダウンロード保存"
          >
            <span className="material-symbols-outlined text-[17px]">download</span>
            <span className="hidden sm:inline">保存</span>
          </button>
          <button 
            type="button"
            onClick={() => jsonFileInputRef.current?.click()}
            className="h-9 px-2.5 flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 transition-colors border border-slate-200 shrink-0 cursor-pointer text-xs font-semibold"
            title="保存済みJSON設定ファイルをアップロードして復元"
          >
            <span className="material-symbols-outlined text-[17px]">file_upload</span>
            <span className="hidden sm:inline">読込</span>
          </button>

          {onOpenCastModal && (
            <button 
              type="button"
              disabled={isProducing}
              onClick={onOpenCastModal}
              className="h-9 px-2.5 flex items-center gap-1 rounded-xl bg-slate-100 hover:bg-amber-50 text-slate-700 hover:text-amber-700 border border-slate-200 shrink-0 cursor-pointer transition-colors text-xs font-semibold"
              title={`登場人物キャスト台帳を開く (${castCount}人)`}
            >
              <span className="material-symbols-outlined text-[17px]">theater_comedy</span>
              <span className="hidden sm:inline">台帳 ({castCount})</span>
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
      </div>

      {/* 下段（Row 2）: ② ざっくり設定エリア（モード・世界観・画風）を左寄せで広々と配置 */}
      <div className="flex items-center justify-start gap-2 w-full flex-wrap pt-1 border-t border-slate-100">
        <div className="flex items-center gap-2 p-1 bg-gradient-to-r from-emerald-50/80 via-teal-50/60 to-emerald-50/80 rounded-xl border border-emerald-300/80 shadow-2xs shrink-0 flex-wrap">
          {/* ② ざっくり設定バッジ */}
          <div className="flex items-center gap-1 text-[11px] font-black text-emerald-800 bg-emerald-100/90 px-2.5 py-1 rounded-lg border border-emerald-300/80 whitespace-nowrap shadow-2xs">
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
              className="w-[135px]"
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
              className="w-[190px]"
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

          {/* 画風選択（サムネイル付きプルダウン） */}
          <div className="flex items-center gap-1.5">
            {(() => {
              const tasteKeys = Object.keys(customTastes || {});
              const rawKeys = tasteKeys.length > 0 ? tasteKeys : Object.keys(TASTES);
              const tasteOptions: FieldDropdownOption[] = rawKeys.map(k => {
                const sampleImg = getTasteSampleCut(k);
                const galleryItem = TASTE_GALLERY_DATA.find(g => g.tasteKey === k || g.displayName === k || k.includes(g.id));
                return {
                  value: k,
                  label: galleryItem?.displayName || k.split(' (')[0],
                  image: sampleImg,
                  sublabel: galleryItem?.descriptionJp ? galleryItem.descriptionJp.slice(0, 38) + '...' : undefined
                };
              });
              return (
                <FieldDropdown 
                  label="" 
                  value={settings.productionMode === 'style-matrix' ? '🎨 マトリクス比較中' : (settings.selectedAssetId ? '🎨 参照画像同期中' : settings.taste)} 
                  options={tasteOptions} 
                  onChange={v => setSettings(s => ({ ...s, taste: v }))} 
                  disabled={isProducing || settings.productionMode === 'style-matrix' || !!settings.selectedAssetId} 
                  className="w-[210px]"
                />
              );
            })()}
            <button
              type="button"
              onClick={onOpenTasteShowroom}
              disabled={isProducing || settings.productionMode === 'style-matrix' || !!settings.selectedAssetId}
              className="px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all hover:scale-102 cursor-pointer shrink-0"
              title="作例画像（学生・江戸町人・社会人）を見ながら画風を選択"
            >
              <span className="material-symbols-outlined text-[16px]">gallery_thumbnail</span>
              <span>作例ギャラリー</span>
            </button>
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
      </div>
    </header>
  );
};
