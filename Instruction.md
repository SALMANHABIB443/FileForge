# Instruction.md — Implementation Guide for AI Coding Agents

**Product:** FileForge  
**Purpose:** Strict rules and workflow for any AI coding agent or developer working on this codebase.  
**Last Updated:** 2026-09-14  

---

## 1. Development Philosophy

- **Read before editing.** Always inspect the current code, existing patterns, and related documentation before making changes.
- **Smallest safe change.** Prefer minimal, focused diffs that solve the requested task. Avoid speculative refactors.
- **Preserve working functionality.** Never break existing features to add new ones.
- **Do not duplicate logic.** Extract shared utilities only when clear duplication already exists and the extraction is low-risk.
- **Follow existing architecture.** New code must fit the established patterns (UI → Service → Engine → File System).
- **Offline & privacy first.** Never introduce network calls that transmit user file content. Flag any future cloud feature explicitly.
- **Design.md is law for UI.** Colors, radii, typography, shadows, component styles must match Design.md exactly. Do not invent new visual treatments.
- **Fail safely.** Every file operation and conversion must handle errors, clean temporary files, and leave the original file untouched.

---

## 2. Source of Truth Hierarchy

When conflicts arise, resolve in this order (highest priority first):

1. **Existing working, tested code** (if the feature already functions correctly)
2. **Design.md** (visual design, tokens, components)
3. **PRD.md** (product requirements, scope, principles)
4. **Features.md** (detailed feature behavior)
5. **Sitemap.md** (navigation and screen structure)
6. **Phases.md** (roadmap and priority)
7. **This Instruction.md**
8. Other documentation or comments

If a requested change would violate a higher-priority source, stop and surface the conflict instead of silently proceeding.

**Never modify Design.md** unless the human explicitly instructs you to update the design system.

**Never create or modify README.md** as part of normal feature work.

---

## 3. Before Coding — Mandatory Checklist

Before writing or editing any code for a task:

1. Inspect the repository structure (`ls`, `find`, or equivalent).
2. Read the relevant documentation (PRD, Features, Sitemap, Phases, Design).
3. Locate and read the existing implementation of related features or shared services.
4. Identify current architecture: folders for UI, services, engines, types, utils, tests.
5. Identify dependencies already in use (package.json / pubspec / Cargo.toml etc.).
6. Check for existing patterns: how jobs are created, how progress is reported, how errors are surfaced, how temporary files are managed.
7. Confirm the requested feature is in scope for the current phase (see Phases.md).
8. Note any open risks or limitations from PRD (e.g. FFmpeg.wasm memory).

If the task is ambiguous or conflicts with higher-priority docs, ask for clarification or document the assumption before proceeding.

---

## 4. Coding Rules

### 4.1 Architecture

Recommended layered architecture (adapt to chosen tech stack):

```
UI Components / Screens
        ↓
Feature Controllers / Hooks / ViewModels
        ↓
Domain Services (JobService, HistoryService, FileService…)
        ↓
Engine Adapters (ImageEngine, PdfEngine, FFmpegAdapter, ZipEngine…)
        ↓
File System Abstraction / Platform APIs
```

- Conversion engines must be completely isolated from UI.
- UI never calls FFmpeg, pdf-lib, or canvas directly.
- All long-running work goes through the Job system.
- Shared types (Job, FileMeta, ConversionOptions, Progress) live in a central types module.

### 4.2 Naming

- Files & folders: kebab-case or the project’s established convention.
- Components: PascalCase.
- Services / hooks: camelCase or PascalCase matching project.
- Job-related: clear verbs (`createJob`, `cancelJob`, `getJobProgress`).
- Avoid abbreviations unless widely understood (`pdf`, `zip`, `ffmpeg` ok).

### 4.3 Components & UI

- Use only the design tokens and component patterns defined in Design.md.
- Primary button = filled dark (`#0a0a0a` / ink).
- Secondary = ghost (`#f5f5f5`).
- Cards = white, 24px radius, hairline border + subtle shadow.
- Inputs / badges / buttons = 18px radius (pill).
- Never introduce new colors, gradients, or shadow styles.
- Prefer composition over complex inheritance.
- Every interactive element needs an accessible name / label.

### 4.4 State Management

- Prefer the project’s existing state solution (React context + hooks, Zustand, Redux, Riverpod, etc.).
- Job state must be the single source of truth for progress and status.
- Avoid storing large binary data in global state; keep only metadata and object URLs / handles that can be revoked.

### 4.5 Error Handling

- Catch at the engine boundary; translate into user-facing messages defined in Features.md / PRD.
- Never swallow errors.
- Always clean temporary resources in `finally` or equivalent.
- Surface a technical error code or message in logs for debugging, but keep UI messages human and non-technical by default.

### 4.6 Async & File Operations

- All file I/O and conversions are async.
- Support cancellation tokens / AbortController (or platform equivalent).
- Progress must be reportable at least every 200–500 ms for long jobs.
- Never block the main thread with heavy synchronous work; offload to Web Workers / isolates / background threads where the platform allows.

### 4.7 Permissions

- Request the minimum permission at the moment it is needed.
- Provide a clear reason string.
- Handle permanent denial gracefully (disable the feature, show explanation).

### 4.8 Performance

- Lazy-load heavy engines (FFmpeg.wasm especially).
- Warn before starting jobs that may exceed memory or time thresholds.
- Prefer streaming / chunked processing over loading entire files into memory when possible.
- Revoke object URLs and release buffers promptly.

### 4.9 Testing Expectations

- Unit tests for pure logic (option validation, filename generation, progress calculation, error mapping).
- Integration tests for engine adapters with real small sample files.
- End-to-end or UI tests for critical happy paths (image convert, PDF merge, ZIP create).
- Explicit tests for: cancellation, insufficient space simulation, unsupported format, corrupted input, large-file warning.
- Do not commit large binary test fixtures; keep small representative samples or generate them.

---

## 5. File Conversion Architecture (Required Pattern)

```
User selects file(s)
        ↓
FileService / Picker → FileMeta + temporary handle
        ↓
UI shows compatible operations (from Tool Registry)
        ↓
User chooses tool + options
        ↓
JobService.createJob({ toolId, input, options })
        ↓
JobRunner picks job → EngineAdapter.execute(job, onProgress, signal)
        ↓
Engine writes to temporary workspace
        ↓
Validation → move / copy to final output location
        ↓
Job status = Completed | Failed | Cancelled
        ↓
HistoryService.record + UI update + cleanup
```

- Tool Registry: each tool declares `id`, `category`, `supportedInputs`, `defaultOptions`, `optionSchema`, `engine`.
- Engines are swappable (browser WASM vs native vs future cloud adapter).
- Temporary workspace is always cleaned.

---

## 6. Testing Instructions

### Required Coverage Areas
- Unit: option validation, filename collision handling, job state machine, error message mapping.
- Integration: each engine with at least one success path and one failure path.
- Real-file: use small, real JPG/PNG/PDF/ZIP/MP4 samples (keep fixtures under version control only if tiny).
- Large-file: simulate or use moderately large files; assert progress and cancellation still work.
- Error: corrupted files, wrong extension, zero-byte files, permission denied mocks.
- UI: empty states, loading/progress, success/share, error + retry.

### Commands
Follow the project’s existing test runner (`npm test`, `flutter test`, `cargo test`, etc.). Add new tests in the same style and location as existing ones.

### Before Marking a Task Complete
- All new tests pass.
- Manual smoke test of the happy path and at least one error path.
- No console errors or unhandled promise rejections.
- Temporary files are gone after the job ends.
- UI matches Design.md tokens.

---

## 7. AI Agent Safety Rules

The coding agent **must NOT**:

- Delete or rewrite unrelated modules or files.
- Perform large-scale refactors unless the task explicitly requires it.
- Change visual design tokens or component styles defined in Design.md.
- Introduce new third-party dependencies without justifying licensing, size, and offline capability.
- Add network requests that upload user file content.
- Commit, push, or create pull requests unless the human explicitly asks.
- Leave temporary files or debug code in the final change.
- Assume a feature is “simple” and skip error/progress/cancellation handling.
- Violate the offline-first or privacy principles.

If a requested change would require any of the above, stop and report the issue.

---

## 8. Completion Checklist

Before considering any implementation task finished, the agent must verify:

- [ ] Code follows existing architecture and naming.
- [ ] UI strictly follows Design.md (colors, radii, typography, shadows, spacing).
- [ ] Feature matches the specification in Features.md and is in the correct phase.
- [ ] Job system is used for any non-instant operation.
- [ ] Progress, cancellation, and error states are implemented.
- [ ] Temporary files are cleaned on all exit paths.
- [ ] Original user files are never modified or deleted by the app.
- [ ] Accessibility basics (labels, contrast, targets) are respected.
- [ ] Tests for the new logic exist and pass.
- [ ] No new console warnings or TypeScript/lint errors introduced.
- [ ] Documentation (if behavior changed) is updated only in the relevant .md files; Design.md untouched.
- [ ] No README.md created or modified.

---

## 9. Technology Decisions (Current Baseline)

These are the default assumptions unless the repository already differs:

- **UI:** React + TypeScript + Tailwind CSS v4 + shadcn/ui-style components matching Design.md.
- **Media:** FFmpeg.wasm (lazy-loaded) for video/audio.
- **Images:** Canvas / browser-image-compression / similar pure client-side libraries.
- **PDF:** pdf-lib + pdfjs-dist (or equivalent maintained libraries).
- **Archives:** JSZip (or platform equivalent).
- **Storage:** File System Access API where available + fallback to download / OPFS.
- **State:** Lightweight (Zustand or React context + useReducer).
- **Job persistence:** IndexedDB for history metadata only.

If the repository uses a different stack (Flutter, Electron, Tauri, etc.), adapt the same architectural principles and update this section only when the human confirms the change.

---

## 10. Handling Ambiguity

- Prefer the most privacy-preserving, offline, and simple interpretation.
- Document any assumption you make in a code comment or in the PR description.
- When in doubt about scope, implement the MVP version of the feature and leave advanced options for later phases.

This document is living. Update it only when architectural decisions are deliberately changed by a human.
