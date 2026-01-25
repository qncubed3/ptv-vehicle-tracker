import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getRouteTypeName } from '@/lib/types'

export const revalidate = 0

export async function GET() {
  try {
    const supabase = await createClient()

    // Get distinct routes from recent data (last 2 hours)
    const { data, error } = await supabase
      .from('vehicle_locations')
      .select('route_id, route_type')
      .gte('timestamp', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString())
      .not('route_id', 'is', null)  // Filter out null route_ids
      .not('route_type', 'is', null)  // Filter out null route_types
      .order('route_id')

    if (error) throw error

    // Get unique routes (with proper null handling)
    const routeMap = new Map<string, { route_id: string; route_type: number }>()
    
    data.forEach(v => {
      // Double-check for null (TypeScript still thinks they might be null)
      if (v.route_id !== null && v.route_type !== null) {
        const key = `${v.route_id}-${v.route_type}`
        if (!routeMap.has(key)) {
          routeMap.set(key, {
            route_id: v.route_id,
            route_type: v.route_type
          })
        }
      }
    })

    const routes = Array.from(routeMap.values()).map(route => ({
      ...route,
      name: `${getRouteTypeName(route.route_type)} ${route.route_id}`,
      type_name: getRouteTypeName(route.route_type)
    }))

    return NextResponse.json({
      routes,
      count: routes.length
    })
  } catch (error) {
    console.error('Error fetching routes:', error)
    return NextResponse.json(
      { error: 'Failed to fetch routes' },
      { status: 500 }
    )
  }
}