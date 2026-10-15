# 🚀 Jules Mission: FlowTool Studio Pro Deep Performance, Memory Leak & Type Safety Audit

## 📌 Mission Objective
You are assigned an autonomous optimization and hardening mission for **FlowTool Studio Pro** (`kymMyLab/flowtoolhuck`).
The modular splitting of `MusicImportModal.tsx` has already been completed by Antigravity IDE.
Your primary objective is a **deep technical audit** focusing on:
1. **Memory Leak Prevention & Resource Cleanup (メモリリーク防止・リソース解放)**
2. **Performance Bottlenecks & Hook Optimization (不要な再レンダリング・非効率計算の解消)**
3. **Type Safety Hardening & Edge Case Robustness (型安全性の強化・any撲滅・エッジケース堅牢化)**

---

### 🎯 Primary Directives for Jules:

#### 1. Memory Leak & Lifecycle Audit (メモリリーク・イベントリスナーの徹底点検)
- **Object URL Revocation**:
  - Scan all files (`src/services/`, `src/components/`) for `URL.createObjectURL()`.
  - Ensure every generated Blob URL has a corresponding `URL.revokeObjectURL()` inside `useEffect` cleanup or promise `.finally()` blocks.
- **Event Listeners & Timers**:
  - Check all `addEventListener` calls (`paste`, `dragover`, `drop`, `focus`, `storage`, `resize`).
  - Verify that matching `removeEventListener` calls are correctly executed in cleanup functions.
  - Ensure any `setTimeout` or `setInterval` handles are properly cleared on unmount.
- **Canvas / Media Resources**:
  - Verify that canvas context operations (`coverRenderer.ts`, `browserVideoService.ts`) release image/canvas buffers properly to prevent GPU/DOM memory inflation.

#### 2. Performance & Re-render Optimization (React Hooks & 計算の最適化)
- **Hooks Dependency Arrays**:
  - Inspect `src/services/useStudioProduction.ts`, `src/components/EpisodeSection.tsx`, `src/components/music/MusicImportModal.tsx`, and `src/App.tsx`.
  - Fix any missing or unstable hook dependencies in `useEffect`, `useCallback`, `useMemo` that could lead to infinite loops, stale closures, or excessive re-renders.
- **Hot-Loop Lookups**:
  - Replace frequent `.find()` / `.filter()` calls inside render passes with `useMemo` or `Map`/`Set` caching, especially for archetypes, character lookups, and taste gallery queries.

#### 3. Type Safety & Robustness (型安全性の向上)
- **Eliminate `any` Casts**:
  - Replace loose `any` types in `musicImporter.ts`, `promptEngine.ts`, `directorService.ts`, and `MusicImportModal.tsx` with strict interfaces (`Episode`, `Cut`, `ImportedTrack`, `CastCharacter`, `CoverPalette`, etc.).
- **Robust Exception Handling**:
  - Ensure JSON parsing in `musicImporter.ts` gracefully handles malformed payloads, truncated strings, or unexpected keys with informative fallback messages rather than crashing.

---

### 🧪 Automated Verification & Deliverables
1. **Build Validation**:
   - Run `npm run build` and ensure `dist/bundle.js` builds with 0 errors and 0 warnings.
   - Maintain the single-bundle architecture (`inlineDynamicImports: true`).
2. **Automated Pull Request**:
   - Automatically open a GitHub Pull Request against `main`.
   - Provide a clear PR summary detailing the fixes, memory cleanups, and optimizations.

---

### 🛡️ Operational Constraints
- `requirePlanApproval: false` (Full Autonomy - do not block waiting for plan approval)
- `automationMode: "AUTO_CREATE_PR"` (Automatically submit PR upon completion)
- Do NOT delete existing features (100+ character archetypes, taste showroom, series resume, cover renderer, etc.).
- Client-side single bundle execution only.
