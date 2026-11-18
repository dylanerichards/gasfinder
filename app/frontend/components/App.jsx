import React, { useState, useCallback } from 'react'
import LocationMap from './LocationMap'

// A few San Francisco reference points for quick selection.
const SF_PRESETS = [
  { name: 'Ferry Building', lat: 37.7955, lng: -122.3937 },
  { name: 'Union Square', lat: 37.788, lng: -122.4074 },
  { name: 'Mission Dolores Park', lat: 37.7596, lng: -122.4269 },
  { name: 'Golden Gate Park (de Young)', lat: 37.7694, lng: -122.4862 },
  { name: "Fisherman's Wharf", lat: 37.808, lng: -122.4177 },
  { name: 'Twin Peaks', lat: 37.7544, lng: -122.4477 },
  { name: 'Chase Center', lat: 37.768, lng: -122.3892 },
  { name: 'Presidio (Main Post)', lat: 37.7989, lng: -122.4662 },
]

const SF_BOUNDS = { minLat: 37.70, maxLat: 37.84, minLng: -122.53, maxLng: -122.34 }
const outsideSF = (lat, lng) =>
  lat < SF_BOUNDS.minLat || lat > SF_BOUNDS.maxLat || lng < SF_BOUNDS.minLng || lng > SF_BOUNDS.maxLng

// Per-field coordinate validation → null when valid, else a short message.
const COORD_RANGE = { lat: [-90, 90], lng: [-180, 180] }
function validateCoord(value, kind) {
  const v = value.trim()
  if (v === '') return 'Required'
  const n = Number(v)
  if (Number.isNaN(n)) return 'Must be a number'
  const [min, max] = COORD_RANGE[kind]
  if (n < min || n > max) return `Must be between ${min} and ${max}`
  return null
}

function geoErrorMessage(err) {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location permission was denied. Enable it in your browser, or enter a location manually.'
    case err.POSITION_UNAVAILABLE:
      return 'Your location is currently unavailable. Try again, or enter a location manually.'
    case err.TIMEOUT:
      return 'Timed out while finding your location. Try again, or enter a location manually.'
    default:
      return 'Something went wrong while finding your location.'
  }
}

const ChevronDown = () => (
  <svg className="til-select__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
const AlertIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><path d="M12 8v4" strokeLinecap="round" /><path d="M12 16h.01" strokeLinecap="round" />
  </svg>
)
const InfoIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="12" r="10" /><path d="M12 16v-4" strokeLinecap="round" /><path d="M12 8h.01" strokeLinecap="round" />
  </svg>
)

export default function App() {
  const [phase, setPhase] = useState('input') // 'input' | 'exiting' | 'located'
  const [mode, setMode] = useState('detect') // 'detect' | 'manual'
  const [status, setStatus] = useState('idle') // detect: 'idle' | 'locating' | 'error'
  const [error, setError] = useState(null)
  const [position, setPosition] = useState(null) // { lat, lng, accuracy, source, timestamp }

  const [latInput, setLatInput] = useState('')
  const [lngInput, setLngInput] = useState('')
  const [preset, setPreset] = useState('')
  const [touched, setTouched] = useState({ lat: false, lng: false })
  const [submitAttempted, setSubmitAttempted] = useState(false)

  // Run the reveal choreography: text out → "Your location" + map in.
  const reveal = useCallback((pos) => {
    setPosition(pos)
    setStatus('idle')
    setPhase('exiting')
    window.setTimeout(() => setPhase('located'), 260)
  }, [])

  const changeLocation = useCallback(() => {
    setPhase('input')
    setPosition(null)
    setError(null)
  }, [])

  const detect = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setStatus('error')
      setError('Geolocation is not supported by this browser. Enter a location manually instead.')
      return
    }
    setStatus('locating')
    setError(null)
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        reveal({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          source: 'Device GPS',
          timestamp: pos.timestamp,
        }),
      (err) => {
        setError(geoErrorMessage(err))
        setStatus('error')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }, [reveal])

  const choosePreset = useCallback((name) => {
    setPreset(name)
    const p = SF_PRESETS.find((x) => x.name === name)
    if (p) {
      setLatInput(String(p.lat))
      setLngInput(String(p.lng))
      setTouched({ lat: false, lng: false })
      setSubmitAttempted(false)
    }
  }, [])

  const submitManual = useCallback(
    (e) => {
      e.preventDefault()
      setSubmitAttempted(true)
      if (validateCoord(latInput, 'lat') || validateCoord(lngInput, 'lng')) return
      reveal({
        lat: Number(latInput),
        lng: Number(lngInput),
        accuracy: null,
        source: preset ? `Preset — ${preset}` : 'Manual entry',
        timestamp: Date.now(),
      })
    },
    [latInput, lngInput, preset, reveal]
  )

  const latError = touched.lat || submitAttempted ? validateCoord(latInput, 'lat') : null
  const lngError = touched.lng || submitAttempted ? validateCoord(lngInput, 'lng') : null

  const locating = status === 'locating'
  const located = phase === 'located'
  const showSFNote = position && outsideSF(position.lat, position.lng)
  const mapUrl =
    position &&
    `https://www.openstreetmap.org/?mlat=${position.lat}&mlon=${position.lng}#map=15/${position.lat}/${position.lng}`

  return (
    <main className="gf-page">
      <div className={`gf-stage${located ? ' is-located' : ''}`}>
        <div className="gf-main">
          {!located && (
            <div className={`gf-intro${phase === 'exiting' ? ' is-exiting' : ''}`}>
              <header className="gf-intro__head">
                <span className="til-eyebrow-c til-eyebrow-c--accent">
                  <span className="til-eyebrow-c__dot" />
                  Gas Finder · San Francisco
                </span>
                <h1 className="til-h1 gf-title">Find the nearest gas station.</h1>
                <p className="til-body-lg gf-lede">
                  Start from where you are — let your browser locate you, or enter a
                  San Francisco location by hand.
                </p>
              </header>

              <section className="til-card gf-card">
                <div className="til-seg" role="group" aria-label="Location method">
                  <button
                    type="button"
                    className="til-seg__opt"
                    aria-checked={mode === 'detect'}
                    onClick={() => setMode('detect')}
                  >
                    Use my location
                  </button>
                  <button
                    type="button"
                    className="til-seg__opt"
                    aria-checked={mode === 'manual'}
                    onClick={() => setMode('manual')}
                  >
                    Enter a location
                  </button>
                </div>

                {mode === 'detect' && (
                  <div className="gf-panel">
                    <button
                      type="button"
                      className="til-btn til-btn--primary til-btn--lg til-btn--block"
                      onClick={detect}
                      disabled={locating}
                    >
                      {locating ? 'Locating…' : 'Find my location'}
                      {!locating && <span className="til-btn__arrow" aria-hidden="true">→</span>}
                    </button>
                    <p className="til-caption">Your browser will ask permission to share your location.</p>
                    {status === 'error' && (
                      <div className="til-callout til-callout--danger">
                        <span className="til-callout__icon"><AlertIcon /></span>
                        <div className="til-callout__main">
                          <span className="til-callout__body">{error}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {mode === 'manual' && (
                  <form className="gf-panel" onSubmit={submitManual}>
                    <div className="til-field">
                      <label className="til-field__label" htmlFor="gf-preset">
                        San Francisco landmark
                        <span className="til-field__optional">optional</span>
                      </label>
                      <div className="til-select">
                        <select
                          id="gf-preset"
                          className="til-input"
                          value={preset}
                          onChange={(e) => choosePreset(e.target.value)}
                        >
                          <option value="">Choose a point…</option>
                          {SF_PRESETS.map((p) => (
                            <option key={p.name} value={p.name}>{p.name}</option>
                          ))}
                        </select>
                        <ChevronDown />
                      </div>
                    </div>

                    <div className="gf-coords">
                      <div className="til-field">
                        <label className="til-field__label" htmlFor="gf-lat">Latitude</label>
                        <input
                          id="gf-lat"
                          className="til-input til-input--mono"
                          inputMode="decimal"
                          placeholder="37.7955"
                          value={latInput}
                          onChange={(e) => { setLatInput(e.target.value); setPreset('') }}
                          onBlur={() => setTouched((t) => ({ ...t, lat: true }))}
                          aria-invalid={Boolean(latError)}
                          aria-describedby={latError ? 'gf-lat-err' : undefined}
                        />
                        {latError && (
                          <span className="til-field__error" id="gf-lat-err"><AlertIcon /> {latError}</span>
                        )}
                      </div>
                      <div className="til-field">
                        <label className="til-field__label" htmlFor="gf-lng">Longitude</label>
                        <input
                          id="gf-lng"
                          className="til-input til-input--mono"
                          inputMode="decimal"
                          placeholder="-122.3937"
                          value={lngInput}
                          onChange={(e) => { setLngInput(e.target.value); setPreset('') }}
                          onBlur={() => setTouched((t) => ({ ...t, lng: true }))}
                          aria-invalid={Boolean(lngError)}
                          aria-describedby={lngError ? 'gf-lng-err' : undefined}
                        />
                        {lngError && (
                          <span className="til-field__error" id="gf-lng-err"><AlertIcon /> {lngError}</span>
                        )}
                      </div>
                    </div>

                    <button type="submit" className="til-btn til-btn--primary til-btn--lg til-btn--block">
                      Set location
                      <span className="til-btn__arrow" aria-hidden="true">→</span>
                    </button>
                  </form>
                )}
              </section>
            </div>
          )}

          {located && position && (
            <>
              <header className="gf-reveal-head">
                <span className="til-eyebrow-c til-eyebrow-c--accent">
                  <span className="til-eyebrow-c__dot" />
                  Gas Finder · San Francisco
                </span>
                <h1 className="til-h1">Your location</h1>
              </header>

              <div className="gf-details">
                <div className="gf-details__head">
                  <span className="til-badge til-badge--success">
                    <span className="til-badge__dot" />
                    Location set
                  </span>
                  <span className="til-caption">{position.source}</span>
                </div>

                <dl className="til-meta">
                  <dt>Latitude</dt>
                  <dd className="til-mono">{position.lat.toFixed(6)}</dd>
                  <dt>Longitude</dt>
                  <dd className="til-mono">{position.lng.toFixed(6)}</dd>
                  <dt>Accuracy</dt>
                  <dd className="til-mono">{position.accuracy != null ? `±${Math.round(position.accuracy)} m` : '—'}</dd>
                  <dt>As of</dt>
                  <dd className="til-mono">{new Date(position.timestamp).toLocaleTimeString()}</dd>
                </dl>

                {showSFNote && (
                  <div className="til-callout til-callout--note">
                    <span className="til-callout__icon"><InfoIcon /></span>
                    <div className="til-callout__main">
                      <span className="til-callout__body">
                        This point looks outside San Francisco. The gas-station search is
                        built for SF, so results may be empty or distant.
                      </span>
                    </div>
                  </div>
                )}

                <div className="gf-details__actions">
                  <a className="til-arrowlink" href={mapUrl} target="_blank" rel="noreferrer">
                    <span className="til-arrowlink__label">Open in OpenStreetMap</span>
                    <span aria-hidden="true">↗</span>
                  </a>
                  <button type="button" className="til-btn til-btn--sm" onClick={changeLocation}>
                    Change location
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {located && position && (
          <aside className="gf-mapcol">
            <LocationMap lat={position.lat} lng={position.lng} label={position.source} />
          </aside>
        )}
      </div>
    </main>
  )
}
