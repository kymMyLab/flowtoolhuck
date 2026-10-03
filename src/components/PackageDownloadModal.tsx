import React, { useState } from 'react';

export interface PackageDownloadData {
  epId: number;
  titleJp: string;
  filename: string;
  blobUrl: string;
  sizeStr: string;
  videoCount: number;
  imageCount: number;
  flowSuccess?: boolean;
}

interface PackageDownloadModalProps {
  isOpen: boolean;
  data: PackageDownloadData | null;
  onClose: () => void;
}

export const PackageDownloadModal: React.FC<PackageDownloadModalProps> = ({
  isOpen,
  data,
  onClose
}) => {
  const [downloaded, setDownloaded] = useState(false);

  if (!isOpen || !data) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-300">
      <div 
        className="w-full max-w-lg bg-zinc-950 border border-emerald-500/40 rounded-3xl p-7 shadow-2xl shadow-emerald-950/50 flex flex-col gap-6 relative overflow-hidden animate-in zoom-in-95 duration-300"
        onClick={e => e.stopPropagation()}
      >
        {/* 背景の柔らかいグローエフェクト */}
        <div className="absolute -top-24 -right-24 w-56 h-56 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-56 h-56 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        {/* ヘッダー */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <span className="material-symbols-outlined text-2xl">package_2</span>
            </div>
            <div>
              <span className="text-[10px] font-black tracking-widest uppercase text-emerald-400">
                Package Export Ready
              </span>
              <h2 className="text-lg font-black text-white leading-tight">
                ZIPパッケージの準備が完了しました！
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>

        {/* ファイル情報カード */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/40 font-mono">ファイル名:</span>
            <span className="font-mono text-emerald-300 font-bold truncate max-w-[280px]" title={data.filename}>
              {data.filename}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs border-t border-white/5 pt-2">
            <span className="text-white/40">ファイルサイズ:</span>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold font-mono text-[11px] border border-emerald-500/30">
              {data.sizeStr}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs border-t border-white/5 pt-2">
            <span className="text-white/40">同梱コンテンツ:</span>
            <div className="flex items-center gap-2 text-white/80 font-medium text-[11px]">
              {data.videoCount > 0 && <span className="text-purple-300">🎬 動画 {data.videoCount}本</span>}
              <span className="text-blue-300">🎨 画像 {data.imageCount}枚</span>
              <span className="text-amber-300">📜 script.json</span>
              <span className="text-emerald-300">📝 srt字幕</span>
            </div>
          </div>
        </div>

        {/* メインアクション：ダイレクトダウンロードボタン */}
        <div className="flex flex-col gap-2">
          <a
            href={data.blobUrl}
            download={data.filename}
            onClick={() => {
              setDownloaded(true);
            }}
            className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-black font-black text-center rounded-2xl shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 text-base transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
          >
            <span className="material-symbols-outlined text-2xl">download</span>
            {downloaded ? '✅ 再度ダウンロードする' : `今すぐPCに保存する (${data.sizeStr})`}
          </a>
          <p className="text-[11px] text-center text-white/40 leading-relaxed">
            ※ ブラウザのセキュリティ仕様により、上のボタンをクリックしてPCのダウンロードフォルダに保存してください。
          </p>
        </div>

        {/* CT192 (Media Vault) 連携ミニガイド */}
        <div className="bg-purple-950/20 border border-purple-500/20 rounded-2xl p-4 flex items-center gap-3">
          <span className="material-symbols-outlined text-purple-400 text-2xl shrink-0">
            hub
          </span>
          <div className="flex flex-col gap-0.5 text-xs text-purple-200">
            <span className="font-bold text-white">Media Vault (Port 8090) への取り込み</span>
            <span className="text-white/60 text-[11px]">
              ダウンロードした ZIP を CT192 WebUI にドラッグ＆ドロップするだけで、音声TTS付与・テロップ合成・本編動画化が一瞬で完了します。
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
