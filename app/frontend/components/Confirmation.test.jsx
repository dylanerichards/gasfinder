import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect } from 'vitest'
import Confirmation from './Confirmation'

describe('Confirmation', () => {
  it('renders the message', () => {
    render(<Confirmation message="Destination set" trigger={1} />)
    expect(screen.getByText('Destination set')).toBeInTheDocument()
  })

  it('becomes visible when triggered', () => {
    const { container } = render(<Confirmation message="Saved" trigger={1} />)
    expect(container.querySelector('.gf-toast')).toHaveClass('is-show')
  })

  it('stays hidden without a trigger', () => {
    const { container } = render(<Confirmation message="Saved" trigger={0} />)
    expect(container.querySelector('.gf-toast')).not.toHaveClass('is-show')
  })

  it('hides when dismissed', async () => {
    const user = userEvent.setup()
    const { container } = render(<Confirmation message="Saved" trigger={1} />)

    await user.click(screen.getByRole('button', { name: 'Dismiss' }))

    expect(container.querySelector('.gf-toast')).not.toHaveClass('is-show')
  })
})
