# Phases.md — Development Roadmap

**Product:** FileForge  
**Last Updated:** 2026-09-15  

This roadmap is dependency-aware and prioritizes a solid, privacy-first MVP before expanding media capabilities. Each phase has clear exit criteria. Do not start a later phase until the previous phase’s exit criteria are met.

---

## Phase 0 — Foundation

**Goal:** Establish a clean, maintainable project skeleton that matches Design.md and supports the architectural principles in Instruction.md and PRD.md.

**Features / Work Items:**
- Project setup (React + TypeScript + Tailwind v4 + shadcn-style components, or chosen equivalent stack)
- Design tokens and base components from Design.md (colors, radii, typography, buttons, cards, inputs, badges)
- File system abstraction (picker, temporary workspace, output handling, cleanup)
- Job system core (create, status, progress, cancel, basic runner)
- Tool Registry skeleton
- Local storage / IndexedDB for settings and history metadata
- Basic routing / navigation shell (Home, Tools, History, Settings)
- Error boundary and global error messaging patterns
- Permission request helpers
- Logging / crash reporting stub (privacy-friendly)

**Dependencies:** None (starting point).  
**Deliverables:**
- Runnable app shell with Design.md styling
- Empty but navigable main screens
- Job and File service interfaces defined and unit-tested
- Temporary file create/clean cycle working

**Testing:**
- Unit tests for Job state machine and filename utilities
- Manual verification that Design.md tokens are applied
- Temp file cleanup on simulated crash/restart

**Exit Criteria:**
- App launches, navigates between four main tabs
- Design tokens match Design.md
- Can create a dummy job that reports progress and cleans up
- No network calls that send file content
- Documentation (PRD, Features, Sitemap, Instruction) reviewed and consistent

**Risks:** Over-engineering the foundation; keep it minimal.

---

## Phase 1 — Core MVP

**Goal:** Deliver a usable, reliable set of high-value offline tools that already solve real daily problems.

**Features:**
- Universal File Picker + type detection + File Preview / Operation Chooser
- Image Convert (JPG ↔ PNG ↔ WebP)
- Image Compress
- Image Resize
- Images → PDF
- PDF Merge
- PDF Split (page ranges + every page)
- Basic PDF Compress
- Create ZIP
- Extract ZIP (with zip-bomb protections)
- File Information
- Full Job progress UI, cancellation, success/error states
- History list + basic detail + delete / clear
- Settings (storage preference, cleanup, about, privacy statement)
- Home with drop zone, recent, and popular tools
- Tools catalog with search and categories

**Dependencies:** Phase 0 complete.  
**Deliverables:**
- All MVP features listed in PRD.md and Features.md working end-to-end
- Consistent error messages and empty states
- History and temp cleanup reliable
- Responsive layout matching Design.md

**Testing:**
- Integration tests for each engine with sample files
- Manual tests on mid-range devices for image/PDF/ZIP
- Cancellation and storage-full scenarios
- Accessibility smoke test (labels, contrast, targets)
- No leftover temporary files after success/cancel/fail

**Exit Criteria:**
- A user can select a photo, convert or compress it, and save the result
- A user can merge two PDFs or create/extract a ZIP reliably
- History shows the last operations and allows re-opening results
- App feels complete and trustworthy for the MVP scope
- All Phase 1 features pass the Completion Checklist in Instruction.md

**Risks:** PDF library limitations on compression quality; ZIP safety edge cases. Document realistic expectations in UI.

---

## Phase 2 — Media (Video & Audio)

**Goal:** Add the highest-demand media features while keeping memory and performance under control.

**Features:**
- Video → MP3 / WAV (audio extraction) ✅
- Basic audio conversion (MP3 ↔ WAV ↔ M4A) and bitrate control ✅
- Video compress / simple resolution change (with strong size/time warnings) ✅
- FFmpeg.wasm integration, lazy-loaded ✅ (`@ffmpeg/ffmpeg` code-split; single-thread core self-hosted in `public/ffmpeg/`)
- Progress reporting from media engine ✅ (FFmpeg progress → percentage + stage message)
- Large-file warnings and soft limits ✅ (200 MB warn threshold, 1 GB hard cap)
- Updated Tool Registry and Universal Convert surface for media files ✅ (video/audio categories)
- History support for media jobs ✅ (via existing JobRunner → HistoryService)

**Status:** Implemented 2026-09-14. Manual verification on real MP4/MOV/WebM samples and memory monitoring still required before marking Phase 2 complete.

**Dependencies:** Phase 1 complete; Job system proven with lighter tools.  
**Deliverables:**
- Working audio extraction from common video containers
- Clear user warnings for large or long files
- Cancellation works during media jobs (single-thread core: the UI cancels immediately and `terminate()` stops the worker; true mid-op WASM stop needs the multi-thread core + COOP/COEP and is deferred)
- Binary size and load-time impact measured and acceptable (core ~32 MB fetched once from same origin on first media job; wrapper lazy chunk ~437 KB)

**Testing:**
- Unit: arg builders, codec/bitrate/resolution mapping, media size limits ✅
- Real MP4/MOV/WebM samples of varying length (manual)
- Memory monitoring on target devices (manual)
- Cancel mid-conversion (manual)
- Unsupported codec paths (manual)
- Battery impact observation (manual)

**Exit Criteria:**
- User can extract MP3 from a typical phone video and save it
- Progress is visible and cancellation responsive
- No silent OOM or browser crashes on reasonable files (limits documented: ≥1 GB rejected, ≥200 MB warned)
- Features.md and PRD media sections updated with actual supported formats

**Risks:** FFmpeg.wasm memory and performance on mobile; codec coverage gaps. Prefer desktop-quality experience first; add mobile guards.

---

## Phase 3 — Image & PDF Expansion

**Goal:** Deepen the strongest MVP categories.

**Features:**
- Image crop / rotate (interactive drag-box crop + 0/90/180/270 rotation) ✅
- PDF → Images (JPG/PNG, scale 1–3×, page range, ZIP for multiple pages) ✅
- PDF rotate / reorder pages (global rotation + reorderable page list) ✅
- Multiple images → PDF with improved ordering (reorder panel) ✅
- Better image metadata / EXIF strip option (exifreader lazy-loaded) ✅
- Batch support for image convert/compress/resize (ZIP when 2+ files) ✅
- Improved before/after size previews (success card shows input → output + %) ✅
- New dependencies: `pdfjs-dist` (Apache-2.0, lazy-loaded, worker self-hosted as Vite asset) and `exifreader` (MPL-2.0, lazy-loaded, used only for JPEG/WebP metadata; no modifications made, so MPL obligations are limited to distributing the library itself if redistributed)

**Status:** Implemented 2026-09-14. Manual verification still required: crop accuracy on different aspect ratios, batch ZIP of many images, PDF→JPG on multi-page documents, reorder persistence, and EXIF viewer on JPEG photos.

**Dependencies:** Phase 1 (and Phase 2 for overall stability).  
**Deliverables:** Polished image and PDF toolset covering common document and photo tasks.

**Testing:**
- Unit: image batch ZIP, crop math/rotation, pdf organize order/rotation, formatSizeComparison ✅
- Manual: crop accuracy, batch ZIP, PDF→Images multi-page, PDF reorder/rotate, EXIF viewer + strip, before/after previews, large PDF page-count limit

**Exit Criteria:**
- User can crop a photo by dragging a region and save the result
- Multi-image batch produces a valid ZIP; single image returns the image directly
- PDF pages can be reordered and rotated, then saved as a new PDF
- PDF→Images produces correct images for a real multi-page PDF
- EXIF metadata (camera, date) is visible in File Information for JPEGs
- Success cards show original → output size comparison
- All Phase 3 features listed in Features.md work and match Design.md

**Risks:** pdfjs rendering performance on complex PDFs; keep DPI default conservative (scale 2×). Interactive crop pointer math across varying image aspect ratios. Canvas re-encode strips metadata by default; keep-metadata path works only for JPEG (PNG/WebP always strip). exifreader is MPL-2.0 — license applies to distribution of the library, not to app output; no modifications made.

---

## Phase 4 — Archive & File Tools Polish

**Goal:** Strengthen archive handling and general utilities.

**Features:**
- Improved ZIP extract (content preview, selective extract) ✅ (`ZipPreviewPanel` + `selectedEntries` option; same zip-bomb guards apply)
- Additional archive formats where licensing and technical support allow: **TAR extract** implemented (pure-JS parser, no new dependency; same size/path/nesting safety limits; extract-to-folder via File System Access API or fallback re-package as ZIP) ✅. 7Z/RAR not implemented — prefer open formats first
- Batch rename (basic) ✅ (`batch-rename` tool — prefix/suffix/find-replace/sequential modes with live preview panel; single file returns renamed copy, multiple files return a ZIP of renamed files)
- Duplicate detection (simple hash-based) ✅ (`duplicate-detect` instant tool — SHA-256 via `crypto.subtle`, groups files with identical content)
- Enhanced File Information (more metadata) ✅ — added SHA-256 hash for all files, duration/bitrate for MP3/WAV/MP4/MOV (header parsing, no FFmpeg load), PDF page count via lazy-loaded pdf-lib

**Status:** Implemented 2026-09-14. Manual verification still required (see Testing).

**Dependencies:** Phase 1.  
**Deliverables:** More complete archive story and useful general file utilities.

**Testing:** Nested archives, long paths, zip-bomb attempts, large numbers of small files. ✅ Unit tests added for TAR safety predicates, rename math, and duplicate grouping. Manual verification items below remain.

**Exit Criteria:** Extract and create remain safe; new utilities are discoverable in Tools catalog.

**Risks:** Licensing for RAR/7Z; prefer open formats first.

---

## Phase 5 — Developer Utilities

**Goal:** Add lightweight, high-delight tools for technical users without expanding scope dramatically.

**Features:**
- JSON formatter / minifier ✅ (`json-format` — format/minify modes with indent control; reject invalid JSON)
- Base64 encode / decode ✅ (`base64-convert` — UTF-8 safe on both directions)
- Hash generators (SHA-256, SHA-512) ✅ (`hash-generate` — via `crypto.subtle`; MD5 intentionally omitted, deprecated)
- UUID generator ✅ (`uuid-generate` — 1–100 v4 UUIDs via `crypto.randomUUID`)
- URL encode / decode ✅ (`url-convert` — `encodeURIComponent`/`decodeURIComponent`)
- Simple JWT decoder (display only) ✅ (`jwt-decode` — header + payload, no signature verification)
- Timestamp converter ✅ (`timestamp-convert` — seconds/ms input, ISO/local/UTC output)
- Optional: YAML ↔ JSON, CSV ↔ JSON (deferred until demand confirmed)

All developer tools use the `developer` category and a shared text-based workspace (`developer-tool-workspace`) with instant, copyable results.

**Dependencies:** Phase 0–1 (pure JS, low risk). Can be parallelized earlier if capacity allows.  
**Deliverables:** A “Developer” category in Tools with instant, copyable results.

**Status:** Implemented 2026-09-14. Manual verification still required (see Testing).  
**Testing:** Edge cases covered by unit tests (`src/tools/developer-tools.test.ts`): invalid JSON, large/empty inputs, malformed Base64, non-UTF-8 decode, SHA-256/SHA-512 known vectors, JWT structure/segment failures, non-numeric timestamps, UUID count clamping. Manual verification items below remain.

**Exit Criteria:** Tools are fast, accurate, and follow Design.md form patterns.

---

## Phase 6 — Polish, Performance & Accessibility

**Goal:** Raise quality to production standards.

**Work Items:**
- Performance profiling and optimization — ✅ route-level `React.lazy` + `<Suspense>`; `lazyEngine()` helper defers engine imports until a tool runs (verified: ~20 lazy chunks — 5 page routes + tool/engine/asset chunks — instead of one monolith; zip/rename engines stay in the main bundle because their preview panels import them statically); File-Info SHA-256 now computed on demand (`computeFileHash`) instead of eagerly; Geist fonts self-hosted (`public/fonts/`) removing the CDN font fetch
- Full accessibility pass — ✅ `:focus-visible` ring, `prefers-reduced-motion` disabled animations, skip-to-content link, `aria-current`, `aria-hidden` decorative SVGs/emoji, `aria-pressed` toggles, `role="progressbar"` + `aria-live`/`role="alert"` regions (JobProgress, error cards, ZIP/PDF panels, search results), `htmlFor`/`id` label associations, keyboard-nudgeable crop box (arrow keys, Shift for 10× — 4 px / 40 px steps), ≥44px touch targets (all Button sizes + inline toggles since 2026-09-15 audit), `aria-expanded` history rows
- Refined empty / error / loading states and microcopy — ✅ Home/History/workspace loading + error (+"Try again" on Home & History) + empty states, developer workspace busy state with `disabled` controls
- Background job continuation improvements where platform allows — ✅ workspace restores an in-flight job for its tool; global floating job indicator (`GlobalJobIndicator`) shows progress across pages and a "View → History" affordance
- Memory leak and temp-file audit — ✅ `deleteJob` now aborts its controller and revokes `outputUrl`; dead temp-file helpers removed from FileService; duplicate history write removed (job-runner already records completion — workspace no longer re-records)
- Crash recovery improvements — ✅ `pagehide` aborts running jobs and sets an interruption marker; `InterruptedBanner` shows after reload navigating to folder-extract is best-effort
- Internationalization preparation — ⏳ deferred (not planned for initial release)
- Feature flag system for Pro / experimental tools — ✅ infrastructure only (`src/services/flags-service.ts`) with an "Advanced" panel in Settings exposing experimental flags; no monetization gating yet

**Also in Phase 6 ✅:**
- ZIP/TAR folder extraction rollback — files already written to the picked folder are best-effort removed if extraction fails or is cancelled mid-way
- History is pruned to the newest 200 entries; Settings gained auto-cleanup (age-based pruning) controls
- Storage pressure warning — workspace checks `navigator.storage.estimate()` before running a job (awaited, so the warning renders before the job starts) and alerts when usage + input ≥ 80% of quota

**Status:** Implemented 2026-09-15 and audited same-day. `npx tsc -b`, `npm run lint`, `npm test` (159 passing), and `npm run build` (vite ~6–13s, cleanly split chunks) all pass. Audit fixes shipped: duplicate history record removed, storage check awaited pre-run, all touch targets ≥44 px, Home "Try again", crop Shift = 10× (40 px step), corrected chunk-count claim. Manual QA on real devices/browsers still required before marking Phase 6 complete. Deferred: i18n, OPFS resume, true mid-operation WASM stop (needs multi-thread core + COOP/COEP), numeric fallback inputs for crop box (keyboard nudges shipped instead).

**Dependencies:** Core features from previous phases.  
**Deliverables:** Measurable improvements in speed, stability, and inclusivity.

**Testing:** Accessibility audit tools, performance benchmarks, low-end device testing.

**Exit Criteria:** Meets non-functional requirements in PRD.md for performance, accessibility, and reliability.

---

## Phase 7 — Release Preparation

**Goal:** Ship a trustworthy first public version. Target distribution: **web PWA**.

**Work Items:**
- Privacy review and final privacy policy text — ✅ full privacy policy authored in-app (`src/data/privacy-policy.ts`), shown in Settings → Privacy (expandable); also covers local storage, temporary files, third-party services, and children's privacy
- Permissions review and just-in-time explanations — ✅ new Settings → "Permissions & capabilities" panel shows File System Access API / folder picker / OPFS / download support plus live storage-usage estimate; existing flows already request permissions just-in-time with reason strings
- Store assets (screenshots, description, privacy nutrition labels) — ✅ store description + short description + category + tags data in `src/data/store-assets.ts` (used in Settings → About); screenshot guidance list added there; actual screenshots remain a human QA task
- Release build configuration and code signing — ✅ **(web PWA path)** `vite-plugin-pwa` wired (manifest, Workbox service worker, offline caching), app icons generated (192/512/maskable/apple-touch/favicon) via `scripts/generate-icons.mjs`, production `build` block (chunk limit, ES2022 target), `__APP_VERSION__` injected from `package.json` into the UI, full meta/OG/Twitter/favicon/manifest block in `index.html`, `robots.txt` + `sitemap.xml`, 404 catch-all route. Code signing not applicable for web PWA (HTTPS + SW install model); OS package signing would apply only if a native wrapper is chosen later
- Crash / error monitoring integration (privacy-preserving) — ✅ local-only: logger persists a capped 500-entry ring buffer to IndexedDB, `ErrorBoundary` records crash snapshots (metadata only — never file contents), Settings → "Diagnostic logs" can view count, export JSON, and clear everything; nothing is ever transmitted
- Success-metrics instrumentation ready (anonymized) — ✅ opt-in "Local usage analytics" flag (off by default) tallies per-tool use in localStorage only; never transmitted; visible/clearable in Settings → "Local usage counts"
- Final QA pass across target browsers / devices — ⏳ **manual** (list in Testing below)
- Soft launch or internal beta — ⏳ **human decision** (deploy target, beta channel)
- Documentation freeze for the shipped version — ✅ Phases/PRD/Features/Sitemap/Instruction reviewed; updates to Phases.md in-progress during Phase 7

**Dependencies:** Phase 6 largely complete.  
**Deliverables:** Production PWA build ready for distribution (verified: `npm run typecheck`, `npm run lint`, `npm test` — 167 passing, `npm run build` — clean dist with manifest + SW + icons).

**Testing:**
- Unit (automated): local analytics guard/record/clear, logger persistence payload + crash snapshot + clear (167 total tests passing)
- Manual (human, still required):
  - Install PWA on Chrome/Edge (Windows/macOS) + iOS Safari (Add to Home Screen)
  - Offline load after cache warm-up; update flow when a new version is deployed
  - Privacy policy renders and is readable in Settings; diagnostic logs export/clear; permissions panel reflects the browser in use
  - Social/OG link preview on a public deployment
  - Real device battery/memory for long media jobs on iOS Safari
  - Confirm no console errors on all four tabs + a conversion flow
- Automated build smoke: dist contains `manifest.webmanifest`, `sw.js`, `workbox-*.js`, `icons/` (incl. maskable + apple-touch), `robots.txt`, `sitemap.xml`; FFmpeg wasm is runtime-cached (not precached)

**Exit Criteria:**
- No known critical bugs — ⏳ pending manual QA
- Privacy and offline claims verified — ⏳ pending manual QA
- Success metrics instrumentation ready (anonymized) — ✅ local analytics flag in place
- All MVP features stable — ✅ automated gates green

**Risks:** Platform-specific permission or File System Access API differences (documented in the new Permissions panel); plan fallbacks (download-based saves) already exist.

---

## Phase 8+ — Future Expansion

- Advanced video (trim, GIF, mute, FPS)
- Password-protected PDF operations (with clear legal/UX boundaries)
- Pro monetization gates and higher limits
- Optional account for history sync only (never files)
- Native mobile / desktop wrappers if web limitations become painful
- Additional developer or niche tools driven by real usage data

Each future item must be re-evaluated against Product Principles before commitment.

---

## Cross-Phase Rules

- Never expand scope inside a phase without updating Features.md and this document.
- Every new tool must register in the Tool Registry and appear in the correct category.
- Design.md remains the visual source of truth; no visual experiments in feature phases.
- Privacy and offline-first rules are non-negotiable.
- Prefer shipping a smaller reliable set over a larger fragile set.

---

## Summary Timeline Guidance (Approximate)

| Phase | Focus | Relative Effort |
|-------|-------|-----------------|
| 0 | Foundation | 1–2 weeks |
| 1 | Core MVP | 4–8 weeks |
| 2 | Media | 3–6 weeks |
| 3 | Image/PDF expansion | 2–4 weeks |
| 4 | Archive polish | 1–3 weeks |
| 5 | Developer tools | 1–2 weeks |
| 6 | Polish | 2–4 weeks |
| 7 | Release | 1–3 weeks |

Actual calendar time depends on team size and chosen technology. The order is more important than the calendar estimates.

This roadmap ensures the product remains focused, privacy-respecting, and technically realistic at every stage.
