export interface MapboxMap {
    remove: () => void
    dragRotate: {
        disable: () => void
    }
    touchZoomRotate: {
        disableRotation: () => void
    }
}

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mapboxgl: any
    }
}

export async function initialiseMapboxMap(container: HTMLDivElement): Promise<MapboxMap> {
    await loadMapboxAssets()

    const mapboxgl = window.mapboxgl
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

    const map = new mapboxgl.Map({
        container,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [144.9631, -37.8136],
        zoom: 10
    })

    map.dragRotate.disable()
    map.touchZoomRotate.disableRotation()

    return map
}

function loadMapboxAssets(): Promise<void> {
    return new Promise((resolve, reject) => {
        if (window.mapboxgl) {
            resolve()
            return
        }

        const existingCss = document.querySelector('link[href*="mapbox-gl.css"]')

        if (!existingCss) {
            const link = document.createElement('link')
            link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.css'
            link.rel = 'stylesheet'
            document.head.appendChild(link)
        }

        const script = document.createElement('script')
        script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.0.1/mapbox-gl.js'
        script.onload = () => resolve()
        script.onerror = () => reject(new Error('Failed to load Mapbox'))
        document.head.appendChild(script)
    })
}