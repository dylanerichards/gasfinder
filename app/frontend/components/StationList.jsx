import React from 'react'

// "650 m" up close, "0.4 mi" once it's a drive.
function formatDistance(meters) {
  if (!Number.isFinite(meters)) return ''
  if (meters < 1000) return `${Math.round(meters)} m`
  return `${(meters / 1609.344).toFixed(1)} mi`
}

const PinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" strokeLinejoin="round" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
)
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden="true">
    <path d="M5 12.5l4.5 4.5L19 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const SpinnerIcon = () => (
  <svg className="gf-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 3a9 9 0 1 0 9 9" strokeLinecap="round" />
  </svg>
)

export default function StationList({ status, stations, destinationId, onSelect }) {
  if (status === 'loading') {
    return (
      <div className="gf-stations__state" role="status" aria-live="polite">
        <SpinnerIcon />
        <span>Finding nearby gas stations…</span>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="gf-stations__state" role="status" aria-live="polite">
        Couldn’t load gas stations. Try changing your location.
      </div>
    )
  }

  if (status === 'ready' && stations.length === 0) {
    return (
      <div className="gf-stations__state" role="status" aria-live="polite">
        No gas stations found nearby.
      </div>
    )
  }

  if (status !== 'ready') return null

  return (
    <section aria-label="Nearest gas stations">
      <div className="gf-stations__head">
        <span className="til-eyebrow-c">
          <span className="til-eyebrow-c__dot" />
          5 nearest stations
        </span>
      </div>
      <ul className="gf-stations">
        {stations.map((station, i) => {
          const selected = station.id === destinationId
          const detail = [station.brand, station.address].filter(Boolean).join(' · ')
          return (
            <li key={station.id} className={`gf-station${selected ? ' is-selected' : ''}`}>
              <span className="gf-station__n" aria-hidden="true">{i + 1}</span>
              <div className="gf-station__text">
                <span className="gf-station__name">
                  {station.name}
                  {selected && (
                    <span className="til-badge til-badge--accent gf-station__tag">
                      <CheckIcon /> Destination
                    </span>
                  )}
                </span>
                <span className="gf-station__meta">
                  <span className="gf-station__dist">{formatDistance(station.distance_m)}</span>
                  {detail && <span className="gf-station__detail">{detail}</span>}
                </span>
              </div>
              <button
                type="button"
                className={`til-btn til-btn--sm${selected ? ' til-btn--primary' : ''} gf-station__btn`}
                aria-pressed={selected}
                onClick={() => onSelect(station)}
              >
                {selected ? <><CheckIcon /> Selected</> : <><PinIcon /> Set as destination</>}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
