import type { ToolDefinition } from '@/services/tool-registry'
import { engineFor } from '@/engines/native'
import { ZipPreviewPanel } from '@/components/zip-preview-panel'

export const zipExtractTool: ToolDefinition = {
  id: 'zip-extract',
  name: 'Extract ZIP',
  description: 'Preview contents and extract files safely with zip-bomb protection.',
  category: 'archive',
  supportedInputs: ['application/zip', 'application/x-zip-compressed', 'application/x-zip'],
  defaultOptions: {},
  optionSchema: [],
  engine: engineFor(
    'zip.extract',
    () => import('@/engines/zip-engine').then((m) => ({ execute: m.extractZip })),
  ),
  customPanel: ZipPreviewPanel,
}