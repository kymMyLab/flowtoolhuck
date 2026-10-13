import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ImportedTrack, parseMusicTracksJson, convertTrackToEpisode } from '../../services/musicImporter';
import { Episode, CastCharacter } from '../../types';
import { loadMangaProject } from '../../services/castStorage';
import { COVER_PALETTES, getCoverPalettesForGenre, CoverPalette } from '../../services/export/coverRenderer';

interface MusicImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDeployEpisode: (episode: Episode) => void;
  onDeployBatchEpisodes?: (episodes: Episode[]) => void;
  initialFile?: File | null;
  initialJsonText?: string;
  videoRatio?: string;
}

export const MusicImportModal: React.FC<MusicImportModalProps> = ({
  isOpen,
  onClose,
  onDeployEpisode,
  onDeployBatchEpisodes,
  initialFile,
  initialJsonText,
  videoRatio = '30%'
}) => {
  const [jsonText, setJsonText] = useState('');
  const [parsedTracks, setParsedTracks] = useState<ImportedTrack[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [failedCovers, setFailedCovers] = useState<Record<string, boolean>>({});
  const [castCharacters, setCastCharacters] = useState<CastCharacter[]>([]);
  const [selectedCastId, setSelectedCastId] = useState<string>('none');
  const [castSearchQuery, setCastSearchQuery] = useState<string>('');
  const [castRoleFilter, setCastRoleFilter] = useState<'all' | 'protagonist' | 'partner' | 'antagonist' | 'supporting'>('all');
  const [selectedCoverThemeId, setSelectedCoverThemeId] = useState<string>('auto');
  const [autoTheme, setAutoTheme] = useState<CoverPalette>(COVER_PALETTES.mv_violet);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  // キャスト画像取得ヘルパー（アバター優先、三面図、表情のフォールバック）
  const getCharacterThumbnail = (char: CastCharacter): string | undefined => {
    return char.avatarBase64 || char.turnaroundBase64 || char.expressions?.neutral?.imageBase64;
  };

  // フィルタリング済みキャスト一覧
  const filteredCharacters = castCharacters.filter((char) => {
    const matchesRole = castRoleFilter === 'all' || char.role === castRoleFilter;
    const matchesSearch = !castSearchQuery.trim() || 
      char.name.toLowerCase().includes(castSearchQuery.toLowerCase()) ||
      (char.dnaPromptEn && char.dnaPromptEn.toLowerCase().includes(castSearchQuery.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  const selectedCharacter = castCharacters.find(c => c.id === selectedCastId);

  // モーダルオープン時にキャスト一覧を読み込み、主演をデフォルト選択（初回オープン時のみ）
  // 同時に今回のセッション用のカバー配色バリエーションを自動選定（同一セッション内全曲統一）
  useEffect(() => {
    if (isOpen) {
      const project = loadMangaProject();
      const chars = project.characters || [];
      setCastCharacters(chars);
      if (chars.length > 0) {
        const protagonist = chars.find(c => c.role === 'protagonist');
        setSelectedCastId(protagonist ? protagonist.id : chars[0].id);
      } else {
        setSelectedCastId('none');
      }

      // セッションごとに自動で異なる配色バリエーションを1つ選定（前回の固定マンネリを防止）
      const mvPalettes = getCoverPalettesForGenre('mv');
      const randomIdx = Math.floor(Math.random() * mvPalettes.length);
      setAutoTheme(mvPalettes[randomIdx] || COVER_PALETTES.mv_violet);
      setSelectedCoverThemeId('auto');
    }
  }, [isOpen]);

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
      const selectedCharacter = selectedCastId === 'none' ? undefined : castCharacters.find(c => c.id === selectedCastId);
      const effectiveTheme = selectedCoverThemeId === 'auto' ? autoTheme.id : selectedCoverThemeId;
      const episode = convertTrackToEpisode(track, videoRatio, selectedCharacter, effectiveTheme);
      onDeployEpisode(episode);
      onClose();
    } catch (err: any) {
      alert(`エピソード展開エラー: ${err.message}`);
    }
  };

  const handleDeployAll = () => {
    if (parsedTracks.length === 0) return;
    try {
      const selectedCharacter = selectedCastId === 'none' ? undefined : castCharacters.find(c => c.id === selectedCastId);
      const effectiveTheme = selectedCoverThemeId === 'auto' ? autoTheme.id : selectedCoverThemeId;
      const episodes = parsedTracks.map(t => convertTrackToEpisode(t, videoRatio, selectedCharacter, effectiveTheme));
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
          
          {/* 🎬 主演キャスト (Protagonist Cast) Visual Picker */}
          <div className="flex flex-col gap-3 p-4 bg-white/5 rounded-xl border border-white/10 shadow-sm relative overflow-hidden group">
            {/* Background glowing effect */}
            <div className="absolute -inset-x-20 -inset-y-10 bg-gradient-to-r from-purple-500/0 via-amber-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none blur-xl"></div>

            {/* Header + Search/Filter Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2 relative z-10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[20px] text-amber-400">movie_creation</span>
                <div>
                  <span className="text-sm font-bold text-white flex items-center gap-2">
                    🎬 主演キャスト設定
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                      {filteredCharacters.length} / {castCharacters.length} 体
                    </span>
                  </span>
                </div>
              </div>

              {/* 検索 ＆ ロール絞り込みフィルター */}
              <div className="flex items-center gap-2">
                {/* ロールタブ */}
                <div className="flex items-center bg-black/50 p-0.5 rounded-lg border border-white/10 text-[10px]">
                  <button
                    type="button"
                    onClick={() => setCastRoleFilter('all')}
                    className={`px-2 py-1 rounded transition-colors cursor-pointer ${castRoleFilter === 'all' ? 'bg-purple-600 text-white font-bold' : 'text-white/60 hover:text-white'}`}
                  >
                    全員
                  </button>
                  <button
                    type="button"
                    onClick={() => setCastRoleFilter('protagonist')}
                    className={`px-2 py-1 rounded transition-colors cursor-pointer ${castRoleFilter === 'protagonist' ? 'bg-amber-600 text-white font-bold' : 'text-white/60 hover:text-white'}`}
                  >
                    👑 主人公
                  </button>
                  <button
                    type="button"
                    onClick={() => setCastRoleFilter('partner')}
                    className={`px-2 py-1 rounded transition-colors cursor-pointer ${castRoleFilter === 'partner' ? 'bg-blue-600 text-white font-bold' : 'text-white/60 hover:text-white'}`}
                  >
                    相棒
                  </button>
                  <button
                    type="button"
                    onClick={() => setCastRoleFilter('antagonist')}
                    className={`px-2 py-1 rounded transition-colors cursor-pointer ${castRoleFilter === 'antagonist' ? 'bg-red-600 text-white font-bold' : 'text-white/60 hover:text-white'}`}
                  >
                    宿敵
                  </button>
                </div>

                {/* 検索窓 */}
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[14px] text-white/40">search</span>
                  <input
                    type="text"
                    value={castSearchQuery}
                    onChange={(e) => setCastSearchQuery(e.target.value)}
                    placeholder="名前で検索..."
                    className="w-28 sm:w-36 pl-6 pr-6 py-1 rounded-lg bg-black/60 border border-white/15 text-[11px] text-white outline-none focus:border-purple-400 placeholder-white/30"
                  />
                  {castSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setCastSearchQuery('')}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <p className="text-[10px] text-white/50 relative z-10 -mt-1">
              MVの主人公として展開するキャストを画像から選択してください。指定したキャストのDNA（三面図・プロンプト・表情）が全12カットに自動注入されます。
            </p>

            {/* 選択中キャストのハイライトカード */}
            <div className="p-2.5 bg-black/50 rounded-xl border border-purple-500/30 flex items-center justify-between gap-3 relative z-10 shadow-inner">
              <div className="flex items-center gap-3 min-w-0">
                {selectedCharacter ? (
                  <>
                    <div className="relative shrink-0">
                      {getCharacterThumbnail(selectedCharacter) ? (
                        <img
                          src={getCharacterThumbnail(selectedCharacter)}
                          alt={selectedCharacter.name}
                          className="w-12 h-12 rounded-lg border-2 border-amber-400/80 object-cover shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-800 to-indigo-950 flex items-center justify-center border-2 border-purple-400/50 shadow-inner">
                          <span className="text-sm font-black text-white">{selectedCharacter.name.slice(0, 2)}</span>
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 text-[8px] px-1 py-0.2 rounded bg-amber-500 text-black font-black uppercase shadow">
                        {selectedCharacter.role === 'protagonist' ? '主演' : selectedCharacter.role}
                      </span>
                    </div>
                    <div className="min-w-0 flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white truncate">{selectedCharacter.name}</span>
                        {selectedCharacter.turnaroundBase64 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold shrink-0">
                            三面図DNA完備
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/60 font-mono truncate max-w-md mt-0.5">
                        {selectedCharacter.dnaPromptEn || 'No DNA prompt'}
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2.5">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-slate-800 to-slate-900 border border-white/20 flex items-center justify-center text-white/50">
                      <span className="material-symbols-outlined text-[24px]">casino</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white/90">🎲 キャスト指定なし (AI完全おまかせ)</div>
                      <div className="text-[10px] text-white/50">楽曲タイトル・歌詞からAIがキャラクターを独自に自動生成します</div>
                    </div>
                  </div>
                )}
              </div>

              {selectedCastId !== 'none' && (
                <button
                  type="button"
                  onClick={() => setSelectedCastId('none')}
                  className="px-2.5 py-1 text-[10px] font-bold text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/15 shrink-0 flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[12px]">restart_alt</span>
                  おまかせに戻す
                </button>
              )}
            </div>

            {/* 📸 ビジュアルカードグリッド一覧 */}
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2 max-h-48 overflow-y-auto p-2 bg-black/40 rounded-xl border border-white/10 dark-scrollbar relative z-10">
              
              {/* カード0: キャスト指定なし (AIおまかせ) */}
              <button
                type="button"
                onClick={() => setSelectedCastId('none')}
                className={`p-2 rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer relative group/card border ${
                  selectedCastId === 'none'
                    ? 'border-purple-400 bg-purple-600/30 shadow-[0_0_12px_rgba(168,85,247,0.4)] ring-2 ring-purple-400'
                    : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
                }`}
                style={{ minHeight: '92px' }}
              >
                <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/20 flex items-center justify-center text-purple-300 mb-1 group-hover/card:scale-105 transition-transform">
                  <span className="material-symbols-outlined text-[20px]">casino</span>
                </div>
                <span className="text-[10px] font-bold text-white leading-tight">AIおまかせ</span>
                <span className="text-[8px] text-white/40 mt-0.5">指定なし</span>
                {selectedCastId === 'none' && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center shadow">
                    <span className="material-symbols-outlined text-[10px] font-black">check</span>
                  </div>
                )}
              </button>

              {/* キャラクターカード一覧 */}
              {filteredCharacters.map((char) => {
                const isSelected = selectedCastId === char.id;
                const thumb = getCharacterThumbnail(char);
                return (
                  <button
                    key={char.id}
                    type="button"
                    onClick={() => setSelectedCastId(char.id)}
                    className={`p-1.5 rounded-xl flex flex-col items-center text-center transition-all cursor-pointer relative group/card border ${
                      isSelected
                        ? 'border-amber-400 bg-amber-500/20 shadow-[0_0_14px_rgba(245,158,11,0.5)] ring-2 ring-amber-400'
                        : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                    }`}
                    style={{ minHeight: '92px' }}
                  >
                    {/* サムネイル画像 */}
                    <div className="w-11 h-11 rounded-lg overflow-hidden border border-white/20 mb-1 relative shrink-0 group-hover/card:scale-105 transition-transform">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={char.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-indigo-900 to-purple-900 flex items-center justify-center text-xs font-bold text-white">
                          {char.name.slice(0, 2)}
                        </div>
                      )}
                      {char.role === 'protagonist' && (
                        <div className="absolute top-0.5 left-0.5 bg-black/80 rounded px-1 text-[8px] text-amber-400 font-bold flex items-center shadow">
                          👑
                        </div>
                      )}
                    </div>

                    {/* 名前 */}
                    <span className="text-[10px] font-bold text-white truncate w-full px-1 leading-tight">
                      {char.name}
                    </span>

                    {/* ロールバッジ */}
                    <span className="text-[8px] text-white/50 capitalize truncate mt-0.5">
                      {char.role}
                    </span>

                    {/* チェックマーク */}
                    {isSelected && (
                      <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-400 text-black flex items-center justify-center shadow font-black">
                        <span className="material-symbols-outlined text-[10px] font-black">check</span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {filteredCharacters.length === 0 && (
              <div className="text-center py-3 text-xs text-white/40">
                該当するキャストが見つかりません（検索・ロール条件を変えてみてください）
              </div>
            )}
          </div>

          {/* 🎨 サムネイル配色テーマ (Cover Theme Variant) */}
          <div className="flex flex-col gap-2 p-4 bg-white/5 rounded-xl border border-white/10 shadow-sm relative overflow-hidden group">
            <div className="flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-purple-400">palette</span>
                <span className="text-sm font-bold text-white">🎨 サムネイル配色テーマ設定</span>
              </div>
              <span className="text-[10px] text-purple-300/90 font-mono bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30 font-bold">
                1セッション内全曲統一
              </span>
            </div>
            <p className="text-[10px] text-white/50 relative z-10">
              今回のインポートで生成される全12カットMVの扉絵（9:16・16:9）の看板カラー・アクセントを決定します。次回実行時は自動で上品に変奏されます。
            </p>

            <div className="relative z-10 mt-1">
              <select
                value={selectedCoverThemeId}
                onChange={(e) => setSelectedCoverThemeId(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-black/60 border border-purple-500/30 text-xs font-bold text-white outline-none focus:border-purple-400 hover:border-purple-500/50 appearance-none transition-colors cursor-pointer shadow-inner"
                style={{ paddingRight: '2rem' }}
              >
                <option value="auto">
                  🎲 自動セレクト（今回の選定: {autoTheme.name}）
                </option>
                {getCoverPalettesForGenre('mv').map(p => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.name}
                  </option>
                ))}
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-purple-400 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">expand_more</span>
              </div>
            </div>

            {/* カラープレビューストリップ */}
            {(() => {
              const currentP = selectedCoverThemeId === 'auto' ? autoTheme : (COVER_PALETTES[selectedCoverThemeId] || autoTheme);
              return (
                <div className="flex items-center gap-2.5 mt-1.5 p-2 bg-black/40 rounded-lg border border-white/5 relative z-10 shadow-sm">
                  <div 
                    className="w-16 h-5 rounded border border-white/20 shadow-inner shrink-0"
                    style={{
                      background: `linear-gradient(to right, ${currentP.borderColors[0]}, ${currentP.borderColors[1]}, ${currentP.borderColors[2]})`
                    }}
                  />
                  <div className="flex-1 flex items-center justify-between text-[10px]">
                    <span className="font-bold text-white/90">{currentP.name}</span>
                    <span 
                      className="px-2 py-0.5 rounded font-mono font-bold text-[9px] border"
                      style={{ 
                        color: currentP.badgeColor,
                        borderColor: `${currentP.badgeColor}40`,
                        backgroundColor: `${currentP.badgeColor}15`
                      }}
                    >
                      {currentP.badgeColor}
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
          
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
