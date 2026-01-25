"use client"

import { createContext, useContext, ReactNode } from "react"
import { RouteConfig } from "@/lib/route-config"

const RouteConfigContext = createContext<RouteConfig | null>(null)

export function RouteConfigProvider({
    children, config
}: {
    children: ReactNode
    config: RouteConfig
}) {
    return (
        <RouteConfigContext.Provider value={config}>
            {children}
        </RouteConfigContext.Provider>
    )
}

export function useRouteConfig() {
    const config = useContext(RouteConfigContext)
    if (!config) {
        throw new Error("useRouteConfig must be used within RouteConfigProvider")
    }
    return config
}