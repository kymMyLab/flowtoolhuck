import React from 'react';
import { StoryRecord } from '../services/db';
import { PillButton } from './Primitives';

interface ArchiveDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  stories: StoryRecord[];
  onRemake: (story: StoryRecord) => void;
}

export const ArchiveDrawer: React.FC<ArchiveDrawerProps> = ({ isOpen, onClose, stories, onRemake }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-[400px] h-full bg-[#111] border-l border-white/10 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-400">history_edu</span>
            <h3 className="text-xl font-black italic tracking-tighter uppercase">Story Archive</h3>
          </div>
          <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 dark-scrollbar">
          {stories.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full opacity-20 gap-2">
               <span className="material-symbols-outlined text-[48px]">folder_off</span>
               <p className="text-xs font-bold uppercase tracking-widest">No history yet</p>
            </div>
          ) : (
            stories.map((s) => (
              <div key={s.id} className="bg-white/5 border border-white/5 rounded-xl p-4 flex flex-col gap-3 hover:border-white/20 transition-all group">
                <div className="flex justify-between items-start">
                  <div className="flex flex-col gap-1">
                    <span className="text-[9px] font-black text-white/30 uppercase tracking-widest">{new Date(s.createdAt).toLocaleString('ja-JP')}</span>
                    <h4 className="text-sm font-bold text-white line-clamp-1 group-hover:text-amber-400 transition-colors">{s.titleJp}</h4>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-2">
                  <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded text-white/60">{s.country}</span>
                  <span className="text-[9px] bg-white/10 px-2 py-0.5 rounded text-white/60">{s.era}</span>
                  <span className="text-[9px] bg-amber-500/20 px-2 py-0.5 rounded text-amber-400 font-bold">{s.theme}</span>
                </div>

                <p className="text-[10px] text-white/40 leading-relaxed line-clamp-2 italic">
                  {s.protagonistSummary}
                </p>

                <div className="pt-2 mt-auto border-t border-white/5">
                  <PillButton 
                    variant="outline" 
                    className="w-full text-[10px] h-[30px]" 
                    icon={<span className="material-symbols-outlined text-[16px]">restart_alt</span>}
                    onClick={() => onRemake(s)}
                  >
                    この話を別テーマでリメイク
                  </PillButton>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};