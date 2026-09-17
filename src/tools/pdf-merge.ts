import type { ToolDefinition } from '@/services/tool-registry'
import { engineFor } from '@/engines/native'

export const pdfMergeTool: ToolDefinition = {
  id: 'pdf-merge',
  name: 'PDF Merge',
  description: 'Combine two or more PDF files into one.',
  category: 'pdf',
  supportedInputs: ['application/pdf'],
  acceptsMultipleFiles: true,
  defaultOptions: {},
  optionSchema: [],
  engine: engineFor(
    'pdf.merge',
    () => import('@/engines/pdf-engine').then((m) => ({ execute: m.mergePdfs })),
  ),
  outputExtension: 'pdf',
}