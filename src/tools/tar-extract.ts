import type { ToolDefinition } from '@/services/tool-registry'
import { lazyEngine } from '@/types/engine'

export const tarExtractTool: ToolDefinition = {
  id: 'tar-extract',
  name: 'Extract TAR',
  description: 'Unpack a TAR archive safely with size and path protection.',
  category: 'archive',
  supportedInputs: ['application/x-tar'],
  defaultOptions: {},
  optionSchema: [],
  engine: lazyEngine(() =>
    import('@/engines/tar-engine').then((m) => ({ execute: m.extractTar })),
  ),
}
