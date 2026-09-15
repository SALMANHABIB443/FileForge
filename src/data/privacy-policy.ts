export const PRIVACY_POLICY = `
**FileForge — Privacy Policy**

**Last updated:** September 2025

---

### Overview

FileForge is a client-side file utility toolbox. All processing happens locally in your browser. **No file content is ever uploaded, transmitted, or stored on a remote server.**

---

### What We Store Locally

FileForge uses your browser's local storage (IndexedDB and localStorage) to store:

- **Settings** — your preferred save method, history retention preferences, and feature flag toggles.
- **History metadata** — record of past conversions including tool name, timestamps, and file names (never file contents).
- **Diagnostic logs** — optional, in-memory + IndexedDB crash and error logs that you control (viewable, exportable, and clearable at any time from Settings → Diagnostic logs). These contain no file content and no personally identifiable information beyond your browser's user agent string.

All of this data resides entirely on your device. You can delete it at any time via the Settings page or by clearing your browser data for this site.

---

### Temporary Files

When you run a conversion, input and output files are stored in a temporary workspace on your device. These files are automatically deleted when the job completes, is cancelled, or the next time you open FileForge (for interrupted jobs). Temporary files never leave your device.

---

### Tracking & Analytics

FileForge does not include any tracking scripts, advertising, or third-party analytics by default.

An optional, privacy-preserving feature flag can enable local-only aggregate usage counts (which tools are used most). When enabled, this data is stored only on your device and is never transmitted anywhere. This flag is off by default.

Crash/error logs (optional) are stored locally and never sent to any external service.

---

### Third-Party Services

FileForge does not communicate with any third-party service for processing or storing your files. The application is designed to work entirely offline after initial loading.

Fonts (Geist) are self-hosted from the same server and do not trigger external requests.

---

### Downloads & Installation

When you install FileForge as a Progressive Web App, your browser caches application files for offline use. This is standard browser behavior and does not involve any external data transmission beyond the initial download.

---

### Children's Privacy

FileForge does not collect any personal information from any user, including children under 13.

---

### Changes to This Policy

If this privacy policy is updated, the updated version will be displayed in the Settings page. Material changes will be noted in the app's release notes.

---

### Contact

For questions about this privacy policy, open an issue at the project's GitHub repository or use the feedback link in Settings.
`.trim()