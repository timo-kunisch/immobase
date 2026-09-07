import "server-only";
import { cookies } from "next/headers";

import { deleteAllSessionsForUser, deleteSessionByToken, insertSession } from "@/data/sessions";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";

export { SESSION_COOKIE_NAME };

// Datenbank-Sessions (kein JWT/Stateless-Cookie): Das Cookie enthält
// ausschließlich einen zufälligen, nicht erratbaren Token – niemals
// Nutzdaten. Das erlaubt serverseitiges Widerrufen einzelner Sessions
// (z. B. beim Entzug einer Freigabe durch einen Admin).
const SESSION_DURATION_MS = 30 * 24 * 60 * 60 * 1000; // 30 Tage

function generateSessionToken(): string {
	// 32 Byte Zufallsdaten, hex-codiert - Web-Crypto-API (in Node.js global
	// verfügbar, kein Import des "crypto"-Moduls nötig).
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	return Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
}

/** Legt eine neue Session in der DB an und setzt das httpOnly-Session-Cookie. */
export async function createSession(userId: string): Promise<void> {
	const token = generateSessionToken();
	const expires = new Date(Date.now() + SESSION_DURATION_MS);

	insertSession({ sessionToken: token, userId, expires: expires.toISOString() });

	const cookieStore = await cookies();
	cookieStore.set(SESSION_COOKIE_NAME, token, {
		httpOnly: true,
		// "secure" nur bei HTTPS: Die Desktop-App läuft auch in Produktion
		// über http://127.0.0.1 bzw. im Host-Modus über eine http://LAN-IP -
		// ein Secure-Cookie würde dort vom Browser stillschweigend abgelehnt
		// und der Login wäre unmöglich. Deshalb an die konfigurierte APP_URL
		// koppeln statt an NODE_ENV.
		secure: (process.env.APP_URL ?? "").startsWith("https://"),
		sameSite: "lax",
		path: "/",
		expires,
	});
}

/**
 * Beendet die aktuelle Session: löscht den DB-Eintrag (Server-seitiger
 * Widerruf) und entfernt das Cookie beim Client.
 */
export async function destroySession(): Promise<void> {
	const cookieStore = await cookies();
	const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;

	if (token) {
		deleteSessionByToken(token);
	}

	cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Beendet ALLE Sessions eines Nutzers (z. B. wenn ein Admin einem Nutzer
 * die Freigabe entzieht oder das Passwort zurückgesetzt wird) – dadurch
 * werden auch bereits angemeldete Browser-Sitzungen dieses Nutzers beim
 * nächsten Datenzugriff wieder ausgesperrt.
 */
export async function destroyAllSessionsForUser(userId: string): Promise<void> {
	deleteAllSessionsForUser(userId);
}
