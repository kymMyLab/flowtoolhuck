import React, { useState, useEffect, useRef } from 'react';
import { SectionLabel, PillButton, FieldDropdown, SegmentedToggle, ToggleSwitch, NumberChoice } from './Primitives';
import { GeneratorSettings, ReferenceAsset, ProductionMode } from '../types';
import { 
  THEMES, 
  THEME_CATEGORIES, 
  MV_THEMES, 
  TRIVIA_THEMES, 
  QUOTES_THEMES, 
  FOLKLORE_THEMES, 
  CRAFT_THEMES, 
  TASTES, 
  IMAGE_MODELS, 
  VIDEO_RATIO_OPTIONS,
  PRODUCTION_MODES
} from '../constants';
import { StudioLogs, LogEntry } from './StudioLogs';
import { ReferenceVault } from './ReferenceVault';
import { getAllReferenceAssets } from '../services/db';
import { ThemeEditorModal } from './ThemeEditorModal';
import { loadCustomThemes, CustomThemeMap } from '../services/themeStorage';
import { TasteEditorModal } from './TasteEditorModal';
import { loadCustomTastes, CustomTasteMap } from '../services/tasteStorage';

export { PRODUCTION_MODES };

interface StudioSidebarProps {
  settings: GeneratorSettings;
  setSettings: React.Dispatch<React.SetStateAction<GeneratorSettings>>;
  isProducing: boolean;
  onStart: () => void;
  onAbort: () => void;
  onClear: () => void;
  onOpenArchive: () => void;
  onResumeSeries?: (manifest: any) => void;
  activeSeriesManifest?: any;
  logs: LogEntry[];
  onAddLog: (msg: string, type?: LogEntry['type']) => void;
}

export const StudioSidebar: React.FC<StudioSidebarProps> = ({
  settings, setSettings, isProducing, onStart, onAbort, onClear, onOpenArchive, onResumeSeries, activeSeriesManifest, logs, onAddLog
}) => {
  const [referenceAssets, setReferenceAssets] = useState<ReferenceAsset[]>([]);
  const [customThemes, setCustomThemes] = useState<CustomThemeMap>(() => loadCustomThemes());
  const [customTastes, setCustomTastes] = useState<CustomTasteMap>(() => loadCustomTastes());
  const [isThemeEditorOpen, setIsThemeEditorOpen] = useState(false);
  const [isTasteEditorOpen, setIsTasteEditorOpen] = useState(false);
  const resumeFileRef = useRef<HTMLInputElement | null>(null);

  const refreshAssets = async () => {
    const assets = await getAllReferenceAssets();
    setReferenceAssets(assets);
  };

  useEffect(() => {
    refreshAssets();
  }, []);

  const handleResumeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const manifest = JSON.parse(event.target?.result as string);
        if (!manifest.seriesTitle || !manifest.episodesPlan) {
          onAddLog('❌ 有効なシリーズ設定ファイル(JSON)ではありません。', 'error');
          return;
        }
        if (onResumeSeries) onResumeSeries(manifest);
      } catch (err: any) {
        onAddLog(`❌ JSON読み込み失敗: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
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
        : ([1, 5, 10, 20, 50].includes(s.episodeCount) ? s.episodeCount : 1),
      theme: defaultTheme,
      era: defaultTheme,
    }));
  };

  const getThemeConfig = () => {
    const modeList = customThemes[settings.productionMode];
    switch (settings.productionMode) {
      case 'mv': return { options: modeList || MV_THEMES, groups: undefined, label: `MV世界観・シチュエーション (${(modeList || MV_THEMES).length}選)` };
      case 'trivia': return { options: modeList || TRIVIA_THEMES, groups: undefined, label: `💡 雑学Shortsテーマ (${(modeList || TRIVIA_THEMES).length}選)` };
      case 'quotes': return { options: modeList || QUOTES_THEMES, groups: undefined, label: `📜 偉人の名言テーマ (${(modeList || QUOTES_THEMES).length}選)` };
      case 'folklore': return { options: modeList || FOLKLORE_THEMES, groups: undefined, label: `👻 怪異・未解決テーマ (${(modeList || FOLKLORE_THEMES).length}選)` };
      case 'craft': return { options: modeList || CRAFT_THEMES, groups: undefined, label: `🏯 職人魂・超絶技巧テーマ (${(modeList || CRAFT_THEMES).length}選)` };
      default: return { options: undefined, groups: THEME_CATEGORIES.map(c => ({ label: c.category, items: c.items })), label: '世界観・テーマ' };
    }
  };

  const getStartButtonConfig = () => {
    switch (settings.productionMode) {
      case 'mv':
        return {
          className: 'bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-900/40 border border-purple-400/50',
          icon: 'music_note',
          label: `🎵 音楽MVを生成 (${settings.episodeCount || 1}曲 / 各12カット)`
        };
      case 'trivia':
        return {
          className: 'bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 hover:from-amber-400 hover:to-yellow-400 text-black shadow-amber-900/40 border border-yellow-300/50 font-black',
          icon: 'lightbulb',
          label: `💡 衝撃雑学Shortsを生成 (${settings.episodeCount || 1}本 / 中央フラッシュ)`
        };
      case 'quotes':
        return {
          className: 'bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 hover:from-emerald-500 hover:to-teal-500 text-white shadow-teal-900/40 border border-teal-400/50',
          icon: 'history_edu',
          label: `📜 偉人名言Shortsを生成 (${settings.episodeCount || 1}本 / 縦書き墨文字)`
        };
      case 'folklore':
        return {
          className: 'bg-gradient-to-r from-rose-900 via-purple-900 to-red-950 hover:from-rose-800 hover:to-purple-800 text-white shadow-red-900/50 border border-red-500/50',
          icon: 'visibility',
          label: `👻 怪異・考察動画を生成 (${settings.episodeCount || 1}本 / 不穏グリッチ)`
        };
      case 'craft':
        return {
          className: 'bg-gradient-to-r from-amber-700 via-yellow-600 to-amber-800 hover:from-amber-600 hover:to-yellow-500 text-amber-100 shadow-amber-950/50 border border-amber-400/50',
          icon: 'handyman',
          label: `🏯 職人魂ショートを生成 (${settings.episodeCount || 1}本 / 伝統金文字)`
        };
      case 'style-matrix':
        return {
          className: 'bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500 text-white shadow-rose-900/40 border border-pink-400/50',
          icon: 'palette',
          label: `🎨 画風比較を開始 (${settings.episodeCount || 3}画風 / 各2枚)`
        };
      default:
        return {
          className: 'bg-white hover:bg-gray-100 text-black shadow-white/10',
          icon: 'auto_awesome',
          label: activeSeriesManifest 
            ? `⏩ 第 ${(activeSeriesManifest.completedEpisodeIds?.length || 0) + 1} 話から再開` 
            : '✨ ドラマ生成開始'
        };
    }
  };

  const themeConfig = getThemeConfig();
  const startBtn = getStartButtonConfig();

  return (
    <div className="w-[380px] border-r border-white/10 flex flex-col p-2.5 shrink-0 bg-[#121212] z-10 shadow-2xl h-full">
      {/* ── 最上部固定ヘッダーエリア（スクロールしても絶対に隠れない） ── */}
      <div className="flex flex-col gap-2 shrink-0 pb-2.5 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-500">movie_edit</span>
            <h1 className="text-lg font-black italic tracking-tighter uppercase">Studio Pro</h1>
          </div>
          <button onClick={onOpenArchive} className="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/10">
            <span className="material-symbols-outlined text-[18px]">folder</span>
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <SectionLabel>制作モード（YouTubeバズ特化ジャンル）</SectionLabel>
          <FieldDropdown 
            label="制作モード選択"
            value={currentModeDef.label}
            options={PRODUCTION_MODES.map(m => m.label)}
            onChange={label => {
              const matched = PRODUCTION_MODES.find(m => m.label === label);
              if (matched) handleModeChange(matched.value);
            }}
            disabled={isProducing}
          />
        </div>

        {/* モード固有固定インフォエリア（高さ一定で切替時のガタつきを防止） */}
        <div className="min-h-[50px] flex flex-col justify-center">
          {settings.productionMode === 'episodes' && activeSeriesManifest ? (
            <div className="flex items-center justify-between bg-white/5 p-2 rounded-xl border border-white/10">
              <div className="flex flex-col">
                <span className="text-[11px] font-bold text-gray-300">連載レジューム</span>
                <span className="text-[9px] text-gray-400">
                  『{activeSeriesManifest.seriesTitle}』({activeSeriesManifest.completedEpisodeIds?.length || 0}/{activeSeriesManifest.totalEpisodes}話完了)
                </span>
              </div>
              <button 
                type="button" 
                disabled={isProducing}
                onClick={() => resumeFileRef.current?.click()}
                className="px-2.5 py-1 text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg flex items-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[14px]">file_open</span>
                読込
              </button>
            </div>
          ) : (
            <div className={`flex items-center justify-between px-3 py-1.5 rounded-xl border ${currentModeDef.colorClass}`}>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="material-symbols-outlined text-[16px] shrink-0">{currentModeDef.icon}</span>
                <div className="flex flex-col min-w-0">
                  <span className="text-[11px] font-bold truncate">{currentModeDef.desc}</span>
                  <span className="text-[9px] opacity-75 truncate">演出: {currentModeDef.telopNote}</span>
                </div>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-md bg-white/10 font-bold border border-white/10 shrink-0">
                {currentModeDef.badge}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── スクロールエリア（設定詳細） ── */}
      <div className="flex flex-col gap-2.5 overflow-y-auto pr-1 dark-scrollbar flex-1 py-2.5">
        <ReferenceVault 
          assets={referenceAssets} 
          selectedId={settings.selectedAssetId} 
          onSelect={(id) => setSettings(s => ({ ...s, selectedAssetId: id }))}
          onRefresh={refreshAssets}
          onAddLog={onAddLog}
          disabled={isProducing}
        />

        <div className="flex items-center justify-between mt-1">
          <SectionLabel>{themeConfig.label}</SectionLabel>
          <button
            type="button"
            onClick={() => setIsThemeEditorOpen(true)}
            disabled={isProducing}
            className="px-2 py-0.5 text-[10px] rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1 transition-colors cursor-pointer"
            title="テーマ一覧をWebUI上で編集・追加・保存"
          >
            <span className="material-symbols-outlined text-[12px]">edit</span>
            編集・追加
          </button>
        </div>
        <FieldDropdown 
          label={themeConfig.label} 
          value={settings.theme} 
          options={themeConfig.options}
          groups={themeConfig.groups}
          onChange={v => setSettings(s => ({ ...s, theme: v, era: v }))} 
          disabled={isProducing} 
        />
        
        <div className="flex items-center justify-between mt-1">
          <label className="text-[11px] font-black text-gray-400 uppercase tracking-wider">画風・テイスト</label>
          <button
            type="button"
            onClick={() => setIsTasteEditorOpen(true)}
            disabled={isProducing || settings.productionMode === 'style-matrix' || !!settings.selectedAssetId}
            className="px-2 py-0.5 text-[10px] rounded-md bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
            title="画風プロンプト一覧をJSONで直接編集・追加・保存"
          >
            <span className="material-symbols-outlined text-[12px]">edit</span>
            編集・追加 (JSON)
          </button>
        </div>
        <FieldDropdown 
          label="" 
          value={settings.productionMode === 'style-matrix' ? '🎨 全画風マトリクス比較（自動）' : (settings.selectedAssetId ? '🎨 参照画像の画風同期中' : settings.taste)} 
          options={Object.keys(customTastes)} 
          onChange={v => setSettings(s => ({ ...s, taste: v }))} 
          disabled={isProducing || settings.productionMode === 'style-matrix' || !!settings.selectedAssetId} 
        />

        {/* マンガ風コマ割り（マルチパネル）トグル */}
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-purple-500/10 border border-purple-500/25 text-purple-300 transition-all select-none hover:bg-purple-500/15">
          <label className="flex items-center gap-2.5 cursor-pointer flex-1">
            <input
              type="checkbox"
              checked={!!settings.isMultiPanel}
              onChange={e => setSettings(s => ({ ...s, isMultiPanel: e.target.checked }))}
              disabled={isProducing}
              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-gray-600 bg-black/50 cursor-pointer accent-purple-500"
            />
            <div className="flex flex-col">
              <span className="text-[11px] font-bold text-white flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-purple-400">auto_stories</span>
                マンガ風コマ割り (Multi-Panel)
              </span>
              <span className="text-[9.5px] text-gray-400 font-normal">
                AIが1コマ〜変形コマ割りを自由に演出
              </span>
            </div>
          </label>
        </div>

        <SectionLabel>自動化設定</SectionLabel>
        <div className="flex flex-col gap-2.5">
          <FieldDropdown label="画像モデル" value={settings.imageModel} options={IMAGE_MODELS.map(m => m.label)} onChange={v => setSettings(s => ({ ...s, imageModel: v }))} disabled={isProducing} />
          
          <div className="grid grid-cols-2 gap-2">
            <NumberChoice label="並列数" value={settings.parallelCount} options={[1, 2, 3, 4]} onChange={v => setSettings(s => ({ ...s, parallelCount: v }))} />
            <NumberChoice 
              label={settings.productionMode === 'mv' ? '生成曲数' : (settings.productionMode === 'style-matrix' ? '比較画風数' : (settings.productionMode === 'episodes' ? '生成話数' : '生成本数'))} 
              value={settings.episodeCount} 
              options={settings.productionMode === 'style-matrix' ? [3, 5, 8, 10] : [1, 5, 10, 20, 50]} 
              formatLabel={v => settings.productionMode === 'style-matrix' && v === 10 ? '10種 (全)' : `${v}${settings.productionMode === 'mv' ? '曲' : (settings.productionMode === 'style-matrix' ? '種' : (settings.productionMode === 'episodes' ? '話' : '本'))}`}
              onChange={v => setSettings(s => ({ ...s, episodeCount: v }))} 
            />
          </div>

          {settings.productionMode === 'style-matrix' ? (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-300 text-[11px] font-bold">
              <span className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px]">photo_library</span>
                比較カット数 (動画なし)
              </span>
              <span className="px-2 py-0.5 rounded-md bg-pink-500/20 text-pink-200 text-[10px] font-black border border-pink-500/30">2枚固定</span>
            </div>
          ) : (
            <>
              <NumberChoice 
                label={settings.productionMode === 'mv' ? '先行カット数' : '生成カット数'} 
                value={settings.previewCutCount} 
                options={[1, 3, 5, 12]} 
                formatLabel={v => v === 12 ? '12枚 (全)' : `${v}枚`} 
                onChange={v => setSettings(s => ({ ...s, previewCutCount: v }))} 
              />
              <SegmentedToggle label="動画化する割合" value={settings.videoRatio} onChange={v => setSettings(s => ({ ...s, videoRatio: v as any }))} items={VIDEO_RATIO_OPTIONS} />
            </>
          )}

          <div className="flex flex-col bg-white/5 rounded-xl p-1.5 border border-white/5 gap-1">
            {settings.productionMode !== 'style-matrix' && (
              <ToggleSwitch label="🎬 動画まで自動完走" checked={settings.autoVideo} onChange={v => setSettings(s => ({ ...s, autoVideo: v }))} />
            )}
            <ToggleSwitch label="📦 完了時自動ダウンロード" checked={settings.autoDownload} onChange={v => setSettings(s => ({ ...s, autoDownload: v }))} />
            <ToggleSwitch 
              label="🌙 超指数バックオフ (夜間放置完走)" 
              checked={!!settings.superBackoff} 
              onChange={v => setSettings(s => ({ ...s, superBackoff: v }))} 
            />
            <ToggleSwitch 
              label="🎨 三面図先行生成 (360°キャラ崩れ防止)" 
              checked={settings.enableTurnaroundSheet !== false} 
              onChange={v => setSettings(s => ({ ...s, enableTurnaroundSheet: v }))} 
            />
            {settings.enableTurnaroundSheet !== false && (
              <ToggleSwitch 
                label="⚡ 三面図自動承認 (無人完走)" 
                checked={!!settings.autoApproveTurnaround} 
                onChange={v => setSettings(s => ({ ...s, autoApproveTurnaround: v }))} 
              />
            )}
            <ToggleSwitch 
              label="📦 象徴アイテムカット (人なしシーン挿入)" 
              checked={settings.enableObjectCut !== false} 
              onChange={v => setSettings(s => ({ ...s, enableObjectCut: v }))} 
            />
            <ToggleSwitch 
              label="🎬 1Cut2枚生成 (Veo補間用 Start/After絵)" 
              checked={settings.enableEndFrames !== false} 
              onChange={v => setSettings(s => ({ ...s, enableEndFrames: v }))} 
            />
          </div>
        </div>
        
        <div className="pt-1 flex flex-col gap-2">
          {isProducing ? (
            <PillButton variant="filled" className="h-11 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest animate-pulse" onClick={onAbort} icon={<span className="material-symbols-outlined">stop_circle</span>}>
              🛑 緊急停止 (Abort)
            </PillButton>
          ) : (
            <button 
              type="button"
              disabled={isProducing}
              onClick={onStart}
              className={`w-full h-11 rounded-xl flex items-center justify-center gap-2 font-black text-xs uppercase tracking-wider transition-all select-none cursor-pointer shadow-lg active:scale-[0.99] ${startBtn.className}`}
            >
              <span className="material-symbols-outlined text-[18px]">
                {startBtn.icon}
              </span>
              <span>{startBtn.label}</span>
            </button>
          )}
          <PillButton variant="outline" className="text-red-400 h-9" onClick={onClear} icon={<span className="material-symbols-outlined">delete</span>}>全消去</PillButton>
        </div>
      </div>

      <StudioLogs logs={logs} onAddLog={onAddLog} isProducing={isProducing} />

      <ThemeEditorModal
        isOpen={isThemeEditorOpen}
        onClose={() => setIsThemeEditorOpen(false)}
        currentMode={settings.productionMode}
        modeLabel={currentModeDef.label}
        onThemesUpdated={(updatedList) => {
          setCustomThemes(prev => ({
            ...prev,
            [settings.productionMode]: updatedList
          }));
          if (updatedList.length > 0 && !updatedList.includes(settings.theme)) {
            setSettings(s => ({ ...s, theme: updatedList[0], era: updatedList[0] }));
          }
        }}
      />

      <TasteEditorModal
        isOpen={isTasteEditorOpen}
        onClose={() => setIsTasteEditorOpen(false)}
        onTastesUpdated={(updatedTastes) => {
          setCustomTastes(updatedTastes);
          const tasteKeys = Object.keys(updatedTastes);
          if (tasteKeys.length > 0 && !tasteKeys.includes(settings.taste)) {
            setSettings(s => ({ ...s, taste: tasteKeys[0] }));
          }
        }}
      />
    </div>
  );
};
