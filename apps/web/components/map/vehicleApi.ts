import type { Tables } from '@/lib/database/types'

type Vehicle = Tables<'vehicle_locations'>

export async function fetchCurrentVehicles(): Promise<Vehicle[]> {
    const res = await fetch('/api/vehicles/current')
    const data = await res.json()

    if (!res.ok) {
        throw new Error(data?.error ?? 'Failed to fetch current vehicles')
    }

    return data.vehicles ?? []
}

export async function fetchVehicleHistory(
    seconds: number,
    retries = 5
): Promise<Vehicle[]> {

    try {

        const res = await fetch(`/api/vehicles/history?seconds=${seconds}`)

        let data = null

        try {
            data = await res.json()
        } catch {
            data = null
        }

        if (!res.ok) {
            throw new Error(
                data?.error ??
                `History request failed with status ${res.status}`
            )
        }

        console.log(
            `Successfully fetched ${data?.vehicles?.length ?? 0} historical vehicle records`
        )

        return data?.vehicles ?? []

    } catch (error) {

        if (retries <= 0) {
            throw error
        }

        console.warn(
            `History fetch failed. Retrying... (${retries} retries left)`,
            error
        )

        // small backoff
        await new Promise(resolve => setTimeout(resolve, 750))

        return fetchVehicleHistory(seconds, retries - 1)
    }
}
