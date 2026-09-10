import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { I18nProvider } from "@/lib/i18n/provider";
import { getLocale, getT } from "@/lib/i18n/server";
import { getMessages } from "@/lib/i18n/messages";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

// Meta-Beschreibung in der gewählten Sprache (Cookie-basiert, siehe
// src/lib/i18n). Das Lesen des Cookies macht das Root-Layout dynamisch -
// für die lokal laufende App ohnehin ohne Belang (Fachseiten sind bereits
// force-dynamic, siehe AGENTS.md Abschnitt 2).
export async function generateMetadata(): Promise<Metadata> {
	const t = await getT();
	return {
		title: "ImmoBase",
		description: t("common.appDescription"),
	};
}

// Bewusst schlank gehalten: Die Sidebar (nur für angemeldete Nutzer) lebt im
// Layout der "(app)"-Route-Group, die öffentlichen Auth-Seiten
// ("(auth)"-Route-Group: Login/Registrierung/…) haben ihr eigenes,
// schlichtes Layout ohne Navigation. Der I18nProvider umschließt ALLES, damit
// Client Components überall useI18n() nutzen können (Sprache + Dictionary
// kommen serverseitig aus dem Locale-Cookie).
export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const locale = await getLocale();
	return (
		<html lang={locale} className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
			<head>
				<link rel="icon" href="/favicon.ico" sizes="any" />
				<link rel="icon" href="/favicon-16x16.png" type="image/png" sizes="16x16" />
				<link rel="icon" href="/favicon-32x32.png" type="image/png" sizes="32x32" />
				<link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180" />
				<link rel="manifest" href="/site.webmanifest" />
			</head>
			<body className="min-h-full">
<I18nProvider locale={locale} messages={getMessages(locale)}>
				<TooltipProvider>{children}</TooltipProvider>
				<Toaster />
			</I18nProvider>
			</body>
		</html>
	);
}
