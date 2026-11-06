# FlowTool プロジェクト全体ガイド & フォルダ案内図

本ドキュメントは、プロジェクト全体のディレクトリ構成、各フォルダの役割、各種バックアップ・必殺技マウント・呪文の保管場所を一覧化した総合案内図です。

---

## 1. フォルダ構成マップ（整理完了版）

```
803_FlowTool/
├── 📁 src/                     ★【ローカル開発ソースコード】
│   ├── App.tsx                 メイン画面・ヘッダー・エラーバウンダリ
│   ├── types.ts                全データ型定義（Cut, Episode, Settings など）
│   ├── constants.ts            定数・プリセット・安全キャラクター設定
│   ├── components/             UIコンポーネント群（Sidebar, Episode, Modalなど）
│   │   ├── EpisodeSection.tsx  ★高コントラスト修正済み・エピソード表示
│   │   ├── StudioSidebar.tsx   左サイドバー設定・タブ
│   │   └── ...
│   └── services/               生成・考証・制御ロジック
│       ├── directorService.ts  Gemini による脚本自動策定・演出
│       ├── promptEngine.ts     プロンプト生成エンジン
│       ├── useStudioProduction.ts 制作ステート管理フック
│       └── ...
│
├── 📁 scripts/                  ★【自動化スクリプト＆呪文集】
│   ├── 📁 mount/                ★【マウント用コマンド】
│   │   └── MOUNT_COMMAND.js    ⚡【必殺技】インターネットから最新版を落として一発起動するコマンド
│   ├── 📁 devtools_spells/      ★【DevTools用呪文】
│   │   └── extract_flowtool_code.js （Webコード全抽出・DL呪文）
│   ├── build.mjs               高速バンドルビルド
│   └── deploy.mjs              GitHubプッシュ＆CDNキャッシュパージ
│
├── 📁 backups/                  ★【安全バックアップ・退避フォルダ】
│   └── 📁 web_exports/          Flow Tool(Web側)から呪文で吸い出した生コード保管場所
│       └── 20261107_FlowTool_WebProject_Code.txt （★今回ダウンロードした完全コード）
│
├── 📁 docs/                     ★【ドキュメント・解説・Qiita記事資産】
│   ├── 📁 articles/             技術記事・解説記事
│   ├── 📁 qiita_assets/         記事用画像・図解アセット
│   ├── 📁 qiita_references/     Qiita過去リファレンス
│   ├── 📁 investigations/       調査レポート（ドラッグ＆ドロップ調査等）
│   ├── 📁 jules/                Jules API 連携ガイド・タスク仕様
│   ├── DEVTOOLS_SPELLS.md      ★Chrome DevTools 呪文チートシート
│   ├── VERSION_HISTORY.md      ★過去のバージョン履歴＆ロールバック手順書
│   ├── FLOW_TOOLS_MANUAL.md    📖【必殺技マニュアル】DevTools Snippets連携マニュアル
│   └── INTERACTIONS_API_STUDY.md Interactions API 調査資料
│
├── 📁 config/                   設定テンプレート・ジャンルレシピ
│   └── legacy_source/          過去の旧バージョンコード保管場所
│
├── 📁 dist/                     ビルド成果物（bundle.js）
├── 📁 tmp/                      作業用一時フォルダ
│
├── PROJECT_GUIDE.md            ★本ドキュメント（全体マップ）
└── package.json / tsconfig / vite 等（各種プロジェクト設定ファイル）
```

---

## 2. ⚡【必殺技】「インターネットから最新版を落としてくるやつ」の使い方

Flow Tool（Web側）のコードタブやAIチャットを一切触らず、**DevToolsの上の方（Sourcesタブ）からインターネット（CDN/GitHub）経由で最新版を一瞬で起動する必殺技**です。

### 実行手順：
1. Flow Tool の画面で `F12` を押して DevTools を開く。
2. 上のタブから **「Sources（ソース）」** を選択。
3. 左側の **「Snippets」**（隠れている場合は `>>` をクリック）を選択。
4. 登録済みの `mount-app` スニペット（または新規作成）を開く。
5. **[`scripts/mount/MOUNT_COMMAND.js`](file:///h:/マイドライブ/020_business/800_プログラム関連/803_FlowTool/scripts/mount/MOUNT_COMMAND.js)** の中身を貼り付けて **`Ctrl + Enter`**（または右クリック「Run」）。

```javascript
import('https://esm.sh/gh/kymMyLab/flowtoolhuck@a15b1de57d/dist/bundle.js?raw').then(m => { const root = document.getElementById('root') || document.body; root.innerHTML = ''; m.mount(root); console.log('🚀 STUDIO PRO 完全最新版マウント完了！'); });
```

👉 これを実行するだけで、GitHubから最新のバンドルが自動ダウンロードされ、画面が一瞬で最新のStudio Proに塗り替わります！
※ 詳しい解説は **[`docs/FLOW_TOOLS_MANUAL.md`](file:///h:/マイドライブ/020_business/800_プログラム関連/803_FlowTool/docs/FLOW_TOOLS_MANUAL.md)** に残っています。

---

## 3. 「こんなときどうする？」早見表

| やりたいこと | 見るファイル・実行する場所 |
| :--- | :--- |
| **インターネットから最新版を落として画面を上書き起動したい（必殺技）** | [`scripts/mount/MOUNT_COMMAND.js`](file:///h:/マイドライブ/020_business/800_プログラム関連/803_FlowTool/scripts/mount/MOUNT_COMMAND.js) を DevTools の Sources Snippet または Console で実行 |
| **Web側で動いているコードを壊して元に戻したい** | [`backups/web_exports/20261107_FlowTool_WebProject_Code.txt`](file:///h:/マイドライブ/020_business/800_プログラム関連/803_FlowTool/backups/web_exports/20261107_FlowTool_WebProject_Code.txt) から対象ファイルをコピペ |
| **またWeb上の全コードをまるごと落としたい** | [`scripts/devtools_spells/extract_flowtool_code.js`](file:///h:/マイドライブ/020_business/800_プログラム関連/803_FlowTool/scripts/devtools_spells/extract_flowtool_code.js) を Console（`top`）に貼り付けて実行 |
| **過去のバージョン履歴を確認したい** | [`docs/VERSION_HISTORY.md`](file:///h:/マイドライブ/020_business/800_プログラム関連/803_FlowTool/docs/VERSION_HISTORY.md) を確認 |
