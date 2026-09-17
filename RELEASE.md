# RELEASE.md — FileForge Production Release Guide

How to build, version, sign, and publish FileForge for Windows.

## Overview

FileForge ships as an NSIS installer produced by `electron-builder`. The same pipeline generates the auto-update metadata (`latest.yml`, `app-update.yml`, differential blockmaps) consumed by `electron-updater`.

**Current status:** first production release `1.0.0` — packaged as `release/FileForge-Setup-1.0.0.exe`. Unsigned (no certificate yet).

---

## Prerequisites

| Requirement | Notes |
| --- | --- |
| Node.js 18+ and npm | Standard dev setup |
| Network | First `electron-builder` run downloads Electron, NSIS, and signing tooling from GitHub |
| `GH_TOKEN` (for publishing only) | GitHub token with `repo` scope to create/update GitHub Releases |
| Code-signing certificate (optional) | Without one, the installer is unsigned (Windows SmartScreen will warn); see [Code Signing](#code-signing) |

---

## Version Bumping Workflow

1. Choose the next version per [SemVer](https://semver.org/):
   ```bash
   npm version patch   # 1.0.0 -> 1.0.1 (bug fixes)
   npm version minor   # 1.0.1 -> 1.1.0 (new features)
   npm version major   # 1.1.0 -> 2.0.0 (breaking changes)
   ```
   `npm version` updates `package.json`, `package-lock.json`, creates the `vX.Y.Z` tag, and stages a commit.
2. Update release notes in the `build.releaseInfo.releaseNotes` field of `package.json` (these flow into `latest.yml` so the in-app updater can show them).
3. Commit + push the tag:
   ```bash
   git push && git push --tags
   ```

---

## Building the Installer (Local)

Reproduces `release/` from a clean tree:

```bash
npm run package:electron
```

This runs `setup:ffmpeg`, TypeScript (web + electron), `electron-vite build`, then `electron-builder --win`. Outputs:

```
release/
  FileForge-Setup-<version>.exe     NSIS installer
  FileForge-Setup-<version>.exe.blockmap   differential update blockmap
  latest.yml                        update metadata for electron-updater
  win-unpacked/                     unpacked app (smoke testing)
    resources/
      ffmpeg/ffmpeg.exe             bundled native FFmpeg runtime
      app-update.yml                app-side update config
      app.asar
```

**Faster iteration** — build without the installer:

```bash
npm run package:dir        # electron-builder --win dir → release/win-unpacked
```

Verify the artifacts match the spec:

```bash
npm run verify:electron:phase15
```

---

## Publishing to GitHub Releases

Once the installable version is tagged (`vX.Y.Z`), publish the artifacts as a GitHub Release. electron-updater resolves updates from the latest GitHub release, so this also enables auto-update for installed copies.

```bash
GH_TOKEN=<your-token> npm run release
```

`release` runs `electron-builder --win --publish always`, which uploads the installer + blockmap and creates a GitHub release with the tag `vX.Y.Z`.

Manual alternative: create the release on GitHub (tag `vX.Y.Z`) and attach `release/FileForge-Setup-<version>.exe` and `.blockmap`, keeping `latest.yml` in sync (electron-builder generates it locally; the GitHub release must point at the same tag, otherwise the updater's `latest.yml` check can mismatch).

### Auto-update behavior

- Requires the app to be **installed** (updates are not applied to `win-unpacked` development builds).
- Updates are user-triggered: `autoDownload = false`, `autoInstallOnAppQuit = false`; the user confirms download + install from Settings (see `electron/services/updater.ts`).
- `latest.yml` is matched against installed version; installers must be named per `build.win.artifactName`.

---

## Code Signing

The pipeline is configured for unsigned output by default. To enable signing, obtain an OV/EV code-signing certificate and configure electron-builder (no code changes required):

- Set `win.signingHashAlgorithms` to `["sha256"]` and provide the certificate via env vars:
  ```env
  CSC_LINK=/path/to/certificate.pfx
  CSC_KEY_PASSWORD=<password>
  ```
  See [electron-builder code signing docs](https://www.electron.build/code-signing) for the full matrix (Azure Trusted Signing, `.pfx`, CI secrets).
- After signing, the SmartScreen "unknown publisher" warning disappears and Defender trust improves.

Until a certificate is configured, **unsigned installers are shipped intentionally**; SmartScreen warning is expected behavior and documented in `QA.md`.

---

## Release Checklist

Before tagging a release, confirm:

- [ ] `npm test` — 436/436 Vitest tests pass
- [ ] `npm run typecheck` — clean
- [ ] `npm run lint` — clean
- [ ] `npm run verify:electron` (phase 10), `verify:electron:phase12`, `verify:electron:phase13`, `verify:electron:phase14` — pass
- [ ] `npm run build:electron` — clean electron-vite build
- [ ] `npm run package:electron` — installer produced in `release/`
- [ ] `npm run verify:electron:phase15` — 33/33 packaging checks pass
- [ ] Packaged app launches from `release/win-unpacked/FileForge.exe` (smoke test)
- [ ] Manual QA pass on Windows 10 and 11 (see `QA.md`) — install dir, shortcuts, launch, uninstall, update flow
- [ ] `package.json` `version` and `build.releaseInfo.releaseNotes` updated
- [ ] Tag `vX.Y.Z` pushed
- [ ] `GH_TOKEN=<token> npm run release` → GitHub release published with installer + blockmap
- [ ] Installed copy checks for updates and finds the new release

---

## Uninstaller & Clean Install

- NSIS generates a proper uninstaller (Programs & Features entry + Start Menu shortcut removal).
- Uninstall removes the app and shortcuts; **user files** (output files, jobs persisted in the user-data dir) are preserved — no `deleteAppDataOnUninstall`.

---

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `electron-builder` fails to download NSIS/Electron | Retry; check network/proxy access to GitHub releases; clear `%LOCALAPPDATA%\electron-builder\Cache` if corrupted |
| Installer unsigned / SmartScreen warning | Expected without a cert; see [Code Signing](#code-signing) |
| Updater reports "no update information" | Confirm a GitHub release exists for the tag and `latest.yml` versions match an **installed** app |
| `ffmpeg` not found in packaged app | Confirm `release/win-unpacked/resources/ffmpeg/ffmpeg.exe` exists after packaging |