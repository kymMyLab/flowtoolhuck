# 🚀 Jules Mission: FlowTool Studio Pro Comprehensive Debug & Health Check

## 📌 Mission Objective
You are assigned a comprehensive debugging and hardening mission for **FlowTool Studio Pro** (`kymMyLab/flowtoolhuck`).
Recently, we added:
1. **Dynamic Model Switching & Independent Quota Fallback**:
   - `🍌 Nano Banana 2` (Nano Banana 2.1) automatically fails over to `🍌 Nano Banana Pro` when hitting rate limits (`429`, `403`, `RESOURCE_EXHAUSTED`, or quota exhaustion).
   - Applied across `src/services/useStudioProduction.ts`, `src/services/pipelines/pipelineAssetFactory.ts` (turnaround sheets & infographic covers), and `src/services/pipelines/shortsBatchPipeline.ts`.
2. **True Cut Completion Validation & Abort Safety**:
   - Prevention of premature "preview done" marking or blank cover rendering when generation is aborted or incomplete.

There is no critical defect reported by the user, but we want an all-around health check and debugging pass to ensure rock-solid stability and zero regressions.

---

### 🎯 Primary Directives for Jules:

#### 1. Model Switching & Fallback Audit (バナナモデル切り替え・フォールバックの総合点検)
- Review `src/services/useStudioProduction.ts`, `src/services/pipelines/pipelineAssetFactory.ts`, and `src/config/studioDefinitions.ts`.
- Ensure fallback logic correctly preserves prompt fidelity (turnaround references, safe aspect ratio, detailed style descriptions) without unintended data loss.
- Verify that error detection strings (`使用量の上限`, `429`, `403`, `RESOURCE_EXHAUSTED`) are handled gracefully and without infinite retry loops.

#### 2. Pipeline Robustness & Abort Handling (パイプライン中断・未完了処理の検証)
- Inspect `src/services/pipelines/shortsBatchPipeline.ts`, `src/services/pipelines/seriesProductionPipeline.ts`, and `src/services/useStudioProduction.ts`.
- Verify that `isAbortedRef.current` cleanly stops ongoing loops without leaving unhandled background promises or corrupting `episodesRef`.
- Ensure that resuming generation (`handleGenerateRemaining`) properly picks up only pending cuts and correctly transitions episode status upon true completion.

#### 3. Memory Leak Prevention & Event Listener Lifecycle (メモリ・リソースの解放点検)
- **Object URL Revocation**:
  - Scan for `URL.createObjectURL()` in `src/services/` and `src/components/`, ensuring corresponding `URL.revokeObjectURL()` calls in cleanup blocks.
- **Event Listeners & Timers**:
  - Check `addEventListener` calls (`dragenter`, `drop`, `keydown`, `resize`, `message`). Verify proper `removeEventListener` execution.
  - Verify all `setTimeout` / `setInterval` references are cleared on component unmount.

#### 4. Type Safety & Code Hygiene (型安全性の向上・エッジケース堅牢化)
- Fix loose `any` types where practical (especially around `Flow.generate.image` responses and episode state updates).
- Verify JSON operations (e.g., in `musicImporter.ts` or storage helpers) are wrapped with safe parsing to prevent uncaught runtime errors.

---

### 🧪 Automated Verification & Deliverables
1. **Build Validation**:
   - Run `npm run build` and ensure `dist/bundle.js` builds with 0 errors and 0 warnings.
   - Maintain single-bundle architecture (`inlineDynamicImports: true`).
2. **Automated Pull Request**:
   - Automatically open a GitHub Pull Request against `main`.
   - Provide a clear PR summary detailing your findings, fixes, and health check results.

---

### 🛡️ Operational Constraints
- `requirePlanApproval: false` (Full Autonomy - do not block waiting for human plan approval)
- `automationMode: "AUTO_CREATE_PR"` (Automatically submit PR upon completion)
- Do NOT delete existing features (100+ character archetypes, taste showroom, series resume, cover renderer, etc.).
- Client-side single bundle execution only.
