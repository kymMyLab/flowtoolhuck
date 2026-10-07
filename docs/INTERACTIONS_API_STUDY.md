# Google Gemini Interactions API 徹底調査および FlowTool Studio Pro への適用性評価

## 1. 概要
本ドキュメントは、新たに一般提供が開始された [Google Gemini Interactions API](https://ai.google.dev/gemini-api/docs/interactions-overview?hl=ja) の技術調査レポート、およびシネマティック映像・音楽MV制作支援ツール「FlowTool Studio Pro」への適用（PoC）設計書です。

Interactions API は、標準の Gemini モデルから特殊なエージェント（Deep Research 等）まで単一のインターフェースでアクセス可能にする次世代エンドポイントです。本プロジェクトが依存する `Flow.generate.text` などの裏側（または直接のプロンプトエンジン）を Interactions API アーキテクチャにリプレイスまたは連携することで、劇的なトークン削減と品質向上、バッチ処理の堅牢化が期待できます。

## 2. 重点調査項目の評価

### 2.1 ステートフル会話 (`previous_interaction_id`) による文脈保持とトークン削減
**【機能概要】**
Interactions API はデフォルトで各ターンのリクエスト・レスポンスをサーバーサイドに保存します（`store=true`）。以降のターンで `previous_interaction_id` を渡すだけで、クライアント側で過去の会話履歴すべてを再送信することなく、継続した会話が可能になります。

**【FlowTool Studio Pro への適用性】**
* **現状の課題**: `directorService.ts` や `productionPipelines.ts` では、各カットの生成（映像プロンプト、設定考証、衣装定義など）のたびに、長大なシステムプロンプトやシリーズ全体のマニフェスト（`SeriesManifest`）、世界観定義を毎回送信しており、トークン消費量が多く、暗黙のキャッシュ（Context Caching）も効きづらい状態でした。
* **適用後**:
  * 最初のエピソードまたはシリーズ定義時に `interaction` を作成。
  * カット 1、カット 2... と進行する際、前のカットの `interaction_id` を `previous_interaction_id` として渡すことで、モデルは「これまでの全てのカットの流れ・文脈」を自動的に把握できます。
  * これにより、キャラクターの服装の連続性（Consistency）や、物語の自然なトランジション（前カットからの引き継ぎ）の精度が飛躍的に向上しつつ、通信ペイロードと入力トークン料金を大幅に削減可能です。

### 2.2 思考プロセス (Thinking / CoT) の可視化ログ連携
**【機能概要】**
Interactions API は、モデルの出力において「思考プロセス（Thinking）」の実行ステップをレスポンスに含める（オブザーバブル実行ステップ）ことが可能です。

**【FlowTool Studio Pro への適用性】**
* **現状の課題**: ディレクターAI（Gemini）がなぜそのプロンプトを生成したのか、なぜその衣装や時代考証をNGとしたのかがブラックボックスでした。
* **適用後**:
  * 生成処理中に取得された思考ログ（Thinking ステップ）を UI 上（例えば `addLog` や専用のインスペクタ）にリアルタイムで出力します。
  * 「Gemini が時代考証ルールを参照し、この小道具はアクロニズム（時代錯誤）だと判断したプロセス」などを可視化でき、ユーザーはディレクターの意図を理解した上でプロンプトの微調整が可能になります。

### 2.3 バックグラウンド実行 (`background=true`) の実現可能性
**【機能概要】**
Interactions API では、長時間の推論やエージェントワークフローに対して `background=true` を指定することで、非同期にタスクを処理し、後からインタラクションのステータスと結果をポーリングで取得できる可能性があります。

**【FlowTool Studio Pro への適用性】**
* **現状の課題**: 複数話・全カット（例: 10話 x 10カット = 100生成タスク）のバッチ生産パイプラインでは、ブラウザを立ち上げたままフォアグラウンドで完了を待つ必要があり、タイムアウトやブラウザクラッシュ（OOM）のリスクがありました。
* **適用後**:
  * 一連の台本生成やディレクションタスクをバックグラウンド実行にオフロードし、クライアントは定期的に API をポーリングする構成に移行できます。
  * これにより、UI スレッドのブロックを避け、安定した長期生産パイプラインを確立できます。

---

## 3. 適用インターフェースの設計 (TypeScript)

以下は、`FlowTool Studio Pro` の `types.ts` および `directorService.ts` に Interactions API を統合するための拡張インターフェース設計です。

### 3.1 `types.ts` の拡張

```typescript
// types.ts への追加・変更案

/**
 * Interactions API のステートフル状態を保持する参照
 */
export interface InteractionState {
  interactionId: string;
  model: string;
  createdAt: string;
}

export interface Episode {
  // 既存のフィールド
  id: number;
  internalId: string;
  // ...

  // Interactions API ステートフル参照用
  directorInteractionState?: InteractionState;
}

export interface Cut {
  // 既存のフィールド
  id: number;
  promptEn: string;
  // ...

  // そのカット生成時のディレクターAIの思考ログ（CoT可視化用）
  directorThinkingLog?: string;
}

export interface GeneratorSettings {
  // 既存のフィールド
  productionMode: ProductionMode;
  // ...

  // Interactions API の有効化フラグ
  useInteractionsApi?: boolean;
}
```

### 3.2 `directorService.ts` クライアントラッパーの設計

```typescript
// src/services/directorService.ts (PoCレベルのラッパー設計)

import type { Cut, Episode, SeriesManifest } from '../types';
// Google GenAI SDK (Interactions API対応版)
// import { GoogleGenAI } from "@google/genai";

export class InteractionsDirectorService {
  // private client: GoogleGenAI;

  constructor() {
    // this.client = new GoogleGenAI();
  }

  /**
   * シリーズ初期化（最初のインタラクション作成）
   */
  async initializeSeriesDirector(manifest: SeriesManifest): Promise<string> {
    /*
    const interaction = await this.client.interactions.create({
      model: "gemini-2.5-pro", // または最新の思考モデル
      system_instruction: "あなたは有能な映像ディレクターです...",
      input: `以下の設定でシリーズを開始します: ${JSON.stringify(manifest)}`
    });
    return interaction.id;
    */
    return "MOCK_INTERACTION_ID";
  }

  /**
   * 前の文脈（previous_interaction_id）を引き継いでカットのプロンプトを生成
   */
  async generateCutPrompt(
    cutContext: any,
    previousInteractionId: string
  ): Promise<{ promptEn: string, newInteractionId: string, thinkingLog?: string }> {
    /*
    const interaction = await this.client.interactions.create({
      model: "gemini-2.5-pro",
      input: `次のカットの設定を生成してください: ${JSON.stringify(cutContext)}`,
      previous_interaction_id: previousInteractionId,
      // background: true (必要に応じて非同期化)
    });

    // interaction オブジェクトからオブザーバブルな実行ステップ（Thinking）を抽出可能
    const thinkingLog = interaction.steps?.find(s => s.type === 'thinking')?.text;

    return {
      promptEn: interaction.output_text,
      newInteractionId: interaction.id,
      thinkingLog
    };
    */
    return {
      promptEn: "Masterpiece, dramatic lighting...",
      newInteractionId: "MOCK_NEXT_INTERACTION_ID",
      thinkingLog: "主人公の服装を前のカットから維持しつつ、光源を調整すべきだと判断しました。"
    };
  }
}
```

## 4. 結論と次のステップ
Interactions API を FlowTool Studio Pro に導入することで、**「コンテキストの途切れ（キャラ変・世界観崩壊）」をステートフル機能で解決**し、**トークンコストの最適化**を図ることができます。また、**ディレクターAIの思考ログ可視化**は、クリエイターにとって強力なインサイトとなります。

**Next Steps**:
1. Google GenAI SDK（`@google/genai` バージョン 2.3.0 以降）の依存追加可否の検討。
2. Flow Tools 環境内（iframe マウント）から直接 `@google/genai` を呼び出せるか、またはバックエンドプロキシが必要かの CORS / 認証トークン検証。
3. 一部エピソードでのオプトイン形式による PoC（概念実証）実装への着手。
