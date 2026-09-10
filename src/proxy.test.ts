import { describe, expect, it } from "vitest";
import { NextRequest, type NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { proxy } from "@/proxy";

/**
 * Auth-Guard src/proxy.ts (Next.js-"Proxy"-Konvention, optimistischer
 * Cookie-Check ohne DB-Zugriff).
 *
 * Kern-Regression (ERR_TOO_MANY_REDIRECTS beim App-Start): Öffentliche
 * Pfade (Login & Co.) darf der Proxy NIE selbst umleiten - auch nicht bei
 * vorhandenem Session-Cookie. Der Proxy kennt nur die Cookie-EXISTENZ,
 * nicht dessen Gültigkeit; ein veraltetes Cookie (Session in der DB
 * gelöscht/abgelaufen, z. B. nach Passwort-Reset, Freigabe-Entzug oder
 * Backup-Import einer fremden Datenbank) würde sonst zusammen mit
 * requireUser() im App-Layout (redirect("/login")) die unendliche
 * Schleife /login -> / -> /login ... erzeugen. Ob ein tatsächlich
 * Angemeldeter öffentliche Seiten überspringt, entscheiden die Seiten
 * selbst autoritativ per getCurrentUser() (siehe src/app/(auth)).
 */

// Hinweis: NextRequest normalisiert 127.0.0.1 zu localhost - daher diese
// Basis-URL für die erwarteten Redirect-Ziele.
const BASE_URL = "http://localhost:3000";

function buildRequest(path: string, sessionCookie?: string): NextRequest {
	const headers = new Headers();
	if (sessionCookie !== undefined) {
		headers.set("cookie", `${SESSION_COOKIE_NAME}=${sessionCookie}`);
	}
	return new NextRequest(`${BASE_URL}${path}`, { headers });
}

/** Response läuft unverändert durch (kein Redirect des Proxys). */
function expectPassThrough(response: NextResponse): void {
	expect(response.headers.get("x-middleware-next")).toBe("1");
	expect(response.headers.get("location")).toBeNull();
}

/** Response ist ein Redirect des Proxys auf den erwarteten Pfad. */
function expectRedirectTo(response: NextResponse, expectedPath: string): void {
	expect(response.headers.get("x-middleware-next")).toBeNull();
	expect(response.headers.get("location")).toBe(`${BASE_URL}${expectedPath}`);
}

describe("proxy (src/proxy.ts)", () => {
	it("leitet öffentliche Pfade immer durch - auch mit (evtl. veraltetem) Session-Cookie", () => {
		for (const path of ["/login", "/register", "/verify-email", "/forgot-password", "/reset-password", "/setup"]) {
			expectPassThrough(proxy(buildRequest(path, "veraltetes-cookie")));
			expectPassThrough(proxy(buildRequest(path)));
		}
	});

	it("behandelt auch öffentliche Unterpfade als öffentlich", () => {
		expectPassThrough(proxy(buildRequest("/login/subseite", "veraltetes-cookie")));
		expectPassThrough(proxy(buildRequest("/setup/schritt", "veraltetes-cookie")));
	});

	it("leitet nicht-öffentliche Pfade ohne Session-Cookie zum Login um (inkl. from-Parameter)", () => {
		expectRedirectTo(proxy(buildRequest("/finanzen")), "/login?from=%2Ffinanzen");
		expectRedirectTo(proxy(buildRequest("/")), "/login?from=%2F");
	});

	it("lässt nicht-öffentliche Pfade mit Session-Cookie durch", () => {
		expectPassThrough(proxy(buildRequest("/finanzen", "session-token")));
		expectPassThrough(proxy(buildRequest("/weg/beschluesse", "session-token")));
	});
});
