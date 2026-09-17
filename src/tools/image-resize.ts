import type { ToolDefinition } from '@/services/tool-registry'
import { engineFor } from '@/engines/native'

export const imageResizeTool: ToolDefinition = {
  id: 'image-resize',
  name: 'Image Resize',
  description: 'Change image dimensions for social media, email or storage.',
  category: 'image',
  supportedInputs: ['image/'],
  acceptsMultipleFiles: true,
  defaultOptions: { maintainAspect: true, fit: 'contain', quality: 90 },
  optionSchema: [
    {
      key: 'width',
      label: 'Width (px)',
      type: 'number',
      min: 1,
      max: 10000,
      placeholder: 'Auto',
    },
    {
      key: 'height',
      label: 'Height (px)',
      type: 'number',
      min: 1,
      max: 10000,
      placeholder: 'Auto',
    },
    {
      key: 'maintainAspect',
      label: 'Maintain aspect ratio',
      type: 'boolean',
      default: true,
    },
    {
      key: 'fit',
      label: 'Fit mode',
      type: 'select',
      options: [
        { label: 'Contain', value: 'contain' },
        { label: 'Cover (crop)', value: 'cover' },
        { label: 'Stretch', value: 'stretch' },
      ],
      default: 'contain',
    },
    {
      key: 'quality',
      label: 'Quality',
      type: 'number',
      min: 1,
      max: 100,
      default: 90,
    },
  ],
  engine: engineFor(
    'image.resize',
    () => import('@/engines/image-engine').then((m) => ({ execute: m.resizeImage })),
  ),
}