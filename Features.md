# Features.md — Detailed Feature Specification

**Product:** FileForge  
**Last Updated:** 2026-09-14  

This document specifies behavior for every major feature. All UI must follow Design.md. All long-running work uses the Job system defined in PRD.md and Instruction.md.

---

## Feature Matrix

| Feature | Category | Priority | Complexity | Offline | Key Dependencies | User Value |
|---------|----------|----------|------------|---------|------------------|------------|
| Universal File Picker + Type Detection | Core | MVP | Low | Yes | Platform File API | Critical |
| Job System (queue, progress, cancel) | Core | MVP | Medium | Yes | — | Critical |
| History | Core | MVP | Low–Med | Yes | Local storage | High |
| Image Convert (JPG/PNG/WebP) | Image | MVP | Low | Yes | Canvas / image lib | High |
| Image Compress | Image | MVP | Low | Yes | Canvas / image lib | High |
| Image Resize | Image | MVP | Low | Yes | Canvas | High |
| Images → PDF | PDF / Image | MVP | Medium | Yes | pdf-lib | High |
| PDF Merge | PDF | MVP | Medium | Yes | pdf-lib | High |
| PDF Split | PDF | MVP | Medium | Yes | pdf-lib | High |
| PDF Compress (basic) | PDF | MVP | Medium | Yes | pdf-lib / pdfjs | Medium |
| Create ZIP | Archive | MVP | Low | Yes | JSZip | High |
| Extract ZIP | Archive | MVP | Medium | Yes | JSZip | High |
| Extract TAR | Archive | V1 | Medium | Yes | Pure JS | Medium |
| Batch Rename | File Tools | V1 | Low | Yes | — | Medium |
| Find Duplicates | File Tools | V1 | Low | Yes | crypto.subtle | Medium |
| File Information | General | MVP | Low | Yes | Platform + parsers | Medium |
| Video → MP3 / WAV | Video / Audio | V1 | High | Yes* | FFmpeg.wasm | High |
| Audio Convert (MP3/WAV/M4A) | Audio | V1 | High | Yes* | FFmpeg.wasm | Medium |
| Video Compress / Resize | Video | V1 | High | Yes* | FFmpeg.wasm | Medium |
| PDF → Images | PDF | V1 | Medium | Yes | pdfjs | Medium |
| Image Crop / Rotate | Image | V1 | Medium | Yes | Canvas | Medium |
| PDF Rotate / Reorder | PDF | V1.1 | Medium | Yes | pdf-lib | Medium |
| Video → GIF | Video | V2 | High | Yes* | FFmpeg.wasm | Medium |
| Developer Utilities (JSON, Base64, Hash…) | Developer | V2 | Low | Yes | Pure JS | Medium |
| Advanced Archives (TAR/7Z/RAR) | Archive | Future | High | Partial | Platform / extra libs | Low–Med |

\* Subject to browser memory and FFmpeg.wasm limitations; native wrappers improve this.

---

## Core Infrastructure Features

### Feature: Universal File Picker & Type Detection

**Category:** Core  
**Priority:** MVP  
**Purpose:** Entry point for almost every workflow. Detect type and surface only relevant operations.

**User Flow:**
1. User taps “Select files” or drops files / uses share sheet.
2. App requests necessary permission if needed.
3. Files are accepted; each is inspected (extension + MIME + light content sniff).
4. Preview card(s) appear with name, size, type icon/thumbnail, and list of compatible tools.
5. User chooses a tool or opens full Tools list.

**Inputs:** One or more files (platform limits apply).  
**Outputs:** FileMeta objects (id, name, size, mime, extension, lastModified, temporary handle/URL).  

**Validation:**
- Reject zero-byte files with clear message.
- Warn on extremely large files before processing.
- Unsupported types show “No direct tools” + link to full catalog.

**States:** Idle → Selecting → Ready (with FileMeta) → Error (permission / unsupported).  

**Edge Cases:** Multiple files of mixed types → group by type or process sequentially. HEIC on unsupported platforms → graceful fallback message.

**Technical Difficulty:** Low–Medium (platform differences).  
**Dependencies:** Platform File API / File System Access API / share sheet.

---

### Feature: Job System

**Category:** Core  
**Priority:** MVP  

**Purpose:** Unified lifecycle for every conversion or long operation.

**States:** `pending` | `processing` | `completed` | `failed` | `cancelled`

**Data per Job:**
- id (UUID)
- toolId
- inputFileMeta[]
- options
- status
- progress (0–100 or null for indeterminate)
- stage message (optional)
- error (message + code)
- createdAt / startedAt / finishedAt
- outputFileMeta (on success)
- tempPaths (internal)

**Behavior:**
- Create → enqueue.
- Runner executes with progress callback and AbortSignal.
- On finish: validate output, update history, clean temp, notify UI.
- Cancel: abort signal, clean temp, set cancelled.
- Retry: create new job from previous options (only if safe).

**Concurrency (MVP):** One heavy media job; up to 3 light jobs (image/PDF/ZIP).  
**Storage:** In-memory + optional IndexedDB snapshot for recovery after crash.

**Error States:** Engine error, validation failure, abort, storage full.  
**Success State:** Output ready + Save/Share actions.

---

### Feature: History

**Category:** Core  
**Priority:** MVP  

**Purpose:** Let users revisit recent results without re-selecting files.

**User Flow:** History tab → list of past jobs (newest first) → tap for details → Save / Share / Delete / Re-run.

**Storage:** Local only (IndexedDB or equivalent). Configurable retention (default last 50 or 30 days).  
**Data stored:** Job metadata + local output path/URL (not file content).  

**Actions:** Open result, Share, Delete entry, Clear all, Re-run (re-creates job with same options if input still available).  

**Empty State:** “No recent activity. Convert a file to see it here.”  
**Error State:** Storage read failure → graceful empty + retry.

---

## Image Features

### Feature: Image Format Conversion (JPG ↔ PNG ↔ WebP)

**Category:** Image  
**Priority:** MVP  

**Purpose:** Convert between common web/image formats without quality loss beyond the target format’s limits.

**User Flow:**
1. Select image(s).
2. Choose target format.
3. Optional quality slider (for lossy targets).
4. Convert → progress → result card → Save/Share.

**Inputs:** JPG, JPEG, PNG, WebP (and HEIC where platform supports read).  
**Outputs:** Same set.  

**Configuration:**
- Target format (required)
- Quality (1–100, default 85 for JPG/WebP; ignored for PNG)
- Preserve metadata (default false for privacy)

**Default:** Quality 85, strip metadata.  

**Validation:** Supported MIME/extension; max dimension warning (e.g. > 8000 px).  
**Progress:** Indeterminate or per-image for batch.  
**Cancellation:** Supported.  
**Storage:** Output named `{base}_{format}.{ext}`.  
**Batch:** Multiple images → one file per image zipped as `{first}_converted.zip`; a single image returns the converted image directly.  
**Edge Cases:** Animated WebP → first frame or reject with message; transparent PNG → JPG fills with white or configurable background.

**Technical Difficulty:** Low.  
**Dependencies:** Canvas or dedicated image library.

---

### Feature: Image Compression

**Category:** Image  
**Priority:** MVP  

**Purpose:** Reduce file size while keeping acceptable visual quality.

**User Flow:** Select image → Compress → quality / target size preset → process → before/after size comparison → Save.

**Options:**
- Quality (default 80)
- Max dimension (optional)
- Target format (keep original or force WebP/JPG)
- Strip metadata (default on — canvas re-encode drops EXIF; when off, EXIF is best-effort re-injected for JPEG)

**Success State:** Show original size vs new size + percentage saved.  
**Batch:** Multiple images → `{first}_compressed.zip`; single image returned directly; before/after comparison per file.  
**Edge Cases:** Already tiny files → “Already optimized” message.

---

### Feature: Image Resize

**Category:** Image  
**Priority:** MVP  

**Purpose:** Change dimensions for social media, email, or storage.

**Options:**
- Width / Height (px)
- Maintain aspect ratio (default true)
- Fit mode: contain / cover / stretch (default contain)
- Output format (keep original or force JPG/WebP)
- Resample quality

**Batch:** Multiple images → `{first}_resized.zip`; single image returned directly (+ “× smaller/larger” note).
**Default:** Maintain aspect, contain.  
**Validation:** Positive integers; warn on upscaling > 2×.

---

### Feature: Image Crop / Rotate

**Category:** Image  
**Priority:** V1  

**Purpose:** Crop a photo to a region and/or rotate it before export.

**User Flow:** Select one image → drag handles to set the crop box on a scaled preview → optional 0°/90°/180°/270° rotation → Crop → result.

**Options:**
- Crop rectangle (x, y, width, height in source pixels, derived from the interactive box)
- Rotation (0 / 90 / 180 / 270)

**UI:** Interactive preview panel (max width 560 px) with a dimmed-overlay crop box that supports drag-to-move and a corner handle to resize. Selection size in source pixels is shown under the preview.

**Output:** One processed image; format follows the source unless a target format is chosen.  
**Edge Cases:** 90°/270° rotation swaps crop width/height; box is clamped to the image bounds; minimum box size 16 px.

---

### Feature: Images → PDF

**Category:** PDF / Image  
**Priority:** MVP  

**Purpose:** Turn one or more images into a single PDF document.

**User Flow:** Select images → order (reorder panel with up/down buttons) → page size / orientation (optional) → Create PDF → result.

**Options:**
- Page order (interactive reorder list when 2+ images)
- Page size (A4, Letter, fit-to-image – default fit-to-image)
- Orientation
- Margin
- Image quality inside PDF

**Output:** Single PDF.  
**Edge Cases:** Mixed orientations; very large images (downscale warning).

---

## PDF Features

### Feature: PDF Merge

**Category:** PDF  
**Priority:** MVP  

**Purpose:** Combine multiple PDFs into one.

**User Flow:** Select 2+ PDFs → reorder → Merge → progress → single PDF.

**Options:** Minimal (order only).  
**Validation:** All must be valid PDFs; warn on encrypted files.  
**Error:** Password-protected without password → clear failure message.  
**Technical Difficulty:** Medium.  
**Dependencies:** pdf-lib (or equivalent).

---

### Feature: PDF Split

**Category:** PDF  
**Priority:** MVP  

**Purpose:** Extract page ranges or every page into separate files.

**Options:**
- Range (e.g. 1-3, 5, 8-10)
- Or “Every page as separate PDF”
- Output naming pattern

**Output:** One or multiple PDFs.  
**Edge Cases:** Invalid range → validation error before start.

---

### Feature: PDF Compress (Basic)

**Category:** PDF  
**Priority:** MVP  

**Purpose:** Reduce PDF size by image recompression and object optimization where the library allows.

**Options:** Quality preset (Low / Medium / High – default Medium).  
**Limitation:** True structural compression is limited in pure client-side libraries; document realistic expectations in UI.

---

### Feature: PDF Rotate / Reorder Pages

**Category:** PDF  
**Priority:** V1.1  

**Purpose:** Reorder pages and/or apply a uniform rotation to a whole document.

**User Flow:** Select PDF → page thumbnails/list load → reorder with up/down buttons → choose rotation (0/90/180/270) → Save.

**Options:**
- Page order (interactive reorder list, initialized from the document)
- Rotation (applied to every page; stacked with existing per-page rotations)

**Output:** Single re-encoded PDF.  
**Edge Cases:** Encrypted/corrupt PDF → the ordering panel shows a clear message instead of a silent blank state; stale order arrays fall back to identity order.

### Feature: PDF → Images (V1)

**Category:** PDF  
**Priority:** V1  

**Purpose:** Rasterize pages to JPG or PNG.

**Options:**
- Format (JPG / PNG, default JPG)
- Scale (1× / 2× / 3×, default 2× — conservative DPI by default)
- Quality (1–100, JPG only, default 92; normalized to the canvas encoder’s 0–1 scale)
- Page range (`1-3, 5, 8-10`) or all pages

**Output:** Single page → one image; multiple pages → `{base}_pages.zip` of images.  
**Dependencies:** pdfjs-dist (lazy loaded; worker served as a Vite asset, works offline). Renders with the canvas-backed render path (`page.render({ canvas, viewport })`).  
**Limits:** Max 200 pages per run to protect memory.

---

## Archive Features

### Feature: Create ZIP

**Category:** Archive  
**Priority:** MVP  

**Purpose:** Package multiple files or folders into a ZIP archive.

**User Flow:** Select files/folders → optional compression level → Create → progress → ZIP file.

**Options:** Compression level (default medium).  
**Validation:** Total uncompressed size warning.  
**Edge Cases:** Nested folders; long filenames.

---

### Feature: Extract ZIP

**Category:** Archive  
**Priority:** MVP  

**Purpose:** Unpack a ZIP into a chosen location or temporary then download.

**Safety:**
- Zip-bomb protection (max uncompressed size 4 GB, max file count 2000, max nesting depth 32).
- Filename sanitization (no `../`, backslashes, drive letters, `~`, or absolute `/`).
- Skip or warn on absolute paths / Windows reserved names.

**User Flow:** Select ZIP → preview contents (file list with sizes, select-all, per-file checkboxes, selected-size summary) → optional selective extract → Extract → choose output location → progress → done.

**Options:**
- `selectedEntries` (internal): names of files to extract; when empty, all safe files extract. Toggled via the preview panel.

**Error States:** Corrupted archive, password-protected (unsupported in MVP), bomb detected, no safe files.

---

### Feature: Extract TAR

**Category:** Archive  
**Priority:** V1  

**Purpose:** Unpack a plain `.tar` archive with the same safety guarantees as ZIP extraction.

**Implementation:** Pure-JS TAR parsing (512-byte headers with octal fields and checksum validation). No new third-party dependency. `.tar.gz` is not supported in this release.

**Safety:** Same limits as ZIP (entry count, total uncompressed size, nesting depth) plus header checksum verification and path sanitization.

**Output:** Extract to a chosen folder via File System Access API when available; otherwise re-packaged into `{base}_extracted.zip`.

---

### Feature: Batch Rename

**Category:** File Tools  
**Priority:** V1  

**Purpose:** Rename multiple files at once using simple patterns.

**Options:**
- Mode: Add prefix / Add suffix / Find & replace / Sequential numbering
- Prefix text, suffix text, find text, replace text
- Start number and pad width (sequential mode)

**UI:** Live preview panel listing original → renamed pairs with a changed-count badge; updates as options change.

**Output:** A single file returns the renamed copy directly; multiple files return `{first}_renamed.zip` containing all renamed files. Extensions are preserved.

---

### Feature: Find Duplicates

**Category:** File Tools  
**Priority:** V1  

**Purpose:** Detect duplicate files by content.

**Implementation:** SHA-256 hash of every selected file via `crypto.subtle` (no dependencies). Files with identical hashes are grouped.

**UI:** Instant tool (no job). Shows group count plus each group’s members with file names and sizes. Empty state: “No duplicate files found”.

---

## Video / Audio Features (V1+)

### Feature: Video → MP3 / WAV

**Category:** Video / Audio  
**Priority:** V1  

**Purpose:** Extract audio track from video.

**Supported Inputs (baseline):** MP4, MOV, WebM (others via FFmpeg capability).  
**Outputs:** MP3 (default), WAV.  

**Options:**
- Format (MP3 / WAV, default MP3)
- Bitrate (for MP3, default 192 kbps; presets 96/128/192/256/320)

**Progress:** FFmpeg core emits time-based progress mapped to a percentage.  
**Cancellation:** Supported via AbortSignal; the engine terminates the worker on cancel to stop CPU usage and free memory.  
**Warnings:** Files over 200 MB warn before conversion; files over 1 GB are rejected.  
**Technical Difficulty:** High (WASM size, memory, codec support).  
**Dependencies:** FFmpeg.wasm (lazy loaded; core self-hosted in `public/ffmpeg/`).

**Edge Cases:** Video with no audio track → clear error. Unsupported codec → “Codec not supported in this version” / generic conversion-failed message.

---

### Feature: Audio Conversion & Compression

**Category:** Audio  
**Priority:** V1  

**Purpose:** Convert between MP3, WAV, M4A and adjust bitrate.

**Options:** Format (MP3 / WAV / M4A) and bitrate (MP3/M4A only — WAV is PCM).  
**Output formats:** MP3 (libmp3lame), WAV (PCM 16-bit), M4A (AAC).  
**Similar flow and safeguards as video audio extraction** (progress, cancel, 200 MB warn / 1 GB limit).

---

### Feature: Video Compress / Resolution Change (V1)

**Category:** Video  
**Priority:** V1  

**Purpose:** Reduce video size or change resolution for sharing.

**Options:** Resolution preset (original/1080p/720p/480p), quality (CRF 18–38, default 28), audio bitrate (96/128/192 kbps, default 128).  
**Output:** MP4 (H.264 + AAC, faststart).  
**Heavy warnings required.** Files over 200 MB warn; over 1 GB rejected. Prefer desktop or warn heavily on mobile.

---

## General File Tools

### Feature: File Information

**Category:** General  
**Priority:** MVP  

**Purpose:** Show size, type, dimensions (images), duration (media), basic metadata, PDF page count, and the file's SHA-256 hash.

**User Flow:** Select file → Info card.  
**EXIF viewer:** JPEG/WebP photos show camera make/model and original date taken (parsed lazily with exifreader; MPL-2.0).  
**Media:** MP3/WAV/MP4/MOV show duration (mm:ss) and bitrate via lightweight header parsing (no FFmpeg load).  
**PDF:** Page count via lazy-loaded pdf-lib.  
**Hash:** SHA-256 shown truncated for every file (computed with `crypto.subtle`).  
**No conversion; instant.**

---

## Developer Utilities (V2)

Lightweight, pure-JS tools. Examples:

- JSON Format / Minify
- Base64 Encode / Decode
- Hash (MD5, SHA-256, SHA-512)
- UUID Generator
- URL Encode / Decode
- Simple JWT Decoder (header + payload, no signature verification required for display)
- Timestamp ↔ Date

Each is a simple form → process → copyable result. No file job system needed unless operating on uploaded text files.

**Priority:** V2 – after core media and document tools are solid.

---

## Shared Behaviors Across Features

### Progress & Loading
- Instant tools: button loading state only.
- Jobs: dedicated processing screen or persistent bottom bar with progress, stage text, Cancel button.
- Percentage when available; otherwise indeterminate + stage (“Extracting audio…”, “Writing PDF…”).

### Success State
- Card with output filename, size, and primary actions: Save / Share / Open / Convert another.
- Optional “Show in folder” on desktop.

### Cancellation
- Always available for jobs expected to take > 2 s.
- Immediate UI response; background cleanup.

### Storage & Naming
- Temporary → validated → final location.
- Collision: append ` (1)`, ` (2)` or timestamp.
- User can choose location when File System Access API is available.

### Sharing
- Native Web Share API / platform share sheet when available.
- Fallback: download.

### Error Communication
Use the messages defined in PRD.md. Keep them short, actionable, and free of technical jargon unless the user expands “Details”.

---

## Feature Dependencies (Selected)

- **Any conversion** → File Picker + Job System + File Service + History
- **Video → MP3** → File Picker + Job System + FFmpeg Adapter + Storage
- **PDF Merge** → File Picker + Job System + PDF Engine + Storage
- **Extract ZIP** → File Picker + Job System + Zip Engine (with safety checks) + Storage
- **Images → PDF** → Image handling + PDF Engine

New tools must register in the Tool Registry so the Universal Convert surface and Tools catalog stay consistent.

## Third-Party Runtime Dependencies

All libraries below load offline (bundled or self-hosted) and are justified by licensing, size, and offline requirements:

| Library | Version | License | Size (gzip) | Notes |
|---------|---------|---------|-------------|-------|
| pdf-lib | 1.17.1 | MIT | ~140 KB | Lazy-loaded with dynamic import; used by all PDF tools |
| pdfjs-dist | 6.3.289 | Apache-2.0 | ~1.2 MB (worker) | Lazy-loaded; worker emitted as a Vite asset and served same-origin |
| exifreader | 4.45.0 | MPL-2.0 | ~38 KB | Lazy-loaded; used only for JPEG/WebP EXIF display. MPL-2.0 is file-level — no modifications made to the library, so obligations extend only to redistributing the library itself. |
| jszip | 3.10.2 | MIT (GPL dual) | ~30 KB | Used for browser ZIP creation via `generateAsync` |
| @ffmpeg/ffmpeg + @ffmpeg/core | 0.12.x | MIT (FFmpeg LGPL elements) | ~31 MB (core, self-hosted in `public/ffmpeg/`) | Lazy-loaded; FFmpeg core not bundled into JS chunks |

Shared engine utilities (extracted to avoid duplication): `checkAbort` in `src/utils/abort.ts`, `zipBlobs` in `src/utils/zip.ts`, plus coercion/validation helpers exported from the image and PDF engines for unit testing.

---

## Out-of-Scope Features (Reconfirmed)

- Full video editor
- Cloud storage of user files
- DRM removal
- Password cracking
- Real-time collaboration
- Aggressive tracking
- Server-side conversion as the default path

This specification is the detailed companion to PRD.md. Implementation must follow Instruction.md rules.
