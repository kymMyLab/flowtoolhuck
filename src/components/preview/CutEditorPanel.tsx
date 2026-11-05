import React, { useState } from 'react';
import { Cut, VideoModelType, KenBurnsPreset } from '../../types';
import { 
  CAMERA_WORK_REGISTRY,
  VIDEO_MODELS_REGISTRY,
  KEN_BURNS_PRESETS, 
  STUDIO_NEON_PALETTE,
  sanitizeFilename,
  resolveImageModel,
  resolveTelopStyle,
  resolveTelopTransition,
  resolveTelopPosition,
  resolveRecommendedTelopStaging
} from '../../constants';
import { Flow } from 'flow-sdk';
import { callWithRetry } from '../../services/utils';
import { extractHighlights } from '../../services/directorService';
import { TextInput, SectionLabel, PillButton, FieldDropdown } from '../Primitives';
import { CutTelopEditor } from './CutTelopEditor';

export interface CutEditorPanelProps {
  cut: Cut;
  episodeId: number;
  currentImageModel?: string;
  isMvMode?: boolean;
  showTelop: boolean;
  setShowTelop: (show: boolean) => void;
  onClose: () => void;
  onUpdateCut: (updates: Partial<Cut>) => void;
  onBulkRerollTelop?: (epId: number) => void;
  onRegenerateImage: (modelLabel: string, customPrompt?: string, customNeg?: string) => void;
  onAnimate: (m: VideoModelType) => void;
  onBrowserAnimate: () => void;
  isRewriting: boolean;
  setIsRewriting: (val: boolean) => void;
  onGenerateEndFrame?: (customEndPrompt?: string) => void;
}

export const CutEditorPanel: React.FC<CutEditorPanelProps> = ({
  cut,
  episodeId,
  currentImageModel,
  isMvMode,
  showTelop,
  setShowTelop,
  onClose,
  onUpdateCut,
  onBulkRerollTelop,
  onRegenerateImage,
  onAnimate,
  onBrowserAnimate,
  isRewriting,
  setIsRewriting,
  onGenerateEndFrame
}) => {
  const [aiWish, setAiWish] = useState('');
  const handleAiWishRequest = async () => {
    if (!aiWish.trim() || isRewriting || cut.isGeneratingImage) return;
    setIsRewriting(true);
    try {
      const rewritePrompt = `Rewrite the image generation prompt based on: "${aiWish}". Original: ${cut.promptEn}. Output ONLY English prompt.`;
      const { text } = await callWithRetry<any>(
        () => Flow.generate.text(rewritePrompt, { systemInstruction: "Expert cinematic prompt engineer." }),
        undefined, 4
      );
      const refinedPrompt = (text || '').trim();
      if (refinedPrompt) {
        onUpdateCut({ promptEn: refinedPrompt });
        setAiWish('');
        onRegenerateImage(resolveImageModel(currentImageModel).label, refinedPrompt, cut.negativePrompt);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRewriting(false);
    }
  };

  const rerollStaging = () => {
    const rawText = cut.telop?.fullText || cut.narrationJp || '';
    const highlights = (cut.telop?.highlights && cut.telop.highlights.length > 0)
      ? cut.telop.highlights 
      : extractHighlights(rawText);
    const staging = resolveRecommendedTelopStaging(cut.id, isMvMode, false, {
      transition: cut.telop?.transition,
      position: cut.telop?.position,
      style: cut.telop?.style
    });
    onUpdateCut({
      telop: {
        fullText: rawText,
        highlights,
        style: staging.style,
        transition: staging.transition,
        position: staging.position,
        directorNote: staging.directorNote
      }
    });
  };

  

  const staging = resolveRecommendedTelopStaging(cut.id, isMvMode, false);
  const currentStyle = resolveTelopStyle(cut.telop?.style || staging.style);
  const currentTrans = resolveTelopTransition(cut.telop?.transition || staging.transition);
  const currentPos = cut.telop?.position || staging.position;
  const posLabel = resolveTelopPosition(currentPos).name;
  const directorNote = cut.telop?.directorNote || staging.directorNote;

  return (
    <div className="w-full lg:w-[420px] h-[400px] lg:h-full bg-[#121212] border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col shadow-2xl shrink-0">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-white/5 flex items-center justify-between bg-[#151515]">
        <h3 className="text-lg lg:text-xl font-black italic tracking-tighter uppercase">Cut Editor Pro</h3>
        <button onClick={onClose} className="text-white/20 hover:text-white transition-colors">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Editor Body */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 flex flex-col gap-6 dark-scrollbar min-h-0 pb-14">
        <div className="flex flex-col gap-4">
          <TextInput label="ナレーション (JP)" value={cut.narrationJp || ''} onChange={v => onUpdateCut({ narrationJp: v })} />
          
          {/* ✨ AIへのおねがい */}
          <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <SectionLabel>✨ AIへのおねがい</SectionLabel>
            <div className="flex gap-2">
              <input
                type="text"
                value={aiWish}
                onChange={e => setAiWish(e.target.value)}
                placeholder="例: 表情をもっと険しく..."
                className="flex-1 bg-black/60 border border-white/15 rounded-lg px-3 py-1.5 text-xs outline-none focus:border-amber-500/80 text-white placeholder:text-white/30"
                onKeyDown={e => e.key === 'Enter' && handleAiWishRequest()}
              />
              <PillButton
                variant="filled"
                className="bg-amber-500 hover:bg-amber-400 text-black font-black h-8 px-4 text-xs"
                onClick={handleAiWishRequest}
                disabled={isRewriting || cut.isGeneratingImage || !aiWish.trim()}
              >
                反映
              </PillButton>
            </div>
          </div>

          {/* テロップ設定 */}
          <CutTelopEditor
            cut={cut}
            episodeId={episodeId}
            showTelop={showTelop}
            setShowTelop={setShowTelop}
            onUpdateCut={onUpdateCut}
            onBulkRerollTelop={onBulkRerollTelop}
            isMvMode={isMvMode}
          />

          

          <FieldDropdown
            label="コマ割り構成 (Panel Layout)"
            value={
              cut.panelLayout === 'single' ? '🖼️ 1コマ大ゴマ (Single Splash)' :
              cut.panelLayout === 'diagonal-slash' ? '⚔️ 斜めスラッシュ (Diagonal Slash)' :
              cut.panelLayout === 'l-shaped' ? '📐 L字変形3コマ (L-Shaped 3-Panel)' :
              cut.panelLayout === 'panoramic-split' ? '🌄 パノラマ+2分割 (Panoramic Split)' :
              cut.panelLayout === 'inset-reaction' ? '🔍 インセット小ゴマ (Inset Reaction)' :
              cut.panelLayout === 'vertical-split' ? '▥ 左右縦割り2分割 (Vertical Split)' :
              cut.panelLayout === 'split-2' ? '◫ 2コマ分割 (2-Panel Split)' :
              cut.panelLayout === 'split-3' ? '☰ 変形3コマ (Dynamic 3-Panel)' :
              '🎲 おまかせ変形 (Dynamic Multi)'
            }
            options={[
              '🎲 おまかせ変形 (Dynamic Multi)',
              '⚔️ 斜めスラッシュ (Diagonal Slash)',
              '📐 L字変形3コマ (L-Shaped 3-Panel)',
              '🌄 パノラマ+2分割 (Panoramic Split)',
              '🔍 インセット小ゴマ (Inset Reaction)',
              '▥ 左右縦割り2分割 (Vertical Split)',
              '◫ 2コマ分割 (2-Panel Split)',
              '☰ 変形3コマ (Dynamic 3-Panel)',
              '🖼️ 1コマ大ゴマ (Single Splash)'
            ]}
            onChange={l => {
              const map: Record<string, string> = {
                '🎲 おまかせ変形 (Dynamic Multi)': 'dynamic-multi',
                '⚔️ 斜めスラッシュ (Diagonal Slash)': 'diagonal-slash',
                '📐 L字変形3コマ (L-Shaped 3-Panel)': 'l-shaped',
                '🌄 パノラマ+2分割 (Panoramic Split)': 'panoramic-split',
                '🔍 インセット小ゴマ (Inset Reaction)': 'inset-reaction',
                '▥ 左右縦割り2分割 (Vertical Split)': 'vertical-split',
                '◫ 2コマ分割 (2-Panel Split)': 'split-2',
                '☰ 変形3コマ (Dynamic 3-Panel)': 'split-3',
                '🖼️ 1コマ大ゴマ (Single Splash)': 'single'
              };
              onUpdateCut({ panelLayout: map[l] || 'dynamic-multi' });
            }}
          />

          <TextInput label="画像プロンプト (EN)" value={cut.promptEn || ''} onChange={v => onUpdateCut({ promptEn: v })} />

          {/* ── 🎨 画像生成インプット解析インスペクター ── */}
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-purple-950/20 border border-purple-500/30 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-purple-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-purple-400">tune</span>
                画像生成インプット解析 (Prompt Inspector)
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                {cut.styleKeyUsed ? `画風: ${cut.styleKeyUsed.split(' (')[0].split('（')[0]}` : '画風情報'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-black/50 p-2 rounded-lg border border-white/5 flex flex-col">
                <span className="text-white/40 font-bold text-[9px]">適用画風 (Style)</span>
                <span className="text-white/90 font-medium truncate" title={cut.styleKeyUsed || '未記録'}>
                  {cut.styleKeyUsed || '未記録'}
                </span>
              </div>
              <div className="bg-black/50 p-2 rounded-lg border border-white/5 flex flex-col">
                <span className="text-white/40 font-bold text-[9px]">使用モデル (Model)</span>
                <span className="text-white/90 font-medium truncate" title={cut.imageModelUsed || currentImageModel || '未記録'}>
                  {cut.imageModelUsed || currentImageModel || '未記録'}
                </span>
              </div>
            </div>

            {/* 実際にAPIへ送られた完全合成プロンプト */}
            <div className="flex flex-col gap-1 bg-black/60 p-2.5 rounded-lg border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-400 flex items-center gap-1">
                  <span>{cut.finalPromptUsed ? '⚡ API送信実績プロンプト (実際に入力された値)' : '📋 送信予定プロンプト (未送信プレビュー)'}</span>
                </span>
                {cut.finalPromptUsed && (
                  <button 
                    type="button" 
                    onClick={() => navigator.clipboard.writeText(cut.finalPromptUsed || '')}
                    className="text-[9px] text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/40 px-1.5 py-0.5 rounded border border-amber-500/30 transition-colors cursor-pointer"
                  >
                    コピー (送信実績)
                  </button>
                )}
              </div>
              <p className="text-[10px] text-white/70 font-mono leading-relaxed max-h-24 overflow-y-auto dark-scrollbar select-text break-words">
                {cut.finalPromptUsed || (cut.promptEn ? `(未送信プレビュー) Masterpiece, authentic ${cut.styleKeyUsed || ''}... ${cut.promptEn}` : '生成ログがありません')}
              </p>
            </div>

            {/* 送信されたネガティブプロンプト */}
            <div className="flex flex-col gap-1 bg-black/60 p-2.5 rounded-lg border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
                  <span>{cut.finalNegativeUsed ? '🚫 API送信実績ネガティブ (実際に入力された値)' : '🚫 送信予定ネガティブ (未送信プレビュー)'}</span>
                </span>
                {cut.finalNegativeUsed && (
                  <button 
                    type="button" 
                    onClick={() => navigator.clipboard.writeText(cut.finalNegativeUsed || '')}
                    className="text-[9px] text-red-300 hover:text-white bg-red-500/20 hover:bg-red-500/40 px-1.5 py-0.5 rounded border border-red-500/30 transition-colors cursor-pointer"
                  >
                    コピー (送信実績)
                  </button>
                )}
              </div>
              <p className="text-[10px] text-white/70 font-mono leading-relaxed max-h-20 overflow-y-auto dark-scrollbar select-text break-words">
                {cut.finalNegativeUsed || (cut.negativePrompt ? `(未送信プレビュー) ${cut.negativePrompt}` : '(指定なし)')}
              </p>
            </div>
          </div>

          {/* ── 🎬 ディレクター演出・テロップ解析インスペクター ── */}
          <div className="flex flex-col gap-2 p-3 rounded-xl bg-amber-950/20 border border-amber-500/30 mt-1">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-black text-amber-300 flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-amber-400">movie_edit</span>
                ディレクター演出解析 (Director Staging & Telop)
              </span>
              <span className="text-[9px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30 flex items-center gap-1">
                <span className="material-symbols-outlined text-[11px]">auto_awesome</span>
                AI Director 指示
              </span>
            </div>

            {/* ディレクターの演出意図 */}
            <div className="flex flex-col gap-1 bg-black/60 p-2.5 rounded-lg border border-amber-500/20">
              <span className="text-[9.5px] font-bold text-amber-400/90 flex items-center gap-1">
                <span>💡 カット演出意図 (Director's Intent)</span>
              </span>
              <p className="text-[10.5px] text-white/90 font-medium leading-relaxed select-text">
                {directorNote}
              </p>
            </div>

            {/* スタイル & モーショントランジション */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-black/50 p-2 rounded-lg border border-white/5 flex flex-col gap-0.5">
                <span className="text-white/40 font-bold text-[9px]">演出スタイル (Style)</span>
                <span className="text-amber-300 font-bold truncate flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: currentStyle.badgeColor || '#FFE600' }} />
                  {currentStyle.name.split(' (')[0]}
                </span>
                <span className="text-white/40 text-[8.5px] truncate" title={currentStyle.description}>
                  {currentStyle.description}
                </span>
              </div>
              <div className="bg-black/50 p-2 rounded-lg border border-white/5 flex flex-col gap-0.5">
                <span className="text-white/40 font-bold text-[9px]">トランジション (Motion)</span>
                <span className="text-cyan-300 font-bold truncate flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">{currentTrans.icon}</span>
                  {currentTrans.name}
                </span>
                <span className="text-white/40 text-[8.5px] truncate" title={currentTrans.description}>
                  {currentTrans.description}
                </span>
              </div>
            </div>

            {/* テロップ配置 ＆ タイポグラフィ特効 */}
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-black/50 p-2 rounded-lg border border-white/5 flex flex-col">
                <span className="text-white/40 font-bold text-[9px]">配置構図 (Placement)</span>
                <span className="text-white/90 font-bold truncate" title={posLabel}>
                  {posLabel.split(' (')[0]}
                </span>
              </div>
              <div className="bg-black/50 p-2 rounded-lg border border-white/5 flex flex-col">
                <span className="text-white/40 font-bold text-[9px]">タイポグラフィ特効</span>
                <span className="text-white/90 font-bold truncate" title="Zen Kaku Gothic New (900) + Vook Directional Blur Ease-Out">
                  Zen Kaku Gothic (900)
                </span>
              </div>
            </div>

            {/* 強調キーワード点灯状況 */}
            <div className="flex flex-col gap-1 bg-black/40 p-2 rounded-lg border border-white/5">
              <span className="text-[9px] font-bold text-white/50">✨ 強調キーワード点灯状況:</span>
              <div className="flex flex-wrap gap-1">
                {cut.telop?.highlights && cut.telop.highlights.length > 0 ? (
                  cut.telop.highlights.map((h, i) => {
                    const isLit = cut.telop?.fullText?.includes(h.word);
                    return (
                      <span key={i} className={`px-1.5 py-0.5 rounded text-[9px] font-bold border flex items-center gap-1 ${isLit ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 shadow-[0_0_8px_rgba(255,230,0,0.15)]' : 'bg-white/5 border-white/10 text-white/30'}`}>
                        <span>{isLit ? '✨' : '⚪'}</span>
                        <span>{h.word}</span>
                        <span className="text-[8px] opacity-75">{isLit ? '(特大・ゴールド)' : '(未検出)'}</span>
                      </span>
                    );
                  })
                ) : (
                  <span className="text-[9px] text-white/30 italic">なし（全体均一表示）</span>
                )}
              </div>
            </div>

            {/* 🎲 テロップ演出リロール */}
            <div className="flex gap-2 pt-1 border-t border-white/5">
              <button
                type="button"
                onClick={rerollStaging}
                className="flex-1 py-1.5 px-2.5 rounded-lg text-[10px] font-black bg-purple-500/25 hover:bg-purple-500/40 text-purple-200 border border-purple-500/50 flex items-center justify-center gap-1 transition-all shadow-md shadow-purple-950/20"
                title="画像は変更せず、このカットのテロップ演出（動き・配置・スタイル）だけを再抽選します"
              >
                <span className="material-symbols-outlined text-[13px]">casino</span>
                このカットの演出を再抽選
              </button>
              {onBulkRerollTelop && (
                <button
                  type="button"
                  onClick={() => onBulkRerollTelop(episodeId)}
                  className="py-1.5 px-3 rounded-lg text-[10px] font-black bg-amber-500/20 hover:bg-amber-500/35 text-amber-300 border border-amber-500/40 flex items-center justify-center gap-1 transition-all"
                  title="全12カットのテロップ演出を一気に再抽選（画像は保持）"
                >
                  <span className="material-symbols-outlined text-[13px]">auto_mode</span>
                  全カット一括リロール
                </button>
              )}
            </div>
          </div>
        </div>

        
      </div>

      {/* Bottom Action Footer */}
      <div className="p-4 lg:p-6 bg-[#161616] border-t border-white/10 shrink-0 z-10">
        <PillButton 
          variant="solid" 
          className="w-full h-11 bg-white text-black font-black" 
          disabled={cut.isGeneratingImage || isRewriting} 
          onClick={() => onRegenerateImage(resolveImageModel(currentImageModel).label, cut.promptEn, cut.negativePrompt)} 
          icon={<span className="material-symbols-outlined">image</span>}
        >
          {cut.isGeneratingImage ? '描画中...' : '画像を再描画'}
        </PillButton>
      </div>
    </div>
  );
};
