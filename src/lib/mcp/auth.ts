import { randomBytes, timingSafeEqual } from "node:crypto";

import { getSetting, setSetting } from "@/data/app-settings";

import type { McpToolScope } from "./registry";

/**
 * Konfiguration und Authentifizierung des MCP-Servers (Model Context
 * Protocol, siehe src/app/api/mcp/route.ts).
 *
 * Der MCP-Server ist eine optionale Online-Funktion: Er ist standardmäßig
 * DEAKTIVIERT und kann nur von Administratoren unter Einstellungen →
 * MCP-Server (KI-Zugriff) aktiviert werden. Der Zugriff erfolgt
 * ausschließlich über ein Bearer-Token (kein Session-Cookie, kein
 * Nutzerkonto).
 *
 * Es gibt zwei Token-Stufen (McpTokenKind), die den Werkzeug-Scope
 * (src/lib/mcp/registry.ts) des Requests bestimmen:
 * - "ADMIN" (Vollzugriff): alle Werkzeuge inkl. der Administrations-
 *   Werkzeuge (Nutzerverwaltung, Absenderdaten-Einstellungen).
 * - "USER" (eingeschränkt): nur die fachlichen Werkzeuge - entspricht dem,
 *   was ein normaler Nutzer auch in der App-Oberfläche darf.
 *
 * Einstellungen in app_settings:
 * - "mcp.enabled": "true"/"false" (Klartext - kein Geheimnis)
 * - "mcp.token": Admin-Zugriffs-Token (FELD-VERSCHLÜSSELT abgelegt, weil in
 *   SECRET_SETTING_KEYS in src/data/app-settings.ts eingetragen)
 * - "mcp.user_token": eingeschränktes Zugriffs-Token (ebenfalls verschlüsselt)
 */

const MCP_ENABLED_KEY = "mcp.enabled";

/** Token-Stufe eines MCP-Zugriffs-Tokens (bestimmt den Werkzeug-Scope). */
export type McpTokenKind = McpToolScope;

const TOKEN_KEYS: Record<McpTokenKind, string> = {
	ADMIN: "mcp.token",
	USER: "mcp.user_token",
};

/** Ist der MCP-Server aktiviert? (Standard: deaktiviert.) */
export function isMcpEnabled(): boolean {
	return getSetting(MCP_ENABLED_KEY) === "true";
}

export function setMcpEnabled(enabled: boolean): void {
	setSetting(MCP_ENABLED_KEY, enabled ? "true" : "false");
}

/** Das aktuelle Zugriffs-Token einer Stufe (undefined = noch keines erzeugt). */
export function getMcpToken(kind: McpTokenKind = "ADMIN"): string | undefined {
	return getSetting(TOKEN_KEYS[kind]);
}

export function hasMcpToken(kind: McpTokenKind = "ADMIN"): boolean {
	return Boolean(getMcpToken(kind));
}

/**
 * Erzeugt ein neues Zufalls-Token der Stufe und speichert es (ersetzt ein
 * etwaiges bisheriges Token - danach sind alle mit dem alten Token
 * laufenden Verbindungen abgemeldet). 32 Byte Zufall, base64url-kodiert.
 */
export function generateMcpToken(kind: McpTokenKind = "ADMIN"): string {
	const token = randomBytes(32).toString("base64url");
	setSetting(TOKEN_KEYS[kind], token);
	return token;
}

/** Entfernt das Token einer Stufe (beim Deaktivieren des MCP-Servers). */
export function clearMcpToken(kind: McpTokenKind = "ADMIN"): void {
	setSetting(TOKEN_KEYS[kind], "");
}

function matchesToken(candidate: Buffer, stored: string | undefined): boolean {
	if (!stored) return false;
	const storedBuffer = Buffer.from(stored, "utf8");
	if (candidate.length !== storedBuffer.length) return false;
	return timingSafeEqual(candidate, storedBuffer);
}

/**
 * Prüft ein vom Client übermitteltes Token gegen beide gespeicherten Stufen
 * und liefert die zugehörige Token-Stufe (null = ungültig). Zeitkonstanter
 * Vergleich (timingSafeEqual) gegen Token-Erraten über Laufzeitunterschiede;
 * unterschiedliche Längen sind sofort falsch.
 */
export function resolveMcpTokenScope(candidate: string | null | undefined): McpTokenKind | null {
	if (!candidate) return null;
	const candidateBuffer = Buffer.from(candidate, "utf8");
	if (matchesToken(candidateBuffer, getMcpToken("ADMIN"))) return "ADMIN";
	if (matchesToken(candidateBuffer, getMcpToken("USER"))) return "USER";
	return null;
}
