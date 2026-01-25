'use client'

import React, { useEffect, useRef } from 'react'
import type { Tables } from '@/lib/database/types'
import { useRouteConfig } from '@/app/providers'

type Vehicle = Tables<'vehicle_locations'>

// Define types for Mapbox
interface MapboxMap {
  remove: () => void
}

interface MapboxMarker {
  remove: () => void
}

declare global {
  interface Window {
    mapboxgl: any
  }
}

const PTVTrainTracker = () => {
  const mapRef = useRef<MapboxMap | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const markersRef = useRef<MapboxMarker[]>([])
  const getRoute = useRouteConfig().routesById

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    // Load Mapbox CSS
    const link = document.createElement('link')
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css'
    link.rel = 'stylesheet'
    document.head.appendChild(link)

    // Load Mapbox JS
    const script = document.createElement('script')
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js'
    script.onload = () => {
      const mapboxgl = window.mapboxgl
      mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [144.9631, -37.8136], // Melbourne
        zoom: 10
      })

      mapRef.current = map

      // Fetch trains and refresh every 30 seconds
      fetchAndUpdateVehicles()
      const interval = setInterval(fetchAndUpdateVehicles, 30000)
      
      // Cleanup interval on unmount
      return () => clearInterval(interval)
    }
    document.head.appendChild(script)

    // Cleanup function
    return () => {
      if (mapRef.current) {
        mapRef.current.remove()
      }
    }
  }, [])

  const fetchAndUpdateVehicles = async () => {
    try {
      const res = await fetch('/api/vehicles/current')
      const data = await res.json()
      updateMarkers(data.vehicles || [])
    } catch (error) {
      console.error('Error fetching vehicles:', error)
    }
  }

  const updateMarkers = (vehicles: Vehicle[]) => {
    if (!mapRef.current) return
    const mapboxgl = window.mapboxgl

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    // Add new markers
    vehicles.forEach(vehicle => {
      const el = document.createElement('div')

      const routeId = vehicle.route_id
      // ✅ Fixed: Safe access with optional chaining
      const route = routeId ? getRoute[routeId] : null
      const routeCode = route?.route_code ?? 'N/A'
      const routeColor = route?.route_color ?? 'gray'

      el.className = 'train-marker'
      el.innerHTML = routeCode
      el.style.cssText = `
        background: ${routeColor};
        color: white;
        border: 2px solid white;
        border-radius: 50%;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: light;
        cursor: pointer;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      `

      const marker = new mapboxgl.Marker(el)
        .setLngLat([vehicle.longitude, vehicle.latitude])
        .setPopup(
          new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <strong>Route ${vehicle.route_id ?? 'Unknown'}</strong><br/>
            Vehicle: ${vehicle.vehicle_id}<br/>
            Direction: ${vehicle.direction_id ?? 'N/A'}<br/>
            Updated: ${new Date(vehicle.timestamp).toLocaleTimeString()}
          `)
        )
        .addTo(mapRef.current)

      markersRef.current.push(marker)
    })
  }

  return <div ref={mapContainerRef} className="w-full h-screen" />
}

export default PTVTrainTracker