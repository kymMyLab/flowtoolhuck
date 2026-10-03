import React, { useState, useRef, useEffect } from 'react';

export type LogEntry = { id: string; message: string; type: 'info' | 'success' | 'warning' | 'error' | 'process' };

interface StudioLogsProps {
  logs: LogEntry[];
  onAddLog: (msg: string, type?: LogEntry['type']) => void;
  isProducing?: boolean;
}

export const StudioLogs: React.FC<StudioLogsProps> = ({ logs, onAddLog, isProducing = false }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
  const isBusy = isProducing || (lastLog && (lastLog.type === 'process' || lastLog.type === 'info'));

  useEffect(() => {
    if (scrollRef.current && !isCollapsed) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isCollapsed]);

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

  const toggleCollapsed = () => {
    if (isMaximized) setIsMaximized(false);
    setIsCollapsed(!isCollapsed);
  };

  const toggleMaximized = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCollapsed(false);
    setIsMaximized(!isMaximized);
  };

  const panelHeight = isCollapsed ? 'h-[36px]' : isMaximized ? 'h-[600px]' : 'h-[240px]';

  return (
    <div 
      className={`
        ${panelHeight} border-t border-white/10 flex flex-col bg-[#0a0a0a]/95 backdrop-blur-md -mx-2.5 px-3 transition-all duration-300 relative
        ${isMaximized ? 'fixed bottom-0 left-[380px] right-0 z-[100] border-l border-white/10 -mx-0 shadow-2xl' : ''}
      `}
    >
      {/* ログヘッダー */}
      <div 
        onClick={toggleCollapsed}
        className="flex items-center justify-between h-[36px] cursor-pointer hover:bg-white/5 transition-colors shrink-0 gap-2"
      >
        <div className="flex items-center gap-2 shrink-0">
          <span className={`material-symbols-outlined text-[16px] text-white/40 transition-transform ${isCollapsed ? '' : 'rotate-180'}`}>
            keyboard_arrow_up
          </span>
          <span className="text-[10px] font-black text-white/60 uppercase tracking-widest flex items-center gap-1.5">
            Studio Logs
            {isBusy && (
              <span className="flex items-center gap-1 text-[9px] text-amber-400 font-bold px-1.5 py-0.2 rounded-full bg-amber-500/10 border border-amber-500/30 animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                ACTIVE
              </span>
            )}
          </span>
          {logs.length > 0 && (
            <span className="text-[9px] bg-white/10 text-white/60 px-1.5 py-0.2 rounded-full font-bold">
              {logs.length}
            </span>
          )}
        </div>

        {/* 折りたたみ時でも最新ログを1行プレビュー */}
        {isCollapsed && lastLog && (
          <div className="flex-1 overflow-hidden truncate text-[10px] text-amber-400/90 font-mono italic px-2 animate-pulse">
            {lastLog.message}
          </div>
        )}
        
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            title="ログを一括コピー"
            className="text-[9px] text-white/50 hover:text-white bg-white/5 hover:bg-white/10 px-2 py-0.5 rounded flex items-center gap-1 transition-colors border border-white/5"
          >
            📋 COPY
          </button>
          <button
            onClick={toggleMaximized}
            title={isMaximized ? "縮小" : "最大化"}
            className={`w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors ${isMaximized ? 'text-amber-400' : 'text-white/30 hover:text-white'}`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isMaximized ? 'fullscreen_exit' : 'fullscreen'}
            </span>
          </button>
        </div>
      </div>

      {/* ログ一覧 */}
      {!isCollapsed && (
        <div 
          ref={scrollRef} 
          className="flex-1 overflow-y-auto dark-scrollbar font-mono text-[10px] flex flex-col gap-1 text-white/70 pb-3 mt-1 scroll-smooth select-text"
        >
          {logs.map(log => {
            const isLatest = lastLog && lastLog.id === log.id;
            return (
              <div 
                key={log.id} 
                className={`
                  px-2 py-0.5 rounded transition-all duration-200 flex items-start gap-1.5 leading-relaxed
                  ${log.type === 'error' ? 'text-red-400 bg-red-500/10 border-l-2 border-red-500 font-bold' : 
                    log.type === 'success' ? 'text-green-400 bg-green-500/5' : 
                    log.type === 'process' ? 'text-amber-400 bg-amber-500/5 font-medium' : 
                    log.type === 'warning' ? 'text-orange-400 italic' : 'text-white/70'}
                  ${isLatest && isBusy ? 'border-l-2 border-amber-400 pl-1.5 animate-pulse bg-white/5' : ''}
                `}
              >
                <span>{log.message}</span>
              </div>
            );
          })}
          {logs.length === 0 && (
            <div className="italic text-white/20 px-2 py-4 text-center">
              制作を開始するとここにリアルタイム進捗ログが表示されます...
            </div>
          )}
        </div>
      )}
    </div>
  );
};