# Google Labs Jules API 連携＆自律自動化ガイド

Google Labs Jules（AIソフトウェアエンジニア）のAPIを用いて、人手を介さず完全自律でデバッグ・機能開発・Pull Request作成までを自動実行させるための仕様と運用ガイドです。

---

## ⚡ 核心知見：フル自律モードのパラメータ

Jules API（`https://jules.googleapis.com/v1alpha/sessions`）へのセッション発行時、以下の2つのパラメータを指定することで、人間の介入なしに完了まで自律走行させることができます。

| パラメータ | 設定値 | 効果・挙動 |
| :--- | :--- | :--- |
| **`requirePlanApproval`** | **`false`** | **計画の承認待ちをスキップ**。<br>デフォルト（`true`）だと計画作成後に人間がWeb UIで「Approve」を押すまで待機してしまいますが、`false` にすると計画策定直後に自律してコード編集・テストへ進みます。 |
| **`automationMode`** | **`"AUTO_CREATE_PR"`** | **完了時に自動でPull Requestを作成**。<br>タスクが完了しテストをパスした時点で、Julesが専用ブランチを作成しGitHubにPRをオープンします。 |

---

## 🔐 APIキーの管理・セキュリティ規範

> [!CAUTION]
> **APIキーをGitHub等の公開リポジトリにコミットすることは絶対に禁止です。**  
> JulesのAPIキーが公開されると、Googleの自動不正検知システムによって即座に無効化（Revoke）されます。

### 安全な保存場所：`.env`（Git除外済み）
リポジトリ直下の `.env` ファイルに保存されています。
`.gitignore` に明記されているため、Gitにコミットされることはありません。

```bash
# .env（ローカル環境のみ保持・Git管理外）
JULES_API_KEY=your_jules_api_key_here
```

---

## 🛠️ 自動化スクリプト (`scripts/jules.mjs` / `npm run jules`)

FlowToolリポジトリには、Julesへの完全自律ジョブ投入スクリプトが整備されています。

### 1. 指示書（`JULES_TASK.md`）の内容で即時投入（デフォルト）
出勤前や就寝前に `JULES_TASK.md` を更新し、以下を実行するだけで全自動でスタートします。

```powershell
npm run jules
```

### 2. コマンドラインから直接指示を投げる
```powershell
npm run jules -- "動画生成パイプラインのエラーハンドリングを追加して"
```

### 3. 進捗ステータスの確認
```powershell
npm run jules -- --status <sessionId>
```

### 4. 直近セッション一覧
```powershell
npm run jules -- --list
```

---

## 🤖 Antigravity エージェント連携（次回以降の自動化）

Antigravity（Gemini / 本AI）に対して：
> 「Julesにデバッグジョブを投げておいて」  
> 「Julesにこのタスクを任せておいて」

と依頼するだけで、Antigravity が自動的に本スクリプトまたはAPIを叩き、常に **`requirePlanApproval: false`** かつ **`automationMode: "AUTO_CREATE_PR"`** でジョブを発行します。
また、ワークスペースルール [`.agents/rules/flowtool_rules.md`](file:///.agents/rules/flowtool_rules.md) およびカスタムスキル [`.agents/skills/jules-dispatcher/SKILL.md`](file:///.agents/skills/jules-dispatcher/SKILL.md) に本運用が恒久登録されています。
