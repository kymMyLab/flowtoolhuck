import React, { useState, useRef } from 'react';
import { ImportedTrack, parseMusicTracksJson, convertTrackToEpisode } from '../../services/musicImporter';
import { Episode } from '../../types';

interface MusicImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeployEpisode: (episode: Episode) => void;
  onDeployBatchEpisodes?: (episodes: Episode[]) => void;
}

export const MusicImportModal: React.FC<MusicImportModalProps> = ({
  isOpen,
  onClose,
  onDeployEpisode,
  onDeployBatchEpisodes
}) => {
  const [jsonText, setJsonText] = useState('');
  const [parsedTracks, setParsedTracks] = useState<ImportedTrack[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleParse = (text: string) => {
    setErrorMessage(null);
    try {
      if (!text.trim()) {
        setParsedTracks([]);
        return;
      }
      const tracks = parseMusicTracksJson(text);
      setParsedTracks(tracks);
      if (tracks.length === 0) {
        setErrorMessage('楽曲データが見つかりませんでした。');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'JSON解析エラー');
      setParsedTracks([]);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      setJsonText(content);
      handleParse(content);
    };
    reader.readAsText(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = String(event.target?.result || '');
      setJsonText(content);
      handleParse(content);
    };
    reader.readAsText(file);
    if (e.target) e.target.value = '';
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setJsonText(text);
      handleParse(text);
    } catch (e) {
      alert('クリップボードの読み取りに失敗しました。下のテキストエリアに直接貼り付けてください。');
    }
  };

  const handleDeploySingle = (track: ImportedTrack) => {
    try {
      const episode = convertTrackToEpisode(track);
      onDeployEpisode(episode);
      onClose();
    } catch (err: any) {
      alert(`エピソード展開エラー: ${err.message}`);
    }
  };

  const handleDeployAll = () => {
    if (parsedTracks.length === 0) return;
    try {
      const episodes = parsedTracks.map(t => convertTrackToEpisode(t));
      if (onDeployBatchEpisodes) {
        onDeployBatchEpisodes(episodes);
      } else {
        // フォールバック: 先頭エピソードを展開
        onDeployEpisode(episodes[0]);
      }
      onClose();
    } catch (err: any) {
      alert(`一括展開エラー: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#121216] border border-purple-500/40 rounded-2xl shadow-2xl shadow-purple-950/50 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-purple-950/30">
          <div className="flex items-center gap-3">
            <span className="p-2 text-purple-300 rounded-xl bg-purple-500/20 border border-purple-500/30">
              <span className="material-symbols-outlined text-[24px]">library_music</span>
            </span>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                CT198 楽曲JSONインポーター
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-500/30 text-purple-300 border border-purple-400/40">
                  Proxmox CT198 ⇄ FlowTool
                </span>
              </h2>
              <p className="text-xs text-white/50">
                CT198から書き出した session_songs_metadata.json を放り込むだけで、12カットMV絵コンテを自動錬成します
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 dark-scrollbar">
          
          {/* Drop & Input Area */}
          <div 
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
            className={`border-2 border-dashed rounded-xl p-5 transition-all text-center flex flex-col items-center justify-center gap-3 ${
              isDragging ? 'border-purple-400 bg-purple-500/10 scale-[0.99]' : 'border-white/15 bg-white/5 hover:border-white/25'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept=".json" 
              className="hidden" 
            />
            <span className="p-3 text-purple-400 rounded-full bg-purple-500/10">
              <span className="material-symbols-outlined text-[32px]">upload_file</span>
            </span>
            <div>
              <p className="text-sm font-bold text-white">
                session_songs_metadata.json をドラッグ＆ドロップ
              </p>
              <p className="text-xs text-white/40 mt-1">
                または、下のボタンからファイル選択・クリップボード貼り付け
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/10 flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">folder_open</span>
                JSONファイルを選択
              </button>
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="px-3.5 py-1.5 text-xs font-bold bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 rounded-lg transition-colors border border-purple-500/30 flex items-center gap-1.5 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">content_paste</span>
                クリップボードから貼り付け
              </button>
            </div>
          </div>

          {/* Error Banner */}
          {errorMessage && (
            <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">error</span>
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Parsed Tracks List */}
          {parsedTracks.length > 0 && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-amber-300 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[16px]">queue_music</span>
                    検出された楽曲トラック ({parsedTracks.length}曲)
                  </span>
                  <span className="text-[10px] text-white/40">
                    サビ30秒・歌詞・伏線小道具が自動抽出されています
                  </span>
                </div>
                {onDeployBatchEpisodes && parsedTracks.length > 1 && (
                  <button
                    type="button"
                    onClick={handleDeployAll}
                    className="px-3 py-1.5 text-xs font-black bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-black rounded-lg shadow-md transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">bolt</span>
                    全{parsedTracks.length}曲を一括エピソード展開
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto dark-scrollbar p-1">
                {parsedTracks.map((t, idx) => (
                  <div 
                    key={t.id || idx}
                    className="p-3.5 rounded-xl bg-black/40 border border-white/10 hover:border-purple-500/50 transition-all flex flex-col justify-between gap-3 group shadow-md"
                  >
                    <div className="flex items-start gap-3">
                      {/* Cover Thumbnail */}
                      {t.cover_url ? (
                        <img 
                          src={t.cover_url} 
                          alt={t.title} 
                          className="w-14 h-14 rounded-lg object-cover border border-white/10 shrink-0 shadow-sm"
                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-14 h-14 rounded-lg bg-purple-950/40 border border-purple-500/20 flex flex-col items-center justify-center text-purple-300 shrink-0">
                          <span className="material-symbols-outlined text-[20px]">music_note</span>
                          <span className="text-[8px] font-bold">#{t.track_no || idx + 1}</span>
                        </div>
                      )}

                      {/* Track Details */}
                      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 font-bold border border-purple-500/30">
                            #{t.track_no || idx + 1}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold border border-amber-500/30">
                            Pool {t.pool_code}
                          </span>
                          <span className="text-[9px] text-white/40 font-mono">
                            {t.bpm} BPM
                          </span>
                        </div>
                        <h3 className="text-xs font-black text-white truncate" title={t.title}>
                          {t.title}
                        </h3>
                        <p className="text-[10px] text-white/50 truncate" title={t.surface_theme}>
                          {t.surface_theme || '日常テーマ未設定'}
                        </p>
                      </div>
                    </div>

                    {/* Metadata Badges */}
                    <div className="bg-white/5 rounded-lg p-2 flex flex-col gap-1 text-[9.5px]">
                      <div className="flex items-center justify-between text-white/60">
                        <span>サビ区間:</span>
                        <span className="text-amber-300 font-bold">
                          {t.chorus_start_sec}s - {t.chorus_end_sec}s ({t.chorus_duration_sec}秒神仕様)
                        </span>
                      </div>
                      {t.visual_hints && (
                        <div className="text-white/40 truncate text-[9px]" title={t.visual_hints}>
                          🎬 {t.visual_hints}
                        </div>
                      )}
                    </div>

                    {/* Deploy Button */}
                    <button
                      type="button"
                      onClick={() => handleDeploySingle(t)}
                      className="w-full py-2 px-3 rounded-lg text-xs font-black bg-purple-600/30 hover:bg-purple-600 text-purple-200 hover:text-white border border-purple-500/40 hover:border-purple-400 flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px]">movie_edit</span>
                      この曲で12カットMVを展開
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw JSON input textarea (Accordion or bottom collapse) */}
          <details className="text-xs text-white/40 border-t border-white/5 pt-3">
            <summary className="cursor-pointer hover:text-white/70 select-none font-bold">
              📝 生JSONテキストの手動確認・編集
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <textarea
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  handleParse(e.target.value);
                }}
                placeholder="ここに session_songs_metadata.json のテキストを直接貼り付け..."
                rows={4}
                className="w-full p-2.5 rounded-lg bg-black/60 border border-white/10 text-[11px] font-mono text-white/80 outline-none focus:border-purple-400 dark-scrollbar resize-y"
              />
            </div>
          </details>

        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between text-xs text-white/40">
          <span>規格: Proxmoxクラスタ3者共通規格 (v2.2.0-GrandProduction) 準拠</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white font-bold transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>

      </div>
    </div>
  );
};
