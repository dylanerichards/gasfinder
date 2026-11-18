import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

// A cobalt pin that matches the design system (ring + solid dot).
const markerIcon = L.divIcon({
  className: 'gf-marker',
  html: '<span class="gf-marker__ring"></span><span class="gf-marker__dot"></span>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
})

export default function LocationMap({ lat, lng, label }) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

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
    markerRef.current = L.marker([lat, lng], { icon: markerIcon }).addTo(map)
    mapRef.current = map

    // The map mounts while its column is still animating open, so its size
    // keeps changing. Recalculate on every size change (and keep the point
    // centered) so tiles fill the whole container, not just the start width.
    const recenter = () => {
      map.invalidateSize({ animate: false })
      map.setView(markerRef.current.getLatLng(), map.getZoom(), { animate: false })
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
      markerRef.current = null
    }
  }, [])

  // Move the view + marker whenever the location changes.
  useEffect(() => {
    if (!mapRef.current) return
    mapRef.current.setView([lat, lng], 15, { animate: true })
    if (markerRef.current) {
      markerRef.current.setLatLng([lat, lng])
      if (label) markerRef.current.bindPopup(label)
    }
  }, [lat, lng, label])

  return <div ref={elRef} className="gf-map" role="img" aria-label={`Map centered on ${lat}, ${lng}`} />
}
