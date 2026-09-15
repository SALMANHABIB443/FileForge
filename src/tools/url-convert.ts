import type { ToolDefinition } from '@/services/tool-registry'
import type { DeveloperToolExecute } from '@/types/developer-tool'

export const urlConvertTool: ToolDefinition = {
  id: 'url-convert',
  name: 'URL Encode / Decode',
  description: 'Percent-encode or decode URL strings. Instant.',
  category: 'developer',
  supportedInputs: ['text/plain'],
  defaultOptions: { mode: 'encode' },
  optionSchema: [
    {
      key: 'mode',
      label: 'Action',
      type: 'select',
      options: [
        { label: 'Encode', value: 'encode' },
        { label: 'Decode', value: 'decode' },
      ],
      default: 'encode',
    },
  ],
}

export const processUrlConvert: DeveloperToolExecute = async (input, options) => {
  if (!input) throw new Error('Please enter some text to process.')
  if (options.mode === 'decode') {
    try {
      return decodeURIComponent(input)
    } catch {
      throw new Error('That is not a valid percent-encoded string.')
    }
  }
  return encodeURIComponent(input)
}