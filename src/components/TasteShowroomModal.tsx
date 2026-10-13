import React, { useState } from 'react';
import { TASTE_GALLERY_DATA, TasteSampleCategory, TasteGalleryItem } from '../config/tasteGalleryData';
import { TASTES } from '../constants';

interface TasteShowroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTaste: string;
  onSelectTaste: (tasteKey: string) => void;
}

export const TasteShowroomModal: React.FC<TasteShowroomModalProps> = ({
  isOpen,
  onClose,
  currentTaste,
  onSelectTaste,
}) => {
  const [globalCategory, setGlobalCategory] = useState<TasteSampleCategory>('students');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'anime' | 'japanese' | 'cinematic' | 'art'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cardCategoryOverrides, setCardCategoryOverrides] = useState<Record<string, TasteSampleCategory>>({});
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);

  if (!isOpen) return null;

  // フィルタリング処理
  const filteredItems = TASTE_GALLERY_DATA.filter(item => {
    const matchesCategory = activeCategoryFilter === 'all' || item.category === activeCategoryFilter;
    const matchesSearch = !searchQuery.trim() || 
      item.displayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.tasteKey.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.descriptionJp.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categoryLabels: Record<TasteSampleCategory, { label: string; icon: string; subtitle: string }> = {
    students: { label: '学生ペア', icon: 'school', subtitle: '女子高生 ＆ 男子高生' },
    edo: { label: '江戸町人', icon: 'temple_buddhist', subtitle: '江戸町人（男女）' },
    adult: { label: '社会人・家庭', icon: 'business_center', subtitle: 'サラリーマン ＆ 主婦' },
  };

  const handleCardCategoryChange = (itemId: string, cat: TasteSampleCategory, e: React.MouseEvent) => {
    e.stopPropagation();
    setCardCategoryOverrides(prev => ({ ...prev, [itemId]: cat }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fade-in select-none">
      
      {/* ズームライトボックス */}
      {zoomImage && (
        <div 
          onClick={() => setZoomImage(null)}
          className="fixed inset-0 z-60 bg-black/90 flex flex-col items-center justify-center p-4 cursor-pointer animate-fade-in"
        >
          <img 
            src={zoomImage.url} 
            alt={zoomImage.title} 
            className="max-w-[90vw] max-h-[85vh] rounded-xl shadow-2xl border-2 border-white/20 object-contain"
          />
          <div className="mt-3 px-4 py-1.5 rounded-full bg-white/10 text-white text-xs font-bold backdrop-blur-md flex items-center gap-2">
            <span>{zoomImage.title}</span>
            <span className="text-[10px] text-white/50">(クリックで閉じる)</span>
          </div>
        </div>
      )}

      <div className="relative w-full max-w-6xl max-h-[94vh] bg-[#12141a] border border-teal-500/40 rounded-2xl shadow-2xl shadow-teal-950/60 flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-white/10 bg-gradient-to-r from-teal-950/40 via-slate-900 to-indigo-950/40">
          <div className="flex items-center gap-3">
            <span className="p-2.5 text-teal-300 rounded-xl bg-teal-500/20 border border-teal-500/30 shadow-inner flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">palette</span>
            </span>
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                🎨 画風スタイル・ショールーム (Taste Gallery)
                <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-teal-500/30 text-teal-300 border border-teal-400/40">
                  全モデル作例プレビュー
                </span>
              </h2>
              <p className="text-xs text-white/50">
                1モデルあたり3組の比較作例（学生・江戸町人・社会人）を見比べながら、絵コンテ・MVの世界観を直感的に選択できます
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

        {/* Global Toolbar: 比較シチュエーション切り替え ＆ フィルター */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3 bg-white/5 border-b border-white/10">
          
          {/* ① 3組の一括比較切り替えタブ (最重要) */}
          <div className="flex items-center gap-1.5 bg-black/60 p-1 rounded-xl border border-teal-500/30 shadow-inner">
            <span className="text-[10px] text-teal-400 font-bold px-2 py-0.5 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">view_carousel</span>
              一括比較:
            </span>
            {(['students', 'edo', 'adult'] as TasteSampleCategory[]).map(cat => {
              const meta = categoryLabels[cat];
              const isActive = globalCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    setGlobalCategory(cat);
                    setCardCategoryOverrides({});
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-teal-500 to-emerald-600 text-white shadow-md shadow-teal-500/30 font-black'
                      : 'text-white/60 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{meta.icon}</span>
                  <span>{meta.label}</span>
                  <span className="text-[9px] opacity-70 hidden sm:inline">({meta.subtitle})</span>
                </button>
              );
            })}
          </div>

          {/* ② カテゴリフィルター ＆ 検索窓 */}
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-black/50 p-0.5 rounded-lg border border-white/10 text-[11px]">
              <button
                type="button"
                onClick={() => setActiveCategoryFilter('all')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${activeCategoryFilter === 'all' ? 'bg-teal-600 text-white font-bold' : 'text-white/60 hover:text-white'}`}
              >
                すべて
              </button>
              <button
                type="button"
                onClick={() => setActiveCategoryFilter('anime')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${activeCategoryFilter === 'anime' ? 'bg-purple-600 text-white font-bold' : 'text-white/60 hover:text-white'}`}
              >
                アニメ・マンガ
              </button>
              <button
                type="button"
                onClick={() => setActiveCategoryFilter('japanese')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${activeCategoryFilter === 'japanese' ? 'bg-amber-600 text-white font-bold' : 'text-white/60 hover:text-white'}`}
              >
                和風・歴史
              </button>
              <button
                type="button"
                onClick={() => setActiveCategoryFilter('cinematic')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${activeCategoryFilter === 'cinematic' ? 'bg-blue-600 text-white font-bold' : 'text-white/60 hover:text-white'}`}
              >
                シネマ
              </button>
              <button
                type="button"
                onClick={() => setActiveCategoryFilter('art')}
                className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${activeCategoryFilter === 'art' ? 'bg-rose-600 text-white font-bold' : 'text-white/60 hover:text-white'}`}
              >
                アート・デザイン
              </button>
            </div>

            {/* 検索窓 */}
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[14px] text-white/40">search</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="画風名で検索..."
                className="w-32 sm:w-40 pl-7 pr-7 py-1.5 rounded-lg bg-black/60 border border-white/15 text-xs text-white outline-none focus:border-teal-400 placeholder-white/30"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Gallery Grid Body */}
        <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 dark-scrollbar">
          {filteredItems.map(item => {
            const isSelected = currentTaste === item.tasteKey;
            const currentCat = cardCategoryOverrides[item.id] || globalCategory;
            const sampleUrl = item.samples ? item.samples[currentCat] : undefined;
            const hasAnySamples = Boolean(item.samples && Object.keys(item.samples).length > 0);

            return (
              <div
                key={item.id}
                onClick={() => onSelectTaste(item.tasteKey)}
                className={`flex flex-col rounded-2xl border transition-all overflow-hidden cursor-pointer group bg-black/40 hover:bg-black/60 relative ${
                  isSelected
                    ? 'border-teal-400 shadow-[0_0_20px_rgba(20,184,166,0.35)] ring-2 ring-teal-400/80'
                    : 'border-white/10 hover:border-white/25 hover:shadow-lg'
                }`}
              >
                {/* 選択中バッジ */}
                {isSelected && (
                  <div className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-full bg-teal-500 text-black font-black text-[10px] shadow-lg flex items-center gap-1">
                    <span className="material-symbols-outlined text-[13px] font-black">check_circle</span>
                    現在適用中
                  </div>
                )}

                {/* プレビュー画像枠 (4:3) */}
                <div className="relative w-full aspect-[4/3] bg-slate-900 overflow-hidden flex items-center justify-center">
                  {sampleUrl ? (
                    <>
                      <img
                        src={sampleUrl}
                        alt={`${item.displayName} - ${currentCat}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      {/* ズーム拡大ボタン */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setZoomImage({ url: sampleUrl, title: `${item.displayName} (${categoryLabels[currentCat].label})` });
                        }}
                        className="absolute bottom-2.5 right-2.5 p-1.5 rounded-lg bg-black/70 hover:bg-black text-white/80 hover:text-white backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity z-10"
                        title="画像を拡大表示"
                      >
                        <span className="material-symbols-outlined text-[16px]">zoom_in</span>
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center p-6 text-center text-white/40">
                      <span className="material-symbols-outlined text-[40px] text-teal-400/30 mb-2">image</span>
                      <span className="text-xs font-bold text-white/60">{item.displayName}</span>
                      <span className="text-[10px] text-teal-400/80 mt-1 px-2 py-0.5 rounded-full bg-teal-500/10 border border-teal-500/20">
                        作例画像 順次追加中
                      </span>
                    </div>
                  )}

                  {/* カード個別切り替えピル (学生 / 江戸 / 社会人) */}
                  {hasAnySamples && (
                    <div className="absolute top-2.5 left-2.5 z-10 flex items-center gap-1 bg-black/75 p-1 rounded-lg backdrop-blur-md border border-white/15">
                      {(['students', 'edo', 'adult'] as TasteSampleCategory[]).map(cat => (
                        <button
                          key={cat}
                          type="button"
                          onClick={(e) => handleCardCategoryChange(item.id, cat, e)}
                          className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                            currentCat === cat
                              ? 'bg-teal-500 text-black font-black shadow'
                              : 'text-white/60 hover:text-white hover:bg-white/20'
                          }`}
                          title={categoryLabels[cat].subtitle}
                        >
                          {categoryLabels[cat].label}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* 完備バッジ */}
                  {hasAnySamples && (
                    <div className="absolute bottom-2.5 left-2.5 px-2 py-0.5 rounded bg-black/70 text-emerald-300 font-mono text-[9px] font-bold backdrop-blur-md border border-emerald-500/30 flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                      3作例完備
                    </div>
                  )}
                </div>

                {/* カードフッター情報 */}
                <div className="p-4 flex flex-col gap-2 flex-1 justify-between bg-gradient-to-b from-white/[0.02] to-transparent">
                  <div>
                    <h3 className="text-sm font-black text-white group-hover:text-teal-300 transition-colors leading-snug">
                      {item.displayName}
                    </h3>
                    <p className="text-[11px] text-white/60 mt-1 line-clamp-2 leading-relaxed">
                      {item.descriptionJp}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10 mt-1">
                    <span className="text-[10px] font-mono text-teal-400/80 truncate max-w-[180px]">
                      {categoryLabels[currentCat].subtitle}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTaste(item.tasteKey);
                        onClose();
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-teal-500 text-black font-black'
                          : 'bg-white/10 hover:bg-teal-500 hover:text-black text-white'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        {isSelected ? 'check' : 'touch_app'}
                      </span>
                      {isSelected ? '選択中' : 'この画風にする'}
                    </button>
                  </div>
                </div>

              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-black/60 border-t border-white/10 flex items-center justify-between text-xs text-white/50">
          <span>全 {TASTE_GALLERY_DATA.length} 画風モデル登録済（順次全作例を拡張中）</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors font-bold cursor-pointer"
          >
            閉じる
          </button>
        </div>

      </div>
    </div>
  );
};
