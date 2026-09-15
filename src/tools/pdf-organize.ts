import type { ToolDefinition } from '@/services/tool-registry'
import { lazyEngine } from '@/types/engine'
import { PdfPagesPanel } from '@/components/pdf-pages-panel'

export const pdfOrganizeTool: ToolDefinition = {
  id: 'pdf-organize',
  name: 'PDF Rotate & Reorder',
  description: 'Rearrange page order and rotate pages in a PDF.',
  category: 'pdf',
  supportedInputs: ['application/pdf'],
  defaultOptions: { rotation: 0 },
  optionSchema: [
    {
      key: 'rotation',
      label: 'Rotation for all pages',
      type: 'select',
      options: [
        { label: 'None', value: 0 },
        { label: '90°', value: 90 },
        { label: '180°', value: 180 },
        { label: '270°', value: 270 },
      ],
      default: 0,
    },
  ],
  customPanel: PdfPagesPanel,
  engine: lazyEngine(() =>
    import('@/engines/pdf-engine').then((m) => ({ execute: m.organizePdf })),
  ),
  outputExtension: 'pdf',
}