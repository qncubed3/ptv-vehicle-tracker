import type { MutableRefObject } from 'react'
import type { Tables } from '@/lib/database/types'

type Vehicle = Tables<'vehicle_locations'>

export interface MapboxMap {
    remove: () => void
}

export interface MapboxMarker {
    remove: () => void
}

interface RouteInfo {
    route_code?: string | null
    route_color?: string | null
    route_name?: string | null
}

interface RenderVehicleMarkersArgs {
    map: MapboxMap | null
    markersRef: MutableRefObject<MapboxMarker[]>
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

    markersRef.current.forEach(marker => marker.remove())
    markersRef.current = []

    vehicles.forEach(vehicle => {
        const markerElement = createVehicleMarkerElement(vehicle, routesById)
        const popupHtml = createVehiclePopupHtml(vehicle, routesById)

        const marker = new mapboxgl.Marker(markerElement)
            .setLngLat([vehicle.longitude, vehicle.latitude])
            .setPopup(
                new mapboxgl.Popup({
                    offset: 25,
                    closeButton: true,
                    closeOnClick: true,
                    className: 'vehicle-popup'
                }).setHTML(popupHtml)
            )
            .addTo(map)

        markersRef.current.push(marker)
    })
}

function createVehiclePopupHtml(
    vehicle: Vehicle,
    routesById: Record<string, RouteInfo>
) {
    const routeId = vehicle.route_id
    const route = routeId ? routesById[routeId] : null

    const routeName = route?.route_name ?? `Route ${vehicle.route_id ?? 'Unknown'}`
    const routeColor = route?.route_color ?? '#6b7280'

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
                style="background: ${routeColor};"
            >
                <div class="text-sm font-bold leading-snug text-white">
                    ${routeName}
                </div>
            </div>

            <div class="space-y-2 px-4 py-4 text-sm">
                ${popupRow('Vehicle', vehicle.vehicle_id)}
                ${popupRow('Route ID', vehicle.route_id ?? 'N/A')}
                ${popupRow('Direction', vehicle.direction_id?.toString() ?? 'N/A')}
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

function popupRow(label: string, value: string) {
    return `
        <div class="flex items-center justify-between gap-4">
            <span class="text-white/45">${label}</span>
            <span class="font-medium text-white">${value}</span>
        </div>
    `
}

function createVehicleMarkerElement(
    vehicle: Vehicle,
    routesById: Record<string, RouteInfo>
) {
    const routeId = vehicle.route_id
    const route = routeId ? routesById[routeId] : null
    const routeCode = route?.route_code ?? 'N/A'
    const routeColor = route?.route_color ?? 'gray'
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
    circle.style.background = routeColor

    const label = document.createElement('div')
    label.innerText = routeCode
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

    return el
}