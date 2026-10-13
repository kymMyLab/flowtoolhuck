# 🚀 Jules Mission: CT198 音楽インポート × プロデュース（キャストDNA・三面図・表情）完全合体

## 📌 Mission Objective
You are tasked with seamlessly integrating the **CT198 Music Importer (`MusicImportModal.tsx` / `musicImporter.ts`)** with the existing **Produce / Cast Management system (`castStorage.ts` / `CastCharacter`)**.

Currently, music tracks imported via CT198 JSON do not carry any character identity or turnaround anchors, causing the image generation models to hallucinate random characters (e.g. unintended rural girl aesthetic) instead of the user's produced cinematic heroine.
Your goal is to connect the registered `CastCharacter` (DNA prompt, 16:9 turnaround sheet, and emotional facial expressions) directly into the 12-cut music video storyboard generation.

---

## 🎯 Strict Target Files (MODIFY ONLY THESE 2 FILES)
Do **NOT** modify or split any other files!
1. `src/components/music/MusicImportModal.tsx`
2. `src/services/musicImporter.ts`

*(Do NOT refactor or touch `studioDefinitions.ts`, `App.tsx`, `useStudioProduction.ts`, etc.)*

---

## 📋 Detailed Functional Requirements

### 1. Cast Selection in `MusicImportModal.tsx`
- Load the produced characters using `loadMangaProject()` from `../../services/castStorage`.
- Add a sleek "🎬 主演キャスト (Protagonist Cast)" selection bar at the top of the modal:
  - Display available cast options:
    - `🎲 キャスト指定なし (AI完全おまかせ)` (No cast specified, fallback to default behavior)
    - Available `CastCharacter` items showing avatar/thumbnail, name, and role badge (e.g. `protagonist`).
  - Default selection: automatically select the character with `role === 'protagonist'` if present, otherwise the first character or none.
- When deploying a single track (`handleDeploySingle`) or all tracks (`handleDeployAll`), pass the currently selected `CastCharacter` (or `undefined`) into `convertTrackToEpisode`.

### 2. Injecting Cast DNA & Turnaround Anchors in `musicImporter.ts`
Update `convertTrackToEpisode(track: ImportedTrack, videoRatio?: string, selectedCharacter?: CastCharacter): Episode`:

#### A. Episode-Level Anchors (Connect Existing Architecture)
If `selectedCharacter` is provided:
- `episode.characterDna = selectedCharacter.dnaPromptEn;`
- `episode.characterTurnaroundBase64 = selectedCharacter.turnaroundBase64 || selectedCharacter.avatarBase64;`
- `episode.characterTurnaroundMediaId = selectedCharacter.turnaroundMediaId;`
- `episode.characterTurnaroundPrompt = selectedCharacter.turnaroundPromptEn;`

#### B. 12-Cut Prompt Generation (Cut 1 to Cut 12)
- **Cuts 1–9 and Cut 11 (Human Character Cuts)**:
  - Prepend/inject the cast's visual DNA into the prompt:
    `[PROTAGONIST DNA]: ${selectedCharacter.dnaPromptEn}`
  - **Emotional Facial Expression Sync**:
    - **Cut 1 (Swipe-Killer Hook)**: sync with `selectedCharacter.expressions['sad']?.promptModifierEn` or `neutral`.
    - **Cut 4 (Contemplation / Clue Hook)**: sync with subtle mysterious melancholy or `neutral`.
    - **Cut 5–8 (Chorus / Emotion Peak)**: sync with `happy` or intense `neutral` catharsis.
    - **Cut 11 (Heroic Climax)**: sync with confident `neutral` or triumphant `happy`.
- **Cut 10 (STRICT STILL-LIFE INSERT / KEY PROP)**:
  - **CRITICAL**: Cut 10 MUST strictly remain human-free (still-life product macro shot of the symbolic keepsake prop such as keys, screws, prescription notes).
  - Do **NOT** inject cast DNA or expressions into Cut 10!
- **Cut 12 (Void Loop / Absence)**:
  - Keep the wide atmospheric departure/aftermath framing.

---

## 🛡️ Safeguards & Build Verification
1. `npm run build` MUST compile cleanly with 0 TypeScript errors and 0 warnings.
2. Backward compatibility: If no character is selected, preserve the existing prompt generation logic 100%.
3. Do NOT ask questions or stop execution. Complete the changes, verify with `npm run build`, and automatically create a Pull Request.
