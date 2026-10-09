import React, { useState, useRef, useEffect } from 'react';

export type LogEntry = { id: string; message: string; type: 'info' | 'success' | 'warning' | 'error' | 'process' };

interface StudioLogsProps {
  logs: LogEntry[];
  onAddLog: (msg: string, type?: LogEntry['type']) => void;
  isProducing?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

export const StudioLogs: React.FC<StudioLogsProps> = ({ logs, onAddLog, isProducing = false, isOpen = false, onClose = () => {} }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
  const isBusy = isProducing || (lastLog && (lastLog.type === 'process' || lastLog.type === 'info'));

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isOpen]);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = logs.map(l => l.message).join('\n');
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    textArea.style.top = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
      onAddLog('📋 ログをクリップボードにコピーしました', 'info');
    } catch (err) {
      onAddLog('❌ コピーに失敗しました', 'error');
    }
    document.body.removeChild(textArea);
  };

  return (
    <div 
      className={`fixed right-0 top-0 bottom-0 w-[440px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      {/* ログヘッダー */}
      <div 
        className="flex items-center justify-between h-[64px] px-4 shrink-0 gap-2 border-b border-slate-200 bg-slate-50"
      >
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[12px] font-black text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
            Studio Logs
            {isBusy && (
              <span className="flex items-center gap-1 text-[9px] text-amber-600 font-bold px-1.5 py-0.2 rounded-full bg-amber-100 border border-amber-300 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                ACTIVE
              </span>
            )}
          </span>
          {logs.length > 0 && (
            <span className="text-[9px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full font-bold">
              {logs.length}
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            title="ログを一括コピー"
            className="text-[9px] text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 px-2 py-1 rounded-lg flex items-center gap-1 transition-colors border border-slate-200 font-bold shadow-sm"
          >
            📋 COPY
          </button>
          <button
            onClick={onClose}
            title="閉じる"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 transition-colors text-slate-500 hover:text-slate-800"
          >
            <span className="material-symbols-outlined text-[20px]">
              close
            </span>
          </button>
        </div>
      </div>

      {/* ログ一覧 */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto dark-scrollbar font-mono text-[10px] flex flex-col gap-1 text-slate-700 p-3 bg-slate-50 scroll-smooth select-text"
      >
          {logs.map(log => {
            const isLatest = lastLog && lastLog.id === log.id;
            return (
              <div 
                key={log.id} 
                className={`
                  px-2 py-0.5 rounded transition-all duration-200 flex items-start gap-1.5 leading-relaxed
                  ${log.type === 'error' ? 'text-red-500 bg-red-100 border-l-2 border-red-500 font-bold' : 
                    log.type === 'success' ? 'text-emerald-600 bg-emerald-50' : 
                    log.type === 'process' ? 'text-amber-600 bg-amber-50 font-medium' : 
                    log.type === 'warning' ? 'text-orange-600 italic' : 'text-slate-700'}
                  ${isLatest && isBusy ? 'border-l-2 border-amber-400 pl-1.5 animate-pulse bg-white' : ''}
                `}
              >
                <span>{log.message}</span>
              </div>
            );
          })}
          {logs.length === 0 && (
            <div className="italic text-slate-400 px-2 py-4 text-center">
              制作を開始するとここにリアルタイム進捗ログが表示されます...
            </div>
          )}
      </div>
    </div>
  );
};