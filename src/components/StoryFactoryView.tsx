import React, { useState, useRef } from 'react';
import { SAFE_CHARACTERS } from '../config/safeCharacters';
import { FACTORY_THEME_CATEGORIES } from '../config/factoryThemes';
import { TASTES } from '../constants';
import { runFactorySingleEpisode } from '../services/storyFactoryRunner';
import { FactoryExportPayload } from '../services/storyFactoryService';

interface StoryFactoryViewProps {
  onBackToStudio: () => void;
  addLog: (msg: string, type?: any) => void;
}

export const StoryFactoryView: React.FC<StoryFactoryViewProps> = ({ onBackToStudio, addLog }) => {
  // 設定ステート
  const [selectedCharId, setSelectedCharId] = useState<string>('zundamon');
  const [selectedThemeCategory, setSelectedThemeCategory] = useState<string>('mystery');
  const [customTheme, setCustomTheme] = useState<string>('');
  const [selectedTasteKey, setSelectedTasteKey] = useState<string>(Object.keys(TASTES)[0]);
  const [episodeCount, setEpisodeCount] = useState<number>(1);

  // 実行状態
  const [isProducing, setIsProducing] = useState<boolean>(false);
  const [currentEpisodeNo, setCurrentEpisodeNo] = useState<number>(1);
  const [statusStage, setStatusStage] = useState<string>('待機中');
  const [completedCuts, setCompletedCuts] = useState<number>(0);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewNarration, setPreviewNarration] = useState<string>('');
  const [historyPayloads, setHistoryPayloads] = useState<FactoryExportPayload[]>([]);

  const isAbortedRef = useRef<boolean>(false);

  const selectedCharacter = SAFE_CHARACTERS.find(c => c.id === selectedCharId) || SAFE_CHARACTERS[0];
  const activeCategory = FACTORY_THEME_CATEGORIES.find(c => c.id === selectedThemeCategory) || FACTORY_THEME_CATEGORIES[0];
  const activeTastePrompt = TASTES[selectedTasteKey] || Object.values(TASTES)[0];

  const handleStartProduction = async () => {
    if (isProducing) return;
    setIsProducing(true);
    isAbortedRef.current = false;
    setCompletedCuts(0);

    const themeToUse = customTheme.trim() || activeCategory.items[Math.floor(Math.random() * activeCategory.items.length)];
    addLog(`🚀 【Story Factory】全自動連続生成を開始します（全${episodeCount}話 / 各話24カット + 扉絵2枚 + 自動DL）`, 'process');

    let persistentTurnaround: string | undefined = undefined;

    try {
      for (let ep = 1; ep <= episodeCount; ep++) {
        if (isAbortedRef.current) break;
        setCurrentEpisodeNo(ep);
        
        // テーマ（複数話ある場合は少しアレンジまたは連番リストから選定）
        const epTheme = episodeCount > 1 && !customTheme.trim()
          ? activeCategory.items[(ep - 1) % activeCategory.items.length]
          : themeToUse;

        const result = await runFactorySingleEpisode(
          ep,
          episodeCount,
          selectedCharacter,
          epTheme,
          selectedTasteKey,
          activeTastePrompt,
          addLog,
          (prog) => {
            setStatusStage(prog.stage);
            setCompletedCuts(prog.completedCuts);
            if (prog.currentCutImage) setPreviewImage(prog.currentCutImage);
            if (prog.currentNarration) setPreviewNarration(prog.currentNarration);
          },
          () => isAbortedRef.current,
          persistentTurnaround
        );

        // シリーズ内で主人公の姿を揃えるため三面図を再利用
        if (result.turnaroundBase64) {
          persistentTurnaround = result.turnaroundBase64;
        }

        setHistoryPayloads(prev => [result, ...prev]);
        addLog(`✨ 第${ep}話の全24カット作画 ＆ 自動ダウンロードが完了しました！`, 'success');

        if (ep < episodeCount && !isAbortedRef.current) {
          addLog(`☕ 次の話（第${ep + 1}話）の生成準備中（冷却インターバル 5秒）...`, 'info');
          await new Promise(r => setTimeout(r, 5000));
        }
      }

      if (!isAbortedRef.current) {
        addLog(`🎉 全${episodeCount}話のストーリー＆画像生成、自動ダウンロードがすべて完了しました！`, 'success');
      } else {
        addLog(`🛑 ユーザー操作により生成を中止しました。`, 'warning');
      }
    } catch (err: any) {
      if (err.message === 'ABORTED') {
        addLog(`🛑 生成を中止しました。`, 'warning');
      } else {
        addLog(`❌ エラーが発生しました: ${err.message || err}`, 'error');
      }
    } finally {
      setIsProducing(false);
      setStatusStage('完了');
    }
  };

  const handleAbort = () => {
    isAbortedRef.current = true;
    addLog('🛑 緊急停止リクエストを送信しました...', 'warning');
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* ── 最上部ヘッダー ── */}
      <header className="flex items-center justify-between px-6 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={onBackToStudio}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition-colors border border-slate-700"
          >
            <span>← Studio Proに戻る</span>
          </button>
          <div className="flex items-center space-x-2">
            <span className="text-xl">🏭</span>
            <h1 className="text-base font-bold bg-gradient-to-r from-emerald-400 via-teal-300 to-cyan-400 bg-clip-text text-transparent">
              Story Factory（物語＆正方形24カット全自動量産機）
            </h1>
            <span className="px-2 py-0.5 text-[10px] font-semibold tracking-wider uppercase bg-emerald-950/80 text-emerald-300 border border-emerald-800/80 rounded-full">
              AUTO DOWNLOAD
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2 text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>超指数バックオフ常時ON (429自動回避)</span>
          </div>
        </div>
      </header>

      {/* ── メインボディ（2カラム） ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── 左カラム: 超シンプル設定・起動パネル ── */}
        <div className="w-96 bg-slate-900/90 border-r border-slate-800 p-5 flex flex-col space-y-5 overflow-y-auto shrink-0">
          {/* 1. キャラクター選択 */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>👤 主役キャラクター</span>
              <span className="text-[10px] text-emerald-400 font-normal">収益化OK</span>
            </label>
            <div className="grid grid-cols-1 gap-1.5">
              {SAFE_CHARACTERS.map(c => {
                const isSelected = c.id === selectedCharId;
                return (
                  <button
                    key={c.id}
                    disabled={isProducing}
                    onClick={() => setSelectedCharId(c.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-950/60 border-emerald-500/80 text-white shadow-lg shadow-emerald-950/30'
                        : 'bg-slate-950/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <span className="text-lg">{c.icon}</span>
                      <div>
                        <div className="text-xs font-bold leading-tight text-slate-100">{c.nameJa}</div>
                        <div className="text-[10px] text-slate-400 line-clamp-1">{c.personality}</div>
                      </div>
                    </div>
                    {isSelected && <span className="text-xs text-emerald-400 font-bold">✓</span>}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. テーマ・お題カテゴリ */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              🏷️ テーマ・お題カテゴリ
            </label>
            <div className="grid grid-cols-3 gap-1.5">
              {FACTORY_THEME_CATEGORIES.map(cat => {
                const isSelected = cat.id === selectedThemeCategory;
                return (
                  <button
                    key={cat.id}
                    disabled={isProducing}
                    onClick={() => { setSelectedThemeCategory(cat.id); setCustomTheme(''); }}
                    className={`p-2 rounded-lg border text-center transition-all ${
                      isSelected
                        ? 'bg-teal-950/80 border-teal-500 text-teal-200 font-bold'
                        : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-base">{cat.icon}</div>
                    <div className="text-[11px] mt-0.5 truncate">{cat.name.split(' ')[1] || cat.name}</div>
                  </button>
                );
              })}
            </div>

            {/* 自由入力（任意） */}
            <div className="mt-2">
              <input
                type="text"
                disabled={isProducing}
                value={customTheme}
                onChange={e => setCustomTheme(e.target.value)}
                placeholder="自由なお題（空欄ならカテゴリから自動選定）"
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* 3. 画風スタイル */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300">
              🎨 画風スタイル
            </label>
            <select
              disabled={isProducing}
              value={selectedTasteKey}
              onChange={e => setSelectedTasteKey(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-emerald-500"
            >
              {Object.keys(TASTES).map(key => (
                <option key={key} value={key}>
                  {key}
                </option>
              ))}
            </select>
          </div>

          {/* 4. 生成話数 */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center justify-between">
              <span>📚 生成話数</span>
              <span className="text-[11px] text-teal-400 font-mono font-bold">{episodeCount} 話</span>
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 3, 5, 10].map(cnt => (
                <button
                  key={cnt}
                  disabled={isProducing}
                  onClick={() => setEpisodeCount(cnt)}
                  className={`py-1.5 rounded-lg border text-xs font-bold transition-all ${
                    episodeCount === cnt
                      ? 'bg-emerald-600 border-emerald-400 text-white'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  {cnt} 話
                </button>
              ))}
            </div>
          </div>

          {/* ⚙️ 固定スペックインフォ */}
          <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
            <div className="flex items-center space-x-1.5 text-slate-300 font-bold">
              <span>⚡ 完全自動パイプライン仕様</span>
            </div>
            <div className="flex justify-between">
              <span>・本編カット数:</span>
              <span className="text-emerald-400 font-bold">24カット固定</span>
            </div>
            <div className="flex justify-between">
              <span>・本編アスペクト比:</span>
              <span className="text-emerald-400 font-bold">1:1 正方形</span>
            </div>
            <div className="flex justify-between">
              <span>・同梱扉絵:</span>
              <span className="text-emerald-400 font-bold">ショート(9:16) ＆ ロング(16:9)</span>
            </div>
            <div className="flex justify-between">
              <span>・キャラ三面図:</span>
              <span className="text-emerald-400 font-bold">自動先行作画 (容姿固定)</span>
            </div>
            <div className="flex justify-between">
              <span>・保存方式:</span>
              <span className="text-cyan-400 font-bold">各話完了時に勝手に自動DL</span>
            </div>
          </div>

          <div className="flex-1"></div>

          {/* 🚀 アクションボタン */}
          <div>
            {!isProducing ? (
              <button
                onClick={handleStartProduction}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 text-slate-950 font-black text-sm tracking-wide shadow-lg shadow-emerald-500/20 active:scale-[0.98] transition-all"
              >
                🚀 全自動で物語＆画像を量産開始！
              </button>
            ) : (
              <button
                onClick={handleAbort}
                className="w-full py-3.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow-lg shadow-rose-950/30 transition-all"
              >
                🛑 緊急停止する
              </button>
            )}
          </div>
        </div>

        {/* ── 右メイン: 進行状況 ＆ リアルタイムプレビュー ── */}
        <div className="flex-1 bg-slate-950 p-6 flex flex-col space-y-6 overflow-y-auto">
          {/* 進捗ステータスバナー */}
          <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2.5">
                <span className="text-lg">🎬</span>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">
                    {isProducing
                      ? `第 ${currentEpisodeNo} / ${episodeCount} 話 作成中: ${statusStage}`
                      : 'スタンバイ完了'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {isProducing
                      ? `カット進捗: ${completedCuts} / 24 コマ作画済み`
                      : 'ボタンを押すと、シナリオ考案 ➔ 三面図 ➔ 扉絵2枚 ➔ 24カット作画 ➔ 自動保存 が一気に走ります'}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-2xl font-black font-mono text-emerald-400">
                  {completedCuts}
                </span>
                <span className="text-xs text-slate-500 font-mono"> / 24 cut</span>
              </div>
            </div>

            {/* プログレスバー */}
            <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400 transition-all duration-300"
                style={{ width: `${(completedCuts / 24) * 100}%` }}
              ></div>
            </div>
          </div>

          {/* リアルタイム作画プレビュー */}
          <div className="flex-1 min-h-[360px] flex items-center justify-center p-6 rounded-2xl bg-slate-900/60 border border-slate-800 relative overflow-hidden">
            {previewImage ? (
              <div className="flex flex-col items-center max-w-md w-full space-y-4">
                <div className="w-72 h-72 rounded-2xl overflow-hidden border-2 border-emerald-500/50 shadow-2xl bg-black relative group">
                  <img
                    src={previewImage}
                    alt="Current Cut"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute top-2 left-2 px-2 py-0.5 rounded bg-black/80 text-[10px] font-mono text-emerald-300 border border-emerald-500/40">
                    Cut {String(completedCuts).padStart(2, '0')} / 24
                  </div>
                </div>
                {previewNarration && (
                  <div className="w-full p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-center">
                    <p className="text-xs font-medium text-emerald-300">
                      {previewNarration}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center space-y-2 text-slate-600">
                <div className="text-4xl opacity-40">🖼️</div>
                <div className="text-xs tracking-wider uppercase">リアルタイム作画プレビュー</div>
                <div className="text-[11px] text-slate-500">生成された画像がここに順次表示されます</div>
              </div>
            )}
          </div>

          {/* 生成済み履歴 / 自動ダウンロード通知 */}
          {historyPayloads.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                📦 今回の自動ダウンロード完了アーカイブ ({historyPayloads.length}本)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {historyPayloads.map((hist, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-xl bg-slate-900 border border-emerald-900/60 flex items-center justify-between"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 rounded-lg overflow-hidden bg-black shrink-0 border border-slate-700">
                        {hist.cuts[0]?.imageBase64 && (
                          <img
                            src={hist.cuts[0].imageBase64}
                            alt="thumb"
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-200">
                          第{hist.episodeNo}話: {hist.titleJp}
                        </div>
                        <div className="text-[10px] text-emerald-400">
                          ✅ 24cut + 扉絵2枚 + 台本 を自動保存済み
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
