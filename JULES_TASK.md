# Jules Pro Autonomous Mission: Studio Pro Light Theme & Layout Overhaul

**Project**: FlowTool (Studio Pro - MV & Cinematic Video Production System)  
**Target Environment**: Chrome DevTools Mount / Single ESM Web App Bundle  
**Branch**: `main`  
**Updated**: 2026-10-09  

---

## 🎯 Mission Overview
The user requested a major UI/UX layout overhaul of FlowTool Studio Pro with three primary goals:
1. **Light Theme Transformation (白ベース・黒文字)**:
   - Migrate the overall UI from the current pitch-black theme (`#0e0e0e` / `#121212`) to a crisp, high-contrast, modern Light Theme (`#ffffff` / `#f8fafc` background with `#0f172a` / `#1e293b` text).
   - Ensure cards, borders (`border-slate-200`), badges, and text remain sharp, professional, and visually stunning.
2. **Top Navigation Control Bar (上部トップバーの新設と機能移動)**:
   - Free up the cluttered sidebar by moving core project settings to a sleek horizontal Top Navigation Bar across the top of the screen:
     - **Left**: Studio Pro Logo + Production Mode Selector (with badge/info).
     - **Center**: Worldview / Theme & Taste / Style dropdowns with edit modal triggers.
     - **Right**: Primary Action CTA (✨ Start Production / Abort button) + Utility icons (Archive 📁, Trash 🗑️, Logs Drawer Toggle 📄).
3. **Sidebar Expansion & Reorganization (サイドバー幅拡大とスッキリ化)**:
   - Expand sidebar width from `380px` to `440px` (or `460px`) for spacious, comfortable controls.
   - Retain only: Reference Vault (character/style reference images), Multi-Panel comic toggle, Production Volume (parallel count, episode count, cut count, video ratio), and Automation/Pipeline toggles.
4. **Slide-in Right Log Drawer (右側スライドイン・ログドロワー「にょきっ」と出現)**:
   - Instead of the current bottom-pinned logs, implement a sleek slide-in drawer on the right side of the screen (`transform: translateX(...)` animation).
   - Hidden by default. Smoothly slides in from the right edge when clicking the "Logs" button in the top bar or a floating right-edge handle.
   - Includes close button (✕), copy-to-clipboard, auto-scroll to latest log, and log filter badges.

**IMPORTANT AUTONOMY INSTRUCTION**:  
**DO NOT pause for questions, plan approval, or feedback.** Proceed directly from planning to implementation, run type checks and build, and create a Pull Request automatically.

---

## 🚫 Boundary Constraints (絶対遵守の境界規約)
The following constraints must be strictly adhered to:
1. **Do NOT delete episode artifact image data (成果物画像データの消去禁止 - 最重要)**:
   - In `productionPipelines.ts` (`cleanupEpisodeMemory`), NEVER set `ep.coverBase64`, `ep.masterAnchorBase64`, or `ep.characterTurnaroundBase64` to `undefined`.
2. **NO PackageDownloadModal (ダウンロード完了モーダルの永久廃止)**:
   - Do NOT introduce any popups or completion download modals.
3. **Keep `lastFrameImageMediaId` commented out**:
   - In `src/services/useVideoGeneration.ts`, keep `lastFrameImageMediaId` disabled to avoid 2-point morphing collapse.
4. **Preserve existing UI fixes**:
   - Preserve `createPortal` for the cover preview modal in `EpisodeSection.tsx` and Esc key support.
5. **Zero TypeScript Errors & Successful Build**:
   - `npx tsc --noEmit` MUST pass with 0 errors.
   - `npm run build` (`node scripts/build.mjs`) MUST bundle cleanly without errors.

---

## 🛠️ Implementation Plan

### 1. Light Theme Color Palette
- Base background: `bg-[#f8fafc]` (slate-50) or `bg-white`
- Primary text: `text-slate-900` (`#0f172a`), secondary text: `text-slate-600` (`#475569`)
- Panel & Card background: `bg-white`, borders: `border-slate-200` (or `border-slate-300`)
- Accent badges & buttons:
  - Amber: `bg-amber-50 text-amber-700 border-amber-200`
  - Purple: `bg-purple-50 text-purple-700 border-purple-200`
  - Emerald: `bg-emerald-50 text-emerald-700 border-emerald-200`
  - Blue/Indigo: `bg-indigo-50 text-indigo-700 border-indigo-200`
- Scrollbars: Update `.dark-scrollbar` to clean slate/gray scrollbars (`#cbd5e1` thumb).

### 2. Top Navigation Bar (`src/components/StudioHeader.tsx` or integrated in `App.tsx`)
Create or integrate a fixed header component at the top of `App.tsx`:
- **Height**: ~56px–64px, `bg-white border-b border-slate-200 px-4 flex items-center justify-between z-40`
- **Left section**:
  - Logo: `Studio Pro` with amber icon
  - Production Mode Dropdown: clean styled dropdown with current mode badge
- **Center section**:
  - Theme Selector (`settings.theme`) + Edit button
  - Taste Selector (`settings.taste`) + JSON Edit button
- **Right section**:
  - Start / Abort CTA button: High visibility (e.g. `bg-indigo-600 hover:bg-indigo-700 text-white font-bold px-4 py-2 rounded-xl shadow-sm`)
  - Folder (Archive) button
  - Trash (Clear all) button
  - Logs toggle button (showing log count or pulsing dot if active)

### 3. Reorganized Sidebar (`src/components/StudioSidebar.tsx`)
- Adjust width: `w-[440px]` with `border-r border-slate-200 bg-[#f8fafc]`
- Remove duplicate Mode, Theme, Taste, and Start buttons that are now in the Top Header.
- Keep and polish:
  - **Reference Vault**: large clean upload & reference card list
  - **Multi-Panel Toggle**: clean styled card
  - **Production Volume Accordion**: Image model, parallel count, episode count, cut count, video ratio
  - **Automation & Pipeline Accordion**: Toggle switches with clear light-mode styles (`bg-slate-200` off, `bg-indigo-600` on)

### 4. Right Slide-In Log Drawer (`src/components/StudioLogDrawer.tsx` or updated `StudioLogs.tsx`)
- Container: Fixed right side `fixed right-0 top-0 bottom-0 w-[440px] bg-white border-l border-slate-200 shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-in-out`
- Slide animation: `translate-x-0` when open, `translate-x-full` when closed.
- Top of drawer:
  - Title: "実行ログ (Studio Logs)"
  - Action buttons: Copy clipboard, Clear, Close (✕)
- Body:
  - Monospace or clean Sans scrollable log list with color-coded badges (`[INFO]`, `[SUCCESS]`, `[ERROR]`, `[PROCESS]`).
  - Dark/Charcoal console pane or Crisp Light console pane with high readability.
  - Auto-scroll to bottom on new logs.
- Edge handle: A subtle floating badge/tab on the right edge of the screen so user can click to pop it open anytime.

### 5. Main Content Area & Episode Cards
- Update `App.tsx` main scrollable container to light background (`bg-[#f1f5f9]` or `bg-[#ffffff]`).
- Ensure `EpisodeSection.tsx` and `CutCard.tsx` styles harmonize with the light theme:
  - Card background: `bg-white`, border: `border-slate-200`, shadow: `shadow-sm`
  - Text colors: `text-slate-800`, `text-slate-600`
  - Action buttons: light styled with high contrast

---

## 🚀 Verification & Delivery
1. Run `npx tsc --noEmit` and resolve any type mismatches.
2. Run `npm run build` (`node scripts/build.mjs`) to ensure bundle generation succeeds.
3. Automatically submit the Pull Request and mark the mission complete.
