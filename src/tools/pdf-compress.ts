import type { ToolDefinition } from '@/services/tool-registry'
import { engineFor } from '@/engines/native'

export const pdfCompressTool: ToolDefinition = {
  id: 'pdf-compress',
  name: 'PDF Compress',
  description: 'Reduce PDF size. Browser-based compression is limited; results vary.',
  category: 'pdf',
  supportedInputs: ['application/pdf'],
  defaultOptions: { preset: 'medium' },
  optionSchema: [
    {
      key: 'preset',
      label: 'Compression',
      type: 'select',
      options: [
        { label: 'Low', value: 'low' },
        { label: 'Medium', value: 'medium' },
        { label: 'High', value: 'high' },
      ],
      default: 'medium',
    },
  ],
  engine: engineFor(
    'pdf.compress',
    () => import('@/engines/pdf-engine').then((m) => ({ execute: m.compressPdf })),
  ),
  outputExtension: 'pdf',
}