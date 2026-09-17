# Product Requirements Document (PRD)

**Product:** FileForge
**Version:** 2.0 (Electron Desktop Preparation)
**Last Updated:** 2026-09-15
**Status:** Documentation prepared for Electron desktop conversion

---

## 1. Product Overview

### 1.1 Product Name
**FileForge** (working title). Final branding may evolve; treat as placeholder.

### 1.2 Product Concept
FileForge is an all-in-one, privacy-first file utility toolbox that lets users perform everyday file operations — conversion, compression, extraction, merging, splitting, resizing, and developer utilities — entirely on-device.

**Current state:** Privacy-first Progressive Web App (PWA) running in modern browsers.
**Future state:** Native Windows Electron desktop application with native file dialogs, system notifications, installer, and full offline desktop operation.

Core workflow:
**Select file(s) > Choose operation > Configure (only when needed) > Process > Save / Share**

### 1.3 Product Vision
Become the default local file toolbox for students, creators, office workers, and developers who value speed, privacy, and reliability over cloud-dependent tools.

### 1.4 Product Goals
- Make the most common file tasks effortless and reliable.
- Guarantee that user files never leave the device unless the user explicitly chooses a cloud-dependent feature (none planned for V1).
- Deliver a premium, consistent UI following the design system.
- Provide clear progress, robust error handling, and safe temporary-file lifecycle.
- Ship a focused application that feels complete, then expand in measured phases.
- Transition to a native Windows desktop application for a premium desktop experience.

### 1.5 Non-Goals
- Full video editing suite (timeline, effects, multi-track).
- Online file storage or cloud drive replacement.
- Server-side conversion as the default path.
- Aggressive analytics or advertising.
- DRM removal or copyright-circumvention features.
- Password cracking or security research tools.
- Real-time collaboration.
- Social sharing integrations beyond native share sheet.

---

## 2. Problem Statement

Users currently face:
- Fragmented tooling: separate apps/websites for video conversion, PDF tools, image compression, archive handling.
- Privacy risk: most free converters upload files to remote servers.
- Poor UX: multi-step wizards, confusing options, unclear progress, failed large-file jobs with no recovery.
- Performance and reliability issues on mobile and constrained devices.
- Lack of a single, trustworthy, offline-capable toolbox with consistent quality.
- Browser limitations: unreliable File System Access API support, no native notifications, no proper installer.

FileForge solves this by consolidating high-value operations into one modern, offline-first application with a single coherent UX — first as a web app, then as a native Windows desktop application.

---

## 3. Target Users

| Segment | Needs | Priority |
|---------|-------|----------|
| Students and researchers | Convert lecture videos to audio, compress PDFs/images, merge notes | High |
| Content creators and social media users | Extract audio, compress video/images, resize for platforms | High |
| Office / knowledge workers | PDF merge/split/compress, image to PDF, basic archives | High |
| Developers and technical users | File info, Base64/Hash/JSON utilities, quick format conversions | Medium |
| General desktop users | Occasional conversion, compression, ZIP without installing multiple apps | Medium |

Secondary: power users who want batch or advanced options (later phases).

---

## 4. Core Value Proposition

- **One app, many tools** — no need to hunt for separate converters.
- **True offline / local processing** — files stay on device.
- **Simple, fast workflow** — select > act > done.
- **Premium UI** — consistent, high-quality, non-gimmicky.
- **Reliable and transparent** — clear progress, honest error messages, safe cleanup.
- **Expandable** — architecture supports adding new tools without redesigning the core experience.
- **Native desktop experience** (future) — installer, notifications, native file dialogs, auto-update.

---

## 5. Product Principles

1. **User-first** — Prefer the shortest path: select file > compatible actions appear > convert. Minimize configuration screens.
2. **Offline-first** — Local processing is the default and preferred path. Cloud is only considered for features that are impossible locally and must be explicitly labeled.
3. **Privacy by design** — No silent uploads. Temporary files are cleaned. Metadata handling is transparent. History is local and deletable.
4. **Reliability** — Graceful handling of unsupported formats, corrupted files, large files, low storage, permission denials, cancelled jobs, and engine failures.
5. **Performance awareness** — Respect device limits (memory, CPU, battery, storage). Provide cancellation, progress, and size warnings.
6. **Focused scope** — Every feature must belong to a clear category and deliver clear user value. No feature bloat.
7. **Design consistency** — All UI follows DESIGN.md (colors, radii, typography, shadows, components). No deviations without explicit design update.

---

## 6. Feature Scope

### 6.1 Implemented (Web/PWA — Complete)

All features below are implemented in the current web/PWA version:

**Images:**
- Image Convert (JPG, PNG, WebP output)
- Image Compress (quality control, optional max dimension)
- Image Resize (width/height, aspect ratio, fit modes)
- Image Crop and Rotate (interactive drag-box, 0/90/180/270 rotation)
- Images to PDF (page size, orientation, margin, reorder panel)

**PDF:**
- PDF Merge (2+ files, password detection)
- PDF Split (page ranges or every page)
- PDF Compress (rebuilds document, keeps smaller result)
- PDF Organize (reorder pages, rotate 0/90/180/270)
- PDF to Images (JPG/PNG, scale 1x/2x/3x, max 200 pages)

**Archives:**
- ZIP Create (compression levels 1/6/9)
- ZIP Extract (content preview, selective extract, zip-bomb protection)
- TAR Extract (pure-JS parser, checksum validation, same safety limits)

**Video and Audio:**
- Video to Audio (MP3, WAV extraction)
- Video Compress (resolution presets, CRF quality, H.264+AAC)
- Audio Convert (MP3, WAV, M4A with bitrate control)

**Files and Utilities:**
- Batch Rename (prefix, suffix, find-replace, sequential numbering)
- Find Duplicates (SHA-256 hash comparison)
- File Information (size, type, dimensions, EXIF, duration, hash)

**Developer Tools:**
- JSON Formatter
- Base64 Converter
- Hash Generator (SHA-256, SHA-512)
- UUID Generator (v4)
- URL Converter (encode/decode)
- JWT Decoder (display only)
- Timestamp Converter

**Infrastructure:**
- Job system with progress and cancellation
- History (IndexedDB, max 200 entries)
- Settings (localStorage)
- PWA with offline support
- Privacy policy, licenses, diagnostic logs
- Local analytics (opt-in)

### 6.2 Required for Electron V1

These features are required for the first Windows desktop release:

**Windows Installation:**
- Windows `.exe` installer (NSIS or MSI)
- Start Menu entry (required)
- Optional Desktop shortcut (user choice during install)
- Installation directory selection where supported
- Version information displayed in installer
- Proper uninstaller

**Native File Management:**
- Native file selection dialog (single and multiple files)
- Native folder selection dialog
- Save As dialog with output directory preference
- Open output file after processing
- Open output folder in Explorer
- Remember preferred output location

**Drag and Drop:**
- Drag files into any tool workspace
- Drag multiple files simultaneously
- Folder drag-and-drop where technically supported
- Visual drag-over state with highlight
- Invalid file rejection with clear message
- File type validation before processing
- Large-file handling with size warnings
- Batch processing through drag-and-drop

**Processing Queue:**
- Support multiple concurrent jobs (configurable)
- Queue states: pending, processing, completed, failed, cancelled
- Queue visualization in dedicated UI panel
- Job management (cancel, retry, remove)

**Progress and Feedback:**
- Progress bar with percentage for every long-running operation
- Current status message (stage text)
- Current file name in batch operations
- Total files count in batch operations
- Estimated time remaining where reliable (do not fabricate)

**Cancellation:**
- Cancel button for all jobs expected to take > 2 seconds
- Safe cancellation via AbortSignal
- Cleanup of temporary files on cancel
- Immediate UI response

**Retry:**
- Retry button for failed jobs where safe
- Re-creates job with same options

**Batch Processing:**
- Tools that support multiple files process them as a batch
- Tool-specific batch limitations documented
- Batch progress (current file / total files)

**Output Management:**
- Open output file after processing
- Open output folder in Explorer
- Copy file path to clipboard
- Remember preferred output location
- Safe defaults (same directory as input, or Downloads)

**Overwrite Protection:**
- Never silently overwrite existing user files
- Automatic filename suffixing (e.g., `file_1.pdf`)
- User confirmation for explicit overwrite

**Error Handling:**
- Human-readable error messages
- Technical details in expandable section
- Retry option where applicable
- Cancel option during processing
- Affected file information in batch errors
- No internal stack traces in normal UI

**Windows Notifications:**
- Processing completed notification
- Processing failed notification
- Batch processing completed notification
- Update available notification
- Notifications must not expose sensitive file content
- User can control notification behavior in Settings

**Clipboard Integration:**
- Copy developer tool results (JSON, Base64, URL, JWT, Hash, UUID, Timestamp)
- Standard keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+X)
- Copy file path from results
- Do not force clipboard where it does not make sense

**Auto-Update:**
- Update detection (check against release server)
- Update availability notification
- Update download with progress
- Update installation (restart when necessary)
- Manual "Check for Updates" in Settings
- Version comparison
- Failed update handling with retry
- User control over updates (not forced)

**Offline Operation:**
- All core tools work without internet
- Only auto-update requires internet connection

### 6.3 V2 / Future

Features planned for future versions:

- System Tray integration
  - Background processing
  - Long-running job monitoring
  - Quick access menu
  - Application status indicator
- Advanced queue management
- Background processing enhancements
- Other future desktop integrations
- Video to GIF
- Advanced audio tools (trim, merge, sample-rate)
- PDF password protect/unlock
- Additional archive formats (7Z extract where licensing permits)
- Optional account for history sync only (never files)

### 6.4 Not Planned

The following features are explicitly **not planned**:

- **Windows Auto-start** — The application should NOT launch automatically when Windows starts. Not planned for V1 or future versions unless explicitly requested.
- **Global keyboard shortcuts** — Shortcuts that operate globally while FileForge is not focused are not planned. Normal in-app keyboard shortcuts (Ctrl+C, Ctrl+V, Ctrl+S, Ctrl+Z, Ctrl+Shift+Z, Escape, Enter) are allowed.
- **Full video editor** — Timeline, effects, multi-track editing.
- **Cloud storage** — Online file storage or cloud drive replacement.
- **Server-side conversion** — All processing remains local.
- **DRM removal** — Copyright circumvention features.
- **Real-time collaboration** — Multi-user editing.
- **Aggressive analytics** — No tracking, no session recording.

---

## 7. Functional Requirements

### 7.1 File Selection and Detection
- Support single and multi-file selection via native picker or drag-and-drop.
- Detect MIME type and extension; fall back to content sniffing where safe.
- Show file preview (thumbnail for images/video, icon + metadata for others) before operation selection.
- Reject or warn on obviously unsupported or dangerous files early.
- Desktop: use Electron native dialogs (`dialog.showOpenDialog`) instead of browser File System Access API.

### 7.2 Universal Convert Entry
- After selecting a file, present only compatible operations based on detected type.
- Example: MP4 offers Audio (MP3/WAV), Compress, File Info.
- Example: PNG offers JPG, WebP, Compress, Resize, Crop, PDF, File Info.
- Fallback: "Open in Tools" if no direct conversion.

### 7.3 Conversion / Operation Engine
- Each tool is a discrete, testable module behind a common job interface.
- Input validation, temporary workspace, progress reporting, cancellation support, output validation, cleanup.
- Desktop: engines run in Node.js context (main process or worker thread).

### 7.4 Job Management
- States: Pending > Processing > Completed | Failed | Cancelled
- Unique Job ID, timestamps, progress (0-100% or indeterminate), error message.
- Desktop: support multiple concurrent jobs with configurable limits.
- Retry from Failed state where safe.
- Cancel cleans temporary files.

### 7.5 History
- Local-only list of recent jobs (configurable retention, max 200 entries).
- Show status, input name, output name, date, size.
- Actions: open result, delete entry, re-run with same settings (where possible).
- Clear all / auto-expire old entries.

### 7.6 Settings
- Preferred output location (Desktop: native folder picker).
- Temporary file cleanup policy.
- History retention.
- Theme follows system / DESIGN.md light warm-white theme for V1.
- Notification preferences (Desktop).
- About, Privacy statement, Licenses, Version.
- Check for Updates (Desktop).
- Permission status indicators.

### 7.7 Sharing and Saving
- Desktop: native Save As dialog via Electron.
- Default filename derived from original + operation + timestamp or counter to avoid collisions.
- Open containing folder option (Desktop).
- Copy file path option (Desktop).

---

## 8. Non-Functional Requirements

### 8.1 Performance
- Image operations: < 2 seconds for typical photos on mid-range devices.
- PDF merge/split of reasonable documents: < 5 seconds.
- Video audio extraction: progress visible; warn for files > 200 MiB.
- Desktop: avoid blocking the main process with heavy synchronous work; use worker threads.
- Cancellation must be responsive (< 1 second).

### 8.2 Reliability
- No silent failures. Every failure produces a user-visible message + optional technical detail.
- Temporary files always cleaned on success, cancel, or crash recovery.
- Output files validated (existence, non-zero size) before marking Completed.

### 8.3 Security and Privacy
- All processing client-side for V1 features.
- No network requests that transmit user file content.
- Sanitize filenames; prevent path traversal on extract.
- Limit archive extraction size and nesting depth (zip-bomb protection).
- Temporary workspace isolated and cleaned.
- History stores only metadata + local paths, never file contents.
- Desktop: `contextIsolation: true`, `nodeIntegration: false`, secure IPC, argument validation.
- Clear privacy statement in Settings.

### 8.4 Accessibility
- Follow WCAG 2.1 AA where practical.
- Sufficient contrast per DESIGN.md section 18 (Accessibility).
- Touch targets >= 44 px.
- Screen-reader labels on all interactive elements and progress.
- Respect reduced-motion preference.
- Font scaling support.

### 8.5 Scalability and Maintainability
- Modular tool architecture: new tools register with category, supported inputs, UI config schema.
- Shared job runner, progress, error, and storage services.
- Clear separation: UI > Feature Service > Engine Adapter > File System.
- Desktop: IPC boundary between renderer and main process enforces clean separation.

### 8.6 Storage
- Desktop: prefer user-visible Documents or chosen folder.
- Application data in `%APPDATA%\FileForge\`.
- Temporary directory in `%TEMP%\FileForge\jobs\`, auto-cleaned.
- Warn when free space < estimated output size x 1.5.

---

## 9. File Processing Requirements

### Input Handling
- Accept files via picker, drag-and-drop, or native dialog.
- Record original name, size, MIME, last-modified for history and naming.
- Never modify original unless user explicitly chooses "replace" (not recommended).

### Temporary Workspace
- Isolated directory per job in system temp folder.
- Cleaned on job end or on next app start for orphaned jobs.

### Output Handling
- Default location: user-chosen folder or same directory as input.
- Filename strategy: `{originalBase}_{operation}_{timestampOrCounter}.{ext}`
- Conflict: append counter or let user choose.
- After success: present "Open / Open Folder / Copy Path" actions.

### Supported Formats (Current Baseline)

**Images (input):** Any `image/*` (browser decodes via Canvas).
**Images (output):** JPG, PNG, WebP (Canvas encoding limits).
**PDF:** PDF 1.4-1.7 common subset.
**Archives:** ZIP (create and extract), TAR (extract only, plain `.tar`, not `.tar.gz`).
**Video:** MP4, MOV, WebM (audio extraction, compression via FFmpeg.wasm).
**Audio:** MP3, WAV, M4A/AAC.

Exact codec support depends on engine capabilities. Document limitations clearly in UI.

### Large Files
- Soft limit: 200 MiB (warning displayed).
- Hard limit: 1 GiB (rejected).
- Desktop: higher limits may be possible with native processing. Document any changes separately.

---

## 10. Conversion Requirements

- Each conversion is a pure function of (input, options) > (output, metadata).
- Options are tool-specific and minimal by default.
- Progress callbacks mandatory for media and large PDF/archive jobs.
- Cancellation token support.
- Output must be validated before success state.

---

## 11. Progress and Job Management

| State | Description | UI |
|-------|-------------|-----|
| Pending | Queued, not started | "Waiting..." |
| Processing | Active | Progress bar + percentage / stage message |
| Completed | Success + validated output | Success card + Open / Copy / Save |
| Failed | Error with message | Error card + Retry / Dismiss |
| Cancelled | User or system cancelled | Neutral message + optional retry |

- Desktop: support concurrent jobs with configurable limits (e.g., 1 heavy + 3 light).
- Job list visible in History and as a global progress indicator.
- Queue panel for managing multiple jobs.

---

## 12. Error Handling

| Scenario | User Message | Behavior |
|----------|-------------|----------|
| Unsupported format | "This file format isn't supported yet." | Early reject + suggest alternatives |
| Corrupted / unreadable | "We couldn't read this file." | Fail fast, no partial output |
| Insufficient storage | "Not enough storage space." | Estimate before start where possible |
| Permission denied | "File access permission is required." | Prompt for permission |
| Conversion engine error | "The file couldn't be converted. Try again or choose a different format." | Log details, offer retry |
| Cancelled | "Conversion cancelled." | Clean temp, return to previous screen |
| Output invalid | "Something went wrong creating the file." | Treat as Failed, clean |
| Archive bomb detected | "Archive exceeds safe limits — aborted for safety." | Reject with explanation |
| Password-protected PDF | "This file is password-protected and cannot be processed." | Clear message, no retry |

All errors must be non-destructive to original files.

---

## 13. Desktop Features Detail

### 13.1 Windows Installer
- NSIS or MSI installer for Windows.
- Start Menu shortcut (required).
- Desktop shortcut (optional, user choice during install).
- Installation directory selection where supported.
- Version information displayed.
- Proper uninstaller that removes application files, shortcuts, and application data.
- Uninstaller must NOT delete user-generated output files.

### 13.2 Auto-Update
- Check for updates on startup (optional, user-controlled).
- Manual "Check for Updates" in Settings.
- Show update availability with changelog.
- Download update with progress.
- Install update (prompt for restart).
- Handle failed downloads gracefully.
- User can dismiss/skip updates (not forced).

### 13.3 Native File Dialogs
- `dialog.showOpenDialog()` for file selection.
- `dialog.showOpenDialog()` with `properties: ['openDirectory']` for folder selection.
- `dialog.showSaveDialog()` for Save As.
- File type filters per tool.
- Multi-selection support.

### 13.4 Drag and Drop
- HTML5 drag-and-drop API in renderer.
- Visual feedback on drag-over (highlight drop zone).
- Accept files and folders.
- Validate file types on drop.
- Show size warnings for large files.
- Consistent behavior across all file-based tools.

### 13.5 Windows Notifications
- Electron `Notification` API.
- Events: processing completed, processing failed, batch completed, update available.
- No sensitive file content in notifications.
- Toggle in Settings.

### 13.6 Clipboard Integration
- `navigator.clipboard.writeText()` for developer tool outputs.
- Standard keyboard shortcuts within the application.
- Copy button on developer tool results.
- Copy file path from result cards.

### 13.7 Processing Queue
- Visual queue panel showing all active and recent jobs.
- Per-job: status, progress, file name, cancel/retry buttons.
- Queue persists during session (in-memory).
- Failed jobs show error summary and retry option.

### 13.8 Overwrite Protection
- Before writing output, check if file exists.
- If exists: show confirmation dialog or auto-rename with suffix.
- Default: auto-rename (append `_1`, `_2`, etc.).
- User can configure preference in Settings.

### 13.9 Open Output
- After successful processing:
  - "Open File" — opens with system default application
  - "Open Folder" — opens containing folder in Explorer
  - "Copy Path" — copies full file path to clipboard

---

## 14. Permissions

### Current (Web/PWA)
- **File read** — required to select inputs.
- **File write** — required to save outputs (via File System Access API or download).
- **Notifications** (optional) — for long-running job completion.

### Desktop (Electron)
- **File system read/write** — granted via native file dialogs (user explicitly selects files/folders).
- **Notifications** — requested via Electron Notification API.
- Camera / microphone — not required.
- Request only when needed; explain why.

---

## 15. Privacy

- Zero file content leaves the device for all V1 features.
- Temporary files deleted after job completion or on next launch.
- History contains only local metadata and paths; user can clear at any time.
- No third-party analytics SDKs that collect file names or content.
- Optional privacy-friendly usage analytics only if explicitly opted-in.
- Privacy policy must state local processing clearly.
- No account required for core functionality.
- Desktop: no telemetry sent without explicit consent.

---

## 16. Monetization

Recommended model:
- **Free core** with all V1 tools.
- **Optional one-time purchase or low annual "Pro"** unlocks:
  - Higher file size limits
  - Advanced options
  - Priority support / early access
- No ads in the main conversion flow.
- No dark patterns.
- Exact pricing and feature gates decided later; architecture must support feature flags.

---

## 17. Success Metrics

- Task completion rate (started > successful save) > 90% for supported formats.
- Median time from file select to operation start < 5 seconds.
- Crash-free sessions > 99.5%.
- Support tickets related to "file uploaded somewhere" = 0.
- Desktop: app store rating >= 4.6 with privacy and reliability as common praise.

---

## 18. Assumptions and Constraints

**Assumptions**
- Primary target: Windows desktop (Electron) with modern browsers as secondary.
- FFmpeg native binary or WASM is acceptable for media processing.
- Users accept reasonable file-size limits for client-side processing.
- DESIGN.md is the single source of truth for visual design.

**Constraints**
- No server-side conversion in V1.
- All libraries must be compatible with commercial distribution (MIT, Apache, etc.).
- Desktop: application must not require administrator privileges for normal operation.

**Unresolved Risks**
- Electron binary size (minimize with tree-shaking, compression).
- FFmpeg native binary size and licensing.
- Native image processing library choice (sharp vs node-canvas).
- Windows notification reliability across versions.
- Auto-update code signing requirements.

---

## 19. Document Hierarchy and References

- **Architecture.md** — system architecture, current and target.
- **DESIGN.md** — visual source of truth (colors, type, components, radii, shadows).
- **Features.md** — detailed feature specifications.
- **Sitemap.md** — information architecture and screens.
- **Phases.md** — implementation roadmap and Electron migration plan.
- **Instruction.md** — rules for coding agents.

This PRD defines *what* and *why*. Implementation details live in the companion documents.
