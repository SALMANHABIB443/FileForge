// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { GlobalJobIndicator } from '@/components/global-job-indicator'
import { enqueueJob, deleteJobFromQueue, getIncompleteJobs, initQueue } from '@/services/queue'
import { getAllJobs } from '@/services/job-service'
import { registerTool } from '@/services/tool-registry'
import type { FileMeta } from '@/types/job'

const gates: Array<{ resolve: () => void }> = []

function makeInputs(name: string): FileMeta[] {
  return [{ id: `gi_${name}`, name, size: 8, type: 'text/plain', lastModified: 0, path: `C:\\gi\\${name}` }]
}

function registerGatedTool(id: string): void {
  registerTool({
    id,
    name: id,
    description: 'test',
    category: 'quick-convert',
    supportedInputs: ['*'],
    defaultOptions: {},
    optionSchema: [],
    engine: {
      async execute() {
        await new Promise<void>((resolve) => gates.push({ resolve }))
        return { blob: new Blob(['ok']), filename: 'out.txt' }
      },
    },
  })
}

function renderIndicator() {
  return render(
    <MemoryRouter>
      <GlobalJobIndicator />
    </MemoryRouter>,
  )
}

describe('GlobalJobIndicator', () => {
  afterEach(async () => {
    for (const gate of gates) gate.resolve()
    gates.length = 0
    for (const job of getAllJobs()) deleteJobFromQueue(job.id)
  })

  it('renders nothing when no jobs are running', () => {
    renderIndicator()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  // Runs before initQueue() is ever called: while the pump is not started a
  // job stays pending and the indicator must still announce it as queued.
  it('keeps the indicator mounted while a queued job is pending', () => {
    registerGatedTool('gi-queued')
    enqueueJob({ toolId: 'gi-queued', inputs: makeInputs('a.txt') })

    expect(getIncompleteJobs().some((j) => j.toolId === 'gi-queued')).toBe(true)
    renderIndicator()
    expect(screen.getByText(/gi-queued queued/)).toBeInTheDocument()
  })

  it('announces a processing job with its tool name and progress', async () => {
    await initQueue()
    registerGatedTool('gi-processing')
    enqueueJob({ toolId: 'gi-processing', inputs: makeInputs('a.txt') })

    renderIndicator()

    expect(screen.getByText(/gi-processing…/)).toBeInTheDocument()
    expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'View' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Dismiss job indicator' })).toBeInTheDocument()
  })

  it('shows an active-count badge when more than one job is in flight', async () => {
    await initQueue()
    registerGatedTool('gi-multi')
    enqueueJob({ toolId: 'gi-multi', inputs: makeInputs('a.txt') })
    enqueueJob({ toolId: 'gi-multi', inputs: makeInputs('b.txt') })

    renderIndicator()

    expect(screen.getByText('2 active')).toBeInTheDocument()
  })

  it('can be dismissed by the user', async () => {
    const user = userEvent.setup()
    await initQueue()
    registerGatedTool('gi-dismiss')
    enqueueJob({ toolId: 'gi-dismiss', inputs: makeInputs('a.txt') })

    renderIndicator()

    await user.click(screen.getByRole('button', { name: 'Dismiss job indicator' }))
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })
})