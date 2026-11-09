import React, { useState, useEffect } from 'react';
import { Cut } from '../types';
import { formatDataUri, callWithRetry } from '../services/utils';
import { resolveImageModel } from '../constants';
import { TextInput, SectionLabel, PillButton } from './StudioSidebar';
import { Flow } from 'flow-sdk';
export interface MediaPreviewModalProps {
  isOpen: boolean;
  cut: Cut;
  episodeId?: number;
  currentImageModel?: string;
  hasPrev?: boolean;
  hasNext?: boolean;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCuts?: number;
  onClose: () => void;
  onUpdateCut?: (updates: Partial<Cut>) => void;
  onRegenerateImage?: (modelLabel: string, customPrompt?: string, customNeg?: string) => void;
  // 呼び出し元の互換性維持のためのオプショナルプロパティ（内部では不使用）
  onGenerateVideo?: (cut: Cut) => void;
  [key: string]: any;
}
export const MediaPreviewModal: React.FC<MediaPreviewModalProps> = ({
  isOpen,
  cut,
  currentImageModel,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  currentIndex,
  totalCuts,
  onClose,
  onUpdateCut,
  onRegenerateImage
}) => {
  const [isRewriting, setIsRewriting] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [aiWish, setAiWish] = useState('');
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && onPrev) onPrev();
      else if (e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, onPrev, onNext]);
  if (!isOpen) return null;
  const imageSrc = cut.imageBase64 ? formatDataUri(cut.imageBase64) : null;
  const activePrompt = cut.finalPromptUsed || cut.promptEn || '';
  const handleCopyPrompt = async () => {
    if (!activePrompt) return;
    try {
      await navigator.clipboard.writeText(activePrompt);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch (err) {
      console.error('Failed to copy prompt:', err);
    }
  };
  const handleAiWishRequest = async () => {
    if (!aiWish.trim() || isRewriting || cut.isGeneratingImage) return;
    setIsRewriting(true);
    try {
      const rewritePrompt = `Rewrite the image generation prompt based on this creative direction: "${aiWish}". Original English prompt: ${cut.promptEn}. Output ONLY the refined English prompt for text-to-image generation.`;
      const { text } = await callWithRetry<any>(
        () => Flow.generate.text(rewritePrompt, { systemInstruction: "You are an expert cinematic anime prompt engineer specializing in composition and lighting." }),
        undefined, 4
      );
      const refinedPrompt = (text || '').trim();
      if (refinedPrompt) {
        if (onUpdateCut) {
          onUpdateCut({ promptEn: refinedPrompt });
        }
        setAiWish('');
        if (onRegenerateImage) {
          onRegenerateImage(resolveImageModel(currentImageModel).label, refinedPrompt, cut.negativePrompt);
        }
      }
    } catch (err) {
      console.error('AI wish rewrite failed:', err);
    } finally {
      setIsRewriting(false);
    }
  };
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-2 sm:p-4 select-none">
      <div className="absolute inset-0 bg-black/95 backdrop-blur-xl" onClick={onClose} />
      <div className="relative w-full max-w-[1240px] h-[95vh] lg:h-[86vh] bg-[#0d0f12] border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col lg:flex-row animate-in fade-in zoom-in-95 duration-200">
        
        {/* ── 左側: 静止画メインインスペクター ── */}
        <div className="flex-1 bg-black relative flex items-center justify-center p-3 sm:p-6 lg:p-8 min-h-0 overflow-hidden">
          <div className="relative h-full w-full flex items-center justify-center">
            {/* ナビゲーション: 前のカット */}
            {hasPrev && onPrev && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onPrev(); }}
                className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 z-50 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900/80 hover:bg-indigo-600 border border-slate-700 hover:border-indigo-400 text-white backdrop-blur-md flex items-center justify-center transition-all shadow-2xl cursor-pointer hover:scale-110 active:scale-95 group"
                title="前のカットへ移動 (←)"
              >
                <span className="material-symbols-outlined text-[26px] group-hover:-translate-x-0.5 transition-transform">chevron_left</span>
              </button>
            )}
            {/* ナビゲーション: 次のカット */}
            {hasNext && onNext && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); onNext(); }}
                className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-50 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-slate-900/80 hover:bg-indigo-600 border border-slate-700 hover:border-indigo-400 text-white backdrop-blur-md flex items-center justify-center transition-all shadow-2xl cursor-pointer hover:scale-110 active:scale-95 group"
                title="次のカットへ移動 (→)"
              >
                <span className="material-symbols-outlined text-[26px] group-hover:translate-x-0.5 transition-transform">chevron_right</span>
              </button>
            )}
            {/* カット番号インジケーター */}
            <div className="absolute top-3 left-3 sm:top-4 sm:left-4 z-40 px-3 py-1 rounded-full bg-slate-900/85 backdrop-blur-md border border-slate-700 text-slate-200 text-xs font-mono font-bold flex items-center gap-2 shadow-xl">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>
                CUT #{String(currentIndex !== undefined ? currentIndex : cut.id).padStart(2, '0')}
                {totalCuts !== undefined && <span className="text-slate-500 font-normal"> / {totalCuts}</span>}
              </span>
            </div>
            {/* 構図メタデータバッジ群（メイン画面上部右寄せ） */}
            <div className="absolute top-3 right-3 sm:top-4 right-4 z-40 flex items-center gap-1.5 flex-wrap justify-end pointer-events-none">
              {cut.shotScale && (
                <div className="px-2.5 py-1 rounded-md bg-amber-400/90 text-slate-950 font-black text-[10px] tracking-tight uppercase shadow-md pointer-events-auto">
                  {cut.shotScale}
                </div>
              )}
              {cut.cinematicAngle && (
                <div className="px-2.5 py-1 rounded-md bg-slate-800/90 border border-slate-700 text-slate-200 font-semibold text-[10px] tracking-tight shadow-md max-w-[200px] truncate pointer-events-auto" title={cut.cinematicAngle}>
                  {cut.cinematicAngle}
                </div>
              )}
              {cut.panelLayout && (
                <div className="px-2 py-1 rounded-md bg-indigo-950/80 border border-indigo-700/60 text-indigo-300 font-mono text-[10px] uppercase shadow-md pointer-events-auto">
                  {cut.panelLayout}
                </div>
              )}
              {cut.isObjectOnly && (
                <div className="px-2 py-1 rounded-md bg-emerald-700 text-white font-bold text-[10px] uppercase shadow-md pointer-events-auto">
                  📦 静物/情景
                </div>
              )}
            </div>
            {/* 画像プレビューコンテナ */}
            <div className="relative h-full max-h-full aspect-square shadow-2xl rounded-2xl overflow-hidden border border-slate-800 group bg-[#101317] flex items-center justify-center">
              {imageSrc ? (
                <div 
                  className={`w-full h-full overflow-hidden flex items-center justify-center cursor-zoom-in transition-all ${isZoomed ? 'cursor-zoom-out' : ''}`}
                  onClick={() => setIsZoomed(!isZoomed)}
                  title={isZoomed ? "クリックで縮小" : "クリックで原寸/拡大表示"}
                >
                  <img 
                    src={imageSrc} 
                    className={`transition-transform duration-300 select-none ${
                      isZoomed ? 'scale-[1.8] cursor-zoom-out' : 'w-full h-full object-contain block'
                    }`} 
                    alt={`Cut ${cut.id}`} 
                  />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 gap-2 p-6 text-center">
                  <span className="material-symbols-outlined text-4xl text-slate-700">image</span>
                  <span className="text-xs font-mono font-bold tracking-widest text-slate-500 uppercase">
                    未生成カット (Standby)
                  </span>
                  <p className="text-[11px] text-slate-600 max-w-[240px]">
                    右側パネルの「画像を生成」から静止画を描画できます
                  </p>
                </div>
              )}
              {/* 生成・書き換え中のスピナー */}
              {(isRewriting || cut.isGeneratingImage) && (
                <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center gap-3 z-50 animate-in fade-in duration-200">
                  <div className="w-12 h-12 border-3 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                  <span className="text-xs font-black text-indigo-400 tracking-wider uppercase animate-pulse">
                    {isRewriting ? '✨ プロンプト推敲中...' : '🎨 静止画を描画中...'}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
        {/* ── 右側: 静止画・構図インスペクターパネル ── */}
        <div className="w-full lg:w-[440px] h-[480px] lg:h-full bg-[#13161c] border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col shadow-2xl shrink-0">
          {/* ヘッダー */}
          <div className="p-4 lg:p-5 border-b border-slate-800 flex items-center justify-between bg-[#171b22]">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-indigo-400 text-xl">palette</span>
              <div>
                <h3 className="text-sm lg:text-base font-black tracking-tight text-white">静止画インスペクター</h3>
                <p className="text-[10px] text-slate-400">構図・演出パラメータの詳細設定</p>
              </div>
            </div>
            <button 
              onClick={onClose} 
              className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              title="閉じる (Esc)"
            >
              <span className="material-symbols-outlined text-xl">close</span>
            </button>
          </div>
          {/* コンテンツエリア */}
          <div className="flex-1 overflow-y-auto p-4 lg:p-5 flex flex-col gap-4 dark-scrollbar min-h-0">
            {/* 1. 日本語演出 / ナレーション */}
            <div className="flex flex-col gap-1.5">
              <SectionLabel>🎬 演出・ナレーション (JP)</SectionLabel>
              <TextInput 
                value={cut.narrationJp || ''} 
                onChange={v => onUpdateCut && onUpdateCut({ narrationJp: v })}
                placeholder="カットの状況説明やセリフを入力..."
              />
            </div>
            {/* 2. 構図メタデータバッジ詳細 */}
            <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-slate-900/80 border border-slate-800 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">構図ディレクション</span>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-500 font-semibold">ショットスケール</span>
                  <span className="text-xs font-bold text-amber-300 truncate">{cut.shotScale || 'Standard'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-500 font-semibold">カメラアングル</span>
                  <span className="text-xs font-medium text-slate-200 truncate" title={cut.cinematicAngle || 'Eye-level'}>
                    {cut.cinematicAngle || 'Eye-level'}
                  </span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-500 font-semibold">コマ割りレイアウト</span>
                  <span className="text-xs font-mono text-indigo-300">{cut.panelLayout || 'single'}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[9px] text-slate-500 font-semibold">被写体構成</span>
                  <span className="text-xs text-slate-300">
                    {cut.isObjectOnly ? '静物・情景オンリー' : '人物・キャラクター主体'}
                  </span>
                </div>
              </div>
            </div>
            {/* 3. AIによるプロンプト自動推敲（おねがい） */}
            <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-800/40">
              <SectionLabel>✨ AIへ構図演出のお願い（プロンプト推敲＆再描画）</SectionLabel>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={aiWish}
                  onChange={e => setAiWish(e.target.value)}
                  placeholder="例: 夕暮れの強い逆光にして、視線を少し斜め下に..."
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-indigo-500 text-white placeholder:text-slate-500"
                  onKeyDown={e => e.key === 'Enter' && handleAiWishRequest()}
                />
                <PillButton
                  variant="filled"
                  className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-8 px-3.5 text-xs shrink-0"
                  onClick={handleAiWishRequest}
                  disabled={isRewriting || cut.isGeneratingImage || !aiWish.trim()}
                >
                  反映
                </PillButton>
              </div>
            </div>
            {/* 4. 英語プロンプト（コードブロック・コピー可能） */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <SectionLabel>📝 英語プロンプト (Prompt EN)</SectionLabel>
                {activePrompt && (
                  <button
                    type="button"
                    onClick={handleCopyPrompt}
                    className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 font-mono py-0.5 px-1.5 rounded bg-indigo-950/40 border border-indigo-900/50 hover:border-indigo-700 transition-colors cursor-pointer"
                    title="プロンプトをクリップボードにコピー"
                  >
                    <span className="material-symbols-outlined text-[13px]">
                      {copiedPrompt ? 'check' : 'content_copy'}
                    </span>
                    <span>{copiedPrompt ? 'コピー完了' : 'コピー'}</span>
                  </button>
                )}
              </div>
              <div className="relative group">
                <pre className="w-full bg-[#0a0c0f] border border-slate-800 rounded-xl p-3 text-[11px] font-mono text-slate-300 leading-relaxed whitespace-pre-wrap break-all max-h-[160px] overflow-y-auto dark-scrollbar select-text selection:bg-indigo-800 selection:text-white">
                  {activePrompt || '(プロンプト未設定)'}
                </pre>
              </div>
              <div className="mt-1">
                <TextInput 
                  label="プロンプト直接編集" 
                  value={cut.promptEn || ''} 
                  onChange={v => onUpdateCut && onUpdateCut({ promptEn: v })}
                  placeholder="画像生成用プロンプトを直接編集..."
                />
              </div>
            </div>
          </div>
          {/* フッターアクション */}
          <div className="p-4 lg:p-5 bg-[#171b22] border-t border-slate-800 flex items-center gap-2.5 shrink-0 z-10">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
            >
              閉じる
            </button>
            <PillButton 
              variant="filled" 
              className="flex-[2] h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md" 
              disabled={cut.isGeneratingImage || isRewriting} 
              onClick={() => {
                if (onRegenerateImage) {
                  onRegenerateImage(resolveImageModel(currentImageModel).label, cut.promptEn, cut.negativePrompt);
                }
              }} 
              icon={<span className="material-symbols-outlined text-[18px]">photo_camera</span>}
            >
              {cut.isGeneratingImage ? '描画処理中...' : '静止画を再生成'}
            </PillButton>
          </div>
        </div>
      </div>
    </div>
  );
};
