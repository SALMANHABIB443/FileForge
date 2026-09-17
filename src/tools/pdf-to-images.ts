import type { ToolDefinition } from '@/services/tool-registry'
import { engineFor } from '@/engines/native'

export const pdfToImagesTool: ToolDefinition = {
  id: 'pdf-to-images',
  name: 'PDF to Images',
  description: 'Render PDF pages as JPG or PNG files. Single page returns an image; multiple returns a ZIP.',
  category: 'pdf',
  supportedInputs: ['application/pdf'],
  defaultOptions: { format: 'jpeg', scale: 2, quality: 92, range: '' },
  optionSchema: [
    {
      key: 'format',
      label: 'Format',
      type: 'select',
      options: [
        { label: 'JPG', value: 'jpeg' },
        { label: 'PNG', value: 'png' },
      ],
      default: 'jpeg',
    },
    {
      key: 'scale',
      label: 'Scale (× zoom)',
      type: 'select',
      options: [
        { label: '1×', value: 1 },
        { label: '2×', value: 2 },
        { label: '3×', value: 3 },
      ],
      default: 2,
    },
    {
      key: 'quality',
      label: 'JPEG quality',
      type: 'number',
      min: 1,
      max: 100,
      default: 92,
    },
    {
      key: 'range',
      label: 'Page range (blank = all)',
      type: 'text',
      placeholder: 'e.g. 1-3, 5, 8-10',
    },
  ],
  engine: engineFor(
    'pdf.toImages',
    () => import('@/engines/pdf-engine').then((m) => ({ execute: m.pdfToImages })),
  ),
  outputExtension: 'jpg',
}