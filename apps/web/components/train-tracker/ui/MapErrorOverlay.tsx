// Full-screen error message shown when the map fails to load.

interface MapErrorOverlayProps {
    message: string
}

export function MapErrorOverlay({ message }: MapErrorOverlayProps) {
    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black">
            <div className="max-w-md rounded-2xl border border-red-500/20 bg-zinc-900 px-8 py-6 text-center shadow-2xl">
                <div className="mb-3 text-xl font-semibold text-white">
                    Map Failed to Load
                </div>

                <div className="text-sm leading-relaxed text-zinc-300">
                    {message}
                </div>
            </div>
        </div>
    )
}
