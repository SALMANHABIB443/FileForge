import type { ToolDefinition } from '@/services/tool-registry'
import type { DeveloperToolExecute } from '@/types/developer-tool'

export const uuidGenerateTool: ToolDefinition = {
  id: 'uuid-generate',
  name: 'UUID Generator',
  description: 'Generate random UUID v4 values. Instant.',
  category: 'developer',
  supportedInputs: [],
  defaultOptions: { count: 1 },
  optionSchema: [
    {
      key: 'count',
      label: 'Count',
      type: 'number',
      min: 1,
      max: 100,
      default: 1,
    },
  ],
}

export const processUuidGenerate: DeveloperToolExecute = async (_input, options) => {
  const count = Math.min(Math.max(Number(options.count) || 1, 1), 100)
  const uuids = Array.from({ length: count }, () => crypto.randomUUID())
  const first = uuids[0]
  return count === 1 && first ? first : uuids.join('\n')
}