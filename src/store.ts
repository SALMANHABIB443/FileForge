import { create } from 'zustand'
import type { FileMeta, Job } from '@/types/job'

interface AppState {
  selectedFiles: FileMeta[]
  activeToolId: string | null
  activeJob: Job | null

  selectFiles: (files: FileMeta[]) => void
  reorderFiles: (files: FileMeta[]) => void
  clearSelection: () => void
  setActiveTool: (toolId: string | null) => void
  setActiveJob: (job: Job | null) => void
  reset: () => void
}

export const useAppStore = create<AppState>((set) => ({
  selectedFiles: [],
  activeToolId: null,
  activeJob: null,

  selectFiles: (files) => set({ selectedFiles: files }),
  reorderFiles: (files) => set({ selectedFiles: files }),
  clearSelection: () => set({ selectedFiles: [], activeToolId: null, activeJob: null }),
  setActiveTool: (toolId) => set({ activeToolId: toolId }),
  setActiveJob: (job) => set({ activeJob: job }),
  reset: () => set({ selectedFiles: [], activeToolId: null, activeJob: null }),
}))
