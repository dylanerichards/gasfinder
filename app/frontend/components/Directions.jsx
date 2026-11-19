import React from 'react'

// "650 m" up close, "2.1 mi" once it's a trip.
function formatDistance(meters) {
  if (!Number.isFinite(meters)) return ''
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1609.344).toFixed(1)} mi`
}

// "8 min", "1 h 5 min" — always at least a minute.
function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return ''
  const mins = Math.max(1, Math.round(seconds / 60))
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h} h ${m} min` : `${h} h`
}

const CarIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M3 11h18v5H3z" strokeLinejoin="round" />
    <circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" />
  </svg>
)
const WalkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="13" cy="4.5" r="1.8" />
    <path d="M13 8l-3 2 1 4-2 5M11 14l3 2 1 4M10 10l-3 1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const SpinnerIcon = () => (
  <svg className="gf-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
  </svg>
)

export default function Directions({ mode, onModeChange, status, route, destinationName }) {
  return (
    <section className="gf-route" aria-label="Directions">
      <div className="gf-route__head">
        <span className="til-eyebrow-c til-eyebrow-c--accent">
          <span className="til-eyebrow-c__dot" />
          Directions to {destinationName}
        </span>
        <div className="til-seg" role="group" aria-label="Travel mode">
          <button
            type="button"
            className="til-seg__opt gf-route__mode"
            aria-pressed={mode === 'drive'}
            onClick={() => onModeChange('drive')}
          >
            <CarIcon /> Drive
          </button>
          <button
            type="button"
            className="til-seg__opt gf-route__mode"
            aria-pressed={mode === 'walk'}
            onClick={() => onModeChange('walk')}
          >
            <WalkIcon /> Walk
          </button>
        </div>
      </div>

      <div className="gf-route__live" role="status" aria-live="polite">
        {status === 'loading' && (
          <div className="gf-stations__state">
            <SpinnerIcon />
            <span>Finding the best route…</span>
          </div>
        )}

        {status === 'error' && (
          <div className="gf-stations__state">Couldn’t load directions. Try again or switch mode.</div>
        )}

        {status === 'ready' && route && (
          <>
            <div className="gf-route__summary">
              <span className="gf-route__icon" aria-hidden="true">
                {mode === 'walk' ? <WalkIcon /> : <CarIcon />}
              </span>
              <span className="gf-route__time">{formatDuration(route.duration_s)}</span>
              <span className="gf-route__sep" aria-hidden="true">·</span>
              <span className="gf-route__dist">{formatDistance(route.distance_m)}</span>
              <span className="gf-route__mode-label">{mode === 'walk' ? 'walking' : 'driving'}</span>
            </div>

            {route.steps && route.steps.length > 0 && (
              <ol className="gf-steps">
                {route.steps.map((step, i) => (
                  <li key={i} className="gf-step">
                    <span className="gf-step__n" aria-hidden="true">{i + 1}</span>
                    <span className="gf-step__instruction">{step.instruction}</span>
                    {step.distance_m > 0 && (
                      <span className="gf-step__dist">{formatDistance(step.distance_m)}</span>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </>
        )}
      </div>
    </section>
  )
}
