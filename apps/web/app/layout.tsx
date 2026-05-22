import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { getRouteConfig } from "@/lib/route-config";
import { RouteConfigProvider } from "./providers";
import { Suspense } from "react";

const defaultUrl = process.env.VERCEL_URL
  	? `https://${process.env.VERCEL_URL}`
	: "http://localhost:3000";

export const metadata: Metadata = {
	metadataBase: new URL(defaultUrl),

	title: {
		default: 'Melbourne PTV Vehicle Tracker',
		template: '%s | Melbourne PTV Vehicle Tracker',
	},

	description:
		'Realtime and historical tracking of Melbourne public transport vehicles with live map visualisation and playback.',

	keywords: [
		'PTV',
		'Melbourne transport',
		'tram tracker',
		'train tracker',
		'bus tracker',
		'Mapbox',
		'public transport',
		'GTFS realtime',
		'Melbourne'
	],

	openGraph: {
		title: 'Melbourne PTV Vehicle Tracker',
		description:
			'Realtime and historical tracking of Melbourne public transport vehicles.',
		url: defaultUrl,
		siteName: 'Melbourne PTV Vehicle Tracker',
		type: 'website',
	},

	twitter: {
		card: 'summary_large_image',
		title: 'Melbourne PTV Vehicle Tracker',
		description:
			'Realtime and historical tracking of Melbourne public transport vehicles.',
	},
}

const geistSans = Geist({
	variable: "--font-geist-sans",
	display: "swap",
	subsets: ["latin"],
});

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const routeConfig = await getRouteConfig()

    return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${geistSans.className} antialiased`}>
				<Suspense fallback={<div>Loading...</div>}>
					<RouteConfigProvider config={routeConfig}>
						<ThemeProvider
							attribute="class"
							defaultTheme="system"
							enableSystem
							disableTransitionOnChange
						>
							{children}
						</ThemeProvider>
					</RouteConfigProvider>
				</Suspense>
			</body>
		</html>
    );
}
