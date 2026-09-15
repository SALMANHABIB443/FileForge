import type { ToolDefinition } from '@/services/tool-registry'
import type { DeveloperToolExecute } from '@/types/developer-tool'

export const base64Tool: ToolDefinition = {
  id: 'base64-convert',
  name: 'Base64 Encode / Decode',
  description: 'Encode or decode Base64 text. Instant.',
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

export const processBase64: DeveloperToolExecute = async (input, options) => {
  if (!input) throw new Error('Please enter some text to process.')
  if (options.mode === 'decode') {
    try {
      const binary = atob(input.trim())
      const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      throw new Error('That is not valid Base64, or the decoded data is not UTF-8 text.')
    }
  }
  const bytes = new TextEncoder().encode(input)
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary)
}