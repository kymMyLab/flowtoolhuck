# Jules Pro Autonomous Debugging & Hardening Mission
**Project**: FlowTool (Studio Pro - MV & Cinematic Video Production System)  
**Target Environment**: Chrome DevTools Mount / Single ESM Web App Bundle  
**Branch**: `main`  
**Updated**: 2026-10-08

---

## 🎯 ミッション概要
本リポジトリは、Google Flow Tools の Web 画面内にマウントして動作するシネマティック映像・音楽MV制作システム（FlowTool Studio Pro）です。

直近の更新にて、以下の改善が `main` に反映されています：
1. **動画生成プロンプトの安全性ガード**: `useVideoGeneration.ts` にて `finalVideoPrompt` の `undefined` 混入防止および英数字フォールバック処理を導入。
2. **ブラウザ動画エンジンのリソース完全解放**: `browserVideoService.ts` にて `renderKenBurnsVideo` の `try...finally` による Canvas / Context クリアおよび `renderFullEpisodeMovie` での `video.remove()` を導入。
3. **特大扉絵（Google AI Ultra Direct）のレイアウト安定化**: 看板バナーとキャラクター頭部の干渉回避プロンプト。

Jules は、最新の `main` ブランチを起点として、**コードベース全体の深層監査・デバッグ・長期連続稼働におけるメモリ・エラーハンドリング堅牢化**を自律的に遂行し、Pull Request を作成してください。

---

## 🚫 絶対遵守の境界規約（Boundary Constraints）
以下の規約に違反したコードはマージできません。厳格に遵守してください：

1. **成果物画像データの消去禁止（最重要）**:
   - `productionPipelines.ts` の `cleanupEpisodeMemory` や各種クリーンアップ関数で、`ep.coverBase64`、`ep.masterAnchorBase64`、`ep.characterTurnaroundBase64` などのエピソード成果物データを **`undefined` にして消去することは絶対に禁止** です。
   - ※消去すると、UI（`EpisodeSection.tsx`）の扉絵サムネイルが消滅し、さらに一括ZIPエクスポート（`exportService.ts`）時に画像が失われる重大バグが発生します。メモリ対策は作業用中間バッファの解放や `window.gc()` トリガーのみに留めてください。
2. **ダウンロード完了モーダル（`PackageDownloadModal`）の永久廃止**:
   - ポップアップやダウンロードモーダルを表示するコンポーネント・UIコードを絶対に再導入・作成しないでください（バックグラウンド直接保存のみ）。
3. **Afterフレーム参照（`lastFrameImageMediaId`）のコメントアウト維持**:
   - 2点間モーフィング崩壊を防止するため、`lastFrameImageMediaId` は意図的に無効化されています。再有効化やコメント解除を行わないでください。
4. **既存の最新UI実装の先祖返り禁止**:
   - `EpisodeSection.tsx` のプレビューモーダル（画面内収容・Escキー対応）など、直近で最適化されたUIロジックを過去のコードで上書きしないでください。

---

## 📌 今回の重点デバッグ＆堅牢化項目

### 1. 長時間バッチ連続生成時の中断（Abort）処理と未処理リソースの監査
- **対象ファイル**:
  - `src/services/productionPipelines.ts` (`runSeriesProduction`, `runShortsBatchProduction`)
  - `src/services/useStudioProduction.ts`
- **検証＆実装作業**:
  - ユーザーが生成を途中で中止（Abort）した場合に、実行中の非同期タイマー、リトライループ（`callWithRetry`）、および生成キューが即座かつ安全に停止し、バックグラウンドで無駄な API リクエストが走り続けないか監査・堅牢化してください。
  - Abort 発生時に各エピソードやカットの `isGenerating` フラグが正しくリセットされることを確認してください。

### 2. 生成API（Flow.generate.image / Flow.generate.video）の引数型安全性とフォールバック
- **対象ファイル**:
  - `src/services/useVideoGeneration.ts`
  - `src/services/directorService.ts`
  - `src/services/useStudioProduction.ts`
- **検証＆実装作業**:
  - `Flow.generate.image` や `Flow.generate.video` を呼び出す全箇所において、渡されるパラメータ（`prompt`, `aspectRatio`, `durationSeconds`, `imageModel` 等）が空文字や不正な型、NaN、未定義とならないよう、事前バリデーションを徹底してください。
  - 万が一モデル指定やプロンプト構築に欠損が生じた場合の安全なデフォルトフォールバックを確保してください。

### 3. ZIPエクスポート・大容量バッチ保存の安全性
- **対象ファイル**:
  - `src/services/exportService.ts`
- **検証＆実装作業**:
  - 10話以上の長編シリーズ（120カット以上）を一括エクスポートする際、JSZip や Base64 デコード処理でブラウザのヒープメモリが急激に圧迫されてクラッシュしないか検証し、安全な処理フローを担保してください。

### 4. TypeScript 完全パス (Zero Errors) & バンドル検証
- **検証作業**:
  - `npx tsc --noEmit` で型エラーが 0 件であることを確認。
  - `npm run build`（`node scripts/build.mjs`）でエラーなくバンドルが完了することを確認。

---

## 🛠️ 成果物の納品
- 修正完了後、すべての検証を通過した状態で Pull Request を作成してください。
