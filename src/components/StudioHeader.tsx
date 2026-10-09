import React from 'react';
import { GeneratorSettings } from '../types';
import { THEMES, TASTES } from '../constants';

export const StudioHeader = ({
  settings,
  setSettings,
  isProducing,
  onToggleLogs,
  onClear,
  onArchive,
  onStart,
  onAbort,
  isLogDrawerOpen
}: {
  settings: GeneratorSettings,
  setSettings: React.Dispatch<React.SetStateAction<GeneratorSettings>>,
  isProducing: boolean,
  onToggleLogs: () => void,
  onClear: () => void,
  onArchive: () => void,
  onStart: () => void,
  onAbort: () => void,
  isLogDrawerOpen: boolean
}) => {
  return (
    <div className="h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-40 shrink-0 shadow-sm">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-500 text-3xl">auto_awesome</span>
          <span className="font-black text-xl tracking-wider text-slate-800">Studio Pro</span>
        </div>
        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${settings.productionMode === 'episodes' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setSettings(prev => ({ ...prev, productionMode: 'episodes' }))}>Episodes Mode</button>
          <button className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${settings.productionMode === 'shots' ? 'bg-white shadow-sm text-indigo-700' : 'text-slate-500 hover:text-slate-700'}`} onClick={() => setSettings(prev => ({ ...prev, productionMode: 'shots' }))}>Shots Mode</button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-500">THEME</span>
          <select className="bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer" value={settings.theme} onChange={e => setSettings(prev => ({ ...prev, theme: e.target.value }))}>
            {THEMES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200">
          <span className="text-xs font-bold text-slate-500">TASTE</span>
          <select className="bg-transparent text-sm font-bold text-slate-800 outline-none cursor-pointer" value={settings.taste} onChange={e => setSettings(prev => ({ ...prev, taste: e.target.value }))}>
            {Object.keys(TASTES).map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={onArchive} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="Archive">
          <span className="material-symbols-outlined">folder_open</span>
        </button>
        <button onClick={onClear} className="p-2 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Clear">
          <span className="material-symbols-outlined">delete</span>
        </button>
        <button onClick={onToggleLogs} className={`p-2 rounded-lg transition-colors ${isLogDrawerOpen ? 'bg-indigo-100 text-indigo-700' : 'text-slate-500 hover:bg-slate-100'}`} title="Logs">
          <span className="material-symbols-outlined">receipt_long</span>
        </button>

        {isProducing ? (
          <button onClick={onAbort} className="ml-2 flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-6 py-2 rounded-xl font-bold transition-colors shadow-sm">
            <span className="material-symbols-outlined">stop_circle</span>
            Abort
          </button>
        ) : (
          <button onClick={onStart} className="ml-2 flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-xl font-bold transition-colors shadow-sm">
            <span className="material-symbols-outlined">play_circle</span>
            Start
          </button>
        )}
      </div>
    </div>
  );
};
