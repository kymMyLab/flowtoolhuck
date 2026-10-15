import React, { useState } from 'react';
import { TASTE_GALLERY_DATA, TasteGalleryItem } from '../../../config/tasteGalleryData';

export interface TasteShowcaseGridProps {
  selectedTasteKey: string;
  onSelectTasteKey: (tasteKey: string) => void;
}

export const TasteShowcaseGrid: React.FC<TasteShowcaseGridProps> = ({
  selectedTasteKey,
  onSelectTasteKey,
}) => {
  const [expandedTasteId, setExpandedTasteId] = useState<string | null>(null);
  const [tasteSearchQuery, setTasteSearchQuery] = useState<string>('');
  const [tasteCategoryFilter, setTasteCategoryFilter] = useState<'all' | 'anime' | 'japanese' | 'cinematic' | 'art'>('all');
  const [tasteZoomImage, setTasteZoomImage] = useState<{ url: string; title: string } | null>(null);

  // フィルタリング済み画風モデル一覧
  const filteredTastes = TASTE_GALLERY_DATA.filter((item: TasteGalleryItem) => {
    const matchesCategory = tasteCategoryFilter === 'all' || item.category === tasteCategoryFilter;
    const matchesSearch = !tasteSearchQuery.trim() || 
      item.displayName.toLowerCase().includes(tasteSearchQuery.toLowerCase()) ||
      item.tasteKey.toLowerCase().includes(tasteSearchQuery.toLowerCase()) ||
      item.descriptionJp.toLowerCase().includes(tasteSearchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const selectedTasteItem = TASTE_GALLERY_DATA.find((t: TasteGalleryItem) => t.tasteKey === selectedTasteKey);
  const expandedTasteItem = expandedTasteId ? TASTE_GALLERY_DATA.find((t: TasteGalleryItem) => t.id === expandedTasteId) : null;

  return (
    <>
      <div className="flex flex-col gap-3 p-4 bg-white/5 rounded-xl border border-white/10 shadow-sm relative shrink-0">
        {/* タイトル ＆ 現在選択中のスタイル表示 */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-teal-400">brush</span>
            <span className="text-sm font-bold text-white">🎨 MV画風スタイル設定</span>

            {/* ★ JSON最優先（自動）クイックボタン */}
            <button
              type="button"
              onClick={() => onSelectTasteKey('auto')}
              className={`px-2.5 py-0.5 rounded-full text-xs font-black transition-all border flex items-center gap-1 cursor-pointer ${
                selectedTasteKey === 'auto'
                  ? 'bg-gradient-to-r from-teal-400 to-emerald-400 text-black border-teal-300 shadow-md ring-2 ring-teal-400/40'
                  : 'bg-white/10 hover:bg-white/20 text-white/80 border-white/20'
              }`}
              title="クリックでJSON本来の指定画風（または曲の世界観）を最優先にするモードに戻します"
            >
              <span className="material-symbols-outlined text-[13px]">auto_awesome</span>
              <span>✨ JSON最優先 (トラック個別画風)</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-teal-300 font-mono bg-teal-500/20 px-2.5 py-0.5 rounded-full border border-teal-500/30 font-bold truncate max-w-xs">
              {selectedTasteKey === 'auto' ? '✨ JSONの画風を最優先適用' : `強制適用: ${selectedTasteItem?.displayName || selectedTasteKey}`}
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
                onClick={() => onSelectTasteKey(expandedTasteItem.tasteKey)}
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

            {/* 3パターン画像グリッド (大迫力プレビュー) */}
            {expandedTasteItem.samples ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                {[
                  { key: 'students', label: '🎓 学生ペア', sub: '女子高生 ＆ 男子高生', url: expandedTasteItem.samples.students },
                  { key: 'edo', label: '🏮 江戸町人', sub: '町人男女（和装・浮世）', url: expandedTasteItem.samples.edo },
                  { key: 'adult', label: '💼 社会人・家庭', sub: 'サラリーマン ＆ 主婦', url: expandedTasteItem.samples.adult }
                ].map(pattern => (
                  <div 
                    key={pattern.key}
                    onClick={() => pattern.url && setTasteZoomImage({ url: pattern.url, title: `${expandedTasteItem.displayName} - ${pattern.label}` })}
                    className="flex flex-col gap-1.5 group/img cursor-zoom-in relative bg-black/75 hover:bg-teal-950/40 rounded-xl p-2 border-2 border-white/10 hover:border-teal-400 transition-all shadow-xl hover:shadow-teal-500/20"
                  >
                    <div className="relative w-full h-44 sm:h-52 md:h-60 rounded-lg overflow-hidden bg-black/90">
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
                      <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/30 flex items-center justify-center opacity-0 group-hover/img:opacity-100 transition-opacity">
                        <span className="px-3 py-1.5 rounded-full bg-black/85 border border-teal-400/60 text-teal-300 text-xs font-bold flex items-center gap-1.5 shadow-lg backdrop-blur-sm">
                          <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                          特大拡大表示
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between px-1">
                      <span className="text-xs font-black text-white group-hover/img:text-teal-300 transition-colors">
                        {pattern.label}
                      </span>
                      <span className="text-[10px] text-white/50 truncate max-w-[120px]">
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
                  onSelectTasteKey(item.tasteKey);
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

      {/* ズームライトボックス (画風サンプル) */}
      {tasteZoomImage && (
        <div 
          onClick={() => setTasteZoomImage(null)}
          className="fixed inset-0 z-[10010] bg-black/90 flex flex-col items-center justify-center p-4 cursor-pointer animate-fade-in"
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
    </>
  );
};
