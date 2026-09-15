import type { ToolDefinition } from '@/services/tool-registry'
import type { DeveloperToolExecute } from '@/types/developer-tool'

export const hashGenerateTool: ToolDefinition = {
  id: 'hash-generate',
  name: 'Hash Generator',
  description: 'Generate SHA-256 or SHA-512 hashes. Instant, runs in your browser.',
  category: 'developer',
  supportedInputs: ['text/plain'],
  defaultOptions: { algorithm: 'SHA-256' },
  optionSchema: [
    {
      key: 'algorithm',
      label: 'Algorithm',
      type: 'select',
      options: [
        { label: 'SHA-256', value: 'SHA-256' },
        { label: 'SHA-512', value: 'SHA-512' },
      ],
      default: 'SHA-256',
    },
  ],
}

const toHex = (buffer: ArrayBuffer): string =>
  Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('')

export const processHash: DeveloperToolExecute = async (input, options) => {
  if (!input) throw new Error('Please enter some text to hash.')
  const algorithm = options.algorithm === 'SHA-512' ? 'SHA-512' : 'SHA-256'
  const data = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest(algorithm, data)
  return toHex(digest)
}