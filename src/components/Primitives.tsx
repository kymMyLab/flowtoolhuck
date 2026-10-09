import React, { useState, useRef, useEffect } from 'react';

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

export const StepperField: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  unit?: string;
  onChange: (val: number) => void;
  className?: string;
}> = ({ label, value, min, max, unit = '話', onChange, className = '' }) => {
  return (
    <div className={`border border-slate-200 bg-white rounded-xl flex flex-col gap-1 justify-center p-2.5 shadow-sm select-none ${className}`}>
      <p className="text-xs font-bold text-slate-600">{label}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button 
            onClick={() => onChange(Math.max(min, value - 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 transition-colors border border-slate-200"
          >
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <span className="text-sm font-bold text-slate-900 min-w-[36px] text-center">
            {value} <span className="text-xs text-slate-500 font-normal">{unit}</span>
          </span>
          <button 
            onClick={() => onChange(Math.min(max, value + 1))}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-slate-700 transition-colors border border-slate-200"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export const FieldDropdown: React.FC<{
  label: string; 
  value: string; 
  options?: (string | { label: string; value: string })[];
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

  return (
    <div ref={ref} className={`relative ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <button 
        type="button" 
        onClick={() => !disabled && setIsOpen(!isOpen)}
        className="w-full text-left bg-white border border-slate-300 hover:border-indigo-400 focus:border-indigo-500 transition-all rounded-xl flex flex-col gap-0.5 justify-center py-2 px-3 select-none focus:outline-none shadow-sm cursor-pointer"
        disabled={disabled}
      >
        {label && <p className="text-[11px] font-bold text-slate-600 leading-tight">{label}</p>}
        <div className="flex items-center justify-between w-full">
          <span className="text-xs font-semibold text-slate-900 leading-snug break-words pr-2 line-clamp-1">{value}</span>
          {!disabled && (
            <span className={`material-symbols-outlined text-[18px] text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180 text-indigo-600' : ''}`}>keyboard_arrow_down</span>
          )}
        </div>
      </button>
      {isOpen && !disabled && (
        <div className="absolute z-50 top-[calc(100%+6px)] left-0 w-full min-w-[240px] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-2xl animate-dropdown origin-top max-h-[460px] overflow-y-auto dark-scrollbar">
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
              return (
                <button 
                  key={optVal} 
                  type="button"
                  className={`w-full text-left px-3 py-2.5 text-xs font-semibold transition-colors flex items-center justify-between gap-2 border-b border-slate-100 last:border-b-0 cursor-pointer ${
                    value === optVal 
                      ? 'bg-indigo-50 text-indigo-700 font-bold' 
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                  onClick={() => { onChange(optVal); setIsOpen(false); }}
                >
                  <span className="break-words leading-relaxed">{optLabel}</span>
                  {value === optVal && <span className="material-symbols-outlined text-[16px] text-indigo-600 shrink-0 ml-1">check</span>}
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

export const SegmentedToggle: React.FC<{
  value: string; items: { value: string; label: string }[];
  onChange: (val: string) => void; label?: string;
}> = ({ value, items, onChange, label }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <p className="text-xs font-bold text-slate-600 px-1">{label}</p>}
    <div className="flex w-full items-center border border-slate-300 rounded-xl overflow-hidden bg-slate-100 p-0.5">
      {items.map((item) => (
        <button 
          key={item.value} 
          type="button" 
          onClick={() => onChange(item.value)}
          className={`flex-1 flex items-center justify-center h-[32px] text-xs font-bold transition-all cursor-pointer rounded-lg ${
            value === item.value 
              ? 'bg-indigo-600 text-white shadow-sm' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
          }`}
        >
          <span>{item.label}</span>
        </button>
      ))}
    </div>
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

export const ToggleSwitch: React.FC<{
  label: string; checked: boolean; onChange: (val: boolean) => void; disabled?: boolean;
}> = ({ label, checked, onChange, disabled }) => (
  <button 
    type="button" 
    disabled={disabled}
    onClick={() => !disabled && onChange(!checked)} 
    className={`flex items-center justify-between w-full px-2 py-1.5 select-none rounded-lg hover:bg-slate-100/70 transition-colors ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className="text-xs font-medium text-slate-800 tracking-wide text-left">{label}</span>
    <div className={`w-10 h-5 rounded-full transition-colors relative shrink-0 ${checked ? 'bg-indigo-600' : 'bg-slate-300'}`}>
      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all ${checked ? 'left-[22px]' : 'left-0.5'}`} />
    </div>
  </button>
);

export const ConfirmationModal: React.FC<{
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ isOpen, title, message, onConfirm, onCancel }) => {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-[340px] bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
        <h4 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h4>
        <p className="text-xs text-slate-600 leading-relaxed">{message}</p>
        <div className="flex gap-2 pt-2">
          <PillButton variant="outline" className="flex-1" onClick={onCancel}>キャンセル</PillButton>
          <PillButton variant="filled" className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold" onClick={onConfirm}>確定</PillButton>
        </div>
      </div>
    </div>
  );
};