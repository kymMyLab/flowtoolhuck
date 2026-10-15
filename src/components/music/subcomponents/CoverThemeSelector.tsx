import React from 'react';
import { COVER_PALETTES, getCoverPalettesForGenre, CoverPalette } from '../../../services/export/coverRenderer';

export interface CoverThemeSelectorProps {
  selectedCoverThemeId: string;
  onSelectCoverThemeId: (themeId: string) => void;
  autoTheme: CoverPalette;
  onRerollTheme: () => void;
}

export const CoverThemeSelector: React.FC<CoverThemeSelectorProps> = ({
  selectedCoverThemeId,
  onSelectCoverThemeId,
  autoTheme,
  onRerollTheme,
}) => {
  const currentPalette = selectedCoverThemeId === 'auto' 
    ? autoTheme 
    : (COVER_PALETTES[selectedCoverThemeId] || autoTheme);

  return (
    <div className="flex flex-col gap-2 p-4 bg-white/5 rounded-xl border border-white/10 shadow-sm relative shrink-0 group">
      <div className="flex items-center justify-between relative z-10">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px] text-purple-400">palette</span>
          <span className="text-sm font-bold text-white">🎨 サムネイル配色テーマ設定</span>
        </div>
        <span className="text-[10px] text-purple-300/90 font-mono bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30 font-bold">
          1セッション内全曲統一
        </span>
      </div>
      <p className="text-[10px] text-white/50 relative z-10">
        今回のインポートで生成される全12カットMVの扉絵（9:16・16:9）の看板カラー・アクセントを決定します。次回実行時は自動で上品に変奏されます。
      </p>

      <div className="relative z-10 mt-1 flex items-center gap-2">
        <div className="relative flex-1">
          <select
            value={selectedCoverThemeId}
            onChange={(e) => onSelectCoverThemeId(e.target.value)}
            className="w-full p-2.5 rounded-lg bg-black/60 border border-purple-500/30 text-xs font-bold text-white outline-none focus:border-purple-400 hover:border-purple-500/50 appearance-none transition-colors cursor-pointer shadow-inner"
            style={{ paddingRight: '2rem' }}
          >
            <option value="auto">
              🎲 ランダム自動セレクト（今回の選定: {autoTheme.name}）
            </option>
            {getCoverPalettesForGenre('mv').map(p => (
              <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                {p.name}
              </option>
            ))}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-purple-400 flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px]">expand_more</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onRerollTheme}
          title="別の配色テーマをランダム再抽選"
          className="px-3 py-2.5 rounded-lg bg-purple-900/40 hover:bg-purple-800/60 border border-purple-500/40 hover:border-purple-400 text-purple-200 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-sm hover:scale-[1.02] shrink-0 active:scale-95"
        >
          <span className="material-symbols-outlined text-[16px] text-purple-300">casino</span>
          <span>再抽選</span>
        </button>
      </div>

      {/* カラープレビューストリップ */}
      <div className="flex items-center gap-2.5 mt-1.5 p-2 bg-black/40 rounded-lg border border-white/5 relative z-10 shadow-sm">
        <div 
          className="w-16 h-5 rounded border border-white/20 shadow-inner shrink-0"
          style={{
            background: `linear-gradient(to right, ${currentPalette.borderColors[0]}, ${currentPalette.borderColors[1]}, ${currentPalette.borderColors[2]})`
          }}
        />
        <div className="flex-1 flex items-center justify-between text-[10px]">
          <span className="font-bold text-white/90">{currentPalette.name}</span>
          <span 
            className="px-2 py-0.5 rounded font-mono font-bold text-[9px] border"
            style={{ 
              color: currentPalette.badgeColor,
              borderColor: `${currentPalette.badgeColor}40`,
              backgroundColor: `${currentPalette.badgeColor}15`
            }}
          >
            {currentPalette.badgeColor}
          </span>
        </div>
      </div>
    </div>
  );
};
