'use client'

import React, { useEffect, useRef } from 'react'
import type { Tables } from '@/lib/database/types'
import { useRouteConfig } from '@/app/providers'

// Type definitions

type Vehicle = Tables<'vehicle_locations'>

interface MapboxMap {
  	remove: () => void
}

interface MapboxMarker {
  	remove: () => void
}

declare global {
	interface Window {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		mapboxgl: any
	}
}

const REFRESH_INTERVAL = parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL_MS || '30000')

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
			
			map.dragRotate.disable()
			map.touchZoomRotate.disableRotation()

			mapRef.current = map

			// Fetch trains and refresh 
			fetchAndUpdateVehicles()
			const interval = setInterval(fetchAndUpdateVehicles, REFRESH_INTERVAL)
			
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
			const routeId = vehicle.route_id
			const route = routeId ? getRoute[routeId] : null
			const routeCode = route?.route_code ?? 'N/A'
			const routeColor = route?.route_color ?? 'gray'
		
			// OUTER element (Mapbox positions this — DO NOT TRANSFORM)
			const el = document.createElement('div')
			el.style.cssText = `
				width: 28px;
				height: 34px;
				pointer-events: auto;
			`

			// INNER rotator (visual rotation only)
			const rotator = document.createElement('div')
			rotator.style.cssText = `
				position: relative;
				width: 32px;
				height: 42px;
				transform: rotate(${(vehicle.heading ?? 0) - 180}deg);
				transform-origin: center 16px;
				filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));
			`

			// CIRCLE
			const circle = document.createElement('div')
			circle.style.cssText = `
				position: absolute;
				top: 0;
				left: 0;
				width: 32px;
				height: 32px;
				background: ${routeColor};
				color: white;
				border: 2px solid white;
				border-radius: 50%;
				display: flex;
				align-items: center;
				justify-content: center;
				font-size: 11px;
				z-index: 1;
			`

			// TEXT (counter-rotated so it stays upright)
			const label = document.createElement('div')
			label.innerText = routeCode
			label.style.cssText = `
				width: 100%;
				height: 100%;
				display: flex;
				align-items: center;
				justify-content: center;
				transform: rotate(${-(vehicle.heading ?? 0) - 180}deg);
			`

			circle.appendChild(label)

			// ARROW (points NORTH by default)
			const arrow = document.createElement('div')
			arrow.style.cssText = `
				position: absolute;
				top: 28px;
				left: 10px;
				width: 0;
				height: 0;
				border-left: 6px solid transparent;
				border-right: 6px solid transparent;
				border-top: 10px solid white;  /* points DOWN for teardrop shape */
				z-index: 0;
			`

			if (vehicle.heading == null) {
				arrow.style.display = 'none'
			}

			// Assemble
			rotator.appendChild(circle)
			rotator.appendChild(arrow)
			el.appendChild(rotator)

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