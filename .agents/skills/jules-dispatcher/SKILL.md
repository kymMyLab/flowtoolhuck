---
name: jules-dispatcher
description: Dispatch autonomous coding and debugging tasks to Google Labs Jules via API using full autonomy mode (auto PR creation, no plan approval).
---

# Jules Dispatcher Skill

Use this skill whenever the user asks to send, dispatch, or delegate tasks/debugging jobs to Google Labs Jules (`jules.google.com`).

## ⚙️ Mandatory Autonomy Parameters

When triggering tasks for Jules, **ALWAYS** enforce the following options:
1. **`requirePlanApproval: false`**: Never pause for human approval. Jules must immediately proceed from planning to implementation and verification.
2. **`automationMode: "AUTO_CREATE_PR"`**: Automatically create a Pull Request on GitHub once changes and verification pass.
3. **Repository Context**:
   - `source`: `"sources/github/kymMyLab/flowtoolhuck"`
   - `startingBranch`: `"main"`

## 🔐 Credentials & API Key
- The API key is stored in the root `.env` as `JULES_API_KEY`.
- **NEVER** expose or commit `JULES_API_KEY` to public code or files.
- The automation script `scripts/jules.mjs` automatically reads `.env`.

## 🚀 Execution Methods

### Method 1: Using the npm runner (Recommended)
Run the built-in runner in PowerShell:

```powershell
# Dispatch JULES_TASK.md (default)
npm run jules

# Dispatch custom instructions
npm run jules -- "Investigate and fix memory leak in browserVideoService.ts"

# Check session status
npm run jules -- --status <sessionId>

# List recent sessions
npm run jules -- --list
```

### Method 2: Node.js direct invocation
```powershell
node scripts/jules.mjs
```

## 📋 Standard Workflow
1. Check that the local workspace is clean and `origin/main` is up to date (`git push` if needed).
2. Update or verify `JULES_TASK.md` so Jules has crisp instructions and boundary constraints (e.g., prohibition of `PackageDownloadModal`).
3. Run `npm run jules` to trigger the job.
4. Report the resulting Web Session URL, Session ID, and Initial Status to the user.
