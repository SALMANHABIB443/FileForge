# FileForge

**Privacy-first file toolbox for the browser** — convert, compress, merge, split, and process images, PDFs, videos, audio, and archives entirely on your device. Nothing is ever uploaded to a server.

> All processing happens locally in your browser via the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API), WebAssembly, and Web Workers. FileForge works offline as an installable PWA and respects your privacy by design.

## Features

### 🖼️ Images
- **Image Convert** — JPG, PNG, WebP, AVIF, GIF and more
- **Image Compress** — reduce file size with quality control
- **Image Resize** — scale by dimensions or percentage
- **Image Crop** — interactive crop with preview
- **Images to PDF** — combine multiple images into a single PDF

### 📄 PDF
- **PDF Merge** — combine multiple PDFs with reorder panel
- **PDF Split** — extract individual pages or ranges
- **PDF Compress** — reduce file size
- **PDF Organize** — rotate, reorder, or remove pages
- **PDF to Images** — render each page as an image (max 200 pages)

### 🗜️ Archives
- **ZIP Create** — build ZIP archives with preview
- **ZIP Extract** — unpack ZIP files with safety limits
- **TAR Extract** — unpack TAR archives with safety limits

### 🎬 Video & Audio
- **Video to Audio** — extract audio from video files (MP3, etc.)
- **Video Compress** — reduce video file size
- **Audio Convert** — convert between audio formats

### 📁 Files & Utilities
- **Batch Rename** — rename multiple files with patterns
- **Duplicate Detect** — find duplicate files
- **File Info** — inspect file metadata and EXIF

### 🛠️ Developer Tools
- **JSON Formatter** — pretty-print and validate JSON
- **Base64 Converter** — encode/decode Base64
- **Hash Generator** — SHA-256 / SHA-512
- **UUID Generator** — v4 UUIDs
- **URL Converter** — encode/decode URLs
- **JWT Decoder** — inspect JSON Web Tokens
- **Timestamp Converter** — Unix ↔ human-readable dates

## Privacy by Design

- **Zero uploads** — there is no backend; files never leave your device
- **Offline-first** — fully functional as a progressive web app
- **Local-only storage** — history, settings, and usage analytics stay in your browser (IndexedDB), never transmitted
- **Optional analytics** — opt-in local usage tracking stored entirely on-device

## Tech Stack

| Layer | Technology |
| --- | --- |
| UI | React 19, React Router 7, Zustand 5 |
| Language | TypeScript 5.8 (strict mode) |
| Build | Vite 6, Tailwind CSS 4 |
| Processing | pdf-lib, pdfjs-dist, JSZip, FFmpeg.wasm (`@ffmpeg/ffmpeg` + `@ffmpeg/core`), exifreader |
| PWA | vite-plugin-pwa (Workbox) |
| Testing | Vitest 3 |
| Linting | ESLint 10 |

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
npm test:watch    # run Vitest in watch mode
npm run typecheck # TypeScript type checking
npm run lint      # ESLint
```

## Architecture

FileForge follows a strict layered architecture:

```
UI → Service → Engine → File System
```

- **UI** — React components and pages (`src/pages`, `src/components`)
- **Service** — tool registration, job lifecycle, file picking, persistence (`src/services`)
- **Engine** — isolated processing modules for each format, wrapped for lazy loading (`src/engines`)
- **File System** — File System Access API with `<input>` fallback

Heavy libraries (FFmpeg, pdf-lib, JSZip) are loaded lazily only when a tool runs, keeping the initial bundle small.

### Job System

Long-running operations use the job service (`src/services/job-runner.ts`):

- In-memory job store with pub/sub progress updates
- `AbortController`-based cancellation
- Interruption detection across page reloads via `sessionStorage`
- Storage-quota warnings before large conversions begin

### Security Guardrails

- **ZIP/TAR extraction**: max 2000 entries, 4 GiB uncompressed limit, 32-level nesting depth, path-traversal protection (`src/engines/zip-engine.ts`, `src/engines/tar-engine.ts`)
- **Media processing**: 200 MiB soft warning, 1 GiB hard limit (`src/utils/media.ts`)
- **PDF**: encrypted/password-protected file detection; 200-page cap for PDF→images

## Project Structure

```
├── index.html              # Entry HTML + SEO/PWA meta
├── package.json
├── vite.config.ts          # Vite, PWA manifest, Tailwind, @ alias
├── tsconfig.json
├── eslint.config.js
├── scripts/
│   ├── copy-ffmpeg.mjs     # Copies @ffmpeg/core → public/ffmpeg/
│   └── generate-icons.mjs  # Generates PWA icons
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
    ├── engines/            # image, pdf, zip, tar, ffmpeg, rename, etc.
    ├── tools/              # 25+ tool definitions (registry)
    ├── types/              # Shared TypeScript types
    ├── utils/              # filename, exif, media, zip helpers
    ├── data/               # copy, privacy policy, licenses
    └── index.css           # Design tokens (Tailwind @theme)
```

## Configuration

No environment variables are required — there is no backend and no API keys.

- `__APP_VERSION__` is injected at build time from `package.json.version` and shown in Settings
- Browser capability detection handles feature gating (File System Access API, OPFS, storage estimates)

## Documentation

Additional design and product documentation lives in the repository:

- `PRD.md` — product requirements
- `DESIGN.md` — UI system and design tokens
- `Features.md` — capability list
- `Phases.md` — roadmap
- `Sitemap.md` — information architecture
- `Instruction.md` — development conventions and working rules

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run `npm run typecheck` and `npm run lint` before committing
4. Add tests alongside new engines/services
5. Submit a pull request

## License

This project is private. All rights reserved.

## Acknowledgments

FileForge is built on the shoulders of open-source projects including [React](https://react.dev/), [pdf-lib](https://pdf-lib.js.org/), [pdf.js](https://mozilla.github.io/pdf.js/), [JSZip](https://stuk.github.io/jszip/), [FFmpeg.wasm](https://ffmpegwasm.netlify.app/), [Zustand](https://zustand.docs.pmnd.rs/), [Tailwind CSS](https://tailwindcss.com/), and [Vite](https://vitejs.dev/). Full attributions are shown in the app under **Settings → Licenses** (`src/data/licenses.ts`).