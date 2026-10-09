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

import { ReferenceVault } from './ReferenceVault';
import { getAllReferenceAssets } from '../services/db';





import { LogEntry } from './StudioLogs';

export { PRODUCTION_MODES };

interface StudioSidebarProps {
  settings: GeneratorSettings;
  setSettings: React.Dispatch<React.SetStateAction<GeneratorSettings>>;
  isProducing: boolean;
  onAddLog: (msg: string, type?: LogEntry['type']) => void;
}

export const StudioSidebar: React.FC<StudioSidebarProps> = ({
  settings, setSettings, isProducing, onAddLog
}) => {
  const [referenceAssets, setReferenceAssets] = useState<ReferenceAsset[]>([]);

  const refreshAssets = async () => {
    const assets = await getAllReferenceAssets();
    setReferenceAssets(assets);
  };

  useEffect(() => {
    refreshAssets();
  }, []);

  const [isWorldOpen, setIsWorldOpen] = useState(true);
  const [isVolumeOpen, setIsVolumeOpen] = useState(true);
  const [isPipelineOpen, setIsPipelineOpen] = useState(true);

  const pipelineBadge = [
    settings.enableTurnaroundSheet !== false ? '三面図' : '',
    settings.enableEndFrames !== false ? '2F' : '',
    settings.enableObjectCut !== false ? '象徴' : '',
    settings.autoVideo ? '自動完走' : ''
  ].filter(Boolean).join('+') || '通常';

  return (
    <div className="w-[440px] border-r border-slate-200 flex flex-col p-2.5 shrink-0 bg-slate-50 z-10 shadow-sm h-full overflow-hidden">
      {/* ── 中央スクロールエリア（各項目アコーディオン） ── */}
      <div className="flex flex-col gap-2 overflow-y-auto pr-1 dark-scrollbar flex-1 py-2">
        
        {/* ① 世界観・画風設定 アコーディオン */}
        <div className={`flex flex-col rounded-xl border border-slate-200 bg-white transition-all ${isWorldOpen ? 'overflow-visible relative z-30' : 'overflow-hidden'}`}>
          <button
            type="button"
            onClick={() => setIsWorldOpen(!isWorldOpen)}
            className="w-full flex items-center justify-between p-2.5 bg-white/[0.04] hover:bg-white/[0.08] transition-colors cursor-pointer select-none text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[16px] text-purple-400 shrink-0">palette</span>
              <span className="text-[11px] font-black text-white/90 uppercase tracking-wider truncate">世界観・画風設定</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30 max-w-[120px] truncate">
                {settings.theme ? (settings.theme.length > 8 ? settings.theme.slice(0, 8) + '…' : settings.theme) : '未設定'}
              </span>
              <span className={`material-symbols-outlined text-[18px] text-gray-400 transition-transform duration-200 ${isWorldOpen ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </div>
          </button>
          
          {isWorldOpen && (
            <div className="p-2.5 flex flex-col gap-2.5 border-t border-white/5 animate-in fade-in duration-200">
              <ReferenceVault 
                assets={referenceAssets} 
                selectedId={settings.selectedAssetId} 
                onSelect={(id) => setSettings(s => ({ ...s, selectedAssetId: id }))}
                onRefresh={refreshAssets}
                onAddLog={onAddLog}
                disabled={isProducing}
              />

              <div className="flex items-center justify-between mt-0.5">
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
              
              <div className="flex items-center justify-between mt-0.5">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider">画風・テイスト</label>
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
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 bg-slate-200 cursor-pointer accent-purple-500"
                  />
                  <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-purple-400">auto_stories</span>
                      マンガ風コマ割り (Multi-Panel)
                    </span>
                    <span className="text-[9.5px] text-slate-500 font-normal">
                      AIが1コマ〜変形コマ割りを自由に演出
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ② 制作ボリューム・配分 アコーディオン */}
        <div className={`flex flex-col rounded-xl border border-slate-200 bg-white transition-all ${isVolumeOpen ? 'overflow-visible relative z-20' : 'overflow-hidden'}`}>
          <button
            type="button"
            onClick={() => setIsVolumeOpen(!isVolumeOpen)}
            className="w-full flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer select-none text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[16px] text-amber-400 shrink-0">tune</span>
              <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider truncate">制作ボリューム・配分</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                {settings.episodeCount}曲 / 先行{settings.previewCutCount}枚
              </span>
              <span className={`material-symbols-outlined text-[18px] text-slate-500 transition-transform duration-200 ${isVolumeOpen ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </div>
          </button>

          {isVolumeOpen && (
            <div className="p-2.5 flex flex-col gap-2.5 border-t border-slate-200 animate-in fade-in duration-200">
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
            </div>
          )}
        </div>

        {/* ③ 自動化＆Veoパイプライン アコーディオン */}
        <div className={`flex flex-col rounded-xl border border-slate-200 bg-white transition-all ${isPipelineOpen ? 'overflow-visible relative z-10' : 'overflow-hidden'}`}>
          <button
            type="button"
            onClick={() => setIsPipelineOpen(!isPipelineOpen)}
            className="w-full flex items-center justify-between p-2.5 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer select-none text-left"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="material-symbols-outlined text-[16px] text-emerald-400 shrink-0">smart_toy</span>
              <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider truncate">自動化＆パイプライン</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                {pipelineBadge}
              </span>
              <span className={`material-symbols-outlined text-[18px] text-slate-500 transition-transform duration-200 ${isPipelineOpen ? 'rotate-180' : ''}`}>
                expand_more
              </span>
            </div>
          </button>

          {isPipelineOpen && (
            <div className="p-2.5 flex flex-col gap-1.5 border-t border-slate-200 animate-in fade-in duration-200 bg-slate-50">
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
          )}
        </div>

      </div>

    </div>
  );
};
