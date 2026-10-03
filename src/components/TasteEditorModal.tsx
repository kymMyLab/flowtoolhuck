import React, { useState, useEffect } from 'react';
import { 
  loadCustomTastes, 
  saveCustomTastes, 
  resetCustomTastes, 
  CustomTasteMap 
} from '../services/tasteStorage';

interface TasteEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTastesUpdated: (updatedTastes: CustomTasteMap) => void;
}

export const TasteEditorModal: React.FC<TasteEditorModalProps> = ({
  isOpen,
  onClose,
  onTastesUpdated,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [parsedCount, setParsedCount] = useState<number>(0);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const tastes = loadCustomTastes();
      setJsonText(JSON.stringify(tastes, null, 2));
      setParseError(null);
      setParsedCount(Object.keys(tastes).length);
      setSaveSuccess(false);
      setCopied(false);
    }
  }, [isOpen]);

  // JSON テキスト変更時のリアルタイム構文検証
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setJsonText(val);
    try {
      const parsed = JSON.parse(val);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setParseError('ルートは { "画風名": "英語プロンプト..." } のオブジェクト形式である必要があります。');
        setParsedCount(0);
      } else {
        setParseError(null);
        setParsedCount(Object.keys(parsed).length);
      }
    } catch (err: any) {
      setParseError(err.message || 'JSONの構文にエラーがあります（カンマや引用符をご確認ください）。');
      setParsedCount(0);
    }
  };

  const handleFormat = () => {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setParseError(null);
      setParsedCount(Object.keys(parsed).length);
    } catch (err: any) {
      // 整形できないエラーはそのまま維持
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = () => {
    if (parseError) return;
    try {
      const parsed = JSON.parse(jsonText);
      // 空白トリミングと空エントリ除外
      const cleaned: CustomTasteMap = {};
      for (const [k, v] of Object.entries(parsed)) {
        const key = k.trim();
        const val = typeof v === 'string' ? v.trim() : String(v || '').trim();
        if (key && val) {
          cleaned[key] = val;
        }
      }
      saveCustomTastes(cleaned);
      onTastesUpdated(cleaned);
      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 500);
    } catch (err: any) {
      setParseError(`保存エラー: ${err.message}`);
    }
  };

  const handleReset = () => {
    if (window.confirm('画風・テイスト設定を初期デフォルト（10種類）にリセットしますか？\n（編集した内容は上書きされます）')) {
      const def = resetCustomTastes();
      setJsonText(JSON.stringify(def, null, 2));
      setParseError(null);
      setParsedCount(Object.keys(def).length);
      onTastesUpdated(def);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div 
        className="w-full max-w-3xl bg-[#141414] border border-white/15 rounded-2xl shadow-2xl flex flex-col overflow-hidden max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <span className="material-symbols-outlined text-2xl">palette</span>
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight text-white flex items-center gap-2">
                画風・テイスト JSON エディタ
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 font-bold">
                  研究・カスタマイズ
                </span>
              </h2>
              <p className="text-[11px] text-gray-400 mt-0.5">
                現在の画風定義をそのままJSONで編集・追加・研究できます。変更は localStorage に永続化されます。
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

        {/* コントロールバー */}
        <div className="flex items-center justify-between px-6 py-2.5 bg-black/40 border-b border-white/5 text-xs">
          <div className="flex items-center gap-3">
            {parseError ? (
              <span className="text-rose-400 flex items-center gap-1.5 font-bold">
                <span className="material-symbols-outlined text-[15px]">error</span>
                JSON構文エラー
              </span>
            ) : (
              <span className="text-emerald-400 flex items-center gap-1.5 font-bold">
                <span className="material-symbols-outlined text-[15px]">check_circle</span>
                正常 ({parsedCount} 種類の画風)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleFormat}
              disabled={!!parseError}
              className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-40"
              title="JSONのインデントを美しく整形"
            >
              <span className="material-symbols-outlined text-[14px]">format_align_left</span>
              整形 (Format)
            </button>
            <button
              type="button"
              onClick={handleCopy}
              className="px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 text-gray-300 border border-white/10 flex items-center gap-1 transition-colors cursor-pointer"
              title="クリップボードにJSONをコピー"
            >
              <span className="material-symbols-outlined text-[14px]">
                {copied ? 'check' : 'content_copy'}
              </span>
              {copied ? 'コピー完了' : 'JSONコピー'}
            </button>
          </div>
        </div>

        {/* JSON エディタ エリア */}
        <div className="p-6 flex flex-col gap-2 flex-1 overflow-hidden bg-[#0c0c0c]">
          {parseError && (
            <div className="px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/25 text-rose-300 text-xs font-mono break-all animate-shake">
              ⚠️ {parseError}
            </div>
          )}
          <textarea
            value={jsonText}
            onChange={handleTextChange}
            spellCheck={false}
            className="w-full flex-1 p-4 bg-[#111] border border-white/10 rounded-xl text-gray-100 font-mono text-[11.5px] leading-relaxed resize-none focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/40 dark-scrollbar"
            placeholder='{ "画風名": "英語プロンプト..." }'
          />
          <div className="text-[10px] text-gray-500 flex items-center justify-between px-1">
            <span>キー名が表示ラベル、値がMidjourney/Imagen/Banana等のスタイルプロンプトになります</span>
            <span>※ブラウザをリロードしても永続保存されます</span>
          </div>
        </div>

        {/* フッター */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/10 bg-white/5">
          <button
            type="button"
            onClick={handleReset}
            className="px-3.5 py-2 text-xs rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border border-white/10 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">restart_alt</span>
            初期デフォルトに戻す
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={!!parseError}
              className={`px-5 py-2 text-xs font-black rounded-xl flex items-center gap-1.5 transition-all cursor-pointer shadow-lg ${
                saveSuccess
                  ? 'bg-emerald-600 text-white shadow-emerald-900/40'
                  : parseError
                    ? 'bg-gray-800 text-gray-500 border border-white/5 cursor-not-allowed'
                    : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-900/40 border border-purple-400/30 active:scale-[0.98]'
              }`}
            >
              <span className="material-symbols-outlined text-sm">
                {saveSuccess ? 'check' : 'save'}
              </span>
              {saveSuccess ? '保存完了！' : '保存して反映'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
