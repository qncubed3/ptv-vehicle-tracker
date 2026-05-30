// Shared numbers and types used across the train tracker.

// How often live vehicle data is refreshed (milliseconds).
export const REFRESH_INTERVAL_MS = parseInt(
    process.env.NEXT_PUBLIC_REFRESH_INTERVAL_MS || '30000'
)

// How far back the history slider can go (15 minutes).
export const HISTORY_WINDOW_SECONDS = 900

// Extra history fetched beyond the slider window so playback has data.
export const HISTORY_FETCH_BUFFER_SECONDS = 300

// How long it takes the slider to play from start to end (seconds).
export const PLAYBACK_SECONDS_FOR_FULL_RANGE = 10

// Whether the map shows live data or a point in history.
export type TrackerMode = 'live' | 'history'
