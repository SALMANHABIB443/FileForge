import { useState, useEffect, type DragEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getTool, getAllTools } from '@/services/tool-registry'
import {
  pickFiles,
  fileMetasFromDrop,
  isDesktop,
  chooseDirectory,
  dirname,
} from '@/services/file-service'
import { cancelRunningJob } from '@/services/job-runner'
import { enqueueJob, retryJob } from '@/services/queue'
import { getAllJobs, subscribeToJob, setJobSavedPath } from '@/services/job-service'
import { loadSettings } from '@/services/settings-service'
import type { FileInfo } from '@/engines/file-info-engine'
import type { DuplicateGroup } from '@/engines/duplicate-engine'
import { formatFileSize } from '@/utils/filename'
import { FilePreview } from '@/components/file-preview'
import { ToolOptionPanel } from '@/components/tool-option-panel'
import { JobProgress } from '@/components/job-progress'
import { MediaWarning } from '@/components/media-warning'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useAppStore } from '@/store'
import type { Job } from '@/types/job'
import type { FileMeta } from '@/types/job'
import { downloadBlob } from '@/utils/permission-helpers'
import { getDeveloperProcessor } from '@/tools'
import DeveloperToolWorkspace from './developer-tool-workspace'

export default function ToolWorkspace() {
  const { toolId } = useParams<{ toolId: string }>()
  const navigate = useNavigate()
  const tool = toolId ? getTool(toolId) : undefined
  const allTools = getAllTools()

  const files = useAppStore((s) => s.selectedFiles)
  const storeSelectFiles = useAppStore((s) => s.selectFiles)
  const storeReorderFiles = useAppStore((s) => s.reorderFiles)

  const [options, setOptions] = useState<Record<string, unknown>>(() => tool?.defaultOptions ?? {})
  const [job, setJob] = useState<Job | null>(() => {
    if (!tool) return null
    return (
      getAllJobs().find(
        (j) => j.toolId === tool.id && (j.status === 'processing' || j.status === 'pending'),
      ) ?? null
    )
  })
  const [fileInfoData, setFileInfoData] = useState<FileInfo | null>(null)
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([])
  const [error, setError] = useState<string | null>(null)
  const [extractDir, setExtractDir] = useState<{ path?: string; handle?: FileSystemDirectoryHandle; name: string } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [hash, setHash] = useState<string | null>(null)
  const [isComputingHash, setIsComputingHash] = useState(false)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)
  const [savedPaths, setSavedPaths] = useState<Record<string, string>>({})

  const isInstantTool = tool && !tool.engine
  const isDuplicateTool = toolId === 'duplicate-detect'
  const isExtract = toolId === 'zip-extract'

  useEffect(() => {
    if (!tool || !isInstantTool || files.length === 0) return
    let cancelled = false
    const controller = new AbortController()

    if (isDuplicateTool) {
      if (isDesktop()) {
        runDesktopData(
          'duplicates',
          files,
          controller,
          (data) => {
            if (!cancelled) setDuplicateGroups(toDuplicateGroups(data))
          },
          (err) => {
            if (!cancelled) setError(messageOf(err))
          },
        )
      } else {
        import('@/engines/duplicate-engine')
          .then((m) => m.findDuplicates(files))
          .then(setDuplicateGroups)
          .catch((err) => setError(messageOf(err)))
      }
      return () => {
        cancelled = true
        controller.abort()
      }
    }

    if (isDesktop()) {
      runDesktopData(
        'fileInfo',
        files,
        controller,
        (data) => {
          if (cancelled) return
          const info = normalizeFileInfo(data, files[0]!)
          setFileInfoData(info)
          setHash(info.hash ?? null)
        },
        (err) => {
          if (!cancelled) setError(messageOf(err))
        },
      )
    } else {
      import('@/engines/file-info-engine')
        .then((m) => m.getFileInfo(files[0]!))
        .then((info) => {
          if (!cancelled) setFileInfoData(info)
          setHash(info.hash ?? null)
        })
        .catch((err) => setError(messageOf(err)))
    }

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [tool, isInstantTool, isDuplicateTool, files])

  const jobId = job?.id
  useEffect(() => {
    if (!jobId) return
    return subscribeToJob(jobId, setJob)
  }, [jobId])

  useEffect(() => {
    if (!job || job.status !== 'completed' || !isDesktop()) return
    if (savedPaths[job.id] || !(job.outputBlob || job.outputPath)) return
    let cancelled = false
    void (async () => {
      try {
        const settings = loadSettings()
        let result: { path: string } | null = null
        if (job.outputPath) {
          result = await window.fileforge!.saveOutputFile({
            sourcePath: job.outputPath,
            suggestedName: job.outputName ?? 'output',
            outputDir: settings.defaultOutputDir || undefined,
            overwriteMode: settings.overwriteProtection,
          })
          if (result) void window.fileforge!.cleanupJobTemp(job.id)
        } else if (job.outputBlob) {
          const data = await job.outputBlob!.arrayBuffer()
          result = await window.fileforge!.saveOutput({
            data,
            suggestedName: job.outputName ?? 'output',
            outputDir: settings.defaultOutputDir || undefined,
            overwriteMode: settings.overwriteProtection,
          })
        }
        if (result && !cancelled) {
          setSavedPaths((prev) => ({ ...prev, [job.id]: result.path }))
          setJobSavedPath(job.id, result.path)
        }
      } catch {
        // auto-save failure is non-fatal — the user can still pick a folder via Save As
      }
    })()
    return () => {
      cancelled = true
    }
  }, [job, savedPaths])

  const handlePickFiles = async () => {
    const picked = await pickFiles()
    if (picked.length > 0) {
      storeSelectFiles(picked)
      setJob(null)
      setFileInfoData(null)
      setError(null)
      setHash(null)
      setSavedPaths({})
    }
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const incoming = e.dataTransfer?.files
    if (incoming && incoming.length > 0) {
      storeSelectFiles(fileMetasFromDrop(Array.from(incoming)))
      setJob(null)
      setFileInfoData(null)
      setError(null)
      setHash(null)
      setSavedPaths({})
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleChooseDir = async () => {
    if (isDesktop()) {
      const dir = await chooseDirectory()
      if (dir) setExtractDir({ path: dir.path, name: dir.name })
    } else if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
        setExtractDir({ handle, name: handle.name })
      } catch {
        // cancelled
      }
    }
  }

  const handleComputeHash = async () => {
    if (!files[0]) return
    setIsComputingHash(true)
    try {
      if (isDesktop()) {
        const { nativeEngine } = await import('@/engines/native')
        const res = await nativeEngine('computeHash').execute(
          [files[0]],
          {},
          () => {},
          new AbortController().signal,
        )
        const entries = res.data as Array<{ hash: string }>
        const value = entries[0]?.hash ?? ''
        setHash(value)
        setFileInfoData((info) => (info ? { ...info, hash: value } : info))
      } else {
        const { computeFileHash } = await import('@/engines/file-info-engine')
        const value = await computeFileHash(files[0])
        setHash(value)
        setFileInfoData((info) => (info ? { ...info, hash: value } : info))
      }
    } catch (err) {
      setError(messageOf(err))
    } finally {
      setIsComputingHash(false)
    }
  }

  const handleRun = async () => {
    if (!tool || files.length === 0) return
    setError(null)

    const opts = { ...options }
    if (isExtract && extractDir) {
      if (extractDir.path) opts.outputDir = extractDir.path
      if (extractDir.handle) opts.directoryHandle = extractDir.handle
    }

    const totalInput = files.reduce((sum, f) => sum + f.size, 0)
    setStorageWarning(null)
    if (!isDesktop() && typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      try {
        const { usage = 0, quota = 0 } = await navigator.storage.estimate()
        if (quota > 0 && usage + totalInput > quota * 0.8) {
          setStorageWarning(
            `This job needs roughly ${formatFileSize(totalInput)} of space and your browser is running low. If it fails, try freeing space or using smaller files.`,
          )
        }
      } catch {
        // storage estimate unavailable — skip warning
      }
    }

    try {
      const result = enqueueJob({
        toolId: tool.id,
        inputs: files,
        options: opts,
      })
      setJob(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const handleCancel = () => {
    if (job) cancelRunningJob(job.id)
  }

  const handleRetry = () => {
    if (!job) return
    const next = retryJob(job.id)
    if (next) {
      if (isDesktop() && job.outputPath) void window.fileforge!.cleanupJobTemp(job.id)
      setError(null)
      setSavedPaths({})
      setJob(next)
    }
  }

  const handleDownload = async () => {
    if (!job) return
    if (isDesktop()) {
      const settings = loadSettings()
      const alreadySaved = savedPaths[job.id]
      const defaultDir = alreadySaved ? dirname(alreadySaved) : settings.defaultOutputDir || undefined
      let saved: string | null = null
      if (job.outputPath) {
        saved = await window.fileforge!.saveAsFile({
          sourcePath: job.outputPath,
          suggestedName: job.outputName ?? 'output',
          defaultDir,
        })
        if (saved) void window.fileforge!.cleanupJobTemp(job.id)
      } else if (job.outputBlob) {
        const data = await job.outputBlob.arrayBuffer()
        saved = await window.fileforge!.saveAsOutput({
          data,
          suggestedName: job.outputName ?? 'output',
          defaultDir,
        })
      }
      if (saved) {
        setSavedPaths((prev) => ({ ...prev, [job.id]: saved }))
        setJobSavedPath(job.id, saved)
      }
      return
    }
    if (job.outputBlob) downloadBlob(job.outputBlob, job.outputName ?? 'output')
  }

  const handleConvertAnother = () => {
    if (isDesktop() && job?.outputPath) void window.fileforge!.cleanupJobTemp(job.id)
    setJob(null)
    setFileInfoData(null)
    setDuplicateGroups([])
    setHash(null)
    setSavedPaths({})
    storeSelectFiles([])
    setOptions(tool?.defaultOptions ?? {})
    setExtractDir(null)
  }

  const handlePickDifferent = () => {
    if (isDesktop() && job?.outputPath) void window.fileforge!.cleanupJobTemp(job.id)
    setJob(null)
    setFileInfoData(null)
    setDuplicateGroups([])
    setHash(null)
    setSavedPaths({})
    storeSelectFiles([])
  }

  if (!tool) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-[36px] leading-[1.11] tracking-[-0.9px] font-bold text-ink font-[family-name:var(--font-geist)]">
            Select a Tool
          </h1>
          <p className="text-[14px] leading-[1.43] text-mid-gray mt-2 font-[family-name:var(--font-geist)]">
            Choose a tool from the catalog below, or go to the Tools page.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {allTools.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => navigate(`/tool/${t.id}`)}
              className="text-left p-3 bg-paper rounded-[var(--radius-cards)] border border-hairline text-[14px] leading-[1.43] text-ink font-medium font-[family-name:var(--font-geist)] hover:bg-brown-hover transition-colors cursor-pointer"
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (tool.category === 'developer') {
    const onExecute = getDeveloperProcessor(tool.id)
    if (!onExecute) {
      return (
        <div className="space-y-6">
          <h1 className="text-[28px] leading-[1.25] tracking-[-0.7px] font-bold text-ink font-[family-name:var(--font-geist)]">
            {tool.name}
          </h1>
          <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
            This tool is not available yet.
          </p>
        </div>
      )
    }
    return <DeveloperToolWorkspace tool={tool} onExecute={onExecute} />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={() => navigate('/tools')}>
          ← Tools
        </Button>
        <div>
          <h1 className="text-[28px] leading-[1.25] tracking-[-0.7px] font-bold text-ink font-[family-name:var(--font-geist)]">
            {tool.name}
          </h1>
          <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
            {tool.description}
          </p>
        </div>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((f) => (
            <FilePreview key={f.id} file={f} showTools={false} />
          ))}
          {files.length > 0 && !job && (
            <Button variant="secondary" size="sm" onClick={handlePickDifferent}>
              Change file
            </Button>
          )}
        </div>
      )}

      {files.length === 0 && (
        <button
          type="button"
          onClick={handlePickFiles}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`w-full p-8 flex flex-col items-center justify-center min-h-[180px] rounded-[var(--radius-3xl)] border border-hairline bg-paper cursor-pointer hover:bg-canvas transition-colors text-left ${
            dragOver ? 'border-ink bg-canvas' : 'border-dashed'
          }`}
        >
          <p className="text-[14px] leading-[1.43] text-mid-gray mb-4 font-[family-name:var(--font-geist)]">
            {isInstantTool && !isDuplicateTool
              ? 'Select a file to inspect'
              : isDuplicateTool
                ? 'Select at least two files to compare'
                : 'Drop files here or browse'}
          </p>
          <span className="text-[14px] leading-[1.43] text-ink font-medium inline-flex items-center justify-center rounded-[var(--radius-buttons)] px-4 h-9 bg-brown text-paper font-[family-name:var(--font-geist)]">
            Browse files
          </span>
        </button>
      )}

      {error && !job && (
        <Card role="alert" className="p-4 border-ember/40">
          <p className="text-[14px] leading-[1.43] text-ember font-[family-name:var(--font-geist)]">
            {error}
          </p>
        </Card>
      )}

      {storageWarning && !job && (
        <Card role="alert" className="p-4 border-ember/40">
          <p className="text-[14px] leading-[1.43] text-ember font-[family-name:var(--font-geist)]">
            {storageWarning}
          </p>
        </Card>
      )}

      {isInstantTool && fileInfoData && !isDuplicateTool && (
        <Card className="p-5 space-y-3">
          <h3 className="text-[16px] leading-[1.5] font-medium text-ink font-[family-name:var(--font-geist)]">
            File Information
          </h3>
          <dl className="space-y-2 text-[14px] font-[family-name:var(--font-geist)]">
            <InfoRow label="Name" value={fileInfoData.name} />
            <InfoRow label="Type" value={fileInfoData.type} />
            <InfoRow label="Extension" value={fileInfoData.extension} />
            <InfoRow label="Size" value={formatInfoSize(fileInfoData.size)} />
            <InfoRow label="Last modified" value={new Date(fileInfoData.lastModified).toLocaleString()} />
            {fileInfoData.dimensions && (
              <InfoRow label="Dimensions" value={`${fileInfoData.dimensions.width} × ${fileInfoData.dimensions.height} px`} />
            )}
            {fileInfoData.metadata?.make && (
              <InfoRow label="Camera make" value={fileInfoData.metadata.make} />
            )}
            {fileInfoData.metadata?.model && (
              <InfoRow label="Camera model" value={fileInfoData.metadata.model} />
            )}
            {fileInfoData.metadata?.dateTaken && (
              <InfoRow label="Date taken" value={fileInfoData.metadata.dateTaken} />
            )}
            {fileInfoData.duration !== undefined && (
              <InfoRow label="Duration" value={formatDuration(fileInfoData.duration)} />
            )}
            {fileInfoData.bitrate !== undefined && (
              <InfoRow label="Bitrate" value={`${Math.round(fileInfoData.bitrate / 1000)} kbps`} />
            )}
            {fileInfoData.pageCount !== undefined && (
              <InfoRow label="Pages" value={String(fileInfoData.pageCount)} />
            )}
          </dl>
          <div className="flex items-center gap-3 pt-1">
            {hash ? (
              <p className="text-[12px] leading-[1.33] text-mid-gray font-mono break-all font-[family-name:var(--font-geist)]">
                SHA-256: {hash.slice(0, 24)}…
              </p>
            ) : (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleComputeHash}
                disabled={isComputingHash}
              >
                {isComputingHash ? 'Computing…' : 'Compute SHA-256'}
              </Button>
            )}
          </div>
        </Card>
      )}

      {isInstantTool && isDuplicateTool && duplicateGroups.length > 0 && (
        <Card className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] leading-[1.5] font-medium text-ink font-[family-name:var(--font-geist)]">
              Duplicate Files
            </h3>
            <Badge variant="soft">{duplicateGroups.length} groups</Badge>
          </div>
          <div className="space-y-3">
            {duplicateGroups.map((group) => (
              <div key={group.hash} className="space-y-1">
                <p className="text-[12px] leading-[1.33] text-mid-gray font-[family-name:var(--font-geist)]">
                  {group.files.length} copies · {formatFileSize(group.size)} each
                </p>
                {group.files.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center gap-2 py-1 px-2 text-[14px] leading-[1.43] font-[family-name:var(--font-geist)] bg-canvas rounded-[12px]"
                  >
                    <span className="text-ink truncate">{f.name}</span>
                    <span className="text-mid-gray text-[12px] shrink-0">{formatFileSize(f.size)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </Card>
      )}

      {isInstantTool && isDuplicateTool && duplicateGroups.length === 0 && files.length > 0 && (
        <Card className="p-5">
          <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
            No duplicate files found among the selected files.
          </p>
        </Card>
      )}

      {files.length > 0 && !isInstantTool && !job && (
        <>
          <MediaWarning files={files} />
          {tool.customPanel && (
            <tool.customPanel
              files={files}
              values={options}
              onChange={setOptions}
              onReorderFiles={storeReorderFiles}
            />
          )}
          <ToolOptionPanel
            options={tool.optionSchema}
            values={options}
            onChange={setOptions}
          />
          {isExtract && (isDesktop() || 'showDirectoryPicker' in window) && (
            <Card className="p-4 space-y-3">
              <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
                Choose a destination folder to extract into, or leave blank to save as a ZIP.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={handleChooseDir}>
                  {extractDir ? `✓ ${extractDir.name}` : 'Choose folder'}
                </Button>
                {extractDir && (
                  <Button variant="secondary" size="sm" onClick={() => setExtractDir(null)}>
                    Clear
                  </Button>
                )}
              </div>
            </Card>
          )}
          <Button onClick={handleRun} disabled={files.length === 0}>
            Run
          </Button>
        </>
      )}

      {job && (
        <JobProgress
          job={job}
          onCancel={handleCancel}
          onRetry={job.status === 'failed' ? handleRetry : undefined}
          onDownload={job.status === 'completed' ? handleDownload : undefined}
          onConvertAnother={handleConvertAnother}
          error={error ?? undefined}
          savedPath={savedPaths[job.id] ?? null}
        />
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-1 border-b border-hairline/50 last:border-b-0">
      <dt className="text-mid-gray">{label}</dt>
      <dd className="text-ink text-right">{value}</dd>
    </div>
  )
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

async function runDesktopData(
  kind: 'fileInfo' | 'duplicates',
  files: FileMeta[],
  controller: AbortController,
  onData: (data: unknown) => void,
  onError: (err: unknown) => void,
): Promise<void> {
  try {
    const { nativeEngine } = await import('@/engines/native')
    const res = await nativeEngine(kind).execute(files, {}, () => {}, controller.signal)
    onData(res.data)
  } catch (err) {
    onError(err)
  }
}

function toDuplicateGroups(data: unknown): DuplicateGroup[] {
  const groups = data as Array<{
    hash: string
    size: number
    files: Array<{ name: string; size: number }>
  }>
  return groups.map((g) => ({
    hash: g.hash,
    size: g.size,
    files: g.files.map((f) => ({
      id: `${g.hash}_${f.name}_${f.size}`,
      name: f.name,
      size: f.size,
      type: 'application/octet-stream',
      lastModified: 0,
    })),
  }))
}

function normalizeFileInfo(data: unknown, fallback: FileMeta): FileInfo {
  const raw = data as Partial<FileInfo>
  const info: FileInfo = {
    name: raw.name ?? fallback.name,
    size: raw.size ?? fallback.size,
    type: raw.type ?? fallback.type,
    extension: raw.extension ?? '',
    lastModified: raw.lastModified ?? fallback.lastModified,
  }
  if (raw.dimensions) info.dimensions = raw.dimensions
  if (raw.metadata) info.metadata = raw.metadata
  if (raw.duration !== undefined) info.duration = raw.duration
  if (raw.bitrate !== undefined) info.bitrate = raw.bitrate
  if (raw.pageCount !== undefined) info.pageCount = raw.pageCount
  if (raw.hash) info.hash = raw.hash
  return info
}

function formatInfoSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i] ?? 'TB'}`
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}