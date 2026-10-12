# 🚀 Jules Mission: Overnight Code Health, Anti-Spaghetti & Modularity Audit

## 📌 Mission Objective
You are tasked with an overnight deep-refactoring and architectural health check of the **FlowTool Studio Pro** codebase (`src/`).
Your goal is to inspect large and complex files (approaching or exceeding 500-800+ lines), identify spaghetti code or tightly coupled logic, and perform surgical modularization without altering any runtime behavior.

---

## 🔍 Priority Audit Targets

### 1. Large Files & Structural Bloat
Investigate the largest modules in `src/` and extract cohesive sub-modules / helpers where appropriate:
- `src/config/studioDefinitions.ts` (~819 lines):
  - Separate static registries (models, video definitions, aspect ratios) from dynamic helper resolvers.
- `src/components/CastManagerModal.tsx` (~779 lines):
  - Decouple internal modal tab views, crop helpers, and character prompt utilities into clean sub-components.
- `src/services/useStudioProduction.ts` (~705 lines):
  - Review state orchestration to ensure pipelines and action handlers maintain clean separation of concerns.
- `src/App.tsx` (~642 lines):
  - Review modal rendering and state dispatchers to keep the root component clean and readable.
- `src/services/export/coverRenderer.ts` (~571 lines):
  - Keep canvas typography, 9:16 vertical poster rendering, and 16:9 master cover rendering organized and modular.

### 2. Anti-Spaghetti & Code Smell Elimination
- **Excessive Nesting & Long Functions**: Refactor deeply nested callbacks, oversized functions (>80 lines), and duplicate logic into clean, reusable utility functions.
- **Dead Code & Unused Imports**: Clean up unused variables, dead code branches, or legacy experimental flags that clutter readability.
- **Type Safety Polish**: Eliminate any unnecessary `any` types where concrete TypeScript interfaces exist in `src/types.ts`.

---

## 🛡️ Strict Constraints & Operational Safeguards
1. ❌ **Zero Breaking Changes**:
   - MUST preserve 100% functional equivalence.
   - All exported function signatures, React component props, and public interfaces MUST remain backward-compatible.
2. ❌ **Strict Build Verification**:
   - `npm run build` MUST compile cleanly with zero TypeScript errors and zero bundling issues.
3. ❌ **Confidentiality & Compliance**:
   - Do NOT introduce or expose internal hack terms (e.g., `0pt`, `iframe mount`, `Tampermonkey`, `DevTools console hack`). The studio must always represent custom React/TypeScript technology interfacing with Google Cloud.
4. ❌ **Preserve All Work Completed in v2.4.x**:
   - Retain the YouTube Shorts algorithm mastery engine (`musicImporter.ts`).
   - Retain the direct zero-latency Veo 3.1 video generation logic (`useVideoGeneration.ts`).
   - Retain the 16:9 Master Cover UI docking and smart typography wrapping (`coverRenderer.ts`, `EpisodeSection.tsx`).

---

## 🛠️ Actions to Take
1. Audit the repository starting from the largest files.
2. Perform surgical, step-by-step refactoring with clean commit organization.
3. Run `npm run build` to verify clean compilation.
4. Create a clean Pull Request with a comprehensive summary of all refactored areas and safety checks.
