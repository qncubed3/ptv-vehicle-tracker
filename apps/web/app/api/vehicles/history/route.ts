import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)
    
    const vehicleId = searchParams.get('vehicle_id')
    const hours = parseInt(searchParams.get('hours') || '24')
    const routeId = searchParams.get('route_id')
    const limit = parseInt(searchParams.get('limit') || '10000')

    let query = supabase
      .from('vehicle_locations')
      .select('*')
      .gte('timestamp', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: true })
      .limit(limit)

    // Filter by vehicle_id if provided
    if (vehicleId) {
      query = query.eq('vehicle_id', vehicleId)
    }

    // Filter by route_id if provided
    if (routeId) {
      query = query.eq('route_id', routeId)
    }

    const { data, error } = await query

    if (error) throw error

    // Group by vehicle_id for easier client-side processing
    const grouped = data.reduce((acc, vehicle) => {
      if (!acc[vehicle.vehicle_id]) {
        acc[vehicle.vehicle_id] = []
      }
      acc[vehicle.vehicle_id].push(vehicle)
      return acc
    }, {} as Record<string, typeof data>)

    return NextResponse.json({
      vehicles: grouped,
      vehicleCount: Object.keys(grouped).length,
      totalPoints: data.length,
      timeRange: {
        start: data[0]?.timestamp,
        end: data[data.length - 1]?.timestamp
      }
    })
  } catch (error) {
    console.error('Error fetching history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch history' },
      { status: 500 }
    )
  }
}