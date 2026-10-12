import React from 'react';
import { ProductionMode } from '../../types';

export interface ProduceModeOption {
  value: ProductionMode;
  label: string;
  icon: string;
  badge: string;
  desc: string;
}

export const AVAILABLE_PRODUCE_MODES: ProduceModeOption[] = [
  { value: 'episodes', label: '🎬 ドラマ連番', icon: 'movie', badge: '映画字幕', desc: '重厚なストーリー連載・長編大河ドラマ' },
  { value: 'mv', label: '🎵 音楽MV', icon: 'music_note', badge: '歌詞テロップ', desc: '楽曲連動・Ado風シネマティックMV' },
  { value: 'manga', label: '📖 短編マンガ', icon: 'auto_stories', badge: '漫画コマ割り', desc: 'フキダシ・効果音付きの読み切り漫画' },
  { value: 'trivia', label: '💡 雑学Shorts', icon: 'lightbulb', badge: 'TikTok特化', desc: '冒頭フック＆衝撃オチの解説動画' },
  { value: 'manzai', label: '🎙️ 漫才・掛け合い', icon: 'record_voice_over', badge: '演芸掛け合い', desc: 'テンポ良いボケ＆ツッコミの掛け合い劇' },
  { value: 'quotes', label: '📜 偉人・名言', icon: 'history_edu', badge: '格言・哲学', desc: '心に刺さる人生訓・厳粛な縦書き墨文字' },
  { value: 'folklore', label: '👻 怪異・未解決', icon: 'visibility', badge: '考察・ミステリー', desc: '背筋凍る怪奇譚・深紅ハイライト' },
  { value: 'craft', label: '🔨 職人技・伝統', icon: 'precision_manufacturing', badge: '至高の手仕事', desc: '神業ディテール・至高のドキュメンタリー' },
];

interface WizardProductionModeCardGridProps {
  productionMode: ProductionMode;
  currentModeConfig: { label: string; [key: string]: any };
  onModeChange: (newMode: ProductionMode) => void;
}

export const WizardProductionModeCardGrid: React.FC<WizardProductionModeCardGridProps> = ({
  productionMode,
  currentModeConfig,
  onModeChange,
}) => {
  return (
    <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-2xs">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-black text-slate-800 flex items-center gap-1.5 uppercase tracking-wider">
            <span className="material-symbols-outlined text-sm text-indigo-600">category</span>
            ① 制作大枠・ジャンル (Production Mode)
          </label>
          <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200/60 font-bold">
            ※ 選択したジャンルに合わせてテーマ・話数・AI演出が全自動で最適化されます
          </span>
        </div>
        <div className="text-[11px] font-bold text-slate-500">
          現在の大枠: <span className="text-indigo-600 font-extrabold">{currentModeConfig.label}</span>
        </div>
      </div>

      {/* 大枠カード一覧 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {AVAILABLE_PRODUCE_MODES.map((mode) => {
          const isSelected = productionMode === mode.value;
          return (
            <button
              key={mode.value}
              type="button"
              onClick={() => onModeChange(mode.value)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer relative flex flex-col gap-1 ${
                isSelected
                  ? 'bg-gradient-to-br from-indigo-50/90 to-purple-50/90 border-indigo-500 ring-2 ring-indigo-500/30 shadow-xs'
                  : 'bg-slate-50/60 hover:bg-slate-100/80 border-slate-200 hover:border-slate-300 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black flex items-center gap-1 text-slate-900">
                  <span className="material-symbols-outlined text-[16px] text-indigo-600">{mode.icon}</span>
                  {mode.label}
                </span>
                {isSelected && (
                  <span className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center text-[10px] font-bold shadow-xs">
                    ✓
                  </span>
                )}
              </div>
              <span className="text-[10px] text-slate-500 line-clamp-1 leading-snug">
                {mode.desc}
              </span>
              <span className="inline-block text-[9px] px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-700 font-bold w-fit mt-0.5">
                {mode.badge}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
