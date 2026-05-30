import { createClient } from "./supabase/server";

export interface VehicleRoute {
    route_id: string
    route_name: string
    route_color: string
    route_code: string
}

export interface RouteConfig {
    routes: VehicleRoute[]
    routesById: Record<string, VehicleRoute>
}

export async function getRouteConfig(): Promise<RouteConfig> {
    const supabase = createClient()
    const { data: routes, error } = await supabase.from("vehicle_routes").select("*")

    if (error) {
        console.error("Failed to fetch route config data:", error.message, error)
        return { routes: [], routesById: {} }
    }

    if (!routes) {
        return { routes: [], routesById: {} }
    }

    const routesById: Record<string, VehicleRoute> = {}
    
    routes.forEach(route => {
        routesById[route.route_id] = route
    })

    return { routes, routesById }
}