# 🚀 Jules Mission: FlowTool WebUI Drag & Drop & Accordion Architecture Deep Audit

## 📌 Mission Objective
You are tasked with conducting an exhaustive root-cause analysis and code hardening for the **Drag-and-Drop (D&D) file ingestion engine and inline accordion UI** in FlowTool (`flowtoolhuck`).

FlowTool is mounted directly inside Google Flow (`flow.google.com`) via dynamic `import(...)` into target DOM (`document.getElementById('root') || document.body`), often running within an iframe/blob execution context.

The user reported:
1. `ReferenceError: handleDragEnter is not defined` occurred when opening the accordion (which was just fixed, verify that NO other dangling references exist across the entire codebase).
2. On Chrome running under Windows, dragging a JSON metadata file (`session_songs_metadata.json`) onto the dropzone sometimes fails to fire `dragenter`/`dragover` events due to:
   - Nested iframe / parent window event isolation
   - Multi-layer capturing listeners (`useCapture: true`) eating events
   - Conflict between native `<input type="file">` overlays and container `<div>` event models
   - Chrome drag-and-drop hit-testing quirks on dark-themed UI elements

Your objective is to:
1. Audit all drag-and-drop code in `src/components/music/MusicImportModal.tsx` and `src/App.tsx`.
2. Ensure bulletproof stability:
   - D&D onto the dropzone works seamlessly.
   - Clicking the dropzone always cleanly opens the native file dialog.
   - Global Ctrl+V clipboard paste always works to ingest JSON.
   - Fallback raw textarea input always works.
3. Verify that `npm run build` passes with 0 errors.
4. Create a Pull Request with your audit and hardening changes.

## 🛡️ Target Files
- `src/components/music/MusicImportModal.tsx`
- `src/App.tsx`
- `src/components/StudioHeader.tsx`

## ⚙️ Mandatory Constraints
- Preserve all existing features (100 character archetypes, taste showroom, accordion toggle state, series resume).
- DO NOT create any new modal popups or reintroduce blocking modal backdrops.
- Ensure `npm run build` succeeds cleanly.
