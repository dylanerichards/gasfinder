import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// A cobalt pin that matches the design system (ring + solid dot) — "you are here".
const youIcon = L.divIcon({
  className: 'gf-marker',
  html: '<span class="gf-marker__ring"></span><span class="gf-marker__dot"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

// Numbered teardrop pins for the stations, visually distinct from the "you"
// dot. The selected destination gets the --on highlight.
function stationIcon(n, selected) {
  return L.divIcon({
    className: `gf-smarker${selected ? ' gf-smarker--on' : ''}`,
    html: `<span class="gf-smarker__pin"></span><span class="gf-smarker__n">${n}</span>`,
    iconSize: [26, 34],
    iconAnchor: [13, 32],
  })
}

export default function LocationMap({
  lat,
  lng,
  label,
  stations = [],
  destinationId = null,
  onSelectDestination,
}) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const youRef = useRef(null)
  const stationsLayerRef = useRef(null)
  const boundsRef = useRef(null)
  // Keep the latest click handler without re-creating markers' closures stale.
  const onSelectRef = useRef(onSelectDestination)
  onSelectRef.current = onSelectDestination

  // Create the map once.
  useEffect(() => {
    if (mapRef.current || !elRef.current) return
    const map = L.map(elRef.current, {
      center: [lat, lng],
      zoom: 15,
      scrollWheelZoom: false,
      attributionControl: true,
    })
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap contributors',
    }).addTo(map)
    youRef.current = L.marker([lat, lng], { icon: youIcon, zIndexOffset: 1000 }).addTo(map)
    stationsLayerRef.current = L.layerGroup().addTo(map)
    mapRef.current = map

    // The map mounts while its column is still animating open, so its size
    // keeps changing. Recalculate on every size change so tiles fill the whole
    // container — re-fitting the station bounds if we have them, otherwise
    // keeping the "you" point centered.
    const recenter = () => {
      map.invalidateSize({ animate: false })
      if (boundsRef.current) {
        map.fitBounds(boundsRef.current, { padding: [36, 36], maxZoom: 16, animate: false })
      } else {
        map.setView(youRef.current.getLatLng(), map.getZoom(), { animate: false })
      }
    }
    const ro = new ResizeObserver(recenter)
    ro.observe(elRef.current)
    // Belt-and-suspenders: also recalc after the reveal animation settles.
    const t1 = setTimeout(recenter, 120)
    const t2 = setTimeout(recenter, 450)

    return () => {
      ro.disconnect()
      clearTimeout(t1)
      clearTimeout(t2)
      map.remove()
      mapRef.current = null
      youRef.current = null
      stationsLayerRef.current = null
      boundsRef.current = null
    }
  }, [])

  // Move the "you" marker whenever the location changes.
  useEffect(() => {
    if (!mapRef.current || !youRef.current) return
    youRef.current.setLatLng([lat, lng])
    if (label) youRef.current.bindPopup(label)
  }, [lat, lng, label])

  // Render station markers and fit the view when stations or selection change.
  useEffect(() => {
    const map = mapRef.current
    const layer = stationsLayerRef.current
    if (!map || !layer) return

    layer.clearLayers()
    stations.forEach((station, i) => {
      const selected = station.id === destinationId
      const marker = L.marker([station.lat, station.lng], {
        icon: stationIcon(i + 1, selected),
        zIndexOffset: selected ? 800 : 0,
        title: station.name,
      })
      marker.bindPopup(station.name)
      marker.on('click', () => {
        if (onSelectRef.current) onSelectRef.current(station.id)
      })
      marker.addTo(layer)
    })

    if (stations.length > 0) {
      const bounds = L.latLngBounds([[lat, lng], ...stations.map((s) => [s.lat, s.lng])])
      boundsRef.current = bounds
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 16, animate: false })
    } else {
      boundsRef.current = null
      map.setView([lat, lng], 15, { animate: false })
    }
  }, [stations, destinationId, lat, lng])

  return <div ref={elRef} className="gf-map" role="img" aria-label={`Map centered on ${lat}, ${lng}`} />
}
