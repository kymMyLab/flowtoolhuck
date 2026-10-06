import React from 'react';
import { Episode, Cut, VideoModelType } from '../types';
import { PillButton } from './Primitives';
import { CutCard } from './CutCard';
import { getProductionModeConfig } from '../config/studioDefinitions';

/**
 * 時代考証・世界観インテリジェンスカード（作品の時代設定と禁止要素を表示）
 */
export const HistoricalCard: React.FC<{ ep: Episode }> = ({ ep }) => {
  const isMv = !!ep.isMvMode || ep.titleJp.startsWith('🎵') || ep.productionMode === 'mv';
  const modeConfig = getProductionModeConfig(ep.productionMode, isMv);
  const mode = modeConfig.value;
  const cardTitle = modeConfig.cardTitle;
  const cardIcon = modeConfig.cardIcon;
  const themeLabel = modeConfig.themeLabel;

  return (
    <div className={`border rounded-2xl p-5 flex flex-col gap-4 animate-in fade-in slide-in-from-top-2 duration-500 ${
      isMv ? 'bg-purple-950/20 border-purple-500/30' : 'bg-white/5 border-white/10'
    }`}>
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <span className={`material-symbols-outlined text-xl ${isMv ? 'text-purple-400' : 'text-amber-400'}`}>
            {cardIcon}
          </span>
          <h3 className="text-sm font-black tracking-widest uppercase text-white/90">
            {cardTitle}
          </h3>
        </div>
        
        {/* 共通設定バッジ */}
        <div className="flex flex-wrap items-center gap-2">
          {isMv && (
            <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-bold rounded-full border border-purple-500/40">
              🎵 音楽MVモード
            </span>
          )}
          {mode === 'trivia' && (
            <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-bold rounded-full border border-amber-500/40">
              💡 雑学Shorts
            </span>
          )}
          {mode === 'quotes' && (
            <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded-full border border-blue-500/40">
              📜 偉人の名言
            </span>
          )}
          {mode === 'folklore' && (
            <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 text-[10px] font-bold rounded-full border border-emerald-500/40">
              👁️ 怪異・都市伝説
            </span>
          )}
          {mode === 'craft' && (
            <span className="px-2.5 py-0.5 bg-orange-500/20 text-orange-300 text-[10px] font-bold rounded-full border border-orange-500/40">
              🔨 職人魂
            </span>
          )}
          {ep.taste && (
            <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded-full border border-blue-500/30">
              画風: {ep.taste.split(' (')[0].trim()}
            </span>
          )}
          {/* 年代バッジ: テーマと重複せず、かつ歴史ドラマモード等の実質的な時代情報がある場合のみ表示 */}
          {ep.era && ep.era !== ep.theme && !isMv && mode === 'episodes' && (
            <span className="px-2.5 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-bold rounded-full border border-purple-500/30">
              年代: {ep.era.split('（')[0].trim()}
            </span>
          )}
          {ep.theme && (
            <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-full border border-amber-500/30">
              {themeLabel}: {ep.theme.split('（')[0].trim()}
            </span>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">
            {isMv ? 'MVビジュアルコンセプト・情景美（アンニュイ演出）'
              : mode === 'trivia' ? '科学的メカニズム・歴史的ウラ側の検証'
              : mode === 'quotes' ? '名言の思想的背景・時代文脈'
              : mode === 'folklore' ? '伝承の真実・オカルト的考証'
              : mode === 'craft' ? '職人の技術革新・歴史的背景'
              : '作品世界観・時代分析'}
          </span>
          <p className="text-xs text-white/80 leading-relaxed italic">{ep.eraAnalysis || "分析データ収集中..."}</p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-[10px] font-bold text-white/30 uppercase tracking-tighter">
            {isMv ? 'ムード阻害・禁止要素 (Strictly Forbidden)' : '禁止要素 (Strictly Forbidden)'}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {ep.forbiddenAnachronisms && ep.forbiddenAnachronisms.length > 0 ? (
              ep.forbiddenAnachronisms.map((item, i) => (
                <span key={i} className="px-2 py-0.5 bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] rounded-sm font-medium">
                  {item}
                </span>
              ))
            ) : (
              <span className="text-[10px] text-white/20 italic">特になし</span>
            )}
          </div>
        </div>
      </div>

      {/* キャラクター基準モデルシート & マスターアンカー表示 */}
      {(ep.characterTurnaroundBase64 || ep.masterAnchorBase64 || ep.characterDna) && (
        <div className="flex flex-col gap-2 pt-3 border-t border-white/5 animate-in fade-in duration-300">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[14px]">badge</span>
              キャラクター統一アンカー (Character Consistency Anchors)
            </span>
            <span className="text-[9px] text-white/40">全カットの顔・骨格・衣装の完全一致を参照中</span>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto py-1">
            {ep.characterTurnaroundBase64 && (
              <div className="flex items-center gap-2.5 bg-black/40 border border-amber-500/40 rounded-xl p-1.5 shrink-0 shadow-md">
                <img 
                  src={ep.characterTurnaroundBase64} 
                  alt="三面図 Turnaround Sheet" 
                  className="w-14 h-14 object-cover rounded-lg cursor-pointer hover:scale-105 transition-transform border border-white/10" 
                  onClick={() => {
                    const w = window.open('');
                    w?.document.write(`<title>三面図シート</title><body style="margin:0;background:#111;display:flex;justify-content:center;align-items:center;min-height:100vh;"><img src="${ep.characterTurnaroundBase64}" style="max-width:95vw;max-height:95vh;object-fit:contain;border-radius:8px;" /></body>`);
                  }}
                  title="クリックで拡大表示（正面・側面・背面の3面設計図）"
                />
                <div className="flex flex-col pr-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-amber-300">3面設計図シート</span>
                    <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 text-[8px] font-bold rounded">Turnaround</span>
                  </div>
                  <span className="text-[9px] text-white/50 leading-tight mt-0.5">正面・側面・背面の360°基準</span>
                </div>
              </div>
            )}
            {ep.masterAnchorBase64 && (
              <div className="flex items-center gap-2.5 bg-black/40 border border-blue-500/40 rounded-xl p-1.5 shrink-0 shadow-md">
                <img 
                  src={ep.masterAnchorBase64} 
                  alt="マスターアンカー Master Anchor" 
                  className="w-14 h-14 object-cover rounded-lg cursor-pointer hover:scale-105 transition-transform border border-white/10" 
                  onClick={() => {
                    const w = window.open('');
                    w?.document.write(`<title>マスターアンカー</title><body style="margin:0;background:#111;display:flex;justify-content:center;align-items:center;min-height:100vh;"><img src="${ep.masterAnchorBase64}" style="max-width:95vw;max-height:95vh;object-fit:contain;border-radius:8px;" /></body>`);
                  }}
                  title="クリックで拡大表示（Cut 1 確定キメ絵）"
                />
                <div className="flex flex-col pr-2">
                  <div className="flex items-center gap-1">
                    <span className="text-[11px] font-bold text-blue-300">マスターアンカー</span>
                    <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-400 text-[8px] font-bold rounded">Cut 1 Fix</span>
                  </div>
                  <span className="text-[9px] text-white/50 leading-tight mt-0.5">全カット固定参照（世代ドリフト防止）</span>
                </div>
              </div>
            )}
            {ep.characterDna && (
              <div className="flex flex-col justify-center px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl min-w-0 max-w-md shrink-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold text-amber-400">固定主人公DNA</span>
                  <span className="px-1.5 py-0.2 bg-white/10 text-white/60 text-[8px] font-bold rounded">Protagonist</span>
                </div>
                <span className="text-[10px] text-white/80 line-clamp-2 leading-tight mt-0.5" title={ep.characterDna}>
                  {ep.characterDna}
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

interface EpisodeSectionProps {
  ep: Episode;
  onGenerateRemaining: (epId: number) => void;
  onBulkVideo: (epId: number) => void;
  onBulkBrowserVideo: (epId: number) => void;
  onExportFullMovie: (epId: number) => void;
  onDownloadZip: (ep: Episode) => void;
  onAnimateRequest: (epId: number, cutId: number, modelType: VideoModelType) => void;
  onPreviewCut: (epId: number, cut: Cut) => void;
  onUpdateCut: (epId: number, cutId: number, updates: Partial<Cut>) => void;
  onBulkRerollTelop?: (epId: number) => void;
  onRetry?: (type: 'image' | 'video', epId: number, cutId: number) => void;
}

export const EpisodeSection: React.FC<EpisodeSectionProps> = ({
  ep, onGenerateRemaining, onBulkVideo, onBulkBrowserVideo, onExportFullMovie, onDownloadZip, onAnimateRequest, onPreviewCut, onUpdateCut, onBulkRerollTelop, onRetry
}) => {
  // 先行プレビュー完了(isPreviewDone)または全体完了(isDone)していれば操作可能
  const isPending = !ep.isGenerating && !ep.isDone && !ep.isPreviewDone;

  return (
    <section className={`flex flex-col gap-8 animate-slide-in transition-opacity duration-700 ${isPending ? 'opacity-30' : 'opacity-100'}`}>
      <div className="flex flex-col border-b border-white/10 pb-6 gap-4">
        {/* 上段: 横幅いっぱいのタイトル & 英語サブタイトル */}
        <div className="flex flex-col gap-1 w-full">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className={`font-black italic uppercase tracking-tight text-white leading-tight ${
              ep.titleJp.length > 30 ? 'text-lg sm:text-xl md:text-2xl' : (ep.titleJp.length > 20 ? 'text-xl sm:text-2xl md:text-3xl' : 'text-2xl sm:text-3xl md:text-4xl')
            }`}>
              {ep.titleJp}
            </h2>
            {ep.isDone && <span className="material-symbols-outlined text-green-500 font-bold text-xl">check_circle</span>}
            {ep.isGenerating && <div className="w-5 h-5 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin shrink-0" />}
          </div>
          {ep.titleEn && (
            <span className="text-xs sm:text-sm text-white/40 uppercase tracking-widest font-mono">
              {ep.titleEn}
            </span>
          )}
        </div>
        
        {/* 下段: アクションボタン群を横並びにはべらす */}
        <div className="flex items-center gap-2.5 flex-wrap pt-0.5">
          {onBulkRerollTelop && (
            <PillButton 
              variant="outline" 
              className="h-9 px-3.5 border-purple-500/40 text-purple-400 hover:text-purple-200 hover:border-purple-400 hover:bg-purple-950/30 font-black text-xs whitespace-nowrap shrink-0 transition-colors" 
              disabled={ep.isGenerating || isPending} 
              onClick={() => onBulkRerollTelop(ep.id)} 
              icon={<span className="material-symbols-outlined text-purple-400 text-sm">casino</span>}
              title="画像は一切再生成せず、12カットすべてのテロップ演出を一括再抽選"
            >
              🎲 テロップ一括リロール
            </PillButton>
          )}
          <PillButton 
            variant="outline" 
            className="h-9 px-3.5 border-amber-500/30 text-amber-400 hover:text-amber-200 font-bold text-xs whitespace-nowrap shrink-0" 
            disabled={ep.isBatchGeneratingVideos || ep.isGenerating || isPending} 
            onClick={() => onBulkBrowserVideo(ep.id)} 
            icon={<span className="material-symbols-outlined text-amber-500 text-sm">bolt</span>}
          >
            ⚡ ブラウザ動画化
          </PillButton>
          <PillButton 
            variant="filled" 
            className="h-9 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs border border-indigo-400/50 whitespace-nowrap shrink-0" 
            disabled={ep.isExportingMovie || ep.isGenerating || isPending} 
            onClick={() => onExportFullMovie(ep.id)} 
            icon={ep.isExportingMovie ? <div className="w-3.5 h-3.5 border-2 border-white/10 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-sm">movie</span>}
          >
            🎬 動画結合 (MP4)
          </PillButton>
          <PillButton 
            variant="outline" 
            className="h-9 px-3.5 border-white/10 hover:border-white/30 text-white/50 hover:text-white font-bold text-xs whitespace-nowrap shrink-0" 
            disabled={ep.isGeneratingRemainingImages || ep.isGenerating || isPending} 
            onClick={() => onGenerateRemaining(ep.id)} 
            icon={ep.isGeneratingRemainingImages ? <div className="w-3.5 h-3.5 border-2 border-white/10 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-sm">palette</span>}
          >
            🎨 残り描画
          </PillButton>
          <PillButton 
            variant="filled" 
            className="h-9 px-4 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs whitespace-nowrap shrink-0" 
            disabled={ep.isBatchGeneratingVideos || ep.isGenerating || isPending} 
            onClick={() => onBulkVideo(ep.id)} 
            icon={ep.isBatchGeneratingVideos ? <div className="w-3.5 h-3.5 border-2 border-black/10 border-t-black rounded-full animate-spin" /> : <span className="material-symbols-outlined text-sm">movie_filter</span>}
          >
            🎬 Veo一括
          </PillButton>
          <PillButton 
            variant="outline" 
            className="h-9 px-4 border-white/20 hover:border-white/40 text-white/70 hover:text-white font-bold text-xs whitespace-nowrap shrink-0 transition-all cursor-pointer" 
            disabled={isPending}
            onClick={() => onDownloadZip(ep)} 
            icon={<span className="material-symbols-outlined text-sm">download</span>}
            title="素材パッケージ（画像・動画・字幕・スクリプト）を一括ダウンロード"
          >
            パッケージ
          </PillButton>
        </div>

        <HistoricalCard ep={ep} />
      </div>

      <div className={`no-wrap-row gap-4 pb-6 dark-scrollbar ${isPending ? 'grayscale pointer-events-none' : ''}`}>
        {ep.cuts.map(cut => (
          <CutCard 
            key={cut.id} cut={cut} episodeId={ep.id} isMvMode={ep.isMvMode}
            onAnimateRequest={onAnimateRequest}
            onPreviewCut={() => onPreviewCut(ep.id, cut)}
            onUpdateSelection={(eId, cId, sel) => onUpdateCut(eId, cId, { isSelectedForVideo: sel })}
            onUpdateModel={(eId, cId, mod) => onUpdateCut(eId, cId, { targetVideoModel: mod })}
            onRetry={onRetry}
          />
        ))}
      </div>
    </section>
  );
};