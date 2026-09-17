// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueueJobCard } from '@/components/queue-job-card'
import { mockFileForge, clearFileForge, makeJob } from '@/test/factories'

describe('QueueJobCard', () => {
  beforeEach(() => {
    mockFileForge()
  })
  afterEach(() => {
    clearFileForge()
  })

  it('renders the input file names and the tool name', () => {
    const job = makeJob({
      toolId: 'image-convert',
      status: 'pending',
      inputs: [{ id: 'f1', name: 'photo.jpg', size: 1024, type: 'image/jpeg', lastModified: 0, path: 'C:\\f1.jpg' }],
      progress: { percent: 0 },
    })
    const { container } = render(<QueueJobCard job={job} />)
    expect(container).toBeInTheDocument()
    expect(container.textContent).toContain('photo.jpg')
    // fallback to tool id when the tool is not registered in this environment
    expect(container.textContent).toContain('image-convert')
  })

  it('shows a progress bar with an accessible value while active', () => {
    const job = makeJob({
      status: 'processing',
      progress: { percent: 61, message: 'Resizing', index: 1, total: 2 },
    })
    render(<QueueJobCard job={job} />)

    const bar = screen.getByRole('progressbar')
    expect(bar).toHaveAttribute('aria-valuemin', '0')
    expect(bar).toHaveAttribute('aria-valuemax', '100')
    expect(bar).toHaveAttribute('aria-valuenow', '61')
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('marks completed jobs as completed and offers Save + Remove', async () => {
    const user = userEvent.setup()
    const job = makeJob({
      toolId: 'image-convert',
      status: 'completed',
      progress: { percent: 100 },
      outputPath: 'C:\\out\\out.png',
      outputName: 'out.png',
    })
    render(<QueueJobCard job={job} />)

    expect(screen.getByText('✓ Completed')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(window.fileforge!.saveAsFile).toHaveBeenCalledWith({
      sourcePath: 'C:\\out\\out.png',
      suggestedName: 'out.png',
      defaultDir: undefined,
    })
    await user.click(screen.getByRole('button', { name: 'Remove' }))
  })

  it('exposes the failure reason as an alert for failed jobs', async () => {
    const user = userEvent.setup()
    const job = makeJob({
      status: 'failed',
      progress: { percent: 10 },
      error: 'boom',
      inputs: [{ id: 'f', name: 'in.png', size: 8, type: 'image/png', lastModified: 0, path: 'C:\\in.png' }],
    })
    render(<QueueJobCard job={job} />)

    expect(screen.getByRole('alert')).toHaveTextContent('boom')
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
  })
})