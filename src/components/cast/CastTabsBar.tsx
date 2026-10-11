import React from 'react';
import { CastCharacter } from '../../types';

interface CastTabsBarProps {
  characters: CastCharacter[];
  selectedCharId: string;
  onSelectCharId: (id: string) => void;
  onAddCharacter: () => void;
  onDeleteCharacter: (id: string) => void;
}

export const CastTabsBar: React.FC<CastTabsBarProps> = ({
  characters,
  selectedCharId,
  onSelectCharId,
  onAddCharacter,
  onDeleteCharacter,
}) => {
  const currentChar = characters.find(c => c.id === selectedCharId) || characters[0];

  const roleLabels: Record<string, string> = {
    protagonist: '主人公',
    partner: '相棒',
    antagonist: '宿敵',
    supporting: 'サブ'
  };

  return (
    <div className="px-6 py-2 border-b border-slate-100 bg-slate-50 flex items-center gap-3 shrink-0">
      <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
        {characters.map((char, index) => {
          const isSelected = char.id === selectedCharId;
          const roleBadgeColor = 
            char.role === 'protagonist' ? 'bg-amber-100 text-amber-800 border-amber-300' :
            char.role === 'partner' ? 'bg-indigo-100 text-indigo-800 border-indigo-300' :
            char.role === 'antagonist' ? 'bg-rose-100 text-rose-800 border-rose-300' :
            'bg-slate-100 text-slate-700 border-slate-300';

          return (
            <button
              key={char.id}
              onClick={() => onSelectCharId(char.id)}
              className={`
                flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 whitespace-nowrap
                ${isSelected 
                  ? 'bg-white border-amber-500 text-slate-900 shadow-sm ring-2 ring-amber-500/20' 
                  : 'bg-slate-100/70 border-slate-200 text-slate-600 hover:bg-slate-200/50 hover:text-slate-800'
                }
              `}
            >
              {/* Mini Avatar */}
              <div className="w-6 h-6 rounded-lg bg-slate-200 overflow-hidden shrink-0 flex items-center justify-center border border-slate-300/50">
                {char.avatarBase64 ? (
                  <img src={`data:image/png;base64,${char.avatarBase64}`} alt={char.name} className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-xs text-slate-400">person</span>
                )}
              </div>
              <span>{char.name || `キャラ ${index + 1}`}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded border font-semibold ${roleBadgeColor}`}>
                {roleLabels[char.role]}
              </span>
            </button>
          );
        })}

        {characters.length < 8 && (
          <button
            onClick={onAddCharacter}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-dashed border-slate-300 text-xs font-semibold text-slate-500 hover:text-slate-800 hover:border-slate-400 hover:bg-white transition-all shrink-0 whitespace-nowrap"
          >
            <span className="material-symbols-outlined text-sm">add</span>
            キャラ追加
          </button>
        )}
      </div>

      {/* Delete Current Character Button */}
      {currentChar && characters.length > 1 && (
        <button
          onClick={() => onDeleteCharacter(currentChar.id)}
          className="text-xs text-slate-400 hover:text-rose-600 flex items-center gap-1 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-rose-50 border border-transparent hover:border-rose-200 shrink-0 whitespace-nowrap"
          title="選択中のキャラクターを削除"
        >
          <span className="material-symbols-outlined text-sm">delete</span>
          <span>削除</span>
        </button>
      )}
    </div>
  );
};
