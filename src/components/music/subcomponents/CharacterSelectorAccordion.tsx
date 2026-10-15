import React, { useState } from 'react';
import { CastCharacter } from '../../../types';
import { formatDataUri } from '../../../services/utils';
import {
  CHARACTER_ARCHETYPES,
  ARCHETYPE_CATEGORY_METAS,
  CharacterArchetype,
  ArchetypeCategory
} from '../../../config/characterArchetypes';

export interface CharacterSelectorAccordionProps {
  isCastLockEnabled: boolean;
  onToggleCastLock: (enabled: boolean) => void;
  selectedCastId: string;
  onSelectCastId: (id: string) => void;
  castCharacters: CastCharacter[];
  onOpenCastModal?: () => void;
}

export const CharacterSelectorAccordion: React.FC<CharacterSelectorAccordionProps> = ({
  isCastLockEnabled,
  onToggleCastLock,
  selectedCastId,
  onSelectCastId,
  castCharacters,
  onOpenCastModal,
}) => {
  // 🎭 人物様態 (Archetypes 100選) & キャスト管理State
  const [castSourceTab, setCastSourceTab] = useState<'archetypes' | 'registered'>('archetypes');
  const [archetypeCategory, setArchetypeCategory] = useState<ArchetypeCategory>('all');
  const [archetypeSearchQuery, setArchetypeSearchQuery] = useState<string>('');
  const [viewingArchetype, setViewingArchetype] = useState<CharacterArchetype | null>(null);

  // 👤 登録キャスト用State
  const [castSearchQuery, setCastSearchQuery] = useState<string>('');
  const [castRoleFilter, setCastRoleFilter] = useState<'all' | 'protagonist' | 'partner' | 'antagonist' | 'supporting'>('all');

  // キャスト画像取得ヘルパー（アバター優先、三面図、表情のフォールバック。URLとbase64両対応）
  const getCharacterThumbnail = (char: CastCharacter): string | undefined => {
    const raw = char.avatarBase64 || char.turnaroundBase64 || char.expressions?.neutral?.imageBase64;
    return raw ? (formatDataUri(raw) || undefined) : undefined;
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

  return (
    <>
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
              🎭 主演キャスト設定
            </span>

            {/* ★ キャスト固定 ON / OFF スイッチトグル */}
            <button
              type="button"
              onClick={() => {
                const next = !isCastLockEnabled;
                onToggleCastLock(next);
                if (next && selectedCastId === 'none') {
                  onSelectCastId('arch_kemomimi_jk');
                }
              }}
              className={`px-3 py-1 rounded-full text-xs font-black transition-all border flex items-center gap-1.5 cursor-pointer shadow-md ${
                isCastLockEnabled 
                  ? 'bg-amber-500 text-black border-amber-300 ring-2 ring-amber-400/50' 
                  : 'bg-emerald-600/30 text-emerald-300 border-emerald-400/60 hover:bg-emerald-600/50'
              }`}
              title="クリックでキャスト固定のON/OFFを切り替えます"
            >
              <span className="material-symbols-outlined text-[15px]">
                {isCastLockEnabled ? 'lock' : 'lock_open'}
              </span>
              <span>{isCastLockEnabled ? 'キャスト固定: ON (指定DNAで統一)' : 'キャスト固定: OFF (JSONの情景・世界観最優先)'}</span>
            </button>

            {/* タブ切り替え: 様態マスター 100選 vs 登録キャスト (ON時のみ操作可能) */}
            {isCastLockEnabled && (
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
            )}
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
        {isCastLockEnabled && castSourceTab === 'archetypes' && (
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

        {!isCastLockEnabled ? (
          /* ★ キャスト固定OFFバナー（JSON世界観・情景最優先） */
          <div className="p-3 bg-emerald-950/25 border border-emerald-500/40 rounded-xl flex items-center justify-between gap-3 relative z-10 shadow-sm">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
                <span className="material-symbols-outlined text-[22px]">auto_fix_high</span>
              </div>
              <div className="min-w-0">
                <div className="text-xs font-black text-emerald-200 flex items-center gap-1.5">
                  <span>✨ キャスト固定: OFF (JSONの情景・世界観最優先モード)</span>
                </div>
                <div className="text-[10px] text-white/65 mt-0.5 leading-relaxed">
                  JSONに記述された登場人物・情景（自転車二人乗り、制服、キャップ、夕暮れの土手など）に合わせて、AIがカットごとに生き生きとした構図・ポーズを完全自由に描画します。
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                onToggleCastLock(true);
                if (selectedCastId === 'none') onSelectCastId('arch_kemomimi_jk');
              }}
              className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 text-amber-300 hover:text-white text-[11px] font-bold shrink-0 transition-all cursor-pointer shadow-sm"
            >
              特定のキャラで固定 ➜
            </button>
          </div>
        ) : (
          <>
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
                    onClick={() => onSelectCastId('none')}
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
                  onClick={() => onSelectCastId('none')}
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
                      onClick={() => onSelectCastId(arch.id)}
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
                  onClick={() => onSelectCastId('none')}
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
                      onClick={() => onSelectCastId(char.id)}
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
          </>
        )}
      </div>

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
                  onSelectCastId(viewingArchetype.id);
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
