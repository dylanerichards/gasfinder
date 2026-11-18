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

// Our own custom dropdown / combobox. Two modes:
//  - static:  pass `options`; optional client-side `searchable` filtering.
//  - async:   pass `onSearch(query) => Promise<options>` for a live API search.
// options / results: [{ value, label, hint? }]
export default function Dropdown({
  options = [],
  value,
  selected: selectedProp,
  onChange,
  onSearch,
  placeholder = 'Select…',
  searchable = false,
  searchPlaceholder = 'Search…',
  minChars = 3,
  ariaLabel,
  invalid = false,
  id,
}) {
  const isAsync = typeof onSearch === 'function'
  const hasSearch = isAsync || searchable

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(-1)
  const [remote, setRemote] = useState([])
  const [loading, setLoading] = useState(false)
  const rootRef = useRef(null)
  const searchRef = useRef(null)
  const reqRef = useRef(0)

  const q = query.trim()
  const clientFiltered =
    searchable && !isAsync && q
      ? options.filter((o) => `${o.label} ${o.hint || ''}`.toLowerCase().includes(q.toLowerCase()))
      : options
  const list = isAsync ? remote : clientFiltered

  const display = selectedProp || options.find((o) => o.value === value) || null

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setActive(-1)
    setRemote([])
    setLoading(false)
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
    if (open && hasSearch && searchRef.current) searchRef.current.focus()
  }, [open, hasSearch])

  // Debounced async search; ignores stale responses.
  useEffect(() => {
    if (!isAsync || !open) return undefined
    if (q.length < minChars) {
      setRemote([])
      setLoading(false)
      return undefined
    }
    setLoading(true)
    const id = (reqRef.current += 1)
    const timer = setTimeout(async () => {
      try {
        const results = await onSearch(q)
        if (id === reqRef.current) {
          setRemote(Array.isArray(results) ? results : [])
          setActive(results && results.length ? 0 : -1)
          setLoading(false)
        }
      } catch {
        if (id === reqRef.current) { setRemote([]); setLoading(false) }
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [q, isAsync, open, minChars, onSearch])

  const onKeyDown = (e) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        if (!open) { setOpen(true); return }
        setActive((a) => Math.min(a + 1, list.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActive((a) => Math.max(a - 1, 0))
        break
      case 'Enter':
        if (open && active >= 0 && list[active]) { e.preventDefault(); choose(list[active]) }
        break
      case 'Escape':
        if (open) { e.preventDefault(); close() }
        break
      default:
        break
    }
  }

  const renderBody = () => {
    if (isAsync && q.length < minChars) {
      return <li className="gf-dd__empty">Type at least {minChars} characters</li>
    }
    if (loading) return <li className="gf-dd__empty gf-dd__empty--loading">Searching…</li>
    if (list.length === 0) return <li className="gf-dd__empty">No matches</li>
    return list.map((o, i) => (
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
    ))
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
        <span className={display ? 'gf-dd__value' : 'gf-dd__placeholder'}>
          {display ? display.label : placeholder}
        </span>
        <Chevron />
      </button>

      {open && (
        <div className="gf-dd__panel">
          {hasSearch && (
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
            {renderBody()}
          </ul>
        </div>
      )}
    </div>
  )
}
