// Helpers for the history slider and time labels.

export interface TimeWindow {
    start: Date
    end: Date
}

// Creates a time range ending now and going back by the given seconds.
export function createDefaultTimeWindow(historySeconds: number): TimeWindow {
    const end = new Date()
    const start = new Date(end.getTime() - historySeconds * 1000)

    return { start, end }
}

// Converts a slider value (0-100) into a date within the time window.
export function getTimestampFromSliderValue(
    timeWindow: TimeWindow,
    sliderValue: number
): Date {
    const windowLength = timeWindow.end.getTime() - timeWindow.start.getTime()
    const offset = (sliderValue / 100) * windowLength

    return new Date(timeWindow.start.getTime() + offset)
}

// Formats a date for display next to the slider.
export function formatTimeLabel(date: Date | null): string {
    if (!date) {
        return '--:--:--'
    }

    return date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    })
}

// Calculates how much the slider should move per animation frame.
export function getSliderIncrement(deltaSeconds: number, playbackSeconds: number): number {
    return (100 / playbackSeconds) * deltaSeconds
}
