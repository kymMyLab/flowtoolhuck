import React, { useState, useRef, useEffect } from 'react';

export const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center px-2">
    <span className="text-[11px] font-medium text-[rgba(218,220,224,0.9)] tracking-[0.1px] normal-case">
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
  const base = 'flex items-center gap-[2px] justify-center h-[34px] rounded-xl font-medium tracking-[0.1px] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
  const variants: Record<string, string> = {
    filled: 'bg-[#969696] hover:bg-[#a6a6a6] active:bg-[#868686] text-black text-[11px] pl-[8px] pr-[24px] py-1 select-none',
    outline: 'border border-[#595959] hover:bg-white/5 active:bg-white/10 backdrop-blur-[40px] text-[12px] pl-[8px] pr-[16px] py-2 text-white select-none',
    solid: 'bg-white hover:bg-gray-200 active:bg-gray-300 text-black text-[12px] pl-[8px] pr-[16px] py-2 select-none',
  };
  return (
    <button className={`${base} ${variants[variant]} ${className}`} onClick={onClick} disabled={disabled} title={title}>
      {icon && <span className="flex items-center justify-center w-6 h-6">{icon}</span>}
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
    <div className={`border border-[#595959] rounded-xl flex flex-col gap-0.5 justify-center pb-2 pl-2.5 pr-2 pt-[5px] select-none ${className}`}>
      <p className="text-[11px] font-medium text-[rgba(255,255,255,0.35)] tracking-[0.1px]">{label}</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button 
            onClick={() => onChange(Math.max(min, value - 1))}
            className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/20 text-white transition-colors border border-white/10"
          >
            <span className="material-symbols-outlined text-[18px]">remove</span>
          </button>
          <span className="text-[13px] font-bold text-white tracking-[0.5px] min-w-[32px] text-center">
            {value} <span className="text-[10px] opacity-40 font-normal">{unit}</span>
          </span>
          <button 
            onClick={() => onChange(Math.min(max, value + 1))}
            className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/20 text-white transition-colors border border-white/10"
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
        className="w-full text-left border border-[#595959] transition-colors rounded-xl flex flex-col gap-0.5 justify-center pb-2 pl-2.5 pr-1 pt-[5px] select-none focus:outline-none enabled:hover:border-[#7a7a7a]"
        disabled={disabled}
      >
        <p className="text-[11px] font-medium text-[rgba(255,255,255,0.35)] tracking-[0.1px]">{label}</p>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-white tracking-[0.1px] truncate pr-2">{value}</span>
          {!disabled && (
            <span className={`material-symbols-outlined text-[16px] text-[rgba(218,220,224,0.5)] mr-1 transition-transform ${isOpen ? 'rotate-180' : ''}`}>keyboard_arrow_down</span>
          )}
        </div>
      </button>
      {isOpen && !disabled && (
        <div className="absolute z-50 top-[calc(100%+4px)] left-0 w-full bg-[#0c0c0c] border border-white/15 rounded-xl overflow-hidden shadow-2xl backdrop-blur-md animate-dropdown origin-top max-h-80 overflow-y-auto dark-scrollbar">
          {groups ? (
            groups.map((grp) => (
              <div key={grp.label} className="border-b border-white/10 last:border-b-0 pb-1">
                <div className="px-2.5 py-1.5 text-[10px] font-bold text-amber-400 tracking-wider bg-[#181818] sticky top-0 backdrop-blur-md z-10 flex items-center gap-1.5 border-b border-white/10">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0"></span>
                  <span className="truncate">{grp.label}</span>
                </div>
                {grp.items.map((opt) => (
                  <button 
                    key={opt} 
                    type="button"
                    className={`w-full text-left px-3 py-1.5 text-[11px] font-medium tracking-[0.1px] hover:bg-white/10 transition-colors flex items-center justify-between ${value === opt ? 'bg-amber-500/20 text-amber-200 font-bold' : 'text-[rgba(218,220,224,0.85)]'}`}
                    onClick={() => { onChange(opt); setIsOpen(false); }}
                  >
                    <span className="truncate">{opt}</span>
                    {value === opt && <span className="material-symbols-outlined text-[14px] text-amber-400 shrink-0 ml-1">check</span>}
                  </button>
                ))}
              </div>
            ))
          ) : (
            options.map((opt) => {
              const optVal = typeof opt === 'string' ? opt : opt.value;
              const optLabel = typeof opt === 'string' ? opt : opt.label;
              return (
                <button key={optVal} type="button"
                  className={`w-full text-left px-2.5 py-2 text-[11px] font-medium tracking-[0.1px] hover:bg-[#1a1a1a] transition-colors flex items-center justify-between ${value === optVal ? 'bg-amber-500/20 text-amber-200 font-bold' : 'text-[rgba(218,220,224,0.9)]'}`}
                  onClick={() => { onChange(optVal); setIsOpen(false); }}>
                  <span className="truncate">{optLabel}</span>
                  {value === optVal && <span className="material-symbols-outlined text-[14px] text-amber-400 shrink-0 ml-1">check</span>}
                </button>
              );
            })
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
    {label && <p className="text-[11px] font-medium text-[rgba(255,255,255,0.35)] tracking-[0.1px] px-2">{label}</p>}
    {multiline ? (
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="border border-[#595959] hover:border-[#7a7a7a] focus:border-[#969696] rounded-xl w-full h-[60px] px-3 py-2.5 resize-none bg-transparent text-[11px] font-medium text-white placeholder-[rgba(218,220,224,0.75)] tracking-[0.1px] focus:outline-none transition-colors" />
    ) : (
      <input type="text" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="border border-[#595959] hover:border-[#7a7a7a] focus:border-[#969696] rounded-xl w-full h-[38px] px-3 bg-transparent text-[11px] font-medium text-white placeholder-[rgba(218,220,224,0.75)] tracking-[0.1px] focus:outline-none transition-colors" />
    )}
  </div>
);

export const SegmentedToggle: React.FC<{
  value: string; items: { value: string; label: string }[];
  onChange: (val: string) => void; label?: string;
}> = ({ value, items, onChange, label }) => (
  <div className="flex flex-col gap-1 w-full">
    {label && <p className="text-[11px] font-medium text-[rgba(255,255,255,0.35)] tracking-[0.1px] px-2">{label}</p>}
    <div className="flex w-full items-center border border-[#595959] rounded-xl overflow-hidden bg-transparent">
      {items.map((item) => (
        <button key={item.value} type="button" onClick={() => onChange(item.value)}
          className={`flex-1 flex items-center justify-center h-[34px] text-[11px] font-medium tracking-[0.1px] transition-all cursor-pointer ${
            value === item.value ? 'bg-[#969696] text-black' : 'text-[rgba(218,220,224,0.75)] hover:text-white hover:bg-white/5'
          }`}>
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
    <p className="text-[11px] font-medium text-[rgba(255,255,255,0.35)] tracking-[0.1px] px-2">{label}</p>
    <div className="flex w-full items-center border border-[#595959] rounded-xl overflow-hidden bg-transparent">
      {options.map((num) => (
        <button
          key={num}
          type="button"
          onClick={() => onChange(num)}
          className={`flex-1 flex items-center justify-center h-[34px] text-[11px] font-bold tracking-[0.1px] transition-all cursor-pointer ${
            value === num ? 'bg-[#969696] text-black font-black' : 'text-[rgba(218,220,224,0.75)] hover:text-white hover:bg-white/5'
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
    className={`flex items-center justify-between w-full px-2 py-1 select-none ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
  >
    <span className="text-[11px] font-medium text-white/60 tracking-[0.1px]">{label}</span>
    <div className={`w-10 h-5 rounded-full transition-colors relative ${checked ? 'bg-[#969696]' : 'bg-[#333]'}`}>
      <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${checked ? 'left-6' : 'left-1'}`} />
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative w-full max-w-[320px] bg-[#1a1a1a] border border-[#595959] rounded-2xl p-6 shadow-2xl flex flex-col gap-4">
        <h4 className="text-lg font-bold text-white tracking-tight">{title}</h4>
        <p className="text-xs text-white/60 leading-relaxed">{message}</p>
        <div className="flex gap-2 pt-2">
          <PillButton variant="outline" className="flex-1" onClick={onCancel}>キャンセル</PillButton>
          <PillButton variant="filled" className="flex-1 bg-amber-500 text-black font-bold" onClick={onConfirm}>確定</PillButton>
        </div>
      </div>
    </div>
  );
};