import React, { useEffect, useState } from 'react'

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <path d="M20 6 9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// Our own custom confirmation message (toast). Appears when `trigger` changes,
// then auto-dismisses. No browser-native alert()/confirm() anywhere.
export default function Confirmation({ message, trigger }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!trigger) return undefined
    setShow(true)
    const t = setTimeout(() => setShow(false), 3600)
    return () => clearTimeout(t)
  }, [trigger])

  return (
    <div className={`gf-toast${show ? ' is-show' : ''}`} role="status" aria-live="polite">
      <span className="gf-toast__icon"><CheckIcon /></span>
      <span className="gf-toast__msg">{message}</span>
      <button type="button" className="gf-toast__close" aria-label="Dismiss" onClick={() => setShow(false)}>×</button>
    </div>
  )
}
