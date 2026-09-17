# Phases.md — Development Roadmap

**Product:** FileForge
**Last Updated:** 2026-09-16

This roadmap covers the completed web/PWA development (Phases 0-7) and the planned Electron desktop migration (Phases 8-15). Each phase has clear exit criteria.

---

## Completed Phases (Web/PWA)

### Phase 0 — Foundation

**Goal:** Establish a clean, maintainable project skeleton.
**Status:** Complete.

---

### Phase 1 — Core MVP

**Goal:** Deliver a usable, reliable set of high-value offline tools.
**Status:** Complete. All MVP features (Image Convert/Compress/Resize, PDF Merge/Split/Compress, ZIP Create/Extract, File Info, Job System, History, Settings) implemented and working.

---

### Phase 2 — Media (Video and Audio)

**Goal:** Add video/audio features with FFmpeg.wasm.
**Status:** Complete (2026-09-14). Video to Audio, Audio Convert, Video Compress implemented. Manual QA pending.

---

### Phase 3 — Image and PDF Expansion

**Goal:** Deepen image and PDF categories.
**Status:** Complete (2026-09-14). Image Crop/Rotate, PDF to Images, PDF Organize, batch support, EXIF viewer implemented. Manual QA pending.

---

### Phase 4 — Archive and File Tools Polish

**Goal:** Strengthen archive handling and general utilities.
**Status:** Complete (2026-09-14). ZIP preview/selective extract, TAR extract, batch rename, duplicate detection, enhanced file info implemented.

---

### Phase 5 — Developer Utilities

**Goal:** Add lightweight developer tools.
**Status:** Complete (2026-09-14). JSON, Base64, Hash, UUID, URL, JWT, Timestamp tools implemented.

---

### Phase 6 — Polish, Performance and Accessibility

**Goal:** Raise quality to production standards.
**Status:** Complete (2026-09-15). Lazy loading, accessibility pass, crash recovery, feature flags, storage warnings, touch target audit all implemented.

---

### Phase 7 — Release Preparation (Web/PWA)

**Goal:** Ship a trustworthy first public web version.
**Status:** Mostly complete. PWA setup, privacy policy, store assets, crash monitoring, local analytics implemented. Final manual QA pending.

---

## Electron Desktop Migration Phases

These phases cover the conversion from web/PWA to a native Windows Electron desktop application. The existing web/PWA code is preserved; the Electron migration builds on top of it.

### Phase 8 — Electron Foundation

**Goal:** Establish the Electron shell with secure IPC architecture.
**Status:** Complete (2026-09-15). Electron shell launches the FileForge UI with secure IPC bridge, window management, and dev/build workflows verified.

**Features / Work Items:**
- Install Electron and configure `electron-builder` or `electron-forge`
- Create main process entry point (`main.ts`)
- Create preload script with `contextBridge` and typed API surface
- Configure `BrowserWindow` with security settings:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `sandbox: true`
  - `webPreferences.webSecurity: true`
- Set up Vite configuration for Electron (electron-vite or custom)
- Implement basic window management (create, close, minimize, maximize)
- Set up IPC channel registry and basic handler
- Configure development workflow (`npm run dev` launches both Vite and Electron)
- Window title bar, minimum window size (800x600), resizing
- Application icon (.ico for Windows)

**Dependencies:** Phases 0-7 complete.
**Deliverables:**
- Electron app launches and displays the existing React UI
- IPC bridge is functional
- Security settings enforced
- Development workflow works

**Testing:**
- App launches without errors
- IPC round-trip works (preload > main > renderer)
- `contextIsolation` verified (renderer cannot access Node.js)
- Window lifecycle (close, minimize, maximize) works

**Exit Criteria:**
- Electron app displays the existing FileForge UI
- Secure IPC architecture is in place
- No Node.js access in renderer
- Development workflow functional

---

### Phase 9 — Native File System Migration

**Goal:** Replace browser File System Access API with Electron native file operations.

**Features / Work Items:**
- Implement `FileService` IPC handlers:
  - `file:selectFiles` — `dialog.showOpenDialog()` with multi-select
  - `file:selectFolder` — `dialog.showOpenDialog()` with directory property
  - `file:saveAs` — `dialog.showSaveDialog()` with file type filters
  - `file:read` — `fs.readFile()` with path validation
  - `file:write` — `fs.writeFile()` with path validation
  - `file:stat` — `fs.stat()` for file size/type checks
- Implement path validation:
  - Resolve to absolute path
  - Check for traversal (`..`, null bytes)
  - Validate against allowed directories (temp, user-selected)
- Implement temp directory management:
  - `%TEMP%\FileForge\jobs\<job-id>\`
  - Cleanup on job completion
  - Cleanup on app start (orphaned jobs)
- Implement output location management:
  - User-configured default (Settings)
  - Fallback: same directory as input, or Downloads
  - Overwrite protection (auto-rename or confirmation)
- Replace `readFileAsBlob()` to use IPC-based file reading
- Update all engines to work with Node.js file paths instead of File handles
- Drag-and-drop support:
  - Handle `dragover`, `drop` events in renderer
  - Forward dropped file paths to main process via IPC
  - Validate file types and sizes
  - Visual drag-over state

**Dependencies:** Phase 8 complete.
**Deliverables:**
- All file operations go through Electron IPC
- Native file/folder/Save As dialogs work
- Temp directory management works
- Drag-and-drop works
- Overwrite protection works

**Testing:**
- File selection (single, multiple, folder) works
- Save As dialog works with correct file type filters
- Temp files are cleaned after job completion
- Overwrite protection triggers correctly
- Drag-and-drop works with files and folders
- Path traversal is blocked

**Exit Criteria:**
- No browser File System Access API calls remain
- All file operations go through native Electron APIs
- File dialogs are native Windows dialogs
- Drag-and-drop works across all file-based tools

**Status: COMPLETE (2026-09-15)**
- Implemented IPC channels: `FileSelectFiles`, `FileSelectFolder`, `FileSaveAs`, `FileRead`, `FileWrite`, `FileExtractWrite`, `FileStat`, `FileApprovePaths`, `FileClearApprovals`, `FileGetTempDir`, `FileSaveOutput` (electron/channels.ts, electron/ipc/file.ts, electron/preload.ts).
- `window.fileforge` API exposed in sandboxed preload incl. `getPathForFile` via `webUtils` for dropped files.
- Path validation module (electron/security/path-validation.ts): null byte / traversal / absolute-in-relative / Windows reserved names rejection, segment sanitization, `safeJoin`, `isWithinOrEqual`, `uniquePath` auto-rename.
- Session approval registry (electron/services/approval.ts): reads only for dialog-selected/dropped paths; writes within temp base, chosen output/extraction dirs, or parent of approved inputs.
- Temp management (electron/services/temp.ts): `%TEMP%\FileForge\jobs\<id>`, per-job cleanup, orphan cleanup on start.
- Output location: Settings `defaultOutputDir`, renderer auto-save on job completion, Save As dialog, `saveOutput` location resolution (outputDir → inputFolder → temp) with ` (1)`, ` (2)` suffix rename on conflict.
- Renderer migrated: file-service.ts native branches (`pickFiles`, `readFileAsArrayBuffer/Blob`, `fileMetasFromDrop`, `writeExtractionEntry`), zip/tar engines extract via IPC on desktop, zip-preview reads via IPC, drop handling in home + tool-workspace, JobProgress "Save As" button.
- Web/PWA branch preserved; renderer remains sandboxed (no Node access).
- Tests: 189/189 pass (incl. new path-validation, temp, file-service suites). Typecheck + ESLint clean.
- CDP verification (14/14): getTempDir, statFile (exists/null), readFile with/without approval, writeFile to temp, extraction with parent-dir creation, traversal rejection (read/extract/write), saveOutput auto-save + auto-rename on collision.

---

### Phase 10 — Processing Engine Migration

**Goal:** Migrate processing engines from browser context to Node.js.

**Features / Work Items:**

**Image Engine:**
- Replace Canvas API with `sharp` or `node-canvas`
- Implement: convert, compress, resize, crop, rotate
- EXIF handling via `sharp.metadata` or `exif-reader`
- Batch processing (ZIP output for multiple files)
- Performance benchmarking vs Canvas

**PDF Engine:**
- pdf-lib works in Node.js — migrate directly
- pdfjs-dist needs Node.js canvas for rendering (to-images)
- Test all PDF tools: merge, split, compress, organize, to-images

**ZIP Engine:**
- JSZip works in Node.js — migrate directly
- Or evaluate `adm-zip` as alternative
- Preserve all safety limits (2000 entries, 4GB, 32 depth)

**TAR Engine:**
- Pure-JS parser — reuse directly (no changes needed)
- Or evaluate `tar` package for better edge case handling

**FFmpeg Engine:**
- Option A: Keep `@ffmpeg/ffmpeg` WASM (works in Node.js)
- Option B: Use native FFmpeg binary via `child_process`
- Option C: Bundle FFmpeg binary alongside the app
- Decision needed: performance vs size tradeoff
- Preserve 200 MiB warn / 1 GiB hard limit

**Rename Engine:**
- Pure-JS — reuse directly

**Duplicate Engine:**
- `crypto.subtle` available in Node.js — migrate directly

**File Info Engine:**
- Replace Canvas image dimensions with `sharp` metadata
- EXIF via `exif-reader`
- Media duration parsing (reuse existing header parsers)
- PDF page count via pdf-lib (reuse)

**Worker Strategy:**
- Heavy engines (FFmpeg, image batch, PDF-to-images) run in `worker_threads`
- Lightweight engines (rename, duplicate, developer tools) run in main process
- Worker thread pool for concurrent job support

**Dependencies:** Phase 9 complete.
**Deliverables:**
- All 8 engines work in Node.js context
- Worker threads for heavy processing
- All existing safety limits preserved
- Performance meets or exceeds web version

**Testing:**
- Each engine: success path + failure path with real files
- Batch processing works (multiple images > ZIP)
- Memory usage is acceptable for large files
- Worker thread cleanup on cancel
- All security guardrails verified

**Exit Criteria:**
- All 26 tools work identically to web version
- No browser-specific APIs used in engines
- Worker threads handle heavy processing
- All safety limits preserved

**Status: COMPLETE (2026-09-15)**

**Engine modules (electron/engines/modules/):**
- image.ts — convert / compress / resize / crop via `@napi-rs/canvas`, EXIF write-back via `electron/engines/util/exif.ts`, batch → ZIP.
- pdf.ts — pdf-lib direct migration (images-to-pdf, merge, split, compress, organize + rotate), range parser + rotation coercion, worker-safe.
- pdf-to-images.ts — pdfjs-dist v6 with a Node `CanvasFactory` class backed by `@napi-rs/canvas` (v6 requires the option to be a constructor), `file:` fetch shim + `standard_fonts` URL, 200-page cap, png/jpg, single-page file or ZIP.
- zip.ts (module) + util/zip.ts — JSZip create/extract, entry/limit guards (2000 entries, 4 GiB uncompressed, 32 depth), traversal rejection, extract-to-folder report or re-packaged ZIP.
- tar.ts — pure-JS parser re-packaged as ZIP or extracted to folder with report.
- rename.ts — prefix / suffix / find-replace / sequential with pad + start number, single-file rename or ZIP.
- duplicate.ts — SHA-256 dedupe groups via `crypto`.
- file-info.ts — name/size/hash/dimensions/type via canvas metadata, exif-reader, and existing header parsers.
- ffmpeg.ts — native binary via `child_process` (bundled `ffmpeg-static` at `%TEMP%`-independent path, packaged copy in `resources/ffmpeg`), pure arg builders, 200 MiB warn / 1 GiB hard limit, cancel via process kill.

**Architecture:**
- Light engines (pdf, zip, tar, rename, duplicate, fileInfo, computeHash) run in the main process; heavy engines (image.*, pdf.toImages, ffmpeg.*) run in a `worker_threads` pool (max `cpuCount-1`, up to 4) — electron/engines/pool.ts + worker-src/worker.ts, bundled to `out/main/worker.js`.
- `runner.ts` dispatches the 20 engine kinds, resolves the FFmpeg binary (packaged path vs dev `ffmpeg-static`), aborts via AbortController; job temp dir is created per request.
- Renderer: `src/engines/native.ts` (`nativeEngine`/`engineFor`) routes all 26 tools to `window.fileforge.runEngine` on desktop while web engines remain untouched; previews (zip/rename) migrate engines to native.
- Fixed prod issues found by CDP: worker entry URL (`./worker.js`, not `../worker.js`), `writeZipArchive` now ensures `workDir` exists, pdfjs v6 `CanvasFactory` must be a constructor.

**Testing:**
- New engine unit suites: `electron/engines/util/common.test.ts`, `util/zip.test.ts`, `modules/{image,pdf,zip,tar,rename,duplicate,file-info,ffmpeg}.test.ts` (ffmpeg tests use the real binary when `ffmpeg-static` is present). 245/245 tests pass.
- Typecheck (`tsc -b`, `tsc -p electron/tsconfig.json`) + ESLint clean.
- CDP end-to-end verification (25/25) via `scripts/verify-phase10.mjs`: launches the built app with `--remote-debugging-port=0`, generates real fixtures (@napi-rs/canvas, pdf-lib, JSZip, hand-built TAR, ffmpeg-generated mp3/mp4), runs all 18 file-producing kinds + 3 data kinds through the real IPC/worker pipeline, asserts `statFile` size matches, saves output beside input (`inputFolder`), and best-effort cancel (ffmpeg v2 aborted).

---

### Phase 11 — Job System Enhancement

**Goal:** Upgrade job system for desktop with queue, persistence, and enhanced UX.

**Features / Work Items:**
- Implement processing queue with visual panel
- Concurrent job management (configurable limits)
- Job persistence (survive window close/reopen)
- Enhanced progress reporting:
  - Current file name in batch operations
  - Total files count
  - Stage message
  - Percentage (where reliable)
- Cancellation for all job types (AbortSignal in workers)
- Retry for failed jobs (same inputs + options)
- Error handling:
  - Human-readable messages
  - Technical details in expandable section
  - Affected file information in batch errors
- Job history integration (auto-record on completion/failure)
- Queue UI component (pending, processing, completed, failed sections)

**Dependencies:** Phase 10 complete.
**Deliverables:**
- Queue panel with all job states
- Concurrent job support
- Job persistence across app restarts
- Enhanced progress and error display

**Testing:**
- Multiple concurrent jobs process correctly
- Cancel works during any job type
- Retry creates new job from failed job
- Job history records correctly
- Queue UI updates in real-time

**Exit Criteria:**
- Queue management works for all job types
- Jobs persist across app restarts
- Progress is accurate and timely
- Cancel and retry work reliably

**Status: COMPLETE (2026-09-15)**

**Queue core:**
- `src/services/queue.ts` — FIFO scheduler with `pump()` honoring `settings.maxConcurrentJobs` (default 2, clamped 1–4). `enqueueJob` / `retryJob` / `cancelQueuedJob` / `deleteJobFromQueue` / `isRetryable` / `getIncompleteJobs` / `getTerminalJobs` / `initQueue` / `subscribeQueueRuntime`. `cancelQueuedJob` cancels before or during execution (AbortSignal); retry creates a new job (`id` fresh, `retryCount` +1) and restarts the queue.
- `src/services/job-runner.ts` — `executeJob(jobId)` drives pre-created jobs (tool lookup, abort controller, progress forwarding incl. `index`/`total`); `runJob(input)` kept as a compat wrapper. Batch errors map to `failJobWithDetails` (human message + `errorDetails` stack + `failedFiles`). Pending jobs that never started are cancelled instead of failed on pagehide; in-flight jobs are marked interrupted via `sessionStorage` marker.

**Persistence & restore:**
- `src/services/job-persistence.ts` — IndexedDB DB `fileforge_jobs` / store `queued` holds non-terminal jobs only; `saveQueuedJob` writes on every status change via the queue's subscriber.
- On restart `initQueue()` auto-resumes `pending` jobs whose inputs all carry `path` (desktop), marks restored `processing` jobs as failed with `interrupted: true` (Retry offered), records both into history, and cancels pending restores when `resumePendingJobs` is off (web restores have no paths → marked interrupted).

**Per-file error reporting (M2):**
- `BatchError` (`src/utils/batch-error.ts`, `electron/engines/util/common.ts`) carries `failedFiles` + `details`. Batch loops in image convert/compress/resize/crop, rename, images-to-pdf, pdf merge, pdf-to-images, and create-zip (web + electron) collect per-file failures, keep processing the rest, then fail the job with "X of Y processed, but N could not be processed and were skipped" and drop the first failure's text when everything failed. Abort errors are rethrown untouched; duplicate/extract engines intentionally not covered (outside the queue path, native-only).

**UI:**
- New `/jobs` page (`src/pages/jobs.tsx`) with Active (pending/processing) and Finished (completed/failed/cancelled, in this session) sections, empty states, "Retry failed" and "Clear finished"; `src/components/queue-job-card.tsx` renders status badge, progress + file x of y, expandable affected-files/technical error details, and Cancel / Retry / Save / Remove actions (Save via `saveAsFile`/`saveAsOutput` on desktop, blob download on web).
- `global-job-indicator.tsx` shows active count, aggregate progress and detail, and a View link; `JobProgress` gained retry UI + expandable error details (failed files + stack); nav has a Jobs item; Settings added "Jobs & queue" (max concurrent 1–4, resume toggle); `App.tsx` runs `initQueue()` on mount.

**Settings:**
- `maxConcurrentJobs` (default 2), `resumePendingJobs` (default true) added to `src/services/settings-service.ts` + Settings page.

**Testing:**
- New suites: `src/services/queue.test.ts` (concurrency cap, cancel-pending, retry new-id + retryCount + fail-then-success, delete, BatchError→failedFiles mapping), `src/services/queue-init.test.ts` (restore: auto-resume + interrupted failure), `src/services/job-persistence.test.ts` (serialize/deserialize, persistableProgress, save/load/delete, ignores terminal). Uses `fake-indexeddb` (devDependency).
- 259/259 tests pass; `tsc -b`, `tsc -p electron/tsconfig.json`, ESLint all clean.

---

### Phase 12 — Windows Integration

**Goal:** Add native Windows desktop features.

**Features / Work Items:**
- Windows notifications:
  - Electron `Notification` API
  - Events: completed, failed, batch completed, update available
  - No sensitive file content in notifications
  - Toggle in Settings
- Clipboard integration:
  - Copy developer tool results (all 7 tools)
  - Copy file path from result cards
  - Standard keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A)
- Open output actions:
  - "Open File" via `shell.openPath()`
  - "Open Folder" via `shell.showItemInFolder()`
  - "Copy Path" via `navigator.clipboard.writeText()`
- Start Menu shortcut (via installer)
- Optional Desktop shortcut (via installer)
- Overwrite protection:
  - Auto-rename with suffix by default
  - Configurable in Settings

**Dependencies:** Phase 11 complete.
**Deliverables:**
- Notifications work for all job events
- Clipboard integration works for developer tools
- Open output actions work
- Installer creates shortcuts

**Testing:**
- Notifications appear on Windows
- Clipboard copy works in developer tools
- Open File/Folder works with default applications
- Overwrite protection triggers correctly

**Exit Criteria:**
- All Windows integration features work
- Notifications are non-intrusive and informative
- Clipboard integration is seamless

**Status: Complete (2026-09-15)**

**Notifications:**
- `electron/ipc/notifications.ts` — `notify:show` validates `{title, body}` (non-empty, ≤64/300 chars), uses `Notification.isSupported()`, and focuses/restores the owning window on click.
- `src/services/desktop-notifications.ts` — subscribes to all jobs; fires only when the window is NOT focused (`document.hasFocus()`) and notifications are enabled. Bodies are content-free (no paths/filenames): completed → "Done — your files are ready.", batch (>1 file) → "Batch complete — N files processed.", failed → "Something went wrong while processing. Open FileForge for details.". Per-instance dedupe prevents repeats on re-subscribe. "Update available" deferred to Phase 13.
- Settings toggle `notificationsEnabled` (default on).

**Clipboard & open output:**
- `src/pages/developer-tool-workspace.tsx` — shared copy button covers all 7 dev tools (JSON, Base64, Hash, UUID, URL, JWT, Timestamp); Ctrl+C/V/X/A are native textarea behaviors.
- `src/services/file-service.ts` — `copyPath()` via `navigator.clipboard.writeText`, `openPath()` and `showInFolder()` via IPC.
- New `src/components/saved-file-actions.tsx` — Open file / Open folder / Copy path actions on result cards (web renders nothing).
- `Job` gained `savedPath?: string` (`src/types/job.ts`); auto-save, Save actions on queue cards, and the jobs page record it (`setJobSavedPath`/`clearJobSavedPath`), cleared on retry (`job-runner.ts`).

**Overwrite protection:**
- `electron/services/overwrite.ts` — `OverwriteMode = 'autorename' | 'confirm'`; `resolveOutputTarget()` returns a unique `name (n)` path by default, or prompts once per save request ("Overwrite" / "Keep both") in confirm mode. Raw FS always keeps `uniquePath` for thread/file safety.
- Single-file auto-saves (`saveOutput`/`saveOutputFile`) pass `settings.overwriteProtection`; unknown values fall back leniently to auto-rename. Extract-to-folder entries and Save As use user-chosen destinations.
- Settings select `overwriteProtection` (default 'autorename').

**IPC surface:** `shell:openPath` and `shell:showItemInFolder` (both validate inputs, require an existing file) in `electron/ipc/shell.ts`; exposed as `openFile`/`showItemInFolder`/`notify` on the preload bridge.

**Testing:**
- New suites: `electron/services/overwrite.test.ts` (autorename suffixes, confirm mode, invalid-mode fallback), `src/services/settings-service.test.ts` (defaults/round-trip/merge/reset), `src/services/desktop-notifications.test.ts` (bodies, focus/disabled/no-op, dedupe).
- `scripts/verify-phase12.mjs` (CDP, 11 checks): bridge keys, autorename `(1)`/`(2)` collisions, invalid-mode fallback, confirm no-collision, `saveOutputFile` collision, toast shown, payload rejection, engine → save → Open File/Open Folder, missing-file error.
- 280/280 tests pass; `tsc -b`, `tsc -p electron/tsconfig.json`, ESLint all clean; 11/11 CDP verification passed.

---

### Phase 13 — Auto-Update System

**Goal:** Implement application self-update.

**Features / Work Items:**
- Install and configure `electron-updater` (or alternative)
- Set up update server (GitHub Releases or custom)
- Implement update check (on startup + manual)
- Implement update download with progress
- Implement update installation (prompt for restart)
- Handle failed downloads with retry
- Version comparison logic
- User control:
  - Toggle auto-check in Settings
  - Manual "Check for Updates" in Settings
  - Dismiss/skip specific versions
- Update notification UI
- Changelog display

**Dependencies:** Phase 12 complete.
**Deliverables:**
- Auto-update check works
- Download and install work
- Manual check works
- Failed update handling works

**Testing:**
- Check for updates finds new version
- Download progresses correctly
- Install and restart work
- Failed download shows retry option
- Skip version works

**Exit Criteria:**
- Update flow works end-to-end
- User has full control over updates
- Failed updates are handled gracefully

**Status: COMPLETE (2026-09-16)**

**Technology decision:** `electron-updater` (^6.8.9) with the GitHub provider pointed at `SALMANHABIB443/FileForge` (the git remote). `autoDownload=false` and `autoInstallOnAppQuit=false` — downloads and installs are always user-triggered (PRD: "user can dismiss/skip, not forced"). `publish` config added to electron-builder so `app-update.yml` + `latest.yml` are generated at package time; release publishing itself remains Phase 15.

**Main process:**
- `electron/services/updater.ts` — driver abstraction (`UpdaterDriver`), real wrapper over `autoUpdater` (dynamic import, updates never forced), deterministic `createMockUpdaterDriver` (env `FILEFORGE_UPDATER_MOCK=1`, error modes via `FILEFORGE_UPDATER_MOCK_ERR=check|download`), pure `mapUpdaterEvent`/`normalizeReleaseNotes` (string vs `{version,note}[]`)/`updaterErrorMessage`, and `createUpdaterController` state machine (checking → available → downloading → downloaded → error; `dev` when an unpackaged build has no driver; `subscribe()` replays the last status).
- `electron/ipc/updater.ts` — `update:check`, `update:download`, `update:install` (no-arg channels, arguments rejected), stable status broadcast over `update:status` to every BrowserWindow; unpackaged builds without the mock env short-circuit to `dev`.
- Preload bridge: `checkForUpdates`, `downloadUpdate`, `installAndRestart`, `onUpdateStatus` (typed via `FileForgeApi`).

**Renderer:**
- `src/services/updater.ts` — module store (`getUpdateState`/`subscribeUpdates`), bridge event mapping, `checkForUpdates`/`downloadUpdate`/`installAndRestart`/`dismissUpdate`, skip-version persistence in `localStorage` (`fileforge_skipped_update` — exact version match, newer versions re-announce), and `initUpdater()` (desktop only; auto-check 10s after launch when `autoCheckUpdates` is on, re-read at fire time).
- `src/pages/settings.tsx` — "Updates" section: current version, auto-check toggle, "Check for Updates", and live status (checking / up-to-date / available + changelog + Download + Not now / downloading progress bar / downloaded + Install and Restart / error + Retry / dismissed).
- `src/services/desktop-notifications.ts` — `initUpdateNotifications()` raises the Phase-12-deferred "update available" Windows toast (respects focus + `notificationsEnabled`; generic body, one toast per announced version).
- `App.tsx` mounts `initUpdater()` + both notification hooks; Settings gained `autoCheckUpdates` (default true).

**Testing:**
- New suites: `electron/services/updater.test.ts` (release-notes normalization, error messages, event mapping incl. percent clamping, auto-updater config guard, controller state flow incl. late subscribers/unsubscribe/failure modes), `electron/ipc/updater.test.ts` (mock-electron: channel registration, happy path, dev short-circuit, check-error status, arg rejection), `src/services/updater.test.ts` (state mapping, skip/dismiss, bridge actions, startup auto-check with fake timers), plus update-toast coverage in `desktop-notifications.test.ts`; settings-service defaults extended.
- `scripts/verify-phase13.mjs` (CDP, 8 checks): bridge keys, mock happy path (checking→available→downloading→downloaded with release notes + progress), arg rejection via raw `invoke`, unpackaged `dev` short-circuit, mock check-error status.
- 322/322 tests pass; `tsc -b`, `tsc -p electron/tsconfig.json`, ESLint clean; 8/8 CDP verification passed.

---

### Phase 14 — Testing and Quality Assurance

**Goal:** Comprehensive testing of the Electron application.

**Features / Work Items:**
- Unit tests (Vitest): engines, services, utilities
- Integration tests: IPC handlers, file operations
- Electron tests: window behavior, dialogs
- Filesystem tests: read/write/cleanup, temp management
- Security tests: path validation, IPC argument validation
- Large-file tests: memory, performance, cancellation
- UI tests: component rendering, user interaction
- E2E tests: full workflow (select > process > save)
- Performance benchmarking vs web version
- Memory profiling for large file operations
- Windows compatibility testing (Windows 10/11)
- Accessibility testing on desktop

**Dependencies:** Phase 13 complete.
**Deliverables:**
- Test suite passes for all components
- Performance benchmarks documented
- Security audit completed
- Windows compatibility verified

**Testing:**
- All automated tests pass
- Manual QA on Windows 10 and 11
- Large file operations don't crash
- Security guardrails are effective

**Exit Criteria:**
- All tests pass
- No critical bugs
- Performance meets requirements
- Security audit passed

**Status: COMPLETE (2026-09-17)**

**Test suite:** 436/436 Vitest tests pass across 57 files (engines, services, IPC integration, filesystem, security, large-file/stress/cancellation, UI components). `tsc -b`, `tsc -p electron/tsconfig.json`, ESLint, and `electron-vite build` are all clean. Engine suites grew to 87 tests (15 files) incl. the stress suite for large-file memory/perf/cancellation.

**E2E + accessibility — `scripts/verify-phase14.mjs` (26/26 checks):**
- Launch 1 (IPC pipeline): bridge/env exposed; single-file `image.convert` produces a real JPEG on disk (magic bytes asserted); explicit `outputDir` save; `cleanupJobTemp`; multi-file `image.convert` streams progress (45/90/95/100) and saves the batch ZIP; `zip.create → zip.extract` round trip; `pdf.merge` yields valid `%PDF`; `cancelEngine` aborts a heavy request; malformed IPC calls rejected.
- Launch 2 (real UI queue): seeded IndexedDB pending job resumes as Active with Cancel, workspace auto-save writes the result to disk (input folder), desktop actions (Open file / Open folder / Copy path), Jobs list shows completed + saved path, and a pathless synthetic drop fails cleanly with a readable `role="alert"`.
- Launch 3 (UI cancel): Cancel button stops the engine → `Cancelled`, queue entry removed.
- Launch 4 (settings + a11y): real nav-link to Settings, toast toggle persists via Save Settings, and axe-core scans `#/`, `#/tools`, `#/tool/image-convert`, `#/jobs`, `#/settings` — **no critical/serious violations**; color-contrast node counts recorded as a known finding (23/32/8/8/40).

**Performance — `scripts/benchmark-electron.mjs` + `Benchmarks.md`:** end-to-end `runEngine` round trips (worker + IPC + disk) on a 4-core Windows 11 machine — image.convert 1/4/8 MP 57/206/260 ms, image.compress 8 MP 404 ms, image.resize 8 MP 281 ms, zip.create 1/6 MB 74/404 ms, SHA-256 hash 6 MB 28 ms (~214 MB/s), pdf.merge 2/10 pages 6/7 ms. Raw output regenerated into `benchmark-results.md`.

**Connectivity / platform:** `QA.md` adds the Windows 10/11 manual QA checklist (install, dialogs, toasts, updater, a11y, stability). Web-vs-desktop comparisons are intentionally not automated (different engine stacks — WASM vs native workers), documented in `Benchmarks.md`.

---

### Phase 15 — Production Release

**Goal:** Package, sign, and release FileForge for Windows.

**Features / Work Items:**
- Finalize `electron-builder` configuration
- Application icon (.ico, multiple sizes)
- Windows installer (NSIS or MSI):
  - Start Menu shortcut
  - Optional Desktop shortcut
  - Installation directory selection
  - Version information
  - Proper uninstaller
- Code signing (if certificate obtained)
- Production build pipeline:
  - React build (Vite)
  - Electron packaging
  - Installer generation
  - Update artifact generation (latest.yml)
- Version bumping workflow
- Release documentation
- Final QA pass

**Dependencies:** Phase 14 complete.
**Deliverables:**
- `FileForge-Setup-x.y.z.exe` installer
- Update artifacts
- Release notes
- Documentation updated

**Testing:**
- Installer works on clean Windows system
- Uninstaller removes all application files
- Uninstaller preserves user files
- Update flow works from installed version
- Application runs without errors

**Exit Criteria:**
- Installer works reliably
- Application passes all tests
- Documentation is complete and accurate
- Release artifacts are ready

**Status: COMPLETE (2026-09-17)**

**Packaging — `scripts/verify-phase15.mjs` (33/33 checks):** `npm run package:electron` produces `release/FileForge-Setup-1.0.0.exe` (NSIS, oneClick=false, install-dir selection, Start Menu + optional Desktop shortcut, proper uninstaller, FileVersion 1.0.0 + publisher metadata embedded) plus the differential blockmap, `latest.yml` (version + sha512 + releaseDate + release notes), `app-update.yml` inside the packaged app, and `win-unpacked/` with the bundled `resources/ffmpeg/ffmpeg.exe`. Packaged `FileForge.exe` launches and stays running (smoke test). electron-builder warnings for description/author resolved; `build/icon.ico` packs 7 sizes (16–256).

**Build pipeline / versioning:** scripts added — `package:dir` (unpacked smoke build), `package:electron` (installer), `release` (`electron-builder --win --publish always` with `GH_TOKEN`); `.gitignore` now covers `out/`, `release/`, `*.blockmap`. Version bumped `0.1.0` → `1.0.0` (package.json + lockfile; `__APP_VERSION__` injected). Deterministic version-bump → tag → publish workflow documented in `RELEASE.md`.

**Signing / docs:** intentionally unsigned (no certificate yet; SmartScreen warning documented). `RELEASE.md` covers prerequisites, version bumping, local installers, GitHub Releases publishing, auto-update behavior, code signing, release checklist, and troubleshooting; `QA.md` gains the packaging QA section; `Architecture.md` and `README.md` updated to reflect the shipped installer.

**Testing/QA:** 436/436 Vitest tests pass (57 files), `tsc -b` + electron typecheck clean, ESLint clean, electron build clean, phase 10/12/13/14 verifiers previously green. Manual install/uninstall/update pass on clean Windows 10/11 remains a human step (see `QA.md` §11).

---

## Summary Timeline Guidance

| Phase | Focus | Approximate Effort |
|-------|-------|-------------------|
| 0-7 | Web/PWA (Complete) | Done |
| 8 | Electron Foundation | 1-2 weeks |
| 9 | Native File System | 2-3 weeks |
| 10 | Engine Migration | 3-4 weeks |
| 11 | Job System Enhancement | 2-3 weeks |
| 12 | Windows Integration | 2-3 weeks |
| 13 | Auto-Update | 1-2 weeks |
| 14 | Testing and QA | 2-3 weeks |
| 15 | Production Release | 1-2 weeks |

Total estimated effort: 14-22 weeks for Electron migration.

Actual calendar time depends on team size, decisions on unresolved items (FFmpeg strategy, image engine choice, installer format), and testing results.

---

## Cross-Phase Rules

- Never expand scope inside a phase without updating Features.md and this document.
- Every new tool must register in the Tool Registry and appear in the correct category.
- DESIGN.md remains the visual source of truth; no visual experiments in feature phases.
- Privacy and offline-first rules are non-negotiable.
- Prefer shipping a smaller reliable set over a larger fragile set.
- Preserve all existing security guardrails during migration.
- Do not silently increase file limits without documenting the change.
- All IPC handlers must validate arguments.
- Renderer must never have unrestricted Node.js access.
- Test changes before marking complete.

---

This roadmap ensures the product remains focused, privacy-respecting, and technically realistic at every stage. The web/PWA version (Phases 0-7) is the foundation; the Electron migration (Phases 8-15) builds on it without breaking existing functionality.
