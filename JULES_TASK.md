# 🚀 Jules Mission: FlowTool Studio Pro Comprehensive Deep Debugging & Drag & Drop Architecture Exhaustive Audit

## 📌 Mission Background & Objective
You are assigned a critical, high-impact mission for **FlowTool Studio Pro** (`kymMyLab/flowtoolhuck`).
The user has allocated extensive runtime (up to 12 hours) for you to autonomously and thoroughly inspect, debug, and optimize the codebase, and to solve one of the most desired and stubborn features: **Flawless Drag-and-Drop (D&D) file ingestion**.

### 🎯 Primary Objectives:
1. **Comprehensive Deep Debugging across Studio Pro (全機能の総合的デバッグ)**
   - Conduct a systematic, deep audit of all TypeScript/React components, services, pipelines, and state managers.
   - Eliminate hidden bugs, race conditions, unhandled Promise rejections, DOM cleanup leaks, memory leaks, and any lingering reference errors.
   - Verify that the recent architectural evolution to **100% Single Bundle (`inlineDynamicImports: true`)** builds cleanly with 0 errors and that all modals (`ThemeEditorModal`, `TasteEditorModal`, `CastManagerModal`, `ComicCreationWizardModal`, `MusicImportModal`, `TasteShowroomModal`) mount instantly and reliably without any secondary network chunk dependencies.
   - Re-verify that the newly added **Cast Lock Toggle (default OFF)** and **JSON-priority dynamic action prompt generation** in `MusicImportModal` and `musicImporter.ts` function perfectly with diverse prompt generation (avoiding repetitive poses/scenes).

2. **Drag & Drop (D&D) Exhaustive Root-Cause Investigation, Comparative Analysis & Flawless Implementation (ドラッグ＆ドロップの徹底解剖と完全実現)**
   - **Crucial Requirement**: The user strongly insists on making Drag & Drop work reliably on Windows Chrome when mounted in Google Flow (`flow.google.com`), and demands a comprehensive report detailing what might be causing failures by comparing past implementations.
   - **Historical Commit Analysis**:
     Investigate and compare the historical D&D implementations across Git history:
     - `5014ac2` ("restore clean direct event handling from v2.4.0, remove multi-layer capturing listeners")
     - `82738e2` ("replace blocking modals with 2-button interactive inline accordions, eliminating backdrop D&D interference")
     - `56d63b1` ("definitive drag and drop fix with native covering input and zero flicker v2.5.11")
     - `ea8a84c` ("fix D&D overlay collision v2.5.8")
     - Analyze why each approach succeeded or failed in the target browser/iframe environment.
   - **Exhaustive Failure Hypotheses & Edge Cases**:
     Investigate and document every potential obstacle:
     - **Iframe Boundary & Security Context**: Cross-origin / same-origin iframe boundaries in Google Flow, event dispatching restrictions from OS file drag into nested frames.
     - **HTML5 Drag & Drop API Gotchas**: The mandatory requirement of `e.preventDefault()` on both `dragover` AND `dragenter` (without which the browser cancels the drop operation).
     - **Target Element Hierarchy & Flickering**: Child elements (icons, text, labels) receiving mouse events causing spurious `dragleave` events unless `pointer-events-none` is applied or a drag depth counter is maintained.
     - **Native `<input type="file">` vs Dropzone Div Collision**: Invisible overlay inputs capturing or intercepting drag events inconsistently on Chromium on Windows.
     - **Windows Chrome File Drag DataTransfer Quirk**: Behavior of `e.dataTransfer.types` (checking for `'Files'`) and security sandbox restrictions during `dragover` vs `drop`.
     - **Window-Wide Dropzone Overlay**: Providing a global window-level drag listener (`window.addEventListener('dragenter')`) that highlights the entire screen or relevant zone when a file is dragged from the desktop anywhere into the browser window.
   - **Investigation Report Deliverable**:
     Create and commit a dedicated markdown report: `DRAG_AND_DROP_INVESTIGATION_REPORT.md` explaining:
     - Detailed diff analysis of past approaches
     - Ranked list of failure causes (High / Medium / Low probability)
     - Browser and iframe environmental quirks
     - The architectural solution chosen and why it is bulletproof
     - Multi-tier fallback mechanisms (Direct File Picker Dialog, Global Ctrl+V Clipboard Paste, Raw Textarea Ingestion)

3. **Autonomous Verification & Pull Request Creation**:
   - Verify that `npm run build` succeeds cleanly.
   - Execute all checks autonomously (`requirePlanApproval: false`, `automationMode: "AUTO_CREATE_PR"`).
   - Submit a polished GitHub Pull Request with a clear summary of all findings, fixes, and the investigation report.

---

## 🛠️ Target Areas & Key Files
- `src/components/music/MusicImportModal.tsx` (D&D Dropzone, File Input, Paste, Cast Lock Toggle, Accordion UI)
- `src/services/musicImporter.ts` (JSON parsing, visual hints extraction, dynamic prompt construction)
- `src/App.tsx` (Single bundle mount, modal orchestration, global keyboard & drag listeners)
- `src/components/StudioHeader.tsx` (Header layout, buttons, CT198 import trigger)
- `vite.config.ts` & `scripts/build.mjs` (Single bundle integrity, build pipelines)
- `DRAG_AND_DROP_INVESTIGATION_REPORT.md` (Comprehensive investigation and comparative report to be authored)

---

## 🛡️ Strict Operational Constraints
- Preserve all existing features (100 character archetypes, taste showroom, series resume, turnaround sheets, 1:1 preview, direct Ultra image generation).
- DO NOT reintroduce blocking modal backdrops that obscure the Flow canvas.
- Ensure all builds pass (`npm run build`) without any errors.
