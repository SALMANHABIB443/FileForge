import type { ToolDefinition } from '@/services/tool-registry'
import type { DeveloperToolExecute } from '@/types/developer-tool'

export const timestampConvertTool: ToolDefinition = {
  id: 'timestamp-convert',
  name: 'Timestamp Converter',
  description: 'Convert between Unix timestamps and readable dates. Instant.',
  category: 'developer',
  supportedInputs: ['text/plain'],
  defaultOptions: { unit: 'seconds' },
  optionSchema: [
    {
      key: 'unit',
      label: 'Input unit',
      type: 'select',
      options: [
        { label: 'Seconds', value: 'seconds' },
        { label: 'Milliseconds', value: 'milliseconds' },
      ],
      default: 'seconds',
    },
  ],
}

export const processTimestampConvert: DeveloperToolExecute = async (input, options) => {
  const unit = options.unit === 'milliseconds' ? 'milliseconds' : 'seconds'
  const now = Date.now()
  const result: Record<string, string> = {
    'Now — timestamp (s)': String(Math.floor(now / 1000)),
    'Now — timestamp (ms)': String(now),
    'Now — ISO': new Date(now).toISOString(),
    'Now — Local': new Date(now).toLocaleString(),
    'Now — UTC': new Date(now).toUTCString(),
  }
  const trimmed = input.trim()
  if (trimmed) {
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
      throw new Error('Enter a numeric Unix timestamp, or leave the field empty for the current time.')
    }
    const scale = unit === 'milliseconds' ? 1 : 1000
    const ms = parseFloat(trimmed) * scale
    const date = new Date(ms)
    if (Number.isNaN(date.getTime())) {
      throw new Error('That timestamp is outside the supported date range.')
    }
    result[`Input — ${unit}`] = String(ms)
    result['Input — ISO'] = date.toISOString()
    result['Input — Local'] = date.toLocaleString()
    result['Input — UTC'] = date.toUTCString()
  }
  return result
}