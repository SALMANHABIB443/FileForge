import { useState, useEffect, type DragEvent } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { getTool, getAllTools } from '@/services/tool-registry'
import { pickFiles, fileMetasFromFiles } from '@/services/file-service'
import { runJob, cancelRunningJob } from '@/services/job-runner'
import { getAllJobs, subscribeToJob } from '@/services/job-service'
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
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [hash, setHash] = useState<string | null>(null)
  const [isComputingHash, setIsComputingHash] = useState(false)
  const [storageWarning, setStorageWarning] = useState<string | null>(null)

  const isInstantTool = tool && !tool.engine
  const isDuplicateTool = toolId === 'duplicate-detect'
  const isExtract = toolId === 'zip-extract'

  useEffect(() => {
    if (tool && isInstantTool && files.length > 0) {
      if (isDuplicateTool) {
        import('@/engines/duplicate-engine')
          .then((m) => m.findDuplicates(files))
          .then(setDuplicateGroups)
          .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      } else {
        import('@/engines/file-info-engine')
          .then((m) => m.getFileInfo(files[0]!))
          .then((info) => {
            setFileInfoData(info)
            setHash(info.hash ?? null)
          })
          .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      }
    }
  }, [tool, isInstantTool, isDuplicateTool, files])

  const jobId = job?.id
  useEffect(() => {
    if (!jobId) return
    return subscribeToJob(jobId, setJob)
  }, [jobId])

  const handlePickFiles = async () => {
    const picked = await pickFiles()
    if (picked.length > 0) {
      storeSelectFiles(picked)
      setJob(null)
      setFileInfoData(null)
      setError(null)
      setHash(null)
    }
  }

  const handleDrop = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const incoming = e.dataTransfer?.files
    if (incoming && incoming.length > 0) {
      storeSelectFiles(fileMetasFromFiles(Array.from(incoming)))
      setJob(null)
      setFileInfoData(null)
      setError(null)
      setHash(null)
    }
  }

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleChooseDir = async () => {
    if (typeof window !== 'undefined' && 'showDirectoryPicker' in window) {
      try {
        const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
        setDirectoryHandle(handle)
      } catch {
        // cancelled
      }
    }
  }

  const handleComputeHash = async () => {
    if (!files[0]) return
    setIsComputingHash(true)
    try {
      const { computeFileHash } = await import('@/engines/file-info-engine')
      const value = await computeFileHash(files[0])
      setHash(value)
      setFileInfoData((info) => (info ? { ...info, hash: value } : info))
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsComputingHash(false)
    }
  }

  const handleRun = async () => {
    if (!tool || files.length === 0) return
    setError(null)

    const opts = { ...options }
    if (isExtract && directoryHandle) {
      opts.directoryHandle = directoryHandle
    }

    const totalInput = files.reduce((sum, f) => sum + f.size, 0)
    setStorageWarning(null)
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
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
      const result = await runJob({
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

  const handleDownload = () => {
    if (job?.outputBlob) {
      downloadBlob(job.outputBlob, job.outputName ?? 'output')
    }
  }

  const handleConvertAnother = () => {
    setJob(null)
    setFileInfoData(null)
    setDuplicateGroups([])
    setHash(null)
    storeSelectFiles([])
    setOptions(tool?.defaultOptions ?? {})
  }

  const handlePickDifferent = () => {
    setJob(null)
    setFileInfoData(null)
    setDuplicateGroups([])
    setHash(null)
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
          {isExtract && 'showDirectoryPicker' in window && (
            <Card className="p-4 space-y-3">
              <p className="text-[14px] leading-[1.43] text-mid-gray font-[family-name:var(--font-geist)]">
                Choose a destination folder to extract into, or leave blank to save as a ZIP.
              </p>
              <Button variant="secondary" size="sm" onClick={handleChooseDir}>
                {directoryHandle ? `✓ ${directoryHandle.name}` : 'Choose folder'}
              </Button>
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
          onDownload={job.status === 'completed' ? handleDownload : undefined}
          onConvertAnother={handleConvertAnother}
          error={error ?? undefined}
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