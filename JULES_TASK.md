# 🚀 Jules Mission: Universal Style Consistency & Ambient Veo Directing
## (全ジャンル共通 画風維持・三面図独立生成・Veo動画鎮静化＆画風保護の実装)

## 📌 Mission Background & Critical User Issues
The user identified 4 critical bugs and behavioral defects during multi-episode batch generation and Veo video creation:

1. **Style Consistency Breakdown (30枚中1枚が超リアル・実写化してしまう)**:
   - When generating 30 cuts in an anime or stylized theme, 1 cut suddenly turned photorealistic.
   - **Root Cause**: In `src/services/useStudioProduction.ts`, retry/safety rescue logic (`slice(0, 500)`, `currentNegative = ''`, `currentRefIds = undefined`, adding `cinematic masterpiece`) strips out the master style anchor, drops negative prompts (photorealistic exclusions), and discards reference images (turnaround sheets).

2. **Veo Style Mutated in the Middle (8秒Veo動画の真ん中4秒だけリアル化・画風崩壊)**:
   - In an 8-second Veo video, seconds 0–3 retained the start frame's anime style, but seconds 3–7 mutated into photorealistic CG because the prompt had no style constraint and the `Midway` prompt directive contained realistic cinematic keywords ("ambient reflections", "specular highlights", "fluid parallax").

3. **Character Turnaround Duplication Across Batch (5本制作して5本とも全く同じ三面図)**:
   - In batch production of 5 independent episodes, all 5 episodes used the exact same character turnaround sheet.
   - **Root Cause**: In `src/services/pipelines/pipelineAssetFactory.ts`, `activeReferenceRef.current?.mediaId` was carried over from episode 1, causing `ensureCharacterTurnaround` to skip generating new sheets for episodes 2–5.

4. **Veo Camera & Scene Motions Overly Violent/Busy (8秒の中でカメラやシーンが動きすぎる・変わりすぎる)**:
   - Current `veoMotionPrompt` presets in `src/services/directorPrompts.ts` and `src/services/directorService.ts` try to do too much in 8 seconds (180-degree camera orbits, steep crane ascents, abrupt zoom-ins).
   - In 8-second short clips (especially Anime MVs and Edo/Historical dramas), subtle ambient motion (gentle wind swaying hair/fabric, slow breathing, subtle gaze shift, slow elegant micro-pan) looks far more aesthetic and prevents AI morphing deformities.

---

## 🎯 Directives for Jules (Full Autonomy - End-to-End Implementation):

### 1. Style Anchor Preservation in `src/services/useStudioProduction.ts`
- **Rule**: Never strip the artistic style anchor, photorealistic negative prompts, or character turnaround reference images during retries or safety rescue.
- Ensure that even in `isPolicyIssue` retries and the final fallback rescue mode:
  1. The **Master Art Style Anchor** (e.g. `[MASTER ART STYLE: ...]`) from Layer 1 is **always preserved** at the front of the prompt.
  2. The **Negative Prompt** keeps essential exclusions (e.g. if the style is non-photo, `photorealistic, realistic photo, 35mm photograph, DSLR, raw photograph` must NOT be cleared).
  3. The `referenceImageMediaIds` (turnaround sheet / character anchor) must NOT be set to `undefined` unless explicitly instructed for pure inanimate object cuts.

### 2. Veo Video Style Protection & Prompt Sanitization in `src/services/useVideoGeneration.ts`
- When constructing `finalVideoPrompt` for `Flow.generate.video`:
  1. Inject a strong **Style Preservation Directive** based on the episode/cut's style at the very beginning of the prompt:
     `[MASTER ART STYLE MANDATE]: Strictly maintain the identical rendering medium, visual aesthetic, and artistic art style of the first frame image throughout the entire duration. Zero drift into photorealism or 3D CG textures.`
  2. Prevent prompt text from introducing photorealistic keywords ("photoreal", "hyper-detailed reflections", "35mm DSLR") when the source cut is stylized (anime, manga, ukiyo-e, pixel art, watercolor).

### 3. Reset Character Reference Across Independent Batch Episodes
- In `src/services/pipelines/shortsBatchPipeline.ts` and `src/services/pipelines/pipelineAssetFactory.ts`:
  - When starting a new episode in a batch (unless explicitly marked as a continuous multi-part story sharing the exact same protagonist), **reset `activeReferenceRef.current`** so that `ensureCharacterTurnaround` generates a fresh, unique character model sheet tailored to the new episode's theme and DNA.
  - Verify that each generated episode maintains its own unique character turnaround mediaId and base64.

### 4. Ambient & Calmed Veo Motion Directives
- Update `veoMotionPrompt` presets and templates in `src/services/directorPrompts.ts` and `src/services/directorService.ts`:
  - Replace violent multi-step acrobatics (180-degree orbits, high crane flyaways) with **subtle, high-fidelity ambient motions**:
    - *Example*: Gentle ambient wind swaying clothing and hair, subtle micro-push/drift, quiet contemplation, peaceful gaze shift, soft atmospheric dust particles or lighting play.
  - Ensure these calmed motions apply universally to MV, historical/Edo drama, and standard YouTube Shorts modes.

---

## 🛡️ Verification & Safety Constraints
1. **Build Integrity**: Ensure `npm run build` succeeds without TypeScript or Vite compilation errors.
2. **Zero Regressions**: Preserve existing features (Media Vault prompt rules, lyric analysis, fallback retries, multi-panel support).
3. **Automated PR**: Once verified, commit and create a Pull Request on GitHub.
