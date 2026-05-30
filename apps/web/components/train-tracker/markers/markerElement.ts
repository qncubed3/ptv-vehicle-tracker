// Builds and updates the HTML elements for a vehicle marker on the map.
// Each marker is made of a coloured circle, a route label, and an optional direction arrow.

import type { Vehicle, VehicleMarkerRecord, RouteInfo } from './types'
import { getRouteInfo } from './routeInfo'

// Creates a new marker with a coloured circle, route label, and direction arrow.
export function createVehicleMarkerRecord(
    mapboxgl: typeof window.mapboxgl,
    vehicle: Vehicle,
    routesById: Record<string, RouteInfo>
): VehicleMarkerRecord {
    const route = getRouteInfo(vehicle, routesById)
    const heading = vehicle.heading ?? 0

    // Outer container that Mapbox attaches to the map.
    const wrapper = document.createElement('div')
    wrapper.className = 'h-[34px] w-7 pointer-events-auto'

    // This div rotates to show which way the vehicle is facing.
    const rotator = document.createElement('div')
    rotator.className = 'relative h-[42px] w-8 drop-shadow-md'
    rotator.style.transform = `rotate(${heading - 180}deg)`
    rotator.style.transformOrigin = 'center 16px'

    // Coloured circle that shows the route colour on the map.
    const circle = document.createElement('div')
    circle.className = [
        'absolute left-0 top-0 z-[1]',
        'flex h-8 w-8 items-center justify-center',
        'rounded-full border-2 border-white',
        'text-[11px] text-white'
    ].join(' ')
    circle.style.background = route.routeColor

    // Route code text inside the circle, counter rotated so it stays upright.
    const label = document.createElement('div')
    label.innerText = route.routeCode
    label.className = 'flex h-full w-full items-center justify-center'
    label.style.transform = `rotate(${-heading - 180}deg)`
    circle.appendChild(label)

    // Small triangle below the circle that points in the travel direction.
    const arrow = document.createElement('div')
    arrow.className = [
        'absolute left-[10px] top-7 z-0',
        'h-0 w-0',
        'border-l-[6px] border-r-[6px] border-t-[10px]',
        'border-l-transparent border-r-transparent border-t-white'
    ].join(' ')

    // Hide the arrow if we do not know which way the vehicle is facing.
    if (vehicle.heading == null) {
        arrow.style.display = 'none'
    }

    rotator.appendChild(circle)
    rotator.appendChild(arrow)
    wrapper.appendChild(rotator)

    const marker = new mapboxgl.Marker(wrapper)

    // Return the marker and its parts so we can update them later without rebuilding.
    return {
        marker,
        routeId: vehicle.route_id,
        routeCode: route.routeCode,
        routeColor: route.routeColor,
        rotator,
        circle,
        label,
        arrow
    }
}

// Moves the marker to the vehicle's current coordinates.
export function updateMarkerPosition(record: VehicleMarkerRecord, vehicle: Vehicle) {
    record.marker.setLngLat([vehicle.longitude, vehicle.latitude])
}

// Rotates the marker to match the vehicle's heading.
export function updateMarkerRotation(record: VehicleMarkerRecord, vehicle: Vehicle) {
    const heading = vehicle.heading ?? 0

    record.rotator.style.transform = `rotate(${heading - 180}deg)`
    record.label.style.transform = `rotate(${-heading - 180}deg)`

    if (vehicle.heading == null) {
        record.arrow.style.display = 'none'
    } else {
        record.arrow.style.display = ''
    }
}

// Updates the route code and colour when a vehicle changes route.
export function updateMarkerRouteStyle(
    record: VehicleMarkerRecord,
    routeCode: string,
    routeColor: string
) {
    record.label.innerText = routeCode
    record.circle.style.background = routeColor
}
