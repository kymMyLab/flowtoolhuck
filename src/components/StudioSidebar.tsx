import React, { useState, useRef, useEffect, useMemo } from 'react';
import { GeneratorSettings, Episode, LogEntry } from '../types';
import { IMAGE_MODELS, SAFE_CHARACTERS } from '../constants';

// ── UI 基本プリミティブ ──────────────────────────────────────
export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center px-1">
    <span className="text-xs font-bold text-slate-700 tracking-wide">
      {children}
    </span>
  </div>
);

export const PillButton: React.FC<{
  icon?: React.ReactNode; 
  children: React.ReactNode;
  variant?: 'filled' | 'outline' | 'solid'; 
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
}> = ({ icon, children, variant = 'filled', onClick, disabled, className = '', title }) => {
  const base = 'flex items-center gap-1.5 justify-center h-[36px] rounded-xl font-bold tracking-wide transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed text-xs';
  const variants: Record<string, string> = {
    filled: 'bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white px-4 shadow-sm select-none',
    outline: 'border border-slate-300 hover:bg-slate-100 active:bg-slate-200 text-slate-700 px-3.5 select-none bg-white',
    solid: 'bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-800 px-3.5 select-none border border-slate-200',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} onClick={onClick} disabled={disabled} title={title}>
      {icon && <span className="flex items-center justify-center w-5 h-5">{icon}</span>}
      <span>{children}</span>
    </button>
  );
};

export interface FieldDropdownOption {
  label: string;
  value: string;
  sublabel?: string;
}

export const FieldDropdown: React.FC<{
  label: string; 
  value: string; 
  options?: (string | FieldDropdownOption)[];
  groups?: { label: string; items: string[] }[];
  onChange: (val: string) => void; 
  className?: string;
  disabled?: boolean;
}> = ({ label, value, options = [], groups, onChange, className = '', disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const listener = (event: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(event.target as Node)) return;
      setIsOpen(false);
    };
    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, []);

  const selectedOpt = useMemo(() => {
    return options.find(o => (typeof o === 'string' ? o : o.value) === value) as FieldDropdownOption | string | undefined;
  }, [options, value]);

  const selectedLabel = typeof selectedOpt === 'object' ? selectedOpt?.label : value;

  return (
    <div ref={ref} className={`relative ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <button 
        type="button" 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="w-full text-left bg-white border border-slate-300 hover:border-indigo-400 focus:border-indigo-500 transition-all rounded-xl flex flex-col gap-0.5 justify-center py-1.5 px-2.5 select-none focus:outline-none shadow-sm cursor-pointer"
        disabled={disabled}
      >
        {label && <p className="text-[10px] font-bold text-slate-500 leading-tight">{label}</p>}
        <div className="flex items-center justify-between w-full gap-1.5">
          <div className="flex items-center gap-2 min-w-0 pr-1 flex-1">
            <span className="text-xs font-bold text-slate-900 leading-snug break-words truncate">
              {selectedLabel || value}
            </span>
          </div>
          {!disabled && (
            <span className={`material-symbols-outlined text-[18px] text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-indigo-600' : ''}`}>keyboard_arrow_down</span>
          )}
        </div>
      </button>
      {isOpen && !disabled && (
        <div className="absolute z-50 top-[calc(100%+6px)] left-0 w-max min-w-[340px] max-w-[560px] bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xl animate-dropdown origin-top max-h-[520px] overflow-y-auto dark-scrollbar">
          {groups ? (
            groups.map((grp) => (
              <div key={grp.label} className="border-b border-slate-100 last:border-b-0 pb-1">
                <div className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-slate-50 sticky top-0 backdrop-blur-md z-10 flex items-center gap-1.5 border-b border-slate-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0"></span>
                  <span className="truncate">{grp.label}</span>
                </div>
                {grp.items.map((opt) => (
                  <button 
                    key={opt} 
                    type="button"
                    className={`w-full text-left px-3 py-2 text-xs font-semibold transition-colors flex items-center justify-between gap-2 border-b border-slate-50 last:border-b-0 cursor-pointer ${
                      value === opt 
                        ? 'bg-indigo-50 text-indigo-700 font-bold' 
                        : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                    onClick={() => { onChange(opt); setIsOpen(false); }}
                  >
                    <span className="break-words leading-relaxed">{opt}</span>
                    {value === opt && <span className="material-symbols-outlined text-[16px] text-indigo-600 shrink-0 ml-1">check</span>}
                  </button>
                ))}
              </div>
            ))
          ) : options.length > 0 ? (
            options.map((opt) => {
              const optVal = typeof opt === 'string' ? opt : opt.value;
              const optLabel = typeof opt === 'string' ? opt : opt.label;
              const optSub = typeof opt === 'object' ? opt.sublabel : undefined;
              return (
                <button 
                  key={optVal} 
                  type="button"
                  className={`w-full text-left px-3.5 py-2.5 transition-all flex items-center justify-between gap-3.5 border-b border-slate-100 last:border-b-0 cursor-pointer group ${
                    value === optVal 
                      ? 'bg-indigo-50/80 text-indigo-700 font-bold' 
                      : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  onClick={() => { onChange(optVal); setIsOpen(false); }}
                >
                  <div className="flex flex-col justify-center min-w-0 flex-1 py-0.5">
                    <span className="text-[13px] font-bold text-slate-900 break-words leading-snug group-hover:text-indigo-600 transition-colors">
                      {optLabel}
                    </span>
                    {optSub && (
                      <p className="text-xs text-slate-500 font-normal leading-relaxed line-clamp-2 mt-1">
                        {optSub}
                      </p>
                    )}
                  </div>
                  {value === optVal && <span className="material-symbols-outlined text-[20px] text-indigo-600 shrink-0 ml-1">check_circle</span>}
                </button>
              );
            })
          ) : (
            <div className="p-3 text-xs text-slate-400 text-center font-medium">選択肢がありません</div>
          )}
        </div>
      )}
    </div>
  );
};

export const TextInput: React.FC<{
  value: string; onChange: (val: string) => void; placeholder?: string; label?: string; multiline?: boolean;
}> = ({ value, onChange, placeholder, label, multiline = true }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <p className="text-xs font-bold text-slate-600 px-1">{label}</p>}
    {multiline ? (
      <textarea 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        placeholder={placeholder}
        className="border border-slate-300 hover:border-indigo-400 focus:border-indigo-500 rounded-xl w-full h-[64px] px-3 py-2 resize-none bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors shadow-sm" 
      />
    ) : (
      <input 
        type="text" 
        value={value} 
        onChange={(e) => onChange(e.target.value)} 
        placeholder={placeholder}
        className="border border-slate-300 hover:border-indigo-400 focus:border-indigo-500 rounded-xl w-full h-[38px] px-3 bg-white text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none transition-colors shadow-sm" 
      />
    )}
  </div>
);

export const NumberChoice: React.FC<{
  label: string;
  value: number;
  options: number[];
  unit?: string;
  onChange: (val: number) => void;
  formatLabel?: (val: number) => string;
}> = ({ label, value, options, unit = '', onChange, formatLabel }) => (
  <div className="flex flex-col gap-1 w-full">
    <p className="text-xs font-bold text-slate-600 px-1">{label}</p>
    <div className="flex w-full items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-100 p-0.5">
      {options.map((num) => (
        <button
          key={num}
          type="button"
          onClick={() => onChange(num)}
          className={`flex-1 flex items-center justify-center h-[32px] text-xs font-bold transition-all cursor-pointer rounded-lg ${
            value === num 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <span>{formatLabel ? formatLabel(num) : `${num}${unit}`}</span>
        </button>
      ))}
    </div>
  </div>
);

// ── サイドバー本体 ──────────────────────────────────────────
interface StudioSidebarProps {
  settings: GeneratorSettings;
  setSettings: React.Dispatch<React.SetStateAction<GeneratorSettings>>;
  isProducing: boolean;
  onAddLog: (msg: string, type?: LogEntry['type']) => void;
  episodes?: Episode[];
}

export const StudioSidebar: React.FC<StudioSidebarProps> = ({
  settings, setSettings, isProducing
}) => {
  const [isWorldOpen, setIsWorldOpen] = useState(true);
  const [isVolumeOpen, setIsVolumeOpen] = useState(true);

  const cutPresetOptions = [
    { value: 2, label: '2枚 (テスト)' },
    { value: 5, label: '5枚' },
    { value: 12, label: '12枚' },
    { value: 24, label: '24枚 (標準)' }
  ];

  const episodeOptions = React.useMemo(() => {
    const base = [1, 2, 4, 10, 20];
    if (!base.includes(settings.episodeCount)) {
      return [...base, settings.episodeCount].sort((a, b) => a - b);
    }
    return base;
  }, [settings.episodeCount]);

  const selectedChar = SAFE_CHARACTERS.find(c => c.id === settings.characterId);

  return (
    <div className="w-[420px] border-r border-slate-200 flex flex-col p-2.5 shrink-0 bg-slate-50 z-10 shadow-sm h-full overflow-hidden">
      <div className="flex flex-col gap-2 overflow-y-auto pr-1 dark-scrollbar flex-1 py-2">
        {/* ① 主役キャラ・リファレンス */}
        <div className={`flex flex-col rounded-xl border border-slate-200 bg-white transition-all shadow-sm ${isWorldOpen ? 'overflow-visible relative z-30' : 'overflow-hidden'}`}>
          <button
            type="button"
            onClick={() => setIsWorldOpen(!isWorldOpen)}
            className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer select-none text-left"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="material-symbols-outlined text-[18px] text-purple-600 shrink-0">face</span>
              <span className="text-xs font-bold text-slate-800 tracking-wide truncate">主役キャラ・リファレンス</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-bold border border-emerald-200 max-w-[160px] truncate">
                {selectedChar ? `${selectedChar.icon} ${selectedChar.nameJa}` : 'テーマ自動'}
              </span>
              <span className={`material-symbols-outlined text-[20px] text-slate-400 transition-transform duration-200 ${isWorldOpen ? 'rotate-180 text-purple-600' : ''}`}>
                expand_more
              </span>
            </div>
          </button>
          
          {isWorldOpen && (
            <div className="p-3 flex flex-col gap-3 border-t border-slate-200 animate-in fade-in duration-200">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between px-0.5">
                  <span className="text-xs font-bold text-slate-700">👤 主役キャラクター固定</span>
                  <span className="text-[10px] text-emerald-600 font-bold">VOICEVOX収益化OK</span>
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {SAFE_CHARACTERS.map(char => {
                    const isSelected = settings.characterId === char.id;
                    return (
                      <button
                        key={char.id}
                        type="button"
                        disabled={isProducing}
                        onClick={() => setSettings(s => ({ ...s, characterId: char.id }))}
                        className={`px-2 py-1.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-1.5 ${
                          isSelected
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-black'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 font-bold'
                        }`}
                      >
                        <span className="text-sm shrink-0">{char.icon}</span>
                        <span className="text-[11px] truncate">{char.nameJa}</span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    disabled={isProducing}
                    onClick={() => setSettings(s => ({ ...s, characterId: '' }))}
                    className={`px-2 py-1.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-1.5 ${
                      !settings.characterId
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm font-black'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100 font-bold'
                    }`}
                  >
                    <span className="text-sm shrink-0">🎭</span>
                    <span className="text-[11px] truncate">テーマ自動</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ② 制作ボリューム・配分 */}
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
                {settings.episodeCount}話 / {settings.previewCutCount}枚
              </span>
              <span className={`material-symbols-outlined text-[20px] text-slate-400 transition-transform duration-200 ${isVolumeOpen ? 'rotate-180 text-amber-500' : ''}`}>
                expand_more
              </span>
            </div>
          </button>

          {isVolumeOpen && (
            <div className="p-3 flex flex-col gap-3 border-t border-slate-200 animate-in fade-in duration-200">
              <div className="flex flex-col gap-1 w-full">
                <div className="flex items-center justify-between px-0.5">
                  <p className="text-xs font-bold text-slate-600 truncate">生成話数</p>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-slate-400 font-medium">指定:</span>
                    <input 
                      type="number" 
                      min="1" 
                      max="999"
                      value={settings.episodeCount || 1}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        if (!isNaN(val) && val > 0) {
                          setSettings(s => ({ ...s, episodeCount: Math.min(val, 999) }));
                        }
                      }}
                      className="w-12 h-5 px-1 text-center text-xs font-black text-indigo-700 bg-white border border-indigo-200 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-inner"
                    />
                    <span className="text-[10px] font-bold text-slate-500">話</span>
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
                      <span className="truncate">{opt}話</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5 w-full">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[16px] text-indigo-600">photo_library</span>
                    1話あたりの作画枚数
                  </span>
                  <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                    <span className="text-[10px] text-slate-500 font-bold">自由指定:</span>
                    <input 
                      type="number" 
                      min="1" 
                      max="9999"
                      value={settings.previewCutCount || 2}
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
                        className={`flex-1 min-w-[60px] h-[30px] flex items-center justify-center text-xs font-bold transition-all cursor-pointer rounded-lg ${
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

              {/* 内部固定ステータス表示 */}
              <div className="flex flex-col gap-1.5 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 select-none">
                <div className="flex items-center justify-between text-[11px] font-bold">
                  <span className="flex items-center gap-1 text-slate-700">
                    <span className="material-symbols-outlined text-[14px] text-amber-500">palette</span>
                    画像モデル
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-black text-[10px]">
                    🍌 2.1 (429時: Pro/Lite自動切替)
                  </span>
                </div>
                <div className="flex items-center justify-between text-[11px] font-bold pt-1 border-t border-slate-200/60">
                  <span className="flex items-center gap-1 text-slate-700">
                    <span className="material-symbols-outlined text-[14px] text-indigo-500">speed</span>
                    並列処理
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-black">2並列（最適化固定）</span>
                </div>
                <div className="flex flex-col gap-0.5 pt-1 border-t border-slate-200/60 text-[10px]">
                  <div className="flex items-center justify-between font-bold text-slate-700">
                    <span className="flex items-center gap-1">
                      <span className="material-symbols-outlined text-[13px] text-amber-500">published_with_changes</span>
                      指数バックオフ待機
                    </span>
                    <span className="text-emerald-700 font-extrabold">常時有効 (夜間放置完走)</span>
                  </div>
                  <span className="text-slate-500 font-mono text-[9.5px] mt-0.5 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    5秒 → 30秒 → 60秒 → 120秒 → 10分 → 20分 → 40分
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
