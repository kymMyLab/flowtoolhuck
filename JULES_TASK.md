# 🚀 Jules Mission: FlowTool Studio Pro Comprehensive Refactoring, Anti-Spaghetti Audit & Deep Optimization

## 📌 Mission Background & Objective
You are assigned a critical autonomous optimization and refactoring mission for **FlowTool Studio Pro** (`kymMyLab/flowtoolhuck`).
The user is resting and has requested a thorough, overnight autonomous audit to inspect the entire codebase for:
1. **Spaghetti Code & Structural Inefficiencies (スパゲッティ化コードの解消・構造的リファクタリング)**
2. **Performance Bottlenecks & Redundant Execution (非効率な処理・不要な再計算の最適化)**
3. **Robustness, Unhandled Promise Rejections & Memory Leak Prevention (堅牢化とメモリリーク防止)**

---

### 🎯 Primary Directives for Jules:

#### 1. Anti-Spaghetti & Modularity Refactoring (スパゲッティコードの解体・モジュール化)
- **Target Large Files**:
  - `src/components/music/MusicImportModal.tsx` (~1700+ lines): Extract reusable subcomponents (e.g. `TasteShowcaseGrid`, `CharacterSelectorAccordion`, `CoverThemeSelector`) or hook logic to streamline the file and enhance readability.
  - `src/services/musicImporter.ts` & `src/services/directorService.ts`: Check for duplicated visual-hint parsing, prompt-string builders, and helper utilities. Unify them cleanly into modular helper functions.
  - `src/services/export/coverRenderer.ts`: Ensure canvas context operations, palette resolution, and text splitting run cleanly with zero canvas context leak.
- **Rules of Engagement**:
  - Keep each refactored file maintainable and focused.
  - NEVER break any existing public exports, function signatures, or modal interfaces.
  - Ensure `100% Single Bundle` architecture builds cleanly (`inlineDynamicImports: true`).

#### 2. Deep Performance & Efficiency Audit (非効率な箇所の徹底改善)
- **State Management & Unnecessary Re-renders**:
  - Check React hooks (`useEffect`, `useCallback`, `useMemo`) across `App.tsx`, `EpisodeSection.tsx`, `MusicImportModal.tsx`, and `useStudioProduction.ts`.
  - Fix any missing dependency arrays or dependencies that cause infinite loops or excessive re-renders.
  - Optimize array searches (`.find()`, `.filter()`) inside render loops with Memoization or Map/Set lookups where appropriate.
- **Canvas & Media Object URL Leaks**:
  - Ensure all temporary `URL.createObjectURL()` calls have corresponding `URL.revokeObjectURL()` cleanup.
  - Verify `OffscreenCanvas` fallback and garbage collection.

#### 3. Edge Case Handling & Bug Elimination (潜在バグの根絶)
- **Strict Verification of Recent Fixes**:
  - Verify `resolveTasteKey` in `tasteStorage.ts` correctly handles all short IDs and partial queries without breaking.
  - Verify `buildDynamicAntiPreviousNegative` in `promptEngine.ts` correctly blocks repeated props (umbrella, bicycle), poses (standing, front-facing), and angles.
  - Verify that `MusicImportModal` parses JSON and plain text formats cleanly without throws.
- **Type Safety & Lint**:
  - Eliminate any `any` casts where strong types (`Episode`, `Cut`, `CoverPalette`, etc.) can be applied.

---

### 🧪 Automated Verification & Deliverables
1. **Build Validation**:
   - Run `npm run build` and ensure `dist/bundle.js` is generated with 0 errors and 0 warnings.
2. **Automated Pull Request**:
   - Once all improvements, refactorings, and validations are complete, create a clean GitHub Pull Request against `main`.
   - Provide a clear, detailed PR description outlining:
     - Files refactored
     - Inefficiencies resolved
     - Memory/lifecycle optimizations implemented
     - Verification test steps taken

---

### 🛡️ Strict Operational Constraints
- `requirePlanApproval: false` (Full Autonomy - do not block waiting for plan approval)
- `automationMode: "AUTO_CREATE_PR"` (Automatically submit PR upon completion)
- Do NOT delete existing features (100+ character archetypes, taste showroom, series resume, cover renderer, etc.).
- Maintain zero backend dependencies (client-side only single bundle).
