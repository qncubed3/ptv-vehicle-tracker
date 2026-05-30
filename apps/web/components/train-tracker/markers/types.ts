// TypeScript types for map markers and vehicle data.

import type { RefObject } from 'react'
import type { Tables } from '@/lib/database/types'

export type Vehicle = Tables<'vehicle_locations'>

// Minimal map type: we only use what the marker code needs.
export interface MapboxMap {
    remove: () => void
}

export interface MapboxMarker {
    remove: () => void
    setLngLat: (lngLat: [number, number]) => MapboxMarker
    setPopup: (popup: unknown) => MapboxMarker
    addTo: (map: MapboxMap) => MapboxMarker
}

// Everything we store for each vehicle marker on the map.
export interface VehicleMarkerRecord {
    marker: MapboxMarker
    routeId: string | null
    routeCode: string
    routeColor: string
    rotator: HTMLElement
    circle: HTMLElement
    label: HTMLElement
    arrow: HTMLElement
}

// Route details from the route config provider.
export interface RouteInfo {
    route_code?: string | null
    route_color?: string | null
    route_name?: string | null
}

export interface RenderVehicleMarkersArgs {
    map: MapboxMap | null
    markersRef: RefObject<Map<string, VehicleMarkerRecord>>
    vehicles: Vehicle[]
    routesById: Record<string, RouteInfo>
}
