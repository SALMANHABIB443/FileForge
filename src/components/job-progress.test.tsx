// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JobProgress } from '@/components/job-progress'
import { mockFileForge, clearFileForge, makeJob } from '@/test/factories'

describe('JobProgress', () => {
  beforeEach(() => {
    mockFileForge()
  })
  afterEach(() => {
    clearFileForge()
  })

  it('shows the progress bar and live percent while processing', () => {
    const job = makeJob({
      status: 'processing',
      progress: { percent: 42, message: 'Encoding…', index: 1, total: 3 },
    })
    render(<JobProgress job={job} />)

    expect(screen.getByRole('heading', { name: 'Processing…' })).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '42')
    expect(screen.getByText('42%')).toBeInTheDocument()
    expect(screen.getByText(/File 1 of 3/)).toBeInTheDocument()
    expect(screen.getByText(/Encoding…/)).toBeInTheDocument()
  })

  it('announces completion with 100% and offers Save/Convert another actions', async () => {
    const user = userEvent.setup()
    const onDownload = vi.fn()
    const onConvertAnother = vi.fn()
    const job = makeJob({
      status: 'completed',
      progress: { percent: 100 },
      outputSize: 512,
    })
    render(<JobProgress job={job} onDownload={onDownload} onConvertAnother={onConvertAnother} />)

    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument()
    expect(screen.getByText('100%')).toBeInTheDocument()
    expect(screen.queryByText(/Saved to /)).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onDownload).toHaveBeenCalledTimes(1)

    await user.click(screen.getByRole('button', { name: 'Convert another' }))
    expect(onConvertAnother).toHaveBeenCalledTimes(1)
  })

  it('shows the saved path and desktop action buttons once saved', () => {
    const job = makeJob({
      status: 'completed',
      progress: { percent: 100 },
      savedPath: 'C:\\Users\\out\\result.pdf',
    })
    render(<JobProgress job={job} savedPath="C:\\Users\\out\\result.pdf" />)

    expect(screen.getByText('Saved to C:\\Users\\out\\result.pdf')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open file' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open folder' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy path' })).toBeInTheDocument()
  })

  it('surfaces a readable error and a Retry button when the job fails', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    const job = makeJob({
      status: 'failed',
      progress: { percent: 18 },
      error: 'decode failed',
      errorDetails: 'stack trace here',
    })
    render(<JobProgress job={job} onRetry={onRetry} error="decode failed" />)

    expect(screen.getByRole('alert')).toHaveTextContent('decode failed')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('shows the cancelled state with a Convert another action', () => {
    const job = makeJob({
      status: 'cancelled',
      progress: { percent: 30 },
    })
    render(<JobProgress job={job} onConvertAnother={vi.fn()} />)

    expect(screen.getByRole('heading', { name: 'Cancelled' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Convert another' })).toBeInTheDocument()
  })
})