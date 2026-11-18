import React, { useState, useCallback, useEffect } from 'react'
import LocationMap from './LocationMap'
import Dropdown from './Dropdown'
import Confirmation from './Confirmation'
import StationList from './StationList'
import Directions from './Directions'

// Curated landmarks for the quick picker (value, label, hint, lat, lng).
const LANDMARKS = [
  { value: 'ferry-building', label: 'Ferry Building', hint: 'Embarcadero', lat: 37.7955, lng: -122.3937 },
  { value: 'union-square', label: 'Union Square', hint: 'Downtown', lat: 37.788, lng: -122.4074 },
  { value: 'dolores-park', label: 'Mission Dolores Park', hint: 'Mission', lat: 37.7596, lng: -122.4269 },
  { value: 'de-young', label: 'de Young Museum', hint: 'Golden Gate Park', lat: 37.7714, lng: -122.4686 },
  { value: 'fishermans-wharf', label: "Fisherman's Wharf", hint: 'Northern Waterfront', lat: 37.808, lng: -122.4177 },
  { value: 'twin-peaks', label: 'Twin Peaks', hint: 'Twin Peaks', lat: 37.7544, lng: -122.4477 },
  { value: 'chase-center', label: 'Chase Center', hint: 'Mission Bay', lat: 37.768, lng: -122.3892 },
  { value: 'presidio', label: 'Presidio — Main Post', hint: 'Presidio', lat: 37.7989, lng: -122.4662 },
]

// Real address search via the Rails geocode proxy (OpenStreetMap / Nominatim).
async function searchAddress(query) {
  const res = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

// Nearest fuel stations via the Rails Overpass proxy.
async function searchGasStations(lat, lng) {
  const res = await fetch(`/api/gas_stations?lat=${lat}&lng=${lng}`, {
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) return []
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

// Turn-by-turn directions from the user to a destination via the Rails OSRM proxy.
async function fetchRoute(from, to, mode) {
  const query = new URLSearchParams({
    from_lat: from.lat,
    from_lng: from.lng,
    to_lat: to.lat,
    to_lng: to.lng,
    mode,
  })
  const res = await fetch(`/api/route?${query}`, { headers: { Accept: 'application/json' } })
  if (!res.ok) return null
  const data = await res.json()
  if (!data || data.error || !Array.isArray(data.geometry)) return null
  return data
}

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

  const [selectedPlace, setSelectedPlace] = useState(null)
  const [manualError, setManualError] = useState(null)
  const [confirm, setConfirm] = useState({ msg: '', n: 0 })

  // Nearest gas stations for the current position + the chosen destination.
  const [stations, setStations] = useState([])
  const [stationsStatus, setStationsStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error'
  const [destination, setDestination] = useState(null)
  const [stationsOpen, setStationsOpen] = useState(true) // list collapses once a destination is locked in
  const [autoPicking, setAutoPicking] = useState(null) // null | 'drive' | 'walk' while computing the shortest route

  // Turn-by-turn route from the user to the chosen destination.
  const [travelMode, setTravelMode] = useState('drive') // 'drive' | 'walk'
  const [route, setRoute] = useState(null)
  const [routeStatus, setRouteStatus] = useState('idle') // 'idle' | 'loading' | 'ready' | 'error'

  // Fetch the nearest stations whenever the location changes.
  useEffect(() => {
    if (!position) return undefined
    let cancelled = false
    setStations([])
    setDestination(null)
    setStationsStatus('loading')
    searchGasStations(position.lat, position.lng)
      .then((list) => {
        if (cancelled) return
        setStations(list)
        setStationsStatus('ready')
      })
      .catch(() => {
        if (cancelled) return
        setStations([])
        setStationsStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [position])

  // Fetch directions whenever the destination, location or travel mode changes.
  // Clearing the destination clears the route.
  useEffect(() => {
    if (!position || !destination) {
      setRoute(null)
      setRouteStatus('idle')
      return undefined
    }
    let cancelled = false
    setRoute(null)
    setRouteStatus('loading')
    fetchRoute(position, destination, travelMode)
      .then((data) => {
        if (cancelled) return
        if (data) {
          setRoute(data)
          setRouteStatus('ready')
        } else {
          setRoute(null)
          setRouteStatus('error')
        }
      })
      .catch(() => {
        if (cancelled) return
        setRoute(null)
        setRouteStatus('error')
      })
    return () => {
      cancelled = true
    }
  }, [position, destination, travelMode])

  // Collapse the station list once a destination is locked in; reopen when cleared.
  useEffect(() => {
    setStationsOpen(!destination)
  }, [destination])

  // Toggle a station as the destination (kept so it can drive directions later).
  const selectDestination = useCallback((station) => {
    setDestination((current) => (current && current.id === station.id ? null : station))
  }, [])

  // Auto-pick the station with the shortest actual route for a travel mode.
  const selectShortest = useCallback(
    async (m) => {
      if (!position || stations.length === 0 || autoPicking) return
      setAutoPicking(m)
      try {
        const results = await Promise.all(
          stations.map((s) =>
            fetchRoute(position, s, m).then((r) => ({ s, r })).catch(() => ({ s, r: null }))
          )
        )
        const valid = results.filter((x) => x.r && Number.isFinite(x.r.distance_m))
        if (valid.length > 0) {
          const best = valid.reduce((a, b) => (b.r.distance_m < a.r.distance_m ? b : a))
          setTravelMode(m)
          setDestination(best.s)
        }
      } finally {
        setAutoPicking(null)
      }
    },
    [position, stations, autoPicking]
  )

  const selectDestinationById = useCallback(
    (id) => {
      const station = stations.find((s) => s.id === id)
      if (station) selectDestination(station)
    },
    [stations, selectDestination]
  )

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
    setStations([])
    setStationsStatus('idle')
    setDestination(null)
    setStationsOpen(true)
    setAutoPicking(null)
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
          source: 'Current location',
          place: null,
          timestamp: pos.timestamp,
        }),
      (err) => {
        setError(geoErrorMessage(err))
        setStatus('error')
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
  }, [reveal])

  const chooseLandmark = useCallback((_value, opt) => {
    setSelectedPlace({ ...opt, source: 'landmark' })
    setManualError(null)
  }, [])

  const chooseAddress = useCallback((_value, opt) => {
    setSelectedPlace({ ...opt, source: 'address' })
    setManualError(null)
  }, [])

  const submitManual = useCallback(
    (e) => {
      e.preventDefault()
      if (!selectedPlace) {
        setManualError('Pick a landmark or search for an address.')
        return
      }
      reveal({
        lat: selectedPlace.lat,
        lng: selectedPlace.lng,
        source: selectedPlace.label,
        place: [selectedPlace.label, selectedPlace.hint].filter(Boolean).join(', '),
        timestamp: Date.now(),
      })
    },
    [selectedPlace, reveal]
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
                        options={LANDMARKS}
                        value={selectedPlace?.source === 'landmark' ? selectedPlace.value : ''}
                        selected={selectedPlace?.source === 'landmark' ? selectedPlace : null}
                        onChange={chooseLandmark}
                        placeholder="Choose a landmark…"
                        ariaLabel="San Francisco landmark"
                      />
                    </div>

                    <div className="til-field">
                      <label className="til-field__label" htmlFor="gf-address">Address or place</label>
                      <Dropdown
                        id="gf-address"
                        onSearch={searchAddress}
                        value={selectedPlace?.source === 'address' ? selectedPlace.value : ''}
                        selected={selectedPlace?.source === 'address' ? selectedPlace : null}
                        onChange={chooseAddress}
                        placeholder="Search any San Francisco address…"
                        searchPlaceholder="e.g. 1 Ferry Building"
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
                  <span
                    className="til-badge til-badge--success gf-pill"
                    tabIndex={0}
                    aria-label={`Location set. Latitude ${position.lat.toFixed(6)}, longitude ${position.lng.toFixed(6)}.`}
                  >
                    <span className="til-badge__dot" />
                    Location set
                    <span className="gf-pill__tip" role="tooltip">
                      <span className="gf-pill__row"><span>Lat</span><span>{position.lat.toFixed(6)}</span></span>
                      <span className="gf-pill__row"><span>Lng</span><span>{position.lng.toFixed(6)}</span></span>
                    </span>
                  </span>
                </div>

                <p className="gf-place">{position.place || position.source}</p>

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

              <StationList
                status={stationsStatus}
                stations={stations}
                destinationId={destination?.id}
                onSelect={selectDestination}
                open={stationsOpen}
                onShowAll={() => setStationsOpen(true)}
                onShortest={selectShortest}
                autoPicking={autoPicking}
              />

              {destination && (
                <Directions
                  mode={travelMode}
                  onModeChange={setTravelMode}
                  status={routeStatus}
                  route={route}
                  destinationName={destination.name}
                />
              )}
            </>
          )}
        </div>

        {located && position && (
          <aside className="gf-mapcol">
            <LocationMap
              lat={position.lat}
              lng={position.lng}
              label={position.source}
              stations={stations}
              destinationId={destination?.id}
              onSelectDestination={selectDestinationById}
              route={route}
            />
          </aside>
        )}
      </div>

      <footer className="gf-footer">
        <span className="gf-footer__brand">Gas Finder · San Francisco</span>
        <nav className="gf-footer__nav" aria-label="About this app">
          <a
            className="til-arrowlink til-arrowlink--muted til-arrowlink--sm"
            href="https://github.com/dylanerichards/gasfinder"
            target="_blank"
            rel="noreferrer"
          >
            <span className="til-arrowlink__label">Source</span>
            <span aria-hidden="true">↗</span>
          </a>
        </nav>
      </footer>
    </main>
  )
}
