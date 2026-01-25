import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Vehicle } from '@/lib/types'

export async function GET() {
  try {
    const supabase = await createClient()

    // Get latest position for each vehicle (last hour)
    const { data, error } = await supabase
      .from('vehicle_locations')
      .select('*')
      .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('timestamp', { ascending: false })
      .limit(1000)

    if (error) throw error

    // Group by vehicle_id and take most recent
    const latestPositions = new Map<string, Vehicle>()
    
    data.forEach((vehicle) => {
      if (!latestPositions.has(vehicle.vehicle_id)) {
        latestPositions.set(vehicle.vehicle_id, vehicle)
      }
    })

    return NextResponse.json({
      vehicles: Array.from(latestPositions.values()),
      count: latestPositions.size,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching vehicles:', error)
    return NextResponse.json(
      { error: 'Failed to fetch vehicles' },
      { status: 500 }
    )
  }
}