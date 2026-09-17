import type { ToolDefinition } from '@/services/tool-registry'
import { engineFor } from '@/engines/native'

export const imageConvertTool: ToolDefinition = {
  id: 'image-convert',
  name: 'Image Convert',
  description: 'Convert between JPG, PNG and WebP. Batch multiple files into a ZIP.',
  category: 'image',
  supportedInputs: ['image/'],
  acceptsMultipleFiles: true,
  defaultOptions: { format: 'jpeg', quality: 85, stripMetadata: true },
  optionSchema: [
    {
      key: 'format',
      label: 'Target format',
      type: 'select',
      options: [
        { label: 'JPG', value: 'jpeg' },
        { label: 'PNG', value: 'png' },
        { label: 'WebP', value: 'webp' },
      ],
      default: 'jpeg',
    },
    {
      key: 'quality',
      label: 'Quality',
      type: 'number',
      min: 1,
      max: 100,
      default: 85,
    },
    {
      key: 'stripMetadata',
      label: 'Strip metadata (privacy)',
      type: 'boolean',
      default: true,
    },
  ],
  engine: engineFor(
    'image.convert',
    () => import('@/engines/image-engine').then((m) => ({ execute: m.convertImage })),
  ),
  outputExtension: 'jpg',
}