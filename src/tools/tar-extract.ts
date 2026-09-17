import type { ToolDefinition } from '@/services/tool-registry'
import { engineFor } from '@/engines/native'

export const tarExtractTool: ToolDefinition = {
  id: 'tar-extract',
  name: 'Extract TAR',
  description: 'Unpack a TAR archive safely with size and path protection.',
  category: 'archive',
  supportedInputs: ['application/x-tar'],
  defaultOptions: {},
  optionSchema: [],
  engine: engineFor(
    'tar.extract',
    () => import('@/engines/tar-engine').then((m) => ({ execute: m.extractTar })),
  ),
}
