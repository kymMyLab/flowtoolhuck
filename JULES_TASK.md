# Jules Pro Autonomous Debugging & Enhancement Mission
**Project**: FlowTool (Studio Pro - MV & Cinematic Video Production System)  
**Target Environment**: Chrome DevTools Mount / High-Speed Web App Bundle  
**Updated**: 2026-10-07 (Morning Job)

---

## 🎯 ミッション概要
本リポジトリは、Google Flow Tools 上にマウントして動作するシネマティック映像・音楽MV制作支援ツール（FlowTool Studio Pro）です。

Jules が前回作成してくれた **「Veo 3.1 2点間補間時のロギング強化および `[Start Frame]` / `[Target Ending Frame]` プロンプト構造化（Commit 9d90b20）」** はローカル環境へ無事マージ・統合されました！  
また、直近のアップデートにて **「型安全性エラーの完全解消」「正規表現記号によるクラッシュ防止」「連続ダウンロードを阻害していたモーダルUIの永久廃止とバックグラウンド直接保存化」** が完了しています。

ユーザーが日中仕事に出ている間に、Jules は以下の重点項目について**コードベース全体の深層監査・デバッグ・パフォーマンス検証・エッジケース対策**を自律的に遂行してください。

---

## 📌 今回の重点デバッグ＆検証項目

### 1. Veo 3.1 2フレーム補間パイプラインの統合・エッジケース検証
- **対象ファイル**: 
  - `src/services/useVideoGeneration.ts`
  - `src/services/useStudioProduction.ts` (`generateEndFrame`)
  - `src/services/productionPipelines.ts`
  - `src/components/preview/CutEditorPanel.tsx`
- **検証作業**:
  - 前回導入された `[Start Frame]: ... [Target Ending Frame]: ...` のプロンプト構造化が、1カット2枚生成（Start絵 ➔ After絵）を行った全モード（Shorts, MV, ドラマ）において正しく動画APIへ投入されているか検証。
  - After絵が未生成（`endMediaId` なし）のカットで動画生成が要求された際、フォールバック（1枚絵からの通常生成）が例外をスローせず安全に完了するか確認。
  - After絵プロンプト（`endFramePromptEn`）やモーション命令（`veoMotionPrompt`）が空文字や記号のみの場合でも、安全なデフォルト値へフォールバックされるか。

### 2. 連続・自動パッケージ保存（Auto-Download）の安定性とキュー詰まり防止
- **対象ファイル**:
  - `src/services/exportService.ts` (`savePackageFile`, `downloadZip`)
  - `src/services/productionPipelines.ts` (`autoDownload` 処理部)
  - `src/App.tsx` (`handleDownloadZip`)
- **仕様 & 注意点**:
  - **【重要】ダウンロード完了モーダル（`PackageDownloadModal`等）は連続バッチダウンロードの邪魔になるため永久廃止されました（`.agents/rules/flowtool_rules.md` 参照）。絶対にモーダルを復活させないでください。**
  - 全エピソード一括生成時、各話完了ごとにバックグラウンドで `downloadZip` ➔ `savePackageFile` が順次トリガーされます。
- **検証作業**:
  - 複数話（5〜10話など）が連続して完了した際に、ブラウザのダウンロードキュー詰まりや `blobUrl` のメモリ肥大化が起きないか検証。
  - 扉絵合成（`renderCoverCanvas`）のオフスクリーンキャンバス破棄と、SRT字幕生成の整合性をチェック。

### 3. ブラウザ動画レンダリングエンジン（Offscreen Canvas / Mediabunny）の負荷検証
- **対象ファイル**: `src/services/browserVideoService.ts`
- **検証作業**:
  - `renderFullEpisodeMovie` において、全12カット（動画と静止画が混在するケース）を1本に結合レンダリングする際のメモリ割り当てを点検。
  - Chromeのビデオデコーダー上限（同時16個等）を回避するためのビデオ要素クリーンアップ（`video.pause(); video.removeAttribute('src'); video.load(); video.remove();`）が、例外発生時（`try-finally`）にも確実に実行されているか確認。
  - ケンバーン演出（Ken Burns）と字幕合成のフレーム同期にズレが生じないか検証。

### 4. TypeScript 型安全性とビルド完全パス (Zero Errors) の維持
- **検証作業**:
  - `~/.flowtool_build` 環境で `npx tsc --noEmit` を実行し、エラーが 0 件であることを確認。
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

### デプロイパイプライン（変更完了時）
```powershell
npm run deploy
```
※ `scripts/deploy.mjs` により、ビルド・コミット・プッシュ・CDNパージ・`MOUNT_COMMAND.js` 更新が全自動実行されます。

---

## 💡 Jules への注意事項
1. **ダウンロードモーダルは永久廃止**:
   - ダウンロード完了時にポップアップダイアログやモーダルを表示するコードは絶対に再導入しないでください（直接保存のみ）。
2. **画像再生成なしの原則**:
   - テロップ演出やレイアウトのリロール機能は、画像生成API（Gemini/Imagen）を消費せず、フロントエンドおよびメタデータのみを更新する設計を維持してください。
3. **CDN 配信の完全性**:
   - `scripts/deploy.mjs` が生成する `MOUNT_COMMAND.js` は最新コミットハッシュで jsDelivr から配信されます。コミット時は常に `dist/bundle.js` を最新の状態にしてください。
