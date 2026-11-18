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
const BoltIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" strokeLinejoin="round" />
  </svg>
)

function detailOf(station) {
  return [station.brand, station.address].filter(Boolean).join(' · ')
}

export default function StationList({ status, stations, destinationId, onSelect, open, onShowAll, onShortest, autoPicking }) {
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

  const chosen = stations.find((s) => s.id === destinationId) || null
  const chosenIndex = stations.findIndex((s) => s.id === destinationId)

  return (
    <section className="gf-stations-sec" aria-label="Nearest gas stations">
      <div className="gf-stations__head">
        {open ? (
          <>
            <span className="til-eyebrow-c">
              <span className="til-eyebrow-c__dot" />
              5 nearest stations
            </span>
            <div className="gf-auto">
              <button
                type="button"
                className="gf-auto__btn"
                onClick={() => onShortest('drive')}
                disabled={Boolean(autoPicking)}
                aria-label="Set the station with the shortest driving route"
              >
                {autoPicking === 'drive' ? <SpinnerIcon /> : <BoltIcon />} Shortest drive
              </button>
              <button
                type="button"
                className="gf-auto__btn"
                onClick={() => onShortest('walk')}
                disabled={Boolean(autoPicking)}
                aria-label="Set the station with the shortest walking route"
              >
                {autoPicking === 'walk' ? <SpinnerIcon /> : <BoltIcon />} Shortest walk
              </button>
            </div>
          </>
        ) : (
          <>
            <span className="til-eyebrow-c til-eyebrow-c--accent">
              <span className="til-eyebrow-c__dot" />
              Destination
            </span>
            <button type="button" className="til-btn til-btn--sm til-btn--ghost gf-stations__showall" onClick={onShowAll}>
              Show all {stations.length}
            </button>
          </>
        )}
      </div>

      {!open && chosen && (
        <div className="gf-chosen">
          <span className="gf-station__n" aria-hidden="true">{chosenIndex + 1}</span>
          <div className="gf-station__text">
            <span className="gf-station__name">
              {chosen.name}
              <span className="til-badge til-badge--accent gf-station__tag"><CheckIcon /> Destination</span>
            </span>
            <span className="gf-station__meta">
              <span className="gf-station__dist">{formatDistance(chosen.distance_m)}</span>
              {detailOf(chosen) && <span className="gf-station__detail">{detailOf(chosen)}</span>}
            </span>
          </div>
        </div>
      )}

      <div className="gf-stations__collapsible" data-open={open}>
        <div className="gf-stations__inner">
          <ul className="gf-stations">
            {stations.map((station, i) => {
              const selected = station.id === destinationId
              return (
                <li key={station.id} className={`gf-station${selected ? ' is-selected' : ''}`}>
                  <span className="gf-station__n" aria-hidden="true">{i + 1}</span>
                  <div className="gf-station__text">
                    <span className="gf-station__name">
                      {station.name}
                      {selected && (
                        <span className="til-badge til-badge--accent gf-station__tag"><CheckIcon /> Destination</span>
                      )}
                    </span>
                    <span className="gf-station__meta">
                      <span className="gf-station__dist">{formatDistance(station.distance_m)}</span>
                      {detailOf(station) && <span className="gf-station__detail">{detailOf(station)}</span>}
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
        </div>
      </div>
    </section>
  )
}
