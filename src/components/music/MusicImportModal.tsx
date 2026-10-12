import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ImportedTrack, parseMusicTracksJson, convertTrackToEpisode } from '../../services/musicImporter';
import { Episode } from '../../types';

interface MusicImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeployEpisode: (episode: Episode) => void;
  onDeployBatchEpisodes?: (episodes: Episode[]) => void;
  initialFile?: File | null;
  initialJsonText?: string;
}

export const MusicImportModal: React.FC<MusicImportModalProps> = ({
  isOpen,
  onClose,
  onDeployEpisode,
  onDeployBatchEpisodes,
  initialFile,
  initialJsonText
}) => {
  const [jsonText, setJsonText] = useState('');
  const [parsedTracks, setParsedTracks] = useState<ImportedTrack[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [failedCovers, setFailedCovers] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  const handleParse = useCallback((text: string) => {
    setErrorMessage(null);
    try {
      if (!text.trim()) {
        setParsedTracks([]);
        return;
      }
      const tracks = parseMusicTracksJson(text);
      setParsedTracks(tracks);
      if (tracks.length === 0) {
        setErrorMessage('楽曲データが見つかりませんでした。有効なJSONを指定してください。');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'JSON解析エラー');
      setParsedTracks([]);
    }
  }, []);

  const processFile = useCallback(async (file: File) => {
    if (!file) return;
    console.log('📖 [MusicImporter] ファイル解析開始:', {
      name: file.name,
      size: `${Math.round(file.size / 1024)} KB`,
      type: file.type || 'unknown'
    });
    try {
      const content = await file.text();
      console.log(`✅ [MusicImporter] ファイル読み込み完了 (${content.length}文字)`);
      setJsonText(content);
      handleParse(content);
    } catch (err: any) {
      console.error('❌ [MusicImporter] file.text() エラー、FileReaderフォールバック:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = String(event.target?.result || '');
        setJsonText(content);
        handleParse(content);
      };
      reader.onerror = () => {
        setErrorMessage('ファイルの読み込みに失敗しました。');
      };
      reader.readAsText(file);
    }
  }, [handleParse]);

  // initialJsonText または initialFile が外部（全画面D&D等）から渡された場合に即時パース
  useEffect(() => {
    if (isOpen) {
      if (initialJsonText) {
        console.log('📦 [MusicImportModal] initialJsonText 受信:', initialJsonText.length, '文字');
        setJsonText(initialJsonText);
        handleParse(initialJsonText);
      } else if (initialFile) {
        console.log('📦 [MusicImportModal] initialFile 受信:', initialFile.name);
        processFile(initialFile);
      }
    }
  }, [isOpen, initialJsonText, initialFile, handleParse, processFile]);

  // グローバルなCtrl+V（ペースト）の自動捕捉＆全画面D&D完全対応
  useEffect(() => {
    if (!isOpen) return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      // 生テキストエリアに直接フォーカスしている場合はネイティブペーストに任せる
      if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        return;
      }
      const text = e.clipboardData?.getData('text');
      if (text && (text.includes('{') || text.includes('['))) {
        e.preventDefault();
        console.log('📋 [MusicImportModal] クリップボードテキスト検知＆パース実行');
        setJsonText(text);
        handleParse(text);
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
      dragCounterRef.current += 1;
      setIsDragging(true);
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDragging(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      dragCounterRef.current = 0;
      const file = e.dataTransfer?.files?.[0];
      console.log('🎯 [MusicImportModal] Window Drop検知:', file?.name);
      if (file) {
        processFile(file);
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    window.addEventListener('dragover', handleWindowDragOver, true);
    window.addEventListener('dragenter', handleWindowDragEnter, true);
    window.addEventListener('dragleave', handleWindowDragLeave, true);
    window.addEventListener('drop', handleWindowDrop, true);

    document.addEventListener('dragover', handleWindowDragOver, true);
    document.addEventListener('drop', handleWindowDrop, true);

    return () => {
      window.removeEventListener('paste', handleWindowPaste);
      window.removeEventListener('dragover', handleWindowDragOver, true);
      window.removeEventListener('dragenter', handleWindowDragEnter, true);
      window.removeEventListener('dragleave', handleWindowDragLeave, true);
      window.removeEventListener('drop', handleWindowDrop, true);
      document.removeEventListener('dragover', handleWindowDragOver, true);
      document.removeEventListener('drop', handleWindowDrop, true);
    };
  }, [isOpen, handleParse, processFile]);

  // モーダル全体でのドラッグ＆ドロップ監視（チラつき防止のカウント管理）
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    dragCounterRef.current += 1;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current -= 1;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;
    const file = e.dataTransfer.files?.[0];
    console.log('🎯 [MusicImportModal React onDrop検知]', {
      filesCount: e.dataTransfer.files?.length,
      fileName: file?.name
    });
    if (file) {
      processFile(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    if (e.target) e.target.value = '';
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setJsonText(text);
        handleParse(text);
      }
    } catch (e) {
      // ブラウザのセキュリティでclipboard APIが弾かれた場合はプロンプトでフォールバック
      const direct = prompt('クリップボードのJSONテキストをここに貼り付けてください:');
      if (direct) {
        setJsonText(direct);
        handleParse(direct);
      }
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
        onDeployEpisode(episodes[0]);
      }
      onClose();
    } catch (err: any) {
      alert(`一括展開エラー: ${err.message}`);
    }
  };

  // プライベートネットワーク（10.10.x.xやローカルIP）のURL判定
  const isLocalPrivateNetworkUrl = (url?: string) => {
    if (!url) return true;
    return url.includes('10.10.') || url.includes('192.168.') || url.includes('127.0.0.1') || url.includes('localhost') || url.includes('tech-notes.win');
  };

  if (!isOpen) return null;

  return (
    <div 
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none"
    >
      {/* 全画面ドラッグ中オーバーレイ */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-purple-950/80 border-4 border-dashed border-purple-400 flex flex-col items-center justify-center pointer-events-none animate-pulse">
          <span className="material-symbols-outlined text-purple-200 text-[64px] mb-2">file_download</span>
          <p className="text-xl font-black text-white">ここに session_songs_metadata.json をドロップしてください！</p>
          <p className="text-sm text-purple-300 mt-1">瞬時に12カットMV絵コンテへパースします</p>
        </div>
      )}

      <div className="relative w-full max-w-4xl max-h-[92vh] bg-[#121216] border border-purple-500/40 rounded-2xl shadow-2xl shadow-purple-950/60 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-purple-950/30">
          <div className="flex items-center gap-3">
            <span className="p-2 text-purple-300 rounded-xl bg-purple-500/20 border border-purple-500/30 shadow-inner">
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
            className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 dark-scrollbar">
          
          {/* Drop & Input Area */}
          <div 
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-5 transition-all text-center flex flex-col items-center justify-center gap-3 ${
              isDragging ? 'border-purple-400 bg-purple-500/20 scale-[0.99]' : 'border-white/15 bg-white/5 hover:border-purple-500/30'
            }`}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileSelect} 
              accept=".json" 
              className="hidden" 
            />
            <div className="flex items-center gap-2">
              <span className="p-2.5 text-purple-400 rounded-full bg-purple-500/10">
                <span className="material-symbols-outlined text-[28px]">upload_file</span>
              </span>
              <div className="text-left">
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  <span>session_songs_metadata.json をドラッグ＆ドロップ</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30">
                    または画面上で Ctrl + V
                  </span>
                </p>
                <p className="text-xs text-white/40 mt-0.5">
                  全画面どこにドロップしても即座に読み込まれます（Ctrl+Vでの貼り付けにも完全対応）
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/15 flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[16px]">folder_open</span>
                JSONファイルを選択
              </button>
              <button
                type="button"
                onClick={handlePasteClipboard}
                className="px-4 py-2 text-xs font-bold bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 rounded-lg transition-colors border border-purple-500/40 flex items-center gap-1.5 cursor-pointer shadow-sm"
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
                    className="px-3.5 py-1.5 text-xs font-black bg-gradient-to-r from-amber-500 via-amber-400 to-purple-600 hover:opacity-90 text-black rounded-lg shadow-md transition-all flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px]">bolt</span>
                    全{parsedTracks.length}曲を一括エピソード展開
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto dark-scrollbar p-1">
                {parsedTracks.map((t, idx) => {
                  const trackKey = t.id || `trk_${idx}`;
                  const isLocalUrl = isLocalPrivateNetworkUrl(t.cover_url);
                  const showImage = !!t.cover_url && !isLocalUrl && !failedCovers[trackKey];

                  return (
                    <div 
                      key={trackKey}
                      className="p-3.5 rounded-xl bg-black/40 border border-white/10 hover:border-purple-500/50 transition-all flex flex-col justify-between gap-3 group shadow-md"
                    >
                      <div className="flex items-start gap-3">
                        {/* Cover Thumbnail / Styled Badge */}
                        {showImage ? (
                          <img 
                            src={t.cover_url} 
                            alt={t.title} 
                            className="w-14 h-14 rounded-lg object-cover border border-white/10 shrink-0 shadow-sm"
                            onError={() => {
                              setFailedCovers(prev => ({ ...prev, [trackKey]: true }));
                            }}
                          />
                        ) : (
                          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-purple-900/60 to-slate-900 border border-purple-500/30 flex flex-col items-center justify-center text-purple-300 shrink-0 shadow-inner">
                            <span className="material-symbols-outlined text-[20px]">music_note</span>
                            <span className="text-[8px] font-bold text-amber-300/90 font-mono">P{t.pool_code || 20}</span>
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
                  );
                })}
              </div>
            </div>
          )}

          {/* Raw JSON input textarea */}
          <details className="text-xs text-white/40 border-t border-white/5 pt-3" open={parsedTracks.length === 0}>
            <summary className="cursor-pointer hover:text-white/70 select-none font-bold flex items-center gap-1">
              <span>📝 生JSONテキストの手動確認・貼り付け</span>
              {jsonText && <span className="text-[10px] text-emerald-400 font-normal">（入力済み）</span>}
            </summary>
            <div className="mt-2 flex flex-col gap-2">
              <textarea
                value={jsonText}
                onChange={(e) => {
                  setJsonText(e.target.value);
                  handleParse(e.target.value);
                }}
                placeholder="ここに session_songs_metadata.json のテキストを直接貼り付けることも可能です..."
                rows={parsedTracks.length > 0 ? 3 : 5}
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
