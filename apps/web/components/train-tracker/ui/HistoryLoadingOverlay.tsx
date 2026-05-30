// Loading spinner shown while historical vehicle data is being fetched.

export function HistoryLoadingOverlay() {
    return (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
            <div className="rounded-2xl border border-white/10 bg-black/50 px-8 py-5 text-lg font-medium text-white shadow-2xl backdrop-blur-md">
                Loading historical vehicle data...
            </div>
        </div>
    )
}
