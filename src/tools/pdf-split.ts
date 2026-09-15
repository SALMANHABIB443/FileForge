import type { ToolDefinition } from '@/services/tool-registry'
import { lazyEngine } from '@/types/engine'

export const pdfSplitTool: ToolDefinition = {
  id: 'pdf-split',
  name: 'PDF Split',
  description: 'Extract page ranges or every page into separate files.',
  category: 'pdf',
  supportedInputs: ['application/pdf'],
  defaultOptions: { mode: 'range', range: '1-3' },
  optionSchema: [
    {
      key: 'mode',
      label: 'Mode',
      type: 'select',
      options: [
        { label: 'Page range', value: 'range' },
        { label: 'Every page as separate PDF', value: 'every' },
      ],
      default: 'range',
    },
    {
      key: 'range',
      label: 'Range (e.g. 1-3, 5, 8-10)',
      type: 'text',
      placeholder: '1-3, 5, 8-10',
    },
  ],
  engine: lazyEngine(() =>
    import('@/engines/pdf-engine').then((m) => ({ execute: m.splitPdf })),
  ),
  outputExtension: 'pdf',
}