import type { ReactNode } from 'react'
import type { EngineAdapter } from '@/types/engine'
import type { FileMeta } from '@/types/job'

export interface CustomPanelProps {
  files: FileMeta[]
  values: Record<string, unknown>
  onChange: (values: Record<string, unknown>) => void
  onReorderFiles?: (files: FileMeta[]) => void
}

export interface ToolDefinition {
  id: string
  name: string
  description: string
  category: ToolCategory
  supportedInputs: string[]
  defaultOptions: Record<string, unknown>
  optionSchema: ToolOptionSchema[]
  engine?: EngineAdapter
  acceptsMultipleFiles?: boolean
  outputExtension?: string
  customPanel?: (props: CustomPanelProps) => ReactNode
}

export type ToolCategory =
  | 'quick-convert'
  | 'image'
  | 'pdf'
  | 'video'
  | 'audio'
  | 'archive'
  | 'file-tools'
  | 'developer'

export interface ToolOptionSchema {
  key: string
  label: string
  type: 'select' | 'number' | 'boolean' | 'text'
  options?: { label: string; value: string | number }[]
  default?: string | number | boolean
  min?: number
  max?: number
  placeholder?: string
}

const registry = new Map<string, ToolDefinition>()

export function registerTool(tool: ToolDefinition): void {
  registry.set(tool.id, tool)
}

export function getTool(id: string): ToolDefinition | undefined {
  return registry.get(id)
}

export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return Array.from(registry.values()).filter((t) => t.category === category)
}

export function getAllTools(): ToolDefinition[] {
  return Array.from(registry.values())
}

export function getSupportedToolsForFile(mimeType: string): ToolDefinition[] {
  return Array.from(registry.values()).filter((t) =>
    t.supportedInputs.some((input) => mimeType.startsWith(input) || input === '*'),
  )
}

export function isMultiFileTool(toolId: string): boolean {
  const tool = registry.get(toolId)
  return tool?.acceptsMultipleFiles ?? false
}