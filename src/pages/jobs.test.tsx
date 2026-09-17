// @vitest-environment jsdom
import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Jobs from '@/pages/jobs'
import { enqueueJob, deleteJobFromQueue, getTerminalJobs, initQueue } from '@/services/queue'
import { getAllJobs } from '@/services/job-service'
import { registerTool } from '@/services/tool-registry'
import { mockFileForge, clearFileForge } from '@/test/factories'
import type { FileMeta } from '@/types/job'

const gates: Array<{ resolve: () => void }> = []

function makeInputs(name: string): FileMeta[] {
  return [{ id: `jobs_${name}`, name, size: 8, type: 'text/plain', lastModified: 0, path: `C:\\jobs\\${name}` }]
}

async function tick(ms = 30): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

beforeEach(async () => {
  mockFileForge()
  await initQueue()
})

afterEach(async () => {
  for (const gate of gates) gate.resolve()
  gates.length = 0
  for (const job of getAllJobs()) deleteJobFromQueue(job.id)
  clearFileForge()
})

describe('Jobs page', () => {
  it('shows an empty state when nothing has run yet', () => {
    render(<Jobs />)
    expect(screen.getByRole('heading', { name: 'Jobs' })).toBeInTheDocument()
    expect(screen.getByText('Nothing running')).toBeInTheDocument()
    expect(screen.getByText('No finished jobs')).toBeInTheDocument()
  })

  it('lists a finished job under Finished this session', async () => {
    registerTool({
      id: 'jobs-instant',
      name: 'Instant',
      description: 'test',
      category: 'quick-convert',
      supportedInputs: ['*'],
      defaultOptions: {},
      optionSchema: [],
      engine: {
        async execute() {
          return { blob: new Blob(['ok']), filename: 'out.txt' }
        },
      },
    })
    enqueueJob({ toolId: 'jobs-instant', inputs: makeInputs('done.txt') })
    await tick()

    render(<Jobs />)

    const finished = screen.getByRole('region', { name: 'Finished jobs' })
    expect(finished.textContent).toContain('done.txt')
    expect(screen.getByText('✓ Completed')).toBeInTheDocument()
  })

  it('exposes a retry action for failed retryable jobs', async () => {
    registerTool({
      id: 'jobs-fail',
      name: 'Failer',
      description: 'test',
      category: 'quick-convert',
      supportedInputs: ['*'],
      defaultOptions: {},
      optionSchema: [],
      engine: {
        async execute() {
          throw new Error('nope')
        },
      },
    })
    enqueueJob({ toolId: 'jobs-fail', inputs: makeInputs('bad.txt') })
    await tick(60)

    render(<Jobs />)

    expect(await screen.findByText('Retry failed (1)')).toBeInTheDocument()
    expect(screen.getByText('nope')).toBeInTheDocument()
  })

  it('clears finished jobs via the toolbar action', async () => {
    const user = userEvent.setup()
    registerTool({
      id: 'jobs-clear',
      name: 'Clearer',
      description: 'test',
      category: 'quick-convert',
      supportedInputs: ['*'],
      defaultOptions: {},
      optionSchema: [],
      engine: {
        async execute() {
          return { blob: new Blob(['ok']), filename: 'out.txt' }
        },
      },
    })
    enqueueJob({ toolId: 'jobs-clear', inputs: makeInputs('clear.txt') })
    await tick()

    render(<Jobs />)
    await user.click(screen.getByRole('button', { name: 'Clear finished' }))
    expect(getTerminalJobs()).toHaveLength(0)
  })
})