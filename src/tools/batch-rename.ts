import type { ToolDefinition } from '@/services/tool-registry'
import { lazyEngine } from '@/types/engine'
import { RenamePreviewPanel } from '@/components/rename-preview-panel'

export const batchRenameTool: ToolDefinition = {
  id: 'batch-rename',
  name: 'Batch Rename',
  description: 'Rename multiple files using prefix, suffix, find-replace, or sequential numbering.',
  category: 'file-tools',
  supportedInputs: ['*'],
  acceptsMultipleFiles: true,
  defaultOptions: {
    mode: 'prefix',
    prefix: '',
    suffix: '',
    findText: '',
    replaceText: '',
    startNumber: 1,
    padWidth: 3,
  },
  optionSchema: [
    {
      key: 'mode',
      label: 'Rename mode',
      type: 'select',
      options: [
        { label: 'Add prefix', value: 'prefix' },
        { label: 'Add suffix', value: 'suffix' },
        { label: 'Find & replace', value: 'find-replace' },
        { label: 'Sequential numbering', value: 'sequential' },
      ],
      default: 'prefix',
    },
    {
      key: 'prefix',
      label: 'Prefix',
      type: 'text',
      placeholder: 'e.g. vacation_',
    },
    {
      key: 'suffix',
      label: 'Suffix',
      type: 'text',
      placeholder: 'e.g. _final',
    },
    {
      key: 'findText',
      label: 'Find text',
      type: 'text',
      placeholder: 'Text to find',
    },
    {
      key: 'replaceText',
      label: 'Replace with',
      type: 'text',
      placeholder: 'Replacement text',
    },
    {
      key: 'startNumber',
      label: 'Start number',
      type: 'number',
      default: 1,
      min: 0,
      max: 99999,
    },
    {
      key: 'padWidth',
      label: 'Pad width',
      type: 'number',
      default: 3,
      min: 1,
      max: 10,
    },
  ],
  engine: lazyEngine(() =>
    import('@/engines/rename-engine').then((m) => ({ execute: m.batchRename })),
  ),
  customPanel: RenamePreviewPanel,
}
