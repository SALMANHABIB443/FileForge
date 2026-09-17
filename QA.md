# FileForge — Windows Quality Assurance (QA)

Manual QA record for Phases 14 (Testing and Quality Assurance) and 15 (Production Release). Automatable checks are covered by the CDP scripts (`verify-phase10/12/13/14.mjs`) and the automated suites (436 Vitest tests, axe-core scan); the checklist below targets the manual, human-verifiable scenarios required by the Phase 14 exit criteria and the Phase 15 installer/update acceptance tests.

## Test Environment

| Item | Value |
| --- | --- |
| OS | Windows 11 (build 10.0.26200, x64) |
| Build under test | `npm run build:electron` output (`out/`), `npm run package:electron` installer (`release/`), or `win-unpacked` |
| App version | 1.0.0 |
| Electron | 44.3.0 |
| Date | 2026-09-17 |

> Add rows as needed: **Windows 10 (21H2+)**, Windows 10 LTSC, ARM64, high-DPI, small screens.

---

## Results Legend

- **PASS** — verified working
- **FAIL** — defect found (file an issue + capture repro steps)
- **N/A** — not applicable in this environment

---

## 1. Install & Launcher

- [ ] Installer (NSIS) completes on Windows 10 — install dir selection works
- [ ] Installer (NSIS) completes on Windows 11 — install dir selection works
- [ ] Start Menu shortcut launches app (unpackaged: `npm run dev:electron` / `npm run preview:electron` works)
- [ ] Optional Desktop shortcut created when selected
- [ ] Uninstall removes app, Start Menu + Desktop shortcuts
- [ ] Launch from clean profile (no stale IndexedDB/localStorage)

## 2. Window & Navigation

- [ ] Window opens unmaximized (verified automatically by Phase 14 script)
- [ ] Minimize / Maximize / Close controls work
- [ ] Maximize toggle updates window state correctly
- [ ] All nav links work: `#/` Home, `#/tools`, each `#/tool/<id>`, `#/jobs`, `#/settings` (HashRouter)
- [ ] Page reload restores state (queue restored, settings preserved)
- [ ] 125%/150% DPI scaling keeps layout usable

## 3. Native File Dialogs

- [ ] "Select files" opens the OS dialog (per tool workspace)
- [ ] "Select folder" opens the OS folder picker
- [ ] "Save as" dialog uses suggested name + correct extension filter
- [ ] Cancel in any dialog is handled without an error state
- [ ] A file dropped/pasted with no real disk path shows the "not available on disk — re-select it in the desktop app" message (automatic; surfaced as FAIL alert)

## 4. Queue & Jobs

- [ ] Multiple files enqueue correctly; jobs run at `maxConcurrentJobs` (default 2)
- [ ] Pending jobs resume after app restart (`resumePendingJobs`)
- [ ] Cancel button stops a running job → status `Cancelled`, queue entry removed
- [ ] Completed job shows a desktop Notification when toasts are enabled
- [ ] Batch (multi-file) image ops produce a ZIP; single-file ops produce single files
- [ ] Failed job shows `role="alert"` readable error and state `Failed`
- [ ] "Remove" clears a job entry from the Jobs list

## 5. File Operation Spot Checks

### Images
- [ ] PNG → JPEG convert opens in default viewer (valid JPEG)
- [ ] Image compress keeps the original format (PNG in → PNG out)
- [ ] Resize with aspect ratio maintained

### Archives
- [ ] ZIP created with 1 MB and 6 MB inputs opens in Explorer
- [ ] ZIP extraction restores contents

### PDF
- [ ] Merge 2 and 10 pages produces a valid multi-page PDF

### Media (FFmpeg)
- [ ] ffmpeg binary resolves in dev (ffmpeg-static) and packaged builds
- [ ] Audio extract/convert completes; cancel aborts mid-flight

## 6. Privacy & Security Behavior

- [ ] Operations on paths not chosen through the file dialog are rejected (approval registry)
- [ ] Output auto-save goes to the *input folder* (or a folder picked explicitly)
- [ ] "Configured output directory" must be reapproved from Settings if it changed
- [ ] Job temp files are cleaned up after success and after cancel
- [ ] Delete/empty the job temp dir manually → app recovers gracefully

## 7. Overwrite Protection

- [ ] `Autorename` saves `file.jpg`, `file(1).jpg`, … on collision
- [ ] `Confirm` prompts before overwriting; Yes/No both behave correctly
- [ ] Invalid overwrite mode falls back to autorename (automatic)

## 8. Settings & Updates

- [ ] Settings persist across restarts (localStorage + IndexedDB)
- [ ] "Job completion toasts" toggle persists (automatic, Phase 14 script)
- [ ] Auto-check for updates toggle respected; "Check for Updates" works (mock env: `FILEFORGE_UPDATER_MOCK=1`)
- [ ] Update available → notification toast (Phase 12/13), skip-version remembered

## 9. Accessibility (desktop)

- [ ] Full keyboard navigation: Tab order, Enter activates, Escape cancels
- [ ] Focus ring visible on interactive elements (Window "Show focus circles" on in Win10 — `Ease of Access`)
- [ ] Screen reader (NVDA / Narrator) announces job status changes
- [ ] No axe-core critical/serious violations (automated, see Phase 14 script; color-contrast node counts: `#/` 23, `#/tools` 32, `#/tool/image-convert` 8, `#/jobs` 8, `#/settings` 40 — track as a known finding)

## 10. Stability

- [ ] Generate + process a 20 MB+ file — app stays responsive (worker isolated)
- [ ] Rapidly enqueue/cancel 10 jobs — no crash, queue state consistent
- [ ] Leave app idle 15 min, resume a pending job — works
- [ ] Sleep/wake cycle preserves window + queue state

---

## 11. Packaged Installer (Phase 15)

Run against the produced artifact (`release/FileForge-Setup-1.0.0.exe`, NSIS assisted installer). Artifact-level checks are automated (`npm run verify:electron:phase15`, 33/33); the manual items below cover the human install/uninstall/update pass.

- [ ] Installer launch shows the assisted NSIS wizard with install-dir selection
- [ ] Install to a custom directory succeeds; Start Menu shortcut created
- [ ] Optional Desktop shortcut created when selected
- [ ] Installed FileForge launches from Start Menu / Desktop and shows version 1.0.0 in Settings
- [ ] End-to-end operation in installed app: image convert + zip create write real files
- [ ] Auto-update: "Check for Updates" against a published GitHub release works from an installed copy (mock path via `FILEFORGE_UPDATER_MOCK=1` in dev)
- [ ] Uninstaller removes app files and both shortcuts; user files preserved
- [ ] Reinstall over existing install (upgrade path) keeps user data
- [ ] Fresh clean-Windows10/11 install completes without errors (SmartScreen **unsigned** warning expected: "Windows protected your PC" when launched by non-admin download — use "More info → Run anyway"; documented in `RELEASE.md`)

---

## Results

| # | Check | Windows 11 (this machine) | Windows 10 (TBD) | Notes |
| --- | --- | --- | --- | --- |
| 1–6 (launch) | | | | |
| … | | | | |

Fill rows per environment; **exit criteria for Phase 15 require a reliable installer (automated: `verify:electron:phase15` 33/33, packaged-app launch smoke test), no critical bugs, accurate documentation, and release artifacts ready** — with the human install/uninstall/update pass completed on Windows 10 and 11.

---

## Known Findings

1. **Image/pixel scaling:** axe-core color-contrast findings exist on most routes (see §9) — visual-only, no critical/serious violations.
2. **Media on low-end CPUs:** FFmpeg heavy jobs on 4-thread machines can take seconds; UI stays responsive due to worker isolation (see `Benchmarks.md`).
3. Manual install/uninstall and dialog interaction still require a human pass on Windows 10; everything automatable is covered by `npm run verify:electron`, `verify:electron:phase12/13/14`, and `verify:electron:phase15`.
4. **Unsigned installer:** no code-signing certificate yet — SmartScreen warns on first run until a cert is configured (see `RELEASE.md` → Code Signing).