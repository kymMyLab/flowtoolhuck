import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ImportedTrack, parseMusicTracksJson, convertTrackToEpisode } from '../../services/musicImporter';
import { Episode, CastCharacter } from '../../types';
import { loadMangaProject } from '../../services/castStorage';
import { COVER_PALETTES, getCoverPalettesForGenre, CoverPalette } from '../../services/export/coverRenderer';
import { CHARACTER_ARCHETYPES } from '../../config/characterArchetypes';

// 分割サブコンポーネントのインポート
import { CharacterSelectorAccordion } from './subcomponents/CharacterSelectorAccordion';
import { TasteShowcaseGrid } from './subcomponents/TasteShowcaseGrid';
import { CoverThemeSelector } from './subcomponents/CoverThemeSelector';

interface MusicImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeployEpisode: (episode: Episode) => void;
  onDeployBatchEpisodes?: (episodes: Episode[]) => void;
  initialFile?: File | null;
  initialJsonText?: string;
  injectedPayload?: { text: string; fileName: string; timestamp: number } | null;
  videoRatio?: string;
  onOpenCastModal?: () => void;
  isModal?: boolean; // false の場合はアコーディオン（インラインパネル）として展開
}

export const MusicImportModal: React.FC<MusicImportModalProps> = ({
  isOpen,
  onClose,
  onDeployEpisode,
  onDeployBatchEpisodes,
  initialFile,
  initialJsonText,
  injectedPayload,
  videoRatio = '30%',
  onOpenCastModal,
  isModal = false,
}) => {
  const [jsonText, setJsonText] = useState('');
  const [parsedTracks, setParsedTracks] = useState<ImportedTrack[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isBoxDragging, setIsBoxDragging] = useState(false);
  const [failedCovers, setFailedCovers] = useState<Record<string, boolean>>({});
  const [castCharacters, setCastCharacters] = useState<CastCharacter[]>([]);

  // 🎭 キャスト固定モード（デフォルトOFF: JSONの世界観・情景・登場人物を100%最優先描画）
  const [isCastLockEnabled, setIsCastLockEnabled] = useState<boolean>(false);
  const [selectedCastId, setSelectedCastId] = useState<string>('none');

  // 🎨 画風モデル設定State (デフォルト: 'auto' = JSON指定・トラック個別画風を最優先)
  const [selectedTasteKey, setSelectedTasteKey] = useState<string>('auto');

  // 🎨 サムネイル配色テーマState
  const [selectedCoverThemeId, setSelectedCoverThemeId] = useState<string>('auto');
  const [autoTheme, setAutoTheme] = useState<CoverPalette>(() => {
    const list = getCoverPalettesForGenre('mv');
    return list[Math.floor(Math.random() * list.length)] || COVER_PALETTES.mv_violet;
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const boxDragCounterRef = useRef(0);

  // モーダルオープン時またはリロール時にランダム選定
  useEffect(() => {
    if (isOpen) {
      const list = getCoverPalettesForGenre('mv');
      if (list.length > 0) {
        setAutoTheme(list[Math.floor(Math.random() * list.length)]);
      }
    }
  }, [isOpen]);

  const handleRerollTheme = () => {
    const list = getCoverPalettesForGenre('mv');
    if (list.length > 0) {
      const pool = list.filter(p => p.id !== autoTheme.id);
      const next = (pool.length > 0 ? pool : list)[Math.floor(Math.random() * (pool.length > 0 ? pool.length : list.length))];
      setAutoTheme(next);
    }
  };

  // 選択中のキャストまたは様態の解決
  const resolveSelectedCharacter = useCallback((): CastCharacter | undefined => {
    if (!isCastLockEnabled || selectedCastId === 'none') return undefined;
    const selectedArch = CHARACTER_ARCHETYPES.find(a => a.id === selectedCastId);
    if (selectedArch) {
      return {
        id: selectedArch.id,
        name: selectedArch.name,
        role: 'protagonist',
        dnaPromptEn: selectedArch.dnaPromptEn,
      };
    }
    return castCharacters.find(c => c.id === selectedCastId);
  }, [isCastLockEnabled, selectedCastId, castCharacters]);

  // モーダルオープン時にキャスト一覧を読み込み
  useEffect(() => {
    if (isOpen) {
      const project = loadMangaProject();
      setCastCharacters(project.characters || []);

      const mvPalettes = getCoverPalettesForGenre('mv');
      const randomIdx = Math.floor(Math.random() * mvPalettes.length);
      setAutoTheme(mvPalettes[randomIdx] || COVER_PALETTES.mv_violet);
      setSelectedCoverThemeId('auto');
    }
  }, [isOpen]);

  // キャスト台帳が別モーダルで更新された場合にも即時同期
  useEffect(() => {
    const handleSync = () => {
      if (isOpen) {
        const p = loadMangaProject();
        setCastCharacters(p.characters || []);
      }
    };
    window.addEventListener('focus', handleSync);
    window.addEventListener('storage', handleSync);
    return () => {
      window.removeEventListener('focus', handleSync);
      window.removeEventListener('storage', handleSync);
    };
  }, [isOpen]);

  const handleParse = useCallback((text: string, sourceName?: string) => {
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
      } else {
        const label = sourceName ? `「${sourceName}」から ` : '';
        setSuccessMessage(`✅ ${label}${tracks.length}曲の楽曲メタデータを正常に読み込みました！`);
        console.log(`✅ [MusicImporter] ${tracks.length}曲の展開完了:`, tracks.map(t => t.title));
        setTimeout(() => setSuccessMessage(null), 6000);
      }
    } catch (err: any) {
      console.error('❌ [MusicImporter] JSON解析エラー:', err);
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
      handleParse(content, file.name);
    } catch (err: any) {
      console.error('❌ [MusicImporter] file.text() エラー、FileReaderフォールバック:', err);
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = String(event.target?.result || '');
        setJsonText(content);
        handleParse(content, file.name);
      };
      reader.onerror = () => {
        setErrorMessage('ファイルの読み込みに失敗しました。');
      };
      reader.readAsText(file);
    }
  }, [handleParse]);

  // injectedPayload, initialJsonText または initialFile が外部から渡された場合に即時パース
  useEffect(() => {
    if (isOpen) {
      if (injectedPayload && injectedPayload.text) {
        console.log('📦 [MusicImportModal] injectedPayload 受信:', injectedPayload.fileName, injectedPayload.text.length, '文字');
        setJsonText(injectedPayload.text);
        handleParse(injectedPayload.text, injectedPayload.fileName);
      } else if (initialJsonText) {
        console.log('📦 [MusicImportModal] initialJsonText 受信:', initialJsonText.length, '文字');
        setJsonText(initialJsonText);
        handleParse(initialJsonText);
      } else if (initialFile) {
        console.log('📦 [MusicImportModal] initialFile 受信:', initialFile.name);
        processFile(initialFile);
      }
    }
  }, [isOpen, injectedPayload, initialJsonText, initialFile, handleParse, processFile]);

  // グローバルなCtrl+V（ペースト）＆ブラウザデフォルトのファイルオープン防止
  useEffect(() => {
    if (!isOpen) return;

    const handleWindowPaste = (e: ClipboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'INPUT')) {
        return;
      }
      const text = e.clipboardData?.getData('text');
      if (text && (text.includes('{') || text.includes('['))) {
        e.preventDefault();
        console.log('📋 [MusicImportModal] クリップボードテキスト検知＆パース実行');
        setJsonText(text);
        handleParse(text, 'クリップボード');
      }
    };

    const preventBrowserOpen = (e: DragEvent) => {
      e.preventDefault();
    };

    window.addEventListener('paste', handleWindowPaste);
    window.addEventListener('dragover', preventBrowserOpen);
    window.addEventListener('drop', preventBrowserOpen);

    return () => {
      window.removeEventListener('paste', handleWindowPaste);
      window.removeEventListener('dragover', preventBrowserOpen);
      window.removeEventListener('drop', preventBrowserOpen);
    };
  }, [isOpen, handleParse]);

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setJsonText(text);
        handleParse(text);
      }
    } catch (e) {
      const direct = prompt('クリップボードのJSONテキストをここに貼り付けてください:');
      if (direct) {
        setJsonText(direct);
        handleParse(direct);
      }
    }
  };

  const handleDeploySingle = (track: ImportedTrack) => {
    try {
      const charToInject = resolveSelectedCharacter();
      const effectiveTheme = selectedCoverThemeId === 'auto' ? autoTheme.id : selectedCoverThemeId;
      const effectiveTaste = selectedTasteKey === 'auto' ? undefined : selectedTasteKey;
      const episode = convertTrackToEpisode(track, videoRatio, charToInject, effectiveTheme, effectiveTaste);
      onDeployEpisode(episode);
      onClose();
    } catch (err: any) {
      alert(`エピソード展開エラー: ${err.message}`);
    }
  };

  const handleDeployAll = () => {
    if (parsedTracks.length === 0) return;
    try {
      const charToInject = resolveSelectedCharacter();
      const effectiveTheme = selectedCoverThemeId === 'auto' ? autoTheme.id : selectedCoverThemeId;
      const effectiveTaste = selectedTasteKey === 'auto' ? undefined : selectedTasteKey;
      const episodes = parsedTracks.map(t => convertTrackToEpisode(t, videoRatio, charToInject, effectiveTheme, effectiveTaste));
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

  const isLocalPrivateNetworkUrl = (url?: string) => {
    if (!url) return true;
    return url.includes('10.10.') || url.includes('192.168.') || url.includes('127.0.0.1') || url.includes('localhost') || url.includes('tech-notes.win');
  };

  if (!isOpen) return null;

  const cardContent = (
    <div 
      className={`relative w-full bg-[#121216] border-2 border-purple-500/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-slate-100 ${
        isModal ? 'max-w-4xl max-h-[92vh]' : 'mb-6 shadow-purple-950/40 animate-fadeIn'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-purple-950/40 shrink-0">
        <div className="flex items-center gap-3">
          <span className="p-2 text-purple-300 rounded-xl bg-purple-500/20 border border-purple-500/30 shadow-inner">
            <span className="material-symbols-outlined text-[24px]">library_music</span>
          </span>
          <div>
            <h2 className="text-base font-black text-white flex items-center gap-2">
              CT198 楽曲JSONインポーター
              <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-500/30 text-purple-300 border border-purple-400/40">
                {isModal ? 'Proxmox CT198 ⇄ FlowTool' : '🎵 アコーディオン展開中'}
              </span>
            </h2>
            <p className="text-xs text-white/50">
              CT198から書き出した session_songs_metadata.json を放り込むだけで、12カットMV絵コンテを自動錬成します
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isModal ? (
            <button 
              type="button" 
              onClick={onClose} 
              className="px-3.5 py-1.5 text-xs font-black text-amber-300 hover:text-black bg-amber-500/20 hover:bg-amber-400 border border-amber-400/40 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              title="アコーディオンを閉じる"
            >
              <span className="material-symbols-outlined text-[16px]">expand_less</span>
              <span>インポーターを畳む ▲</span>
            </button>
          ) : (
            <button 
              type="button" 
              onClick={onClose} 
              className="p-1.5 text-white/60 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Content Body */}
      <div className={`p-4 sm:p-6 flex flex-col gap-4 dark-scrollbar scroll-pt-4 ${isModal ? 'flex-1 min-h-0 overflow-y-auto' : 'overflow-visible'}`}>
        
        {/* 🎭 主演キャスト様態設定 (サブコンポーネント) */}
        <CharacterSelectorAccordion
          isCastLockEnabled={isCastLockEnabled}
          onToggleCastLock={setIsCastLockEnabled}
          selectedCastId={selectedCastId}
          onSelectCastId={setSelectedCastId}
          castCharacters={castCharacters}
          onOpenCastModal={onOpenCastModal}
        />

        {/* 🎨 MV画風スタイル設定 (サブコンポーネント) */}
        <TasteShowcaseGrid
          selectedTasteKey={selectedTasteKey}
          onSelectTasteKey={setSelectedTasteKey}
        />

        {/* 🎨 サムネイル配色テーマ (サブコンポーネント) */}
        <CoverThemeSelector
          selectedCoverThemeId={selectedCoverThemeId}
          onSelectCoverThemeId={setSelectedCoverThemeId}
          autoTheme={autoTheme}
          onRerollTheme={handleRerollTheme}
        />
        
        {/* Drop & Input Area (点線ドロップ枠: 鉄壁D&D) */}
        <div 
          onDragEnter={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            boxDragCounterRef.current += 1;
            setIsBoxDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            if (!isBoxDragging) setIsBoxDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.currentTarget.contains(e.relatedTarget as Node)) {
              return;
            }
            boxDragCounterRef.current -= 1;
            if (boxDragCounterRef.current <= 0) {
              boxDragCounterRef.current = 0;
              setIsBoxDragging(false);
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            boxDragCounterRef.current = 0;
            setIsBoxDragging(false);

            const file = e.dataTransfer?.files?.[0];
            const rawText = e.dataTransfer?.getData('text') || e.dataTransfer?.getData('text/plain') || '';

            if (file) {
              processFile(file);
            } else if (rawText && (rawText.includes('{') || rawText.includes('['))) {
              setJsonText(rawText);
              handleParse(rawText, 'dropped_editor_text.json');
            }
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-5 transition-all duration-200 text-center flex flex-col items-center justify-center gap-3 shrink-0 select-none cursor-pointer group/dropzone relative overflow-hidden ${
            isBoxDragging 
              ? 'border-amber-400 bg-amber-500/25 ring-4 ring-amber-400/50 scale-[1.01] shadow-[0_0_35px_rgba(245,158,11,0.5)]' 
              : 'border-white/20 bg-white/5 hover:border-amber-400/60 hover:bg-white/10 shadow-sm'
          }`}
        >
          {isBoxDragging && (
            <div className="absolute inset-0 z-20 bg-amber-500/10 pointer-events-none" />
          )}

          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) processFile(f);
              if (e.target) e.target.value = '';
            }}
            accept=".json,application/json" 
            className="hidden"
          />

          <div className="flex items-center gap-3 pointer-events-none">
            <span className={`p-3 rounded-full transition-all duration-200 ${
              isBoxDragging 
                ? 'bg-amber-400 text-black scale-110 shadow-lg shadow-amber-400/50 animate-bounce' 
                : 'bg-purple-500/20 text-purple-300 group-hover/dropzone:bg-amber-500/20 group-hover/dropzone:text-amber-300'
            }`}>
              <span className="material-symbols-outlined text-[32px]">
                {isBoxDragging ? 'download' : 'upload_file'}
              </span>
            </span>
            <div className="text-left">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-white flex items-center gap-2">
                  {isBoxDragging ? (
                    <span className="text-amber-300 font-black animate-pulse flex items-center gap-1.5 text-base">
                      <span>📥</span>
                      <span>マウスを離して session_songs_metadata.json を即座に展開！</span>
                    </span>
                  ) : (
                    <>
                      <span>session_songs_metadata.json をドラッグ＆ドロップ</span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 font-mono border border-purple-500/30">
                        枠内クリックで選択 / Ctrl + V
                      </span>
                    </>
                  )}
                </p>
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold transition-all ${
                  isBoxDragging 
                    ? 'bg-amber-400 text-black animate-pulse shadow-md' 
                    : 'bg-white/10 text-white/60 border border-white/15'
                }`}>
                  {isBoxDragging ? '⚡ D&D検知中 (Active)' : '🟢 D&D待機中 (Ready)'}
                </span>
              </div>
              <p className="text-xs text-white/50 mt-0.5">
                {isBoxDragging
                  ? '指を離すと全自動で12カットMV絵コンテへ瞬時に展開されます'
                  : 'この枠内へドラッグ＆ドロップ、または枠内クリックで即座に読み込まれます'}
              </p>
            </div>
          </div>

          <div className={`flex items-center gap-2 mt-1 relative z-40 ${isBoxDragging ? 'pointer-events-none' : ''}`}>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                fileInputRef.current?.click();
              }}
              className="px-4 py-2 text-xs font-bold bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors border border-white/15 flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">folder_open</span>
              JSONファイルを選択
            </button>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handlePasteClipboard();
              }}
              className="px-4 py-2 text-xs font-bold bg-purple-600/30 hover:bg-purple-600/50 text-purple-200 rounded-lg transition-colors border border-purple-500/40 flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
            >
              <span className="material-symbols-outlined text-[16px]">content_paste</span>
              クリップボードから貼り付け
            </button>
          </div>
        </div>

        {/* Success Banner */}
        {successMessage && (
          <div className="p-3 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center gap-2 shrink-0 animate-fade-in">
            <span className="material-symbols-outlined text-[18px] text-emerald-400">check_circle</span>
            <span className="font-bold">{successMessage}</span>
          </div>
        )}

        {/* Error Banner */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 text-xs flex items-center gap-2 shrink-0 animate-fade-in">
            <span className="material-symbols-outlined text-[18px]">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Parsed Tracks List */}
        {parsedTracks.length > 0 && (
          <div className="flex flex-col gap-3 shrink-0">
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
  );

  return (
    <>
      {isModal ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
          {cardContent}
        </div>
      ) : (
        cardContent
      )}
    </>
  );
};
