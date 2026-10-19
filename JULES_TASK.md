# 🚀 Jules Mission: AI-Driven Lyric Visual Director (Gemini Integration & Cinematic Pacing)
## (Geminiによる歌詞ビジュアル自律判断＆映画的緩急バランスエンジンの実装)

## 📌 Mission Background & Critical User Directives
The user provided creative and architectural guidance for music video cut generation:

1. **Avoid Hardcoded Regex Dictionaries (1億通りの歌詞に対応する根本解決)**:
   - Hardcoding keyword patterns (mugs, umbrellas, bicycles, etc.) cannot scale to infinite variations of song lyrics.
   - Instead, integrate a **Gemini inference step** (`Flow.generate.text`) that reads the lyrics, understands poetic context, metaphors, quantities, and emotional nuance, and autonomously determines the optimal visual motifs, props, and staging directives.

2. **Cinematic Balance & Dynamic Pacing (30カット全部が物だと涙目！適宜判断する緩急の黄金比)**:
   > **User Directive:**
   > 「すべてのシーンがそれでも面白くないから適宜判断する感じでね。物があって30Cut全部物だと涙目だからね(笑) いい感じに処理するように伝えておいて」
   - **CRITICAL ANTI-PATTERN**: Do NOT turn all cuts into inanimate still-life object shots! A music video must center on human emotion, expressive faces, and kinetic drama.
   - **Balanced MV Composition (映画的緩急)**:
     - **Character-Driven Cuts (65%–75%)**: Protagonist's expressive eyes, bust shots, side profiles, singing postures, walking, looking up at the sky, contemplative glances.
     - **Integrated Prop & Environment Cuts (15%–25%)**: Protagonist interacting within the environment where the lyric's props naturally appear (e.g., *protagonist sitting pensively at a low table, with two ceramic mugs placed side by side in the foreground, delicate steam rising*).
     - **Dedicated Still-Life Inserts (5%–10% max, e.g., 2–3 cuts per 30 cuts)**: Only for punchy, dramatic cutaways (like Cut 10 / bridge transition) where a pure macro prop shot creates maximum poetic impact.

---

### 🎯 Directives for Jules (Full Autonomy - End-to-End Implementation):

#### 1. Implement `analyzeLyricVisualsWithGemini` in `src/services/directorService.ts`
Create an async helper function that calls `Flow.generate.text` with a dedicated prompt:
- **Input**:
  - `lyricLines`: Array of `{ cutId: number, lyric: string, section?: string }`
  - `theme`: Song theme or title
  - `characterContext`: Protagonist profile/attire summary
- **Prompt Design**:
  - Instruct Gemini as a master cinema/anime MV director.
  - Require Gemini to output structured JSON:
    ```json
    [
      {
        "cutId": 1,
        "stagingType": "character_with_props" | "character_focused" | "scenic_prop_insert",
        "propMotif": "two ceramic coffee mugs side by side with rising steam",
        "action": "sitting at table in contemplative stillness, looking out the window",
        "visualPromptEn": "protagonist sitting at a cozy low wooden table, two ceramic coffee mugs placed side by side in foreground with gentle rising steam, soft morning light streaming through curtains"
      }
    ]
    ```
  - Enforce the **Pacing Rule**: Keep pure `scenic_prop_insert` to no more than 2–3 cuts across the entire song. Emphasize `character_with_props` or `character_focused` for the rest, so the human story remains front and center!
- **Resilience & Fallback**:
  - Wrap in `callWithRetry` with proper error handling and JSON parsing fallback.
  - If API call fails, seamlessly fall back to existing `UNIVERSAL_CINE_CYCLE` and `extractLyricVisualPlot` so execution never crashes.

#### 2. Pipeline Integration (`src/services/useStudioProduction.ts` / Batch Generation)
- Before batch image generation begins (or when preparing prompts in `useStudioProduction.ts` / `convertTrackToEpisode`), check if the episode has unanalyzed MV lyrics.
- Trigger `analyzeLyricVisualsWithGemini` in a single batch call (efficient, fast, 1 API call for 30 cuts) and cache/map the enriched `visualPromptEn` onto each cut's prompt.
- For single-cut on-demand regeneration (`handleGenerateSingleImage`), if a cut has not been analyzed yet, allow lightweight on-the-fly resolution or use the cached plot.

#### 3. Verification & Safety
- Verify that `extractLyricVisualPlot` in `src/services/musicImporter.ts` still functions gracefully as a deterministic fallback.
- Ensure the protagonist's DNA, character expressions, and style presets blend harmoniously with the Gemini-generated lyric prompt components.
- Run `npm run build` and ensure `dist/bundle.js` compiles cleanly with **0 errors and 0 warnings**.

#### 4. Automated PR Submission (CRITICAL)
- **DO NOT STOP OR PAUSE FOR USER CONFIRMATION**. Complete the entire mission end-to-end.
- Open an automated Pull Request against `main` explaining:
  - How Gemini was integrated into the MV lyric visual pipeline.
  - How the pacing rule prevents "monotonous object-only cuts" while nailing exact lyric motifs (like the two steaming mugs).
  - Confirmation of clean `npm run build`.

---

### 🛡️ Constraints:
- Single client-side bundle execution (`inlineDynamicImports: true`).
- Keep existing character presets, taste showroom, and 10 universal cinematic cycles intact.
- High error tolerance: Any Gemini JSON parse error or rate limit must cleanly fall back without breaking the batch pipeline.
