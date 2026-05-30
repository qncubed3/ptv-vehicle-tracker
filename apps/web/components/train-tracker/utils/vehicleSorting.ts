// Sorts vehicle records by timestamp for history playback.

import type { Tables } from '@/lib/database/types'

type Vehicle = Tables<'vehicle_locations'>

// Gets a single number we can compare for sorting.
export function getVehicleTimestamp(vehicle: Vehicle): number {
    const rawTime = vehicle.created_at ?? vehicle.timestamp
    return new Date(rawTime).getTime()
}

// Returns a new array sorted oldest to newest.
export function sortVehiclesByTime(vehicles: Vehicle[]): Vehicle[] {
    const sorted = [...vehicles]

    sorted.sort((a, b) => {
        return getVehicleTimestamp(a) - getVehicleTimestamp(b)
    })

    return sorted
}
