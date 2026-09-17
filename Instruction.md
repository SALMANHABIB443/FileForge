# Instruction.md — Implementation Guide for AI Coding Agents

**Product:** FileForge
**Purpose:** Strict rules and workflow for any AI coding agent or developer working on this codebase.
**Last Updated:** 2026-09-15
**Status:** Updated for Electron desktop preparation.

---

## 1. Development Philosophy

- **Read before editing.** Always inspect the current code, existing patterns, and related documentation before making changes.
- **Smallest safe change.** Prefer minimal, focused diffs that solve the requested task. Avoid speculative refactors.
- **Preserve working functionality.** Never break existing features to add new ones.
- **Do not duplicate logic.** Extract shared utilities only when clear duplication already exists and the extraction is low-risk.
- **Follow existing architecture.** New code must fit the established patterns.
- **Offline and privacy first.** Never introduce network calls that transmit user file content. Flag any future cloud feature explicitly.
- **DESIGN.md is law for UI.** Colors, radii, typography, shadows, component styles must match DESIGN.md exactly. Do not invent new visual treatments.
- **Fail safely.** Every file operation and conversion must handle errors, clean temporary files, and leave the original file untouched.
- **Preserve the web/PWA version.** The existing web/PWA implementation remains valid. The Electron migration should build on top of it, not replace it prematurely.

---

## 2. Source of Truth Hierarchy

When conflicts arise, resolve in this order (highest priority first):

1. **Existing working, tested code** (if the feature already functions correctly)
2. **DESIGN.md** (visual design, tokens, components)
3. **Architecture.md** (system architecture — current and target Electron)
4. **PRD.md** (product requirements, scope, principles)
5. **Features.md** (detailed feature behavior)
6. **Sitemap.md** (navigation and screen structure)
7. **Phases.md** (roadmap and priority)
8. **This Instruction.md**
9. Other documentation or comments

If a requested change would violate a higher-priority source, stop and surface the conflict instead of silently proceeding.

**Never modify DESIGN.md** unless the human explicitly instructs you to update the design system.

**Never create or modify README.md** as part of normal feature work.

**Do not begin Electron implementation until explicitly asked.** The documentation describes the target architecture; code changes require explicit human instruction.

---

## 3. Before Coding — Mandatory Checklist

Before writing or editing any code for a task:

1. Inspect the repository structure.
2. Read the relevant documentation (PRD, Features, Sitemap, Phases, Design, Architecture).
3. Locate and read the existing implementation of related features or shared services.
4. Identify current architecture: folders for UI, services, engines, types, utils, tests.
5. Identify dependencies already in use (package.json).
6. Check for existing patterns: how jobs are created, how progress is reported, how errors are surfaced, how temporary files are managed.
7. Confirm the requested feature is in scope for the current phase (see Phases.md).
8. If working on Electron features, read Architecture.md sections 2-8 (target architecture, security, IPC).

If the task is ambiguous or conflicts with higher-priority docs, ask for clarification or document the assumption before proceeding.

---

## 4. Coding Rules

### 4.1 Architecture

Layered architecture:

```
UI Components / Screens
        |
        v
Feature Controllers / Hooks / ViewModels
        |
        v
Domain Services (JobService, HistoryService, FileService...)
        |
        v
Engine Adapters (ImageEngine, PdfEngine, FFmpegAdapter, ZipEngine...)
        |
        v
File System Abstraction / Platform APIs
```

**Electron-specific:**
- Renderer process: React UI, navigation, state, progress display. Must NOT have Node.js access.
- Main process: native filesystem operations, native dialogs, window lifecycle, notifications, updater, IPC handlers.
- Preload bridge: secure, typed, limited API surface via `contextBridge`.
- All privileged operations go through IPC.

Conversion engines must be completely isolated from UI. UI never calls FFmpeg, pdf-lib, or canvas directly. All long-running work goes through the Job system.

### 4.2 Naming

- Files and folders: kebab-case or the project's established convention.
- Components: PascalCase.
- Services / hooks: camelCase or PascalCase matching project.
- Job-related: clear verbs (`createJob`, `cancelJob`, `getJobProgress`).
- Avoid abbreviations unless widely understood (`pdf`, `zip`, `ffmpeg` ok).
- IPC channels: `service:action` convention (e.g., `file:selectFiles`, `job:cancel`).

### 4.3 Components and UI

- Use only the design tokens and component patterns defined in DESIGN.md.
- Primary button = filled dark (ink).
- Secondary = ghost.
- Cards = white, 24 px radius, hairline border + subtle shadow.
- Inputs / badges / buttons = 18 px radius (pill).
- Never introduce new colors, gradients, or shadow styles.
- Prefer composition over complex inheritance.
- Every interactive element needs an accessible name / label.

### 4.4 State Management

- Prefer the project's existing state solution (Zustand).
- Job state must be the single source of truth for progress and status.
- Avoid storing large binary data in global state; keep only metadata and references.
- Electron: renderer state stays in renderer; main process state (jobs, files) stays in main process. Sync via IPC events.

### 4.5 Error Handling

- Catch at the engine boundary; translate into user-facing messages defined in Features.md / PRD.md.
- Never swallow errors.
- Always clean temporary resources in `finally` or equivalent.
- Surface a technical error code or message in logs for debugging, but keep UI messages human and non-technical by default.
- Electron: errors from main process are serialized over IPC, mapped to user messages in renderer.

### 4.6 Async and File Operations

- All file I/O and conversions are async.
- Support cancellation tokens / AbortController or equivalent.
- Progress must be reportable at least every 200-500 ms for long jobs.
- Never block the main thread with heavy synchronous work; offload to Web Workers / worker threads.
- Electron: heavy engines run in `worker_threads`; the main process stays responsive.

### 4.7 Permissions

- Request the minimum permission at the moment it is needed.
- Provide a clear reason string.
- Handle permanent denial gracefully (disable the feature, show explanation).
- Electron: native dialogs handle permissions implicitly (user chooses files/folders). No permission prompts needed for filesystem.

### 4.8 Performance

- Lazy-load heavy engines.
- Warn before starting jobs that may exceed memory or time thresholds.
- Prefer streaming / chunked processing over loading entire files into memory when possible.
- Revoke object URLs and release buffers promptly.

### 4.9 Testing Expectations

- Unit tests for pure logic (option validation, filename generation, progress calculation, error mapping).
- Integration tests for engine adapters with real small sample files.
- Electron-specific tests: IPC handlers, filesystem operations, window behavior.
- Explicit tests for: cancellation, insufficient space simulation, unsupported format, corrupted input, large-file warning.
- Do not commit large binary test fixtures; keep small representative samples or generate them.

---

## 5. File Conversion Architecture (Required Pattern)

```
User selects file(s)
        |
        v
FileService / Picker -> FileMeta + temporary handle
        |
        v
UI shows compatible operations (from Tool Registry)
        |
        v
User chooses tool + options
        |
        v
JobService.createJob({ toolId, input, options })
        |
        v
JobRunner picks job -> EngineAdapter.execute(job, onProgress, signal)
        |
        v
Engine writes to temporary workspace
        |
        v
Validation -> move / copy to final output location
        |
        v
Job status = Completed | Failed | Cancelled
        |
        v
HistoryService.record + UI update + cleanup
```

**Electron version of this flow:**

```
Renderer: user selects files -> window.fileforge.selectFiles()
        |
        v
Main: dialog.showOpenDialog() -> native file paths
        |
        v
Main: job created in JobService (worker thread pool)
        |
        v
Main: engine processes files (Node.js)
        |
        v
Main: ipcRenderer.invoke('job:progress', ...) streams to renderer
        |
        v
Main: job completes -> result written with overwrite protection
        |
        v
Renderer: result card with Open File / Open Folder / Copy Path
```

- Tool Registry: each tool declares `id`, `category`, `supportedInputs`, `defaultOptions`, `optionSchema`, `engine`.
- Engines are swappable (browser vs native vs future cloud adapter).
- Temporary workspace is always cleaned.

---

## 6. Electron Architecture Rules

### 6.1 Security (Non-Negotiable)

The Electron implementation MUST:

- Use `contextIsolation: true`.
- Use `nodeIntegration: false`.
- Use `sandbox: true` for the renderer.
- Expose a limited, typed API via the preload `contextBridge` — never `ipcRenderer` directly.
- Validate and sanitize all IPC arguments in the main process.
- Never expose arbitrary filesystem APIs to the renderer.
- Sanitize paths; prevent path traversal.
- Validate file types and user-selected paths.
- Preserve archive extraction safety limits (2000 entries, 4 GiB, 32 depth).
- Never execute user-provided files.
- Never use arbitrary shell execution for normal file operations.
- Minimize Electron permissions.

### 6.2 Preload Bridge

The preload script must:
- Expose only the methods defined in Architecture.md section on the preload bridge.
- Use `contextBridge.exposeInMainWorld('fileforge', api)`.
- Forward renderer calls to main process via `ipcRenderer.invoke()`.
- Receive events from main process via `ipcRenderer.on()` and forward to renderer callbacks.

### 6.3 IPC Contract

- All channels are explicitly registered in the main process.
- Channel names follow `service:action` convention.
- Arguments are validated (types, ranges, allowed values).
- Paths are resolved and checked against allowed directories.
- No arbitrary function execution through IPC.

### 6.4 Process Boundaries

```
Renderer (React)           Main Process (Node.js)        Node.js Worker
    |                            |                            |
    | typed IPC calls            | creates worker jobs         |
    |<--- progress events -------|                            |
    |<--- completion events -----|<--- worker result ---------|
    |<--- error events ----------|<--- worker error ----------|
```

- Renderer knows nothing about Node.js, fs, or the filesystem.
- Main process owns all filesystem access, dialogs, notifications, updates.
- Workers handle heavy processing (FFmpeg, image batch, PDF rendering).

---

## 7. Preservation of Security Guardrails

The following limits must NOT be weakened during Electron conversion:

| Guardrail | Limit | File |
|-----------|-------|------|
| ZIP/TAR max entries | 2,000 | `src/engines/zip-engine.ts`, `tar-engine.ts` |
| ZIP/TAR max uncompressed | 4 GiB | same |
| ZIP/TAR max nesting depth | 32 | same |
| Path traversal protection | block `..`, backslashes, drive letters, `~`, absolute paths | `hasUnsafePath()` |
| Media hard limit | 1 GiB | `src/utils/media.ts` |
| Media soft warning | 200 MiB | same |
| PDF to images page limit | 200 | `src/engines/pdf-engine.ts` |
| Password-protected PDF | detect + clear error | same |

If the desktop architecture allows safer/higher limits, document the change separately in Features.md and PRD.md. Do NOT silently change any limit.

---

## 8. Testing Instructions

### Required Coverage Areas

- Unit: option validation, filename collision handling, job state machine, error message mapping.
- Integration: each engine with at least one success path and one failure path.
- Real-file: use small, real JPG/PNG/PDF/ZIP/MP4 samples (keep fixtures under version control only if tiny).
- Large-file: simulate or use moderately large files; assert progress and cancellation still work.
- Error: corrupted files, wrong extension, zero-byte files, permission denied mocks.
- UI: empty states, loading/progress, success/share, error + retry.
- Electron: IPC handlers, path validation, temp cleanup, window behavior, notifications.

### Commands

```bash
npm test              # Run Vitest
npm run test:watch    # Vitest watch mode
npm run typecheck     # TypeScript type checking
npm run lint          # ESLint
npm run build         # Production build
```

### Before Marking a Task Complete

- All new tests pass.
- Manual smoke test of the happy path and at least one error path.
- No console errors or unhandled promise rejections.
- Temporary files are gone after the job ends.
- UI matches DESIGN.md tokens.
- Security guardrails are unchanged, unless explicitly re-documented.

---

## 9. AI Agent Safety Rules

The coding agent **must NOT**:

- Delete or rewrite unrelated modules or files.
- Perform large-scale refactors unless the task explicitly requires it.
- Change visual design tokens or component styles defined in DESIGN.md.
- Introduce new third-party dependencies without justifying licensing, size, and offline capability.
- Add network requests that upload user file content.
- Commit, push, or create pull requests unless the human explicitly asks.
- Leave temporary files or debug code in the final change.
- Assume a feature is "simple" and skip error/progress/cancellation handling.
- Violate the offline-first or privacy principles.
- Give the renderer unrestricted Node.js access.
- Expose raw IPC to the renderer without going through the preload bridge.
- Introduce background services or server-side components.
- Add global keyboard shortcuts or Windows auto-start (both Not Planned for V1).
- Install Electron or create Electron files unless explicitly asked to start the migration.
- Claim Electron is implemented when it is not in the documentation.

If a requested change would require any of the above, stop and report the issue.

---

## 10. Completion Checklist

Before considering any implementation task finished, the agent must verify:

- [ ] Code follows existing architecture and naming.
- [ ] UI strictly follows DESIGN.md (colors, radii, typography, shadows, spacing).
- [ ] Feature matches the specification in Features.md and is in the correct phase.
- [ ] Job system is used for any non-instant operation.
- [ ] Progress, cancellation, and error states are implemented.
- [ ] Temporary files are cleaned on all exit paths.
- [ ] Original user files are never modified or deleted by the app.
- [ ] Accessibility basics (labels, contrast, targets) are respected.
- [ ] Tests for the new logic exist and pass.
- [ ] No new console warnings or TypeScript/lint errors introduced.
- [ ] Documentation (if behavior changed) is updated only in the relevant .md files; DESIGN.md untouched.
- [ ] No README.md created or modified.
- [ ] (Electron tasks) `contextIsolation: true` and `nodeIntegration: false` verified.
- [ ] (Electron tasks) IPC arguments validated in the main process.
- [ ] (Electron tasks) No path traversal possible.
- [ ] (Electron tasks) Security guardrails unchanged (or re-documented).
- [ ] (Electron tasks) No background services or server-side components introduced.
- [ ] (Electron tasks) No global keyboard shortcuts or auto-start added.

---

## 11. Technology Decisions (Current Baseline)

These are the default assumptions unless the repository already differs:

- **UI:** React + TypeScript + Tailwind CSS v4 + AI-generated components matching DESIGN.md.
- **Media:** FFmpeg.wasm (lazy-loaded) for video/audio.
- **Images:** Canvas (browser) — sharp or node-canvas (Electron, decision pending).
- **PDF:** pdf-lib + pdfjs-dist.
- **Archives:** JSZip + pure-JS TAR parser.
- **Storage (web):** File System Access API + IndexedDB + localStorage.
- **State:** Zustand.

**Electron target decisions (To Be Decided):**
- Packaging: electron-builder or electron-forge
- Installer: NSIS or MSI
- Native image engine: sharp or node-canvas
- FFmpeg strategy: native binary or WASM
- History storage: SQLite or JSON file
- Settings storage: electron-store or JSON
- Update server: GitHub Releases or custom
- Code signing: certificate or self-signed

Do not decide these without explicit human input. Document any decision in Phases.md.

---

## 12. Handling Ambiguity

- Prefer the most privacy-preserving, offline, and simple interpretation.
- Document any assumption you make in a code comment or in the PR description.
- When in doubt about scope, implement the MVP version of the feature and leave advanced options for later phases.
- When in doubt about Electron details, reference Architecture.md and PRD.md first.
- If a requirement contradicts the privacy-first principle, surface the conflict.

This document is living. Update it only when architectural decisions are deliberately changed by a human.