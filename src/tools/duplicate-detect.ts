import type { ToolDefinition } from '@/services/tool-registry'

export const duplicateDetectTool: ToolDefinition = {
  id: 'duplicate-detect',
  name: 'Find Duplicates',
  description: 'Detect duplicate files by comparing SHA-256 hashes. Instant.',
  category: 'file-tools',
  supportedInputs: ['*'],
  acceptsMultipleFiles: true,
  defaultOptions: {},
  optionSchema: [],
}
