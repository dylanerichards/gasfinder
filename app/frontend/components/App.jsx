import React, { useState, useCallback } from 'react'
import LocationMap from './LocationMap'
import Dropdown from './Dropdown'
import Confirmation from './Confirmation'

// San Francisco places. `landmark: true` entries also appear in the quick
// landmark picker; all of them are searchable in the address field.
const SF_PLACES = [
  { value: 'ferry-building', label: 'Ferry Building', hint: 'Embarcadero', lat: 37.7955, lng: -122.3937, landmark: true },
  { value: 'union-square', label: 'Union Square', hint: 'Downtown', lat: 37.788, lng: -122.4074, landmark: true },
  { value: 'dolores-park', label: 'Mission Dolores Park', hint: 'Mission', lat: 37.7596, lng: -122.4269, landmark: true },
  { value: 'de-young', label: 'de Young Museum', hint: 'Golden Gate Park', lat: 37.7714, lng: -122.4686, landmark: true },
  { value: 'fishermans-wharf', label: "Fisherman's Wharf", hint: 'Northern Waterfront', lat: 37.808, lng: -122.4177, landmark: true },
  { value: 'twin-peaks', label: 'Twin Peaks', hint: 'Twin Peaks', lat: 37.7544, lng: -122.4477, landmark: true },
  { value: 'chase-center', label: 'Chase Center', hint: 'Mission Bay', lat: 37.768, lng: -122.3892, landmark: true },
  { value: 'presidio', label: 'Presidio — Main Post', hint: 'Presidio', lat: 37.7989, lng: -122.4662, landmark: true },
  { value: 'salesforce-tower', label: 'Salesforce Tower', hint: '415 Mission St · Financial District', lat: 37.7897, lng: -122.3972 },
  { value: 'city-hall', label: 'San Francisco City Hall', hint: '1 Dr Carlton B Goodlett Pl · Civic Center', lat: 37.7793, lng: -122.4193 },
  { value: 'oracle-park', label: 'Oracle Park', hint: '24 Willie Mays Plaza · South Beach', lat: 37.7786, lng: -122.3893 },
  { value: 'palace-fine-arts', label: 'Palace of Fine Arts', hint: '3601 Lyon St · Marina', lat: 37.803, lng: -122.4487 },
  { value: 'coit-tower', label: 'Coit Tower', hint: '1 Telegraph Hill Blvd · Telegraph Hill', lat: 37.8024, lng: -122.4058 },
  { value: 'painted-ladies', label: 'Painted Ladies', hint: '710 Steiner St · Alamo Square', lat: 37.7763, lng: -122.4328 },
  { value: 'haight-ashbury', label: 'Haight-Ashbury', hint: 'Haight St & Ashbury St', lat: 37.7699, lng: -122.4469 },
  { value: 'lands-end', label: 'Lands End Lookout', hint: '680 Point Lobos Ave · Outer Richmond', lat: 37.7795, lng: -122.5107 },
  { value: 'ghirardelli', label: 'Ghirardelli Square', hint: '900 North Point St · Fisherman’s Wharf', lat: 37.8058, lng: -122.4229 },
  { value: 'sf-zoo', label: 'San Francisco Zoo', hint: 'Sloat Blvd · Outer Sunset', lat: 37.7325, lng: -122.503 },
]
const PLACE_BY_VALUE = Object.fromEntries(SF_PLACES.map((p) => [p.value, p]))
const LANDMARK_OPTIONS = SF_PLACES.filter((p) => p.landmark).map(({ value, label, hint }) => ({ value, label, hint }))
const ADDRESS_OPTIONS = SF_PLACES.map(({ value, label, hint }) => ({ value, label, hint }))

const SF_BOUNDS = { minLat: 37.70, maxLat: 37.84, minLng: -122.53, maxLng: -122.34 }
const outsideSF = (lat, lng) =>
  lat < SF_BOUNDS.minLat || lat > SF_BOUNDS.maxLat || lng < SF_BOUNDS.minLng || lng > SF_BOUNDS.maxLng

function geoErrorMessage(err) {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location permission was denied. Enable it in your browser, or choose a location instead.'
    case err.POSITION_UNAVAILABLE:
      return 'Your location is currently unavailable. Try again, or choose a location instead.'
    case err.TIMEOUT:
      return 'Timed out while finding your location. Try again, or choose a location instead.'
    default:
      return 'Something went wrong while finding your location.'
  }
}

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
  const [position, setPosition] = useState(null)

  const [placeValue, setPlaceValue] = useState('')
  const [manualError, setManualError] = useState(null)
  const [confirm, setConfirm] = useState({ msg: '', n: 0 })

  const reveal = useCallback((pos) => {
    setPosition(pos)
    setStatus('idle')
    setConfirm((c) => ({ msg: `Location set — ${pos.source}`, n: c.n + 1 }))
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
      setError('Geolocation is not supported by this browser. Choose a location instead.')
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

  const choosePlace = useCallback((value) => {
    setPlaceValue(value)
    setManualError(null)
  }, [])

  const submitManual = useCallback(
    (e) => {
      e.preventDefault()
      const place = PLACE_BY_VALUE[placeValue]
      if (!place) {
        setManualError('Pick a landmark or search for an address.')
        return
      }
      setManualError(null)
      reveal({ lat: place.lat, lng: place.lng, accuracy: null, source: place.label, timestamp: Date.now() })
    },
    [placeValue, reveal]
  )

  const locating = status === 'locating'
  const located = phase === 'located'
  const showSFNote = position && outsideSF(position.lat, position.lng)
  const mapUrl =
    position &&
    `https://www.openstreetmap.org/?mlat=${position.lat}&mlon=${position.lng}#map=15/${position.lat}/${position.lng}`

  return (
    <main className="gf-page">
      <Confirmation message={confirm.msg} trigger={confirm.n} />

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
                  Start from where you are — let your browser locate you, or choose a
                  San Francisco location.
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
                    Choose a location
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
                      <label className="til-field__label" htmlFor="gf-landmark">
                        San Francisco landmark
                        <span className="til-field__optional">optional</span>
                      </label>
                      <Dropdown
                        id="gf-landmark"
                        options={LANDMARK_OPTIONS}
                        value={placeValue}
                        onChange={choosePlace}
                        placeholder="Choose a landmark…"
                        ariaLabel="San Francisco landmark"
                      />
                    </div>

                    <div className="til-field">
                      <label className="til-field__label" htmlFor="gf-address">Address or place</label>
                      <Dropdown
                        id="gf-address"
                        options={ADDRESS_OPTIONS}
                        value={placeValue}
                        onChange={choosePlace}
                        placeholder="Search an address or place…"
                        searchPlaceholder="Type an address or place…"
                        searchable
                        ariaLabel="Address or place"
                        invalid={Boolean(manualError)}
                      />
                      {manualError && (
                        <span className="til-field__error"><AlertIcon /> {manualError}</span>
                      )}
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
