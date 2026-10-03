import React, { useState, useEffect } from 'react';
import { ProductionMode } from '../types';
import { loadCustomThemes, saveModeThemes, resetModeThemes, DEFAULT_THEME_MAP } from '../services/themeStorage';

interface ThemeEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: ProductionMode;
  modeLabel: string;
  onThemesUpdated: (updatedThemes: string[]) => void;
}

export const ThemeEditorModal: React.FC<ThemeEditorModalProps> = ({
  isOpen,
  onClose,
  currentMode,
  modeLabel,
  onThemesUpdated,
}) => {
  const [text, setText] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const themes = loadCustomThemes();
      const list = themes[currentMode] || DEFAULT_THEME_MAP[currentMode] || [];
      setText(list.join('\n'));
      setSaveSuccess(false);
    }
  }, [isOpen, currentMode]);

  if (!isOpen) return null;

  const currentCount = text.split('\n').map(s => s.trim()).filter(Boolean).length;

  const handleSave = () => {
    const list = text.split('\n').map(s => s.trim()).filter(Boolean);
    const updatedMap = saveModeThemes(currentMode, list);
    const updatedList = updatedMap[currentMode] || [];
    onThemesUpdated(updatedList);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  const handleReset = () => {
    if (window.confirm(`「${modeLabel}」のテーマを初期デフォルト（10選）に戻しますか？`)) {
      const updatedMap = resetModeThemes(currentMode);
      const updatedList = updatedMap[currentMode] || [];
      setText(updatedList.join('\n'));
      onThemesUpdated(updatedList);
    }
  };

  const copyPromptForWebGemini = () => {
    const promptText = `YouTube Shorts / TikTok で視聴維持率とクリック率が爆発する「${modeLabel}」のテーマ企画を、1行あたり絵文字つきで10個提案してください。\n1行1テーマで、余計な前置きや番号付け・解説は含めず、テーマ文のみを出力してください。\n例:\n💡 9割が知らない江戸時代の夜のトイレ事情（実は世界一エコだった真実）`;
    navigator.clipboard.writeText(promptText);
    alert('📋 WebGemini用プロンプトをクリップボードにコピーしました！\nWebGeminiに貼り付けて出力をそのままここにコピペできます。');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#161616] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-amber-400 text-2xl">edit_note</span>
            <div>
              <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                テーマ・企画リスト編集
                <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {modeLabel}
                </span>
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                1行に1つのテーマを記述してください。WebGeminiの出力をそのまま貼り付けられます。
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* 本文エリア */}
        <div className="p-6 flex flex-col gap-3 flex-1 overflow-hidden">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400">
              登録件数: <span className="font-bold text-amber-400">{currentCount}</span> 件
            </span>
            <button
              type="button"
              onClick={copyPromptForWebGemini}
              className="px-2.5 py-1 text-[11px] rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5 transition-colors"
              title="WebGeminiにアイデアを出させるプロンプトをコピー"
            >
              <span className="material-symbols-outlined text-[14px]">content_copy</span>
              WebGemini用依頼文をコピー
            </button>
          </div>

          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="💡 ここにテーマを1行ずつ入力または貼り付け&#10;例: 9割が知らない江戸時代の夜のトイレ事情..."
            className="w-full flex-1 min-h-[300px] p-3.5 bg-black/60 border border-white/10 rounded-xl text-xs font-mono text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-500/50 resize-none leading-relaxed dark-scrollbar"
            spellCheck={false}
          />
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-white/10 bg-white/5">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 text-xs rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 flex items-center gap-1 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">restart_alt</span>
            初期デフォルトに戻す
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-xs rounded-xl bg-white/10 hover:bg-white/15 text-gray-300 font-bold transition-colors"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              className={`px-5 py-1.5 text-xs rounded-xl font-black flex items-center gap-1.5 shadow-lg transition-all ${
                saveSuccess
                  ? 'bg-emerald-600 text-white shadow-emerald-900/50'
                  : 'bg-amber-500 hover:bg-amber-400 text-black shadow-amber-900/40'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">
                {saveSuccess ? 'check' : 'save'}
              </span>
              {saveSuccess ? '保存完了！' : '保存してUIに反映'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
