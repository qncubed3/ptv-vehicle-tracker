// Keeps the map markers in sync with the current vehicle list.
// This file adds new markers, updates existing ones, and removes markers that are no longer needed.

import type { RefObject } from 'react'
import type {
    VehicleMarkerRecord,
    RenderVehicleMarkersArgs
} from './types'
import { createVehicleMarkerRecord } from './markerElement'
import { createVehiclePopup } from './vehiclePopup'
import { updateExistingVehicleMarker } from './updateMarker'

// Updates the map so every vehicle in the list has a marker at the correct position.
export function renderVehicleMarkers({
    map,
    markersRef,
    vehicles,
    routesById
}: RenderVehicleMarkersArgs) {
    // Nothing to draw if the map has not loaded yet.
    if (!map) {
        return
    }

    const mapboxgl = window.mapboxgl

    // Track which vehicles should stay on the map after this update.
    const visibleVehicleIds = new Set<string>()

    for (const vehicle of vehicles) {
        const vehicleId = vehicle.vehicle_id

        // Skip records that do not have a valid vehicle id.
        if (!vehicleId) {
            continue
        }

        visibleVehicleIds.add(vehicleId)

        const existingRecord = markersRef.current.get(vehicleId)

        if (existingRecord) {
            // This vehicle already has a marker, so update its position and details.
            updateExistingVehicleMarker(existingRecord, vehicle, routesById)
            continue
        }

        // This is the first time we have seen this vehicle, so create a new marker.
        const newRecord = createVehicleMarkerRecord(mapboxgl, vehicle, routesById)

        newRecord.marker
            .setLngLat([vehicle.longitude, vehicle.latitude])
            .setPopup(createVehiclePopup(mapboxgl, vehicle, routesById))
            .addTo(map)

        // Store the marker so we can update it on the next refresh.
        markersRef.current.set(vehicleId, newRecord)
    }

    // Clean up markers for vehicles that dropped off the list.
    removeHiddenMarkers(markersRef, visibleVehicleIds)
}

// Removes markers for vehicles that are no longer in the current list.
function removeHiddenMarkers(
    markersRef: RefObject<Map<string, VehicleMarkerRecord>>,
    visibleVehicleIds: Set<string>
) {
    markersRef.current.forEach((record, vehicleId) => {
        // Keep markers that are still visible.
        if (visibleVehicleIds.has(vehicleId)) {
            return
        }

        // Remove the marker from the map and from our stored records.
        record.marker.remove()
        markersRef.current.delete(vehicleId)
    })
}

// Removes every marker from the map.
// Call this when the map is destroyed or the component unmounts.
export function removeAllVehicleMarkers(
    markersRef: RefObject<Map<string, VehicleMarkerRecord>>
) {
    markersRef.current.forEach(record => {
        record.marker.remove()
    })

    // Clear the stored records so nothing is left behind.
    markersRef.current.clear()
}
