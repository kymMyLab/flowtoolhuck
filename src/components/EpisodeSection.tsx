import React from 'react';
import { createPortal } from 'react-dom';
import { Episode, Cut } from '../types';
import { PillButton } from './StudioSidebar';
import { getProductionModeConfig } from '../constants';
import { cleanEpisodeTitle, cleanEpisodeTitleEn } from '../services/directorService';
import { formatDataUri } from '../services/utils';
interface CutCardProps {
  cut: Cut;
  episodeId: number;
  isMvMode?: boolean;
  onPreviewCut: (epId: number, cut: Cut) => void;
  onRetry?: (epId: number, cutId: number) => void;
}
export const CutCard: React.FC<CutCardProps> = React.memo(({ 
  cut, episodeId, isMvMode, onPreviewCut, onRetry 
}) => {
  const imageSrc = formatDataUri(cut.imageBase64 || (cut as any)?.image);
  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onRetry) onRetry(episodeId, cut.id);
  };
  const isStandby = !imageSrc && !cut.isGeneratingImage && !cut.isDirecting && !cut.error;
  return (
    <div 
      onClick={() => onPreviewCut(episodeId, cut)}
      className={`w-[155px] flex-shrink-0 bg-white border rounded-xl overflow-hidden flex flex-col group transition-all relative shadow-sm hover:shadow-md cursor-pointer select-none ${
        isStandby ? 'border-slate-300 hover:border-indigo-400 bg-slate-50/50' : 'border-slate-300 hover:border-slate-500'
      }`}
    >
      {/* プレビュー画像領域 */}
      <div className={`relative aspect-square flex items-center justify-center overflow-hidden border-b border-slate-200 ${
        isStandby ? 'bg-slate-100/90' : 'bg-slate-100'
      }`}>
        {imageSrc ? (
          <div className="w-full h-full overflow-hidden">
            <img 
              src={imageSrc} 
              alt={`Cut ${cut.id}`} 
              loading="eager"
              className="w-full h-full object-cover transition-opacity duration-300" 
              style={{ opacity: 1 }}
            />
          </div>
        ) : (cut.isGeneratingImage || cut.isDirecting) ? (
          <div className="flex flex-col items-center gap-1.5">
            <div className="w-5 h-5 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
            <span className="text-[9px] text-slate-700 font-bold tracking-wider uppercase animate-pulse">
              {cut.isDirecting ? 'Directing' : 'Drawing'}
            </span>
          </div>
        ) : cut.error ? (
          <div className="flex flex-col items-center gap-0.5 px-2 text-center max-w-full z-20">
            <span className="material-symbols-outlined text-rose-600 text-[18px]">error</span>
            <span className="text-[8px] text-rose-700 font-bold uppercase tracking-wider">Failed</span>
            <span className="text-[7px] text-rose-800 line-clamp-2 max-w-[92%] leading-tight break-all font-mono" title={cut.error}>
              {cut.error}
            </span>
            {onRetry && (
              <button 
                type="button"
                onClick={handleRetry} 
                className="mt-1 bg-rose-50 hover:bg-rose-100 border border-rose-300 text-rose-800 rounded px-2 py-0.5 text-[8px] font-bold transition-all cursor-pointer"
              >
                Retry
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1 text-slate-400 group-hover:text-indigo-500 transition-colors">
            <span className="material-symbols-outlined text-2xl text-slate-300 group-hover:text-indigo-400 transition-colors">hourglass_empty</span>
            <span className="text-[9px] font-black tracking-widest uppercase">STANDBY</span>
            <span className="text-[8px] text-slate-400 font-medium">クリックで演出確認</span>
          </div>
        )}
        {/* 下部タグ */}
        <div className="absolute bottom-1.5 left-1.5 flex flex-wrap items-center gap-1 z-10 max-w-[95%] overflow-hidden">
          {cut.shotScale && (
            <div className="px-1.5 py-0.5 rounded-sm bg-amber-400 text-[8px] font-black text-slate-900 uppercase tracking-tighter shadow-sm shrink-0">
              {cut.shotScale}
            </div>
          )}
          {cut.isObjectOnly && (
            <div className="px-1.5 py-0.5 rounded-sm bg-emerald-600 text-[8px] font-black text-white uppercase tracking-tighter shadow-sm shrink-0" title="人物なし・物体/情景カット">
              📦 OBJ
            </div>
          )}
        </div>
        {/* 左上カット番号 */}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 z-10">
          <div className={`px-1.5 py-0.5 rounded-sm text-[9px] font-black shadow-xs border flex items-center ${
            isStandby ? 'bg-white/90 text-slate-600 border-slate-300' : 'bg-white/95 text-slate-900 border-slate-200'
          }`}>
            C{cut.id.toString().padStart(2, '0')}
          </div>
        </div>
      </div>
      {/* フッターテキスト領域 */}
      <div className={`p-2 flex flex-col gap-1.5 border-t flex-1 justify-between ${
        isStandby ? 'bg-slate-50/80 border-slate-200' : 'bg-slate-50 border-slate-100'
      }`}>
        {isMvMode ? (
          <div className="flex items-center gap-1.5 h-[28px] overflow-hidden">
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 font-black border border-purple-300 shrink-0 uppercase tracking-tighter">
              LYRIC
            </span>
            <p className="text-[10px] text-slate-900 font-bold line-clamp-2 leading-snug tracking-tight">
              {cut.narrationJp || "歌詞策定中..."}
            </p>
          </div>
        ) : (
          <p className="text-[10px] text-slate-800 font-bold line-clamp-2 leading-snug h-[28px]">
            {cut.narrationJp || "脚本策定中..."}
          </p>
        )}
      </div>
    </div>
  );
});
export const HistoricalCard: React.FC<{ ep: Episode }> = ({ ep }) => {
  const isMv = !!ep.isMvMode || (ep.titleJp || '').startsWith('🎵') || ep.productionMode === 'mv';
  const modeConfig = getProductionModeConfig(ep.productionMode, isMv);
  const cardTitle = modeConfig.cardTitle;
  const cardIcon = modeConfig.cardIcon;
  const [previewImage, setPreviewImage] = React.useState<{ src: string; title: string; filename: string } | null>(null);
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
    <div className={`border rounded-xl transition-all duration-300 shadow-xs ${
      isMv ? 'bg-purple-50/70 border-purple-200' : 'bg-white border-slate-300'
    } ${isExpanded ? 'p-4 flex flex-col gap-4' : 'px-3.5 py-2.5'}`}>
      {previewImage && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed inset-0 z-[999999] bg-black/90 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 select-none animate-in fade-in duration-200"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative flex flex-col items-center bg-slate-900 border border-slate-700 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.95)] overflow-hidden shrink-0 max-w-[92vw] sm:max-w-[85vw] my-auto animate-in zoom-in-95 duration-150" 
            style={{ maxHeight: 'calc(100vh - 60px)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/90 border-b border-slate-700 shrink-0">
              <div className="flex items-center gap-2 min-w-0 pr-3">
                <span className="text-teal-400 text-sm material-symbols-outlined">zoom_in</span>
                <span className="text-xs font-bold text-slate-100 truncate">{previewImage.title}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewImage.src}
                  download={previewImage.filename}
                  className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white flex items-center gap-1.5 text-xs font-bold transition-colors cursor-pointer shadow-sm"
                  onClick={e => e.stopPropagation()}
                >
                  <span className="material-symbols-outlined text-[16px]">download</span>
                  <span>PNG保存</span>
                </a>
                <button 
                  type="button" 
                  onClick={() => setPreviewImage(null)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 flex items-center gap-1.5 text-slate-200 hover:text-white cursor-pointer text-xs font-bold transition-colors shrink-0"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                  <span>閉じる (Esc)</span>
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 p-3 sm:p-4 flex items-center justify-center bg-slate-950 overflow-hidden w-full">
              <img 
                src={previewImage.src} 
                alt={previewImage.title} 
                className="w-auto h-auto max-w-full object-contain rounded-xl border border-slate-800 shadow-lg" 
                style={{ maxHeight: 'calc(100vh - 140px)' }}
              />
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* ヘッダー行 */}
      <div 
        className={`flex items-center justify-between gap-3 cursor-pointer select-none ${isExpanded ? 'border-b border-slate-200 pb-3' : ''}`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={`material-symbols-outlined text-lg shrink-0 ${isMv ? 'text-purple-700' : 'text-amber-600'}`}>
            {cardIcon}
          </span>
          <h3 className="text-xs font-black tracking-wider uppercase text-slate-900 shrink-0">
            {cardTitle}
          </h3>
          
          <div className="hidden sm:flex items-center gap-1.5 overflow-hidden">
            {isMv && (
              <span className="px-2 py-0.5 bg-purple-100 text-purple-900 text-[10px] font-bold rounded-full border border-purple-300 shrink-0">
                🎵 MV
              </span>
            )}
            {ep.taste && (
              <span className="px-2 py-0.5 bg-blue-100 text-blue-900 text-[10px] font-bold rounded-full border border-blue-200 truncate max-w-[150px]">
                {ep.taste.split(' (')[0].trim()}
              </span>
            )}
            {ep.theme && (
              <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-full border border-amber-200 truncate max-w-[180px]">
                {ep.theme.split('（')[0].trim()}
              </span>
            )}
          </div>
        </div>
        {/* 右側: ミニアイコン群 & 詳細開閉ボタン */}
        <div className="flex items-center gap-2 shrink-0">
          {ep.characterTurnaroundBase64 && (
            <img 
              src={formatDataUri(ep.characterTurnaroundBase64)} 
              alt="三面図" 
              className="w-6 h-6 object-cover rounded-md border border-amber-400 cursor-pointer hover:scale-115 transition-transform shadow-xs" 
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage({
                  src: formatDataUri(ep.characterTurnaroundBase64),
                  title: '🎨 3面設計図シート (正面・側面・背面の360°基準)',
                  filename: `ep${ep.id}_turnaround.png`
                });
              }}
              title="三面図シート（クリックで拡大）"
            />
          )}
          {ep.masterAnchorBase64 && (
            <img 
              src={formatDataUri(ep.masterAnchorBase64)} 
              alt="マスターアンカー" 
              className="w-6 h-6 object-cover rounded-md border border-blue-400 cursor-pointer hover:scale-115 transition-transform shadow-xs" 
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage({
                  src: formatDataUri(ep.masterAnchorBase64),
                  title: '⚓ マスターアンカー (Cut 1 確定キメ絵)',
                  filename: `ep${ep.id}_master_anchor.png`
                });
              }}
              title="マスターアンカー（クリックで拡大）"
            />
          )}
          {/* 16:9 横型マスターカバー（横動画サムネイル看板） */}
          {ep.coverHorizontalBase64 && (
            <img 
              src={formatDataUri(ep.coverHorizontalBase64)} 
              alt="16:9 看板" 
              className="w-8 h-5 object-cover rounded-sm border border-indigo-500 cursor-pointer hover:scale-115 transition-transform shadow-xs" 
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage({
                  src: formatDataUri(ep.coverHorizontalBase64),
                  title: '📺 16:9 マスターカバー (横動画サムネイル看板)',
                  filename: `ep${ep.id}_cover_h_16x9.png`
                });
              }}
              title="16:9 横型看板（クリックで拡大）"
            />
          )}
          {/* 9:16 縦ロング扉絵 */}
          {ep.coverBase64 && (
            <img 
              src={formatDataUri(ep.coverBase64)} 
              alt="9:16 特大扉絵" 
              className="w-4.5 h-6 object-cover rounded-sm border border-teal-500 cursor-pointer hover:scale-115 transition-transform shadow-xs" 
              onClick={(e) => {
                e.stopPropagation();
                setPreviewImage({
                  src: formatDataUri(ep.coverBase64),
                  title: '🖼️ 9:16 インフォグラフィック特大扉絵 (サムネイル・ポスター)',
                  filename: `ep${ep.id}_cover_v_9x16.png`
                });
              }}
              title="9:16 縦ロング特大扉絵（クリックで拡大）"
            />
          )}
          <button 
            type="button" 
            className="flex items-center gap-0.5 text-[11px] font-bold text-slate-800 hover:text-slate-950 px-2.5 py-1 rounded bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors shadow-2xs cursor-pointer"
          >
            <span>{isExpanded ? '閉じる' : '詳細'}</span>
            <span className="material-symbols-outlined text-[14px]">
              {isExpanded ? 'expand_less' : 'expand_more'}
            </span>
          </button>
        </div>
      </div>
      {/* 展開時詳細 */}
      {isExpanded && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-white border border-slate-300 shadow-2xs">
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-wide">
                {isMv ? 'MVビジュアルコンセプト・情景美（アンニュイ演出）' : '作品世界観・時代分析'}
              </span>
              <p className="text-xs text-slate-800 leading-relaxed font-semibold">{ep.eraAnalysis || "分析データ収集中..."}</p>
            </div>
            <div className="flex flex-col gap-1.5 p-3 rounded-lg bg-white border border-slate-300 shadow-2xs">
              <span className="text-[10px] font-black text-slate-900 uppercase tracking-wide">
                {isMv ? 'ムード阻害・禁止要素 (Strictly Forbidden)' : '禁止要素 (Strictly Forbidden)'}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {ep.forbiddenAnachronisms && ep.forbiddenAnachronisms.length > 0 ? (
                  ep.forbiddenAnachronisms.map((item, i) => (
                    <span key={i} className="px-2 py-0.5 bg-rose-50 border border-rose-300 text-rose-900 text-[10px] rounded font-bold">
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="text-[10px] text-slate-600 font-semibold italic">特になし</span>
                )}
              </div>
            </div>
          </div>
          {/* キャラクター統一アンカー表示 */}
          {(ep.characterTurnaroundBase64 || ep.masterAnchorBase64 || ep.coverBase64 || ep.coverHorizontalBase64 || ep.characterDna) && (
            <div className="flex flex-col gap-2 pt-3 border-t border-slate-300">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-black text-slate-900 uppercase tracking-wide flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[15px] text-amber-600">badge</span>
                  キャラクター統一アンカー (Character Consistency Anchors)
                </span>
                <span className="text-[10px] text-slate-700 font-bold">全カットの顔・骨格・衣装の完全一致を参照中</span>
              </div>
              <div className="flex items-center gap-3 overflow-x-auto py-1">
                {ep.characterTurnaroundBase64 && (
                  <div className="flex items-center gap-2.5 bg-white border border-amber-300 rounded-xl p-2 shrink-0 shadow-xs">
                    <img 
                      src={formatDataUri(ep.characterTurnaroundBase64)} 
                      alt="三面図 Turnaround Sheet" 
                      className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:scale-105 transition-transform border border-slate-200" 
                      onClick={() => {
                        setPreviewImage({
                          src: formatDataUri(ep.characterTurnaroundBase64),
                          title: '🎨 3面設計図シート (正面・側面・背面の360°基準)',
                          filename: `ep${ep.id}_turnaround.png`
                        });
                      }}
                      title="クリックで拡大表示"
                    />
                    <div className="flex flex-col pr-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-slate-900">3面設計図シート</span>
                        <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 text-[8px] font-bold rounded">Turnaround</span>
                      </div>
                      <span className="text-[10px] text-slate-700 font-semibold leading-tight mt-0.5">正面・側面・背面の360°基準</span>
                    </div>
                  </div>
                )}
                {ep.masterAnchorBase64 && (
                  <div className="flex items-center gap-2.5 bg-white border border-blue-300 rounded-xl p-2 shrink-0 shadow-xs">
                    <img 
                      src={formatDataUri(ep.masterAnchorBase64)} 
                      alt="マスターアンカー" 
                      className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:scale-105 transition-transform border border-slate-200" 
                      onClick={() => {
                        setPreviewImage({
                          src: formatDataUri(ep.masterAnchorBase64),
                          title: '⚓ マスターアンカー (Cut 1 確定キメ絵)',
                          filename: `ep${ep.id}_master_anchor.png`
                        });
                      }}
                      title="クリックで拡大表示"
                    />
                    <div className="flex flex-col pr-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-slate-900">マスターアンカー</span>
                        <span className="px-1.5 py-0.2 bg-blue-100 text-blue-900 text-[8px] font-bold rounded">Cut 1 Fix</span>
                      </div>
                      <span className="text-[10px] text-slate-700 font-semibold leading-tight mt-0.5">全カット固定参照</span>
                    </div>
                  </div>
                )}
                {/* 16:9 横型マスターカバー看板 */}
                {ep.coverHorizontalBase64 && (
                  <div className="flex items-center gap-2.5 bg-white border border-indigo-300 rounded-xl p-2 shrink-0 shadow-xs">
                    <img 
                      src={formatDataUri(ep.coverHorizontalBase64)} 
                      alt="16:9 マスターカバー" 
                      className="w-12 h-8 object-cover rounded-lg cursor-pointer hover:scale-105 transition-transform border border-slate-200" 
                      onClick={() => {
                        setPreviewImage({
                          src: formatDataUri(ep.coverHorizontalBase64),
                          title: '📺 16:9 マスターカバー (横動画サムネイル看板)',
                          filename: `ep${ep.id}_cover_h_16x9.png`
                        });
                      }}
                      title="クリックで拡大表示"
                    />
                    <div className="flex flex-col pr-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-slate-900">16:9 看板カバー</span>
                        <span className="px-1.5 py-0.2 bg-indigo-100 text-indigo-900 text-[8px] font-bold rounded">16:9 Cover</span>
                      </div>
                      <span className="text-[10px] text-slate-700 font-semibold leading-tight mt-0.5">横動画・YouTube用サムネイル</span>
                    </div>
                  </div>
                )}
                {/* 9:16 縦ロング扉絵 */}
                {ep.coverBase64 && (
                  <div className="flex items-center gap-2.5 bg-white border border-teal-300 rounded-xl p-2 shrink-0 shadow-xs">
                    <img 
                      src={formatDataUri(ep.coverBase64)} 
                      alt="インフォグラフィック特大扉絵" 
                      className="w-8 h-12 object-cover rounded-lg cursor-pointer hover:scale-105 transition-transform border border-slate-200" 
                      onClick={() => {
                        setPreviewImage({
                          src: formatDataUri(ep.coverBase64),
                          title: '🖼️ 9:16 インフォグラフィック特大扉絵',
                          filename: `ep${ep.id}_cover_v_9x16.png`
                        });
                      }}
                      title="クリックで拡大表示"
                    />
                    <div className="flex flex-col pr-2">
                      <div className="flex items-center gap-1">
                        <span className="text-[11px] font-bold text-slate-900">インフォグラフィック扉絵</span>
                        <span className="px-1.5 py-0.2 bg-teal-100 text-teal-900 text-[8px] font-bold rounded">9:16 Cover</span>
                      </div>
                      <span className="text-[10px] text-slate-700 font-semibold leading-tight mt-0.5">世界観適応 縦ロング特大看板</span>
                    </div>
                  </div>
                )}
                {ep.characterDna && (
                  <div className="flex flex-col justify-center px-3 py-1.5 bg-white border border-slate-300 rounded-xl min-w-0 max-w-md shrink-0 shadow-2xs">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-amber-800">固定主人公DNA</span>
                      <span className="px-1.5 py-0.2 bg-slate-200 text-slate-900 text-[8px] font-bold rounded">Protagonist</span>
                    </div>
                    <span className="text-[10px] text-slate-800 line-clamp-2 leading-tight mt-0.5 font-semibold" title={ep.characterDna}>
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
  onDownloadZip: (ep: Episode) => void;
  onPreviewCut: (epId: number, cut: Cut) => void;
  onGenerateCover?: (epId: number) => void;
  onRerollTaste?: (epId: number) => void;
  onRetry?: (epId: number, cutId: number) => void;
}
export const EpisodeSection: React.FC<EpisodeSectionProps> = ({
  ep, onGenerateRemaining, onDownloadZip, onPreviewCut, onGenerateCover, onRerollTaste, onRetry
}) => {
  const isPending = !ep.isGenerating && !ep.isDone && !ep.isPreviewDone;
  const standbyCount = ep.cuts.filter(c => !c.imageBase64 && !c.imageMediaId).length;
  return (
    <section className={`w-full flex flex-col gap-4 animate-slide-in transition-opacity duration-700 p-4 sm:p-5 rounded-2xl bg-white border border-slate-300 shadow-sm ${isPending ? 'opacity-40' : 'opacity-100'}`}>
      <div className="flex flex-col border-b border-slate-200 pb-4 gap-3">
        <div className="flex flex-col gap-3">
          {/* エピソードタイトル・サブタイトル */}
          <div className="flex flex-col gap-1 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white text-xs font-black tracking-wider shrink-0 shadow-xs">
                第{ep.id}話
              </span>
              <h2 className="font-bold italic uppercase tracking-tight text-slate-900 leading-tight text-lg sm:text-xl md:text-2xl break-words">
                {cleanEpisodeTitle(ep.titleJp) || '無題'}
              </h2>
              {ep.isDone && <span className="material-symbols-outlined text-emerald-600 font-bold text-xl" title="制作完了">check_circle</span>}
              {ep.isGenerating && <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin shrink-0" />}
              {standbyCount > 0 && !ep.isGenerating && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-300 text-[10px] font-bold text-slate-600">
                  {standbyCount} Cut STANDBY待機中
                </span>
              )}
            </div>
            {ep.titleEn && (
              <span className="text-xs text-slate-700 uppercase tracking-widest font-mono font-bold">
                {cleanEpisodeTitleEn(ep.titleEn)}
              </span>
            )}
          </div>
          
          {/* 操作ボタン群 */}
          <div className="flex items-center gap-2 flex-wrap">
            {onGenerateCover && (
              <PillButton 
                variant="outline" 
                className={`h-8 px-3 border-teal-400 text-teal-900 hover:text-teal-950 hover:border-teal-500 hover:bg-teal-50 font-bold text-xs whitespace-nowrap shrink-0 transition-colors shadow-2xs ${ep.coverBase64 || ep.coverHorizontalBase64 ? 'bg-teal-50/80' : 'bg-white'}`}
                disabled={ep.isGeneratingCover || ep.isGenerating || isPending} 
                onClick={() => onGenerateCover(ep.id)} 
                icon={ep.isGeneratingCover ? <div className="w-3.5 h-3.5 border-2 border-teal-700 border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined text-teal-800 text-sm">auto_stories</span>}
                title="世界観・時代・ジャンルに完全適応した9:16縦扉絵および16:9横型マスターカバー（看板）をAI生成"
              >
                {ep.coverBase64 || ep.coverHorizontalBase64 ? '看板・扉絵再生成' : '看板・扉絵生成'}
              </PillButton>
            )}
            {onRerollTaste && (
              <PillButton 
                variant="outline" 
                className="h-8 px-3 border-emerald-400 text-emerald-900 hover:text-emerald-950 hover:border-emerald-500 hover:bg-emerald-50 font-black text-xs whitespace-nowrap shrink-0 transition-colors shadow-2xs bg-white" 
                disabled={ep.isGenerating || isPending} 
                onClick={() => onRerollTaste(ep.id)} 
                icon={<span className="material-symbols-outlined text-emerald-800 text-sm">palette</span>}
                title="ヘッダーで選択中の画風を適用し、3面図・先行カット・看板・扉絵を最初から再作成"
              >
                画風を変えて全再生成
              </PillButton>
            )}
            
            <PillButton 
              variant="outline" 
              className={`h-8 px-3 border-slate-300 hover:border-slate-400 font-bold text-xs whitespace-nowrap shrink-0 shadow-2xs transition-colors ${
                standbyCount > 0 ? 'bg-indigo-50 border-indigo-300 text-indigo-900 hover:bg-indigo-100' : 'bg-white text-slate-800 hover:text-slate-950'
              }`}
              disabled={ep.isGeneratingRemainingImages || ep.isGenerating || isPending || standbyCount === 0} 
              onClick={() => onGenerateRemaining(ep.id)} 
              icon={ep.isGeneratingRemainingImages ? <div className="w-3.5 h-3.5 border-2 border-slate-500 border-t-slate-900 rounded-full animate-spin" /> : <span className="material-symbols-outlined text-indigo-700 text-sm">palette</span>}
              title={standbyCount > 0 ? `STANDBY待機中の残り ${standbyCount} カットを一括描画します` : 'すべてのカットが描画済みです'}
            >
              {standbyCount > 0 ? `残り描画 (${standbyCount}枚)` : '全カット描画済'}
            </PillButton>
            
            <PillButton 
              variant="outline" 
              className="h-8 px-3 border-slate-300 hover:border-slate-400 text-slate-800 hover:text-slate-950 font-bold text-xs whitespace-nowrap shrink-0 transition-all cursor-pointer bg-white shadow-2xs" 
              disabled={isPending}
              onClick={() => onDownloadZip(ep)} 
              icon={<span className="material-symbols-outlined text-slate-700 text-sm">download</span>}
              title="素材パッケージ（画像・16:9看板・9:16扉絵・字幕・スクリプト）を一括ダウンロード"
            >
              パッケージ
            </PillButton>
          </div>
        </div>
        <HistoricalCard ep={ep} />
      </div>
      {/* 各カットカード一覧 */}
      <div className="flex gap-4 pb-2 overflow-x-auto max-w-full select-none dark-scrollbar">
        {ep.cuts.map(cut => (
          <CutCard 
            key={cut.id} 
            cut={cut} 
            episodeId={ep.id} 
            isMvMode={ep.isMvMode}
            onPreviewCut={onPreviewCut}
            onRetry={onRetry}
          />
        ))}
      </div>
    </section>
  );
};

