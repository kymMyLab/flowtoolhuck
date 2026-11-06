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
  setSettings: React.Dispatch<React.SetStateAction<GeneratorSettings>>;
  isProducing: boolean;
  onStartProduction: () => void;
  onAbortProduction: () => void;
  episodes: Episode[];
  onClearEpisodes?: () => void;
  logs?: LogEntry[];
}

export const StudioSidebar: React.FC<StudioSidebarProps> = ({
  settings,
  setSettings,
  isProducing,
  onStartProduction,
  onAbortProduction,
  episodes,
  onClearEpisodes,
  logs = []
}) => {
  const [activeTab, setActiveTab] = useState<'create' | 'settings' | 'logs'>('create');
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (activeTab === 'logs' && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, activeTab]);

  const episodeOptions = [
    { label: '単発 (1話)', value: 1 },
    { label: '2話', value: 2 },
    { label: '3話', value: 3 },
    { label: '5話', value: 5 },
    { label: '10話 (完結)', value: 10 }
  ];

  const cutPresetOptions = [
    { label: '先行2カット', value: 2 },
    { label: '先行5カット', value: 5 },
    { label: '全12カット一括', value: 12 }
  ];

  return (
    <div className="w-[320px] bg-white border-r border-slate-200 flex flex-col h-full shrink-0 shadow-sm z-30 select-none">
      {/* タブナビゲーション */}
      <div className="flex border-b border-slate-200 bg-slate-50 p-1 gap-1">
        <button
          type="button"
          onClick={() => setActiveTab('create')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'create'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">movie</span>
          <span>制作</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'logs'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">terminal</span>
          <span>ログ</span>
          {logs.length > 0 && (
            <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-full text-[9px] font-black">
              {logs.length}
            </span>
          )}
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 cursor-pointer ${
            activeTab === 'settings'
              ? 'bg-white text-indigo-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
          }`}
        >
          <span className="material-symbols-outlined text-[16px]">tune</span>
          <span>詳細</span>
        </button>
      </div>

      {/* メインコンテンツエリア */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
        {activeTab === 'create' && (
          <div className="flex flex-col gap-3.5">
            {/* キャラクター選択セクション */}
            <div className="flex flex-col gap-1.5">
              <SectionLabel>🎙️ 主人公キャラクター (VOICEVOX / 東北)</SectionLabel>
              <div className="grid grid-cols-2 gap-1.5">
                {SAFE_CHARACTERS.map(char => {
                  const isSelected = settings.characterId === char.id;
                  return (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, characterId: char.id }))}
                      disabled={isProducing}
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

            {/* 話数セレクター */}
            <div className="flex flex-col gap-1.5">
              <SectionLabel>📚 制作エピソード数</SectionLabel>
              <div className="flex gap-1">
                {episodeOptions.map(opt => {
                  const isSelected = (settings.episodeCount || 1) === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setSettings(s => ({ ...s, episodeCount: opt.value }))}
                      disabled={isProducing}
                      className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 border-indigo-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* アクションボタン */}
            <div className="flex flex-col gap-2 pt-2 border-t border-slate-100">
              {isProducing ? (
                <PillButton
                  variant="filled"
                  onClick={onAbortProduction}
                  className="w-full bg-red-600 hover:bg-red-700 active:bg-red-800 h-10 shadow-md animate-pulse"
                  icon={<span className="material-symbols-outlined text-[18px]">stop_circle</span>}
                >
                  制作プロセスを停止
                </PillButton>
              ) : (
                <PillButton
                  variant="filled"
                  onClick={onStartProduction}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 h-10 shadow-md font-black text-sm"
                  icon={<span className="material-symbols-outlined text-[20px]">smart_display</span>}
                >
                  🚀 全自動スタジオ制作を開始
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
          </div>
        )}

        {activeTab === 'logs' && (
          <div ref={logContainerRef} className="flex-1 flex flex-col gap-1.5 font-mono text-[10px] overflow-y-auto max-h-[500px] p-2 bg-slate-900 text-slate-100 rounded-xl">
            {logs.length === 0 ? (
              <div className="text-slate-500 text-center py-6">ログはありません</div>
            ) : (
              logs.map(log => (
                <div key={log.id} className="flex gap-1.5 leading-relaxed break-all">
                  {log.timestamp && <span className="text-slate-500 shrink-0">[{log.timestamp}]</span>}
                  <span className={
                    log.type === 'error' ? 'text-red-400 font-bold' :
                    log.type === 'warning' ? 'text-amber-300' :
                    log.type === 'success' ? 'text-emerald-300 font-bold' :
                    log.type === 'process' ? 'text-cyan-300' :
                    'text-slate-200'
                  }>
                    {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <SectionLabel>先行カット生成数</SectionLabel>
                <div className="flex items-center gap-1">
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
  );
};
