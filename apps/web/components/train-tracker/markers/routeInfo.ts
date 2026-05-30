// Looks up display info (name, code, colour) for a vehicle's route.

import type { Vehicle, RouteInfo } from './types'

export function getRouteInfo(
    vehicle: Vehicle,
    routesById: Record<string, RouteInfo>
) {
    const routeId = vehicle.route_id
    const route = routeId ? routesById[routeId] : null

    return {
        routeCode: route?.route_code ?? 'N/A',
        routeColor: route?.route_color ?? 'gray',
        routeName: route?.route_name ?? `Route ${vehicle.route_id ?? 'Unknown'}`
    }
}
