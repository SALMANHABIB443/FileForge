import { useEffect, useState, type ReactNode } from 'react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { loadSettings, saveSettings, type Settings } from '@/services/settings-service'
import { FLAG_DEFINITIONS, getFlags, setFlag, type FlagKey } from '@/services/flags-service'
import { getUsageCounts, clearUsageCounts } from '@/services/local-analytics'
import { logger } from '@/services/logger'
import { APP_VERSION } from '@/version'
import { PRIVACY_POLICY } from '@/data/privacy-policy'
import { LICENSES } from '@/data/licenses'
import { APP_NAME, APP_DESCRIPTION_SHORT } from '@/data/store-assets'

interface FlagDef {
  key: FlagKey
  label: string
  description: string
}

const privacyFlags: FlagDef[] = FLAG_DEFINITIONS.filter((d) => d.group === 'privacy')
const experimentalFlags: FlagDef[] = FLAG_DEFINITIONS.filter((d) => d.group === 'experimental')

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes)) return '—'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="p-5 space-y-4">
      <h3 className="text-[17px] leading-[1.43] font-bold text-ink font-[family-name:var(--font-geist)]">
        {title}
      </h3>
      {children}
    </Card>
  )
}

function ToggleRow({ def, checked, onToggle }: { def: FlagDef; checked: boolean; onToggle: () => void }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-[14px] leading-[1.43] font-semibold text-ink font-[family-name:var(--font-geist)]">
          {def.label}
        </p>
        <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
          {def.description}
        </p>
      </div>
      <button
        type="button"
        aria-pressed={checked}
        aria-label={`${def.label}: ${checked ? 'on' : 'off'}`}
        onClick={onToggle}
        className={`shrink-0 px-4 min-h-[44px] rounded-[var(--radius-buttons)] text-[13px] font-semibold transition-colors font-[family-name:var(--font-geist)] ${
          checked ? 'bg-brown text-paper' : 'bg-surface-alt text-brown-dark hover:bg-brown-light'
        }`}
      >
        {checked ? 'On' : 'Off'}
      </button>
    </div>
  )
}

function PermissionsStatus() {
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (typeof navigator !== 'undefined' && typeof navigator.storage?.estimate === 'function') {
      void navigator.storage.estimate().then((est) => {
        if (!cancelled) setStorage({ usage: est.usage ?? 0, quota: est.quota ?? 0 })
      })
    }
    return () => {
      cancelled = true
    }
  }, [])

  const isWindow = typeof window !== 'undefined'
  const showDirectoryPicker = isWindow && 'showDirectoryPicker' in window
  const showOpenFilePicker = isWindow && 'showOpenFilePicker' in window
  const opfs = typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function'
  const canDownload = isWindow && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'

  const items = [
    { label: 'Save-as download', ok: canDownload, detail: 'Saves results as files via the browser download.' },
    { label: 'Open file picker (FSA API)', ok: showOpenFilePicker, detail: 'Faster file selection on Chromium browsers.' },
    { label: 'Folder picker (FSA API)', ok: showDirectoryPicker, detail: 'Enables extracting archives to a chosen folder.' },
    { label: 'Local storage (OPFS)', ok: opfs, detail: 'In-browser storage space for temporary results.' },
  ]

  return (
    <Section title="Permissions & capabilities">
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.label} className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[14px] leading-[1.43] font-semibold text-ink font-[family-name:var(--font-geist)]">
                {item.label}
              </p>
              <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
                {item.detail}
              </p>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[12px] font-semibold ${
                item.ok ? 'bg-success-bg text-success-text' : 'bg-surface-alt text-mid-gray'
              }`}
            >
              {item.ok ? 'Available' : 'Not supported'}
            </span>
          </li>
        ))}
      </ul>
      <div className="rounded-[14px] bg-surface-alt p-3 text-[13px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
        {storage
          ? `Browser storage: ${formatBytes(storage.usage)} used of ${formatBytes(storage.quota)} (${Math.round((storage.usage / (storage.quota || 1)) * 100)}%)`
          : 'Estimating browser storage…'}
      </div>
      <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
        FileForge requests permissions only when you actually use a feature that needs them, and always explains
        why before asking.
      </p>
    </Section>
  )
}

function DiagnosticLogs() {
  const [count, setCount] = useState(0)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    void logger.buildExport().then((payload) => setCount(payload.logs.length))
  }, [])

  const handleExport = async () => {
    setExporting(true)
    try {
      const payload = await logger.buildExport()
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `fileforge-diagnostics-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const handleClear = async () => {
    await logger.clear()
    setCount(0)
  }

  return (
    <Section title="Diagnostic logs">
      <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
        {count} log entr{count === 1 ? 'y' : 'ies'} stored locally. Logs contain only technical metadata — never
        file contents — and are never sent anywhere. You can review, export, or delete them at any time.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => void handleExport()} disabled={exporting || count === 0}>
          {exporting ? 'Exporting…' : 'Export logs'}
        </Button>
        <Button variant="destructive" onClick={() => void handleClear()} disabled={count === 0}>
          Clear logs
        </Button>
      </div>
    </Section>
  )
}

function PrivacyPolicyCard({ flags, onToggle }: { flags: Record<FlagKey, boolean>; onToggle: (key: FlagKey) => void }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Section title="Privacy">
      <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
        FileForge processes everything on your device. No files are ever uploaded or sent over the network.
        Optional local usage analytics (below) are stored only on this device and never transmitted.
      </p>
      {privacyFlags.map((def) => (
        <ToggleRow key={def.key} def={def} checked={flags[def.key]} onToggle={() => onToggle(def.key)} />
      ))}
      <div>
        <button
          type="button"
          aria-expanded={expanded}
          aria-controls="privacy-policy-text"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex min-h-[44px] items-center rounded-[var(--radius-buttons)] text-[13px] font-semibold text-brown hover:text-brown-dark font-[family-name:var(--font-geist)]"
        >
          {expanded ? 'Hide full privacy policy' : 'Read the full privacy policy'}
        </button>
        {expanded && (
          <div
            id="privacy-policy-text"
            className="mt-3 rounded-[14px] bg-surface-alt p-4 text-[13px] leading-[1.6] text-mid-gray whitespace-pre-wrap font-[family-name:var(--font-geist)]"
          >
            {PRIVACY_POLICY}
          </div>
        )}
      </div>
    </Section>
  )
}

function UsageCountsCard() {
  const [counts, setCounts] = useState<Record<string, number>>(() => getUsageCounts())

  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  if (entries.length === 0) return null

  const handleClear = () => {
    clearUsageCounts()
    setCounts({})
  }

  return (
    <Section title="Local usage counts">
      <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
        Stored only on this device. Never transmitted.
      </p>
      <ul className="space-y-1">
        {entries.map(([toolId, n]) => (
          <li key={toolId} className="flex items-center justify-between text-[13px] font-[family-name:var(--font-geist)]">
            <span className="text-ink">{toolId}</span>
            <span className="text-mid-gray">{n}</span>
          </li>
        ))}
      </ul>
      <Button variant="destructive" onClick={handleClear}>
        Clear counts
      </Button>
    </Section>
  )
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(loadSettings)
  const [flags, setFlagsLocal] = useState<Record<FlagKey, boolean>>(getFlags)

  const handleSave = () => {
    saveSettings(settings)
  }

  const toggleFlag = (key: FlagKey) => {
    const next = !flags[key]
    setFlagsLocal((prev) => ({ ...prev, [key]: next }))
    setFlag(key, next)
  }

  return (
    <div className="space-y-8">
      <h1 className="text-[36px] leading-[1.11] tracking-[-0.9px] font-bold text-ink font-[family-name:var(--font-geist)]">
        Settings
      </h1>

      <Section title="Storage">
        <div className="space-y-2">
          <label htmlFor="storage-preference" className="block text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
            Default save method
          </label>
          <select
            id="storage-preference"
            value={settings.storagePreference}
            onChange={(e) =>
              setSettings({ ...settings, storagePreference: e.target.value as Settings['storagePreference'] })
            }
            className="w-full bg-surface-alt text-ink rounded-[var(--radius-md)] px-4 py-2.5 text-[14px] font-[family-name:var(--font-geist)] focus:outline-none border border-transparent focus:border-hairline transition-colors"
          >
            <option value="ask">Ask each time</option>
            <option value="download">Always download</option>
            <option value="opfs">Use local storage</option>
          </select>
        </div>
      </Section>

      <Section title="History cleanup">
        <div className="space-y-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.autoCleanup}
              onChange={(e) => setSettings({ ...settings, autoCleanup: e.target.checked })}
              className="accent-brown w-[16px] h-[16px]"
            />
            <span className="text-[14px] leading-[1.43] text-ink font-[family-name:var(--font-geist)]">
              Automatically remove history older than…
            </span>
          </label>
          <div className="flex items-center gap-2">
            <label htmlFor="cleanup-age" className="text-[13px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
              Days
            </label>
            <input
              id="cleanup-age"
              type="number"
              min={1}
              max={365}
              value={settings.cleanupAgeDays}
              onChange={(e) => setSettings({ ...settings, cleanupAgeDays: Number(e.target.value) })}
              className="w-24 bg-surface-alt text-ink rounded-[var(--radius-md)] px-3 py-2 text-[14px] font-[family-name:var(--font-geist)] focus:outline-none border border-transparent focus:border-hairline transition-colors"
            />
            <span className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
              Older entries are not shown and are cleaned from storage.
            </span>
          </div>
        </div>
      </Section>

      <PermissionsStatus />

      <DiagnosticLogs />

      <Section title="Advanced">
        <div className="space-y-3">
          {experimentalFlags.map((def) => (
            <ToggleRow key={def.key} def={def} checked={flags[def.key]} onToggle={() => toggleFlag(def.key)} />
          ))}
          {experimentalFlags.length === 0 && (
            <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
              No experimental features right now.
            </p>
          )}
        </div>
      </Section>

      <PrivacyPolicyCard flags={flags} onToggle={toggleFlag} />
      <UsageCountsCard />

      <Section title="Licenses">
        <ul className="space-y-2">
          {LICENSES.map((l) => (
            <li key={l.name} className="flex items-center justify-between gap-4 text-[13px] font-[family-name:var(--font-geist)]">
              <a
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brown hover:text-brown-dark underline underline-offset-4"
              >
                {l.name}
              </a>
              <span className="shrink-0 text-mid-gray">{l.license}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Support & feedback">
        <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
          Found a bug, or have an idea? FileForge is an open project — issues and feature requests are tracked on
          GitHub.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => window.open('https://github.com/', '_blank', 'noopener,noreferrer')}>
            Open GitHub
          </Button>
        </div>
      </Section>

      <Section title="About">
        <p className="text-[14px] leading-[1.43] text-ink font-[family-name:var(--font-geist)]">
          {APP_NAME} v{APP_VERSION}
        </p>
        <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
          {APP_DESCRIPTION_SHORT}
        </p>
      </Section>

      <Button onClick={handleSave}>Save Settings</Button>
    </div>
  )
}