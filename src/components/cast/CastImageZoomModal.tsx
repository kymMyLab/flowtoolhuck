import React from 'react';

interface CastImageZoomModalProps {
  zoomImage: { base64: string; title: string; prompt?: string } | null;
  onClose: () => void;
  onApplyToVault?: (base64: string, title: string) => void;
}

export const CastImageZoomModal: React.FC<CastImageZoomModalProps> = ({
  zoomImage,
  onClose,
  onApplyToVault
}) => {
  if (!zoomImage) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl overflow-hidden shadow-2xl max-w-4xl w-full flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-indigo-400 text-lg">zoom_in</span>
            <span className="text-sm font-bold text-white">{zoomImage.title}</span>
          </div>
          <div className="flex items-center gap-2">
            {onApplyToVault && (
              <button
                onClick={() => onApplyToVault(zoomImage.base64, zoomImage.title)}
                className="px-3 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shadow-sm"
                title="この高解像度画像を保管庫マスターアセットとして採用"
              >
                <span className="material-symbols-outlined text-xs">verified</span>
                保管庫に採用
              </button>
            )}

            <button
              onClick={() => {
                const link = document.createElement('a');
                link.href = `data:image/png;base64,${zoomImage.base64}`;
                link.download = `${zoomImage.title.replace(/[^a-zA-Z0-9_-]/g, '_')}.png`;
                link.click();
              }}
              className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
              title="画像をダウンロード保存"
            >
              <span className="material-symbols-outlined text-xs">download</span>
              保存
            </button>

            {/* 閉じるボタン */}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        {/* High-Resolution Image Display Area */}
        <div className="p-4 flex items-center justify-center overflow-auto max-h-[75vh]">
          <img 
            src={`data:image/png;base64,${zoomImage.base64}`} 
            alt={zoomImage.title} 
            className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-lg border border-slate-800"
          />
        </div>

        {/* Bottom Prompt Info */}
        {zoomImage.prompt && (
          <div className="w-full px-5 py-2.5 bg-slate-950/90 border-t border-slate-800/80 text-[11px] font-mono text-slate-400 flex items-center gap-2 overflow-x-auto shrink-0">
            <span className="material-symbols-outlined text-xs text-indigo-400 shrink-0">code</span>
            <span className="truncate" title={zoomImage.prompt}>{zoomImage.prompt}</span>
          </div>
        )}
      </div>
    </div>
  );
};
