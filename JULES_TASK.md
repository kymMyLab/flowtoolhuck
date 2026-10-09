# 🚀 Jules Mission: Autonomous Qiita Technical Article Generation

## 📌 Mission Objective
You are tasked with authoring an extraordinary, professional-grade Qiita technical article (saved as `docs/articles/200_video_pipeline_qiita.md`) that documents an autonomous, high-throughput video production pipeline.

The article must follow the exact structure, tags, tone, and technical depth demonstrated in the reference articles located in `docs/qiita_references/` (specifically `170_qiita.md` and `191_qiita.md`).

---

## 🔐 CRITICAL SECRECY & PRESENTATION CONSTRAINTS (STRICT)

1. **NEVER Mention Google Flow or Internal Hacks**:
   - Do **NOT** mention "Google Flow", "Flow WebUI", "iframe mount", "Tampermonkey", "DevTools console hack", or any DOM injection / hacking.
   - The article must present the system as a **custom-built, proprietary React/TypeScript Studio UI ("STUDIO PRO")** seamlessly orchestrating with **Google Cloud Platform (Cloud Run, Cloud Pub/Sub, Cloud Tasks, GCS, and Vertex AI)**.

2. **Irreproducible Technical Superiority (圧倒的技術力とブラックボックス演出)**:
   - Convey overwhelming architectural brilliance and technical depth.
   - Reveal architectural diagrams (Mermaid), TypeScript interface schemas, asynchronous queue state machine designs, and error recovery policies.
   - Explicitly note that the core prompt conditioning engine and multimodal continuity state machine are proprietary IP / trade secrets, ensuring that while readers are amazed, they cannot easily clone the full implementation.

3. **Viral Appeal & Catchy Narrative**:
   - Title theme: **「朝起きたら動画が50本出来ている」全自動映像工場**.
   - Target audience: Engineers, AI practitioners, creators, and cloud architects seeking massive automation with cinema-grade output quality.

---

## 🖼️ Media Assets to Embed
The following screenshots are prepared in `docs/qiita_assets/`. You must embed them using clean HTML `<img>` tags matching the style in `docs/qiita_references/170_qiita.md`:

1. `docs/qiita_assets/01_studio_pro_overview.png`:
   - Top eye-catch & system overview.
   - Caption: "自作動画制作スタジオ『STUDIO PRO』ダッシュボード：12カット並列オーケストレーションと絵コンテ・プロンプト一括調律画面"
2. `docs/qiita_assets/02_cut_editor_detail.jpg`:
   - Cut Editor detail screen.
   - Caption: "『CUT EDITOR PRO』：カットごとのテロップ設計、金文字強調キーワード抽出、カメラワーク・トランジション演出、プロンプトインスペクタ"
3. `docs/qiita_assets/03_style_matrix_multi.png`:
   - Style matrix generation.
   - Caption: "マルチ画風マトリックス比較エンジン：単一の脚本から複数の世界観（ネオ・エンブレム、日常系、浮世絵等）を並列シミュレーション"
4. `docs/qiita_assets/04_style_matrix_ukiyoe.png`:
   - Traditional & artistic style variations.
   - Caption: "画風バリエーション検証：ゆる浮世絵・戯画調、アール・ヌーヴォー調における歴史的カットの表現力検証"

---

## 📖 Case Study Topic: "英国発祥のカレーがなぜ国民食に？奇跡の進化録"
- Use this exact historical documentary scenario as the running example throughout the article.
- Highlight the **"Leonardo da Vinci Ancient Manuscript & Ghibli-esque Workshop Animation"** aesthetic used in the screenshots:
  - Ancient naval charts, sepia ink hatching, drafting compasses, magnifying glasses, and a young apprentice engineer analyzing the steam-rising blueprint of curry on rice.
  - Explain how the pipeline maintains character consistency (the young drafting boy with round spectacles) across multiple camera angles (wide shot, close-up, medium).

---

## 📐 Required Article Structure (Follow `docs/qiita_references/` 100%)

The generated file `docs/articles/200_video_pipeline_qiita.md` must include:

1. `<!-- GTE_PUBLISHED: false -->`
2. `<!-- 000 タイトル定義 -->`
   `# 【全自動映像工場】「朝起きたら動画が50本出来ている」を実現する、Google Cloud × 自作UIによる超自律型動画量産パイプライン`
3. `<!-- 001 冒頭イメージ画像挿入エリア -->` (`01_studio_pro_overview.png`)
4. `<!-- 002 導入部：背景となる課題とシステム化の動機 -->`
   - Humorous yet relatable motivation: The sheer exhaustion of manual video editing, keyframe synchronization, subtitle timing, and prompt fatigue. The dream of sleeping while the cloud factory churns out 50 high-retention video packages.
5. `<!-- 003 本記事の概要（3行まとめ） -->`
   - 1. 解決する課題 (Prompt drift & video editing time sink)
   - 2. 採用したアーキテクチャ (React STUDIO PRO × Cloud Run × Pub/Sub × Vertex AI)
   - 3. 実証成果 (50 video pipelines generated overnight with zero prompt collapse)
6. `<!-- 100 🏗️ 1. アーキテクチャ概要 -->`
   - Detailed Mermaid flowchart showing the symmetric architecture:
     - `subgraph Local ["💻 ローカル開発・スタジオUI (青背景)"]`
     - `subgraph Google_Cloud ["☁️ Google Cloud サーバーレス映像生成基盤 (緑背景)"]`
7. `<!-- 200 🎬 2. 12カット連続性保証：マルチモーダル調律ステートマシン -->`
   - Embed `02_cut_editor_detail.jpg`.
   - Explain how camera angles, dynamic multi-panels, Ken Burns pacing, and subtitle text tokens are compiled into a unified generation payload.
8. `<!-- 300 🎨 3. 画風マトリックス検証とプロンプト・インスペクタ -->`
   - Embed `03_style_matrix_multi.png` and `04_style_matrix_ukiyoe.png`.
   - Explain automated style injection, palette temperature tuning, and negative prompt guardrails.
9. `<!-- 400 ⚡ 4. スケーラビリティと耐障害性：非同期キューと指数バックオフ -->`
   - Handling rate limits (429 Too Many Requests), distributed Cloud Tasks retries, and generation idempotency.
10. `<!-- 500 ⚠️ ハマりポイント注意 -->`
    - Deep technical gotchas: Video diffusion temporal jitter, audio-subtitle drift, aspect-ratio safe-zone cropping (1:1 master to 9:16 / 16:9).
11. `<!-- 600 🏁 まとめと今後の展望 -->`
    - High-level wrap-up, celebrating full pipeline autonomy.

---

## 🛠️ Verification & Deliverables
1. Write the full markdown to `docs/articles/200_video_pipeline_qiita.md`.
2. Ensure markdown formatting, Mermaid syntax, and HTML image tags are 100% valid.
3. Commit and prepare a clean Pull Request.
