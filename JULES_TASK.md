# 🚀 Jules Mission: Comprehensive Debugging & Hardening for STUDIO PRO (v2.4.2)

## 📌 Mission Objective
You are tasked with performing an exhaustive code audit, stress-testing, and debug hardening of the newly enhanced **STUDIO PRO** production pipeline (v2.4.2).
Focus areas:
1. **Shorts Algorithm Universal Mastery Engine** (`src/services/musicImporter.ts`)
2. **Automated Batch Production Pipeline** (`src/services/pipelines/shortsBatchPipeline.ts`, `src/services/pipelines/seriesProductionPipeline.ts`)
3. **Veo 3.1 Direct Video Generation Engine** (`src/services/useVideoGeneration.ts`, `src/config/studioDefinitions.ts`)

---

## 🔍 Specific Audit & Debug Targets

### 1. `musicImporter.ts` (Shorts Algorithm Mastery Engine)
- **Cut Structure Verification**: Ensure all 12 cuts follow the precise algorithmic pacing:
  - Cut 01: High-emotion extreme close-up hook (Swipe-prevention).
  - Cut 04: Pause-trap & clue placement (Rewatch/Freeze provocation).
  - Cut 09 & 10: Clue discovery & macro prop inspection.
  - Cut 12: Void Loop ending (Seamless loop back to Cut 01).
- **Edge Case Protection**: Check handling when incoming lyrics or sections are shorter than 12 lines, contain special characters, or lack clear structure. Ensure safe fallbacks prevent any `undefined` access or runtime crashes.
- **Video Selection Synchronization**: Verify `isSelectedForVideo` is properly initialized based on `videoRatio` (e.g., 30% selecting cuts 1, 5, 9, 12).

### 2. `shortsBatchPipeline.ts` & `seriesProductionPipeline.ts`
- **Episode Loop Video Automation**: Confirm that when `settings.autoVideo` is enabled, `handleBulkVideo(epIndex)` is cleanly executed after infographic cover generation for each episode.
- **Safety Net**: Verify the automatic rescue selection logic fires properly if `selectedCuts.length === 0` but `autoVideo` is ON.
- **Abort & Cancellation**: Ensure `isAbortedRef.current` is checked at every stage to prevent orphan background generation or memory leaks.

### 3. `useVideoGeneration.ts` (Veo Direct Generation)
- **Zero-Latency Calling**: Confirm `Flow.generate.video` is called without `modelDisplayName` (internal API requirement) and with valid aspect ratios (`9:16` or `16:9`).
- **Safety Mode Resilience**: Ensure the policy retry block (`ultraSafePrompt`) also adheres to direct default calling without extraneous model parameters.
- **Exponential Backoff**: Validate that retry logic gracefully handles rate limits and network drops.

---

## 🛡️ Strict Operational Constraints
- ❌ **Build Integrity**: `npm run build` MUST compile cleanly without any TypeScript or bundling errors.
- ❌ **Prohibited Terms & Secrets**:
  - Never expose internal hack terms (e.g. Tampermonkey, iframe mount, 0pt, DevTools console hacks) in public-facing files or UI text.
- ❌ **No Breaking Changes**: Maintain full backward compatibility for existing series manifests and user presets.

---

## 🛠️ Actions to Take
1. Review the target files and trace the execution path.
2. Identify any type mismatches, race conditions, or unhandled promise rejections.
3. Apply surgical fixes and hardening directly to the codebase.
4. Run `npm run build` to verify clean compilation.
5. Create a clean Pull Request summarizing all verified items and fixes.
