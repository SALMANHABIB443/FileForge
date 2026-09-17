# Architecture.md — System Architecture

**Product:** FileForge
**Last Updated:** 2026-09-17
**Status:** Electron architecture implemented and verified through phase 15 — Windows production build (NSIS installer, code-signing-ready pipeline, GitHub Releases publishing) shipped as of the 1.0.0 release.

---

## 1. Current Architecture (Web/PWA)

FileForge is a privacy-first, client-side file utility application. All processing happens in the browser. There is no backend, no server, and no file uploads.

### 1.1 Layer Diagram (Current)

```
React UI Components / Pages
        |
        v
Zustand State Store
        |
        v
Services Layer
  +-- Tool Registry (src/services/tool-registry.ts)
  +-- Job Service (src/services/job-service.ts)
  +-- Job Runner (src/services/job-runner.ts)
  +-- File Service (src/services/file-service.ts)
  +-- History Service (src/services/history-service.ts)
  +-- Settings Service (src/services/settings-service.ts)
  +-- Flags Service (src/services/flags-service.ts)
  +-- Local Analytics (src/services/local-analytics.ts)
  +-- Logger (src/services/logger.ts)
        |
        v
Engine Layer (lazy-loaded)
  +-- Image Engine (src/engines/image-engine.ts)
  +-- PDF Engine (src/engines/pdf-engine.ts)
  +-- ZIP Engine (src/engines/zip-engine.ts)
  +-- TAR Engine (src/engines/tar-engine.ts)
  +-- FFmpeg Engine (src/engines/ffmpeg-engine.ts)
  +-- Rename Engine (src/engines/rename-engine.ts)
  +-- Duplicate Engine (src/engines/duplicate-engine.ts)
  +-- File Info Engine (src/engines/file-info-engine.ts)
        |
        v
Browser APIs / Libraries
  +-- Canvas API (image rendering)
  +-- File System Access API (showOpenFilePicker, showDirectoryPicker)
  +-- <input type="file"> fallback
  +-- IndexedDB (history)
  +-- localStorage (settings)
  +-- crypto.subtle (hashing)
  +-- Web Workers (pdfjs-dist)
```

### 1.2 Tool Registry Pattern

All 26 tools are registered at startup via `registerAllTools()` in `src/tools/index.ts`. Each tool is a `ToolDefinition` object containing:

- `id` — unique identifier (e.g., `image-convert`)
- `name` — display name
- `description` — short description
- `category` — one of: `image`, `pdf`, `video`, `audio`, `archive`, `file-tools`, `developer`
- `supportedInputs` — MIME type patterns (e.g., `['image/']`)
- `defaultOptions` — default configuration values
- `optionSchema` — UI form schema for tool options
- `engine` — lazy-loaded engine adapter (optional; developer tools have no engine)
- `acceptsMultipleFiles` — whether the tool supports batch input

### 1.3 Job System

The job system manages the lifecycle of processing tasks:

```
JobService.createJob()
    |
    v
JobRunner picks job -> EngineAdapter.execute(job, onProgress, signal)
    |
    v
Engine writes to temporary workspace
    |
    v
Validation -> outputBlob/outputUrl
    |
    v
Job status = completed | failed | cancelled
    |
    v
HistoryService.record + UI update + cleanup
```

**Job States:** `pending` -> `processing` -> `completed` | `failed` | `cancelled`

**Job Data:**
- `id` (unique)
- `toolId`
- `status`
- `inputs: FileMeta[]`
- `options`
- `progress: { percent, message }`
- `outputBlob`, `outputUrl`
- `createdAt`, `updatedAt`
- `error` (on failure)

**Cancellation:** `AbortController`-based. Each job has an associated `AbortSignal`. Cancel sets the signal, which engines check via `checkAbort(signal)` at safe points.

**Interruption Recovery:** `pagehide` event aborts running jobs and sets an interruption marker in `sessionStorage`. `InterruptedBanner` component displays after reload.

### 1.4 File Service

File selection uses the File System Access API when available (`window.showOpenFilePicker`), with a fallback to a hidden `<input type="file">` element.

```typescript
// FileMeta — the common file representation
interface FileMeta {
  id: string            // temporary unique ID
  name: string          // filename
  size: number          // bytes
  type: string          // MIME type
  lastModified: number  // timestamp
  handle?: FileSystemFileHandle  // FSAPI handle (when available)
  file?: File           // File object (fallback)
}
```

The `readFileAsBlob()` function resolves the file from either `handle.getFile()` or the `file` property.

### 1.5 Engine Pattern

Engines are isolated processing modules. Each exports one or more functions with the signature:

```typescript
type EngineAdapter = (
  inputs: FileMeta[],
  options: Record<string, unknown>,
  onProgress?: (percent: number, message?: string) => void,
  signal?: AbortSignal,
) => Promise<ConversionResult>

interface ConversionResult {
  blob: Blob
  filename: string
}
```

Engines are lazy-loaded via the `lazyEngine()` helper to keep the initial bundle small.

### 1.6 State Management

Global state is managed via Zustand (`src/store.ts`):

- Selected files
- Active tool
- Active job

### 1.7 Storage

| Data | Storage | Persistence |
|------|---------|-------------|
| History entries | IndexedDB (`fileforge_history`) | Max 200 entries, auto-pruned |
| Settings | localStorage (`fileforge_settings`) | Session-independent |
| Feature flags | localStorage | Session-independent |
| Local analytics | localStorage | Session-independent |
| Diagnostic logs | IndexedDB | Capped 500-entry ring buffer |
| Job state | In-memory | Lost on page reload (with sessionStorage interruption marker) |

### 1.8 Build System

- **Bundler:** Vite 6 with React plugin
- **Styling:** Tailwind CSS v4 via Vite plugin
- **PWA:** vite-plugin-pwa with Workbox (service worker, offline caching)
- **TypeScript:** Strict mode, ES2020 target, bundler module resolution
- **Path aliasing:** `@/` resolves to `src/`
- **Testing:** Vitest 3
- **Linting:** ESLint 10

---

## 2. Target Electron Architecture

> **Implementation status (Phases 8–10 complete):** the Electron foundation, native file system layer, and native processing engine layer are implemented and verified. Sections marked **Implemented** describe the current `electron/` source; the rest remain design targets. The web/PWA remains the primary target.

The Electron application must:
- Preserve all existing FileForge functionality
- Behave like a native Windows utility, not a website in a shell
- Maintain the privacy-first, local-processing principle
- Use secure Electron patterns (context isolation, no Node.js in renderer)

### 2.1 Layer Diagram (Target)

```
+----------------------------------------------------------+
|                    Electron Window                         |
|                                                            |
|  +------------------------------------------------------+ |
|  |              React Renderer Process                   | |
|  |                                                        | |
|  |  UI Components / Pages / Tool Config                   | |
|  |          |                                             | |
|  |  Zustand State Store                                   | |
|  |          |                                             | |
|  |  Job Progress / Queue UI                               | |
|  |          |                                             | |
|  |  window.fileforge.invoke(channel, ...args)             | |
|  +------------------------------------------------------+ |
|                        |                                    |
|                   IPC Bridge                                |
|                        |                                    |
|  +------------------------------------------------------+ |
|  |              Preload Script (contextBridge)            | |
|  |                                                        | |
|  |  fileforge.invoke(channel, ...args)                    | |
|  |  fileforge.on(channel, callback)                       | |
|  |  fileforge.selectFiles(options)                        | |
|  |  fileforge.selectFolder(options)                       | |
|  |  fileforge.saveFile(data, defaultName, filters)        | |
|  |  fileforge.openOutputFolder(path)                      | |
|  |  fileforge.notify(title, body, options)                 | |
|  |  fileforge.getPlatform()                               | |
|  +------------------------------------------------------+ |
+----------------------------------------------------------+
                        |
                   Electron IPC
                        |
+----------------------------------------------------------+
|                 Electron Main Process                      |
|                                                            |
|  +------------------+  +------------------+               |
|  | Window Manager   |  | IPC Handlers     |               |
|  | (BrowserWindow)  |  | (channel router) |               |
|  +------------------+  +------------------+               |
|                                                            |
|  +------------------+  +------------------+               |
|  | File Service     |  | Dialog Service   |               |
|  | (Node.js fs)     |  | (native dialogs) |               |
|  +------------------+  +------------------+               |
|                                                            |
|  +------------------+  +------------------+               |
|  | Notification     |  | Updater Service  |               |
|  | Service          |  | (electron-updater)|              |
|  +------------------+  +------------------+               |
|                                                            |
|  +------------------+  +------------------+               |
|  | Job Service      |  | History Service  |               |
|  | (queue/worker)   |  | (SQLite/JSON)    |               |
|  +------------------+  +------------------+               |
|                                                            |
|  +------------------+  +------------------+               |
|  | Settings Service |  | Logger Service   |               |
|  | (electron-store) |  | (file-based)     |               |
|  +------------------+  +------------------+               |
|                                                            |
|  Processing Engines (Node.js context)                      |
|  +-- Image Engine (node-canvas or sharp)                   |
|  +-- PDF Engine (pdf-lib + pdfjs-dist)                     |
|  +-- ZIP Engine (JSZip or adm-zip)                         |
|  +-- TAR Engine (tar or pure-JS)                           |
|  +-- FFmpeg Engine (native binary or WASM)                 |
|  +-- Rename Engine                                         |
|  +-- Duplicate Engine                                      |
|  +-- File Info Engine                                      |
|         |                                                  |
|         v                                                  |
|  Windows File System (Node.js fs)                          |
+----------------------------------------------------------+
```

### 2.2 Renderer Process

**Responsibilities:**
- React UI rendering, navigation, user interaction
- Zustand state management (selected files, active tool, job state)
- Tool configuration forms
- Job progress display and queue visualization
- Drag-and-drop handling
- Clipboard integration for developer tools

**Must NOT:**
- Import or use Node.js modules (`fs`, `path`, `child_process`, etc.)
- Access the filesystem directly
- Use `window.require()` or `process.*`
- Make arbitrary IPC calls without going through the preload bridge

**IPC Communication Pattern:**

```typescript
// Renderer calls (via preload bridge)
const result = await window.fileforge.invoke('file:read', { path: filePath })
const files = await window.fileforge.selectFiles({ filters: [...] })
const saved = await window.fileforge.saveFile(data, 'output.pdf', filters)
```

### 2.3 Preload Bridge

**Responsibilities:**
- Expose a typed, limited API surface to the renderer via `contextBridge`
- Forward renderer calls to main process via `ipcRenderer.invoke()`
- Receive progress events from main process via `ipcRenderer.on()`
- Validate arguments before forwarding

**Security Model:**
- `contextIsolation: true` — renderer and preload share no prototypes
- `nodeIntegration: false` — renderer has no Node.js access
- `sandbox: true` — renderer runs in a sandboxed process
- Only explicitly exposed methods are available to the renderer

**Exposed API Surface (implemented; canonical type in `electron/types.ts`):**

```typescript
interface FileForgeAPI {
  // File operations
  selectFiles(options?: FileDialogOptions): Promise<FileHandle[]>
  selectFolder(options?: FolderDialogOptions): Promise<string | null>
  saveFile(data: Uint8Array, defaultName: string, filters?: FileFilter[]): Promise<string | null>
  readFileAsBlob(path: string): Promise<Blob>
  writeFile(path: string, data: Uint8Array): Promise<void>
  getTempDir(): Promise<string>
  cleanupTemp(jobId: string): Promise<void>

  // Dialogs
  showMessageBox(options: MessageBoxOptions): Promise<number>
  showOpenDialog(options: OpenDialogOptions): Promise<string[]>
  showSaveDialog(options: SaveDialogOptions): Promise<string | null>

  // Desktop integration
  openFile(path: string): Promise<void>
  openFolder(path: string): Promise<void>
  revealInExplorer(path: string): Promise<void>

  // Notifications
  notify(title: string, body: string, options?: NotificationOptions): Promise<void>

  // Updates
  checkForUpdates(): Promise<void>
  downloadUpdate(): Promise<void>
  installAndRestart(): Promise<void>
  onUpdateStatus(callback: (status: UpdateStatus) => void): () => void

  // App info
  getVersion(): Promise<string>
  getPlatform(): Promise<string>
  getAppDataPath(): Promise<string>

  // Progress events (from main process)
  onJobProgress(jobId: string, callback: (progress: JobProgress) => void): void
  onJobComplete(jobId: string, callback: (result: JobResult) => void): void
  onJobError(jobId: string, callback: (error: string) => void): void
  removeJobListeners(jobId: string): void
}
```

### 2.4 Main Process

**Responsibilities:**
- Native filesystem operations (read, write, delete, stat)
- Native file/folder dialogs
- Window lifecycle management (create, close, minimize, maximize)
- IPC handler registration and request routing
- Processing engine execution (runs in main process or dedicated worker)
- Job queue management
- Progress reporting to renderer
- Notification dispatch
- Auto-update management
- Settings and history persistence
- Logging

**Services (main process, implemented):**

| Service | Responsibility | Storage |
|---------|---------------|---------|
| FileService | Native fs operations, temp directory management | File system |
| DialogService | Native open/save/folder dialogs | — |
| JobService | Job queue, lifecycle, worker dispatch | In-memory + persistence |
| HistoryService | Past job records | SQLite or JSON file |
| SettingsService | User preferences | electron-store or JSON |
| NotificationService | Windows toast notifications | — |
| UpdateService | Auto-update checks, download, install | `electron/services/updater.ts` (electron-updater + mock driver for dev/verify) |
| LoggerService | File-based logging | Log files |

### 2.5 Processing Engines **Implemented**

Engines moved from browser context (Canvas, WASM) to Node.js context in the main process.

| Engine | Browser | Node.js (Implemented) | Notes |
|--------|---------|------------------------|-------|
| Image Engine | Canvas API | `@napi-rs/canvas` | `electron/engines/modules/image.ts` — convert/compress/resize/crop; EXIF via `exifreader` |
| PDF Engine | pdf-lib + pdfjs-dist (web worker) | pdf-lib + pdfjs-dist | `modules/pdf.ts` (convert/merge/split/compress/organize); pdfjs-dist renders via a native canvas implementation (`modules/pdf-to-images.ts`) |
| ZIP Engine | JSZip | JSZip | `modules/zip.ts` — create/extract with the same 2,000-entry / 4 GiB / 32-level guardrails |
| TAR Engine | Pure-JS parser | Pure-JS parser (shared/ported) | `modules/tar.ts` — checksum validation, path sanitization |
| FFmpeg Engine | @ffmpeg/ffmpeg (WASM, web worker) | Native `ffmpeg-static` binary | `modules/ffmpeg.ts` — extractAudio/convertAudio/compressVideo (runs in worker pool) |
| Rename Engine | Pure-JS | Pure-JS | `modules/rename.ts` — prefix/suffix/find-replace/sequential |
| Duplicate Engine | crypto.subtle | Node.js `crypto` | `modules/duplicate.ts` — SHA-256 via the built-in `crypto` module |
| File Info Engine | Canvas + exifreader + header parsing | Node.js fs + `@napi-rs/canvas` + exifreader | `modules/file-info.ts` — size, type, dimensions, duration, EXIF, hash |

**EngineKind dispatch (20 kinds), `electron/engines/runner.ts`:**

| Kind | Worker Pool | Main Process |
|------|-------------|--------------|
| `image.convert` `image.compress` `image.resize` `image.crop` | ✓ (batch) | |
| `pdf.imagesToPdf` `pdf.merge` `pdf.split` `pdf.compress` `pdf.organize` | | ✓ |
| `pdf.toImages` | ✓ | |
| `zip.create` `zip.extract` `tar.extract` | | ✓ |
| `rename.batch` `fileInfo` `duplicates` `computeHash` | | ✓ |
| `ffmpeg.extractAudio` `ffmpeg.convertAudio` `ffmpeg.compressVideo` | ✓ | |

Every engine gets an `EngineContext` (`requestId`, `workDir`, `jobTempDir`, `verbose`, progress callback, `AbortSignal`) and executes through `runEngine()`, which ensures the work directory exists, dispatches light engines inline and heavy engines to the worker pool, cleans up the job temp directory, and returns a `savedLocation` (bucket path) + `outputSize` for IPC.

**Engine Worker Strategy (implemented)**
- Heavy engines (FFmpeg, image batch, PDF-to-images) run in a `worker_threads` pool (`electron/engines/pool.ts`) — max `cpuCount - 1`, capped at 4, FIFO queued.
- The worker entry (`electron/engines/worker-src/worker.ts`) is bundled by electron-vite into `out/main/worker.js`; `pool.ts` loads `./worker.js` relative to its own module path (not `../worker.js`).
- Cancellation uses an `AbortSignal` passed through the engine context; workers map it to interruptible ffmpeg/image/pdf spawns (`ipc/engine.ts` exposes `cancelEngine`).
- Lightweight engines (rename, duplicate, file-info, zip/tar, developer tools) run directly in the main process.
- pdfjs-dist v6 requires `CanvasFactory` to be a **constructor** (class with `create`/`reset(cnv, w, h)`/`destroy`); an object literal fails with `CanvasFactory is not a constructor` — implemented as `NapiCanvasFactory` in `pdf-to-images.ts`.

### 2.6 IPC Design

**Channel Convention:**

```
service:action    (request/response pattern)
service:event     (event/streaming pattern)
```

**Examples:**

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `file:selectFiles` | Renderer -> Main | Open native file picker |
| `file:saveAs` | Renderer -> Main | Open native save dialog + write |
| `file:read` | Renderer -> Main | Read file as blob/array |
| `job:create` | Renderer -> Main | Create and enqueue a job |
| `job:cancel` | Renderer -> Main | Cancel a running job |
| `job:progress` | Main -> Renderer | Stream progress updates |
| `job:complete` | Main -> Renderer | Notify job completion |
| `job:error` | Main -> Renderer | Notify job failure |
| `dialog:open` | Renderer -> Main | Open folder picker |
| `dialog:save` | Renderer -> Main | Open save dialog |
| `dialog:confirm` | Renderer -> Main | Show confirmation dialog |
| `notify:show` | Renderer -> Main | Show Windows notification |
| `update:check` | Renderer -> Main | Check for updates |
| `update:download` | Renderer -> Main | Download update |
| `update:install` | Renderer -> Main | Install and relaunch |
| `update:status` | Main -> Renderer | Stream update status (checking/available/downloading/downloaded/error/dev) |

**IPC Argument Validation:**
- All IPC handlers must validate incoming arguments
- Paths must be checked for traversal (`..`, absolute path injection)
- File type filters must be validated against a whitelist
- Numeric ranges must be clamped to safe bounds
- Unknown properties must be stripped

### 2.7 File System Architecture

```
+--------------------------------------------------+
| Windows File System                               |
|                                                    |
|  User Files (NEVER modified by FileForge)          |
|  +-- C:\Users\<user>\Documents\                    |
|  +-- C:\Users\<user>\Downloads\                    |
|  +-- C:\Users\<user>\Desktop\                      |
|  +-- User-selected folders                         |
|                                                    |
|  Application Data (%APPDATA%\FileForge\)           |
|  +-- settings.json                                 |
|  +-- history.db (or history.json)                  |
|  +-- logs/                                         |
|  +-- cache/                                        |
|                                                    |
|  Temporary Processing (%TEMP%\jobs\)     |
|  +-- <request-id>/                       |
|  |   +-- input files (copies or references) |
|  |   +-- output files                     |
|  +-- cleaned after job completion         |

> **Implemented:** temp base is set from `app.getPath('temp')` (observed `C:\Users\<user>\AppData\Local\Temp\jobs\<id>`), so job dirs live directly under `%TEMP%\jobs\`. `runEngine` and `writeZipArchive` create the job work directory with `mkdir({ recursive: true })`. Output for jobs that save files goes to the first approved *input* directory (`savedLocation: 'inputFolder'`); delete files are only staged as dry-run temp artifacts never persisted.
|                                                    |
|  Output Files (written to user-chosen location)    |
|  +-- User-selected output directory                |
|  +-- Default: same directory as input, or Downloads|
+--------------------------------------------------+
```

**Rules:**
- User files are read-only from the application's perspective
- Application data is stored in `%APPDATA%\FileForge\`
- Temporary files are cleaned after job completion or on next app start
- Output files are written to user-chosen directories
- The application never writes to `Documents`, `Desktop`, or other user folders without explicit user action (Save As dialog)
- Overwrite protection: never silently overwrite existing files

### 2.8 Storage Migration

| Current (Browser) | Target (Electron) | Notes |
|-------------------|-------------------|-------|
| IndexedDB (history) | SQLite via `better-sqlite3` or JSON file | More reliable, queryable |
| localStorage (settings) | `electron-store` or JSON file in `%APPDATA%` | Cross-session persistence |
| In-memory job state | In-memory + optional persistence | Survive window close/reopen |
| IndexedDB (logs) | File-based logging | Log rotation, easier export |
| File System Access API | Node.js `fs` module | More reliable, no permission prompts |
| `<input type="file">` fallback | Native `dialog.showOpenDialog()` | Always available, native UX |

---

## 3. Security Architecture

### 3.1 Electron Security Requirements

| Requirement | Implementation |
|-------------|---------------|
| `contextIsolation: true` | Renderer cannot access preload prototypes |
| `nodeIntegration: false` | Renderer has no Node.js access |
| `sandbox: true` | Renderer runs in OS sandbox |
| `webPreferences.webSecurity: true` | Same-origin policy enforced |
| No `nodeIntegrationInWorker` | Workers have no Node.js access by default |
| `spellcheck: true` | Spell checking enabled |

### 3.2 IPC Security

- All IPC channels must be explicitly registered in the main process
- Arguments are validated and sanitized before processing
- No arbitrary function execution through IPC
- No forwarding of raw file handles to renderer
- Paths are validated against a whitelist of allowed directories (temp, app data, user-selected)
- File type filters are validated against a static whitelist

### 3.3 Path Security

```typescript
// Path validation rules (must be enforced in main process)
function validatePath(filePath: string, allowedBase: string): boolean {
  // 1. Resolve to absolute path
  const resolved = path.resolve(filePath)
  // 2. Check for path traversal
  if (resolved.includes('..')) return false
  // 3. Ensure path is within allowed directory
  if (!resolved.startsWith(allowedBase)) return false
  // 4. Reject null bytes
  if (resolved.includes('\0')) return false
  return true
}
```

### 3.4 Archive Extraction Security

Existing guardrails must be preserved:

| Guardrail | Limit | Source |
|-----------|-------|--------|
| ZIP/TAR max entries | 2,000 | `zip-engine.ts:7`, `tar-engine.ts:7` |
| ZIP/TAR max uncompressed | 4 GiB | `zip-engine.ts:8`, `tar-engine.ts:8` |
| ZIP/TAR max nesting depth | 32 | `zip-engine.ts:9`, `tar-engine.ts:9` |
| Path traversal protection | Blocks `..`, backslashes, drive letters, `~`, absolute `/` | `hasUnsafePath()` |
| Media size hard limit | 1 GiB | `media.ts:4` |
| Media size soft warning | 200 MiB | `media.ts:3` |
| PDF-to-images page limit | 200 pages | `pdf-engine.ts:327` |
| Password-protected PDF | Detected, clear error | `pdf-engine.ts:24-25` |

These limits must NOT be silently weakened during Electron conversion. If the desktop architecture allows higher limits, document the change separately.

### 3.5 User File Protection

- Application never modifies or deletes user files without explicit user action
- "Replace" requires explicit user confirmation
- Overwrite protection: automatic filename suffixing or confirmation dialog
- Uninstaller never deletes user-generated output files
- Application data is isolated from user documents

---

## 4. Offline Architecture

### 4.1 Core Processing (Offline)

All 26 tools work entirely offline:
- Image processing: Canvas API / sharp (no network)
- PDF processing: pdf-lib / pdfjs-dist (no network)
- Archive processing: JSZip / pure-JS TAR (no network)
- Video/audio processing: FFmpeg WASM (bundled) or native binary (no network)
- Developer tools: Pure JS (no network)
- File operations: Local filesystem (no network)

### 4.2 Optional Online Features

Only these require internet:
- Application auto-update (check, download, install)
- Future: optional analytics (if explicitly opted-in)

### 4.3 PWA Offline Support (Current)

- Service worker caches all static assets (Workbox)
- FFmpeg WASM core cached with CacheFirst strategy
- All engines loaded lazily and cached after first use
- Full offline functionality after initial load

### 4.4 Electron Offline Support (Target)

- All application code bundled in the installer (no CDN dependencies)
- FFmpeg binary bundled or shipped alongside the application
- No service worker needed (Electron handles offline natively)
- Auto-update is the only online dependency

---

## 5. Testing Architecture

### 5.1 Current (Web/PWA)

- **Framework:** Vitest 3
- **Unit tests:** Engine pure functions, option validation, filename utilities, security predicates
- **Integration tests:** Tool registry, job service, history service, analytics
- **Test files:** Co-located with source (`*.test.ts` alongside `*.ts`)
- **Current count:** 436 passing tests (includes the Electron engine suites below)

### 5.2 Desktop (Electron) — Implemented + Target

| Test Type | Tool | Scope | Status |
|-----------|------|-------|--------|
| Engine unit tests | Vitest | `electron/engines/**/*.test.ts` — image, pdf, zip, tar, rename, duplicate, file-info, ffmpeg (+ util, stress/large-file/cancellation) with real temp fixtures | ✅ 87 tests |
| Type checking | `tsc -b` + `tsc -p electron/tsconfig.json` | Full project + Electron process types | ✅ |
| Linting | ESLint | `.` | ✅ |
| Build | electron-vite | main/preload/renderer + worker entry | ✅ |
| End-to-end engine verification | `scripts/verify-phase10.mjs` via CDP | Boots a real Electron instance, drives `window.fileforge` over DevTools protocol — 18 file kinds + 3 data kinds + cancel | ✅ 25/25 checks |
| Windows-integration verification | `scripts/verify-phase12.mjs` via CDP | Overwrite protection (autorename/confirm/invalid fallback), Windows toast (`notify`), shell Open File/Open Folder, missing-file error | ✅ 11/11 checks |
| Auto-update verification | `scripts/verify-phase13.mjs` via CDP | Bridge surface, mock update happy path (checking→available→downloading→downloaded + release notes + progress), raw-invoke arg rejection, dev short-circuit, mock check-error | ✅ 8/8 checks |
| Electron E2E + accessibility | `scripts/verify-phase14.mjs` via CDP | Full select→process→save workflow through the real UI queue (resume, auto-save, cancel, failure alert), settings persistence, axe-core scans of 5 routes (no critical/serious; color-contrast recorded) | ✅ 26/26 checks |
| Security tests | Vitest + CDP | Path validation, IPC argument validation (unit) + malformed-call rejection exercised over real IPC (Phase 14 script) | ✅ |
| Accessibility | axe-core (injected via CDP) | `#/`, `#/tools`, `#/tool/image-convert`, `#/jobs`, `#/settings` — no critical/serious violations | ✅ |
| Performance benchmark | `scripts/benchmark-electron.mjs` via CDP | Image 1/4/8 MP convert/compress/resize, zip 1/6 MB, hash, pdf.merge — end-to-end timings → `Benchmarks.md` | ✅ |

> `verify:electron` script: spawns `out/main/main.js` with `--remote-debugging-port=0`, parses the DevTools WS url from stderr, waits for the bridge (`typeof window.fileforge === 'object'`), then runs each case via `Runtime.evaluate` with `awaitPromise`. Fixtures are generated with `@napi-rs/canvas`, pdf-lib, JSZip, an inline tar builder, and `ffmpeg-static`. Outputs are asserted against `statFile` sizes, temp jobs are cleaned, and the ffmpeg case exercises `cancelEngine` (best-effort abort).
>
> `verify:electron:phase12` (Phase 12) reuses the same harness to check: bridge surface, overwrite protection (`saveOutput`/`saveOutputFile` collision auto-rename, invalid-mode → autorename fallback, confirm-mode no-collision), a real Windows toast via `notify`, `openFile`/`showItemInFolder` round-trip on an engine output, and `openFile`'s missing-file rejection.
>
> `verify:electron:phase13` (Phase 13) drives the mock updater (`FILEFORGE_UPDATER_MOCK=1`) end-to-end: bridge keys, mock happy path through all four statuses with release notes and progress, raw-`invoke` argument rejection, unpackaged `dev` short-circuit, and mock check-error status.
>
> `verify:electron:phase14` (Phase 14) adds the full UI workflow: it seeds an IndexedDB pending job and proves the real queue resumes it (Active + Cancel), the tool workspace auto-saves the finished output next to the input folder, desktop actions are offered, the Jobs list reflects completion, a pathless dropped file fails with a readable alert, and the UI Cancel button stops a running engine. It also injects `axe-core` into the live renderer and scans the five main routes, plus verifies a settings toggle round-trip through Save Settings.

### 5.3 Test Commands (Current + Desktop)

```bash
npm test              # Run Vitest once
npm test:watch        # Run Vitest in watch mode
npm run typecheck     # tsc -b && tsc -p electron/tsconfig.json
npm run lint          # ESLint
npm run build:electron # Full electron build (setup:ffmpeg + typecheck + electron-vite build)
npm run verify:electron            # CDP engine verification (25/25)
npm run verify:electron:phase12    # CDP Windows-integration verification (11/11)
npm run verify:electron:phase13    # CDP auto-update verification (8/8)
npm run verify:electron:phase14    # CDP E2E + accessibility verification (26/26)
npm run benchmark:electron         # CDP performance benchmark → benchmark-results.md / Benchmarks.md
```

---

## 6. Build and Distribution Architecture

### 6.1 Current (Web/PWA)

```bash
npm run dev           # Vite dev server
npm run build         # tsc + vite build -> dist/
npm run preview       # Preview dist/
```

Build output: Static PWA in `dist/` with manifest, service worker, icons.

### 6.2 Desktop (Electron) — Implemented + Target

```
Development:
  npm run dev:electron       # electron-vite dev (hot reload)

Production Build:
  npm run build:electron     # setup:ffmpeg + tsc -b + tsc -p electron/tsconfig.json + electron-vite build
       |
       v
  out/main/main.js, out/preload/*, out/renderer/*, out/main/worker.js
       |
       v
  Electron packaging (electron-builder)
       |
       v
  Windows installer (.exe) via NSIS (not yet produced)
```

**Build tools (status):**

| Tool | Purpose | Status |
|------|---------|--------|
| `electron-vite` | Build main/preload/renderer + worker entry | ✅ Implemented (`electron.vite.config.ts`) |
| `electron-builder` | Package Electron app | ✅ Configured (`package.json.build`: NSIS, ffmpeg `extraResources`, `@napi-rs/canvas` asarUnpack) — installers produced in `release/` |
| `ffmpeg-static` | Native FFmpeg binary | ✅ Bundled via `extraResources` → `resources/ffmpeg/ffmpeg.exe` |
| NSIS | Windows installer | ✅ Shipped — `FileForge-Setup-x.y.z.exe` (Start Menu + optional Desktop shortcut, install-dir selection, uninstaller) |
| `electron-updater` | Auto-update | ✅ Implemented (`electron/services/updater.ts` + `electron/ipc/updater.ts`; GitHub provider `SALMANHABIB443/FileForge`, user-triggered downloads/installs); `latest.yml` + `app-update.yml` generated |
| Code signing certificate | Windows installer trust | To Be Done — unsigned builds are intentionally produced; SmartScreen warning expected until a cert is configured (see `RELEASE.md`) |

### 6.3 Versioning

- Current: `package.json` version `1.0.0`
- Electron: Semantic versioning (major.minor.patch)
- `__APP_VERSION__` injected at build time (already implemented for web)
- Version displayed in Settings > About
- Version bump workflow documented in `RELEASE.md`

### 6.4 Application Icon

- Current: SVG favicon + PWA icons (192/512/maskable)
- Target: `.ico` file for Windows (multiple sizes: 16, 32, 48, 256)
- Used in: installer, Start Menu, Desktop shortcut, title bar, taskbar
- `build/icon.ico` generated by `scripts/generate-icons.mjs` (7 sizes: 16–256)

---

## 7. Error Handling Architecture

### 7.1 Error Boundaries (Current)

- React `ErrorBoundary` component catches renderer errors
- Logger persists error metadata to IndexedDB (ring buffer)
- Crash snapshots stored (metadata only, never file content)

### 7.2 Error Handling (Target)

```
Engine throws Error
    |
    v
JobRunner catches -> maps to user message
    |
    v
IPC sends error to renderer (human-readable + technical details)
    |
    v
UI displays error card:
  - Human-readable message (from PRD error matrix)
  - Optional "Details" expander (technical info)
  - Retry button (if safe)
  - Cancel / Dismiss
    |
    v
Logger records error metadata (no file content)
```

### 7.3 Error Categories

| Category | User Message Pattern | Recovery |
|----------|---------------------|----------|
| Unsupported format | "This file format isn't supported yet." | Suggest alternatives |
| Corrupted file | "We couldn't read this file." | Fail fast, clean temp |
| Storage full | "Not enough storage space." | Estimate before start |
| Permission denied | "File access permission is required." | Prompt for permission |
| Engine error | "The file couldn't be converted. Try again." | Log details, offer retry |
| Cancelled | "Conversion cancelled." | Clean temp, return |
| Timeout | "Processing took too long." | Offer cancel/retry |
| Path traversal | Silently rejected | No user message needed |

---

## 8. Logging Architecture

### 8.1 Current

- `src/services/logger.ts` — in-memory ring buffer (500 entries max)
- Persisted to IndexedDB on `pagehide`
- Settings > Diagnostic Logs: view count, export JSON, clear
- Never transmits data externally

### 8.2 Target (Electron)

- File-based logging in `%APPDATA%\FileForge\logs\`
- Log rotation (daily, max 7 days)
- Log levels: error, warn, info, debug
- Same privacy rules: no file content, no user identification
- Export from Settings for debugging

---

This document defines the current implementation and the Electron target architecture. The web/PWA architecture remains the source of truth for behavior. The Electron foundation, native file system layer, and processing engine layer (Phases 8–10) are implemented and verified; remaining items (notifications, queue persistence, updater, installer) are design targets tracked in Phases.md.
