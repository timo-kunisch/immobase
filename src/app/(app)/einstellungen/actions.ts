"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { saveCompanySettings } from "@/data/company-settings";
import { setSetting } from "@/data/app-settings";
import { getFilesDir } from "@/data/paths";
import { resetApplicationData } from "@/data/reset";
import { ActionState } from "@/lib/action-state";
import { getDataKeyBase64 } from "@/lib/data-key";
import { encryptPlaintextFilesInTree } from "@/lib/file-crypto";
import { generateMcpToken, getMcpToken, hasMcpToken, setMcpEnabled } from "@/lib/mcp/auth";

import { RESET_CONFIRMATION_PHRASE } from "./reset-confirmation";

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

/**
 * Speichert die Absenderdaten (Vermieter/Hausverwaltung), die auf erzeugten
 * PDFs (aktuell: Nebenkostenabrechnungen) als Briefkopf erscheinen. Nur für
 * Admins zugänglich - requireAdmin() leitet andernfalls um/wirft.
 */
export async function saveCompanySettingsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const admin = await requireAdmin();

	const name = getString(formData, "name");
	const street = getString(formData, "street");
	const zipCode = getString(formData, "zipCode");
	const city = getString(formData, "city");
	const additional = getString(formData, "additional");

	try {
		saveCompanySettings({
			name,
			street,
			zipCode,
			city,
			additional: additional || null,
		});
		logActivity(admin, "UPDATE", "einstellungen", "Absenderdaten aktualisiert");
	} catch (error) {
		console.error("saveCompanySettingsAction failed", error);
		return { error: "Die Einstellungen konnten nicht gespeichert werden." };
	}

	revalidatePath("/einstellungen");
	return { success: true };
}

/**
 * Speichert die Integrations-Einstellungen (SMTP für E-Mail-Versand,
 * LetterXpress für Postversand) in der app_settings-Tabelle. Leere
 * Geheimnis-Felder (Passwort/API-Key) bleiben unverändert - so muss die UI
 * vorhandene Werte nicht anzeigen. Nur für Admins.
 */
export async function saveIntegrationSettingsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const admin = await requireAdmin();

	try {
		// SMTP (leere Host-Adresse = deaktiviert -> alle E-Mail-Funktionen abgeschaltet)
		setSetting("smtp.host", getString(formData, "smtpHost"));
		setSetting("smtp.port", getString(formData, "smtpPort"));
		setSetting("smtp.secure", formData.get("smtpSecure") === "on" ? "true" : "false");
		setSetting("smtp.user", getString(formData, "smtpUser"));
		const smtpPass = getString(formData, "smtpPass");
		if (smtpPass) setSetting("smtp.pass", smtpPass);
		setSetting("smtp.from", getString(formData, "smtpFrom"));

		// LetterXpress (Postversand - optionale Online-Funktion)
		setSetting("letterxpress.username", getString(formData, "lxUsername"));
		const lxApiKey = getString(formData, "lxApiKey");
		if (lxApiKey) setSetting("letterxpress.apikey", lxApiKey);
		setSetting("letterxpress.mode", getString(formData, "lxMode") === "live" ? "live" : "test");

		logActivity(admin, "UPDATE", "einstellungen", "SMTP- und LetterXpress-Einstellungen aktualisiert");
	} catch (error) {
		console.error("saveIntegrationSettingsAction failed", error);
		return { error: "Die Einstellungen konnten nicht gespeichert werden." };
	}

	revalidatePath("/einstellungen");
	return { success: true };
}

export interface EncryptFilesResult {
	encrypted?: number;
	alreadyEncrypted?: number;
	failed?: number;
	error?: string;
}

/**
 * Verschlüsselt alle noch im Klartext vorliegenden Bestandsdateien in
 * files/ (manueller Nachlauf zur automatischen Migration beim Server-Start,
 * siehe src/instrumentation.ts). Idempotent. Nur für Admins.
 */
export async function encryptExistingFilesAction(): Promise<EncryptFilesResult> {
	const admin = await requireAdmin();
	try {
		const result = await encryptPlaintextFilesInTree(getFilesDir());
		if (result.failed.length > 0) {
			return {
				error: `${result.failed.length} Datei(en) konnten nicht verschlüsselt werden (Details im Server-Log).`,
				encrypted: result.encrypted,
				alreadyEncrypted: result.alreadyEncrypted,
				failed: result.failed.length,
			};
		}
		logActivity(admin, "UPDATE", "einstellungen", `Nachträgliche Dateiverschlüsselung ausgeführt (${result.encrypted} Datei(en) verschlüsselt)`);
		revalidatePath("/einstellungen");
		return { encrypted: result.encrypted, alreadyEncrypted: result.alreadyEncrypted, failed: 0 };
	} catch (error) {
		console.error("encryptExistingFilesAction failed", error);
		return { error: "Die Dateiverschlüsselung konnte nicht ausgeführt werden." };
	}
}

/**
 * Liefert den Master-Schlüssel der lokalen Datenverschlüsselung als
 * Base64-Text (Wiederherstellungsschlüssel). Sicherheitsrelevant: wird erst
 * nach explizitem Klick in der UI abgerufen. Nur für Admins.
 */
export async function getRecoveryKeyAction(): Promise<{ key?: string; error?: string }> {
	await requireAdmin();
	try {
		return { key: getDataKeyBase64() };
	} catch (error) {
		console.error("getRecoveryKeyAction failed", error);
		return { error: "Der Wiederherstellungsschlüssel konnte nicht gelesen werden." };
	}
}

/**
 * Setzt die komplette Anwendung zurück: löscht unwiderruflich die gesamte
 * Datenbank (sämtliche Fachdaten, Benutzerkonten, Sessions und
 * Einstellungen), alle abgelegten Dateien und lokal gespeicherte
 * Sicherungen (Details: src/data/reset.ts). Nur für Admins.
 * Schutz vor versehentlicher Auslösung: Tipp-Bestätigung
 * (RESET_CONFIRMATION_PHRASE), client- UND serverseitig geprüft.
 *
 * Nach dem Reset wird das Session-Cookie gelöscht (die Session existiert
 * ohnehin nicht mehr): Ohne das Löschen würde der Auth-Proxy (src/proxy.ts)
 * die öffentliche /setup-Seite wegen des noch vorhandenen Cookies sofort
 * wieder auf "/" umleiten. Der Client lädt anschließend die Ersteinrichtung
 * vollständig neu.
 */
export async function resetApplicationAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireAdmin();

	if (getString(formData, "confirmation") !== RESET_CONFIRMATION_PHRASE) {
		return { error: `Bitte geben Sie zur Bestätigung exakt „${RESET_CONFIRMATION_PHRASE}“ ein.` };
	}

	try {
		// Bewusst KEIN Eintrag ins Aktivitätsprotokoll: Der Reset löscht die
		// gesamte Datenbank inklusive der Protokoll-Tabelle - ein Eintrag
		// würde sofort wieder mitgelöscht.
		resetApplicationData();
	} catch (error) {
		console.error("resetApplicationAction failed", error);
		return { error: "Die Anwendung konnte nicht vollständig zurückgesetzt werden (Details im Server-Log)." };
	}

	const cookieStore = await cookies();
	cookieStore.delete(SESSION_COOKIE_NAME);

	return { success: true, message: "Die Anwendung wurde zurückgesetzt." };
}

// ============================================================
// KI-Assistent (OpenAI-kompatibler Endpunkt, optional)
// ============================================================

/**
 * Speichert die Konfiguration des KI-Assistenten (Basis-URL + Modell eines
 * OpenAI-kompatiblen Chat-Completions-Endpunkts, optionaler API-Schlüssel)
 * in app_settings (siehe src/lib/ai/config.ts). Leeres Schlüssel-Feld =
 * unverändert lassen (Muster wie beim SMTP-Passwort). Leere Basis-URL +
 * leeres Modell deaktivieren den Assistenten (Sprechblase wird gesperrt,
 * Chat-Route antwortet mit Hinweis). Nur für Admins.
 */
export async function saveAiSettingsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const admin = await requireAdmin();

	const baseUrl = getString(formData, "aiBaseUrl");
	const model = getString(formData, "aiModel");
	const apiKey = getString(formData, "aiApiKey");

	if (baseUrl && !/^https?:\/\/.+/.test(baseUrl)) {
		return { error: "Die Basis-URL muss mit http:// oder https:// beginnen (z. B. https://api.openai.com/v1)." };
	}
	if (baseUrl && !model) {
		return { error: "Bitte geben Sie auch ein Modell an (z. B. gpt-4o-mini)." };
	}
	if (!baseUrl && model) {
		return { error: "Bitte geben Sie auch die Basis-URL an (oder beide Felder leeren, um den KI-Assistenten zu deaktivieren)." };
	}

	try {
		setSetting("ai.base_url", baseUrl);
		setSetting("ai.model", model);
		if (apiKey) setSetting("ai.apikey", apiKey);
		logActivity(admin, "UPDATE", "einstellungen", "KI-Einstellungen aktualisiert");
	} catch (error) {
		console.error("saveAiSettingsAction failed", error);
		return { error: "Die KI-Einstellungen konnten nicht gespeichert werden." };
	}

	revalidatePath("/einstellungen");
	revalidatePath("/", "layout");
	return { success: true };
}

// ============================================================
// MCP-Server (KI-Zugriff, optional - standardmäßig deaktiviert)
// ============================================================

/**
 * Aktiviert/deaktiviert den MCP-Server (/api/mcp). Beim ersten Aktivieren
 * wird automatisch ein Zugriffs-Token erzeugt; beim Deaktivieren bleibt
 * das Token gespeichert (Zugriff ist dann trotzdem gesperrt), sodass eine
 * spätere Reaktivierung ohne Client-Umkonfiguration möglich ist.
 * Nur für Admins.
 */
export async function setMcpEnabledAction(enabled: boolean): Promise<ActionState> {
	const admin = await requireAdmin();
	try {
		setMcpEnabled(enabled);
		if (enabled && !hasMcpToken()) {
			generateMcpToken();
		}
		logActivity(admin, "UPDATE", "einstellungen", enabled ? "MCP-Server aktiviert" : "MCP-Server deaktiviert");
	} catch (error) {
		console.error("setMcpEnabledAction failed", error);
		return { error: "Die MCP-Einstellung konnte nicht gespeichert werden." };
	}
	revalidatePath("/einstellungen");
	return { success: true };
}

/**
 * Liefert das MCP-Zugriffs-Token im Klartext (zum Anzeigen/Kopieren in
 * der UI). Sicherheitsrelevant: wird erst nach explizitem Klick abgerufen
 * (Muster wie getRecoveryKeyAction). Nur für Admins.
 */
export async function getMcpTokenAction(): Promise<{ token?: string; error?: string }> {
	await requireAdmin();
	try {
		const token = getMcpToken();
		if (!token) return { error: "Es ist noch kein MCP-Token vorhanden - MCP-Server zuerst aktivieren." };
		return { token };
	} catch (error) {
		console.error("getMcpTokenAction failed", error);
		return { error: "Das MCP-Token konnte nicht gelesen werden." };
	}
}

/**
 * Erzeugt ein neues MCP-Zugriffs-Token (Rotations-Funktion). Das bisherige
 * Token ist ab sofort ungültig - verbundene KI-Clients müssen umkonfiguriert
 * werden. Nur für Admins.
 */
export async function regenerateMcpTokenAction(): Promise<{ token?: string; error?: string }> {
	const admin = await requireAdmin();
	try {
		const token = generateMcpToken();
		logActivity(admin, "UPDATE", "einstellungen", "MCP-Zugriffs-Token neu erzeugt");
		return { token };
	} catch (error) {
		console.error("regenerateMcpTokenAction failed", error);
		return { error: "Das MCP-Token konnte nicht neu erzeugt werden." };
	}
}
