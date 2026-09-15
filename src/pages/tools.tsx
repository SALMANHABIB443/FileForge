import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { getAllTools, type ToolCategory } from '@/services/tool-registry'

const CATEGORIES: { id: ToolCategory; name: string; icon: string }[] = [
  { id: 'image', name: 'Image', icon: '🖼️' },
  { id: 'pdf', name: 'PDF', icon: '📄' },
  { id: 'archive', name: 'Archive', icon: '📦' },
  { id: 'file-tools', name: 'File Tools', icon: '📁' },
  { id: 'video', name: 'Video', icon: '🎬' },
  { id: 'audio', name: 'Audio', icon: '🎵' },
  { id: 'developer', name: 'Developer', icon: '🛠️' },
]

const CATEGORY_BG: Record<string, string> = {
  image: 'bg-blue-50',
  pdf: 'bg-rose-50',
  archive: 'bg-purple-50',
  'file-tools': 'bg-amber-50',
  video: 'bg-red-50',
  audio: 'bg-green-50',
  developer: 'bg-slate-50',
}

export default function Tools() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const tools = getAllTools()

  const filtered = search
    ? tools.filter(
        (t) =>
          t.name.toLowerCase().includes(search.toLowerCase()) ||
          t.description.toLowerCase().includes(search.toLowerCase()),
      )
    : tools

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    tools: filtered.filter((t) => t.category === cat.id),
  })).filter((g) => g.tools.length > 0 || !search)

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-[36px] leading-[1.11] tracking-[-0.9px] font-bold text-ink font-[family-name:var(--font-geist)]">
          Tools
        </h1>
        <p className="text-[16px] leading-[1.5] text-mid-gray mt-2 font-[family-name:var(--font-geist)]">
          All available file utilities
        </p>
      </div>

      <label htmlFor="tool-search" className="sr-only">
        Search tools
      </label>
      <Input
        id="tool-search"
        type="text"
        placeholder="Search tools…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {filtered.length === 0 ? 'No tools match your search' : `${filtered.length} tools`}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {grouped.map((cat) => (
          <Card key={cat.id} className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-11 h-11 rounded-[13px] flex items-center justify-center text-[20px] ${CATEGORY_BG[cat.id] || 'bg-surface-alt'}`}>
                  {cat.icon}
                </div>
                <h3 className="text-[17px] leading-[1.43] font-bold text-ink font-[family-name:var(--font-geist)]">
                  {cat.name}
                </h3>
              </div>
              <Badge variant="soft">{cat.tools.length}</Badge>
            </div>
            {cat.tools.length === 0 ? (
              <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
                No tools available yet
              </p>
            ) : (
              <div className="space-y-1">
                {cat.tools.map((tool) => (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => navigate(`/tool/${tool.id}`)}
                    className="w-full text-left p-3 rounded-[14px] hover:bg-brown-hover transition-colors cursor-pointer flex items-center justify-between group"
                  >
                    <div className="min-w-0">
                      <p className="text-[14px] leading-[1.43] font-semibold text-ink font-[family-name:var(--font-geist)]">
                        {tool.name}
                      </p>
                      <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)] truncate">
                        {tool.description}
                      </p>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted group-hover:text-brown-dark shrink-0 ml-2 transition-colors">
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </button>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}