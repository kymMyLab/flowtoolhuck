import React, { useState } from 'react';
import { Cut } from '../../types';
import { resolveImageModel } from '../../constants';
import { Flow } from 'flow-sdk';
import { callWithRetry } from '../../services/utils';
import { TextInput, SectionLabel, PillButton, FieldDropdown, ToggleSwitch } from '../Primitives';

export interface CutEditorPanelProps {
  cut: Cut;
  episodeId: number;
  currentImageModel?: string;
  showTelop: boolean;
  setShowTelop: (show: boolean) => void;
  onClose: () => void;
  onUpdateCut: (updates: Partial<Cut>) => void;
  onRegenerateImage: (modelLabel: string, customPrompt?: string, customNeg?: string) => void;
  isRewriting: boolean;
  setIsRewriting: (val: boolean) => void;
}

export const CutEditorPanel: React.FC<CutEditorPanelProps> = ({
  cut,
  currentImageModel,
  showTelop,
  setShowTelop,
  onClose,
  onUpdateCut,
  onRegenerateImage,
  isRewriting,
  setIsRewriting
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

  return (
    <div className="w-full lg:w-[420px] h-[400px] lg:h-full bg-[#121212] border-t lg:border-t-0 lg:border-l border-white/10 flex flex-col shadow-2xl shrink-0">
      {/* Header */}
      <div className="p-4 lg:p-6 border-b border-white/5 flex items-center justify-between bg-[#151515]">
        <h3 className="text-lg lg:text-xl font-black italic tracking-tighter uppercase text-white">Cut Editor Pro</h3>
        <button onClick={onClose} className="text-white/40 hover:text-white transition-colors cursor-pointer">
          <span className="material-symbols-outlined">close</span>
        </button>
      </div>

      {/* Editor Body */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 flex flex-col gap-5 dark-scrollbar min-h-0 pb-14">
        <div className="flex flex-col gap-4">
          <TextInput label="ナレーション / セリフ (JP)" value={cut.narrationJp || ''} onChange={v => onUpdateCut({ narrationJp: v })} />
          <ToggleSwitch label="プレビュー上に字幕を表示する" checked={showTelop} onChange={setShowTelop} />

          {/* ✨ AIへのおねがい */}
          <div className="flex flex-col gap-2 p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30">
            <SectionLabel>✨ AIへのおねがい（プロンプト自動書き換え＆再描画）</SectionLabel>
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
              onUpdateCut({ panelLayout: (map[l] || 'dynamic-multi') as any });
            }}
          />

          <TextInput label="画像プロンプト (EN)" value={cut.promptEn || ''} onChange={v => onUpdateCut({ promptEn: v })} />

          {/* 画像生成インプット解析インスペクター */}
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

            <div className="flex flex-col gap-1 bg-black/60 p-2.5 rounded-lg border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-400">
                  {cut.finalPromptUsed ? '⚡ API送信実績プロンプト' : '📋 送信予定プロンプト'}
                </span>
                {cut.finalPromptUsed && (
                  <button 
                    type="button" 
                    onClick={() => navigator.clipboard.writeText(cut.finalPromptUsed || '')}
                    className="text-[9px] text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/40 px-1.5 py-0.5 rounded border border-amber-500/30 transition-colors cursor-pointer"
                  >
                    コピー
                  </button>
                )}
              </div>
              <p className="text-[10px] text-white/70 font-mono leading-relaxed max-h-24 overflow-y-auto dark-scrollbar select-text break-words">
                {cut.finalPromptUsed || cut.promptEn || '生成ログがありません'}
              </p>
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
