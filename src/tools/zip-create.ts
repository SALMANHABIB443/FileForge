import type { ToolDefinition } from '@/services/tool-registry'
import { lazyEngine } from '@/types/engine'

export const zipCreateTool: ToolDefinition = {
  id: 'zip-create',
  name: 'Create ZIP',
  description: 'Package multiple files into a ZIP archive.',
  category: 'archive',
  supportedInputs: ['*'],
  acceptsMultipleFiles: true,
  defaultOptions: { level: 6 },
  optionSchema: [
    {
      key: 'level',
      label: 'Compression level',
      type: 'select',
      options: [
        { label: 'Fastest', value: 1 },
        { label: 'Medium', value: 6 },
        { label: 'Maximum', value: 9 },
      ],
      default: 6,
    },
  ],
  engine: lazyEngine(() =>
    import('@/engines/zip-engine').then((m) => ({ execute: m.createZip })),
  ),
  outputExtension: 'zip',
}