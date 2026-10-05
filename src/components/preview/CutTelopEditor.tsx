import React, { useState } from 'react';
import { Cut } from '../../types';
import { 
  TELOP_STYLE_REGISTRY,
  TELOP_TRANSITION_REGISTRY,
  TELOP_POSITION_REGISTRY,
  STUDIO_NEON_PALETTE,
  resolveTelopStyle,
  resolveTelopTransition,
  resolveTelopPosition,
  resolveRecommendedTelopStaging
} from '../../constants';
import { extractHighlights } from '../../services/directorService';
import { TextInput, SectionLabel, ToggleSwitch, FieldDropdown } from '../Primitives';

interface CutTelopEditorProps {
  cut: Cut;
  episodeId: number;
  showTelop: boolean;
  setShowTelop: (show: boolean) => void;
  onUpdateCut: (updates: Partial<Cut>) => void;
  onBulkRerollTelop?: (epId: number) => void;
  isMvMode?: boolean;
}

export const CutTelopEditor: React.FC<CutTelopEditorProps> = ({
  cut,
  episodeId,
  showTelop,
  setShowTelop,
  onUpdateCut,
  onBulkRerollTelop,
  isMvMode
}) => {
  const [newKeyword, setNewKeyword] = useState('');

  const rerollStaging = () => {
    const isHist = cut.scenePlot?.includes('時代劇') || cut.promptEn?.includes('samurai') || false; // Approximation
    const staging = resolveRecommendedTelopStaging(cut.id, !!isMvMode, isHist, cut.telop);
    onUpdateCut({
      telop: {
        fullText: cut.telop?.fullText || '',
        highlights: cut.telop?.highlights || [],
        style: staging.style,
        transition: staging.transition,
        position: staging.position,
        directorNote: staging.directorNote
      }
    });
  };

  const handleAddKeyword = () => {
    const target = newKeyword.trim();
    if (!target) return;
    const currentHighlights = cut.telop?.highlights || [];
    if (!currentHighlights.some(h => h.word === target)) {
      const next = [...currentHighlights, { word: target, color: '#FFE600', sizeScale: 1.1 }];
      onUpdateCut({ telop: { ...cut.telop!, fullText: cut.telop?.fullText || '', highlights: next } });
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (wordToRemove: string) => {
    const currentHighlights = cut.telop?.highlights || [];
    const next = currentHighlights.filter(h => h.word !== wordToRemove);
    onUpdateCut({ telop: { ...cut.telop!, fullText: cut.telop?.fullText || '', highlights: next } });
  };

  const telopText = cut.telop?.fullText || '';
  const currentHighlights = cut.telop?.highlights || [];
  const words = telopText.split(/([、。！？\s\n])/).filter(Boolean);

  const styleDef = resolveTelopStyle(cut.telop?.style);
  const isKineticPop = styleDef.id === 'mv-kinetic-pop';

  return (
    <>
      <div className="flex items-center justify-between">
        <SectionLabel>テロップ設定</SectionLabel>
        <button
          type="button"
          onClick={rerollStaging}
          className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-500/20 hover:bg-purple-500/35 text-purple-300 border border-purple-500/40 flex items-center gap-1 transition-all"
          title="画像は変更せず、このカットのテロップ演出（動き・配置・スタイル）だけを再抽選します"
        >
          <span className="material-symbols-outlined text-[13px]">casino</span>
          演出リロール
        </button>
      </div>

      <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 flex flex-col gap-3">
        <ToggleSwitch label="字幕を表示する" checked={showTelop} onChange={setShowTelop} />
        
        <TextInput 
          label="字幕テキスト" 
          value={cut.telop?.fullText || ''} 
          onChange={v => {
            const currentHighlights = cut.telop?.highlights || [];
            const validExisting = currentHighlights.filter(h => h.word && v.includes(h.word));
            const nextHighlights = validExisting.length > 0 ? validExisting : extractHighlights(v);
            onUpdateCut({ telop: { ...cut.telop!, fullText: v, highlights: nextHighlights } });
          }} 
        />

        {/* ── 🎬 Vook風テロップ演出セレクター ── */}
        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
          <FieldDropdown 
            label="演出スタイル" 
            value={TELOP_STYLE_REGISTRY.find(s => s.id === cut.telop?.style)?.name || TELOP_STYLE_REGISTRY[0].name} 
            options={TELOP_STYLE_REGISTRY.map(s => s.name)} 
            onChange={name => {
              const found = TELOP_STYLE_REGISTRY.find(s => s.name === name);
              if (found) {
                onUpdateCut({ 
                  telop: { 
                    ...cut.telop!, 
                    style: found.id,
                    transition: found.defaultTransition
                  } 
                });
              }
            }} 
          />
          <FieldDropdown 
            label="アニメーション" 
            value={TELOP_TRANSITION_REGISTRY.find(s => s.id === cut.telop?.transition)?.name || TELOP_TRANSITION_REGISTRY[0].name} 
            options={TELOP_TRANSITION_REGISTRY.map(s => s.name)} 
            onChange={name => {
              const found = TELOP_TRANSITION_REGISTRY.find(s => s.name === name);
              if (found) onUpdateCut({ telop: { ...cut.telop!, fullText: cut.telop?.fullText || '', transition: found.id } });
            }} 
          />
          <div className="col-span-2 mt-1">
            <FieldDropdown 
              label="配置レイアウト" 
              value={TELOP_POSITION_REGISTRY.find(s => s.id === cut.telop?.position)?.name || TELOP_POSITION_REGISTRY[0].name} 
              options={TELOP_POSITION_REGISTRY.map(s => s.name)} 
              onChange={name => {
                const found = TELOP_POSITION_REGISTRY.find(s => s.name === name);
                if (found) onUpdateCut({ telop: { ...cut.telop!, fullText: cut.telop?.fullText || '', position: found.id } });
              }} 
            />
          </div>
        </div>

        {/* ── ✨ キーワードハイライト制御 ── */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-black text-amber-400">✨ ハイライト検出</label>
            <span className="text-[10px] text-white/40">Kinetic Pop等はハイライト単語に演出が乗ります</span>
          </div>
          
          <div className="bg-black/40 rounded-lg p-2.5 border border-white/5 flex flex-col gap-2">
            <div className="text-[11px] leading-relaxed break-all">
              {words.map((word, i) => {
                const isPunctuation = /^[、。！？\s\n]+$/.test(word);
                const isHighlight = !isPunctuation && currentHighlights.some(h => h.word === word);
                return (
                  <span 
                    key={i} 
                    className={`transition-colors ${isPunctuation ? 'opacity-30' : ''} ${
                      isHighlight ? 'text-amber-300 font-black px-0.5 mx-0.5 rounded bg-amber-500/10 border-b border-amber-500/30' : 'text-white/80'
                    }`}
                  >
                    {word}
                  </span>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-1.5 mt-1 border-t border-white/10 pt-2">
              {currentHighlights.length > 0 ? (
                currentHighlights.map((h, i) => {
                  const isMatch = words.includes(h.word);
                  return (
                    <span 
                      key={i} 
                      className={`px-2 py-0.5 rounded-md border text-[10px] font-bold flex items-center gap-1 transition-all ${
                        isMatch 
                          ? 'bg-amber-500/15 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(255,230,0,0.2)]' 
                          : 'bg-white/5 border-white/10 text-white/35'
                      }`}
                    >
                      <span>{isMatch ? '✨' : '⚠️'} {h.word}</span>
                      <span className={`text-[9px] ${isMatch ? 'text-amber-400/80 font-normal' : 'text-white/20'}`}>
                        {isMatch ? '(点灯中)' : '(未出現)'}
                      </span>
                      <button 
                        type="button"
                        onClick={() => handleRemoveKeyword(h.word)}
                        className="ml-0.5 hover:text-red-400 transition-colors flex items-center"
                        title="キーワードから削除"
                      >
                        <span className="material-symbols-outlined text-[11px]">close</span>
                      </button>
                    </span>
                  );
                })
              ) : (
                <span className="text-[10px] text-white/30 italic">キーワードなし（すべて白色で表示中）</span>
              )}
            </div>

            <div className="flex gap-1.5 mt-1">
              <input 
                type="text" 
                value={newKeyword} 
                onChange={e => setNewKeyword(e.target.value)} 
                onKeyDown={e => e.key === 'Enter' && handleAddKeyword()}
                placeholder="強調する単語を追加..." 
                className="flex-1 bg-black/50 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] outline-none focus:border-amber-400/70 text-white placeholder:text-white/25"
              />
              <button 
                type="button" 
                onClick={handleAddKeyword}
                disabled={!newKeyword.trim()}
                className="px-2.5 py-1 bg-white/10 hover:bg-amber-500 hover:text-black text-white text-[11px] font-bold rounded-lg border border-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
              >
                ＋追加
              </button>
            </div>
          </div>
        </div>

        {isKineticPop && (
          <div className="flex flex-col gap-1.5 pt-2 border-t border-white/5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-black text-[#FFE600]">🎨 Kinetic Pop カラー指定</label>
              <span className="text-[10px] text-white/40">※強調ワードごとに色を変えられます</span>
            </div>
            
            <div className="bg-black/30 rounded-lg p-2 border border-white/5 flex flex-col gap-2 max-h-[140px] overflow-y-auto dark-scrollbar">
              {currentHighlights.length > 0 ? (
                currentHighlights.map((h, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-white/5 rounded-md p-1.5">
                    <span className="text-[11px] font-black text-white w-16 truncate flex-shrink-0" title={h.word}>{h.word}</span>
                    <div className="flex flex-wrap gap-1 flex-1">
                      {STUDIO_NEON_PALETTE.map((c, cIdx) => (
                        <button
                          key={cIdx}
                          type="button"
                          onClick={() => {
                            const updatedHighlights = [...currentHighlights];
                            updatedHighlights[idx] = { ...h, color: c.color };
                            onUpdateCut({ telop: { ...cut.telop!, fullText: cut.telop?.fullText || '', highlights: updatedHighlights } });
                          }}
                          className={`w-4 h-4 rounded-full border border-white/20 transition-all ${h.color === c.color ? 'ring-2 ring-white scale-110' : 'hover:scale-110 opacity-70 hover:opacity-100'}`}
                          style={{ backgroundColor: c.color }}
                          title={c.color}
                        />
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                <span className="text-[10px] text-white/30 italic p-1">ハイライト単語を追加してください</span>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1 border-t border-white/5">
          <button
            type="button"
            onClick={rerollStaging}
            className="flex-1 py-1.5 px-2.5 rounded-lg text-[10px] font-black bg-purple-500/25 hover:bg-purple-500/40 text-purple-200 border border-purple-500/50 flex items-center justify-center gap-1 transition-all shadow-md shadow-purple-950/20"
            title="画像は変更せず、このカットのテロップ演出（動き・配置・スタイル）だけを再抽選します"
          >
            <span className="material-symbols-outlined text-[13px]">casino</span>
            このカットの演出を再抽選
          </button>
          {onBulkRerollTelop && (
            <button
              type="button"
              onClick={() => onBulkRerollTelop(episodeId)}
              className="py-1.5 px-3 rounded-lg text-[10px] font-black bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 flex items-center justify-center gap-1 transition-all"
              title="全12カットのテロップ演出を一気に再抽選（画像は保持）"
            >
              <span className="material-symbols-outlined text-[13px]">auto_mode</span>
              全カット一括リロール
            </button>
          )}
        </div>
      </div>
    </>
  );
};
