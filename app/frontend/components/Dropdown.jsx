import React, { useState, useRef, useEffect, useCallback } from 'react'

const Chevron = () => (
  <svg className="gf-dd__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const SearchIcon = () => (
  <svg className="gf-dd__search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" strokeLinecap="round" />
  </svg>
)

// Our own custom dropdown / combobox — replaces native <select> everywhere.
// options: [{ value, label, hint? }]
export default function Dropdown({
  options,
  value,
  onChange,
  placeholder = 'Select…',
  searchable = false,
  searchPlaceholder = 'Search…',
  ariaLabel,
  invalid = false,
  id,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const rootRef = useRef(null)
  const searchRef = useRef(null)

  const selected = options.find((o) => o.value === value) || null
  const q = query.trim().toLowerCase()
  const filtered =
    searchable && q
      ? options.filter((o) => `${o.label} ${o.hint || ''}`.toLowerCase().includes(q))
      : options

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActive(-1)
  }, [])

  const choose = useCallback(
    (opt) => {
      onChange(opt.value, opt)
      close()
    },
    [onChange, close]
  )

  // Close on outside click.
  useEffect(() => {
    if (!open) return undefined
    const onDoc = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close()
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open, close])

  // Focus the search field when opening.
  useEffect(() => {
    if (open && searchable && searchRef.current) searchRef.current.focus()
  }, [open, searchable])

  const onKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!open) { setOpen(true); return }
        setActive((a) => Math.min(a + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
        break
      case 'Enter':
        if (open && active >= 0 && filtered[active]) {
          e.preventDefault()
          choose(filtered[active])
        }
        break
      case 'Escape':
        if (open) { e.preventDefault(); close() }
        break
      default:
        break
    }
  }

  return (
    <div className={`gf-dd${open ? ' is-open' : ''}`} ref={rootRef}>
      <button
        type="button"
        id={id}
        className={`gf-dd__control${invalid ? ' is-invalid' : ''}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => (open ? close() : setOpen(true))}
        onKeyDown={onKeyDown}
      >
        <span className={selected ? 'gf-dd__value' : 'gf-dd__placeholder'}>
          {selected ? selected.label : placeholder}
        </span>
        <Chevron />
      </button>

      {open && (
        <div className="gf-dd__panel">
          {searchable && (
            <div className="gf-dd__search">
              <SearchIcon />
              <input
                ref={searchRef}
                className="gf-dd__search-input"
                placeholder={searchPlaceholder}
                value={query}
                onChange={(e) => { setQuery(e.target.value); setActive(0) }}
                onKeyDown={onKeyDown}
              />
            </div>
          )}
          <ul className="gf-dd__list" role="listbox" aria-label={ariaLabel}>
            {filtered.length === 0 && <li className="gf-dd__empty">No matches</li>}
            {filtered.map((o, i) => (
              <li
                key={o.value}
                role="option"
                aria-selected={o.value === value}
                className={`gf-dd__opt${i === active ? ' is-active' : ''}${o.value === value ? ' is-selected' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => { e.preventDefault(); choose(o) }}
              >
                <span className="gf-dd__opt-label">{o.label}</span>
                {o.hint && <span className="gf-dd__opt-hint">{o.hint}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
