// Updates an existing marker when vehicle data changes.

import type { Vehicle, VehicleMarkerRecord, RouteInfo } from './types'
import { getRouteInfo } from './routeInfo'
import {
    updateMarkerPosition,
    updateMarkerRotation,
    updateMarkerRouteStyle
} from './markerElement'
import { createVehiclePopup } from './vehiclePopup'

export function updateExistingVehicleMarker(
    record: VehicleMarkerRecord,
    vehicle: Vehicle,
    routesById: Record<string, RouteInfo>
) {
    // Update spatial data
    updateMarkerPosition(record, vehicle)
    updateMarkerRotation(record, vehicle)

    const route = getRouteInfo(vehicle, routesById)

    const routeChanged =
        record.routeId !== vehicle.route_id ||
        record.routeCode !== route.routeCode ||
        record.routeColor !== route.routeColor

    if (!routeChanged) {
        return
    }

    // Route changed: update colours, label, and popup content.
    record.routeId = vehicle.route_id
    record.routeCode = route.routeCode
    record.routeColor = route.routeColor

    updateMarkerRouteStyle(record, route.routeCode, route.routeColor)

    record.marker.setPopup(
        createVehiclePopup(window.mapboxgl, vehicle, routesById)
    )
}
