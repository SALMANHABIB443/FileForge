import type { ToolDefinition } from '@/services/tool-registry'
import { lazyEngine } from '@/types/engine'

export const imageCompressTool: ToolDefinition = {
  id: 'image-compress',
  name: 'Image Compress',
  description: 'Reduce image file size. Batch multiple files into a ZIP.',
  category: 'image',
  supportedInputs: ['image/'],
  acceptsMultipleFiles: true,
  defaultOptions: { quality: 80, stripMetadata: true },
  optionSchema: [
    {
      key: 'quality',
      label: 'Quality',
      type: 'number',
      min: 1,
      max: 100,
      default: 80,
    },
    {
      key: 'maxDimension',
      label: 'Max dimension (px, optional)',
      type: 'number',
      min: 16,
      max: 8000,
    },
    {
      key: 'stripMetadata',
      label: 'Strip metadata (privacy)',
      type: 'boolean',
      default: true,
    },
  ],
  engine: lazyEngine(() =>
    import('@/engines/image-engine').then((m) => ({ execute: m.compressImage })),
  ),
}