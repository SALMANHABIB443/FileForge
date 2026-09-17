// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SavedFileActions } from '@/components/saved-file-actions'
import { mockFileForge, clearFileForge } from '@/test/factories'

const PATH = 'C:\\Users\\dev\\out\\final.zip'

describe('SavedFileActions', () => {
  beforeEach(() => {
    mockFileForge()
    // jsdom may or may not ship a clipboard; provide one that can be spied on.
    if (!navigator.clipboard || !navigator.clipboard.writeText) {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: vi.fn(async () => {}) },
        configurable: true,
      })
    }
  })
  afterEach(() => {
    clearFileForge()
  })

  it('renders nothing when the bridge is unavailable (browser build)', () => {
    clearFileForge()
    const { container } = render(<SavedFileActions path={PATH} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('offers Open file, Open folder and Copy path in the desktop app', () => {
    render(<SavedFileActions path={PATH} />)
    expect(screen.getByRole('button', { name: 'Open file' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Open folder' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Copy path' })).toBeInTheDocument()
  })

  it('opens the file through the shell bridge', async () => {
    const user = userEvent.setup()
    render(<SavedFileActions path={PATH} />)
    await user.click(screen.getByRole('button', { name: 'Open file' }))
    expect(window.fileforge!.openFile).toHaveBeenCalledWith(PATH)
  })

  it('reveals the file in its folder through the shell bridge', async () => {
    const user = userEvent.setup()
    render(<SavedFileActions path={PATH} />)
    await user.click(screen.getByRole('button', { name: 'Open folder' }))
    expect(window.fileforge!.showItemInFolder).toHaveBeenCalledWith(PATH)
  })

  it('copies the path and shows a transient Copied label', async () => {
    const user = userEvent.setup()
    const writeSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()
    render(<SavedFileActions path={PATH} />)
    await user.click(screen.getByRole('button', { name: 'Copy path' }))
    expect(writeSpy).toHaveBeenCalledWith(PATH)
    expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()
  })
})