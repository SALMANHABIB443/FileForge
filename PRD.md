# Product Requirements Document (PRD)
**Product:** FileForge  
**Version:** 1.0 (Documentation Foundation)  
**Last Updated:** 2026-09-14  
**Status:** Draft for Implementation  

---

## 1. Product Overview

### 1.1 Product Name
**FileForge** (working title). Final branding may evolve; treat as placeholder.

### 1.2 Product Concept
FileForge is an all-in-one, privacy-first file utility toolbox that lets users perform everyday file operations—conversion, compression, extraction, merging, splitting, resizing, and lightweight developer utilities—entirely on-device whenever technically feasible.

Core workflow:  
**Select file(s) → Choose operation → Configure (only when needed) → Process → Save / Share**

The product replaces the need for dozens of single-purpose converter apps or websites that upload private files to remote servers.

### 1.3 Product Vision
Become the default local file toolbox for students, creators, office workers, and developers who value speed, privacy, and reliability over cloud-dependent tools.

### 1.4 Product Goals
- Make the most common file tasks (video → audio, image conversion/compression, PDF merge/split, ZIP create/extract) effortless and reliable.
- Guarantee that user files never leave the device unless the user explicitly chooses a cloud-dependent feature (none planned for MVP/V1).
- Deliver a premium, monochromatic, developer-tool aesthetic consistent with Design.md.
- Provide clear progress, robust error handling, and safe temporary-file lifecycle.
- Ship a focused MVP that feels complete, then expand in measured phases.

---

## 2. Problem Statement

Users currently face:
- Fragmented tooling: separate apps/websites for video conversion, PDF tools, image compression, archive handling.
- Privacy risk: most free converters upload files to remote servers.
- Poor UX: multi-step wizards, confusing options, unclear progress, failed large-file jobs with no recovery.
- Performance and reliability issues on mobile and constrained devices.
- Lack of a single, trustworthy, offline-capable toolbox with consistent quality.

FileForge solves this by consolidating high-value operations into one modern, offline-first application with a single coherent UX.

---

## 3. Target Users

Realistic primary audiences (no fictional extreme personas):

| Segment | Needs | Priority |
|---------|-------|----------|
| Students & researchers | Convert lecture videos to audio, compress PDFs/images, merge notes | High |
| Content creators & social media users | Extract audio, compress video/images, create GIFs, resize for platforms | High |
| Office / knowledge workers | PDF merge/split/compress, image → PDF, basic archives | High |
| Developers & technical users | File info, Base64/Hash/JSON utilities, quick format conversions | Medium |
| General smartphone / desktop users | Occasional conversion, compression, ZIP without installing multiple apps | Medium |

Secondary: power users who want batch or advanced options (later phases).

---

## 4. Core Value Proposition

- **One app, many tools** – no need to hunt for separate converters.
- **True offline / local processing** – files stay on device.
- **Simple, fast workflow** – select → act → done.
- **Premium, calm UI** – monochromatic, high-quality, non-gimmicky (follows Design.md).
- **Reliable & transparent** – clear progress, honest error messages, safe cleanup.
- **Expandable** – architecture supports adding new tools without redesigning the core experience.

---

## 5. Product Principles

1. **User-first** – Prefer the shortest path: select file → compatible actions appear → convert. Minimize configuration screens.
2. **Offline-first** – Local processing is the default and preferred path. Cloud is only considered for features that are impossible locally and must be explicitly labeled.
3. **Privacy by design** – No silent uploads. Temporary files are cleaned. Metadata handling is transparent. History is local and deletable.
4. **Reliability** – Graceful handling of unsupported formats, corrupted files, large files, low storage, permission denials, cancelled jobs, and engine failures.
5. **Performance awareness** – Respect device limits (memory, CPU, battery, storage). Provide cancellation, progress, and size warnings.
6. **Focused scope** – Every feature must belong to a clear category and deliver clear user value. No feature bloat.
7. **Design consistency** – All UI follows Design.md (colors, radii, typography, shadows, components). No deviations without explicit design update.

---

## 6. Feature Scope

### 6.1 MVP (Must Have – Phase 1)
- Universal file picker + file-type detection
- Image: JPG ↔ PNG ↔ WebP conversion, compression, resize
- PDF: merge, split (by page range), basic compression, images → PDF
- Archive: create ZIP, extract ZIP
- File information (size, type, dimensions/duration where applicable, basic metadata)
- Job queue with progress, cancel, retry
- History (local, limited)
- Settings (storage location preference where possible, cleanup, about, privacy)
- Core error & empty states
- Responsive layout matching Design.md

### 6.2 V1 (Near-term after MVP)
- Video → MP3 / WAV (audio extraction)
- Basic video compression / resolution change (where FFmpeg.wasm or native allows)
- Audio conversion (MP3 ↔ WAV ↔ M4A) and bitrate adjustment
- Image crop / rotate / quality fine control
- PDF → images (JPG/PNG)
- PDF rotate / reorder pages
- Multiple images → PDF with simple ordering
- Recent files / quick actions on Home
- Basic batch support for images and PDF merge

### 6.3 V1.1 / V2
- Video → GIF, video trimming, mute
- Advanced audio (trim, merge, sample-rate)
- PDF password protect / unlock (where library support + legal clarity exists)
- Archive: TAR, 7Z (extract where licensing permits), RAR extract (platform-dependent)
- Developer utilities: JSON formatter/minifier, Base64 encode/decode, Hash (MD5/SHA), UUID, URL encode/decode, simple JWT decode
- Batch rename, duplicate detection
- File System Access API enhancements (Chrome/Edge)
- Background processing improvements

### 6.4 Future / Optional
- Cloud sync of history only (never files) – opt-in
- Advanced video filters / hardware acceleration
- OCR on images/PDFs
- Document translation or AI summarization (explicitly cloud, labeled)
- Cross-device history via account (optional, privacy-preserving)

### 6.5 Explicitly Out of Scope (Current Product)
- Full video editing suite (timeline, effects, multi-track)
- Online file storage / cloud drive replacement
- Social sharing integrations beyond native share sheet
- Aggressive analytics or advertising
- DRM removal or copyright-circumvention features
- Password cracking or security research tools
- Real-time collaboration
- Server-side conversion as default path

---

## 7. Functional Requirements

### 7.1 File Selection & Detection
- Support single and multi-file selection via native picker or drag-and-drop (desktop/web).
- Detect MIME type + extension; fall back to content sniffing where safe.
- Show file preview (thumbnail for images/video, icon + metadata for others) before operation selection.
- Reject or warn on obviously unsupported or dangerous files early.

### 7.2 Universal Convert Entry
- After selecting a file, present only compatible operations based on detected type.
- Example: MP4 → Audio (MP3/WAV), GIF, Compress, Extract frames, File Info.
- Example: PNG → JPG, WebP, Compress, Resize, PDF, File Info.
- Fallback: “Open in Tools” if no direct conversion.

### 7.3 Conversion / Operation Engine
- Each tool is a discrete, testable module behind a common job interface.
- Input validation, temporary workspace, progress reporting, cancellation support, output validation, cleanup.

### 7.4 Job Management
- States: Pending → Processing → Completed | Failed | Cancelled
- Unique Job ID, timestamps, progress (0–100% or indeterminate), error message, input/output paths.
- Single concurrent heavy job recommended for MVP (video/audio); light jobs (image/PDF) may run in parallel with limits.
- Retry from Failed state where safe.
- Cancel cleans temporary files.

### 7.5 History
- Local-only list of recent jobs (configurable limit, e.g. last 50).
- Show status, input name, output name, date, size.
- Actions: open result, share, delete entry, re-run with same settings (where possible).
- Clear all / auto-expire old entries.

### 7.6 Settings
- Preferred output location (Downloads / custom via File System Access API where available).
- Temporary file cleanup policy.
- History retention.
- Theme follows system / Design.md light theme only for MVP.
- About, Privacy statement, Support / Feedback, Version.
- Permission status indicators.

### 7.7 Sharing & Saving
- Native share sheet / system save dialog.
- Default filename derived from original + operation + timestamp or counter to avoid collisions.
- Option to open containing folder (desktop).

---

## 8. Non-Functional Requirements

### 8.1 Performance
- Image operations: < 2 s for typical photos on mid-range devices.
- PDF merge/split of reasonable documents: < 5 s.
- Video audio extraction: progress visible; warn for files > 500 MB or > 10 min.
- Memory: avoid loading entire large videos into RAM; stream where possible.
- Battery: pause or warn on low battery for long jobs.
- Cancellation must be responsive (< 1 s).

### 8.2 Reliability
- No silent failures. Every failure produces a user-visible message + optional technical detail for logs.
- Temporary files always cleaned on success, cancel, or crash recovery (on next launch).
- Output files validated (existence, non-zero size, basic header check) before marking Completed.

### 8.3 Security & Privacy
- All processing client-side for MVP/V1 features.
- No network requests that transmit user file content.
- Sanitize filenames; prevent path traversal on extract.
- Limit archive extraction size and nesting depth (zip-bomb protection).
- Temporary workspace isolated and cleaned.
- History stores only metadata + local paths, never file contents.
- Clear privacy statement in Settings.

### 8.4 Accessibility
- Follow WCAG 2.1 AA where practical.
- Sufficient contrast (Design.md already high-contrast monochrome).
- Touch targets ≥ 44 px.
- Screen-reader labels on all interactive elements and progress.
- Respect reduced-motion preference (disable non-essential animations).
- Font scaling support.

### 8.5 Scalability & Maintainability
- Modular tool architecture: new tools register themselves with category, supported inputs, UI config schema.
- Shared job runner, progress, error, and storage services.
- Clear separation: UI → Feature Service → Engine Adapter → File System.

### 8.6 Storage
- Prefer user-visible Downloads / chosen folder.
- Temporary directory managed by app; auto-clean.
- Warn when free space < estimated output size × 1.5.
- History and settings in local storage / IndexedDB / app sandbox.

### 8.7 Battery & Resource
- Long-running jobs show estimated impact and allow background continuation only where platform permits safely.
- Prefer hardware acceleration when available (FFmpeg, platform APIs).

---

## 9. File Processing Requirements

### Input Handling
- Accept files via picker, drag-drop, share-sheet (mobile), or File System Access API.
- Copy or stream into temporary workspace; never modify original unless user chooses “replace”.
- Record original name, size, MIME, last-modified for history and naming.

### Temporary Workspace
- Isolated directory or in-memory / OPFS (Origin Private File System) where available.
- Unique subfolder per job.
- Cleaned on job end or on next app start for orphaned jobs.

### Output Handling
- Default location: user Downloads or last-used folder.
- Filename strategy: `{originalBase}_{operation}_{timestampOrCounter}.{ext}`
- Conflict: append counter or let user choose.
- After success, present “Save / Share / Open” actions.
- Optionally move from temp to final location only after validation.

### Supported Formats (MVP baseline – expand later)
**Images:** JPG/JPEG, PNG, WebP (input & output). HEIC/HEIF read-only where platform supports.  
**PDF:** PDF 1.4–1.7 common subset.  
**Archives:** ZIP (create & extract).  
**Video (V1):** MP4, MOV, WebM (audio extraction primary).  
**Audio (V1):** MP3, WAV, M4A/AAC.  

Exact codec support depends on engine (FFmpeg.wasm or native); document limitations clearly in UI.

### Large Files
- Soft limit warnings (configurable, e.g. 1 GB video, 50 MB image for pure browser).
- Hard limits only for memory safety.
- Progress and cancel mandatory for any job expected > 3 s.

---

## 10. Conversion Requirements

- Each conversion is a pure function of (input path/blob, options) → (output path/blob, metadata).
- Options are tool-specific and minimal by default (sensible defaults, advanced collapsed).
- Progress callbacks mandatory for media and large PDF/archive jobs.
- Cancellation token support.
- Output must be validated before success state.

---

## 11. Progress & Job Management

| State | Description | UI |
|-------|-------------|----|
| Pending | Queued, not started | “Waiting…” |
| Processing | Active | Progress bar or spinner + percentage / stage |
| Completed | Success + validated output | Success card + Save/Share |
| Failed | Error with message | Error card + Retry / Dismiss |
| Cancelled | User or system cancelled | Neutral message + optional retry |

- Only one heavy media job at a time in MVP.
- Light jobs (image, simple PDF, ZIP) may queue or run concurrently up to a small limit (e.g. 3).
- Job list visible in History and optionally as a global progress indicator.

---

## 12. Error Handling

Major scenarios and expected behavior:

| Scenario | User Message (example) | Behavior |
|----------|------------------------|----------|
| Unsupported format | “This file format isn’t supported yet.” | Early reject + suggest alternatives |
| Corrupted / unreadable | “We couldn’t read this file.” | Fail fast, no partial output |
| Insufficient storage | “Not enough storage space.” | Estimate before start where possible |
| Permission denied | “File access permission is required.” | Prompt for permission |
| Conversion engine error | “The file couldn’t be converted. Try again or choose a different format.” | Log details, offer retry |
| Cancelled | “Conversion cancelled.” | Clean temp, return to previous screen |
| Output invalid | “Something went wrong creating the file.” | Treat as Failed, clean |
| Network (if any future) | Explicitly labeled; never silent | N/A for MVP |

All errors must be non-destructive to original files.

---

## 13. Permissions

- **File read / photo library / media library** – required to select inputs.
- **File write / Downloads / storage** – required to save outputs.
- **Notifications** (optional) – for long-running job completion when app backgrounded.
- **Camera / microphone** – not required for core product.
- Request only when needed; explain why in a short pre-permission screen if platform requires.

---

## 14. Privacy

- Zero file content leaves the device for all MVP and V1 features.
- Temporary files deleted after job completion or on next launch.
- History contains only local metadata and paths; user can clear at any time.
- No third-party analytics SDKs that collect file names or content.
- Optional privacy-friendly usage analytics (feature usage counts, crash reports) only if explicitly opted-in or fully anonymized and documented.
- Privacy policy must state local processing clearly.
- No account required for core functionality.

---

## 15. Analytics

Privacy-friendly only:
- Aggregate feature usage (which tools are used most) – optional, anonymized.
- Crash / error reporting (Sentry-like, no file content).
- No session recording, no file name logging, no user identification unless user creates an optional account later.
- Default: analytics off or minimal.

---

## 16. Monetization

Recommended model for sustainability without harming trust:
- **Free core** with all MVP/V1 offline tools.
- **Optional one-time purchase or low annual “Pro”** unlocks:
  - Higher file size limits
  - Batch processing
  - Advanced options (custom FFmpeg presets, more formats)
  - Priority support / early access
  - Optional cloud history sync (never files)
- No ads in the main conversion flow.
- No dark patterns.
- Alternative: completely free + donation / tip jar if open-source path is chosen.

Decision for documentation: Free with optional Pro unlock. Exact pricing and feature gates decided later; architecture must support feature flags.

---

## 17. Success Metrics

- Task completion rate (started conversion → successful save) > 90 % for supported formats.
- Median time from file select to operation start < 5 s.
- Crash-free sessions > 99.5 %.
- Retention: Day-7 > 25 %, Day-30 > 12 % (for utility apps).
- Feature adoption: top 5 tools account for > 70 % of usage (focus signal).
- Support tickets related to “file uploaded somewhere” = 0.
- App store rating ≥ 4.6 with privacy and reliability as common praise themes.

---

## 18. Assumptions & Constraints

**Assumptions**
- Primary targets: modern browsers (Chrome, Edge, Safari, Firefox) with WebAssembly + File System Access API where available, plus potential Electron/Tauri or Flutter wrappers later.
- FFmpeg.wasm (or equivalent) is acceptable for media; binary size and memory limits are known and must be handled with warnings.
- Users accept reasonable file-size limits for pure client-side processing.
- Design.md is the single source of truth for visual design.

**Constraints**
- No server-side conversion in MVP/V1.
- Must remain usable on mid-range phones for image/PDF/ZIP; video may be desktop-preferred or heavily warned.
- Licensing: all libraries must be compatible with commercial distribution (MIT, Apache, etc.). Avoid GPL for core engines if possible, or isolate.

**Unresolved Risks**
- FFmpeg.wasm performance and memory on large 4K videos.
- HEIC support consistency across platforms.
- Zip-bomb and malicious archive handling edge cases.
- Browser memory limits vs. native app performance gap.

---

## 19. Document Hierarchy & References

- **Design.md** – visual source of truth (colors, type, components, radii, shadows). Do not contradict.
- **Features.md** – detailed feature specifications.
- **Sitemap.md** – information architecture and screens.
- **Phases.md** – implementation roadmap.
- **Instruction.md** – rules for coding agents.

This PRD defines *what* and *why*. Implementation details live in the companion documents.
