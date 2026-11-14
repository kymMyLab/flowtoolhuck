import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { GeneratorSettings, Episode, LogEntry, ExecutionProfileType } from '../types';
import { SAFE_CHARACTERS } from '../constants';
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
            <span className="text-xs font-bold text-slate-800 truncate block">
              {selectedLabel || '選択してください'}
            </span>
          </div>
          <span className="material-symbols-outlined text-[16px] text-slate-500 transition-transform shrink-0">
            {isOpen ? 'expand_less' : 'expand_more'}
          </span>
        </div>
      </button>
      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 w-full min-w-[240px] bg-white border border-slate-200 rounded-xl shadow-xl z-50 max-h-[300px] overflow-y-auto py-1">
          {groups ? (
            groups.map((grp) => (
              <div key={grp.label} className="border-b border-slate-100 last:border-b-0">
                <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-50">
                  {grp.label}
                </div>
                {grp.items.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={`w-full text-left px-3 py-2 text-xs transition-colors flex items-center justify-between cursor-pointer ${
                      value === item 
                        ? 'bg-indigo-50 text-indigo-700 font-bold' 
                        : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                    onClick={() => { onChange(item); setIsOpen(false); }}
                  >
                    <span className="truncate pr-2">{item}</span>
                    {value === item && <span className="material-symbols-outlined text-[16px] text-indigo-600 shrink-0">check</span>}
                  </button>
                ))}
              </div>
            ))
          ) : options && options.length > 0 ? (
            options.map((opt) => {
              const optVal = typeof opt === 'object' ? opt.value : opt;
              const optLabel = typeof opt === 'object' ? opt.label : opt;
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
        className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl p-2.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-colors resize-none shadow-sm"
        rows={3} 
        value={value} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder} 
      />
    ) : (
      <input 
        type="text" 
        className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-2.5 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none transition-colors shadow-sm"
        value={value} 
        onChange={e => onChange(e.target.value)} 
        placeholder={placeholder} 
      />
    )}
  </div>
);
// ── サイドバー本体 ──────────────────────────────────────────
export interface StudioSidebarProps {
  settings: GeneratorSettings;
  setSettings?: React.Dispatch<React.SetStateAction<GeneratorSettings>>;
  onUpdateSettings?: (partial: Partial<GeneratorSettings>) => void;
  manifestTitle?: string;
  isProducing?: boolean;
  onStartProduction?: () => void;
  onAbortProduction?: () => void;
  episodes?: Episode[];
  onClearEpisodes?: () => void;
  logs?: LogEntry[];
}
export const StudioSidebar: React.FC<StudioSidebarProps> = ({
  settings,
  setSettings,
  onUpdateSettings,
  isProducing = false,
  onAbortProduction = () => {},
  episodes = [],
  onClearEpisodes,
  logs = []
}) => {
  const [isAccordionOpen, setIsAccordionOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const applySettingsUpdate = (updater: (prev: GeneratorSettings) => GeneratorSettings) => {
    if (setSettings) {
      setSettings(updater);
    } else if (onUpdateSettings) {
      onUpdateSettings(updater(settings));
    }
  };
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs]);
  // 全ログをクリップボードにコピーする処理
  const handleCopyLogs = useCallback(async () => {
    if (logs.length === 0) return;
    try {
      const fullLogText = logs.map(l => l.message).join('\n');
      await navigator.clipboard.writeText(fullLogText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy logs to clipboard:', err);
    }
  }, [logs]);
  const cutPresetOptions = [
    { label: '先行2カット', value: 2 },
    { label: '先行5カット', value: 5 },
    { label: '全カット一括', value: settings.cutCount || 12 }
  ];
  const isRandomChar = settings.characterId === 'random' || !settings.characterId;
  const currentProfile: ExecutionProfileType = settings.executionProfile || 'night_safe';
  return (
    <div className="w-[320px] bg-white border-r border-slate-200 flex flex-col h-full shrink-0 shadow-sm z-30 select-none">
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3 min-h-0">
        {/* 1. キャラクター or 音楽MV専用設定パネル */}
        {settings.productionMode === 'mv' ? (
          <div className="flex flex-col gap-3 shrink-0 p-3 bg-gradient-to-b from-purple-50/80 to-indigo-50/40 border border-purple-200 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between border-b border-purple-200/60 pb-2">
              <div className="flex items-center gap-1.5 text-purple-900">
                <span className="text-base">🎵</span>
                <span className="text-xs font-black tracking-tight">音楽MV (12Cut×AIエモ切り抜き)</span>
              </div>
              <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-purple-600 text-white">
                Lo-Fi日常
              </span>
            </div>
            {/* 1) 曲のバイブス (mvVibe) */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-bold text-slate-700">🌈 曲のバイブス (世界観・色彩)</span>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-white border border-slate-200 rounded-xl">
                <button
                  type="button"
                  onClick={() => applySettingsUpdate(s => ({ ...s, mvVibe: 'pop' }))}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    (settings.mvVibe || 'pop') === 'pop'
                      ? 'bg-amber-500 text-white shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>✨ ポップ・青春</span>
                </button>
                <button
                  type="button"
                  onClick={() => applySettingsUpdate(s => ({ ...s, mvVibe: 'chill' }))}
                  className={`py-1.5 px-2 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    settings.mvVibe === 'chill'
                      ? 'bg-indigo-600 text-white shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>🌙 チル・夜更かし</span>
                </button>
              </div>
            </div>
            {/* 2) 12Cutの構成・画風スタイル (mvStyleMode) */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-700">🎬 12Cutの構成・画風スタイル</span>
                <span className="text-[8.5px] text-purple-700 font-semibold">
                  {(!settings.mvStyleMode || settings.mvStyleMode === 'lofi_loop') ? '無傷1枚絵・破綻ゼロ' : '12枚個別描画'}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-1 p-1 bg-white border border-slate-200 rounded-xl">
                <button
                  type="button"
                  onClick={() => applySettingsUpdate(s => ({ ...s, mvStyleMode: 'lofi_loop' }))}
                  className={`py-1.5 px-2 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer flex items-center justify-between text-left ${
                    (!settings.mvStyleMode || settings.mvStyleMode === 'lofi_loop')
                      ? 'bg-purple-600 text-white shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>🔁</span>
                    <span>1枚絵固定・12種微動 (推奨・破綻ゼロ)</span>
                  </span>
                  {(!settings.mvStyleMode || settings.mvStyleMode === 'lofi_loop') && (
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => applySettingsUpdate(s => ({ ...s, mvStyleMode: 'unified' }))}
                  className={`py-1.5 px-2 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer flex items-center justify-between text-left ${
                    settings.mvStyleMode === 'unified'
                      ? 'bg-purple-600 text-white shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>🎯</span>
                    <span>12シーン・1画風統一 (個別描画)</span>
                  </span>
                  {settings.mvStyleMode === 'unified' && (
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => applySettingsUpdate(s => ({ ...s, mvStyleMode: 'mix' }))}
                  className={`py-1.5 px-2 rounded-lg text-[10.5px] font-bold transition-all cursor-pointer flex items-center justify-between text-left ${
                    settings.mvStyleMode === 'mix'
                      ? 'bg-purple-600 text-white shadow-xs font-black'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <span>🎨</span>
                    <span>12シーン・12Cut合作 (12画風リレー)</span>
                  </span>
                  {settings.mvStyleMode === 'mix' && (
                    <span className="material-symbols-outlined text-[14px]">check</span>
                  )}
                </button>
              </div>
              <p className="text-[8.5px] text-slate-500 font-mono px-1">
                {(!settings.mvStyleMode || settings.mvStyleMode === 'lofi_loop')
                  ? 'Cut 1の同じ無傷の1枚絵（トリミングなし）を全カットに配置し、8秒ごとに異なる微動（髪・服・湯気・タップ等）で破綻なく動画化'
                  : settings.mvStyleMode === 'unified'
                    ? '選択した1つの画風で、全12カットそれぞれ別々のシーン背景を描画'
                    : '12人の絵師がリレー描画するように全12カットで画風が多彩に変化'}
              </p>
            </div>
            {/* 曲タイトル (巨大立体文字用) */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-700">🔤 曲タイトル / 巨大文字英単語</span>
                <span className="text-[8.5px] text-purple-700 font-semibold">背景に巨大立体文字で出現</span>
              </div>
              <input
                type="text"
                value={settings.songTitle || ''}
                onChange={e => applySettingsUpdate(s => ({ ...s, songTitle: e.target.value }))}
                placeholder="例: KIMI & BOKU, MIDNIGHT STEP..."
                className="w-full bg-white border border-purple-300 focus:border-purple-600 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none shadow-2xs font-mono font-bold"
              />
            </div>
            {/* 歌詞テキスト / 情景メモ */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-700">✍️ 歌詞テキスト / 情景メモ (複数行)</span>
                <span className="text-[8.5px] text-slate-500 font-semibold">12Cutへ自動割り当て</span>
              </div>
              <textarea
                value={settings.lyricsMemo || ''}
                onChange={e => applySettingsUpdate(s => ({ ...s, lyricsMemo: e.target.value }))}
                placeholder="夕暮れの教室、伸びるふたつの影&#10;交差点の赤信号、ヘッドホンのビート&#10;雨上がりの水たまりに映るネオン..."
                rows={3}
                className="w-full bg-white border border-purple-300 focus:border-purple-600 rounded-xl p-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none resize-none shadow-2xs leading-relaxed"
              />
            </div>
            {/* 基準キャラ・画風リファレンス画像（任意アップロード枠） */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-700">🖼️ キャラ・画風リファレンス画像</span>
                {settings.refCharacterImageBase64 && (
                  <button
                    type="button"
                    onClick={() => applySettingsUpdate(s => ({ ...s, refCharacterImageBase64: undefined, refCharacterImageMediaId: undefined }))}
                    className="text-[9px] text-red-600 hover:underline cursor-pointer"
                  >
                    解除
                  </button>
                )}
              </div>
              <label className="border border-dashed border-purple-300 hover:border-purple-500 rounded-xl p-2 bg-white/80 flex items-center gap-2 cursor-pointer transition-colors shadow-2xs">
                {settings.refCharacterImageBase64 ? (
                  <img
                    src={`data:image/png;base64,${settings.refCharacterImageBase64.replace(/^data:image\/\w+;base64,/, '')}`}
                    alt="Ref"
                    className="w-8 h-8 rounded-lg object-cover border border-purple-200 shrink-0"
                  />
                ) : (
                  <span className="w-8 h-8 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center material-symbols-outlined text-sm shrink-0">
                    add_photo_alternate
                  </span>
                )}
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[10.5px] font-bold text-slate-800 truncate">
                    {settings.refCharacterImageBase64 ? '参照画像をセット済' : '手持ちイラストをセット (任意)'}
                  </span>
                  <span className="text-[8.5px] text-slate-500 truncate">未セット時はLo-Fi少女を自動生成</span>
                </div>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        const b64 = (reader.result as string).split(',')[1];
                        applySettingsUpdate(s => ({ ...s, refCharacterImageBase64: b64 }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>
            {/* 楽曲音声ファイル（MP3 / WAV / OGG）アップロード枠 */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-700">🎵 楽曲音声ファイル (音ハメ・動画用)</span>
                {settings.songAudioBase64 && (
                  <button
                    type="button"
                    onClick={() => applySettingsUpdate(s => ({
                      ...s,
                      songAudioBase64: undefined,
                      songAudioMimeType: undefined,
                      songAudioFilename: undefined
                    }))}
                    className="text-[9px] text-red-600 hover:underline cursor-pointer"
                  >
                    解除
                  </button>
                )}
              </div>
              <label className="border border-dashed border-indigo-300 hover:border-indigo-500 rounded-xl p-2 bg-white/80 flex items-center gap-2 cursor-pointer transition-colors shadow-2xs">
                <span className={`w-8 h-8 rounded-lg flex items-center justify-center material-symbols-outlined text-sm shrink-0 ${
                  settings.songAudioBase64 ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600'
                }`}>
                  {settings.songAudioBase64 ? 'audiotrack' : 'upload_file'}
                </span>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-[10.5px] font-bold text-slate-800 truncate">
                    {settings.songAudioFilename || '楽曲ファイルを選択 (MP3/WAV/OGG)'}
                  </span>
                  <span className="text-[8.5px] text-slate-500 truncate">低音キック解析＆60fps書き出し対応</span>
                </div>
                <input
                  type="file"
                  accept="audio/mp3,audio/wav,audio/ogg,audio/mpeg"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = () => {
                        const b64 = (reader.result as string).split(',')[1];
                        applySettingsUpdate(s => ({
                          ...s,
                          songAudioBase64: b64,
                          songAudioMimeType: file.type || 'audio/mp3',
                          songAudioFilename: file.name
                        }));
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                />
              </label>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 shrink-0">
            <SectionLabel>🎙️ 主人公キャラクター (VOICEVOX / 東北)</SectionLabel>
            
            {/* 🎲 ランダム（おまかせ）全幅ボタン */}
            <button
              type="button"
              onClick={() => applySettingsUpdate(s => ({ ...s, characterId: 'random' }))}
              className={`w-full p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                isRandomChar
                  ? 'border-indigo-500 bg-indigo-50/90 shadow-xs ring-1 ring-indigo-500 text-indigo-950'
                  : 'border-slate-200 hover:border-slate-300 bg-white text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl shrink-0">🎲</span>
                <div className="flex flex-col min-w-0">
                  <span className={`text-xs font-bold truncate ${isRandomChar ? 'text-indigo-900' : 'text-slate-800'}`}>
                    ランダム（おまかせ）
                  </span>
                  <span className="text-[9.5px] text-slate-500 truncate">制作開始時に7人から自動選出</span>
                </div>
              </div>
              {isRandomChar && (
                <span className="material-symbols-outlined text-[18px] text-indigo-600 shrink-0">check_circle</span>
              )}
            </button>
            {/* 全7キャラクターのグリッド */}
            <div className="grid grid-cols-2 gap-1.5">
              {SAFE_CHARACTERS.map(char => {
                const isSelected = settings.characterId === char.id;
                return (
                  <button
                    key={char.id}
                    type="button"
                    onClick={() => applySettingsUpdate(s => ({ ...s, characterId: char.id }))}
                    className={`p-2 rounded-xl border text-left transition-all flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-50/80 shadow-xs ring-1 ring-indigo-500'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <span className="text-xl shrink-0">{char.icon}</span>
                    <div className="flex flex-col min-w-0">
                      <span className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-900' : 'text-slate-800'}`}>
                        {char.nameJa}
                      </span>
                      <span className="text-[9px] text-slate-500 truncate">公式DNA保持</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {/* 2. 先行カット生成数 */}
        <div className="flex flex-col gap-1.5 shrink-0">
          <div className="flex items-center justify-between">
            <SectionLabel>先行カット生成数</SectionLabel>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-slate-500 font-bold">自由指定:</span>
              <input 
                type="number" 
                min="1" 
                max="9999"
                value={settings.previewCutCount || 12}
                onChange={e => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val > 0) {
                    applySettingsUpdate(s => ({ ...s, previewCutCount: val }));
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
                  key={opt.label}
                  type="button"
                  onClick={() => applySettingsUpdate(s => ({ ...s, previewCutCount: opt.value }))}
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
        {/* 3. ⏱️ 稼働プロファイルトグル */}
        <div className="flex flex-col gap-1.5 shrink-0 p-2.5 rounded-xl border border-indigo-100 bg-indigo-50/50">
          <div className="flex items-center justify-between">
            <SectionLabel>⏱️ 稼働プロファイル</SectionLabel>
            <span className="text-[9px] font-bold text-indigo-600 bg-indigo-100 px-1.5 py-0.5 rounded">
              {currentProfile === 'night_safe' ? '直列1並列・安全運転' : '2並列・快速'}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <button
              type="button"
              onClick={() => applySettingsUpdate(s => ({ ...s, executionProfile: 'night_safe', parallelCount: 1 }))}
              className={`p-2 rounded-lg text-left transition-all flex flex-col gap-0.5 cursor-pointer ${
                currentProfile === 'night_safe'
                  ? 'bg-slate-900 text-white shadow-xs font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1 text-[11px]">
                <span>🌙</span>
                <span className="font-bold">平日夜間 (6h安全)</span>
              </div>
              <span className={`text-[8.5px] leading-tight ${currentProfile === 'night_safe' ? 'text-indigo-200' : 'text-slate-500'}`}>
                1並列 / 50s間隔 / EP間60s
              </span>
            </button>
            <button
              type="button"
              onClick={() => applySettingsUpdate(s => ({ ...s, executionProfile: 'day_fast', parallelCount: 2 }))}
              className={`p-2 rounded-lg text-left transition-all flex flex-col gap-0.5 cursor-pointer ${
                currentProfile === 'day_fast'
                  ? 'bg-indigo-600 text-white shadow-xs font-bold'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-1 text-[11px]">
                <span>⚡</span>
                <span className="font-bold">土日・日中 (快速)</span>
              </div>
              <span className={`text-[8.5px] leading-tight ${currentProfile === 'day_fast' ? 'text-indigo-100' : 'text-slate-500'}`}>
                2並列 / 10s間隔 / EP間15s
              </span>
            </button>
          </div>
        </div>
        {/* 🎬 全モード共通: Veo 3.1 Lite 自動動画化 (シネマグラフ方式) */}
        <div className="flex flex-col gap-2 shrink-0 p-2.5 rounded-xl border border-purple-200 bg-purple-50/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-sm">🎬</span>
              <span className="text-[11px] font-black text-slate-800">Veo 3.1 Lite 自動動画化</span>
            </div>
            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${settings.videoRatio !== 'none' ? 'bg-purple-100 text-purple-700' : 'bg-slate-200 text-slate-600'}`}>
              {settings.videoRatio !== 'none' ? `動画化: ${settings.videoRatio}` : 'OFF'}
            </span>
          </div>
          {/* 動画化割合ボタン群 */}
          <div className="flex flex-col gap-1">
            <div className="grid grid-cols-5 gap-1 p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
              {[
                { label: 'OFF', value: 'none', sub: '0%' },
                { label: '1枚だけ', value: 'cut1', sub: 'C01' },
                { label: '30%', value: '30%', sub: '約1/3' },
                { label: '50%', value: '50%', sub: '交互' },
                { label: '100%', value: '100%', sub: '全Cut' }
              ].map(item => {
                const isSelected = (settings.videoRatio || 'none') === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => applySettingsUpdate(s => ({
                      ...s,
                      videoRatio: item.value as any,
                      autoVideo: item.value !== 'none'
                    }))}
                    className={`py-1.5 px-0.5 rounded-lg text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                      isSelected
                        ? 'bg-purple-600 text-white font-black shadow-xs'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-[10px] font-bold leading-tight">{item.label}</span>
                    <span className={`text-[8px] leading-tight ${isSelected ? 'text-purple-200' : 'text-slate-400'}`}>
                      {item.sub}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[8.5px] text-slate-500 font-mono px-1">
              {settings.videoRatio === 'none' && '静止画のみ生成（動画クレジット消費なし）'}
              {settings.videoRatio === 'cut1' && 'Cut 01のみVeo 3.1 Liteで動画化'}
              {settings.videoRatio === '30%' && '約3カットに1回動画化（C01, C04, C07, C10...）'}
              {settings.videoRatio === '50%' && '奇数カットを半分動画化（C01, C03, C05, C07...）'}
              {settings.videoRatio === '100%' && '生成した全カットをVeo 3.1 Liteで動画化'}
            </p>
          </div>
          {settings.videoRatio !== 'none' && (
            <div className="flex items-center justify-between gap-1 pt-1.5 border-t border-purple-200/60">
              <span className="text-[9.5px] font-bold text-slate-700">生成秒数:</span>
              <div className="flex items-center gap-1">
                {[8, 6, 4].map(sec => {
                  const isSecSelected = (settings.videoDuration || 8) === sec;
                  return (
                    <button
                      key={sec}
                      type="button"
                      onClick={() => applySettingsUpdate(s => ({ ...s, videoDuration: sec }))}
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                        isSecSelected
                          ? 'bg-purple-600 text-white font-black shadow-2xs'
                          : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200'
                      }`}
                    >
                      {sec}秒{sec === 8 ? ' (推奨)' : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {/* 4. 制作中停止 / 制作データ消去コントロール */}
        {(isProducing || (episodes.length > 0 && onClearEpisodes)) && (
          <div className="flex flex-col gap-1.5 pt-1 border-t border-slate-100 shrink-0">
            {isProducing && (
              <PillButton
                variant="filled"
                onClick={onAbortProduction}
                className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 h-9 shadow-md animate-pulse"
                icon={<span className="material-symbols-outlined text-[18px]">stop_circle</span>}
              >
                制作プロセスを停止
              </PillButton>
            )}
            {episodes.length > 0 && onClearEpisodes && !isProducing && (
              <button
                type="button"
                onClick={onClearEpisodes}
                className="text-xs text-slate-500 hover:text-red-600 text-center py-1 transition-colors cursor-pointer"
              >
                制作データを消去
              </button>
            )}
          </div>
        )}
        {/* 5. エンジン仕様・指数バックオフ情報（折りたたみアコーディオン） */}
        <div className="border border-slate-200 rounded-xl bg-slate-50 overflow-hidden shrink-0">
          <button
            type="button"
            onClick={() => setIsAccordionOpen(!isAccordionOpen)}
            className="w-full px-2.5 py-1.5 flex items-center justify-between text-[11px] font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer select-none"
          >
            <span className="flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] text-indigo-600">settings</span>
              ⚙️ エンジン仕様・待機設定
            </span>
            <span className="material-symbols-outlined text-[16px] text-slate-500 transition-transform">
              {isAccordionOpen ? 'expand_less' : 'expand_more'}
            </span>
          </button>
          {isAccordionOpen && (
            <div className="p-2.5 pt-1.5 border-t border-slate-200/80 flex flex-col gap-1.5 text-slate-600 bg-white">
              <div className="flex items-center justify-between text-[11px] font-bold">
                <span className="flex items-center gap-1 text-slate-700">
                  <span className="material-symbols-outlined text-[14px] text-amber-500">palette</span>
                  画像モデル
                </span>
                <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-black text-[10px]">
                  🍌 2.1 (429時: Pro/Lite自動切替)
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-bold pt-1 border-t border-slate-100">
                <span className="flex items-center gap-1 text-slate-700">
                  <span className="material-symbols-outlined text-[14px] text-indigo-500">speed</span>
                  並列度 & 間隔
                </span>
                <span className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 font-black text-[10px]">
                  {currentProfile === 'night_safe' ? '1並列 (50s〜65s)' : '2並列 (10s〜15s)'}
                </span>
              </div>
              <div className="flex flex-col gap-0.5 pt-1 border-t border-slate-100 text-[10px]">
                <div className="flex items-center justify-between font-bold text-slate-700">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] text-emerald-600">published_with_changes</span>
                    待機・クォータ保護
                  </span>
                  <span className="text-emerald-700 font-extrabold">{currentProfile === 'night_safe' ? '夜間安全直列' : '快速運転'}</span>
                </div>
                <span className="text-slate-500 font-mono text-[9.5px] mt-0.5 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                  {currentProfile === 'night_safe' ? 'カット間50s+ジッター / EP間60s / シリーズ間2m' : 'カット間10s+ジッター / EP間15s / シリーズ間5s'}
                </span>
              </div>
            </div>
          )}
        </div>
        {/* 6. ライブ進行ログ（下部常時表示・flex-1 min-h-[220px]） */}
        <div className="flex-1 min-h-[220px] flex flex-col rounded-xl overflow-hidden border border-slate-800 bg-slate-950 shadow-inner">
          <div className="px-2.5 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
            <span className="text-[10px] font-mono font-bold text-slate-400 flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px] text-indigo-400">terminal</span>
              進行ログ
            </span>
            <div className="flex items-center gap-1.5">
              {logs.length > 0 && (
                <span className="px-1.5 py-0.2 bg-indigo-950 text-indigo-300 border border-indigo-800/60 rounded-full text-[9px] font-mono font-bold">
                  {logs.length}
                </span>
              )}
              {/* ワンクリック全ログコピーボタン */}
              <button
                type="button"
                onClick={handleCopyLogs}
                disabled={logs.length === 0}
                className={`px-2 py-0.5 rounded text-[9.5px] font-bold font-mono transition-all flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isCopied
                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 active:scale-95'
                }`}
                title="全ログをクリップボードにコピー"
              >
                <span className="material-symbols-outlined text-[12px]">
                  {isCopied ? 'check' : 'content_copy'}
                </span>
                <span>{isCopied ? 'コピー済' : 'コピー'}</span>
              </button>
            </div>
          </div>
          <div 
            ref={logContainerRef} 
            className="flex-1 overflow-y-auto p-2 font-mono text-[10px] flex flex-col gap-1 text-slate-200 dark-scrollbar select-text"
          >
            {logs.length === 0 ? (
              <div className="text-slate-600 text-center py-8">ログ待機中...</div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="flex gap-1.5 leading-relaxed break-all">
                  <span className={
                    log.type === 'error' ? 'text-red-400 font-bold' :
                    log.type === 'warning' ? 'text-amber-300' :
                    log.type === 'success' ? 'text-emerald-300 font-bold' :
                    log.type === 'process' ? 'text-cyan-300' :
                    'text-slate-300'
                  }>
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

