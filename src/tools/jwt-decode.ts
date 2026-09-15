import type { ToolDefinition } from '@/services/tool-registry'
import type { DeveloperToolExecute } from '@/types/developer-tool'

export const jwtDecodeTool: ToolDefinition = {
  id: 'jwt-decode',
  name: 'JWT Decoder',
  description: 'View the header and payload of a JWT token. Display only, no signature check.',
  category: 'developer',
  supportedInputs: ['text/plain'],
  defaultOptions: {},
  optionSchema: [],
}

const decodeSegment = (segment: string): Record<string, unknown> => {
  let base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4 !== 0) base64 += '='
  let binary: string
  try {
    binary = atob(base64)
  } catch {
    throw new Error('Invalid JWT segment — no valid Base64.')
  }
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  return JSON.parse(text) as Record<string, unknown>
}

export const processJwtDecode: DeveloperToolExecute = async (input) => {
  const token = input.trim()
  if (!token) throw new Error('Paste a JWT token to decode.')
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('A JWT has three dot-separated parts: header.payload.signature.')
  }
  const headerSegment = parts[0]!
  const payloadSegment = parts[1]!
  let header: Record<string, unknown>
  let payload: Record<string, unknown>
  try {
    header = decodeSegment(headerSegment)
  } catch {
    throw new Error('Could not decode the JWT header.')
  }
  try {
    payload = decodeSegment(payloadSegment)
  } catch {
    throw new Error('Could not decode the JWT payload.')
  }
  return {
    Header: JSON.stringify(header, null, 2),
    Payload: JSON.stringify(payload, null, 2),
  }
}