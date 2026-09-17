# Sitemap.md — Information Architecture and Navigation

**Product:** FileForge
**Last Updated:** 2026-09-15
**Design reference:** DESIGN.md (warm white surfaces, soft brown accents, rounded cards, subtle shadows)

---

## 1. Main Navigation

Primary left sidebar (desktop) or bottom tab bar (mobile/web) following DESIGN.md surface hierarchy:

| Tab / Item | Icon | Purpose |
|------------|------|---------|
| **Home** | House / Grid | Quick actions, recent, popular tools, drop zone |
| **Tools** | Wrench / Catalog | Searchable full catalog by category |
| **History** | Clock / List | Past jobs and results |
| **Jobs** | List / Activity | Active (running/queued) and finished processing jobs, persistent across restarts |
| **Settings** | Gear | Preferences, privacy, about, storage |

Persistent navigation remains visible except on focused processing or full-screen result modals when appropriate.

---

## 2. Tool Categories (Tools Screen)

Logical grouping for the catalog and filters:

- **Image** — Image Convert, Image Compress, Image Resize, Image Crop and Rotate, Images to PDF
- **PDF** — PDF Merge, PDF Split, PDF Compress, PDF Organize, PDF to Images
- **Archive** — ZIP Create, ZIP Extract, TAR Extract
- **Video** — Video to Audio, Video Compress
- **Audio** — Audio Convert
- **File Tools** — Batch Rename, Find Duplicates, File Information
- **Developer** — JSON Formatter, Base64 Converter, Hash Generator, UUID Generator, URL Converter, JWT Decoder, Timestamp Converter

Each category card uses DESIGN.md card style (white, 16 px radius, hairline border, subtle shadow).

---

## 3. Screen List

### 3.1 Home

**Purpose:** Fastest path to start a conversion + surface recent activity and popular tools.
**Entry:** App launch, tab.
**Exit:** Select file > File Preview / Operation chooser; or navigate to other tabs.

**Main Components:**
- Large drop zone / "Select files" primary button
- Recent jobs (horizontal cards or list, max 5-8)
- Popular / suggested tools (grid of tool cards)
- Category shortcuts

**Empty States:**
- No recent > "Your recent conversions will appear here"
- First launch > short onboarding tip (dismissible)

**Actions:** Select files, open tool directly, clear recent.

---

### 3.2 Tools (Catalog)

**Purpose:** Complete, searchable list of all available tools.
**Entry:** Tab, or "All tools" from Home.
**Exit:** Choose tool > File select or direct config if file already chosen.

**Main Components:**
- Search input
- Category chips or sections
- Tool cards (icon, name, short description)

**Empty / Error:** Search no results > "No tools match. Try another term."

---

### 3.3 File Preview / Operation Chooser

**Purpose:** After file selection, show preview + only compatible operations.
**Entry:** From Home, Tools, share sheet, drag-drop.
**Exit:** Choose operation > Config or direct Process; Back > previous.

**Main Components:**
- File card(s): thumbnail / icon, name, size, type
- Compatible operations list (primary actions first)
- "More tools" link
- Multi-file summary when applicable

**States:** Loading detection, Ready, Unsupported.

---

### 3.4 Tool Configuration

**Purpose:** Present only necessary options with sensible defaults.
**Entry:** After choosing an operation that has options.
**Exit:** Start conversion > Processing; Back > Operation chooser.

**Main Components:**
- Option controls (sliders, selects, toggles) matching DESIGN.md
- Primary "Convert" / "Create" button
- Advanced options collapsed by default

Many simple tools skip this screen and start immediately with defaults.

---

### 3.5 Processing / Job Progress

**Purpose:** Clear feedback during conversion.
**Entry:** Start of any job.
**Exit:** Complete > Result; Cancel > previous or Home; Fail > Error state.

**Main Components:**
- Progress indicator (bar + percentage / stage text)
- File name / operation name
- Cancel button
- Optional time estimate

**Behavior:** Can be a full screen, bottom sheet, or persistent bar. User can navigate away; job continues (with global indicator). Desktop: Queue panel shows all active jobs.

---

### 3.6 Result / Success

**Purpose:** Present the output and next actions.
**Entry:** Job completed successfully.
**Exit:** Actions > system; Convert another > Home or File select; Done > History or Home.

**Main Components:**
- Success icon / check
- Output file card (name, size, type)
- Primary actions:
  - Desktop: Open File, Open Folder, Copy Path
  - Web: Save, Share, Download
- Secondary: Convert another, Delete from history

---

### 3.7 Error State (reusable)

**Purpose:** Communicate failure clearly and offer recovery.
**Entry:** Job failed or early validation error.
**Exit:** Retry, Choose different file, Dismiss.

**Main Components:**
- Error message (from PRD error matrix)
- Optional "Details" expander
- Retry button (if safe)
- Secondary actions

---

### 3.8 History

**Purpose:** Browse and manage past jobs.
**Entry:** Tab.
**Exit:** Tap item > Result / Details; Delete; Clear all.

**Main Components:**
- List of job cards (status badge, input > output names, date, size)
- Filter by status or tool (optional)
- Swipe or menu: Delete, Re-run

**Empty State:** "No history yet. Your conversions will appear here."
**Error State:** Storage failure > message + retry.

---

### 3.9 History Detail / Job Detail

**Purpose:** Full information about a past job.
**Entry:** Tap history item.
**Exit:** Back, Delete, Re-run, Open output.

---

### 3.10 Jobs / Queue

**Purpose:** View and manage active and finished processing jobs.
**Entry:** Tab.
**Exit:** Tap job > Result; Retry / Cancel / Remove.

**Main Components:**
- List of jobs grouped by status: Active (Processing, Pending), Finished (Completed, Failed, Cancelled)
- Per-job: status badge, progress bar + "File x of y", operation name
- Per-job actions: Cancel (processing/pending), Retry (failed/interrupted), Save (completed, desktop), Remove (completed/failed)
- Expandable error details: affected files (per-file reason) + technical stack
- Queue summary (active count)
- Persistent across app restarts (pending jobs auto-resume; interrupted jobs offered for retry)

**Empty State:** "No active jobs. Convert a file and it will show up here."

---

### 3.11 Settings

**Purpose:** Preferences, privacy, storage, about.
**Entry:** Tab.
**Exit:** Back to previous or Home.

**Sections:**
- Storage and Cleanup (output location preference, temp cleanup, history retention)
- Permissions status (web: browser capabilities; desktop: app permissions)
- Notifications (Desktop: toggle on/off)
- Privacy (statement link, analytics toggle if any)
- Appearance (follows system / light only for V1)
- About (version, licenses, support, feedback)
- Check for Updates (Desktop)
- Diagnostic Logs (view count, export, clear)
- Advanced (feature flags if applicable)

---

### 3.12 About

**Purpose:** Application information, credits, and licenses.
**Entry:** Settings > About.
**Exit:** Back to Settings.

**Main Components:**
- Application name and version
- Privacy policy
- Third-party licenses (from `src/data/licenses.ts`)
- Support / feedback links
- Store description (from `src/data/store-assets.ts`)

---

### 3.13 Licenses

**Purpose:** Display third-party license information.
**Entry:** Settings > About > Licenses.
**Exit:** Back to About.

**Main Components:**
- List of third-party libraries with name, version, license type, link

---

### 3.14 Check for Updates (Desktop V1)

**Purpose:** Check and install application updates.
**Entry:** Settings > Check for Updates.
**Exit:** Back to Settings.

**Main Components:**
- Current version display
- "Check for Updates" button
- Update status: checking, available, downloading, up-to-date, error
- Download progress bar (when downloading)
- "Install and Restart" button (when ready)
- Changelog display (when available)

---

### 3.15 Onboarding / First-run (lightweight)

**Purpose:** Explain offline/privacy value and basic flow in 1-3 screens.
**Entry:** First launch only.
**Exit:** Dismiss > Home.
**Optional and skippable.**

---

## 4. Key User Flows

### 4.1 Primary Conversion Flow

```
Home / Tools
  > Select File(s)          [File Picker]
  > File Preview + Compatible Operations
  > (optional) Configuration
  > Processing              [Job Progress]
  > Result                  [Success]
  > Open / Save / Done
```

### 4.2 History Re-use Flow

```
History
  > Select past job
  > Job Detail
  > Re-run (if input still available) or Delete
```

### 4.3 Queue Management Flow

```
Jobs
  > View active/pending/completed/failed jobs
  > Cancel running or queued job
  > Retry failed/interrupted job
  > Save completed job result (desktop)
  > Remove job from list
```

### 4.4 Archive Create Flow

```
Tools > Archive > Create ZIP
  > Select files
  > (optional) compression level
  > Processing
  > Result > Open Folder
```

### 4.5 Multi-file Image to PDF

```
Home / Tools > Images to PDF
  > Select multiple images
  > Reorder
  > (optional) page options
  > Processing
  > Result
```

### 4.6 Cancel Flow

```
Processing screen > Cancel
  > Confirm if needed
  > Clean temp
  > Return to previous screen or Home
```

### 4.7 Drag-and-Drop Flow

```
Drag files from Explorer into tool workspace
  > Visual feedback (highlight)
  > Drop
  > File type validation
  > File preview + compatible operations
  > Process
```

---

## 5. Navigation Rules

- **Back behavior:** Standard platform back (gesture / button). On Processing, Back may minimize to background indicator rather than cancel (Cancel is explicit).
- **Cancel:** Always explicit; cleans resources.
- **Deep links:** Land on File Preview with the shared file(s) pre-loaded.
- **Modals / Sheets:** Configuration and short confirmations use bottom sheets or dialogs with DESIGN.md styling.
- **Persistent navigation:** Visible on Home, Tools, History, Jobs, Settings. Hidden or minimized on focused Processing and Result when full-screen is clearer.
- **Processing indicator:** Global subtle indicator (top bar or floating) when user navigates away during a job.
- **No nested navigation deeper than necessary.** Prefer sheets over new full screens for options.

---

## 6. Sitemap Diagram (Text Tree)

```
App Root
+-- Home
|   +-- Drop Zone / Select Files
|   +-- Recent Jobs > History Detail
|   +-- Popular Tools > Tool Config or File Select
|
+-- Tools
|   +-- Search
|   +-- Categories
|   |   +-- Image
|   |   |   +-- Convert
|   |   |   +-- Compress
|   |   |   +-- Resize
|   |   |   +-- Crop and Rotate
|   |   |   +-- Images > PDF
|   |   +-- PDF
|   |   |   +-- Merge
|   |   |   +-- Split
|   |   |   +-- Compress
|   |   |   +-- Organize (Rotate/Reorder)
|   |   |   +-- PDF > Images
|   |   +-- Video
|   |   |   +-- Video to Audio
|   |   |   +-- Video Compress
|   |   +-- Audio
|   |   |   +-- Audio Convert
|   |   +-- Archive
|   |   |   +-- Create ZIP
|   |   |   +-- Extract ZIP (preview + selective extract)
|   |   |   +-- Extract TAR
|   |   +-- File Tools
|   |   |   +-- File Information
|   |   |   +-- Batch Rename
|   |   |   +-- Find Duplicates
|   |   +-- Developer
|   |       +-- JSON Formatter
|   |       +-- Base64 Converter
|   |       +-- Hash Generator
|   |       +-- UUID Generator
|   |       +-- URL Converter
|   |       +-- JWT Decoder
|   |       +-- Timestamp Converter
|   +-- Tool > File Select > Config > Process > Result
|
+-- History
|   +-- Job List
|   +-- Job Detail > Delete / Re-run / Open output
|
+-- Jobs
|   +-- Active Jobs (Processing / Pending)
|   +-- Finished Jobs (Completed / Failed / Cancelled)
|       +-- Error details (affected files + technical)
|
+-- Settings
    +-- Storage and Cleanup
    +-- Notifications (Desktop)
    +-- Privacy
    +-- Permissions
    +-- Appearance
    +-- Check for Updates (Desktop)
    +-- Diagnostic Logs
    +-- About
    |   +-- Version
    |   +-- Licenses
    |   +-- Privacy Policy
    |   +-- Support / Feedback
    +-- Advanced (Feature Flags)
```

**Shared / Overlay Screens:**
- File Preview / Operation Chooser
- Configuration Sheet
- Processing / Progress
- Result / Success
- Error
- Permission Request
- Onboarding (first run)
- Confirm Dialog (overwrite, cancel, delete)

---

## 7. Empty, Loading and Error States Summary

| Screen | Empty | Loading | Error |
|--------|-------|---------|-------|
| Home | No recent activity | Detecting files | Permission denied |
| Tools | No matching tools | — | — |
| History | No history yet | Loading history | Storage error |
| Jobs | No active jobs | Loading queue | — |
| Processing | — | Progress / stage | Conversion failed |
| Result | — | — | (handled by Error screen) |
| File Preview | Unsupported format | Detecting type | Can't read file |
| Settings | — | — | — |

All states use DESIGN.md typography, colors (ink / mid-gray / ember for destructive only), and card treatments.

---

This sitemap is the structural companion to Features.md and PRD.md. Screen implementations must stay consistent with DESIGN.md visual rules.
