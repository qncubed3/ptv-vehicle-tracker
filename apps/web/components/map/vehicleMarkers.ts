// vehicleMarkers.ts
import type { MutableRefObject } from 'react'
import type { Tables } from '@/lib/database/types'

type Vehicle = Tables<'vehicle_locations'>

export interface MapboxMap {
    remove: () => void
}

export interface MapboxMarker {
    remove: () => void
    setLngLat: (lngLat: [number, number]) => MapboxMarker
    setPopup: (popup: unknown) => MapboxMarker
    addTo: (map: MapboxMap) => MapboxMarker
}

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

interface RouteInfo {
    route_code?: string | null
    route_color?: string | null
    route_name?: string | null
}

interface RenderVehicleMarkersArgs {
    map: MapboxMap | null
    markersRef: MutableRefObject<Map<string, VehicleMarkerRecord>>
    vehicles: Vehicle[]
    routesById: Record<string, RouteInfo>
}

export function renderVehicleMarkers({
    map,
    markersRef,
    vehicles,
    routesById
}: RenderVehicleMarkersArgs) {
    if (!map) return

    const mapboxgl = window.mapboxgl
    const visibleVehicleIds = new Set<string>()

    vehicles.forEach(vehicle => {
        const vehicleId = vehicle.vehicle_id

        if (!vehicleId) return

        visibleVehicleIds.add(vehicleId)

        const existingRecord = markersRef.current.get(vehicleId)

        if (existingRecord) {
            updateExistingVehicleMarker(existingRecord, vehicle, routesById)
            return
        }

        const newRecord = createVehicleMarkerRecord(mapboxgl, vehicle, routesById)

        newRecord.marker
            .setLngLat([vehicle.longitude, vehicle.latitude])
            .setPopup(createVehiclePopup(mapboxgl, vehicle, routesById))
            .addTo(map)

        markersRef.current.set(vehicleId, newRecord)
    })

    markersRef.current.forEach((record, vehicleId) => {
        if (!visibleVehicleIds.has(vehicleId)) {
            record.marker.remove()
            markersRef.current.delete(vehicleId)
        }
    })
}

export function removeAllVehicleMarkers(
    markersRef: MutableRefObject<Map<string, VehicleMarkerRecord>>
) {
    markersRef.current.forEach(record => record.marker.remove())
    markersRef.current.clear()
}

function updateExistingVehicleMarker(
    record: VehicleMarkerRecord,
    vehicle: Vehicle,
    routesById: Record<string, RouteInfo>
) {
    record.marker.setLngLat([vehicle.longitude, vehicle.latitude])

    updateVehicleMotion(record, vehicle)

    const route = getRouteInfo(vehicle, routesById)

    const routeChanged =
        record.routeId !== vehicle.route_id ||
        record.routeCode !== route.routeCode ||
        record.routeColor !== route.routeColor

    if (!routeChanged) return

    record.routeId = vehicle.route_id
    record.routeCode = route.routeCode
    record.routeColor = route.routeColor

    record.label.innerText = route.routeCode
    record.circle.style.background = route.routeColor

    record.marker.setPopup(createVehiclePopup(window.mapboxgl, vehicle, routesById))
}

function updateVehicleMotion(
    record: VehicleMarkerRecord,
    vehicle: Vehicle
) {
    const heading = vehicle.heading ?? 0

    record.rotator.style.transform = `rotate(${heading - 180}deg)`
    record.label.style.transform = `rotate(${-heading - 180}deg)`
    record.arrow.style.display = vehicle.heading == null ? 'none' : ''
}

function createVehicleMarkerRecord(
    mapboxgl: typeof window.mapboxgl,
    vehicle: Vehicle,
    routesById: Record<string, RouteInfo>
): VehicleMarkerRecord {
    const route = getRouteInfo(vehicle, routesById)
    const heading = vehicle.heading ?? 0

    const el = document.createElement('div')
    el.className = 'h-[34px] w-7 pointer-events-auto'

    const rotator = document.createElement('div')
    rotator.className = 'relative h-[42px] w-8 drop-shadow-md'
    rotator.style.transform = `rotate(${heading - 180}deg)`
    rotator.style.transformOrigin = 'center 16px'

    const circle = document.createElement('div')
    circle.className = [
        'absolute left-0 top-0 z-[1]',
        'flex h-8 w-8 items-center justify-center',
        'rounded-full border-2 border-white',
        'text-[11px] text-white'
    ].join(' ')
    circle.style.background = route.routeColor

    const label = document.createElement('div')
    label.innerText = route.routeCode
    label.className = 'flex h-full w-full items-center justify-center'
    label.style.transform = `rotate(${-heading - 180}deg)`

    circle.appendChild(label)

    const arrow = document.createElement('div')
    arrow.className = [
        'absolute left-[10px] top-7 z-0',
        'h-0 w-0',
        'border-l-[6px] border-r-[6px] border-t-[10px]',
        'border-l-transparent border-r-transparent border-t-white'
    ].join(' ')

    if (vehicle.heading == null) {
        arrow.style.display = 'none'
    }

    rotator.appendChild(circle)
    rotator.appendChild(arrow)
    el.appendChild(rotator)

    const marker = new mapboxgl.Marker(el)

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

function createVehiclePopup(
    mapboxgl: typeof window.mapboxgl,
    vehicle: Vehicle,
    routesById: Record<string, RouteInfo>
) {
    return new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: true,
        className: 'vehicle-popup'
    }).setHTML(createVehiclePopupHtml(vehicle, routesById))
}

function getRouteInfo(
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

function createVehiclePopupHtml(
    vehicle: Vehicle,
    routesById: Record<string, RouteInfo>
) {
    const route = getRouteInfo(vehicle, routesById)

    const updatedTime = new Date(vehicle.created_at ?? vehicle.timestamp).toLocaleTimeString(
        'en-AU',
        {
            timeZone: 'Australia/Melbourne',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }
    )

    return `
        <div class="w-64 overflow-hidden rounded-2xl bg-slate-950 text-white shadow-2xl">
            <div
                class="px-4 py-3 pr-10"
                style="background: ${route.routeColor};"
            >
                <div class="text-sm font-bold leading-snug text-white">
                    ${route.routeName}
                </div>
            </div>

            <div class="space-y-2 px-4 py-4 text-sm">
                ${popupRow('Vehicle', vehicle.vehicle_id)}
                ${popupRow('Route ID', vehicle.route_id ?? 'N/A')}
                ${popupRow('Direction', vehicle.direction_id?.toString() ?? 'N/A')}
                ${popupRow('Heading', vehicle.heading?.toString() ?? 'N/A')}
                ${popupRow('Updated', updatedTime)}
            </div>
        </div>

        <style>
            .vehicle-popup .mapboxgl-popup-content {
                padding: 0;
                border-radius: 16px;
                background: transparent;
                box-shadow: none;
            }

            .vehicle-popup .mapboxgl-popup-close-button {
                top: 10px;
                width: 24px;
                height: 24px;
                border-radius: 9999px;
                color: white;
                background: rgba(0, 0, 0, 0.22);
                font-size: 18px;
                line-height: 22px;
            }

            .vehicle-popup .mapboxgl-popup-close-button:hover {
                background: rgba(0, 0, 0, 0.38);
            }

            .vehicle-popup .mapboxgl-popup-tip {
                border-top-color: #020617;
            }
        </style>
    `
}

function popupRow(label: string, value: string | null) {
    return `
        <div class="flex items-center justify-between gap-4">
            <span class="text-white/45">${label}</span>
            <span class="font-medium text-white">${value ?? 'N/A'}</span>
        </div>
    `
}