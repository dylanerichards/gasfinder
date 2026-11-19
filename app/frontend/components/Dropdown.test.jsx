import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import Dropdown from './Dropdown'

const options = [
  { value: 'ferry', label: 'Ferry Building' },
  { value: 'union', label: 'Union Square', hint: 'Downtown' },
  { value: 'presidio', label: 'Presidio' },
]

describe('Dropdown', () => {
  it('shows the placeholder and opens to list options', async () => {
    const user = userEvent.setup()
    render(<Dropdown options={options} onChange={() => {}} placeholder="Pick a spot" />)

    expect(screen.getByText('Pick a spot')).toBeInTheDocument()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button'))

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByText('Ferry Building')).toBeInTheDocument()
    expect(screen.getByText('Presidio')).toBeInTheDocument()
  })

  it('calls onChange with the chosen option and closes', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Dropdown options={options} onChange={onChange} />)

    await user.click(screen.getByRole('button'))
    await user.click(screen.getByText('Union Square'))

    expect(onChange).toHaveBeenCalledWith('union', options[1])
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('shows the selected label on the control', () => {
    render(<Dropdown options={options} value="presidio" onChange={() => {}} />)
    expect(screen.getByRole('button')).toHaveTextContent('Presidio')
  })

  it('filters options client-side when searchable', async () => {
    const user = userEvent.setup()
    render(<Dropdown options={options} onChange={() => {}} searchable searchPlaceholder="Find…" />)

    await user.click(screen.getByRole('button'))
    await user.type(screen.getByPlaceholderText('Find…'), 'presid')

    expect(screen.getByText('Presidio')).toBeInTheDocument()
    expect(screen.queryByText('Ferry Building')).not.toBeInTheDocument()
  })

  it('runs an async search only past the minimum characters', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn().mockResolvedValue([ { value: '1', label: '1 Market St' } ])
    render(<Dropdown onChange={() => {}} onSearch={onSearch} minChars={3} searchPlaceholder="Address" />)

    await user.click(screen.getByRole('button'))
    const input = screen.getByPlaceholderText('Address')

    await user.type(input, 'ma')
    expect(screen.getByText(/Type at least 3 characters/)).toBeInTheDocument()
    expect(onSearch).not.toHaveBeenCalled()

    await user.type(input, 'rket')
    expect(await screen.findByText('1 Market St')).toBeInTheDocument()
    expect(onSearch).toHaveBeenCalledWith('market')
  })

  it('opens and selects the active option with the keyboard', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Dropdown options={options} onChange={onChange} />)

    screen.getByRole('button').focus()
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}')

    expect(onChange).toHaveBeenCalledWith('ferry', options[0])
  })
})
