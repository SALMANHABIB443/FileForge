# FileForge

**Privacy-first file toolbox** — convert, compress, merge, split, and process images, PDFs, videos, audio, and archives entirely on your device. Nothing is ever uploaded to a server.

> **Current:** Privacy-first Progressive Web App (PWA) running in modern browsers.
> **Desktop:** Windows Electron build shipped — native file dialogs, a native processing engine layer, installer + auto-update pipeline (Phases 8–15 complete, `v1.0.0`). The web/PWA remains fully supported alongside it.

---

## Privacy by Design

- **Zero uploads** — there is no backend; files never leave your device
- **Offline-first** — fully functional without an internet connection
- **Local-only storage** — history, settings, and usage analytics stay on your device (IndexedDB / localStorage), never transmitted
- **No API keys** — no accounts, no subscriptions, no remote services required
- **Optional analytics** — opt-in local usage tracking stored entirely on-device

---

## Current Capabilities

### Images

| Tool | Description | Input Formats | Output Formats | Batch |
|------|-------------|---------------|----------------|-------|
| **Image Convert** | Convert between formats | Any `image/*` | JPG, PNG, WebP | Yes |
| **Image Compress** | Reduce file size with quality control | JPG, PNG, WebP | Same as input | Yes |
| **Image Resize** | Scale by dimensions or aspect ratio | JPG, PNG, WebP | Same as input | Yes |
| **Image Crop & Rotate** | Interactive crop with optional rotation | JPG, PNG, WebP | JPG, PNG, WebP | No |
| **Images to PDF** | Combine images into a single PDF | JPG, PNG | PDF | Yes |

### PDF

| Tool | Description | Notes |
|------|-------------|-------|
| **PDF Merge** | Combine multiple PDFs into one | Min 2 files; password-protected detected |
| **PDF Split** | Extract page ranges or every page | Range syntax: `1-3, 5, 8-10` |
| **PDF Compress** | Reduce PDF file size | Rebuilds document; keeps smaller of original/rebuilt |
| **PDF Organize** | Rotate and reorder pages | Interactive page thumbnail panel |
| **PDF to Images** | Render pages as JPG or PNG | Max 200 pages; scale 1x/2x/3x |

### Archives

| Tool | Description | Safety Limits |
|------|-------------|---------------|
| **ZIP Create** | Package files into a ZIP archive | Compression levels 1/6/9 |
| **ZIP Extract** | Unpack ZIP with content preview | Max 2,000 entries, 4 GiB uncompressed, 32-level nesting, path sanitization |
| **TAR Extract** | Unpack plain `.tar` archives | Same limits as ZIP; checksum validation; `.tar.gz` not supported |

### Video & Audio

| Tool | Description | Formats | Limits |
|------|-------------|---------|--------|
| **Video to Audio** | Extract audio from video | Output: MP3, WAV | 200 MiB warn, 1 GiB hard limit |
| **Video Compress** | Reduce video size and resolution | Output: MP4 (H.264 + AAC) | Same limits |
| **Audio Convert** | Convert between audio formats | MP3, WAV, M4A | Same limits |

### Files & Utilities

| Tool | Description | Notes |
|------|-------------|-------|
| **Batch Rename** | Rename files with prefix/suffix/find-replace/sequential patterns | Live preview; multi-file returns ZIP |
| **Find Duplicates** | Detect duplicate files by content | SHA-256 hash via `crypto.subtle` |
| **File Information** | View size, type, dimensions, duration, EXIF, hash | Instant; no conversion |

### Developer Tools

| Tool | Description | Notes |
|------|-------------|-------|
| **JSON Formatter** | Format or minify JSON text | Mode: format/minify; indent control |
| **Base64 Converter** | Encode or decode Base64 text | UTF-8 safe |
| **Hash Generator** | Generate SHA-256 or SHA-512 hashes | Via `crypto.subtle` |
| **UUID Generator** | Generate random UUID v4 values | 1–100 at a time |
| **URL Converter** | Percent-encode or decode URL strings | `encodeURIComponent`/`decodeURIComponent` |
| **JWT Decoder** | View header and payload of a JWT token | Display only; no signature verification |
| **Timestamp Converter** | Convert between Unix timestamps and readable dates | Seconds or milliseconds |

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | React 19, React Router 7, Zustand 5 |
| Language | TypeScript 5.8 (strict mode) |
| Build | Vite 6, Tailwind CSS 4 |
| Processing (web) | pdf-lib, pdfjs-dist, JSZip, FFmpeg.wasm, exifreader |
| Processing (Electron) | pdf-lib, pdfjs-dist + `@napi-rs/canvas`, JSZip, native FFmpeg (`ffmpeg-static`), `@napi-rs/canvas` image engine, worker_threads pool |
| PWA | vite-plugin-pwa (Workbox) |
| Testing | Vitest 3 |
| Linting | ESLint 10 |

**Electron additions (Phases 8–15 implemented):**
| Layer | Technology |
| --- | --- |
| Desktop | Electron (electron-vite) |
| Main process | `electron/main.ts` → typed IPC (`electron/channels.ts`, `electron/ipc/`) → Node.js services |
| Preload bridge | Sandboxed `window.fileforge` API (`electron/preload.ts`) |
| Native file system | Approval-scoped reads/writes, per-job temp dirs, path validation |
| Processing engines | `electron/engines/` — light engines in main, heavy engines in a `worker_threads` pool |
| Packaging / installer | electron-builder — NSIS `FileForge-Setup-x.y.z.exe` (see `RELEASE.md`) |
| Updates | electron-updater — user-confirmed downloads/installs via Settings |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+ (npm is bundled)
- A modern browser with [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) support (Chrome/Edge recommended for best experience)

### Install

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build for production

```bash
npm run build
```

The build script first copies the FFmpeg core assets into `public/ffmpeg/`, then runs TypeScript and Vite. The output is a fully static PWA in `dist/`.

### Preview the production build

```bash
npm run preview
```

### Tests, typecheck, and lint

```bash
npm test          # run Vitest
npm run test:watch    # run Vitest in watch mode
npm run typecheck # TypeScript type checking
npm run lint      # ESLint
```

---

## Architecture

FileForge follows a strict layered architecture:

```
UI -> Service -> Engine -> File System
```

- **UI** — React components and pages (`src/pages`, `src/components`)
- **Service** — tool registration, job lifecycle, file picking, persistence (`src/services`)
- **Engine** — isolated processing modules for each format, wrapped for lazy loading (`src/engines`); on Electron the desktop bridge (`src/engines/native.ts`) routes tools to the native engine layer instead
- **File System** — File System Access API with `<input>` fallback (web/PWA); approval-scoped Electron IPC + Node.js fs (desktop)

Heavy libraries (FFmpeg, pdf-lib, JSZip) are loaded lazily only when a tool runs, keeping the initial bundle small. On Electron, heavy engines run in `worker_threads` (FFmpeg, image batch, PDF→images) so the UI never blocks.

### Job System

Long-running operations use the job service (`src/services/job-runner.ts`):

- In-memory job store with pub/sub progress updates
- `AbortController`-based cancellation
- Interruption detection across page reloads via `sessionStorage`
- Storage-quota warnings before large conversions begin

### Security Guardrails

- **ZIP/TAR extraction**: max 2,000 entries, 4 GiB uncompressed limit, 32-level nesting depth, path-traversal protection (`src/engines/zip-engine.ts`, `src/engines/tar-engine.ts`)
- **Media processing**: 200 MiB soft warning, 1 GiB hard limit (`src/utils/media.ts`)
- **PDF**: encrypted/password-protected file detection; 200-page cap for PDF to images

These guardrails are documented in detail in `Architecture.md` and must be preserved during Electron conversion.

---

## Project Structure

```
├── electron/
│   ├── main.ts            # Electron main process entry
│   ├── preload.ts         # Sandboxed contextBridge -> window.fileforge
│   ├── channels.ts        # Typed IPC channel names
│   ├── ipc/               # file + engine IPC handlers
│   ├── services/          # approval registry, temp dirs
│   ├── security/          # path validation
│   ├── engines/           # Node.js engines + worker_threads pool
│   │   ├── runner.ts      # EngineKind dispatch (light vs heavy)
│   │   ├── pool.ts        # worker pool
│   │   ├── worker-src/worker.ts
│   │   ├── modules/       # image, pdf, pdf-to-images, zip, tar, rename, duplicate, file-info, ffmpeg
│   │   └── util/          # common, exif, zip helpers
│   └── electron.ts        # (types/preload/shared types)
├── index.html              # Entry HTML + SEO/PWA meta
├── package.json
├── vite.config.ts          # Vite, PWA manifest, Tailwind, @ alias
├── electron.vite.config.ts # Main/preload/renderer build config (worker entry)
├── tsconfig.json
├── eslint.config.js
├── scripts/
│   ├── copy-ffmpeg.mjs     # Copies @ffmpeg/core -> public/ffmpeg/
│   ├── generate-icons.mjs  # Generates PWA icons + build/icon.ico
│   ├── verify-phase14.mjs  # CDP end-to-end phase 14 verification
│   └── verify-phase15.mjs  # Packaging/release artifact verification (33 checks)
├── public/
│   ├── ffmpeg/             # FFmpeg.wasm core assets
│   ├── icons/              # PWA icons
│   └── fonts/              # Geist webfonts
└── src/
    ├── main.tsx            # React entry
    ├── App.tsx             # Layout, routing, global indicators
    ├── store.ts            # Zustand global state
    ├── version.ts          # APP_VERSION (from package.json)
    ├── components/         # UI components + panels
    ├── pages/              # home, tools, history, settings, workspaces
    ├── services/           # tool-registry, job-service, file-service, history, settings
    ├── engines/            # web engines + native desktop bridge (native.ts)
    ├── tools/              # 26 tool definitions (registry)
    ├── types/              # Shared TypeScript types
    ├── utils/              # filename, exif, media, zip helpers
    ├── data/               # copy, privacy policy, licenses
    └── index.css           # Design tokens (Tailwind @theme)
```

---

## Electron Desktop Target

FileForge ships a Windows Electron desktop build (V1). The desktop architecture is:

```
React Renderer -> Typed IPC -> Preload Bridge -> Main Process -> Node.js Services -> Windows File System
```

Key desktop features shipped in V1 (Windows):
- Windows `.exe` installer with Start Menu entry and optional Desktop shortcut
- Native file and folder selection dialogs
- Save As dialog with output directory preference
- Drag and drop support
- Processing queue with progress, cancellation, and retry
- Windows notifications
- Copy/paste integration for developer tools
- Auto-update system (GitHub Releases, user-confirmed)
- Proper uninstaller
- Full offline operation

The architecture is defined in `Architecture.md`. The migration roadmap is in `Phases.md`.

**Electron migration status:** Phases 8–15 are complete — Electron foundation, native file system layer, native processing engine layer (all 26 tools route through `worker_threads`/main-process engines on desktop, verified end-to-end via CDP), plus the production Windows release pipeline (`v1.0.0`). Remaining items are documented in `RELEASE.md`/`QA.md`.

### Desktop development

```bash
npm run build:electron    # electron-vite -> out/
npm run dev:electron      # hot-reload dev run (renderer is the web/PWA build)
npm test                  # Vitest (includes electron/engine suites)
npm run verify:electron  # CDP end-to-end engine verification (25/25)
npm run package:electron  # NSIS installer + update artifacts -> release/
npm run verify:electron:phase15  # packaging artifact verification (33/33)
```

The desktop app runs from `out/` under Electron in development; installed releases use the NSIS installer produced by `npm run package:electron` (see `RELEASE.md` for the full release workflow).

---

## Configuration

No environment variables are required — there is no backend and no API keys.

- `__APP_VERSION__` is injected at build time from `package.json.version` and shown in Settings
- Browser capability detection handles feature gating (File System Access API, OPFS, storage estimates)

---

## Documentation

| Document | Description |
|----------|-------------|
| `README.md` | This file — project overview, features, getting started |
| `PRD.md` | Product requirements document — vision, goals, features, constraints |
| `Architecture.md` | System architecture — current web/PWA and target Electron design |
| `DESIGN.md` | UI system and design tokens — colors, typography, components |
| `Features.md` | Detailed feature specifications — behavior, options, edge cases |
| `Sitemap.md` | Information architecture and navigation structure |
| `Phases.md` | Development roadmap — past phases and Electron migration plan |
| `RELEASE.md` | Production release guide — version bumping, installer build, signing, GitHub Releases publishing |
| `Instruction.md` | Implementation guide for coding agents — rules and conventions |

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run `npm run typecheck` and `npm run lint` before committing
4. Add tests alongside new engines/services
5. Submit a pull request

---

## License

This project is private. All rights reserved.

---

## Acknowledgments

FileForge is built on the shoulders of open-source projects including [React](https://react.dev/), [pdf-lib](https://pdf-lib.js.org/), [pdf.js](https://mozilla.github.io/pdf.js/), [JSZip](https://stuk.github.io/jszip/), [FFmpeg.wasm](https://ffmpegwasm.netlify.app/), [Zustand](https://zustand.docs.pmnd.rs/), [Tailwind CSS](https://tailwindcss.com/), and [Vite](https://vitejs.dev/). Full attributions are shown in the app under **Settings > Licenses** (`src/data/licenses.ts`).
