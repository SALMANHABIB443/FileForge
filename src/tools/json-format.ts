import type { ToolDefinition } from '@/services/tool-registry'
import type { DeveloperToolExecute } from '@/types/developer-tool'

export const jsonFormatTool: ToolDefinition = {
  id: 'json-format',
  name: 'JSON Formatter',
  description: 'Format or minify JSON text. Instant.',
  category: 'developer',
  supportedInputs: ['application/json'],
  defaultOptions: { mode: 'format', indent: 2 },
  optionSchema: [
    {
      key: 'mode',
      label: 'Action',
      type: 'select',
      options: [
        { label: 'Format', value: 'format' },
        { label: 'Minify', value: 'minify' },
      ],
      default: 'format',
    },
    {
      key: 'indent',
      label: 'Indent',
      type: 'number',
      min: 0,
      max: 8,
      default: 2,
    },
  ],
}

export const processJsonFormat: DeveloperToolExecute = async (input, options) => {
  const trimmed = input.trim()
  if (!trimmed) throw new Error('Please enter some JSON to process.')
  let value: unknown
  try {
    value = JSON.parse(trimmed)
  } catch {
    throw new Error('That is not valid JSON. Check the syntax and try again.')
  }
  if (options.mode === 'minify') {
    return JSON.stringify(value)
  }
  const indent = Math.min(Math.max(Number(options.indent) || 2, 0), 8)
  return JSON.stringify(value, null, indent)
}