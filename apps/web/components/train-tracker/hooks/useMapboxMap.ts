'use client'

// Sets up the Mapbox map when the component mounts and cleans up on unmount.

import { useEffect, useRef, useState } from 'react'
import { initialiseMapboxMap } from '../map/mapbox'
import { removeAllVehicleMarkers } from '../markers'
import type { MapboxMap, VehicleMarkerRecord } from '../markers'

const MAP_ERROR_MESSAGE =
    'Failed to initialise WebGL map. Your browser or GPU may not support Mapbox rendering. Try opening this app in a different browser.'

export function useMapboxMap() {
    const mapContainerRef = useRef<HTMLDivElement>(null)
    const mapRef = useRef<MapboxMap | null>(null)
    const markersRef = useRef<Map<string, VehicleMarkerRecord>>(new Map())

    const [mapError, setMapError] = useState<string | null>(null)
    const [isMapReady, setIsMapReady] = useState(false)

    useEffect(() => {
        if (!mapContainerRef.current || mapRef.current) {
            return
        }

        let cancelled = false

        async function setupMap() {
            let map: MapboxMap

            try {
                map = await initialiseMapboxMap(mapContainerRef.current!)
            } catch (error) {
                console.error('Failed to initialise map:', error)
                setMapError(MAP_ERROR_MESSAGE)
                return
            }

            if (cancelled) {
                map.remove()
                return
            }

            mapRef.current = map
            setIsMapReady(true)
        }

        setupMap()

        return () => {
            cancelled = true
            removeAllVehicleMarkers(markersRef)

            if (mapRef.current) {
                mapRef.current.remove()
                mapRef.current = null
            }
        }
    }, [])

    return {
        mapContainerRef,
        mapRef,
        markersRef,
        mapError,
        isMapReady
    }
}
