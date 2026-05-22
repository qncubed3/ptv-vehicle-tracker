import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
	
	try {
		const supabase = await createClient()

		const secondsParam = request.nextUrl.searchParams.get('seconds')
		const seconds = secondsParam ? parseInt(secondsParam, 10) : 3600

		if (Number.isNaN(seconds) || seconds <= 0) {
			return NextResponse.json(
				{ error: 'Invalid seconds parameter' },
				{ status: 400 }
			)
		}

		const now = new Date()
		const cutoff = new Date(now.getTime() - seconds * 1000).toISOString()

		const { data, error } = await supabase
			.from('vehicle_locations')
			.select('*')
			.gte('created_at', cutoff)
			.lte('created_at', now.toISOString())
			.order('created_at', { ascending: false })
			.limit(10000)

		if (error) {
			console.error('Supabase error:', error)

			return NextResponse.json(
				{
					error: error.message,
					details: error.details,
					hint: error.hint,
					code: error.code
				},
				{ status: 500 }
			)
		}

		return NextResponse.json({
			vehicles: data,
			count: data.length,
			seconds,
			from: cutoff,
			to: now.toISOString()
		})
	} catch (error) {
		console.error('Error fetching vehicles:', error)

		return NextResponse.json(
			{ error: 'Failed to fetch vehicles' },
			{ status: 500 }
		)
	}
}