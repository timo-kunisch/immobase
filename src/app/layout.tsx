import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "ImmoBase",
	description: "Verwaltung von Liegenschaften, Mieteinheiten, Mietern und Mietverträgen",
};

// Bewusst schlank gehalten: Die Sidebar (nur für angemeldete Nutzer) lebt im
// Layout der "(app)"-Route-Group, die öffentlichen Auth-Seiten
// ("(auth)"-Route-Group: Login/Registrierung/…) haben ihr eigenes,
// schlichtes Layout ohne Navigation.
export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang="de" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
			<head>
				<link rel="icon" href="/favicon.ico" sizes="any" />
				<link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
				<link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
				<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
				<link rel="manifest" href="/site.webmanifest" />
			</head>
			<body className="min-h-full">
				<TooltipProvider>{children}</TooltipProvider>
			</body>
		</html>
	);
}
