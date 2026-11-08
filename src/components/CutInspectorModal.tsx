import React from 'react';
import { Cut } from '../types';
interface CutInspectorModalProps {
  cut: Cut | null;
  onClose: () => void;
}
export const CutInspectorModal: React.FC<CutInspectorModalProps> = ({ cut, onClose }) => {
  if (!cut) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-2xl w-full overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* モーダルヘッダー */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-indigo-400">
              CUT #{cut.id}
            </span>
            <span className="text-sm font-semibold text-slate-200">カット詳細インスペクター</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
        {/* モーダルコンテンツ */}
        <div className="p-5 space-y-4 overflow-y-auto">
          {cut.imageBase64 && (
            <div className="rounded-lg overflow-hidden border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center">
              <img
                src={`data:image/png;base64,${cut.imageBase64}`}
                alt={`Cut ${cut.id}`}
                className="max-h-full max-w-full object-contain"
              />
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              演出・ナレーション（JP）
            </label>
            <div className="text-xs text-slate-200 bg-slate-950 p-2.5 rounded border border-slate-800 leading-relaxed">
              {cut.narrationJp || '未設定'}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                カメラアングル
              </label>
              <div className="text-xs text-slate-300 bg-slate-950 p-2 rounded border border-slate-800">
                {cut.cinematicAngle || '標準アングル'}
              </div>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                ショットスケール
              </label>
              <div className="text-xs text-slate-300 bg-slate-950 p-2 rounded border border-slate-800">
                {cut.shotScale || 'ミディアムショット'}
              </div>
            </div>
          </div>
          {cut.telop && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                テロップ設計
              </label>
              <div className="text-xs text-indigo-300 bg-indigo-950/30 p-2.5 rounded border border-indigo-900/40">
                「{cut.telop.fullText}」
                {cut.telop.style && (
                  <span className="block text-[10px] text-indigo-400/80 mt-1 font-mono">
                    スタイル: {cut.telop.style} | 配置: {cut.telop.position || '標準'}
                  </span>
                )}
              </div>
            </div>
          )}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              英語プロンプト (Prompt EN)
            </label>
            <div className="text-xs font-mono text-slate-300 bg-slate-950 p-2.5 rounded border border-slate-800 whitespace-pre-wrap leading-relaxed">
              {cut.promptEn || '（未設定）'}
            </div>
          </div>
          {cut.veoMotionPrompt && (
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                動画モーション指示 (Motion Prompt)
              </label>
              <div className="text-xs font-mono text-cyan-300/90 bg-slate-950 p-2.5 rounded border border-cyan-900/30 whitespace-pre-wrap">
                {cut.veoMotionPrompt}
              </div>
            </div>
          )}
        </div>
        {/* フッター */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/50 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

