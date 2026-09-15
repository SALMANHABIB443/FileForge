import type { ToolOptionSchema } from '@/services/tool-registry'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'

interface ToolOptionPanelProps {
  options: ToolOptionSchema[]
  values: Record<string, unknown>
  onChange: (values: Record<string, unknown>) => void
}

export function ToolOptionPanel({ options, values, onChange }: ToolOptionPanelProps) {
  if (options.length === 0) return null

  function set(key: string, value: unknown) {
    onChange({ ...values, [key]: value })
  }

  return (
    <Card className="p-5 space-y-4">
      <h3 className="text-[16px] leading-[1.5] font-medium text-ink font-[family-name:var(--font-geist)]">
        Options
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {options.map((opt) => (
          <div key={opt.key} className="space-y-1.5">
            <label htmlFor={opt.key} className="block text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
              {opt.label}
            </label>
            {opt.type === 'select' ? (
              <select
                id={opt.key}
                value={String(values[opt.key] ?? opt.default ?? '')}
                onChange={(e) => set(opt.key, e.target.value)}
                className="w-full bg-surface-alt text-ink rounded-[var(--radius-md)] px-3 py-2 text-[14px] font-[family-name:var(--font-geist)] focus:outline-none border border-transparent focus:border-hairline transition-colors"
              >
                {opt.options?.map((o) => (
                  <option key={String(o.value)} value={String(o.value)}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : opt.type === 'boolean' ? (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(values[opt.key] ?? opt.default)}
                  onChange={(e) => set(opt.key, e.target.checked)}
                  className="accent-brown w-[16px] h-[16px]"
                />
                <span className="text-[14px] leading-[1.43] text-ink font-[family-name:var(--font-geist)]">
                  {opt.label}
                </span>
              </label>
            ) : (
              <Input
                id={opt.key}
                type={opt.type === 'number' ? 'number' : 'text'}
                value={String(values[opt.key] ?? opt.default ?? '')}
                placeholder={opt.placeholder}
                min={opt.min}
                max={opt.max}
                onChange={(e) => set(opt.key, opt.type === 'number' ? e.target.value : e.target.value)}
              />
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}