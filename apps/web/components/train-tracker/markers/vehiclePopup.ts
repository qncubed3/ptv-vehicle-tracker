// Builds the popup that appears when you click a vehicle marker.

import type { Vehicle, RouteInfo } from './types'
import { getRouteInfo } from './routeInfo'

// One row in the popup (label on the left, value on the right).
function popupRow(label: string, value: string | null) {
    return `
        <div class="flex items-center justify-between gap-4">
            <span class="text-white/45">${label}</span>
            <span class="font-medium text-white">${value ?? 'N/A'}</span>
        </div>
    `
}

// Proces timestampe from db into melbourne time
function getVehicleUpdatedTime(vehicle: Vehicle) {
    const timestamp = vehicle.created_at ?? vehicle.timestamp
    return new Date(timestamp).toLocaleTimeString('en-AU', {
        timeZone: 'Australia/Melbourne',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })
}

// Popup component for each vehicle
function buildPopupHtml(vehicle: Vehicle, routesById: Record<string, RouteInfo>) {
    const route = getRouteInfo(vehicle, routesById)
    const updatedTime = getVehicleUpdatedTime(vehicle)

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

// Create mapbox popup
export function createVehiclePopup(
    mapboxgl: typeof window.mapboxgl,
    vehicle: Vehicle,
    routesById: Record<string, RouteInfo>
) {
    return new mapboxgl.Popup({
        offset: 25,
        closeButton: true,
        closeOnClick: true,
        className: 'vehicle-popup'
    }).setHTML(buildPopupHtml(vehicle, routesById))
}
