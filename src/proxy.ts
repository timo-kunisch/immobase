import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";

/**
 * Auth-Guard für die gesamte Anwendung (Next.js 16 "proxy"-Konvention,
 * früher "middleware.ts").
 *
 * WICHTIG (siehe guides/authentication.md der Next.js-Doku): Der Proxy soll
 * nur einen günstigen, "optimistischen" Check durchführen (hier: Existiert
 * überhaupt ein Session-Cookie?), da er auch bei Prefetches auf JEDER Route
 * läuft – ein Datenbank-Zugriff hier wäre ein Performance-Problem. Die
 * eigentliche, autoritative Prüfung (Session gültig? E-Mail verifiziert?
 * isApproved? Rolle?) erfolgt in der Data-Access-Layer
 * (src/lib/auth/dal.ts), die von den Layouts/Server Actions aufgerufen wird.
 *
 * Der zusätzliche Token-Check für den Host-Modus (Mehrbenutzer-Betrieb)
 * liegt bewusst NICHT hier, sondern im HTTP-Proxy des
 * Electron-Main-Prozesses (electron/main/server.ts): Nur dort steht die
 * Peer-IP der Verbindung zur Verfügung (Loopback vs. LAN).
 */

const PUBLIC_PATHS = ["/login", "/register", "/verify-email", "/forgot-password", "/reset-password"];

function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function proxy(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

	if (isPublicPath(pathname)) {
		// Bereits angemeldete Nutzer müssen die Login-/Register-Seiten nicht
		// mehr sehen – die autoritative Prüfung (DAL) leitet ungültige/
		// abgelaufene Sessions ohnehin zurück zu /login.
		if (hasSessionCookie && pathname !== "/verify-email") {
			return NextResponse.redirect(new URL("/", request.url));
		}
		return NextResponse.next();
	}

	if (!hasSessionCookie) {
		const loginUrl = new URL("/login", request.url);
		loginUrl.searchParams.set("from", pathname);
		return NextResponse.redirect(loginUrl);
	}

	return NextResponse.next();
}

export const config = {
	matcher: [
		/*
		 * Auf alle Pfade anwenden, außer:
		 * - _next/static (statische Dateien)
		 * - _next/image (Bildoptimierung)
		 * - favicon.ico, robots.txt, sitemap.xml
		 * - die favicon.io-Icon-Dateien (Tab-/Homescreen-Icons, siehe public/)
		 *   und das zugehörige site.webmanifest
		 * - /api/uploads (eigener Auth-Check im Route Handler, siehe dort)
		 */
		"/((?!_next/static|_next/image|favicon.ico|favicon-16x16.png|favicon-32x32.png|apple-touch-icon.png|android-chrome-192x192.png|android-chrome-512x512.png|site.webmanifest|robots.txt|sitemap.xml).*)",
	],
};
