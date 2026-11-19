import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Directions from './Directions'

const route = {
  duration_s: 487,
  distance_m: 3380,
  steps: [
    { instruction: 'Head north on Market Street', distance_m: 120 },
    { instruction: 'Turn right onto Powell Street', distance_m: 90 },
    { instruction: 'You have arrived at your destination', distance_m: 0 },
  ],
}

function renderDirections(overrides = {}) {
  const props = {
    mode: 'drive',
    onModeChange: () => {},
    status: 'ready',
    route,
    destinationName: 'Shell',
    ...overrides,
  }
  return render(<Directions {...props} />)
}

describe('Directions', () => {
  it('formats the summary duration and distance', () => {
    renderDirections()
    expect(screen.getByText('8 min')).toBeInTheDocument()
    expect(screen.getByText('2.1 mi')).toBeInTheDocument()
    expect(screen.getByText(/Directions to Shell/)).toBeInTheDocument()
  })

  it('lists the turn-by-turn steps, dropping zero-distance ones from the distance column', () => {
    renderDirections({ mode: 'walk' })
    expect(screen.getByText('Head north on Market Street')).toBeInTheDocument()
    expect(screen.getByText('You have arrived at your destination')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
    expect(screen.getByText('120 m')).toBeInTheDocument()
  })

  it('marks the active travel mode with aria-pressed', () => {
    renderDirections({ mode: 'drive' })
    expect(screen.getByRole('button', { name: /drive/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /walk/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('calls onModeChange when a travel mode is picked', async () => {
    const user = userEvent.setup()
    const onModeChange = vi.fn()
    renderDirections({ onModeChange })

    await user.click(screen.getByRole('button', { name: /walk/i }))

    expect(onModeChange).toHaveBeenCalledWith('walk')
  })

  it('renders a loading state', () => {
    renderDirections({ status: 'loading', route: null })
    expect(screen.getByText(/Finding the best route/)).toBeInTheDocument()
  })

  it('renders an error state', () => {
    renderDirections({ status: 'error', route: null })
    expect(screen.getByText(/Couldn.t load directions/)).toBeInTheDocument()
  })
})
