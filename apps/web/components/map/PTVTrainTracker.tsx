// PTVTrainTracker.tsx
'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { Tables } from '@/lib/database/types'
import { useRouteConfig } from '@/app/providers'
import { initialiseMapboxMap } from './mapbox'
import { fetchCurrentVehicles, fetchVehicleHistory } from './vehicleApi'
import {
	renderVehicleMarkers,
	removeAllVehicleMarkers,
	type VehicleMarkerRecord,
	type MapboxMap
} from './vehicleMarkers'
import { HistorySlider } from './HistorySlider'
import { getLatestVehiclesBeforeTime } from '@/lib/vehicles/timeFilter'

type Vehicle = Tables<'vehicle_locations'>
type TrackerMode = 'live' | 'history'

const REFRESH_INTERVAL = parseInt(process.env.NEXT_PUBLIC_REFRESH_INTERVAL_MS || '30000')
const HISTORY_SECONDS = 900
const PLAYBACK_SECONDS_FOR_FULL_RANGE = 10

export default function PTVTrainTracker() {
	const routesById = useRouteConfig().routesById

	const mapContainerRef = useRef<HTMLDivElement>(null)
	const mapRef = useRef<MapboxMap | null>(null)
	const markersRef = useRef<Map<string, VehicleMarkerRecord>>(new Map())

	const currentVehiclesRef = useRef<Vehicle[]>([])
	const historyVehiclesRef = useRef<Vehicle[]>([])

	const [mapError, setMapError] = useState<string | null>(null)
	const [historyLoading, setHistoryLoading] = useState(false)
	const [trackerMode, setTrackerMode] = useState<TrackerMode>('live')
	const [isPlaying, setIsPlaying] = useState(false)
	const [sliderValue, setSliderValue] = useState(100)

	const [timeWindow, setTimeWindow] = useState<{
		start: Date
		end: Date
	} | null>(null)

	useEffect(() => {
		const end = new Date()
		const start = new Date(end.getTime() - HISTORY_SECONDS * 1000)

		setTimeWindow({ start, end })
	}, [])

	const sliderTimestamp = timeWindow
		? new Date(
			timeWindow.start.getTime() +
			(sliderValue / 100) * (timeWindow.end.getTime() - timeWindow.start.getTime())
		)
		: null

	const sliderTimeLabel = sliderTimestamp
		? sliderTimestamp.toLocaleTimeString([], {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit'
		})
		: '--:--:--'

	useEffect(() => {
		if (!mapContainerRef.current || mapRef.current) return

		let interval: NodeJS.Timeout | null = null
		let cancelled = false

		async function setup() {
			let map: MapboxMap

			try {
				map = await initialiseMapboxMap(mapContainerRef.current!)
			} catch (error) {
				console.error('Failed to initialise map:', error)

				setMapError(
					'Failed to initialise WebGL map. Your browser or GPU may not support Mapbox rendering. Try opening this app in a different browser.'
				)

				return
			}

			if (cancelled) {
				map.remove()
				return
			}

			mapRef.current = map

			await loadCurrentVehicles()
			void loadHistoryVehicles()

			interval = setInterval(loadCurrentVehicles, REFRESH_INTERVAL)
		}

		setup()

		return () => {
			cancelled = true

			if (interval) {
				clearInterval(interval)
			}

			removeAllVehicleMarkers(markersRef)

			if (mapRef.current) {
				mapRef.current.remove()
				mapRef.current = null
			}
		}
	}, [])

	useEffect(() => {
		if (!isPlaying) return

		let animationFrameId: number
		let previousTime: number | null = null

		function animate(currentTime: number) {
			if (previousTime === null) {
				previousTime = currentTime
			}

			const deltaSeconds = (currentTime - previousTime) / 1000
			previousTime = currentTime

			setSliderValue(prev => {
				const increment = (100 / PLAYBACK_SECONDS_FOR_FULL_RANGE) * deltaSeconds
				const next = Math.min(prev + increment, 100)

				if (trackerMode === 'history') {
					renderHistoricalVehiclesAtSliderTime(next)
				}

				if (next >= 100) {
					setIsPlaying(false)
					switchToLiveMode()
				}

				return next
			})

			animationFrameId = requestAnimationFrame(animate)
		}

		animationFrameId = requestAnimationFrame(animate)

		return () => cancelAnimationFrame(animationFrameId)
	}, [isPlaying, trackerMode, timeWindow])

	async function loadCurrentVehicles() {
		try {
			const vehicles = await fetchCurrentVehicles()

			currentVehiclesRef.current = vehicles

			if (trackerMode === 'live') {
				renderVehicleMarkers({
					map: mapRef.current,
					markersRef,
					vehicles,
					routesById
				})
			}
		} catch (error) {
			console.error('Error fetching current vehicles:', error)
		}
	}

	async function loadHistoryVehicles() {
		try {
			setHistoryLoading(true)

			const vehicles = await fetchVehicleHistory(HISTORY_SECONDS + 300)

			historyVehiclesRef.current = vehicles.sort(
				(a, b) =>
					new Date(a.created_at ?? a.timestamp).getTime() -
					new Date(b.created_at ?? b.timestamp).getTime()
			)

			if (trackerMode === 'history') {
				renderHistoricalVehiclesAtSliderTime(sliderValue)
			}
		} catch (error) {
			console.error('Error fetching vehicle history:', error)
		} finally {
			setHistoryLoading(false)
		}
	}

	function renderHistoricalVehiclesAtSliderTime(value: number) {
		if (!timeWindow) return

		const selectedTime = new Date(
			timeWindow.start.getTime() +
			(value / 100) * (timeWindow.end.getTime() - timeWindow.start.getTime())
		)

		const filteredVehicles = getLatestVehiclesBeforeTime(
			historyVehiclesRef.current,
			selectedTime
		)

		renderVehicleMarkers({
			map: mapRef.current,
			markersRef,
			vehicles: filteredVehicles,
			routesById
		})
	}

	function switchToLiveMode() {
		setTrackerMode('live')
		setSliderValue(100)

		renderVehicleMarkers({
			map: mapRef.current,
			markersRef,
			vehicles: currentVehiclesRef.current,
			routesById
		})
	}

	function switchToHistoryMode() {
		setTrackerMode('history')
		renderHistoricalVehiclesAtSliderTime(sliderValue)
	}

	function handleSliderChange(value: number) {
		setSliderValue(value)

		if (value >= 100) {
			switchToLiveMode()
			return
		}

		if (trackerMode !== 'history') {
			setTrackerMode('history')
		}

		renderHistoricalVehiclesAtSliderTime(value)
	}

	return (
		<div className="relative h-[100dvh] w-full overflow-hidden">
			{mapError && (
				<div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
					<div className="max-w-md rounded-2xl border border-red-500/20 bg-zinc-900 px-8 py-6 text-center shadow-2xl">
						<div className="mb-3 text-xl font-semibold text-white">
							Map Failed to Load
						</div>

						<div className="text-sm leading-relaxed text-zinc-300">
							{mapError}
						</div>
					</div>
				</div>
			)}

			<div ref={mapContainerRef} className="h-full w-full" />

			{timeWindow && (
				<>
					<div className="absolute top-4 left-4 z-10 rounded-full border border-white/10 bg-black/35 p-1 text-xs text-white shadow-lg backdrop-blur-md">
						<button
							type="button"
							onClick={switchToLiveMode}
							className={`rounded-full px-3 py-1 transition ${trackerMode === 'live'
									? 'bg-white text-black'
									: 'text-white/70 hover:text-white'
								}`}
						>
							Live
						</button>

						<button
							type="button"
							onClick={switchToHistoryMode}
							className={`rounded-full px-3 py-1 transition ${trackerMode === 'history'
									? 'bg-white text-black'
									: 'text-white/70 hover:text-white'
								}`}
						>
							History
						</button>
					</div>

					<HistorySlider
						isPlaying={isPlaying}
						currentTimeLabel={sliderTimeLabel}
						value={sliderValue}
						onPlayPause={() => setIsPlaying(prev => !prev)}
						onChange={handleSliderChange}
					/>
				</>
			)}

			{historyLoading && trackerMode === 'history' && (
				<div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
					<div className="rounded-2xl border border-white/10 bg-black/50 px-8 py-5 text-lg font-medium text-white shadow-2xl backdrop-blur-md">
						Loading historical vehicle data...
					</div>
				</div>
			)}
		</div>
	)
}