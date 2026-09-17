// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Navigation } from '@/components/navigation'

function renderNav() {
  return render(
    <MemoryRouter initialEntries={['/jobs']}>
      <Navigation />
    </MemoryRouter>,
  )
}

describe('Navigation', () => {
  // The component renders a desktop <aside> and a mobile <nav>, so every link
  // appears twice; assert through the first occurrence of each.
  const first = (name: string) => screen.getAllByRole('link', { name })[0]

  it('links to Home, Tools, Jobs, History and Settings', () => {
    renderNav()
    expect(first('Home')).toHaveAttribute('href', '/')
    expect(first('Tools')).toHaveAttribute('href', '/tools')
    expect(first('Jobs')).toHaveAttribute('href', '/jobs')
    expect(first('History')).toHaveAttribute('href', '/history')
    expect(first('Settings')).toHaveAttribute('href', '/settings')
  })

  it('marks the current route link as active', () => {
    renderNav()
    const jobsLink = first('Jobs')
    // NavLink applies aria-current="page" on the active route
    expect(jobsLink).toHaveAttribute('aria-current', 'page')
    expect(first('Home')).not.toHaveAttribute('aria-current')
  })

  it('renders both a desktop and a mobile navigation instance', () => {
    renderNav()
    const jobsLinks = screen.getAllByRole('link', { name: 'Jobs' })
    expect(jobsLinks).toHaveLength(2)
  })
})