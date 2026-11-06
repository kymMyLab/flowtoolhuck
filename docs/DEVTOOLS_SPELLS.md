# Chrome DevTools 呪文（コンソールスクリプト）集

Google Flow Tool を運用・保守・バックアップする際に Chrome DevTools Console で使用する「必殺呪文」をまとめたリファレンスです。

---

## 呪文 1: 【今回大成功】Web上の全コード一括抽出・ダウンロード呪文

Google Flow Tool の「コード」タブ内にある仮想プロジェクトの全ファイル（20ファイル）を巡回し、1本のテキストファイルとして即座にダウンロード＆クリップボードにコピーします。

### 実行条件（超重要！）
1. Flow Tool 画面の左上タブが **「コード」** になっていること。
2. DevTools Console の左上ドロップダウンが **`top`** になっていること（`blob:...` だとプレビューiframeの中になり失敗します）。

### スクリプトの場所
- [`scripts/devtools_spells/extract_flowtool_code.js`](file:///h:/マイドライブ/020_business/800_プログラム関連/803_FlowTool/scripts/devtools_spells/extract_flowtool_code.js)

### 使い方
上記ファイルを開き、中身をすべてコピーして Console に貼り付けて Enter を押すだけです。

---

## 呪文 2: 【ローカルバンドル即時起動】最新Studio Pro マウント呪文（必殺技）

Flow Tool 側のコードを触らずに、インターネット（CDN/GitHub）から最新の React アプリを Flow Tool 画面上に一瞬でマウント・起動します。

### スクリプトの場所
- [`scripts/mount/MOUNT_COMMAND.js`](file:///h:/マイドライブ/020_business/800_プログラム関連/803_FlowTool/scripts/mount/MOUNT_COMMAND.js)

### コマンド
```javascript
import('https://esm.sh/gh/kymMyLab/flowtoolhuck@a15b1de57d/dist/bundle.js?raw').then(m => { const root = document.getElementById('root') || document.body; root.innerHTML = ''; m.mount(root); console.log('🚀 STUDIO PRO 完全最新版マウント完了！'); });
```

---

## トラブルシューティング

| 現象 | 原因 | 解決策 |
| :--- | :--- | :--- |
| `0 ファイルを回収しました` と出る | Console の左上セレクタが `blob:` になっている | ドロップダウンを `top` に変更して再実行してください。 |
| 画面が動かない | 「プレビュー」タブが開かれている | 左上のタブを「コード」に切り替えてから実行してください。 |
| ポップアップブロックで保存されない | ブラウザがダウンロードを遮断 | クリップボードに全コードが自動コピーされているので、メモ帳を開いて `Ctrl + V` を押せば即座に保存できます。 |
