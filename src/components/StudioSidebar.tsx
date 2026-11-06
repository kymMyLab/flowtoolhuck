import React, { useState } from 'react';
import { FieldDropdown, NumberChoice } from './Primitives';
import { GeneratorSettings, Episode, LogEntry } from '../types';
import { IMAGE_MODELS } from '../constants';
import { SAFE_CHARACTERS } from '../config/safeCharacters';

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
              <FieldDropdown label="画像モデル" value={settings.imageModel} options={IMAGE_MODELS.map(m => m.label)} onChange={v => setSettings(s => ({ ...s, imageModel: v }))} disabled={isProducing} />
              
              <div className="grid grid-cols-2 gap-2.5">
                <NumberChoice label="並列数" value={settings.parallelCount} options={[1, 2, 3, 4]} onChange={v => setSettings(s => ({ ...s, parallelCount: v }))} />
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
