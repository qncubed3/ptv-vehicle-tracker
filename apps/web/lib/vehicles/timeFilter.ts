import type { Tables } from '@/lib/database/types'

type Vehicle = Tables<'vehicle_locations'>

/**
 * Returns the latest known position for each vehicle at or before a given time.
 */
export function getLatestVehiclesBeforeTime(
    vehicles: Vehicle[],
    time: Date
): Vehicle[] {
    const cutoffTime = time.getTime()
    const latestByVehicleId = new Map<string, Vehicle>()

    for (const vehicle of vehicles) {
        if (!vehicle.vehicle_id || !vehicle.created_at) continue

        const vehicleTime = new Date(vehicle.created_at).getTime()

        if (Number.isNaN(vehicleTime) || vehicleTime > cutoffTime) {
            continue
        }

        latestByVehicleId.set(vehicle.vehicle_id, vehicle)
    }

    return Array.from(latestByVehicleId.values())
}