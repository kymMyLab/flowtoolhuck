# Jules Pro Autonomous Debugging & Enhancement Mission (Overnight Job)
**Project**: FlowTool (Studio Pro - MV & Cinematic Video Production System)  
**Target Environment**: Chrome DevTools Mount / High-Speed Web App Bundle  
**Updated**: 2026-10-08 (Overnight Autonomous Session)

---

## 🎯 ミッション概要
本リポジトリは、Google Flow Tools 上にマウントして動作するシネマティック映像・音楽MV制作支援ツール（FlowTool Studio Pro）です。

直近のセッションにて、以下の重要なアーキテクチャ更新を行いました：
1. **After絵（2枚目フレーム）補間処理の安全停止とプロンプト誘導化**:
   - 2点間画像参照補間によるモーフィング崩壊を防止するため、`lastFrameImageMediaId` は意図的にコメントアウトしています。
   - 現在は「Start絵（1枚目）＋ 時系列遷移プロンプト（Beginning ➔ Midway ➔ Finally）＋ 最終到達点プロンプト」により動画生成を駆動しています。
   - **【最重要】コメントアウトされている After 関連コードは即時ロールバック用として絶対に削除・再有効化しないでください。**
2. **世界観適応インフォグラフィック特大扉絵（Google AI Ultra Direct）の復旧**:
   - `buildAdaptiveInfographicCoverPrompt` と `ensureInfographicCover` により、Cut 1のマスターアンカーを参照しつつ上部25%の看板エリアと下部のキャラクターを被りゼロで描き分けるポスター生成エンジンが稼働しています。
3. **バックグラウンド直接保存の維持**:
   - 連続生成を阻害していたダウンロードモーダル（`PackageDownloadModal`）は永久廃止されています。

ユーザーの就寝・不在中に、Jules は以下の重点項目について**コードベース全体の深層監査・デバッグ・メモリリーク対策・エッジケース堅牢化**を自律的に遂行し、Pull Request を作成してください。

---

## 📌 今回の重点デバッグ＆検証項目

### 1. 時系列プロンプト遷移エンジンのエッジケース＆フォールバック検証
- **対象ファイル**:
  - `src/services/useVideoGeneration.ts`
  - `src/services/directorService.ts` (`resolveCinematicEndFrameAndMotion`, `buildAdaptiveInfographicCoverPrompt`)
  - `src/components/preview/CutEditorPanel.tsx`
- **検証作業**:
  - `cut.veoMotionPrompt` や `cut.endFramePromptEn` が `undefined`、空文字、または特殊記号（`[` `]` `"` 等）を含む場合でも、`finalVideoPrompt` が `undefined` という文字列を含まず、安全かつ構文的に正しいプロンプトとして構築されるか検証。
  - Shorts / MV / ドラマ / スタイルマトリクス各モードにおいて、動画生成API（`Flow.generate.video`）への引数が常に型安全かつ妥当な値であることを確認。

### 2. ブラウザ動画レンダリングエンジン（`browserVideoService.ts`）のメモリリーク・リソース完全解放
- **対象ファイル**: `src/services/browserVideoService.ts`
- **検証作業**:
  - `renderFullEpisodeMovie` や `renderKenBurnsVideo` において、全12カット結合時や途中で中断（Abort）された場合に、すべての `HTMLVideoElement`（`video.pause(); video.removeAttribute('src'); video.load(); video.remove();`）および `URL.createObjectURL`（`URL.revokeObjectURL`）が `try-finally` ブロック内で確実にクリーンアップされているか徹底監査。
  - Chrome のデコーダー上限（同時16個等）を絶対に超過しないよう、破棄処理の漏れを塞いでください。
  - ケンバーン演出（Ken Burns）と SRT 字幕合成におけるタイムコード計算の微小な誤差（ミリ秒の丸め誤差等）がないかチェック。

### 3. バッチプロデュース＆自動保存パイプラインのキュー安全性
- **対象ファイル**:
  - `src/services/productionPipelines.ts` (`runSeriesProduction`, `runShortsBatchProduction`, `cleanupEpisodeMemory`)
  - `src/services/exportService.ts` (`savePackageFile`, `downloadZip`)
- **検証作業**:
  - 複数話（5〜10話）を連続生成する際、各話完了ごとのメモリ回収（`cleanupEpisodeMemory`）が確実に呼び出されているか。
  - `masterAnchorBase64` や `coverBase64` などの巨大な base64 文字列が、不要になったタイミングで無制限に重複保持されてヒープを圧迫していないか点検。
  - **【重要規約】ダウンロード完了モーダルは絶対に再導入しないでください（直接保存のみ）。**

### 4. TypeScript 完全パス (Zero Errors) & バンドル整合性
- **検証作業**:
  - `npx tsc --noEmit` を実行し、型エラーが 0 件であることを確認。
  - `npm run build`（`node scripts/build.mjs`）で 130 以上の全モジュールが警告なくバンドルされることを確認。

---

## 🛠️ コマンドと実行パイプライン

### 型チェック
```powershell
Set-Location "$env:USERPROFILE\.flowtool_build"
npx tsc --noEmit
```

### ビルド
```powershell
npm run build
```

---

## 💡 Jules への注意事項
1. **ダウンロードモーダルは永久廃止**:
   - ポップアップやモーダルを表示するコードは絶対に導入しないでください。
2. **After補間コードの維持**:
   - `lastFrameImageMediaId` はユーザー指示により意図的にコメントアウトされています。コメントを外したり、削除したりしないでください。
3. **画像再生成なしの原則**:
   - テロップ演出やレイアウトのリロール機能は、画像生成APIを消費せず、フロントエンドおよびメタデータのみを更新する設計を維持してください。
