import type { ToolDefinition } from '@/services/tool-registry'
import { lazyEngine } from '@/types/engine'
import { CropPreviewPanel } from '@/components/crop-preview'

export const imageCropTool: ToolDefinition = {
  id: 'image-crop',
  name: 'Image Crop & Rotate',
  description: 'Select a region to crop and optionally rotate the image.',
  category: 'image',
  supportedInputs: ['image/'],
  defaultOptions: { format: 'jpeg', quality: 90, rotation: 0 },
  optionSchema: [
    {
      key: 'format',
      label: 'Output format',
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
      default: 90,
    },
    {
      key: 'stripMetadata',
      label: 'Strip metadata (privacy)',
      type: 'boolean',
      default: true,
    },
  ],
  customPanel: CropPreviewPanel,
  engine: lazyEngine(() =>
    import('@/engines/image-engine').then((m) => ({ execute: m.cropImage })),
  ),
  outputExtension: 'jpg',
}