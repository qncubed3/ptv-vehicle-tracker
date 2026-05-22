// import { NextResponse } from 'next/server'
// import { createClient } from '@/lib/supabase/server'

// export const dynamic = 'force-dynamic'
// export const runtime = 'nodejs'

// export async function GET(_request: Request) {
//   try {
//     const supabase = await createClient()

//     // Get the earliest and latest timestamps
//     const { data, error } = await supabase
//       .from('vehicle_locations')
//       .select('timestamp')
//       .order('timestamp', { ascending: true })
//       .limit(1)

//     const { data: latestData, error: latestError } = await supabase
//       .from('vehicle_locations')
//       .select('timestamp')
//       .order('timestamp', { ascending: false })
//       .limit(1)

//     if (error || latestError) throw error || latestError

//     return NextResponse.json({
//       earliest: data?.[0]?.timestamp || null,
//       latest: latestData?.[0]?.timestamp || null,
//     })
//   } catch (error) {
//     console.error('Error fetching time range:', error)
//     return NextResponse.json(
//       { error: 'Failed to fetch time range' },
//       { status: 500 }
//     )
//   }
// }