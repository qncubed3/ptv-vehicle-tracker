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
    const supabase = await createClient()
    const { data: routes, error } = await supabase.from("vehicle_routes").select("*")

    if (error || !routes) {
        throw new Error("Failed to fetch route config data")
    }

    const routesById: Record<string, VehicleRoute> = {}
    
    routes.forEach(route => {
        routesById[route.route_id] = route
    })

    return { routes, routesById }
}