import React, { useState, useEffect } from 'react';
import { FieldDropdown, SegmentedToggle, ToggleSwitch, NumberChoice } from './Primitives';
import { GeneratorSettings, ReferenceAsset, ProductionMode } from '../types';
import { 
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
        
        {/* ① リファレンス・作画演出 アコーディオン */}
        <div className={`flex flex-col rounded-xl border border-slate-200 bg-white transition-all shadow-sm ${isWorldOpen ? 'overflow-visible relative z-30' : 'overflow-hidden'}`}>
          <button
            type="button"
            onClick={() => setIsWorldOpen(!isWorldOpen)}
            className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer select-none text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="material-symbols-outlined text-[18px] text-purple-600 shrink-0">face</span>
              <span className="text-xs font-bold text-slate-800 tracking-wide truncate">リファレンス・作画演出</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 font-bold border border-purple-200 max-w-[140px] truncate">
                {settings.selectedAssetId ? 'リファレンス適用中' : '未設定'}
              </span>
              <span className={`material-symbols-outlined text-[20px] text-slate-400 transition-transform duration-200 ${isWorldOpen ? 'rotate-180 text-purple-600' : ''}`}>
                expand_more
              </span>
            </div>
          </button>
          
          {isWorldOpen && (
            <div className="p-3 flex flex-col gap-3 border-t border-slate-200 animate-in fade-in duration-200">
              <ReferenceVault 
                assets={referenceAssets} 
                selectedId={settings.selectedAssetId} 
                onSelect={(id) => setSettings(s => ({ ...s, selectedAssetId: id }))}
                onRefresh={refreshAssets}
                onAddLog={onAddLog}
                disabled={isProducing}
              />

              {/* マンガ風コマ割り（マルチパネル）トグル */}
              <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-purple-50/80 border border-purple-200 text-purple-900 transition-all select-none hover:bg-purple-100">
                <label className="flex items-center gap-2.5 cursor-pointer flex-1">
                  <input
                    type="checkbox"
                    checked={!!settings.isMultiPanel}
                    onChange={e => setSettings(s => ({ ...s, isMultiPanel: e.target.checked }))}
                    disabled={isProducing}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-slate-300 bg-white cursor-pointer accent-purple-600"
                  />
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-purple-600">auto_stories</span>
                      マンガ風コマ割り (Multi-Panel)
                    </span>
                    <span className="text-[10px] text-slate-500 font-medium">
                      AIが1コマ〜変形コマ割りを自由に演出
                    </span>
                  </div>
                </label>
              </div>
            </div>
          )}
        </div>

        {/* ② 制作ボリューム・配分 アコーディオン */}
        <div className={`flex flex-col rounded-xl border border-slate-200 bg-white transition-all shadow-sm ${isVolumeOpen ? 'overflow-visible relative z-20' : 'overflow-hidden'}`}>
          <button
            type="button"
            onClick={() => setIsVolumeOpen(!isVolumeOpen)}
            className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer select-none text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="material-symbols-outlined text-[18px] text-amber-500 shrink-0">tune</span>
              <span className="text-xs font-bold text-slate-800 tracking-wide truncate">制作ボリューム・配分</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold border border-amber-200">
                {settings.episodeCount}曲 / 先行{settings.previewCutCount}枚
              </span>
              <span className={`material-symbols-outlined text-[20px] text-slate-400 transition-transform duration-200 ${isVolumeOpen ? 'rotate-180 text-amber-500' : ''}`}>
                expand_more
              </span>
            </div>
          </button>

          {isVolumeOpen && (
            <div className="p-3 flex flex-col gap-3 border-t border-slate-200 animate-in fade-in duration-200">
              <FieldDropdown label="画像モデル" value={settings.imageModel} options={IMAGE_MODELS.map(m => m.label)} onChange={v => setSettings(s => ({ ...s, imageModel: v }))} disabled={isProducing} />
              
              <SegmentedToggle 
                label="作画アスペクト比" 
                value={settings.aspectRatio || '9:16'} 
                onChange={v => setSettings(s => ({ ...s, aspectRatio: v as any }))} 
                items={[
                  { value: '9:16', label: '📱 9:16 (縦動画)' },
                  { value: '1:1', label: '⬛ 1:1 (正方形マスター)' },
                  { value: '16:9', label: '🖥️ 16:9 (横動画)' }
                ]} 
              />
              
              <div className="grid grid-cols-2 gap-2.5">
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
                <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-pink-50 border border-pink-200 text-pink-800 text-xs font-bold">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-pink-600">photo_library</span>
                    比較カット数 (動画なし)
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-pink-200 text-pink-900 text-[10px] font-black border border-pink-300">2枚固定</span>
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
        <div className={`flex flex-col rounded-xl border border-slate-200 bg-white transition-all shadow-sm ${isPipelineOpen ? 'overflow-visible relative z-10' : 'overflow-hidden'}`}>
          <button
            type="button"
            onClick={() => setIsPipelineOpen(!isPipelineOpen)}
            className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer select-none text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="material-symbols-outlined text-[18px] text-emerald-600 shrink-0">smart_toy</span>
              <span className="text-xs font-bold text-slate-800 tracking-wide truncate">自動化＆パイプライン</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold border border-emerald-200">
                {pipelineBadge}
              </span>
              <span className={`material-symbols-outlined text-[20px] text-slate-400 transition-transform duration-200 ${isPipelineOpen ? 'rotate-180 text-emerald-600' : ''}`}>
                expand_more
              </span>
            </div>
          </button>

          {isPipelineOpen && (
            <div className="p-3 flex flex-col gap-2 border-t border-slate-200 animate-in fade-in duration-200 bg-white">
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
