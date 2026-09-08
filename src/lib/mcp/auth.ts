import { randomBytes, timingSafeEqual } from "node:crypto";

import { getSetting, setSetting } from "@/data/app-settings";

/**
 * Konfiguration und Authentifizierung des MCP-Servers (Model Context
 * Protocol, siehe src/app/api/mcp/route.ts).
 *
 * Der MCP-Server ist eine optionale Online-Funktion: Er ist standardmäßig
 * DEAKTIVIERT und kann nur von Administratoren unter Einstellungen →
 * MCP-Server (KI-Zugriff) aktiviert werden. Der Zugriff erfolgt
 * ausschließlich über ein Bearer-Token (kein Session-Cookie, kein
 * Nutzerkonto) - das Token hat faktisch Admin-Rechte, weil die
 * MCP-Werkzeuge sämtliche Fachdaten lesen und schreiben können.
 *
 * Einstellungen in app_settings:
 * - "mcp.enabled": "true"/"false" (Klartext - kein Geheimnis)
 * - "mcp.token": das Zugriffs-Token (FELD-VERSCHLÜSSELT abgelegt, weil in
 *   SECRET_SETTING_KEYS in src/data/app-settings.ts eingetragen)
 */

const MCP_ENABLED_KEY = "mcp.enabled";
const MCP_TOKEN_KEY = "mcp.token";

/** Ist der MCP-Server aktiviert? (Standard: deaktiviert.) */
export function isMcpEnabled(): boolean {
	return getSetting(MCP_ENABLED_KEY) === "true";
}

export function setMcpEnabled(enabled: boolean): void {
	setSetting(MCP_ENABLED_KEY, enabled ? "true" : "false");
}

/** Das aktuelle MCP-Zugriffs-Token (undefined = noch keines erzeugt). */
export function getMcpToken(): string | undefined {
	return getSetting(MCP_TOKEN_KEY);
}

export function hasMcpToken(): boolean {
	return Boolean(getMcpToken());
}

/**
 * Erzeugt ein neues Zufalls-Token und speichert es (ersetzt ein etwaiges
 * bisheriges Token - danach sind alle mit dem alten Token laufenden
 * Verbindungen abgemeldet). 32 Byte Zufall, base64url-kodiert.
 */
export function generateMcpToken(): string {
	const token = randomBytes(32).toString("base64url");
	setSetting(MCP_TOKEN_KEY, token);
	return token;
}

/** Entfernt das Token (beim Deaktivieren des MCP-Servers). */
export function clearMcpToken(): void {
	setSetting(MCP_TOKEN_KEY, "");
}

/**
 * Prüft ein vom Client übermitteltes Token gegen das gespeicherte.
 * Zeitkonstanter Vergleich (timingSafeEqual) gegen Token-Erraten über
 * Laufzeitunterschiede; unterschiedliche Längen sind sofort falsch.
 */
export function isValidMcpToken(candidate: string | null | undefined): boolean {
	if (!candidate) return false;
	const stored = getMcpToken();
	if (!stored) return false;
	const candidateBuffer = Buffer.from(candidate, "utf8");
	const storedBuffer = Buffer.from(stored, "utf8");
	if (candidateBuffer.length !== storedBuffer.length) return false;
	return timingSafeEqual(candidateBuffer, storedBuffer);
}
