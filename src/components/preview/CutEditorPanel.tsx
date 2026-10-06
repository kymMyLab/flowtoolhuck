import React, { useState } from 'react';
import { Cut, VideoModelType, KenBurnsPreset } from '../../types';
import { 
  CAMERA_WORK_REGISTRY,
  VIDEO_MODELS_REGISTRY,
  KEN_BURNS_PRESETS, 
  TELOP_STYLE_REGISTRY,
  TELOP_TRANSITION_REGISTRY,
  TELOP_POSITION_REGISTRY,
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
import { normalizeKenBurnsPreset } from '../../services/renderers/kenBurns';
import { TextInput, SectionLabel, PillButton, ToggleSwitch, FieldDropdown } from '../Primitives';

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
  const [newKeyword, setNewKeyword] = useState('');
  const [downloadState, setDownloadState] = useState<'idle' | 'saving' | 'done'>('idle');

  const videoSrc = cut.videoBase64
    ? (cut.videoBase64.startsWith('data:') ? cut.videoBase64 : `data:video/mp4;base64,${cut.videoBase64}`)
    : null;

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

  const handleAddKeyword = () => {
    const target = newKeyword.trim();
    if (!target) return;
    const currentHighlights = cut.telop?.highlights || [];
    if (!currentHighlights.some(h => h.word === target)) {
      const next = [...currentHighlights, { word: target, color: '#FFE600', sizeScale: 1.1 }];
      onUpdateCut({ telop: { ...(cut.telop || {}), fullText: cut.telop?.fullText || '', highlights: next } });
    }
    setNewKeyword('');
  };

  const handleRemoveKeyword = (wordToRemove: string) => {
    const currentHighlights = cut.telop?.highlights || [];
    const next = currentHighlights.filter(h => h.word !== wordToRemove);
    onUpdateCut({ telop: { ...(cut.telop || {}), fullText: cut.telop?.fullText || '', highlights: next } });
  };

  const handleAutoExtract = () => {
    const text = cut.telop?.fullText || cut.narrationJp || '';
    const auto = extractHighlights(text);
    onUpdateCut({ telop: { ...cut.telop!, fullText: text, highlights: auto } });
  };

  const handleDownloadVideo = async () => {
    if (!cut.videoBase64 || downloadState !== 'idle') return;
    setDownloadState('saving');
    try {
      const base64 = cut.videoBase64.includes('base64,') ? cut.videoBase64.split('base64,')[1] : cut.videoBase64;
      await Flow.download({ base64, mimeType: 'video/mp4', filename: `${sanitizeFilename(cut.narrationJp || 'cut')}_video.mp4` });
      setDownloadState('done');
      setTimeout(() => setDownloadState('idle'), 2000);
    } catch (err) {
      setDownloadState('idle');
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

  const currentCw = CAMERA_WORK_REGISTRY.find(
    c => c.id === cut.cameraWork ||
         c.motionPrompt === cut.cameraMotion ||
         (cut.kenBurnsPreset && cut.kenBurnsPreset !== 'none' && c.recommendedKenBurns === cut.kenBurnsPreset)
  ) || CAMERA_WORK_REGISTRY[0];

  const currentKb = KEN_BURNS_PRESETS.find(
    p => p.value === normalizeKenBurnsPreset(cut.kenBurnsPreset)
  ) || KEN_BURNS_PRESETS[0];

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
          <div className="flex items-center justify-between">
            <SectionLabel>テロップ設定</SectionLabel>
            <button
              type="button"
              onClick={rerollStaging}
              className="px-2 py-0.5 rounded-md text-[10px] font-black bg-purple-500/20 hover:bg-purple-500/35 text-purple-300 border border-purple-500/40 flex items-center gap-1 transition-all"
              title="画像は変更せず、このカットのテロップ演出（動き・配置・スタイル）だけを再抽選します"
            >
              <span className="material-symbols-outlined text-[13px]">casino</span>
              演出リロール
            </button>
          </div>

          <div className="bg-white/5 p-3.5 rounded-xl border border-white/5 flex flex-col gap-3">
            <ToggleSwitch label="字幕を表示する" checked={showTelop} onChange={setShowTelop} />
            
            <TextInput 
              label="字幕テキスト" 
              value={cut.telop?.fullText || ''} 
              onChange={v => {
                const currentHighlights = cut.telop?.highlights || [];
                const validExisting = currentHighlights.filter(h => h.word && v.includes(h.word));
                const nextHighlights = validExisting.length > 0 ? validExisting : extractHighlights(v);
                onUpdateCut({ telop: { ...(cut.telop || {}), fullText: v, highlights: nextHighlights } });
              }} 
            />

            {/* ── 🎬 Vook風テロップ演出セレクター ── */}
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-white/5">
              <FieldDropdown 
                label="演出スタイル" 
                value={TELOP_STYLE_REGISTRY.find(s => s.id === cut.telop?.style)?.name || TELOP_STYLE_REGISTRY[0].name} 
                options={TELOP_STYLE_REGISTRY.map(s => s.name)} 
                onChange={name => {
                  const found = TELOP_STYLE_REGISTRY.find(s => s.name === name);
                  if (found) {
                    onUpdateCut({ 
                      telop: { 
                        ...(cut.telop || {}), 
                        fullText: cut.telop?.fullText || cut.narrationJp || '',
                        style: found.id,
                        transition: cut.telop?.transition || found.defaultTransition,
                        position: cut.telop?.position || found.defaultPosition
                      } 
                    });
                  }
                }} 
              />
              <FieldDropdown 
                label="トランジション" 
                value={TELOP_TRANSITION_REGISTRY.find(t => t.id === cut.telop?.transition)?.name || TELOP_TRANSITION_REGISTRY[0].name} 
                options={TELOP_TRANSITION_REGISTRY.map(t => t.name)} 
                onChange={name => {
                  const found = TELOP_TRANSITION_REGISTRY.find(t => t.name === name);
                  if (found) {
                    onUpdateCut({ 
                      telop: { 
                        ...(cut.telop || {}), 
                        fullText: cut.telop?.fullText || cut.narrationJp || '',
                        transition: found.id 
                      } 
                    });
                  }
                }} 
              />
            </div>
            <div className="grid grid-cols-1 gap-2">
              <FieldDropdown 
                label="テロップ配置構図" 
                value={TELOP_POSITION_REGISTRY.find(p => p.id === cut.telop?.position)?.name || TELOP_POSITION_REGISTRY[0].name} 
                options={TELOP_POSITION_REGISTRY.map(p => p.name)} 
                onChange={name => {
                  const found = TELOP_POSITION_REGISTRY.find(p => p.name === name);
                  if (found) {
                    onUpdateCut({ 
                      telop: { 
                        ...(cut.telop || {}), 
                        fullText: cut.telop?.fullText || cut.narrationJp || '',
                        position: found.id 
                      } 
                    });
                  }
                }} 
              />
            </div>

            {/* キーワード管理エリア */}
            <div className="flex flex-col gap-2 pt-1 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-amber-400 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">stars</span>
                  金文字強調キーワード
                </span>
                <button 
                  type="button"
                  onClick={handleAutoExtract}
                  className="text-[10px] text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-0.5 transition-colors"
                  title="本文中の漢字熟語から自動抽出"
                >
                  <span className="material-symbols-outlined text-[12px]">sync</span>
                  本文から自動抽出
                </button>
              </div>

              {/* 現在登録されているキーワードの一覧 */}
              <div className="flex flex-wrap gap-1.5 min-h-[26px]">
                {cut.telop?.highlights && cut.telop.highlights.length > 0 ? (
                  cut.telop.highlights.map((h, i) => {
                    const currentFullText = cut.telop?.fullText || '';
                    const isMatch = h.word && currentFullText.includes(h.word);
                    return (
                      <span 
                        key={i} 
                        className={`px-2 py-0.5 rounded-md border text-[10px] font-bold flex items-center gap-1 transition-all ${
                          isMatch 
                            ? 'bg-amber-500/15 border-amber-400 text-amber-300 shadow-[0_0_8px_rgba(255,230,0,0.2)]' 
                            : 'bg-white/5 border-white/10 text-white/35'
                        }`}
                      >
                        <span>{isMatch ? '✨' : '⚠️'} {h.word}</span>
                        <span className={`text-[9px] ${isMatch ? 'text-amber-400/80 font-normal' : 'text-white/20'}`}>
                          {isMatch ? '(点灯中)' : '(未出現)'}
                        </span>
                        <button 
                          type="button"
                          onClick={() => handleRemoveKeyword(h.word)}
                          className="ml-0.5 hover:text-red-400 transition-colors flex items-center"
                          title="キーワードから削除"
                        >
                          <span className="material-symbols-outlined text-[11px]">close</span>
                        </button>
                      </span>
                    );
                  })
                ) : (
                  <span className="text-[10px] text-white/30 italic">キーワードなし（すべて白色で表示中）</span>
                )}
              </div>

              {/* キーワード手動追加フォーム */}
              <div className="flex gap-1.5 mt-1">
                <input 
                  type="text" 
                  value={newKeyword} 
                  onChange={e => setNewKeyword(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleAddKeyword()}
                  placeholder="強調する単語を追加..." 
                  className="flex-1 bg-black/50 border border-white/10 rounded-lg px-2.5 py-1 text-[11px] outline-none focus:border-amber-400/70 text-white placeholder:text-white/25"
                />
                <button 
                  type="button" 
                  onClick={handleAddKeyword}
                  disabled={!newKeyword.trim()}
                  className="px-2.5 py-1 bg-white/10 hover:bg-amber-500 hover:text-black text-white text-[11px] font-bold rounded-lg border border-white/10 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                >
                  ＋追加
                </button>
              </div>
            </div>
          </div>

          {/* カメラワーク & ケンバーン */}
          <div className="grid grid-cols-2 gap-2">
            <FieldDropdown
              label="カメラワーク"
              value={currentCw.label}
              options={CAMERA_WORK_REGISTRY.map(c => c.label)}
              onChange={l => {
                const cw = CAMERA_WORK_REGISTRY.find(c => c.label === l);
                if (cw) onUpdateCut({ cameraWork: cw.id, cameraMotion: cw.motionPrompt, kenBurnsPreset: cw.recommendedKenBurns });
              }}
            />
            <FieldDropdown
              label="ケンバーン演出"
              value={currentKb.label}
              options={KEN_BURNS_PRESETS.map(p => p.label)}
              onChange={l => {
                const kb = KEN_BURNS_PRESETS.find(p => p.label === l);
                if (kb) {
                  const cw = CAMERA_WORK_REGISTRY.find(c => c.recommendedKenBurns === kb.value);
                  onUpdateCut({ kenBurnsPreset: kb.value as KenBurnsPreset, ...(cw ? { cameraWork: cw.id, cameraMotion: cw.motionPrompt } : {}) });
                }
              }}
            />
          </div>

          <FieldDropdown
            label="コマ割り構成 (Panel Layout)"
            value={
              cut.panelLayout === 'single' ? '🖼️ 1コマ大ゴマ (Single)' :
              cut.panelLayout === 'split-2' ? '◫ 2コマ分割 (2-Panel)' :
              cut.panelLayout === 'split-3' ? '☰ 3コマ連続 (3-Panel)' :
              '▦ 変形マルチコマ (Dynamic Multi)'
            }
            options={[
              '🖼️ 1コマ大ゴマ (Single)',
              '◫ 2コマ分割 (2-Panel)',
              '☰ 3コマ連続 (3-Panel)',
              '▦ 変形マルチコマ (Dynamic Multi)'
            ]}
            onChange={l => {
              const map: Record<string, string> = {
                '🖼️ 1コマ大ゴマ (Single)': 'single',
                '◫ 2コマ分割 (2-Panel)': 'split-2',
                '☰ 3コマ連続 (3-Panel)': 'split-3',
                '▦ 変形マルチコマ (Dynamic Multi)': 'dynamic-multi'
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
                  <span>⚡ 送信された完全プロンプト (Master Prompt)</span>
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
                {cut.finalPromptUsed || (cut.promptEn ? `(推定) Masterpiece, authentic ${cut.styleKeyUsed || ''}... ${cut.promptEn}` : '生成ログがありません')}
              </p>
            </div>

            {/* 送信されたネガティブプロンプト */}
            <div className="flex flex-col gap-1 bg-black/60 p-2.5 rounded-lg border border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-red-400 flex items-center gap-1">
                  <span>🚫 送信されたネガティブプロンプト</span>
                </span>
                {cut.finalNegativeUsed && (
                  <button 
                    type="button" 
                    onClick={() => navigator.clipboard.writeText(cut.finalNegativeUsed || '')}
                    className="text-[9px] text-red-300 hover:text-white bg-red-500/20 hover:bg-red-500/40 px-1.5 py-0.5 rounded border border-red-500/30 transition-colors cursor-pointer"
                  >
                    コピー
                  </button>
                )}
              </div>
              <p className="text-[10px] text-white/70 font-mono leading-relaxed max-h-20 overflow-y-auto dark-scrollbar select-text break-words">
                {cut.finalNegativeUsed || cut.negativePrompt || '（指定なし）'}
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

        {/* ── 🎬 Veo 3.1 2点間補間モーション＆After絵設計 ── */}
        <div className="pt-6 border-t border-white/5 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <SectionLabel>Veo 3.1 補間モーション＆After絵</SectionLabel>
            <span className="text-[9px] px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30 flex items-center gap-1">
              <span className="material-symbols-outlined text-[11px]">compare</span>
              1Cut 2画像補間
            </span>
          </div>

          <div className="bg-blue-950/20 p-3.5 rounded-xl border border-blue-500/30 flex flex-col gap-3">
            {/* 補間挙動（veoMotionPrompt）指示 */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-amber-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-amber-400">animation</span>
                  補間モーション命令 (Motion Directive)
                </span>
                <span className="text-[9px] text-white/40">Start ➜ End 間の推移動作</span>
              </div>
              <textarea
                value={cut.veoMotionPrompt || ''}
                onChange={e => onUpdateCut({ veoMotionPrompt: e.target.value })}
                placeholder="例: First looking downward, then slowly raising gaze and smiling, smoothly settles..."
                rows={2}
                className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 text-xs text-white/90 font-mono outline-none focus:border-amber-400 leading-relaxed resize-none"
              />
            </div>

            {/* 到達点プロンプト（endFramePromptEn） */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-blue-300 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">flag</span>
                  After絵プロンプト (End Frame Plot)
                </span>
                <span className="text-[9px] text-white/40">到達地点の描画指示</span>
              </div>
              <textarea
                value={cut.endFramePromptEn || ''}
                onChange={e => onUpdateCut({ endFramePromptEn: e.target.value })}
                placeholder="例: Close-up profile of the protagonist smiling gently, bathed in warm sunset..."
                rows={2}
                className="w-full bg-black/60 border border-white/10 rounded-lg p-2.5 text-xs text-white/90 font-mono outline-none focus:border-blue-400 leading-relaxed resize-none"
              />
            </div>

            {/* After絵のプレビュー＆生成ボタン */}
            <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/5">
              <div className="flex items-center gap-2 min-w-0">
                {cut.endFrameImageBase64 ? (
                  <div className="flex items-center gap-2">
                    <img 
                      src={`data:image/png;base64,${cut.endFrameImageBase64}`} 
                      alt="After frame" 
                      className="w-12 h-16 object-cover rounded-lg border border-blue-400/50 shadow-md shrink-0" 
                    />
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-bold text-blue-300 flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs text-green-400">check_circle</span>
                        After絵 生成済
                      </span>
                      <span className="text-[9px] text-white/40 truncate">Veo補間の終点として登録中</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <div className="w-12 h-16 rounded-lg border border-dashed border-white/20 bg-black/40 flex flex-col items-center justify-center text-white/20 shrink-0">
                      <span className="material-symbols-outlined text-base">hide_image</span>
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-[11px] font-bold text-white/60">After絵 未生成</span>
                      <span className="text-[9px] text-white/30">Start絵を参照して生成可能</span>
                    </div>
                  </div>
                )}
              </div>

              {onGenerateEndFrame && (
                <button
                  type="button"
                  onClick={() => onGenerateEndFrame(cut.endFramePromptEn)}
                  disabled={cut.isGeneratingEndFrame || !cut.imageBase64}
                  className="px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-blue-600/30 transition-all cursor-pointer disabled:opacity-50 shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">palette</span>
                  {cut.isGeneratingEndFrame ? '描画中...' : cut.endFrameImageBase64 ? 'After絵を再描画' : 'After絵を描画'}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* 動画生成 */}
        <div className="pt-6 border-t border-white/5 flex flex-col gap-4">
          <SectionLabel>動画生成</SectionLabel>
          <PillButton
            variant="filled"
            className="bg-amber-600 hover:bg-amber-500 text-white font-black h-[42px]"
            onClick={onBrowserAnimate}
            disabled={cut.isGeneratingVideo || !cut.imageBase64}
          >
            ⚡ ブラウザで即座に動画化 (0pt)
          </PillButton>
          <div className="grid grid-cols-2 gap-2">
            {VIDEO_MODELS_REGISTRY.slice(0, 2).map(m => {
              const isSelected = cut.targetVideoModel === m.id;
              const colorClass = m.id === 'omni-flash' ? 'bg-purple-600' : 'bg-blue-600';
              return (
                <PillButton 
                  key={m.id}
                  variant="filled" 
                  className={`${colorClass} text-white font-black h-[40px] text-[10px] ${isSelected ? 'ring-2 ring-amber-400' : ''}`} 
                  onClick={() => onAnimate(m.id)} 
                  disabled={cut.isGeneratingVideo || (!cut.imageMediaId && !cut.imageBase64)}
                >
                  🎬 {m.name} ({m.defaultDuration}s)
                </PillButton>
              );
            })}
          </div>
          {videoSrc && (
            <PillButton
              variant="outline"
              className="h-10 mt-2 border-amber-500/50 text-amber-500 font-black"
              onClick={handleDownloadVideo}
              disabled={downloadState !== 'idle'}
              icon={<span className="material-symbols-outlined text-[18px]">download</span>}
            >
              {downloadState === 'idle' ? '💾 保存 (MP4)' : '保存中...'}
            </PillButton>
          )}
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
