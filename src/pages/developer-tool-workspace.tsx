import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ToolDefinition } from '@/services/tool-registry'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

interface DeveloperToolWorkspaceProps {
  tool: ToolDefinition
  onExecute: (input: string, options: Record<string, unknown>) => Promise<Record<string, string> | string>
}

export default function DeveloperToolWorkspace({ tool, onExecute }: DeveloperToolWorkspaceProps) {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [output, setOutput] = useState<Record<string, string> | string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [running, setRunning] = useState(false)
  const [options, setOptions] = useState<Record<string, unknown>>(tool.defaultOptions)

  const handleRun = useCallback(async () => {
    if (running) return
    setError(null)
    setOutput(null)
    setCopied(false)
    setRunning(true)
    try {
      const result = await onExecute(input, options)
      setOutput(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }, [input, options, onExecute, running])

  const handleCopy = useCallback(async () => {
    const text = typeof output === 'string'
      ? output
      : output
        ? Object.values(output).join('\n\n')
        : ''
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [output])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      handleRun()
    }
  }, [handleRun])

  const outputText = typeof output === 'string'
    ? output
    : output
      ? Object.entries(output).map(([k, v]) => `${k}:\n${v}`).join('\n\n')
      : ''

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate('/tools')}>
          ← Tools
        </Button>
        <div>
          <h1 className="text-[28px] leading-[1.25] tracking-[-0.7px] font-bold text-ink font-[family-name:var(--font-geist)]">
            {tool.name}
          </h1>
          <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
            {tool.description}
          </p>
        </div>
      </div>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="soft">Developer</Badge>
          <span className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
            ⌘ + Enter to run
          </span>
        </div>

        {tool.optionSchema.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {tool.optionSchema.map((opt) => (
              <div key={opt.key} className="flex items-center gap-2">
                <label htmlFor={`dev-${opt.key}`} className="text-[13px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
                  {opt.label}
                </label>
                {opt.type === 'select' && opt.options && (
                  <select
                    id={`dev-${opt.key}`}
                    value={String(options[opt.key] ?? opt.default ?? '')}
                    onChange={(e) => setOptions((prev) => ({ ...prev, [opt.key]: e.target.value }))}
                    className="bg-surface-alt text-ink rounded-[var(--radius-md)] px-3 py-1.5 text-[13px] font-[family-name:var(--font-geist)] focus:outline-none border border-transparent focus:border-hairline transition-colors"
                  >
                    {opt.options.map((o) => (
                      <option key={String(o.value)} value={String(o.value)}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                )}
                {opt.type === 'number' && (
                  <input
                    id={`dev-${opt.key}`}
                    type="number"
                    value={String(options[opt.key] ?? opt.default ?? '')}
                    onChange={(e) => setOptions((prev) => ({ ...prev, [opt.key]: Number(e.target.value) }))}
                    min={opt.min}
                    max={opt.max}
                    className="bg-surface-alt text-ink rounded-[var(--radius-md)] px-3 py-1.5 text-[13px] font-[family-name:var(--font-geist)] focus:outline-none border border-transparent focus:border-hairline transition-colors w-20"
                  />
                )}
                {opt.type === 'boolean' && (
                  <button
                    type="button"
                    aria-pressed={Boolean(options[opt.key])}
                    onClick={() => setOptions((prev) => ({ ...prev, [opt.key]: !prev[opt.key] }))}
                    className={`px-3 py-1.5 min-h-[44px] rounded-[var(--radius-buttons)] text-[13px] font-semibold transition-colors font-[family-name:var(--font-geist)] ${
                      options[opt.key]
                        ? 'bg-brown text-paper'
                        : 'bg-surface-alt text-brown-dark hover:bg-brown-light'
                    }`}
                  >
                    {options[opt.key] ? 'On' : 'Off'}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <label htmlFor="dev-input" className="sr-only">
          Input
        </label>
        <textarea
          id="dev-input"
          aria-label={tool.id === 'uuid-generate' ? 'No input needed — click Generate' : 'Input'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tool.id === 'uuid-generate' ? 'No input needed — click Generate' : 'Paste or type here…'}
          className="w-full bg-surface-alt text-ink placeholder:text-muted rounded-[var(--radius-md)] px-3 py-2 text-[14px] font-[family-name:var(--font-geist)] focus:outline-none border border-transparent focus:border-hairline transition-colors min-h-[140px] resize-y font-mono"
        />

        <div className="flex gap-2 items-center">
          <Button onClick={handleRun} disabled={running}>
            {tool.id === 'uuid-generate' ? 'Generate' : 'Run'}
          </Button>
          <Button variant="secondary" onClick={() => { setInput(''); setOutput(null); setError(null); setCopied(false) }} disabled={running}>
            Clear
          </Button>
          {running && (
            <span role="status" aria-live="polite" className="text-[13px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
              Working…
            </span>
          )}
        </div>
      </Card>

      {error && (
        <Card className="p-5">
          <p role="alert" className="text-[14px] leading-[1.43] text-ember font-[family-name:var(--font-geist)]">
            {error}
          </p>
        </Card>
      )}

      {output !== null && !error && (
        <Card className="p-5 space-y-3">
          <div role="status" aria-live="polite" className="flex items-center justify-between">
            <h3 className="text-[16px] leading-[1.5] font-medium text-ink font-[family-name:var(--font-geist)]">
              Result
            </h3>
            <Button variant="secondary" size="sm" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          {typeof output === 'object' ? (
            <div className="space-y-3">
              {Object.entries(output).map(([key, value]) => (
                <div key={key} className="space-y-1">
                  <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)] uppercase tracking-wider">
                    {key}
                  </p>
                  <pre className="bg-surface-alt rounded-[var(--radius-md)] px-3 py-2 text-[13px] leading-[1.43] text-ink font-mono overflow-x-auto whitespace-pre-wrap break-all">
                    {value}
                  </pre>
                </div>
              ))}
            </div>
          ) : (
            <pre className="bg-surface-alt rounded-[var(--radius-md)] px-3 py-2 text-[13px] leading-[1.43] text-ink font-mono overflow-x-auto whitespace-pre-wrap break-all min-h-[60px]">
              {outputText}
            </pre>
          )}
        </Card>
      )}
    </div>
  )
}
