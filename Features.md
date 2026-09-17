# Features.md — Detailed Feature Specification

**Product:** FileForge
**Last Updated:** 2026-09-16
**Status:** Updated for Electron desktop preparation. All existing features marked with actual implementation status.

This document specifies behavior for every major feature. All UI must follow DESIGN.md. All long-running work uses the Job system defined in PRD.md and Instruction.md.

---

## Feature Matrix

| Feature | Category | Status | Complexity | Offline | Key Dependencies |
|---------|----------|--------|------------|---------|------------------|
| Universal File Picker + Type Detection | Core | Existing | Low-Medium | Yes | Platform File API / Electron dialog |
| Job System (queue, progress, cancel) | Core | Existing | Medium | Yes | — |
| Processing Queue (persistent, concurrent) | Core | Existing | Medium | Yes | IndexedDB |
| History | Core | Existing | Low-Medium | Yes | IndexedDB / SQLite |
| Image Convert (JPG/PNG/WebP) | Image | Existing | Low | Yes | Canvas / sharp |
| Image Compress | Image | Existing | Low | Yes | Canvas / sharp |
| Image Resize | Image | Existing | Low | Yes | Canvas / sharp |
| Image Crop / Rotate | Image | Existing | Medium | Yes | Canvas / sharp |
| Images to PDF | PDF / Image | Existing | Medium | Yes | pdf-lib |
| PDF Merge | PDF | Existing | Medium | Yes | pdf-lib |
| PDF Split | PDF | Existing | Medium | Yes | pdf-lib |
| PDF Compress | PDF | Existing | Medium | Yes | pdf-lib |
| PDF Rotate / Reorder | PDF | Existing | Medium | Yes | pdf-lib |
| PDF to Images | PDF | Existing | Medium | Yes | pdfjs-dist |
| Create ZIP | Archive | Existing | Low | Yes | JSZip |
| Extract ZIP | Archive | Existing | Medium | Yes | JSZip |
| Extract TAR | Archive | Existing | Medium | Yes | Pure-JS parser |
| Batch Rename | File Tools | Existing | Low | Yes | — |
| Find Duplicates | File Tools | Existing | Low | Yes | crypto.subtle |
| File Information | File Tools | Existing | Low | Yes | Platform + parsers |
| Video to Audio | Video | Existing | High | Yes* | FFmpeg.wasm |
| Audio Convert | Audio | Existing | High | Yes* | FFmpeg.wasm |
| Video Compress | Video | Existing | High | Yes* | FFmpeg.wasm |
| JSON Formatter | Developer | Existing | Low | Yes | Pure JS |
| Base64 Converter | Developer | Existing | Low | Yes | Pure JS |
| Hash Generator | Developer | Existing | Low | Yes | crypto.subtle |
| UUID Generator | Developer | Existing | Low | Yes | crypto.randomUUID |
| URL Converter | Developer | Existing | Low | Yes | Pure JS |
| JWT Decoder | Developer | Existing | Low | Yes | Pure JS |
| Timestamp Converter | Developer | Existing | Low | Yes | Pure JS |
| Windows Installer | Desktop | Required for Electron V1 | Medium | Yes | electron-builder |
| Native File Dialogs | Desktop | Required for Electron V1 | Low | Yes | Electron dialog API |
| Drag and Drop (Enhanced) | Desktop | Required for Electron V1 | Medium | Yes | HTML5 DnD + Electron |
| Windows Notifications | Desktop | Required for Electron V1 | Low | Yes | Electron Notification |
| Clipboard Integration | Desktop | Required for Electron V1 | Low | Yes | Navigator.clipboard |
| Auto-Update | Desktop | Required for Electron V1 | Medium | Yes | electron-updater |
| Uninstaller | Desktop | Required for Electron V1 | Low | Yes | electron-builder |
| Overwrite Protection | Desktop | Required for Electron V1 | Low | Yes | — |
| System Tray | Desktop | Future (V2) | Medium | Yes | Electron Tray |

\* Subject to memory and FFmpeg limitations; native binary in Electron improves this.

---

## Status Key

| Status | Meaning |
|--------|---------|
| **Existing** | Implemented in the current web/PWA version |
| **Required for Electron V1** | Must be implemented for the first desktop release |
| **Future (V2)** | Planned for a future version after V1 |
| **Not Planned** | Explicitly excluded from scope |

---

## Core Infrastructure Features

### Feature: Universal File Picker and Type Detection

**Status:** Existing
**Category:** Core
**Purpose:** Entry point for almost every workflow. Detect type and surface only relevant operations.

**User Flow:**
1. User taps "Select files" or drops files.
2. App requests necessary permission if needed.
3. Files are accepted; each is inspected (extension + MIME).
4. Preview card(s) appear with name, size, type icon/thumbnail, and list of compatible tools.
5. User chooses a tool or opens full Tools list.

**Inputs:** One or more files (platform limits apply).
**Outputs:** FileMeta objects (id, name, size, mime, extension, lastModified, temporary handle/URL).

**Validation:**
- Reject zero-byte files with clear message.
- Warn on extremely large files before processing.
- Unsupported types show "No direct tools" + link to full catalog.

**States:** Idle > Selecting > Ready (with FileMeta) > Error (permission / unsupported).

**Desktop Integration:**
- Current: File System Access API (`showOpenFilePicker`) with `<input>` fallback.
- Electron: `dialog.showOpenDialog()` with file type filters. No permission prompts needed.

---

### Feature: Job System

**Status:** Existing
**Category:** Core

**States:** `pending` | `processing` | `completed` | `failed` | `cancelled` (non-terminal states persist for restart recovery)

**Data per Job:**
- id (unique)
- toolId
- inputs: FileMeta[]
- options
- status
- progress (percent, message, current file index/total in batch jobs)
- error (human-readable message)
- errorDetails (technical stack, expandable)
- failedFiles ({name, error}[] for batch errors)
- retryCount
- interrupted (boolean, set for jobs cut off by app close)
- createdAt / updatedAt
- outputBlob / outputPath / outputName (on success)

**Behavior:**
- Create > enqueue; a scheduler (pump) runs up to `maxConcurrentJobs` (default 2, range 1–4) at once.
- Runner executes with progress callback and AbortSignal; per-file progress = "File x of y" + stage + percent.
- On finish: validate output, update history, clean temp, notify UI.
- Cancel: works from queue (before start) or via abort signal (while running).
- Retry: creates a NEW job from the failed job's inputs + options (only if safe — inputs must still resolve to paths); shown for failed/interrupted jobs.
- Batch errors: remaining files still process, then the job fails listing the affected files with per-file reasons.

**Concurrency:**
- Current: configurable concurrent jobs (Settings → max concurrent, 1–4, default 2) on both web and desktop.

**Storage:**
- Current: IndexedDB (`fileforge_jobs` / `queued`) for the persistent queue; job states snapshotted on every change, non-terminal jobs survive restart.
- Restore: pending jobs with complete input paths auto-resume on startup (toggle: resume pending jobs); those that were processing when the app closed are marked failed with `interrupted: true` and can be retried.

---

### Feature: History

**Status:** Existing
**Category:** Core

**Purpose:** Let users revisit recent results without re-selecting files.

**User Flow:** History tab > list of past jobs (newest first) > tap for details > Open / Delete / Re-run.

**Storage:**
- Current: IndexedDB, max 200 entries, auto-pruned.
- Desktop: SQLite or JSON file in `%APPDATA%\FileForge\`, same 200-entry limit.

**Data stored:** Job metadata (id, toolId, inputNames, inputSize, outputName, status, createdAt). Never file contents.

**Actions:** Open result, Delete entry, Clear all, Re-run (re-creates job with same options if input still available).

**Empty State:** "No recent activity. Convert a file to see it here."
**Error State:** Storage read failure > graceful empty + retry.

---

## Image Features

### Feature: Image Format Conversion

**Status:** Existing
**Category:** Image
**Priority:** Implemented (Phase 1-3)

**Purpose:** Convert between common web/image formats without quality loss beyond the target format's limits.

**User Flow:**
1. Select image(s).
2. Choose target format (JPG, PNG, or WebP).
3. Optional quality slider (for lossy targets).
4. Optional strip metadata toggle (default: on for privacy).
5. Convert > progress > result card > Save.

**Inputs:** Any `image/*` MIME type (browser decodes via Canvas; JPG, PNG, WebP, GIF, BMP, etc.).
**Outputs:** JPG, PNG, or WebP only (Canvas encoding limits).

**Configuration:**
- Target format: required (JPG, PNG, WebP)
- Quality: 1-100, default 85 for JPG/WebP; ignored for PNG
- Strip metadata: boolean, default true

**Default:** Quality 85, strip metadata.

**Batch:** Multiple images > `{first}_converted.zip`; single image returns the converted image directly.

**Edge Cases:**
- Transparent PNG > JPG: fills with white background automatically.
- Animated WebP: first frame only (Canvas limitation).
- Already tiny files: processes normally (no "already optimized" check).

**Desktop Integration:**
- Canvas-based processing moves to `sharp` or `node-canvas` in Node.js.
- Output saved via native fs instead of download/blob URL.

---

### Feature: Image Compression

**Status:** Existing
**Category:** Image
**Priority:** Implemented (Phase 1)

**Purpose:** Reduce file size while keeping acceptable visual quality.

**Options:**
- Quality: 1-100, default 80
- Max dimension: optional (px), downscales if image exceeds
- Strip metadata: boolean, default true

**Output format:** Same as input (JPG stays JPG, PNG stays PNG, WebP stays WebP).

**Success State:** Shows original size vs new size + percentage saved.

**Batch:** Multiple images > `{first}_compressed.zip`; single image returned directly; before/after comparison per file.

**Edge Cases:** Already tiny files > processes normally.

---

### Feature: Image Resize

**Status:** Existing
**Category:** Image
**Priority:** Implemented (Phase 1)

**Options:**
- Width / Height (px)
- Maintain aspect ratio (default true)
- Fit mode: contain / cover / stretch (default contain)
- Output format: same as input
- Quality: default 90

**Batch:** Multiple images > `{first}_resized.zip`; single image returned directly.

**Default:** Maintain aspect, contain.
**Validation:** Positive integers; warn on upscaling > 2x.

---

### Feature: Image Crop and Rotate

**Status:** Existing
**Category:** Image
**Priority:** Implemented (Phase 3)

**Purpose:** Crop a photo to a region and/or rotate it before export.

**User Flow:** Select one image > drag handles to set crop box on scaled preview > optional 0/90/180/270 rotation > Crop > result.

**Options:**
- Crop rectangle (x, y, width, height in source pixels)
- Rotation: 0 / 90 / 180 / 270
- Output format: JPG, PNG, or WebP (default: source format)
- Quality: default 90
- Strip metadata: default true

**UI:** Interactive preview panel with dimmed-overlay crop box, drag-to-move, corner handle to resize. Selection size shown in source pixels.

**Output:** Single processed image. Batch not supported for crop.

**Edge Cases:** 90/270 rotation swaps crop width/height; box clamped to image bounds; minimum box size 16 px.

---

### Feature: Images to PDF

**Status:** Existing
**Category:** PDF / Image
**Priority:** Implemented (Phase 1-3)

**Purpose:** Turn one or more images into a single PDF document.

**Inputs:** JPG, PNG only (not WebP — pdf-lib limitation for embedding).

**Options:**
- Page size: fit-to-image (default), A4, Letter
- Orientation: portrait / landscape
- Margin: 0-96 px, default 24
- Page order: interactive reorder panel when 2+ images

**Output:** Single PDF.

**Edge Cases:** Mixed orientations; very large images (downscale to fit page).

---

## PDF Features

### Feature: PDF Merge

**Status:** Existing
**Category:** PDF
**Priority:** Implemented (Phase 1)

**Purpose:** Combine multiple PDFs into one.

**User Flow:** Select 2+ PDFs > reorder > Merge > progress > single PDF.

**Validation:** All must be valid PDFs; password-protected detected with clear error message.

**Edge Cases:** Encrypted without password > clear failure message.

---

### Feature: PDF Split

**Status:** Existing
**Category:** PDF
**Priority:** Implemented (Phase 1)

**Purpose:** Extract page ranges or every page into separate files.

**Options:**
- Mode: range / every
- Range syntax: `1-3, 5, 8-10`
- "Every page" mode outputs individual PDFs zipped

**Edge Cases:** Invalid range > validation error before start.

---

### Feature: PDF Compress

**Status:** Existing
**Category:** PDF
**Priority:** Implemented (Phase 1)

**Purpose:** Reduce PDF size by rebuilding the document.

**Behavior:** Rebuilds PDF with pdf-lib; returns the smaller of original/rebuilt. If rebuilt is larger, returns original unchanged.

**Limitation:** True structural compression is limited in pdf-lib; expectations should be documented in UI.

---

### Feature: PDF Rotate and Reorder Pages

**Status:** Existing
**Category:** PDF
**Priority:** Implemented (Phase 3)

**Purpose:** Reorder pages and/or apply uniform rotation.

**User Flow:** Select PDF > page thumbnails load > reorder with up/down buttons > choose rotation (0/90/180/270) > Save.

**Options:**
- Page order (interactive reorder list)
- Rotation applied to every page (stacked with existing per-page rotations)

**Output:** Single re-encoded PDF.

---

### Feature: PDF to Images

**Status:** Existing
**Category:** PDF
**Priority:** Implemented (Phase 3)

**Purpose:** Rasterize pages to JPG or PNG.

**Options:**
- Format: JPG / PNG (default JPG)
- Scale: 1x / 2x / 3x (default 2x)
- Quality: 1-100, JPG only (default 92)
- Page range: `1-3, 5, 8-10` or all pages

**Output:** Single page > one image; multiple pages > `{base}_pages.zip` of images.

**Limits:** Max 200 pages per run.

**Dependencies:** pdfjs-dist (lazy-loaded; worker served as Vite asset). Renders with canvas-backed `page.render()`.

---

## Archive Features

### Feature: Create ZIP

**Status:** Existing
**Category:** Archive
**Priority:** Implemented (Phase 1)

**Purpose:** Package multiple files into a ZIP archive.

**Options:** Compression level: 1 (fastest), 6 (medium, default), 9 (maximum).

**Edge Cases:** Nested folders; long filenames.

---

### Feature: Extract ZIP

**Status:** Existing
**Category:** Archive
**Priority:** Implemented (Phase 1-4)

**Purpose:** Unpack a ZIP with content preview and selective extraction.

**Safety:**
- Max 2,000 entries
- Max 4 GiB uncompressed
- Max 32-level nesting depth
- Path sanitization (no `../`, backslashes, drive letters, `~`, absolute `/`)
- Header checksum validation

**User Flow:** Select ZIP > preview contents (file list with sizes, select-all, per-file checkboxes) > optional selective extract > Extract > choose output location > progress > done.

**Output:**
- Current (File System Access API): extracts to chosen folder, returns manifest text.
- Desktop target (Electron): extracts to chosen folder via native folder dialog, returns manifest text.
- Fallback: re-packages into `{base}_extracted.zip`.

---

### Feature: Extract TAR

**Status:** Existing
**Category:** Archive
**Priority:** Implemented (Phase 4)

**Purpose:** Unpack a plain `.tar` archive with the same safety guarantees as ZIP extraction.

**Implementation:** Pure-JS TAR parser (512-byte headers with octal fields and checksum validation). No third-party dependency. `.tar.gz` is not supported.

**Safety:** Same limits as ZIP plus header checksum verification.

**Output:** Same as ZIP extract (folder or fallback ZIP).

---

## File Utility Features

### Feature: Batch Rename

**Status:** Existing
**Category:** File Tools
**Priority:** Implemented (Phase 4)

**Options:**
- Mode: prefix / suffix / find-replace / sequential numbering
- Prefix text, suffix text, find text, replace text
- Start number and pad width (sequential mode)

**UI:** Live preview panel listing original > renamed pairs with changed-count badge.

**Output:** Single file > renamed copy directly; multiple files > `{first}_renamed.zip`. Extensions preserved.

---

### Feature: Find Duplicates

**Status:** Existing
**Category:** File Tools
**Priority:** Implemented (Phase 4)

**Purpose:** Detect duplicate files by content.

**Implementation:** SHA-256 hash of every file via `crypto.subtle`. Files with identical hashes are grouped.

**UI:** Instant tool (no job). Shows group count plus each group's members with file names and sizes.

**Empty State:** "No duplicate files found."

---

### Feature: File Information

**Status:** Existing
**Category:** File Tools
**Priority:** Implemented (Phase 1-4)

**Purpose:** Show size, type, dimensions (images), duration (media), metadata, PDF page count, and SHA-256 hash.

**Behavior by file type:**
- **Images:** Dimensions (Canvas), EXIF metadata (camera make/model, date taken via exifreader for JPEG/WebP)
- **Audio:** Duration (mm:ss), bitrate via header parsing (MP3, WAV)
- **Video:** Duration via MP4 moov atom parsing (MP4, MOV)
- **PDF:** Page count via lazy-loaded pdf-lib
- **All files:** SHA-256 hash (truncated) via `crypto.subtle`

**No conversion; instant result.**

---

## Video and Audio Features

### Feature: Video to Audio

**Status:** Existing
**Category:** Video
**Priority:** Implemented (Phase 2)

**Purpose:** Extract audio track from video.

**Supported Inputs:** MP4, MOV, WebM (others via FFmpeg capability).
**Outputs:** MP3 (default), WAV.

**Options:**
- Format: MP3 / WAV (default MP3)
- Bitrate: 96/128/192/256/320 kbps (default 192)

**Progress:** FFmpeg progress event mapped to percentage.
**Cancellation:** Supported via AbortSignal; worker terminated on cancel.
**Warnings:** 200 MiB warn, 1 GiB hard limit.

**Edge Cases:** No audio track > clear error. Unsupported codec > conversion-failed message.

---

### Feature: Audio Conversion

**Status:** Existing
**Category:** Audio
**Priority:** Implemented (Phase 2)

**Purpose:** Convert between MP3, WAV, M4A and adjust bitrate.

**Options:** Format (MP3 / WAV / M4A) and bitrate (MP3/M4A only).
**Output formats:** MP3 (libmp3lame), WAV (PCM 16-bit), M4A (AAC).

**Same safeguards as video audio extraction** (progress, cancel, 200 MiB warn / 1 GiB limit).

---

### Feature: Video Compress

**Status:** Existing
**Category:** Video
**Priority:** Implemented (Phase 2)

**Purpose:** Reduce video size or change resolution.

**Options:**
- Resolution: original / 1080p / 720p / 480p
- CRF quality: 18/22/28/32/38 (default 28)
- Audio bitrate: 96/128/192 kbps (default 128)

**Output:** MP4 (H.264 + AAC, faststart flag).

**Heavy warnings required.** 200 MiB warn, 1 GiB rejected.

---

## Developer Tools

### Feature: JSON Formatter

**Status:** Existing
**Category:** Developer
**Priority:** Implemented (Phase 5)

**Options:** Mode (format / minify), indent (0-8, default 2).
**UI:** Text input > process > copyable result.
**Error:** Invalid JSON shows clear error message.

---

### Feature: Base64 Converter

**Status:** Existing
**Category:** Developer
**Priority:** Implemented (Phase 5)

**Options:** Mode (encode / decode).
**Behavior:** UTF-8 safe in both directions.
**Error:** Invalid Base64 input shows clear error message.

---

### Feature: Hash Generator

**Status:** Existing
**Category:** Developer
**Priority:** Implemented (Phase 5)

**Options:** Algorithm (SHA-256 / SHA-512).
**Implementation:** `crypto.subtle.digest`. MD5 intentionally omitted (deprecated).
**UI:** Text input > hash output (copyable).

---

### Feature: UUID Generator

**Status:** Existing
**Category:** Developer
**Priority:** Implemented (Phase 5)

**Options:** Count (1-100).
**Implementation:** `crypto.randomUUID()`.
**UI:** Click to generate; output is copyable.

---

### Feature: URL Converter

**Status:** Existing
**Category:** Developer
**Priority:** Implemented (Phase 5)

**Options:** Mode (encode / decode).
**Implementation:** `encodeURIComponent` / `decodeURIComponent`.
**Error:** Invalid URL encoding shows clear error message.

---

### Feature: JWT Decoder

**Status:** Existing
**Category:** Developer
**Priority:** Implemented (Phase 5)

**Purpose:** View header and payload of a JWT token.
**Implementation:** Display only; no signature verification.
**Error:** Malformed JWT structure shows clear error message.

---

### Feature: Timestamp Converter

**Status:** Existing
**Category:** Developer
**Priority:** Implemented (Phase 5)

**Options:** Unit (seconds / milliseconds).
**Output:** ISO 8601, local date/time, UTC date/time.
**Error:** Non-numeric input shows clear error message.

---

## Desktop Features (Electron V1)

### Feature: Windows Installer

**Status:** Required for Electron V1
**Category:** Desktop

**Purpose:** Install FileForge as a native Windows application.

**Requirements:**
- Windows `.exe` installer (NSIS or MSI)
- Start Menu shortcut (required)
- Desktop shortcut (optional, user choice during install)
- Installation directory selection where supported
- Version information displayed
- File type associations where applicable

**Technology:** To Be Decided (electron-builder or electron-forge).

---

### Feature: Uninstaller

**Status:** Required for Electron V1
**Category:** Desktop

**Purpose:** Properly remove FileForge from the system.

**Requirements:**
- Remove application files
- Remove Start Menu shortcut
- Remove Desktop shortcut (if created)
- Remove application data (`%APPDATA%\FileForge\`) per user preference
- Never delete user-generated output files
- Clearly distinguish application data from user files

---

### Feature: Native File Dialogs

**Status:** Required for Electron V1
**Category:** Desktop

**Purpose:** Replace browser File System Access API with native Windows dialogs.

**Requirements:**
- Single file selection
- Multiple file selection
- Folder selection
- Save As dialog
- Output directory preference
- File type filters per tool
- Remember last-used directory

**Technology:** Electron `dialog.showOpenDialog()`, `dialog.showSaveDialog()`.

---

### Feature: Drag and Drop (Enhanced)

**Status:** Required for Electron V1
**Category:** Desktop

**Purpose:** Drag files from Windows Explorer into FileForge.

**Requirements:**
- Drag files into tool workspace
- Drag multiple files simultaneously
- Folder drag-and-drop where technically supported
- Visual drag-over state (highlight, border change)
- Invalid file rejection with clear message
- File type validation before processing
- Large-file handling with size warnings
- Batch processing through drag-and-drop
- Consistent UX across all file-based tools

**Technology:** HTML5 Drag and Drop API in renderer. Electron supports native file drag from Explorer.

---

### Feature: Processing Queue

**Status:** Required for Electron V1
**Category:** Desktop

**Purpose:** Manage multiple concurrent processing jobs.

**States:** `pending` | `processing` | `completed` | `failed` | `cancelled`

**Requirements:**
- Visual queue panel showing all active and recent jobs
- Per-job: status, progress, file name, cancel/retry buttons
- Concurrent job limits (configurable)
- Queue persists during session (in-memory)
- Failed jobs show error summary and retry option
- Completed jobs show open/copy actions

---

### Feature: Windows Notifications

**Status:** Required for Electron V1
**Category:** Desktop

**Purpose:** Notify users of processing results.

**Events:**
- Processing completed
- Processing failed
- Batch processing completed
- Update available

**Requirements:**
- No sensitive file content in notifications
- User can toggle notifications in Settings
- Notification click brings window to focus
- Notification uses app icon and name

**Technology:** Electron `Notification` API (uses Windows toast notifications).

---

### Feature: Clipboard Integration

**Status:** Required for Electron V1
**Category:** Desktop

**Purpose:** Copy/paste within the application.

**Requirements:**
- Copy developer tool results (all 7 developer tools)
- Copy file path from result cards
- Standard keyboard shortcuts: Ctrl+C, Ctrl+V, Ctrl+X, Ctrl+A
- Copy button on all developer tool output areas
- Do not force clipboard where it does not make sense (e.g., file processing results are saved to disk, not copied)

---

### Feature: Auto-Update

**Status:** Implemented (Electron V1) — 2026-09-16
**Category:** Desktop

**Purpose:** Keep FileForge up to date.

**Requirements:**
- Check for updates on startup (optional, configurable)
- Manual "Check for Updates" in Settings
- Show update availability with version number
- Download update with progress indicator
- Install update (prompt for restart)
- Handle failed downloads gracefully with retry
- User can dismiss/skip specific versions
- Version comparison (semantic versioning)

**Technology:** `electron-updater` with GitHub Releases (`SALMANHABIB443/FileForge`). Downloads and installs are always user-triggered; versions dismissed in the "Not now" flow are skipped on future checks.

---

### Feature: Overwrite Protection

**Status:** Required for Electron V1
**Category:** Desktop

**Purpose:** Prevent accidental overwriting of user files.

**Requirements:**
- Before writing output, check if file exists at target path
- If exists: auto-rename with suffix (`_1`, `_2`, etc.) by default
- Alternative: show confirmation dialog (configurable in Settings)
- User can configure preference in Settings
- Never silently overwrite without user awareness

---

### Feature: Open Output

**Status:** Required for Electron V1
**Category:** Desktop

**Purpose:** Provide quick access to processed results.

**Requirements:**
- "Open File" — opens with system default application (`shell.openPath()`)
- "Open Folder" — opens containing folder in Explorer (`shell.showItemInFolder()`)
- "Copy Path" — copies full file path to clipboard
- Available on result card after successful processing

---

### Feature: Output Location Management

**Status:** Required for Electron V1
**Category:** Desktop

**Purpose:** Remember and manage where processed files are saved.

**Requirements:**
- Remember preferred output directory
- Default: same directory as input file, or user-configured default
- Safe fallback: system Downloads folder
- User can change default in Settings
- Output directory shown in result card

---

## Future Features (V2)

### Feature: System Tray

**Status:** Future (V2)
**Category:** Desktop

**Purpose:** Background presence and quick access.

**Potential uses:**
- Background processing monitoring
- Long-running job status
- Quick access to recent tools
- Application status indicator
- Processing queue at a glance

**Not required for V1.**

---

## Shared Behaviors Across Features

### Progress and Loading
- Instant tools: button loading state only.
- Jobs: dedicated processing screen or persistent bottom bar with progress, stage text, Cancel button.
- Percentage when available; otherwise indeterminate + stage message.
- Desktop: queue panel shows progress for all active jobs.

### Success State
- Card with output filename, size, and primary actions.
- Desktop: Open File, Open Folder, Copy Path.
- Web: Save / Share / Download.

### Cancellation
- Always available for jobs expected to take > 2 seconds.
- Immediate UI response; background cleanup.
- Safe via AbortSignal at engine-defined checkpoints.

### Retry
- Available for failed jobs where safe.
- Creates a new job with the same inputs and options.
- Not available for corrupted input or unsupported format errors.

### Storage and Naming
- Temporary > validated > final location.
- Collision: append ` (1)`, ` (2)` or timestamp.
- Desktop: user can choose location via Save As dialog.
- Overwrite protection: auto-rename or confirmation (configurable).

### Error Communication
Use the messages defined in PRD.md. Keep them short, actionable, and free of technical jargon unless the user expands "Details".

---

## Feature Dependencies

- **Any conversion** > File Picker + Job System + File Service + History
- **Video to Audio** > File Picker + Job System + FFmpeg Engine + Storage
- **PDF Merge** > File Picker + Job System + PDF Engine + Storage
- **Extract ZIP** > File Picker + Job System + ZIP Engine (with safety checks) + Storage
- **Images to PDF** > Image handling + PDF Engine

New tools must register in the Tool Registry so the Universal Convert surface and Tools catalog stay consistent.

---

## Third-Party Runtime Dependencies

All libraries below load offline (bundled or self-hosted):

| Library | Version | License | Notes |
|---------|---------|---------|-------|
| pdf-lib | 1.17.1 | MIT | Lazy-loaded; used by all PDF tools |
| pdfjs-dist | 6.3.289 | Apache-2.0 | Lazy-loaded; worker served as Vite asset |
| exifreader | 4.45.0 | MPL-2.0 | Lazy-loaded; JPEG/WebP EXIF only. MPL-2.0 obligations extend only to redistribution of the library itself |
| jszip | 3.10.2 | MIT (GPL dual) | ZIP creation via `generateAsync` |
| @ffmpeg/ffmpeg + @ffmpeg/core | 0.12.x | MIT (FFmpeg LGPL elements) | ~31 MB core self-hosted in `public/ffmpeg/` |
| react | 19.1.0 | MIT | UI framework |
| react-router-dom | 7.6.1 | MIT | Client-side routing |
| zustand | 5.0.5 | MIT | State management |

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
