import React from 'react';
import { createPortal } from 'react-dom';
import { Episode, Cut, VideoModelType } from '../types';
import { PillButton } from './Primitives';
import { CutCard } from './CutCard';
import { getProductionModeConfig } from '../config/studioDefinitions';

function formatDataUri(b64?: string): string {
  if (!b64) return '';
  return b64.startsWith('data:') ? b64 : `data:image/png;base64,${b64}`;
}

/**
 * 時代考証・世界観インテリジェンスカード（作品の時代設定と禁止要素を表示）
 */
export const HistoricalCard: React.FC<{ ep: Episode }> = ({ ep }) => {
  const isMv = !!ep.isMvMode || (ep.titleJp || '').startsWith('🎵') || ep.productionMode === 'mv';
  const modeConfig = getProductionModeConfig(ep.productionMode, isMv);
  const mode = modeConfig.value;
  const cardTitle = modeConfig.cardTitle;
  const cardIcon = modeConfig.cardIcon;
  const themeLabel = modeConfig.themeLabel;

  const [previewImage, setPreviewImage] = React.useState<{ src: string; title: string } | null>(null);
  const [isExpanded, setIsExpanded] = React.useState(false);

  React.useEffect(() => {
    if (!previewImage) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPreviewImage(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewImage]);

  return (
    <div className={`border rounded-xl transition-all duration-300 ${
      isMv ? 'bg-purple-950/20 border-purple-500/30' : 'bg-white/5 border-slate-200'
    } ${isExpanded ? 'p-4 flex flex-col gap-4' : 'px-3.5 py-2'}`}>
      {previewImage && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative flex flex-col items-center bg-white border border-slate-200 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden shrink-0 max-w-[92vw] sm:max-w-[85vw] my-auto animate-in zoom-in-95 duration-150" 
            style={{ maxHeight: 'calc(100vh - 60px)' }}
            onClick={e => e.stopPropagation()}
          >
            {/* モーダルヘッダー（常に上部に固定表示・ブラウザ枠外へはみ出さない） */}
            <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2 min-w-0 pr-3">
                <span className="text-teal-400 text-sm material-symbols-outlined">zoom_in</span>
                <span className="text-xs font-bold text-slate-800 truncate">{previewImage.title}</span>
              </div>
              <button 
                type="button"
                onClick={() => setPreviewImage(null)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 flex items-center gap-1.5 text-slate-700 hover:text-slate-900 cursor-pointer text-xs font-bold transition-colors shrink-0"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
                <span>閉じる (Esc)</span>
              </button>
            </div>
            {/* 画像本体（9:16縦長でも16:9横長でも画面内に100%収まり、ヘッダーを押し出さない） */}
            <div className="flex-1 min-h-0 p-3 sm:p-4 flex items-center justify-center bg-slate-100 overflow-hidden w-full">
              <img 
                src={previewImage.src} 
                alt={previewImage.title} 
                className="w-auto h-auto max-w-full object-contain rounded-xl border border-slate-200 shadow-lg" 
                style={{ maxHeight: 'calc(100vh - 140px)' }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ヘッダー行（常に1行でコンパクトに表示） */}
      <div 
        className={`flex items-center justify-between gap-3 cursor-pointer select-none ${isExpanded ? 'border-b border-white/5 pb-3' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`material-symbols-outlined text-lg shrink-0 ${isMv ? 'text-purple-400' : 'text-amber-400'}`}>
            {cardIcon}
          </span>
          <h3 className="text-xs font-black tracking-wider uppercase text-slate-800 shrink-0">
            {cardTitle}
          </h3>
          
          {/* 共通設定バッジ（横1行に収まるようコンパクト表示） */}
          <div className="hidden sm:flex items-center gap-1.5 overflow-hidden">
            {isMv && (
              <span className="px-2 py-0.5 bg-purple-500/20 text-purple-300 text-[10px] font-bold rounded-full border border-purple-500/40 shrink-0">
                🎵 MV
              </span>
            )}
            {ep.taste && (
              <span className="px-2 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-bold rounded-full border border-blue-500/30 truncate max-w-[150px]">
                {ep.taste.split(' (')[0].trim()}
              </span>
            )}
            {ep.theme && (
              <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-full border border-amber-500/30 truncate max-w-[180px]">
                {ep.theme.split('（')[0].trim()}
              </span>
            )}
          </div>
        </div>

        {/* 右側: 三面図ミニアイコン & 詳細開閉ボタン */}
        <div className="flex items-center gap-2 shrink-0">
          {ep.characterTurnaroundBase64 && (
            <img 
              src={formatDataUri(ep.characterTurnaroundBase64)} 
              alt="三面図" 
              className="w-6 h-6 object-cover rounded-md border border-amber-500/50 cursor-pointer hover:scale-115 transition-transform" 
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage({
                  src: formatDataUri(ep.characterTurnaroundBase64),
                  title: '🎨 3面設計図シート (正面・側面・背面の360°基準)'
                });
              }}
              title="三面図シート（クリックで拡大）"
            />
          )}
          {ep.masterAnchorBase64 && (
            <img 
              src={formatDataUri(ep.masterAnchorBase64)} 
              alt="マスターアンカー" 
              className="w-6 h-6 object-cover rounded-md border border-blue-500/50 cursor-pointer hover:scale-115 transition-transform" 
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage({
                  src: formatDataUri(ep.masterAnchorBase64),
                  title: '⚓ マスターアンカー (Cut 1 確定キメ絵)'
                });
              }}
              title="マスターアンカー（クリックで拡大）"
            />
          )}
          {ep.coverBase64 && (
            <img 
              src={formatDataUri(ep.coverBase64)} 
              alt="インフォグラフィック扉絵" 
              className="w-4.5 h-6 object-cover rounded-sm border border-teal-400/60 cursor-pointer hover:scale-115 transition-transform shadow-sm" 
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage({
                  src: formatDataUri(ep.coverBase64),
                  title: '🖼️ 9:16 インフォグラフィック特大扉絵 (サムネイル・ポスター)'
                });
              }}
              title="インフォグラフィック扉絵（クリックで拡大）"
            />
          )}
          <button 
            type="button" 
            className="flex items-center gap-0.5 text-[10px] font-bold text-slate-500 hover:text-slate-900 px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-colors"
          >
            <span>{isExpanded ? '閉じる' : '詳細'}</span>
            <span className="material-symbols-outlined text-[14px]">
              {isExpanded ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>
      </div>

      {/* 展開時のみ表示される詳細セクション */}
      {isExpanded && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-900/30 uppercase tracking-tighter">
                {isMv ? 'MVビジュアルコンセプト・情景美（アンニュイ演出）'
                  : mode === 'trivia' ? '科学的メカニズム・歴史的ウラ側の検証'
                  : mode === 'quotes' ? '名言の思想的背景・時代文脈'
                  : mode === 'folklore' ? '伝承の真実・オカルト的考証'
                  : mode === 'craft' ? '職人の技術革新・歴史的背景'
                  : '作品世界観・時代分析'}
              </span>
              <p className="text-xs text-slate-700 leading-relaxed italic">{ep.eraAnalysis || "分析データ収集中..."}</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-900/30 uppercase tracking-tighter">
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
                  <span className="text-[10px] text-slate-900/20 italic">特になし</span>
                )}
              </div>
            </div>
          </div>

          {/* キャラクター基準モデルシート & マスターアンカー表示 */}
          {(ep.characterTurnaroundBase64 || ep.masterAnchorBase64 || ep.characterDna) && (
            <div className="flex flex-col gap-2 pt-3 border-t border-white/5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">badge</span>
                  キャラクター統一アンカー (Character Consistency Anchors)
                </span>
                <span className="text-[9px] text-slate-500">全カットの顔・骨格・衣装の完全一致を参照中</span>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto py-1">
                {ep.characterTurnaroundBase64 && (
                  <div className="flex items-center gap-2.5 bg-white border border-amber-500/40 rounded-xl p-1.5 shrink-0 shadow-md">
                    <img 
                      src={formatDataUri(ep.characterTurnaroundBase64)} 
                      alt="三面図 Turnaround Sheet" 
                      className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:scale-105 transition-transform border border-slate-200" 
                      onClick={() => {
                        setPreviewImage({
                          src: formatDataUri(ep.characterTurnaroundBase64),
                          title: '🎨 3面設計図シート (正面・側面・背面の360°基準)'
                        });
                      }}
                      title="クリックで拡大表示（正面・側面・背面の3面設計図）"
                    />
                    <div className="flex flex-col pr-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-amber-300">3面設計図シート</span>
                        <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-400 text-[8px] font-bold rounded">Turnaround</span>
                      </div>
                      <span className="text-[9px] text-slate-500 leading-tight mt-0.5">正面・側面・背面の360°基準</span>
                    </div>
                  </div>
                )}
                {ep.masterAnchorBase64 && (
                  <div className="flex items-center gap-2.5 bg-white border border-blue-500/40 rounded-xl p-1.5 shrink-0 shadow-md">
                    <img 
                      src={formatDataUri(ep.masterAnchorBase64)} 
                      alt="マスターアンカー Master Anchor" 
                      className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:scale-105 transition-transform border border-slate-200" 
                      onClick={() => {
                        setPreviewImage({
                          src: formatDataUri(ep.masterAnchorBase64),
                          title: '⚓ マスターアンカー (Cut 1 確定キメ絵)'
                        });
                      }}
                      title="クリックで拡大表示（Cut 1 確定キメ絵）"
                    />
                    <div className="flex flex-col pr-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-blue-300">マスターアンカー</span>
                        <span className="px-1.5 py-0.2 bg-blue-500/20 text-blue-400 text-[8px] font-bold rounded">Cut 1 Fix</span>
                      </div>
                      <span className="text-[9px] text-slate-500 leading-tight mt-0.5">全カット固定参照</span>
                    </div>
                  </div>
                )}
                {ep.coverBase64 && (
                  <div className="flex items-center gap-2.5 bg-white border border-teal-500/40 rounded-xl p-1.5 shrink-0 shadow-md">
                    <img 
                      src={formatDataUri(ep.coverBase64)} 
                      alt="インフォグラフィック扉絵" 
                      className="w-8 h-12 object-cover rounded-lg cursor-pointer hover:scale-105 transition-transform border border-slate-200" 
                      onClick={() => {
                        setPreviewImage({
                          src: formatDataUri(ep.coverBase64),
                          title: '🖼️ 9:16 インフォグラフィック特大扉絵 (サムネイル・ポスター)'
                        });
                      }}
                      title="クリックで拡大表示（9:16 インフォグラフィック扉絵）"
                    />
                    <div className="flex flex-col pr-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-teal-300">インフォグラフィック扉絵</span>
                        <span className="px-1.5 py-0.2 bg-teal-500/20 text-teal-400 text-[8px] font-bold rounded">9:16 Cover</span>
                      </div>
                      <span className="text-[9px] text-slate-500 leading-tight mt-0.5">世界観適応 高CTRポスター</span>
                    </div>
                  </div>
                )}
                {ep.characterDna && (
                  <div className="flex flex-col justify-center px-3 py-1 bg-white/5 border border-slate-200 rounded-xl min-w-0 max-w-md shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-amber-400">固定主人公DNA</span>
                      <span className="px-1.5 py-0.2 bg-white/10 text-slate-600 text-[8px] font-bold rounded">Protagonist</span>
                    </div>
                    <span className="text-[10px] text-slate-700 line-clamp-2 leading-tight mt-0.5" title={ep.characterDna}>
                      {ep.characterDna}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
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
  onGenerateCover?: (epId: number) => void;
  onRetry?: (type: 'image' | 'video', epId: number, cutId: number) => void;
}

export const EpisodeSection: React.FC<EpisodeSectionProps> = ({
  ep, onGenerateRemaining, onBulkVideo, onBulkBrowserVideo, onExportFullMovie, onDownloadZip, onAnimateRequest, onPreviewCut, onUpdateCut, onBulkRerollTelop, onGenerateCover, onRetry
}) => {
  // 先行プレビュー完了(isPreviewDone)または全体完了(isDone)していれば操作可能
  const isPending = !ep.isGenerating && !ep.isDone && !ep.isPreviewDone;

  return (
    <section className={`flex flex-col gap-5 animate-slide-in transition-opacity duration-700 ${isPending ? 'opacity-30' : 'opacity-100'}`}>
      <div className="flex flex-col border-b border-slate-200 pb-4 gap-3">
        {/* 最上段: 上にタイトル（全幅でゆったり表示）、下にアクションボタン群を整列 */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="font-black italic uppercase tracking-tight text-slate-900 leading-tight text-lg sm:text-xl md:text-2xl break-words">
                {ep.titleJp || '無題'}
              </h2>
              {ep.isDone && <span className="material-symbols-outlined text-green-500 font-bold text-lg" title="制作完了">check_circle</span>}
              {ep.isGenerating && <div className="w-4 h-4 border-2 border-amber-500/20 border-t-amber-500 rounded-full animate-spin shrink-0" />}
            </div>
            {ep.titleEn && (
              <span className="text-[11px] text-slate-500 uppercase tracking-widest font-mono">
                {ep.titleEn}
              </span>
            )}
          </div>
          
          {/* アクションボタン群（下段にゆったり横並び配置） */}
          <div className="flex items-center gap-2 flex-wrap">
            {onBulkRerollTelop && (
              <PillButton 
                variant="outline" 
                className="h-8 px-3 border-purple-500/40 text-purple-400 hover:text-purple-200 hover:border-purple-400 hover:bg-purple-950/30 font-black text-xs whitespace-nowrap shrink-0 transition-colors" 
                disabled={ep.isGenerating || isPending} 
                onClick={() => onBulkRerollTelop(ep.id)} 
                icon={<span className="material-symbols-outlined text-purple-400 text-sm">casino</span>}
                title="画像は一切再生成せず、12カットすべてのテロップ演出を一括再抽選"
              >
                テロップ一括
              </PillButton>
            )}
            {onGenerateCover && (
              <PillButton 
                variant="outline" 
                className={`h-8 px-3 border-teal-500/40 text-teal-300 hover:text-teal-100 hover:border-teal-400 hover:bg-teal-950/30 font-bold text-xs whitespace-nowrap shrink-0 transition-colors ${ep.coverBase64 ? 'bg-teal-950/20' : ''}`}
                disabled={ep.isGeneratingCover || ep.isGenerating || isPending} 
                onClick={() => onGenerateCover(ep.id)} 
                icon={ep.isGeneratingCover ? <div className="w-3.5 h-3.5 border-2 border-teal-400/20 border-t-teal-400 rounded-full animate-spin" /> : <span className="material-symbols-outlined text-teal-400 text-sm">auto_stories</span>}
                title="世界観・時代・ジャンルに完全適応した9:16インフォグラフィック扉絵（ポスター）を生成"
              >
                {ep.coverBase64 ? '扉絵再生成' : '扉絵生成 (インフォ)'}
              </PillButton>
            )}
            <PillButton 
              variant="outline" 
              className="h-8 px-3 border-amber-500/30 text-amber-400 hover:text-amber-200 font-bold text-xs whitespace-nowrap shrink-0" 
              disabled={ep.isBatchGeneratingVideos || ep.isGenerating || isPending} 
              onClick={() => onBulkBrowserVideo(ep.id)} 
              icon={<span className="material-symbols-outlined text-amber-500 text-sm">bolt</span>}
            >
              ブラウザ動画化
            </PillButton>
            <PillButton 
              variant="filled" 
              className="h-8 px-3.5 bg-indigo-600 hover:bg-indigo-500 text-slate-900 font-black text-xs border border-indigo-400/50 whitespace-nowrap shrink-0" 
              disabled={ep.isExportingMovie || ep.isGenerating || isPending} 
              onClick={() => onExportFullMovie(ep.id)} 
              icon={ep.isExportingMovie ? <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-sm">movie</span>}
            >
              動画結合 (MP4)
            </PillButton>
            <PillButton 
              variant="outline" 
              className="h-8 px-3 border-slate-200 hover:border-white/30 text-slate-500 hover:text-slate-900 font-bold text-xs whitespace-nowrap shrink-0" 
              disabled={ep.isGeneratingRemainingImages || ep.isGenerating || isPending} 
              onClick={() => onGenerateRemaining(ep.id)} 
              icon={ep.isGeneratingRemainingImages ? <div className="w-3.5 h-3.5 border-2 border-slate-200 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-sm">palette</span>}
            >
              残り描画
            </PillButton>
            <PillButton 
              variant="filled" 
              className="h-8 px-3.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs whitespace-nowrap shrink-0 shadow-md" 
              disabled={ep.isBatchGeneratingVideos || ep.isGenerating || isPending} 
              onClick={() => onBulkVideo(ep.id)} 
              icon={ep.isBatchGeneratingVideos ? <div className="w-3.5 h-3.5 border-2 border-black/10 border-t-black rounded-full animate-spin" /> : <span className="material-symbols-outlined text-sm">movie_filter</span>}
            >
              Veo一括
            </PillButton>
            <PillButton 
              variant="outline" 
              className="h-8 px-3 border-slate-200 hover:border-white/40 text-slate-600 hover:text-slate-900 font-bold text-xs whitespace-nowrap shrink-0 transition-all cursor-pointer" 
              disabled={isPending}
              onClick={() => onDownloadZip(ep)} 
              icon={<span className="material-symbols-outlined text-sm">download</span>}
              title="素材パッケージ（画像・動画・字幕・スクリプト）を一括ダウンロード"
            >
              パッケージ
            </PillButton>
          </div>
        </div>

        {/* スリム化された世界観バー（デフォルト1行・必要時だけ詳細展開） */}
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