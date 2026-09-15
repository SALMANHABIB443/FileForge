import type { ToolDefinition } from '@/services/tool-registry'

export const fileInfoTool: ToolDefinition = {
  id: 'file-info',
  name: 'File Information',
  description: 'Show size, type, dimensions and dates for a file. Instant.',
  category: 'file-tools',
  supportedInputs: ['*'],
  defaultOptions: {},
  optionSchema: [],
}