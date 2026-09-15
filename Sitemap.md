# Sitemap.md — Information Architecture & Navigation

**Product:** FileForge  
**Last Updated:** 2026-09-14  
**Design reference:** Design.md (monochromatic, cards, 18 px / 24 px radii, Geist)  

---

## 1. Main Navigation

Primary bottom tab bar (mobile) or left sidebar (desktop / wide screens) following Design.md surface hierarchy:

| Tab / Item | Icon suggestion | Purpose |
|------------|-----------------|---------|
| **Home** | House / Grid | Quick actions, recent, popular tools, drop zone |
| **Tools** | Wrench / Catalog | Searchable full catalog by category |
| **History** | Clock / List | Past jobs and results |
| **Settings** | Gear | Preferences, privacy, about, storage |

Persistent navigation remains visible except on focused processing or full-screen result modals when appropriate.

---

## 2. Tool Categories (Tools Screen)

Logical grouping for the catalog and filters:

- **Quick Convert** (Universal entry)
- **Image**
- **PDF**
- **Video**
- **Audio**
- **Archive**
- **File Tools**
- **Developer** (V2+)

Each category card or section uses Design.md card style (white, 24 px radius, hairline border, subtle shadow).

---

## 3. Screen List

### 3.1 Home
**Purpose:** Fastest path to start a conversion + surface recent activity and popular tools.  
**Entry:** App launch, tab.  
**Exit:** Select file → File Preview / Operation chooser; or navigate to other tabs.  

**Main Components:**
- Large drop zone / “Select files” primary button (Design.md filled button)
- Recent jobs (horizontal cards or list, max 5–8)
- Popular / suggested tools (grid of tool cards)
- Category shortcuts

**Empty States:**
- No recent → “Your recent conversions will appear here”
- First launch → short onboarding tip (dismissible)

**Actions:** Select files, open tool directly, clear recent.

---

### 3.2 Tools (Catalog)
**Purpose:** Complete, searchable list of all available tools.  
**Entry:** Tab, or “All tools” from Home.  
**Exit:** Choose tool → File select or direct config if file already chosen.  

**Main Components:**
- Search input (Design.md input style, 18 px radius)
- Category chips or sections
- Tool cards (icon, name, short description, badge for “New” / “Pro” if applicable)

**Empty / Error:** Search no results → “No tools match. Try another term.”

---

### 3.3 File Preview / Operation Chooser
**Purpose:** After file selection, show preview + only compatible operations.  
**Entry:** From Home, Tools, share sheet, drag-drop.  
**Exit:** Choose operation → Config or direct Process; Back → previous.  

**Main Components:**
- File card(s): thumbnail / icon, name, size, type
- Compatible operations list (primary actions first)
- “More tools” link
- Multi-file summary when applicable

**States:** Loading detection, Ready, Unsupported.

---

### 3.4 Tool Configuration (optional screen or sheet)
**Purpose:** Present only necessary options with sensible defaults.  
**Entry:** After choosing an operation that has options.  
**Exit:** Start conversion → Processing; Back → Operation chooser.  

**Main Components:**
- Option controls (sliders, selects, toggles) matching Design.md
- Preview of estimated output size when possible
- Primary “Convert” / “Create” button
- Advanced options collapsed by default

Many simple tools skip this screen and start immediately with defaults.

---

### 3.5 Processing / Job Progress
**Purpose:** Clear feedback during conversion.  
**Entry:** Start of any job.  
**Exit:** Complete → Result; Cancel → previous or Home; Fail → Error state.  

**Main Components:**
- Progress indicator (bar or spinner + percentage / stage text)
- File name / operation name
- Cancel button (secondary / ghost)
- Optional time estimate

**Behavior:** Can be a full screen, bottom sheet, or persistent bar depending on platform and duration. User can navigate away; job continues (with global indicator).

---

### 3.6 Result / Success
**Purpose:** Present the output and next actions.  
**Entry:** Job completed successfully.  
**Exit:** Save / Share / Open → system; Convert another → Home or File select; Done → History or Home.  

**Main Components:**
- Success icon / check
- Output file card (name, size, type)
- Primary actions: Save, Share
- Secondary: Open, Show in folder (desktop), Convert another, Delete from history

---

### 3.7 Error State (reusable)
**Purpose:** Communicate failure clearly and offer recovery.  
**Entry:** Job failed or early validation error.  
**Exit:** Retry, Choose different file, Dismiss.  

**Main Components:**
- Error message (from PRD)
- Optional “Details” expander
- Retry button (if safe)
- Secondary actions

---

### 3.8 History
**Purpose:** Browse and manage past jobs.  
**Entry:** Tab.  
**Exit:** Tap item → Result / Details; Delete; Clear all.  

**Main Components:**
- List of job cards (status badge, input → output names, date, size)
- Filter by status or tool (optional V1+)
- Swipe or menu: Share, Delete, Re-run

**Empty State:** “No history yet. Your conversions will appear here.”  
**Error State:** Storage failure → message + retry.

---

### 3.9 History Detail / Job Detail
**Purpose:** Full information about a past job.  
**Entry:** Tap history item.  
**Exit:** Back, Share, Delete, Re-run, Open output.

---

### 3.10 Settings
**Purpose:** Preferences, privacy, storage, about.  
**Entry:** Tab.  
**Exit:** Back to previous or Home.  

**Sections (Design.md cards or grouped lists):**
- Storage & Cleanup (output location preference, temp cleanup, history retention)
- Permissions status
- Privacy (statement link, analytics toggle if any)
- Appearance (follows system / light only for MVP)
- About (version, licenses, support, feedback)
- Advanced (feature flags / Pro if applicable)

---

### 3.11 Onboarding / First-run (lightweight)
**Purpose:** Explain offline/privacy value and basic flow in 1–3 screens.  
**Entry:** First launch only.  
**Exit:** Dismiss → Home.  
**Optional and skippable.**

---

## 4. Key User Flows

### 4.1 Primary Conversion Flow
```
Home / Tools
  → Select File(s)          [File Picker]
  → File Preview + Compatible Operations
  → (optional) Configuration
  → Processing              [Job Progress]
  → Result                  [Success]
  → Save / Share / Done
```

### 4.2 History Re-use Flow
```
History
  → Select past job
  → Job Detail
  → Re-run (if input still available) or Share / Open / Delete
```

### 4.3 Archive Create Flow
```
Tools → Archive → Create ZIP
  → Select files / folders
  → (optional) compression level
  → Processing
  → Result
```

### 4.4 Multi-file Image → PDF
```
Home / Tools → Images to PDF
  → Select multiple images
  → Reorder
  → (optional) page options
  → Processing
  → Result
```

### 4.5 Cancel Flow
At any Processing screen → Cancel → confirm if needed → clean temp → return to previous screen or Home with neutral message.

---

## 5. Navigation Rules

- **Back behavior:** Standard platform back (gesture / button). On Processing, Back may minimize to background indicator rather than cancel (Cancel is explicit).
- **Cancel:** Always explicit; cleans resources.
- **Deep links / Share sheet:** Land on File Preview with the shared file(s) pre-loaded.
- **Modals / Sheets:** Configuration and short confirmations use bottom sheets or dialogs with Design.md styling (18 px radius, paper surface).
- **Persistent navigation:** Visible on Home, Tools, History, Settings. Hidden or minimized on focused Processing and Result when full-screen is clearer.
- **Processing indicator:** Global subtle indicator (top bar or floating) when user navigates away during a job.
- **No nested navigation deeper than necessary.** Prefer sheets over new full screens for options.

---

## 6. Sitemap Diagram (Text Tree)

```
App Root
├── Home
│   ├── Drop Zone / Select Files
│   ├── Recent Jobs → History Detail
│   └── Popular Tools → Tool Config or File Select
│
├── Tools
│   ├── Search
│   ├── Categories
│   │   ├── Image
│   │   │   ├── Convert
│   │   │   ├── Compress
│   │   │   ├── Resize
│   │   │   └── Images → PDF
│   │   ├── PDF
│   │   │   ├── Merge
│   │   │   ├── Split
│   │   │   ├── Compress
│   │   │   └── PDF → Images (V1)
│   │   ├── Video / Audio (V1+)
│   │   ├── Archive
│   │   │   ├── Create ZIP
│   │   │   ├── Extract ZIP (preview + selective extract)
│   │   │   └── Extract TAR
│   │   ├── File Tools
│   │   │   ├── File Information
│   │   │   ├── Batch Rename
│   │   │   └── Find Duplicates
│   │   └── Developer (V2)
│   └── Tool → File Select → Config → Process → Result
│
├── History
│   ├── Job List
│   └── Job Detail → Share / Open / Delete / Re-run
│
└── Settings
    ├── Storage & Cleanup
    ├── Privacy
    ├── Permissions
    ├── About
    └── (Pro / Advanced)
```

**Shared / Overlay Screens:**
- File Preview / Operation Chooser
- Configuration Sheet
- Processing / Progress
- Result / Success
- Error
- Permission Request
- Onboarding (first run)

---

## 7. Empty, Loading & Error States Summary

| Screen | Empty | Loading | Error |
|--------|-------|---------|-------|
| Home | No recent activity | Detecting files | Permission denied |
| Tools | No matching tools | — | — |
| History | No history yet | Loading history | Storage error |
| Processing | — | Progress / stage | Conversion failed |
| Result | — | — | (handled by Error screen) |
| File Preview | Unsupported format | Detecting type | Can’t read file |

All states use Design.md typography, colors (ink / mid-gray / ember for destructive only), and card treatments.

---

This sitemap is the structural companion to Features.md and PRD.md. Screen implementations must stay consistent with Design.md visual rules.
