// Live / History toggle buttons in the top-left corner of the map.

import type { TrackerMode } from '../utils/constants'

interface TrackerModeToggleProps {
    trackerMode: TrackerMode
    onSelectLive: () => void
    onSelectHistory: () => void
}

export function TrackerModeToggle({
    trackerMode,
    onSelectLive,
    onSelectHistory
}: TrackerModeToggleProps) {
    const liveButtonClass =
        trackerMode === 'live'
            ? 'bg-white text-black'
            : 'text-white/70 hover:text-white'

    const historyButtonClass =
        trackerMode === 'history'
            ? 'bg-white text-black'
            : 'text-white/70 hover:text-white'

    return (
        <div className="absolute top-4 left-4 z-10 rounded-full border border-white/10 bg-black/35 p-1 text-xs text-white shadow-lg backdrop-blur-md">
            <button
                type="button"
                onClick={onSelectLive}
                className={`rounded-full px-3 py-1 transition ${liveButtonClass}`}
            >
                Live
            </button>

            <button
                type="button"
                onClick={onSelectHistory}
                className={`rounded-full px-3 py-1 transition ${historyButtonClass}`}
            >
                History
            </button>
        </div>
    )
}
