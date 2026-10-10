# 🚀 Jules Mission: Comprehensive Review & Debugging of Qiita Article (`docs/articles/200_video_pipeline_qiita.md`)

## 📌 Mission Objective
You are tasked with thoroughly reviewing, proofreading, and debugging the newly authored Qiita technical article located at `docs/articles/200_video_pipeline_qiita.md`.
The article documents an End-to-End automated video generation pipeline ("STUDIO PRO" × Multi-Agent System × Google Cloud Veo / Vertex AI / Cloud Run / Pub/Sub).

Your mission is to perform a **comprehensive quality, consistency, and compliance audit** on the article:
1. **Check for Inconsistencies & Logical Bugs**:
   - Ensure the episode count narrative is consistent throughout:
     - Target / goal is 50 episodes.
     - Actual result was 48 episodes completed, because the browser hit memory limits (OOM), which dramatically proves why enterprise pipelines must decouple and use **Cloud Pub/Sub + Cloud Run/Batch**.
   - Ensure model naming is uniform: "Gemini 3.8 Flash", "Google Veo 3.1", "Nano Banana 2.1/Pro (Imagen技術)".
   - Ensure all image links (`../qiita_assets/*.png`, `*.jpg`, `*.svg`) strictly match actual files in `docs/qiita_assets/`.
2. **Strict Verification of Prohibited / Secret Terms**:
   - ❌ **ジブリ (Ghibli)**: Absolute zero tolerance.
   - ❌ **PTE / TikTok / リリア / Remotion / 左翼 / 右翼 / 飛翔 / Gemini 1.5 Pro**: Must NOT appear.
   - ❌ **Google Flow / DevTools hack / iframe mount / Tampermonkey / 0pt**: Absolute zero tolerance. The system must always be presented as custom React/TypeScript "STUDIO PRO" communicating with Google Cloud.
   - ❌ **1:1 to 9:16/16:9 responsive safe-zone cropping**: This is a proprietary trade secret (企業秘密) and must NOT be revealed in the article.
3. **Markdown Syntax & Readability Polish**:
   - Verify all code blocks (TypeScript, JSON, ASCII diagrams) have correct syntax highlighting tags.
   - Fix any typos, awkward phrasing, or formatting glitches.
   - Preserve the passionate, comedic intro and developer voice.

---

## 🛠️ Actions to Take
1. Read `docs/articles/200_video_pipeline_qiita.md` carefully from start to finish.
2. Check `docs/qiita_assets/` to verify all referenced images exist.
3. If any typos, formatting issues, broken links, or inconsistencies are found, fix them directly in `docs/articles/200_video_pipeline_qiita.md`.
4. Ensure no prohibited words or proprietary secrets exist.
5. Create a clean Pull Request with a clear summary of all checks and refinements made.
