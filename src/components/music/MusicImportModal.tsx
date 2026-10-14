import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ImportedTrack, parseMusicTracksJson, convertTrackToEpisode } from '../../services/musicImporter';
import { Episode, CastCharacter } from '../../types';
import { loadMangaProject } from '../../services/castStorage';
import { COVER_PALETTES, getCoverPalettesForGenre, CoverPalette } from '../../services/export/coverRenderer';
import { TASTE_GALLERY_DATA, TasteGalleryItem } from '../../config/tasteGalleryData';
import { 
  CHARACTER_ARCHETYPES, 
  ARCHETYPE_CATEGORY_METAS, 
  CharacterArchetype, 
  ArchetypeCategory 
} from '../../config/characterArchetypes';

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
  const [isDragging, setIsDragging] = useState(false);
  const [isBoxDragging, setIsBoxDragging] = useState(false);
  const [failedCovers, setFailedCovers] = useState<Record<string, boolean>>({});
  const [castCharacters, setCastCharacters] = useState<CastCharacter[]>([]);
  const [selectedCastId, setSelectedCastId] = useState<string>('arch_kemomimi_jk');
  
  // 🎭 人物様態 (Archetypes 100選) & キャスト管理State
  const [castSourceTab, setCastSourceTab] = useState<'archetypes' | 'registered'>('archetypes');
  const [archetypeCategory, setArchetypeCategory] = useState<ArchetypeCategory>('all');
  const [archetypeSearchQuery, setArchetypeSearchQuery] = useState<string>('');
  const [viewingArchetype, setViewingArchetype] = useState<CharacterArchetype | null>(null);

  // 👤 登録キャスト用State
  const [castSearchQuery, setCastSearchQuery] = useState<string>('');
  const [castRoleFilter, setCastRoleFilter] = useState<'all' | 'protagonist' | 'partner' | 'antagonist' | 'supporting'>('all');
  
  // 🎨 画風モデル設定State (代表サムネ1枚 ➜ クリックで3パターン展開)
  const [selectedTasteKey, setSelectedTasteKey] = useState<string>('🌙 ノスタルジック魔女ファンタジー・極細線画 (Retro Fantasy Whisper-Line)');
  const [expandedTasteId, setExpandedTasteId] = useState<string | null>(null);
  const [tasteSearchQuery, setTasteSearchQuery] = useState<string>('');
  const [tasteCategoryFilter, setTasteCategoryFilter] = useState<'all' | 'anime' | 'japanese' | 'cinematic' | 'art'>('all');
  const [tasteZoomImage, setTasteZoomImage] = useState<{ url: string; title: string } | null>(null);

  const [selectedCoverThemeId, setSelectedCoverThemeId] = useState<string>('auto');
  const [autoTheme, setAutoTheme] = useState<CoverPalette>(COVER_PALETTES.mv_violet);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const boxDragCounterRef = useRef(0);
  const lastProcessedTimeRef = useRef(0);

  // キャスト画像取得ヘルパー（アバター優先、三面図、表情のフォールバック。URLとbase64両対応）
  const getCharacterThumbnail = (char: CastCharacter): string | undefined => {
    const raw = char.avatarBase64 || char.turnaroundBase64 || char.expressions?.neutral?.imageBase64;
    if (!raw) return undefined;
    if (raw.startsWith('http://') || raw.startsWith('https://') || raw.startsWith('data:') || raw.startsWith('/')) {
      return raw;
    }
    return `data:image/png;base64,${raw}`;
  };

  // フィルタリング済みキャスト一覧（登録キャラクター）
  const filteredCharacters = castCharacters.filter((char) => {
    const matchesRole = castRoleFilter === 'all' || char.role === castRoleFilter;
    const matchesSearch = !castSearchQuery.trim() || 
      char.name.toLowerCase().includes(castSearchQuery.toLowerCase()) ||
      (char.dnaPromptEn && char.dnaPromptEn.toLowerCase().includes(castSearchQuery.toLowerCase()));
    return matchesRole && matchesSearch;
  });

  // フィルタリング済み様態マスター一覧（Archetypes 100選）
  const filteredArchetypes = CHARACTER_ARCHETYPES.filter((arch) => {
    const matchesCategory = archetypeCategory === 'all' || arch.category === archetypeCategory;
    const q = archetypeSearchQuery.trim().toLowerCase();
    const matchesSearch = !q ||
      arch.name.toLowerCase().includes(q) ||
      arch.summaryJa.toLowerCase().includes(q) ||
      arch.dnaPromptEn.toLowerCase().includes(q) ||
      arch.tags.some(t => t.toLowerCase().includes(q));
    return matchesCategory && matchesSearch;
  });

  // 選択中の様態 or 登録キャラクターの解決
  const selectedArchetype = CHARACTER_ARCHETYPES.find(a => a.id === selectedCastId);
  const selectedRegisteredChar = castCharacters.find(c => c.id === selectedCastId);

  const resolveSelectedCharacter = useCallback((): CastCharacter | undefined => {
    if (selectedCastId === 'none') return undefined;
    if (selectedArchetype) {
      return {
        id: selectedArchetype.id,
        name: selectedArchetype.name,
        role: 'protagonist',
        dnaPromptEn: selectedArchetype.dnaPromptEn,
      };
    }
    return selectedRegisteredChar;
  }, [selectedCastId, selectedArchetype, selectedRegisteredChar]);

  const selectedCharacter = resolveSelectedCharacter();

  // フィルタリング済み画風モデル一覧
  const filteredTastes = TASTE_GALLERY_DATA.filter(item => {
    const matchesCategory = tasteCategoryFilter === 'all' || item.category === tasteCategoryFilter;
    const matchesSearch = !tasteSearchQuery.trim() || 
      item.displayName.toLowerCase().includes(tasteSearchQuery.toLowerCase()) ||
      item.tasteKey.toLowerCase().includes(tasteSearchQuery.toLowerCase()) ||
      item.descriptionJp.toLowerCase().includes(tasteSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const selectedTasteItem = TASTE_GALLERY_DATA.find(t => t.tasteKey === selectedTasteKey);
  const expandedTasteItem = expandedTasteId ? TASTE_GALLERY_DATA.find(t => t.id === expandedTasteId) : null;

  // モーダルオープン時にキャスト一覧を読み込み、狐耳ケモミミ女子高生（またはコハル）をデフォルト選択
  // 同時に今回のセッション用のカバー配色バリエーションを自動選定（同一セッション内全曲統一）
  useEffect(() => {
    if (isOpen) {
      const project = loadMangaProject();
      const chars = project.characters || [];
      setCastCharacters(chars);
      // デフォルトは様態マスターの「狐耳ケモミミ女子高生」
      if (!selectedCastId || selectedCastId === 'none') {
        setSelectedCastId('arch_kemomimi_jk');
      }

      // セッションごとに自動で異なる配色バリエーションを1つ選定（前回の固定マンネリを防止）
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

  // injectedPayload, initialJsonText または initialFile が外部（全画面D&D等）から渡された場合に即時パース
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
      // 生テキストエリアに直接フォーカスしている場合はネイティブペーストに任せる
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

    // ブラウザが誤ってファイルを別タブで開いてしまうのを防止
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
      const charToInject = resolveSelectedCharacter();
      const effectiveTheme = selectedCoverThemeId === 'auto' ? autoTheme.id : selectedCoverThemeId;
      const episode = convertTrackToEpisode(track, videoRatio, charToInject, effectiveTheme, selectedTasteKey);
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
      const episodes = parsedTracks.map(t => convertTrackToEpisode(t, videoRatio, charToInject, effectiveTheme, selectedTasteKey));
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
          
          {/* 🎭 主演キャスト様態設定 (Protagonist Cast Archetypes & Cast Selection) */}
          <div className="flex flex-col gap-3 p-4 bg-white/5 rounded-xl border border-white/10 shadow-sm relative shrink-0 group">
            {/* Background glowing effect */}
            <div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
              <div className="absolute -inset-x-20 -inset-y-10 bg-gradient-to-r from-purple-500/0 via-amber-500/5 to-purple-500/0 opacity-0 group-hover:opacity-100 transition-opacity blur-xl"></div>
            </div>

            {/* Header + Tabs + Search/Filter Controls */}
            <div className="flex flex-wrap items-center justify-between gap-2.5 relative z-10 shrink-0">
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <span className="material-symbols-outlined text-[20px] text-amber-400">theater_comedy</span>
                <span className="text-sm font-bold text-white flex items-center gap-1.5">
                  🎭 主演キャスト様態設定
                </span>

                {/* タブ切り替え: 様態マスター 100選 vs 登録キャスト */}
                <div className="flex items-center bg-black/60 p-0.5 rounded-lg border border-white/15 text-[11px] ml-1 sm:ml-2">
                  <button
                    type="button"
                    onClick={() => setCastSourceTab('archetypes')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      castSourceTab === 'archetypes'
                        ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-black font-black shadow-md'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <span>🎭 様態マスター (100選)</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-black/30 text-amber-100 font-bold">
                      100
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setCastSourceTab('registered')}
                    className={`px-3 py-1 rounded-md transition-all cursor-pointer flex items-center gap-1.5 ${
                      castSourceTab === 'registered'
                        ? 'bg-purple-600 text-white font-black shadow-md'
                        : 'text-white/70 hover:text-white'
                    }`}
                  >
                    <span>👤 登録キャスト</span>
                    <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-bold">
                      {castCharacters.length}
                    </span>
                  </button>
                </div>

                {onOpenCastModal && (
                  <button
                    type="button"
                    onClick={onOpenCastModal}
                    className="px-2.5 py-1 text-xs font-bold text-amber-300 hover:text-white bg-amber-500/15 hover:bg-amber-500/25 rounded-lg transition-colors border border-amber-500/30 flex items-center gap-1 cursor-pointer shadow-sm shrink-0"
                    title="登場人物キャスト台帳を開いて新キャラクターを作成・編集"
                  >
                    <span className="material-symbols-outlined text-[14px]">edit_square</span>
                    <span className="text-[11px]">台帳編集</span>
                  </button>
                )}
              </div>

              {/* フィルター＆検索（タブに応じて切り替え） */}
              {castSourceTab === 'archetypes' ? (
                <div className="flex items-center gap-2">
                  {/* 検索窓 */}
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[14px] text-white/40">search</span>
                    <input
                      type="text"
                      value={archetypeSearchQuery}
                      onChange={(e) => setArchetypeSearchQuery(e.target.value)}
                      placeholder="様態・タグで検索 (100種)..."
                      className="w-36 sm:w-48 pl-6 pr-6 py-1 rounded-lg bg-black/60 border border-white/15 text-[11px] text-white outline-none focus:border-amber-400 placeholder-white/30"
                    />
                    {archetypeSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setArchetypeSearchQuery('')}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
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
              )}
            </div>

            {/* カテゴリ別ピルフィルター (様態マスター選択時のみ表示) */}
            {castSourceTab === 'archetypes' && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5 no-scrollbar relative z-10 text-[11px]">
                <button
                  type="button"
                  onClick={() => setArchetypeCategory('all')}
                  className={`px-2.5 py-0.5 rounded-full shrink-0 transition-colors cursor-pointer border font-bold ${
                    archetypeCategory === 'all'
                      ? 'bg-amber-400 text-black border-amber-300 shadow-sm'
                      : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  すべて ({CHARACTER_ARCHETYPES.length})
                </button>
                {(Object.keys(ARCHETYPE_CATEGORY_METAS) as Array<Exclude<ArchetypeCategory, 'all'>>).map((catKey) => {
                  const meta = ARCHETYPE_CATEGORY_METAS[catKey];
                  const count = CHARACTER_ARCHETYPES.filter(a => a.category === catKey).length;
                  const isSelected = archetypeCategory === catKey;
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setArchetypeCategory(catKey)}
                      className={`px-2.5 py-0.5 rounded-full shrink-0 transition-colors cursor-pointer border flex items-center gap-1 font-bold ${
                        isSelected
                          ? 'bg-gradient-to-r from-amber-400 to-orange-400 text-black border-amber-300 shadow-sm'
                          : 'bg-white/5 text-white/70 border-white/10 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[13px]">{meta.icon}</span>
                      <span>{meta.label}</span>
                      <span className={`text-[9px] px-1 rounded-full ${isSelected ? 'bg-black/20 text-black' : 'bg-white/10 text-white/60'}`}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <p className="text-[10px] text-white/50 relative z-10 -mt-1">
              {castSourceTab === 'archetypes'
                ? '普遍的な人物様態（100選）から選定します。各様態の右上の「🔍」をクリックするとペルソナ詳細・DNAプロンプトを大きく拡大表示できます。'
                : 'MVの主人公として展開するキャストを選択してください。指定したキャストのDNA（三面図・プロンプト・表情）が全12カットに自動注入されます。'}
            </p>

            {/* 選択中キャストのハイライトカード */}
            <div className="p-2.5 bg-black/60 rounded-xl border border-amber-500/30 flex items-center justify-between gap-3 relative z-10 shadow-inner">
              <div className="flex items-center gap-3 min-w-0">
                {selectedArchetype ? (
                  <>
                    <div className="relative shrink-0">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/20 to-purple-600/30 border-2 border-amber-400/80 flex items-center justify-center text-2xl shadow-[0_0_12px_rgba(245,158,11,0.4)]">
                        {selectedArchetype.icon}
                      </div>
                      <span className="absolute -bottom-1 -right-1 text-[8px] px-1 py-0.2 rounded bg-amber-500 text-black font-black uppercase shadow">
                        様態
                      </span>
                    </div>
                    <div className="min-w-0 flex flex-col">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-white">{selectedArchetype.name}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold shrink-0">
                          {ARCHETYPE_CATEGORY_METAS[selectedArchetype.category]?.label}
                        </span>
                        {selectedArchetype.tags.slice(0, 2).map((t, idx) => (
                          <span key={idx} className="text-[9px] text-white/50 hidden sm:inline">
                            {t}
                          </span>
                        ))}
                      </div>
                      <p className="text-[10px] text-white/70 line-clamp-1 mt-0.5">
                        {selectedArchetype.summaryJa}
                      </p>
                      <p className="text-[9px] text-purple-300/80 font-mono truncate max-w-lg mt-0.2">
                        DNA: {selectedArchetype.dnaPromptEn}
                      </p>
                    </div>
                  </>
                ) : selectedRegisteredChar ? (
                  <>
                    <div className="relative shrink-0">
                      {getCharacterThumbnail(selectedRegisteredChar) ? (
                        <img
                          src={getCharacterThumbnail(selectedRegisteredChar)}
                          alt={selectedRegisteredChar.name}
                          className="w-12 h-12 rounded-lg border-2 border-purple-400/80 object-cover shadow-[0_0_10px_rgba(168,85,247,0.4)]"
                        />
                      ) : (
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-purple-800 to-indigo-950 flex items-center justify-center border-2 border-purple-400/50 shadow-inner">
                          <span className="text-sm font-black text-white">{selectedRegisteredChar.name.slice(0, 2)}</span>
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 text-[8px] px-1 py-0.2 rounded bg-purple-500 text-white font-black uppercase shadow">
                        {selectedRegisteredChar.role === 'protagonist' ? '主演' : selectedRegisteredChar.role}
                      </span>
                    </div>
                    <div className="min-w-0 flex flex-col">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-black text-white truncate">{selectedRegisteredChar.name}</span>
                        {selectedRegisteredChar.turnaroundBase64 && (
                          <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold shrink-0">
                            三面図DNA完備
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-white/60 font-mono truncate max-w-md mt-0.5">
                        {selectedRegisteredChar.dnaPromptEn || 'No DNA prompt'}
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

              <div className="flex items-center gap-1.5 shrink-0">
                {selectedArchetype && (
                  <button
                    type="button"
                    onClick={() => setViewingArchetype(selectedArchetype)}
                    className="px-2.5 py-1 text-[10px] font-bold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 rounded-lg transition-colors border border-amber-500/40 flex items-center gap-1 cursor-pointer shadow-sm"
                    title="この様態のペルソナ詳細とDNAプロンプトを拡大表示"
                  >
                    <span className="material-symbols-outlined text-[13px]">zoom_in</span>
                    <span>拡大詳細</span>
                  </button>
                )}

                {selectedCastId !== 'none' && (
                  <button
                    type="button"
                    onClick={() => setSelectedCastId('none')}
                    className="px-2 py-1 text-[10px] font-bold text-white/70 hover:text-white bg-white/10 hover:bg-white/20 rounded-lg transition-colors border border-white/15 shrink-0 flex items-center gap-1 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[12px]">restart_alt</span>
                    おまかせ
                  </button>
                )}
              </div>
            </div>

            {/* 📸 カードグリッド一覧（タブに応じて様態100選 または 登録キャストを表示） */}
            {castSourceTab === 'archetypes' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 max-h-48 sm:max-h-56 overflow-y-auto p-2 bg-black/40 rounded-xl border border-white/10 dark-scrollbar relative z-10">
                
                {/* カード0: キャスト指定なし (AIおまかせ) */}
                <button
                  type="button"
                  onClick={() => setSelectedCastId('none')}
                  className={`p-2 rounded-xl flex flex-col items-center justify-center text-center transition-all cursor-pointer relative group/card border ${
                    selectedCastId === 'none'
                      ? 'border-purple-400 bg-purple-600/30 shadow-[0_0_12px_rgba(168,85,247,0.4)] ring-2 ring-purple-400'
                      : 'border-white/10 bg-white/5 hover:border-white/25 hover:bg-white/10'
                  }`}
                  style={{ minHeight: '96px' }}
                >
                  <div className="w-9 h-9 rounded-full bg-slate-800 border border-white/20 flex items-center justify-center text-purple-300 mb-1 group-hover/card:scale-105 transition-transform">
                    <span className="material-symbols-outlined text-[18px]">casino</span>
                  </div>
                  <span className="text-[11px] font-bold text-white leading-tight">AIおまかせ</span>
                  <span className="text-[8px] text-white/40 mt-0.5">指定なし</span>
                  {selectedCastId === 'none' && (
                    <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-purple-500 text-white flex items-center justify-center shadow">
                      <span className="material-symbols-outlined text-[10px] font-black">check</span>
                    </div>
                  )}
                </button>

                {/* 100選様態カード一覧 */}
                {filteredArchetypes.map((arch) => {
                  const isSelected = selectedCastId === arch.id;
                  return (
                    <div
                      key={arch.id}
                      onClick={() => setSelectedCastId(arch.id)}
                      className={`p-2 rounded-xl flex flex-col justify-between text-left transition-all cursor-pointer relative group/card border select-none ${
                        isSelected
                          ? 'border-amber-400 bg-amber-500/20 shadow-[0_0_14px_rgba(245,158,11,0.5)] ring-2 ring-amber-400'
                          : 'border-white/10 bg-white/5 hover:border-white/30 hover:bg-white/10'
                      }`}
                      style={{ minHeight: '96px' }}
                    >
                      {/* 上部: アイコン + 拡大ボタン + チェックマーク */}
                      <div className="flex items-center justify-between gap-1 w-full">
                        <span className="text-xl shrink-0 group-hover/card:scale-110 transition-transform">
                          {arch.icon}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingArchetype(arch);
                            }}
                            className="w-5 h-5 rounded bg-white/10 hover:bg-white/30 text-white/80 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                            title="クリックで拡大・詳細表示"
                          >
                            <span className="material-symbols-outlined text-[13px]">zoom_in</span>
                          </button>
                          {isSelected && (
                            <div className="w-4 h-4 rounded-full bg-amber-400 text-black flex items-center justify-center shadow font-black shrink-0">
                              <span className="material-symbols-outlined text-[10px] font-black">check</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 中央: 様態名 */}
                      <div className="my-1">
                        <div className="text-[11px] font-black text-white leading-tight line-clamp-1 group-hover/card:text-amber-300 transition-colors">
                          {arch.name}
                        </div>
                      </div>

                      {/* 下部: 代表タグ */}
                      <div className="flex flex-wrap gap-1 mt-auto">
                        {arch.tags.slice(0, 2).map((t, idx) => (
                          <span key={idx} className="text-[8px] px-1 py-0.2 rounded bg-black/40 text-white/60 border border-white/5 truncate max-w-[76px]">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* 従来の登録キャストグリッド */
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 gap-2 max-h-48 sm:max-h-56 overflow-y-auto p-2 bg-black/40 rounded-xl border border-white/10 dark-scrollbar relative z-10">
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
                          ? 'border-purple-400 bg-purple-500/20 shadow-[0_0_14px_rgba(168,85,247,0.5)] ring-2 ring-purple-400'
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
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-purple-400 text-black flex items-center justify-center shadow font-black">
                          <span className="material-symbols-outlined text-[10px] font-black">check</span>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}

            {castSourceTab === 'archetypes' && filteredArchetypes.length === 0 && (
              <div className="text-center py-3 text-xs text-white/40">
                該当する様態が見つかりません（検索条件を変えてみてください）
              </div>
            )}

            {castSourceTab === 'registered' && filteredCharacters.length === 0 && (
              <div className="text-center py-3 text-xs text-white/40">
                該当するキャストが見つかりません（検索・ロール条件を変えてみてください）
              </div>
            )}
          </div>

          {/* 🎨 MV画風スタイル設定 (Taste Style Showroom) */}
          <div className="flex flex-col gap-3 p-4 bg-white/5 rounded-xl border border-white/10 shadow-sm relative shrink-0">
            {/* タイトル ＆ 現在選択中のスタイル表示 */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px] text-teal-400">brush</span>
                <span className="text-sm font-bold text-white">🎨 MV画風スタイル（全12カット適用）</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-teal-300 font-mono bg-teal-500/20 px-2.5 py-0.5 rounded-full border border-teal-500/30 font-bold truncate max-w-xs">
                  選択中: {selectedTasteItem?.displayName || selectedTasteKey}
                </span>
              </div>
            </div>

            <p className="text-[10px] text-white/50">
              カードをクリックすると、3つの比較シチュエーション（学生・江戸町人・社会人）が展開されます。作例を見比べながら直感的に選べます。
            </p>

            {/* フィルター＆検索ツールバー */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 pb-0.5">
              {/* カテゴリタブ */}
              <div className="flex items-center gap-1 bg-black/40 p-1 rounded-lg border border-white/5 text-[11px]">
                {[
                  { id: 'all', label: 'すべて' },
                  { id: 'anime', label: 'アニメ' },
                  { id: 'japanese', label: '和風・歴史' },
                  { id: 'cinematic', label: 'シネマ' },
                  { id: 'art', label: 'アート' },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTasteCategoryFilter(tab.id as any)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer ${
                      tasteCategoryFilter === tab.id
                        ? 'bg-teal-500 text-white shadow-sm'
                        : 'text-white/60 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* 検索ボックス */}
              <div className="relative">
                <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px] text-white/40">search</span>
                <input
                  type="text"
                  value={tasteSearchQuery}
                  onChange={(e) => setTasteSearchQuery(e.target.value)}
                  placeholder="画風・キーワード検索..."
                  className="w-40 sm:w-48 pl-7 pr-7 py-1.5 rounded-lg bg-black/50 border border-white/10 text-xs text-white placeholder-white/30 outline-none focus:border-teal-400"
                />
                {tasteSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setTasteSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">close</span>
                  </button>
                )}
              </div>
            </div>

            {/* 🌟 展開された3パターン比較ビュー (Expanded 3-Pattern Showcase) */}
            {expandedTasteItem && (
              <div className="mt-1 p-3.5 rounded-xl bg-gradient-to-b from-teal-950/40 via-slate-900/90 to-black/80 border-2 border-teal-500/50 shadow-lg shadow-teal-950/30 flex flex-col gap-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-teal-500/20 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-black bg-teal-500 text-black">
                      作例プレビュー展開中
                    </span>
                    <span className="text-xs font-black text-white">{expandedTasteItem.displayName}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTasteKey(expandedTasteItem.tasteKey)}
                    className={`px-3 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer ${
                      selectedTasteKey === expandedTasteItem.tasteKey
                        ? 'bg-amber-400 text-black shadow-md shadow-amber-400/30'
                        : 'bg-teal-600 hover:bg-teal-500 text-white'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[15px]">
                      {selectedTasteKey === expandedTasteItem.tasteKey ? 'check_circle' : 'palette'}
                    </span>
                    <span>
                      {selectedTasteKey === expandedTasteItem.tasteKey ? 'この画風を選択中' : 'この画風をMVに適用する'}
                    </span>
                  </button>
                </div>

                <p className="text-[11px] text-teal-100/70 leading-relaxed">
                  {expandedTasteItem.descriptionJp}
                </p>

                {/* 3パターン画像グリッド */}
                {expandedTasteItem.samples ? (
                  <div className="grid grid-cols-3 gap-2.5 pt-1">
                    {[
                      { key: 'students', label: '🎓 学生ペア', sub: '女子高生 ＆ 男子高生', url: expandedTasteItem.samples.students },
                      { key: 'edo', label: '🏮 江戸町人', sub: '町人男女（和装・浮世）', url: expandedTasteItem.samples.edo },
                      { key: 'adult', label: '💼 社会人・家庭', sub: 'サラリーマン ＆ 主婦', url: expandedTasteItem.samples.adult }
                    ].map(pattern => (
                      <div 
                        key={pattern.key}
                        onClick={() => pattern.url && setTasteZoomImage({ url: pattern.url, title: `${expandedTasteItem.displayName} - ${pattern.label}` })}
                        className="flex flex-col gap-1 group/img cursor-zoom-in relative bg-black/60 rounded-lg p-1.5 border border-white/10 hover:border-teal-400 transition-all shadow-inner"
                      >
                        <div className="relative w-full aspect-[4/3] rounded overflow-hidden bg-black/80">
                          {pattern.url ? (
                            <img 
                              src={pattern.url} 
                              alt={pattern.label}
                              className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-white/30 text-xs">
                              準備中
                            </div>
                          )}
                          <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/20 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                            <span className="p-1 rounded-full bg-black/70 text-white material-symbols-outlined text-[16px]">
                              zoom_in
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col px-0.5">
                          <span className="text-[10px] font-bold text-white group-hover/img:text-teal-300 transition-colors">
                            {pattern.label}
                          </span>
                          <span className="text-[9px] text-white/40 truncate">
                            {pattern.sub}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 px-4 rounded-lg bg-black/40 border border-dashed border-white/15 text-center flex flex-col items-center justify-center gap-1.5">
                    <span className="material-symbols-outlined text-teal-400/60 text-[28px]">auto_awesome</span>
                    <span className="text-xs font-bold text-white/80">このスタイルの作例画像は追加準備中です</span>
                    <span className="text-[10px] text-white/40 max-w-md">
                      プロンプトエンジンには完全登録されています。「この画風をMVに適用する」を押すことで、全12カットのMV自動生成に本画風プロンプトが反映されます。
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* 🎨 画風一覧グリッド（1サムネ表示カード） */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 max-h-[300px] overflow-y-auto pr-1 dark-scrollbar">
              {filteredTastes.map((item) => {
                const isSelected = selectedTasteKey === item.tasteKey;
                const isExpanded = expandedTasteId === item.id;
                const thumbUrl = item.samples?.students || item.samples?.adult;
                const hasSamples = Boolean(item.samples?.students);

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedTasteKey(item.tasteKey);
                      setExpandedTasteId(item.id);
                    }}
                    className={`flex flex-col rounded-xl overflow-hidden text-left transition-all border p-2 relative group cursor-pointer ${
                      isSelected
                        ? 'bg-teal-950/70 border-amber-400 ring-2 ring-amber-400/50 shadow-lg shadow-amber-400/10'
                        : isExpanded
                        ? 'bg-teal-950/40 border-teal-500/80 shadow'
                        : 'bg-black/50 hover:bg-black/70 border-white/10 hover:border-white/30'
                    }`}
                    style={{ minHeight: '150px' }}
                  >
                    {/* サムネイル画像（1枚表示） */}
                    <div 
                      className="relative w-full aspect-[4/3] min-h-[96px] sm:min-h-[105px] rounded-lg overflow-hidden bg-slate-900 mb-2 border border-white/10 shrink-0 shadow-inner group-hover:border-teal-400/50 transition-all"
                      style={{ aspectRatio: '4/3', minHeight: '96px' }}
                    >
                      {thumbUrl ? (
                        <img
                          src={thumbUrl}
                          alt={item.displayName}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 block"
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          loading="lazy"
                        />
                      ) : (
                        <div 
                          className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-indigo-950/60 p-2 text-center"
                          style={{ minHeight: '96px' }}
                        >
                          <span className="material-symbols-outlined text-white/30 text-[24px]">palette</span>
                          <span className="text-[9px] text-white/40 mt-1 font-mono">{item.category}</span>
                        </div>
                      )}

                      {/* バッジ: 3作例あり */}
                      {hasSamples && (
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[8px] font-black bg-teal-500/90 text-black shadow backdrop-blur-xs flex items-center gap-0.5 z-10">
                          <span>✨ 3作例</span>
                        </span>
                      )}

                      {/* 選択チェックマーク */}
                      {isSelected && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-amber-400 text-black flex items-center justify-center shadow font-black z-10">
                          <span className="material-symbols-outlined text-[10px] font-black">check</span>
                        </div>
                      )}

                      {/* ホバーヒント */}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-10">
                        <span className="text-[9px] font-bold text-white px-2 py-0.5 rounded-full bg-black/70 border border-white/20">
                          クリックで3作例展開
                        </span>
                      </div>
                    </div>

                    {/* タイトル・説明 */}
                    <div className="flex flex-col">
                      <span className={`text-[11px] font-black line-clamp-1 ${isSelected ? 'text-amber-300' : 'text-white'}`}>
                        {item.displayName}
                      </span>
                      <span className="text-[9px] text-white/40 line-clamp-1 mt-0.5">
                        {item.descriptionJp}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredTastes.length === 0 && (
              <div className="text-center py-4 text-xs text-white/40">
                該当する画風が見つかりません（検索条件を変えてみてください）
              </div>
            )}
          </div>

          {/* 🎨 サムネイル配色テーマ (Cover Theme Variant) */}
          <div className="flex flex-col gap-2 p-4 bg-white/5 rounded-xl border border-white/10 shadow-sm relative shrink-0 group">
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
          
          {/* Drop & Input Area (点線ドロップ枠: 鉄壁D&Dシールド＆直接イベント方式) */}
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
              console.log('🎯 [MusicImporter Drop検知! 即時パース開始]', file?.name, file?.size);
              if (file) {
                processFile(file);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-5 transition-all duration-200 text-center flex flex-col items-center justify-center gap-3 shrink-0 select-none cursor-pointer group/dropzone relative overflow-hidden ${
              isBoxDragging 
                ? 'border-amber-400 bg-amber-500/25 ring-4 ring-amber-400/50 scale-[1.01] shadow-[0_0_35px_rgba(245,158,11,0.5)]' 
                : 'border-white/20 bg-white/5 hover:border-amber-400/60 hover:bg-white/10 shadow-sm'
            }`}
          >
            {/* ドラッグ中に子要素によるイベント遮断を完全にシャットアウトする最前面シールド */}
            {isBoxDragging && (
              <div className="absolute inset-0 z-30 bg-amber-500/10 pointer-events-none" />
            )}

            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={(e) => {
                const f = e.target.files?.[0];
                console.log('📁 [MusicImporter ファイル選択]', f?.name);
                if (f) processFile(f);
                if (e.target) e.target.value = '';
              }}
              accept=".json,application/json" 
              className="hidden" 
            />

            {/* 表示用コンテンツ */}
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

            {/* アクションボタン（ドラッグ中は pointer-events-none でイベントを透過し、通常時はクリック・直撃ドロップも受領） */}
            <div className={`flex items-center gap-2 mt-1 relative z-20 ${isBoxDragging ? 'pointer-events-none' : ''}`}>
              <button 
                type="button"
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsBoxDragging(true); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; if (!isBoxDragging) setIsBoxDragging(true); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsBoxDragging(false);
                  const f = e.dataTransfer?.files?.[0];
                  if (f) processFile(f);
                }}
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
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsBoxDragging(true); }}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'; if (!isBoxDragging) setIsBoxDragging(true); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsBoxDragging(false);
                  const f = e.dataTransfer?.files?.[0];
                  if (f) processFile(f);
                }}
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
    );

    return (
      <>
        {/* モーダル表示の場合のみ全画面オーバーレイでラップ、アコーディオン時はそのまま直描画 */}
        {isModal ? (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fade-in select-none">
            {cardContent}
          </div>
        ) : (
          cardContent
        )}

        {/* ズームライトボックス (画風サンプル) */}
      {tasteZoomImage && (
        <div 
          onClick={() => setTasteZoomImage(null)}
          className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4 cursor-pointer animate-fade-in"
        >
          <img 
            src={tasteZoomImage.url} 
            alt={tasteZoomImage.title} 
            className="max-w-[90vw] max-h-[85vh] rounded-xl shadow-2xl border-2 border-white/20 object-contain"
          />
          <div className="mt-3 px-4 py-1.5 rounded-full bg-white/10 text-white text-xs font-bold backdrop-blur-md flex items-center gap-2">
            <span>{tasteZoomImage.title}</span>
            <span className="text-[10px] text-white/50">(クリックで閉じる)</span>
          </div>
        </div>
      )}

      {/* 🎭 様態詳細・拡大モーダル (Archetype Detail Modal) */}
      {viewingArchetype && (
        <div 
          className="fixed inset-0 z-[10005] bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setViewingArchetype(null)}
        >
          <div 
            className="bg-[#16161e] border-2 border-amber-400/80 rounded-2xl max-w-xl w-full p-5 sm:p-6 shadow-[0_0_50px_rgba(245,158,11,0.35)] relative overflow-hidden flex flex-col max-h-[90vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* 装飾グラデーション */}
            <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-amber-500 via-orange-500 to-purple-600"></div>

            {/* 閉じるボタン */}
            <button
              type="button"
              onClick={() => setViewingArchetype(null)}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>

            {/* ヘッダー: アイコン + 名前 + カテゴリ */}
            <div className="flex items-center gap-4 mb-4 pr-8">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-purple-600/30 border-2 border-amber-400/60 flex items-center justify-center text-3xl shadow-inner shrink-0">
                {viewingArchetype.icon}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
                    {ARCHETYPE_CATEGORY_METAS[viewingArchetype.category]?.label || viewingArchetype.category}
                  </span>
                  <span className="text-[10px] text-white/40 font-mono">ID: {viewingArchetype.id}</span>
                </div>
                <h3 className="text-xl font-black text-white leading-tight">{viewingArchetype.name}</h3>
              </div>
            </div>

            {/* コンテンツスクロール部 */}
            <div className="flex-1 overflow-y-auto pr-1 dark-scrollbar flex flex-col gap-3.5 my-1">
              {/* タグ一覧 */}
              <div className="flex flex-wrap gap-1.5">
                {viewingArchetype.tags.map((t, idx) => (
                  <span key={idx} className="text-[11px] px-2.5 py-0.5 rounded-md bg-white/10 text-white/90 border border-white/15 font-medium">
                    {t}
                  </span>
                ))}
              </div>

              {/* 日本語サマリー・ペルソナ像 */}
              <div className="p-3.5 bg-black/40 rounded-xl border border-white/10">
                <div className="text-[11px] font-bold text-amber-400 mb-1.5 flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[14px]">psychology</span>
                  人物像・ペルソナ概要（日本語）
                </div>
                <p className="text-xs text-white/85 leading-relaxed">
                  {viewingArchetype.summaryJa}
                </p>
              </div>

              {/* 英語DNAプロンプト */}
              <div className="p-3.5 bg-black/60 rounded-xl border border-purple-500/30">
                <div className="text-[11px] font-bold text-purple-300 mb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[14px]">dna</span>
                    純粋人物DNAプロンプト (全カット注入用)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(viewingArchetype.dnaPromptEn);
                      alert('DNAプロンプトをクリップボードにコピーしました！');
                    }}
                    className="text-[10px] text-purple-300 hover:text-white underline cursor-pointer flex items-center gap-0.5"
                  >
                    <span className="material-symbols-outlined text-[12px]">content_copy</span>
                    コピー
                  </button>
                </div>
                <div className="text-[11px] font-mono text-purple-200/90 leading-relaxed bg-black/40 p-2.5 rounded-lg border border-white/5 break-words select-all max-h-36 overflow-y-auto dark-scrollbar">
                  {viewingArchetype.dnaPromptEn}
                </div>
              </div>

              {/* おすすめの相性画風 */}
              {viewingArchetype.recommendedTastes && viewingArchetype.recommendedTastes.length > 0 && (
                <div className="p-3 bg-white/5 rounded-xl border border-white/10">
                  <div className="text-[10px] font-bold text-white/60 mb-2 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[13px]">palette</span>
                    おすすめの相性画風スタイル
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {viewingArchetype.recommendedTastes.map((tasteName, i) => (
                      <span key={i} className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                        {tasteName}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* アクションフッター */}
            <div className="flex items-center gap-2.5 pt-3 mt-2 border-t border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setSelectedCastId(viewingArchetype.id);
                  setViewingArchetype(null);
                }}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-black font-black text-xs flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                この様態を主演キャストに決定する
              </button>
              <button
                type="button"
                onClick={() => setViewingArchetype(null)}
                className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs transition-colors cursor-pointer border border-white/15"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
