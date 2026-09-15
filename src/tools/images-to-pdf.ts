import type { ToolDefinition } from '@/services/tool-registry'
import { lazyEngine } from '@/types/engine'
import { FileReorderPanel } from '@/components/file-reorder-panel'

export const imagesToPdfTool: ToolDefinition = {
  id: 'images-to-pdf',
  name: 'Images to PDF',
  description: 'Turn one or more images into a single PDF document.',
  category: 'pdf',
  supportedInputs: ['image/'],
  acceptsMultipleFiles: true,
  defaultOptions: { pageSize: 'fit', orientation: 'portrait', margin: 24 },
  optionSchema: [
    {
      key: 'pageSize',
      label: 'Page size',
      type: 'select',
      options: [
        { label: 'Fit to image', value: 'fit' },
        { label: 'A4', value: 'a4' },
        { label: 'Letter', value: 'letter' },
      ],
      default: 'fit',
    },
    {
      key: 'orientation',
      label: 'Orientation',
      type: 'select',
      options: [
        { label: 'Portrait', value: 'portrait' },
        { label: 'Landscape', value: 'landscape' },
      ],
      default: 'portrait',
    },
    {
      key: 'margin',
      label: 'Margin (px)',
      type: 'number',
      min: 0,
      max: 96,
      default: 24,
    },
  ],
  customPanel: FileReorderPanel,
  engine: lazyEngine(() =>
    import('@/engines/pdf-engine').then((m) => ({ execute: m.imagesToPdf })),
  ),
  outputExtension: 'pdf',
}