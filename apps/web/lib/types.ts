import type { Database } from './database/types'

// Export the Vehicle type from generated types
export type Vehicle = Database['public']['Tables']['vehicle_locations']['Row']

// Helper type for inserting vehicles
export type VehicleInsert = Database['public']['Tables']['vehicle_locations']['Insert']

// Helper type for updating vehicles
export type VehicleUpdate = Database['public']['Tables']['vehicle_locations']['Update']

// Route type names
export const ROUTE_TYPE_NAMES: Record<number, string> = {
  0: 'Train',
  1: 'Tram',
  2: 'Bus',
  3: 'V/Line'
}

// Helper to get route type name
export function getRouteTypeName(routeType: number): string {
  return ROUTE_TYPE_NAMES[routeType] || 'Unknown'
}