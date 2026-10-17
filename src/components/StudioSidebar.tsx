import React, { useState, useEffect } from 'react';
import { FieldDropdown, SegmentedToggle, ToggleSwitch, NumberChoice } from './Primitives';
import { GeneratorSettings, ReferenceAsset, ProductionMode, Episode } from '../types';
import { 
  IMAGE_MODELS, 
  VIDEO_RATIO_OPTIONS,
  TASTES
} from '../constants';
import { loadCustomTastes } from '../services/tasteStorage';

import { ReferenceVault } from './ReferenceVault';
import { getAllReferenceAssets } from '../services/db';
import { LogEntry } from './StudioLogs';

interface StudioSidebarProps {
  settings: GeneratorSettings;
  setSettings: React.Dispatch<React.SetStateAction<GeneratorSettings>>;
  isProducing: boolean;
  onAddLog: (msg: string, type?: LogEntry['type']) => void;
  episodes?: Episode[];
}

export const StudioSidebar: React.FC<StudioSidebarProps> = ({
  settings, setSettings, isProducing, onAddLog, episodes = []
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

  // 現在のエピソードの最大カット数を判定（MVは30、ショートは12、マンガは24など）
  const activeMaxCuts = episodes[0]?.cuts?.length || (settings.productionMode === 'mv' ? 30 : settings.productionMode === 'manga' ? 24 : 12);

  // カット数プリセットの動的構築 (デフォルト30、100枚までボタンで即選択、全カットボタン、手入力で200/300枚も上限なし)
  const cutPresetOptions = React.useMemo(() => {
    const baseValues = [1, 5, 12, 30, 50, 100];
    const allValues = Array.from(new Set([...baseValues, activeMaxCuts])).sort((a, b) => a - b);

    return allValues.map(val => {
      let label = `${val}枚`;
      if (val === activeMaxCuts) {
        label = val === 30 ? '30枚 (全)' : val === 12 ? '12枚 (全)' : `${val}枚 (全)`;
      }
      return {
        value: val,
        label
      };
    });
  }, [activeMaxCuts]);

  // 生成曲数/話数の選択肢プリセット（100曲あっても見やすく、全曲ボタン付き）
  const episodeOptions = React.useMemo(() => {
    if (settings.productionMode === 'style-matrix') {
      const totalTastesCount = Object.keys({ ...TASTES, ...loadCustomTastes() }).length;
      const base = [3, 5, 10, 20];
      const list = base.filter(n => n < totalTastesCount);
      const res = [...list, totalTastesCount];
      if (!res.includes(settings.episodeCount)) {
        return [...res, settings.episodeCount].sort((a, b) => a - b);
      }
      return res;
    }
    if (settings.productionMode === 'mv') {
      const max = settings.totalEpisodes || episodes.length || 5;
      if (max <= 5) {
        const base = [1, 2, 3, 4, 5].filter(n => n <= max);
        return base;
      }
      // 100曲など大規模の場合: よく使う [1, 2, 5, 10, 20, 50, 全]
      const steps = [1, 2, 5, 10, 20, 50].filter(n => n < max);
      const res = Array.from(new Set([...steps, max])).sort((a, b) => a - b);
      if (!res.includes(settings.episodeCount)) {
        return Array.from(new Set([...res, settings.episodeCount])).sort((a, b) => a - b);
      }
      return res;
    }
    const base = [1, 2, 4, 10, 20, 50];
    if (!base.includes(settings.episodeCount)) {
      return [...base, settings.episodeCount].sort((a, b) => a - b);
    }
    return base;
  }, [settings.productionMode, settings.totalEpisodes, settings.episodeCount, episodes.length]);

  const formatEpisodeLabel = (v: number) => {
    if (settings.productionMode === 'style-matrix') {
      const totalTastesCount = Object.keys({ ...TASTES, ...loadCustomTastes() }).length;
      return v >= totalTastesCount ? `${v}種 (全)` : `${v}種`;
    }
    const max = settings.totalEpisodes || episodes.length;
    if (settings.productionMode === 'mv' && max && v >= max) {
      return `${v}曲 (全)`;
    }
    return `${v}${settings.productionMode === 'mv' ? '曲' : (settings.productionMode === 'episodes' ? '話' : '本')}`;
  };

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
                {settings.episodeCount}{settings.productionMode === 'mv' ? '曲' : '話'} / 先行{settings.previewCutCount}枚
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
                {/* 生成曲数・話数（直接入力＋動的プリセット） */}
                <div className="flex flex-col gap-1 w-full">
                  <div className="flex items-center justify-between px-0.5">
                    <p className="text-xs font-bold text-slate-600 truncate">
                      {settings.productionMode === 'mv' ? '生成曲数' : (settings.productionMode === 'style-matrix' ? '比較画風数' : (settings.productionMode === 'episodes' ? '生成話数' : '生成本数'))}
                    </p>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-slate-400 font-medium">指定:</span>
                      <input 
                        type="number" 
                        min="1" 
                        max={settings.totalEpisodes || 999}
                        value={settings.episodeCount || 1}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val) && val > 0) {
                            const maxLimit = settings.totalEpisodes || 999;
                            setSettings(s => ({ ...s, episodeCount: Math.min(val, maxLimit) }));
                          }
                        }}
                        className="w-12 h-5 px-1 text-center text-xs font-black text-indigo-700 bg-white border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                      />
                      <span className="text-[10px] font-bold text-slate-500">
                        {settings.productionMode === 'mv' ? '曲' : (settings.productionMode === 'style-matrix' ? '種' : (settings.productionMode === 'episodes' ? '話' : '本'))}
                      </span>
                    </div>
                  </div>

                  <div className="flex w-full items-center border border-slate-300 rounded-xl overflow-x-auto no-scrollbar bg-slate-100 p-0.5">
                    {episodeOptions.map((opt) => (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setSettings(s => ({ ...s, episodeCount: opt }))}
                        className={`flex-1 min-w-[36px] flex items-center justify-center h-[30px] text-xs font-bold transition-all cursor-pointer rounded-lg px-1 shrink-0 ${
                          settings.episodeCount === opt 
                            ? 'bg-indigo-600 text-white shadow-sm font-black' 
                            : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                        }`}
                      >
                        <span className="truncate">{formatEpisodeLabel(opt)}</span>
                      </button>
                    ))}
                  </div>
                </div>
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
                <div className="flex flex-col gap-2.5">
                  <div className="flex flex-col gap-1.5 w-full">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <span className="material-symbols-outlined text-[16px] text-indigo-600">movie_creation</span>
                        {settings.productionMode === 'mv' ? '先行カット数' : '生成カット数'}
                      </span>
                      <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                        <span className="text-[10px] text-slate-500 font-bold">自由指定:</span>
                        <input 
                          type="number" 
                          min="1" 
                          max="9999"
                          value={settings.previewCutCount || 30}
                          onChange={e => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val) && val > 0) {
                              setSettings(s => ({ ...s, previewCutCount: val }));
                            }
                          }}
                          className="w-14 h-6 px-1 text-center text-xs font-black text-indigo-700 bg-white border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-[11px] font-bold text-slate-600">枚</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap w-full items-center gap-1 border border-slate-300 rounded-xl bg-slate-100 p-1">
                      {cutPresetOptions.map((opt) => {
                        const isSelected = settings.previewCutCount === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setSettings(s => ({ ...s, previewCutCount: opt.value }))}
                            className={`flex-1 min-w-[50px] h-[30px] flex items-center justify-center text-xs font-bold transition-all cursor-pointer rounded-lg ${
                              isSelected 
                                ? 'bg-indigo-600 text-white shadow-sm font-black' 
                                : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                            }`}
                          >
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <SegmentedToggle label="動画化する割合" value={settings.videoRatio} onChange={v => setSettings(s => ({ ...s, videoRatio: v as any }))} items={VIDEO_RATIO_OPTIONS} />
                </div>
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
