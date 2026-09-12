"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie";
import { saveCompanySettings } from "@/data/company-settings";
import { getSetting, setSetting } from "@/data/app-settings";
import { AI_PARTNER_PROVIDER } from "@/lib/ai/partner";
import { getFilesDir } from "@/data/paths";
import { resetApplicationContent, resetApplicationData } from "@/data/reset";
import { ActionState } from "@/lib/action-state";
import { getDataKeyBase64 } from "@/lib/data-key";
import { encryptPlaintextFilesInTree } from "@/lib/file-crypto";
import { getT } from "@/lib/i18n/server";
import { generateMcpToken, getMcpToken, hasMcpToken, setMcpEnabled, type McpTokenKind } from "@/lib/mcp/auth";

import { RESET_CONFIRMATION_PHRASE, RESET_CONTENT_CONFIRMATION_PHRASE } from "./reset-confirmation";

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
	const t = await getT();

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
		return { error: t("settings.errors.saveFailed") };
	}

	revalidatePath("/einstellungen");
	return { success: true };
}

/**
 * Speichert die SMTP-Einstellungen (E-Mail-Versand) in der
 * app_settings-Tabelle. Das leere Passwort-Feld bleibt unverändert - so muss
 * die UI vorhandene Werte nicht anzeigen. Nur für Admins.
 */
export async function saveSmtpSettingsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const admin = await requireAdmin();
	const t = await getT();

	try {
		// Leere Host-Adresse = deaktiviert -> alle E-Mail-Funktionen abgeschaltet
		setSetting("smtp.host", getString(formData, "smtpHost"));
		setSetting("smtp.port", getString(formData, "smtpPort"));
		setSetting("smtp.secure", formData.get("smtpSecure") === "on" ? "true" : "false");
		setSetting("smtp.user", getString(formData, "smtpUser"));
		const smtpPass = getString(formData, "smtpPass");
		if (smtpPass) setSetting("smtp.pass", smtpPass);
		setSetting("smtp.from", getString(formData, "smtpFrom"));

		logActivity(admin, "UPDATE", "einstellungen", "SMTP-Einstellungen (E-Mail-Versand) aktualisiert");
	} catch (error) {
		console.error("saveSmtpSettingsAction failed", error);
		return { error: t("settings.errors.saveFailed") };
	}

	revalidatePath("/einstellungen");
	return { success: true };
}

/**
 * Speichert die LetterXpress-Einstellungen (Postversand, optionale
 * Online-Funktion) in der app_settings-Tabelle. Das leere API-Key-Feld
 * bleibt unverändert - so muss die UI vorhandene Werte nicht anzeigen.
 * Nur für Admins.
 */
export async function saveLetterXpressSettingsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const admin = await requireAdmin();
	const t = await getT();

	try {
		setSetting("letterxpress.username", getString(formData, "lxUsername"));
		const lxApiKey = getString(formData, "lxApiKey");
		if (lxApiKey) setSetting("letterxpress.apikey", lxApiKey);
		setSetting("letterxpress.mode", getString(formData, "lxMode") === "live" ? "live" : "test");

		logActivity(admin, "UPDATE", "einstellungen", "LetterXpress-Einstellungen (Postversand) aktualisiert");
	} catch (error) {
		console.error("saveLetterXpressSettingsAction failed", error);
		return { error: t("settings.errors.saveFailed") };
	}

	revalidatePath("/einstellungen");
	return { success: true };
}

/**
 * Speichert die IMAP-Einstellungen für den E-Mail-Empfang (Ticket-Postfach,
 * siehe src/lib/email/imap-sync.ts). Leeres Passwort-Feld = unverändert
 * lassen (Muster wie beim SMTP-Passwort); leere Host-Adresse deaktiviert
 * den Abruf - das Ticket-System läuft dann mit Basis-Funktionen weiter.
 * Nur für Admins.
 */
export async function saveImapSettingsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const admin = await requireAdmin();
	const t = await getT();

	try {
		setSetting("imap.host", getString(formData, "imapHost"));
		setSetting("imap.port", getString(formData, "imapPort"));
		setSetting("imap.secure", formData.get("imapSecure") === "on" ? "true" : "false");
		setSetting("imap.user", getString(formData, "imapUser"));
		const imapPass = getString(formData, "imapPass");
		if (imapPass) setSetting("imap.pass", imapPass);
		setSetting("imap.mailbox", getString(formData, "imapMailbox") || "INBOX");

		logActivity(admin, "UPDATE", "einstellungen", "IMAP-Einstellungen (E-Mail-Postfach) aktualisiert");
	} catch (error) {
		console.error("saveImapSettingsAction failed", error);
		return { error: t("settings.errors.saveFailed") };
	}

	revalidatePath("/einstellungen");
	// Die Sidebar zeigt den Postfach-Eintrag abhängig von der Konfiguration.
	revalidatePath("/", "layout");
	return { success: true };
}

/**
 * Verbindungstest für die IMAP-Einstellungen (nach dem Speichern klickbar).
 * Nur für Admins.
 */
export async function testImapConnectionAction(): Promise<ActionState> {
	await requireAdmin();
	const t = await getT();
	// Lazy import: imapflow soll nur geladen werden, wenn es auch gebraucht wird.
	const { testImapConnection } = await import("@/lib/email/imap-sync");
	const result = await testImapConnection();
	if (!result.ok) {
		return { error: t("settings.cards.imap.testFailed", { error: result.error ?? t("settings.errors.unknown") }) };
	}
	return { success: true, message: t("settings.cards.imap.testSuccess") };
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
	const t = await getT();
	try {
		const result = await encryptPlaintextFilesInTree(getFilesDir());
		if (result.failed.length > 0) {
			return {
				error: t("settings.cards.security.encryptFailedCount", { count: result.failed.length }),
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
		return { error: t("settings.cards.security.encryptRunFailed") };
	}
}

/**
 * Liefert den Master-Schlüssel der lokalen Datenverschlüsselung als
 * Base64-Text (Wiederherstellungsschlüssel). Sicherheitsrelevant: wird erst
 * nach explizitem Klick in der UI abgerufen. Nur für Admins.
 */
export async function getRecoveryKeyAction(): Promise<{ key?: string; error?: string }> {
	await requireAdmin();
	const t = await getT();
	try {
		return { key: getDataKeyBase64() };
	} catch (error) {
		console.error("getRecoveryKeyAction failed", error);
		return { error: t("settings.cards.security.recoveryKey.readFailed") };
	}
}

/**
 * Vollständiger Reset (Variante "Inhalte und Einstellungen zurücksetzen"):
 * löscht unwiderruflich die gesamte Datenbank (sämtliche
 * Fachdaten, Benutzerkonten, Sessions und Einstellungen), alle abgelegten
 * Dateien und lokal gespeicherte Sicherungen (Details: src/data/reset.ts).
 * Nur für Admins. Schutz vor versehentlicher Auslösung: Tipp-Bestätigung
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
	const t = await getT();

	if (getString(formData, "confirmation") !== RESET_CONFIRMATION_PHRASE) {
		return { error: t("settings.cards.reset.confirmMismatch", { phrase: RESET_CONFIRMATION_PHRASE }) };
	}

	try {
		// Bewusst KEIN Eintrag ins Aktivitätsprotokoll: Der Reset löscht die
		// gesamte Datenbank inklusive der Protokoll-Tabelle - ein Eintrag
		// würde sofort wieder mitgelöscht.
		resetApplicationData();
	} catch (error) {
		console.error("resetApplicationAction failed", error);
		return { error: t("settings.cards.reset.full.failed") };
	}

	const cookieStore = await cookies();
	cookieStore.delete(SESSION_COOKIE_NAME);

	return { success: true, message: t("settings.cards.reset.full.success") };
}

/**
 * Inhalts-Reset (Variante "Inhalte zurücksetzen"): löscht unwiderruflich
 * sämtliche Fachdaten und Dateien, behält aber Benutzerkonten, Sitzungen
 * und Einstellungen (inkl. gespeicherter Zugangsdaten) - die Nutzer
 * bleiben angemeldet, die Anwendung läuft ohne Unterbrechung weiter
 * (Details: resetApplicationContent in src/data/reset.ts). Nur für Admins.
 * Schutz vor versehentlicher Auslösung: Tipp-Bestätigung
 * (RESET_CONTENT_CONFIRMATION_PHRASE), client- UND serverseitig geprüft.
 */
export async function resetApplicationContentAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const admin = await requireAdmin();
	const t = await getT();

	if (getString(formData, "confirmation") !== RESET_CONTENT_CONFIRMATION_PHRASE) {
		return { error: t("settings.cards.reset.confirmMismatch", { phrase: RESET_CONTENT_CONFIRMATION_PHRASE }) };
	}

	try {
		resetApplicationContent();
		// Bewusst NACH dem Reset protokollieren: Der Wipe leert auch das
		// Aktivitätsprotokoll - dieser Eintrag bleibt als einziger zurück
		// und dokumentiert, wer wann die Inhalte zurückgesetzt hat.
		logActivity(admin, "DELETE", "einstellungen", "Inhalte zurückgesetzt (Fachdaten und Dateien gelöscht, Benutzerkonten und Einstellungen erhalten)");
	} catch (error) {
		console.error("resetApplicationContentAction failed", error);
		return { error: t("settings.cards.reset.content.failed") };
	}

	// Sämtliche Fachdaten-Listen und Dashboards sind von der Löschung
	// betroffen - breit revalidieren, der Client lädt die Seite ohnehin neu.
	revalidatePath("/", "layout");
	return { success: true, message: t("settings.cards.reset.content.success") };
}

// ============================================================
// KI-Assistent (Partner arbeitskraft.app ODER OpenAI-kompatibler Endpunkt)
// ============================================================

/**
 * Aktiviert den KI-Assistenten über unseren Partner arbeitskraft.app
 * (Standard-Weg, prominent in der Einstellungs-Karte): Es genügt die Eingabe
 * des API-Schlüssels - Endpunkt (https://arbeitskraft.app/v1) und Modell
 * (unsere Cloud-Empfehlung) stehen fest und werden erst zur Laufzeit aus
 * src/lib/ai/partner.ts gebildet, nicht gespeichert (siehe
 * src/lib/ai/config.ts). Der Schlüssel ist die eigentliche Konfiguration:
 * Ohne ihn gilt der Partner-Modus als nicht konfiguriert. Leeres Feld =
 * vorhandenen Schlüssel unverändert lassen (Muster wie beim SMTP-Passwort).
 * Nur für Admins.
 */
export async function saveAiPartnerSettingsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const admin = await requireAdmin();
	const t = await getT();

	const apiKey = getString(formData, "aiApiKey");
	if (!apiKey && !getSetting("ai.apikey")) {
		return { error: t("settings.cards.ai.errors.partnerApiKeyRequired") };
	}

	try {
		setSetting("ai.provider", AI_PARTNER_PROVIDER);
		if (apiKey) setSetting("ai.apikey", apiKey);
		logActivity(admin, "UPDATE", "einstellungen", "KI-Assistent: Partner-Endpunkt arbeitskraft.app aktiviert");
	} catch (error) {
		console.error("saveAiPartnerSettingsAction failed", error);
		return { error: t("settings.cards.ai.errors.saveFailed") };
	}

	revalidatePath("/einstellungen");
	revalidatePath("/", "layout");
	return { success: true };
}

/**
 * Deaktiviert den KI-Assistenten vollständig: Löscht die Provider-Wahl und
 * einen evtl. gespeicherten benutzerdefinierten Endpunkt (Basis-URL + Modell).
 * Der API-Schlüssel bleibt bewusst hinterlegt (wie bei den übrigen Geheimnissen
 * ist ein Leeren über die UI nicht vorgesehen). Nur für Admins.
 */
export async function deactivateAiAction(): Promise<ActionState> {
	const admin = await requireAdmin();
	const t = await getT();

	try {
		setSetting("ai.provider", "");
		setSetting("ai.base_url", "");
		setSetting("ai.model", "");
		logActivity(admin, "UPDATE", "einstellungen", "KI-Assistent deaktiviert");
	} catch (error) {
		console.error("deactivateAiAction failed", error);
		return { error: t("settings.cards.ai.errors.saveFailed") };
	}

	revalidatePath("/einstellungen");
	revalidatePath("/", "layout");
	return { success: true };
}

/**
 * Speichert einen benutzerdefinierten OpenAI-kompatiblen Endpunkt (Basis-URL
 * + Modell, optionaler API-Schlüssel) in app_settings und ersetzt damit eine
 * evtl. aktive Partner-Konfiguration (siehe src/lib/ai/config.ts). Leeres
 * Schlüssel-Feld = unverändert lassen (Muster wie beim SMTP-Passwort). Leere
 * Basis-URL + leeres Modell deaktivieren den Assistenten komplett
 * (Sprechblase wird gesperrt, Chat-Route antwortet mit Hinweis). Nur für
 * Admins.
 */
export async function saveAiSettingsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const admin = await requireAdmin();
	const t = await getT();

	const baseUrl = getString(formData, "aiBaseUrl");
	const model = getString(formData, "aiModel");
	const apiKey = getString(formData, "aiApiKey");

	if (baseUrl && !/^https?:\/\/.+/.test(baseUrl)) {
		return { error: t("settings.cards.ai.errors.invalidBaseUrl") };
	}
	if (baseUrl && !model) {
		return { error: t("settings.cards.ai.errors.modelRequired") };
	}
	if (!baseUrl && model) {
		return { error: t("settings.cards.ai.errors.baseUrlRequired") };
	}

	try {
		setSetting("ai.provider", baseUrl ? "custom" : "");
		setSetting("ai.base_url", baseUrl);
		setSetting("ai.model", model);
		if (apiKey) setSetting("ai.apikey", apiKey);
		logActivity(
			admin,
			"UPDATE",
			"einstellungen",
			baseUrl
				? "KI-Assistent: Benutzerdefinierter KI-Endpunkt gespeichert"
				: "KI-Assistent deaktiviert"
		);
	} catch (error) {
		console.error("saveAiSettingsAction failed", error);
		return { error: t("settings.cards.ai.errors.saveFailed") };
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
 * werden automatisch beide Zugriffs-Token erzeugt (Admin-Token mit
 * Vollzugriff, eingeschränktes Nutzer-Token - siehe src/lib/mcp/auth.ts);
 * beim Deaktivieren bleiben die Token gespeichert (Zugriff ist dann
 * trotzdem gesperrt), sodass eine spätere Reaktivierung ohne
 * Client-Umkonfiguration möglich ist. Nur für Admins.
 */
export async function setMcpEnabledAction(enabled: boolean): Promise<ActionState> {
	const admin = await requireAdmin();
	const t = await getT();
	try {
		setMcpEnabled(enabled);
		if (enabled) {
			if (!hasMcpToken("ADMIN")) generateMcpToken("ADMIN");
			if (!hasMcpToken("USER")) generateMcpToken("USER");
		}
		logActivity(admin, "UPDATE", "einstellungen", enabled ? "MCP-Server aktiviert" : "MCP-Server deaktiviert");
	} catch (error) {
		console.error("setMcpEnabledAction failed", error);
		return { error: t("settings.cards.mcp.errors.saveFailed") };
	}
	revalidatePath("/einstellungen");
	return { success: true };
}

/** Deutsche Bezeichnungen der Token-Stufen (nur für das Aktivitätsprotokoll). */
const TOKEN_KIND_LABELS: Record<McpTokenKind, string> = {
	ADMIN: "Admin-Token",
	USER: "Nutzer-Token",
};

/**
 * Liefert ein MCP-Zugriffs-Token im Klartext (zum Anzeigen/Kopieren in
 * der UI). Sicherheitsrelevant: wird erst nach explizitem Klick abgerufen
 * (Muster wie getRecoveryKeyAction). Nur für Admins.
 */
export async function getMcpTokenAction(kind: McpTokenKind): Promise<{ token?: string; error?: string }> {
	await requireAdmin();
	const t = await getT();
	if (kind !== "ADMIN" && kind !== "USER") return { error: t("settings.cards.mcp.errors.unknownTokenKind") };
	try {
		const token = getMcpToken(kind);
		if (!token) {
			const kindLabel = t(kind === "ADMIN" ? "settings.cards.mcp.tokenKind.ADMIN" : "settings.cards.mcp.tokenKind.USER");
			return { error: t("settings.cards.mcp.errors.tokenMissing", { kind: kindLabel }) };
		}
		return { token };
	} catch (error) {
		console.error("getMcpTokenAction failed", error);
		return { error: t("settings.cards.mcp.token.readFailed") };
	}
}

/**
 * Erzeugt ein neues MCP-Zugriffs-Token der angegebenen Stufe
 * (Rotations-Funktion). Das bisherige Token ist ab sofort ungültig -
 * verbundene KI-Clients müssen umkonfiguriert werden. Nur für Admins.
 */
export async function regenerateMcpTokenAction(kind: McpTokenKind): Promise<{ token?: string; error?: string }> {
	const admin = await requireAdmin();
	const t = await getT();
	if (kind !== "ADMIN" && kind !== "USER") return { error: t("settings.cards.mcp.errors.unknownTokenKind") };
	try {
		const token = generateMcpToken(kind);
		logActivity(admin, "UPDATE", "einstellungen", `MCP-${TOKEN_KIND_LABELS[kind]} neu erzeugt`);
		return { token };
	} catch (error) {
		console.error("regenerateMcpTokenAction failed", error);
		return { error: t("settings.cards.mcp.token.regenerateFailed") };
	}
}
