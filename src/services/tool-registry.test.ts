import { describe, it, expect } from 'vitest'
import {
  registerTool,
  getTool,
  getAllTools,
  getToolsByCategory,
  getSupportedToolsForFile,
  isMultiFileTool,
} from '@/services/tool-registry'
import type { ToolDefinition } from '@/services/tool-registry'
import type { EngineAdapter } from '@/types/engine'

const noopEngine: EngineAdapter = {
  execute: async () => ({ blob: new Blob(['test']), filename: 'test.txt' }),
}

const imageConvertTool: ToolDefinition = {
  id: 'image-convert',
  name: 'Image Convert',
  description: 'Convert image formats.',
  category: 'image',
  supportedInputs: ['image/jpeg', 'image/png', 'image/webp'],
  defaultOptions: { format: 'jpeg', quality: 85 },
  optionSchema: [],
  engine: noopEngine,
}

const pdfMergeTool: ToolDefinition = {
  id: 'pdf-merge',
  name: 'PDF Merge',
  description: 'Merge PDFs.',
  category: 'pdf',
  supportedInputs: ['application/pdf'],
  acceptsMultipleFiles: true,
  defaultOptions: {},
  optionSchema: [],
  engine: noopEngine,
}

const fileInfoTool: ToolDefinition = {
  id: 'file-info',
  name: 'File Info',
  description: 'Show file info.',
  category: 'file-tools',
  supportedInputs: ['*'],
  defaultOptions: {},
  optionSchema: [],
}

describe('ToolRegistry', () => {
  it('registers and retrieves a tool', () => {
    registerTool(imageConvertTool)
    const found = getTool('image-convert')
    expect(found).toBeDefined()
    expect(found!.id).toBe('image-convert')
    expect(found!.name).toBe('Image Convert')
  })

  it('returns undefined for unknown tool', () => {
    expect(getTool('nonexistent')).toBeUndefined()
  })

  it('returns all registered tools', () => {
    registerTool(imageConvertTool)
    registerTool(pdfMergeTool)
    const tools = getAllTools()
    const ids = tools.map((t) => t.id)
    expect(ids).toContain('image-convert')
    expect(ids).toContain('pdf-merge')
  })

  it('filters tools by category', () => {
    registerTool(imageConvertTool)
    registerTool(pdfMergeTool)
    const imageTools = getToolsByCategory('image')
    expect(imageTools.length).toBeGreaterThanOrEqual(1)
    expect(imageTools.every((t) => t.category === 'image')).toBe(true)
  })

  it('finds tools by MIME type', () => {
    registerTool(imageConvertTool)
    registerTool(pdfMergeTool)
    const tools = getSupportedToolsForFile('image/jpeg')
    expect(tools.some((t) => t.id === 'image-convert')).toBe(true)
    expect(tools.some((t) => t.id === 'pdf-merge')).toBe(false)
  })

  it('finds tools accepting wildcard input', () => {
    registerTool(fileInfoTool)
    const tools = getSupportedToolsForFile('text/plain')
    expect(tools.some((t) => t.id === 'file-info')).toBe(true)
  })

  it('identifies multi-file tools', () => {
    registerTool(pdfMergeTool)
    registerTool(imageConvertTool)
    expect(isMultiFileTool('pdf-merge')).toBe(true)
    expect(isMultiFileTool('image-convert')).toBe(false)
  })

  it('tool without engine is recognized as no-engine', () => {
    registerTool(fileInfoTool)
    const tool = getTool('file-info')
    expect(tool).toBeDefined()
    expect(tool!.engine).toBeUndefined()
  })
})
