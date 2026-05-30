'use client'

// Main train tracker page — full-screen map with live and history modes.

import { useEffect, useRef, useState } from 'react'
import type { Tables } from '@/lib/database/types'
import { useRouteConfig } from '@/app/providers'
import { fetchCurrentVehicles, fetchVehicleHistory } from './api/vehicleApi'
import { renderVehicleMarkers } from './markers'
import { HistorySlider } from './ui/HistorySlider'
import { getLatestVehiclesBeforeTime } from '@/lib/vehicles/timeFilter'
import { useMapboxMap } from './hooks/useMapboxMap'
import { MapErrorOverlay } from './ui/MapErrorOverlay'
import { TrackerModeToggle } from './ui/TrackerModeToggle'
import { HistoryLoadingOverlay } from './ui/HistoryLoadingOverlay'
import {
    HISTORY_FETCH_BUFFER_SECONDS,
    HISTORY_WINDOW_SECONDS,
    PLAYBACK_SECONDS_FOR_FULL_RANGE,
    REFRESH_INTERVAL_MS,
    type TrackerMode
} from './utils/constants'
import {
    createDefaultTimeWindow,
    formatTimeLabel,
    getSliderIncrement,
    getTimestampFromSliderValue,
    type TimeWindow
} from './utils/sliderTime'
import { sortVehiclesByTime } from './utils/vehicleSorting'

type Vehicle = Tables<'vehicle_locations'>

export default function PTVTrainTracker() {
    const routesById = useRouteConfig().routesById

    const {
        mapContainerRef,
        mapRef,
        markersRef,
        mapError,
        isMapReady
    } = useMapboxMap()

    // Vehicle data stored in refs so background fetches don't cause re-renders.
    const currentVehiclesRef = useRef<Vehicle[]>([])
    const historyVehiclesRef = useRef<Vehicle[]>([])

    const [historyLoading, setHistoryLoading] = useState(false)
    const [trackerMode, setTrackerMode] = useState<TrackerMode>('live')
    const trackerModeRef = useRef<TrackerMode>('live')
    const [isPlaying, setIsPlaying] = useState(false)
    const [sliderValue, setSliderValue] = useState(100)
    const [timeWindow, setTimeWindow] = useState<TimeWindow | null>(null)

    const sliderTimestamp = timeWindow
        ? getTimestampFromSliderValue(timeWindow, sliderValue)
        : null

    const sliderTimeLabel = formatTimeLabel(sliderTimestamp)

    // Keep a ref in sync so interval callbacks always see the latest mode.
    trackerModeRef.current = trackerMode

    // Set up the 15-minute history window on first render.
    useEffect(() => {
        setTimeWindow(createDefaultTimeWindow(HISTORY_WINDOW_SECONDS))
    }, [])

    // Once the map is ready, load data and start the live refresh interval.
    useEffect(() => {
        if (!isMapReady) {
            return
        }

        loadCurrentVehicles()
        loadHistoryVehicles()

        const intervalId = setInterval(loadCurrentVehicles, REFRESH_INTERVAL_MS)

        return () => {
            clearInterval(intervalId)
        }
    }, [isMapReady])

    // Animate the slider forward when playback is running.
    useEffect(() => {
        if (!isPlaying) {
            return
        }

        let animationFrameId = 0
        let previousTime: number | null = null

        function animate(currentTime: number) {
            if (previousTime === null) {
                previousTime = currentTime
            }

            const deltaSeconds = (currentTime - previousTime) / 1000
            previousTime = currentTime

            const increment = getSliderIncrement(
                deltaSeconds,
                PLAYBACK_SECONDS_FOR_FULL_RANGE
            )

            setSliderValue(previousValue => {
                const nextValue = Math.min(previousValue + increment, 100)

                if (trackerMode === 'history') {
                    showHistoricalVehiclesAtSlider(nextValue)
                }

                // Reached the end — stop playback and switch back to live.
                if (nextValue >= 100) {
                    setIsPlaying(false)
                    switchToLiveMode()
                }

                return nextValue
            })

            animationFrameId = requestAnimationFrame(animate)
        }

        animationFrameId = requestAnimationFrame(animate)

        return () => {
            cancelAnimationFrame(animationFrameId)
        }
    }, [isPlaying, trackerMode, timeWindow])

    async function loadCurrentVehicles() {
        try {
            const vehicles = await fetchCurrentVehicles()
            currentVehiclesRef.current = vehicles

            if (trackerModeRef.current === 'live') {
                showVehiclesOnMap(vehicles)
            }
        } catch (error) {
            console.error('Error fetching current vehicles:', error)
        }
    }

    async function loadHistoryVehicles() {
        try {
            setHistoryLoading(true)

            const secondsToFetch = HISTORY_WINDOW_SECONDS + HISTORY_FETCH_BUFFER_SECONDS
            const vehicles = await fetchVehicleHistory(secondsToFetch)
            const sortedVehicles = sortVehiclesByTime(vehicles)

            historyVehiclesRef.current = sortedVehicles

            if (trackerModeRef.current === 'history') {
                showHistoricalVehiclesAtSlider(sliderValue)
            }
        } catch (error) {
            console.error('Error fetching vehicle history:', error)
        } finally {
            setHistoryLoading(false)
        }
    }

    function showVehiclesOnMap(vehicles: Vehicle[]) {
        renderVehicleMarkers({
            map: mapRef.current,
            markersRef,
            vehicles,
            routesById
        })
    }

    function showHistoricalVehiclesAtSlider(value: number) {
        if (!timeWindow) {
            return
        }

        const selectedTime = getTimestampFromSliderValue(timeWindow, value)
        const vehiclesAtTime = getLatestVehiclesBeforeTime(
            historyVehiclesRef.current,
            selectedTime
        )

        showVehiclesOnMap(vehiclesAtTime)
    }

    function switchToLiveMode() {
        setTrackerMode('live')
        setSliderValue(100)
        showVehiclesOnMap(currentVehiclesRef.current)
    }

    function switchToHistoryMode() {
        setTrackerMode('history')
        showHistoricalVehiclesAtSlider(sliderValue)
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

        showHistoricalVehiclesAtSlider(value)
    }

    function togglePlayPause() {
        setIsPlaying(previous => !previous)
    }

    const showHistoryLoading = historyLoading && trackerMode === 'history'

    return (
        <div className="relative h-[100dvh] w-full overflow-hidden">
            {mapError && <MapErrorOverlay message={mapError} />}

            <div ref={mapContainerRef} className="h-full w-full" />

            {timeWindow && (
                <>
                    <TrackerModeToggle
                        trackerMode={trackerMode}
                        onSelectLive={switchToLiveMode}
                        onSelectHistory={switchToHistoryMode}
                    />

                    <HistorySlider
                        isPlaying={isPlaying}
                        currentTimeLabel={sliderTimeLabel}
                        value={sliderValue}
                        onPlayPause={togglePlayPause}
                        onChange={handleSliderChange}
                    />
                </>
            )}

            {showHistoryLoading && <HistoryLoadingOverlay />}
        </div>
    )
}
