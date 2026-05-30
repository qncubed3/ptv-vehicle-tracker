'use client'

// Slider at the bottom of the map for scrubbing through history.

import { Pause, Play } from 'lucide-react'

interface HistorySliderProps {
    isPlaying: boolean
    currentTimeLabel: string
    value: number
    min?: number
    max?: number
    onPlayPause: () => void
    onChange: (value: number) => void
}

export function HistorySlider({
    isPlaying,
    currentTimeLabel,
    value,
    min = 0,
    max = 100,
    onPlayPause,
    onChange
}: HistorySliderProps) {
    return (
        <div
            className="absolute left-1/2 z-10 w-[min(720px,calc(100%-32px))] -translate-x-1/2 px-2"
            style={{
                bottom: 'max(16px, env(safe-area-inset-bottom))'
            }}
        >
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/35 px-3 pr-5 py-2 shadow-lg backdrop-blur-md">
                <button
                    type="button"
                    onClick={onPlayPause}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
                >
                    {isPlaying ? <Pause size={15} /> : <Play size={15} />}
                </button>

                <div className="w-[72px] text-xs tabular-nums text-white/80">
                    {currentTimeLabel}
                </div>

                <input
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(event) => onChange(Number(event.target.value))}
                    className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/20 accent-white"
                />
            </div>
        </div>
    )
}
