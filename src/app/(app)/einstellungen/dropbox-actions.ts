"use server";

import { revalidatePath } from "next/cache";

import {
	beginDropboxConnect,
	cancelDropboxConnect,
	completeDropboxConnect,
	disconnectDropbox,
	getDropboxAppKey,
	getDropboxBackupSettings,
	isDropboxConnected,
	runDropboxBackup,
	saveDropboxBackupSettings,
} from "@/lib/dropbox-backup";
import { ActionState } from "@/lib/action-state";
import { requireAdmin } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { MIN_BACKUP_PASSWORD_LENGTH } from "@/lib/backup-crypto";
import { getT } from "@/lib/i18n/server";

/**
 * Server Actions für die Dropbox-Cloud-Sicherung (Einstellungen →
 * Dropbox-Backup). Wie überall: Jede Action prüft selbst requireAdmin()
 * (Defense-in-Depth zusätzlich zum Admin-Layout).
 */

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

/**
 * Startet den OAuth-Verbindungsvorgang und liefert die Dropbox-Authorize-URL
 * zurück (der Client öffnet sie im System-Browser). Der App-Schlüssel wird
 * dabei gleich mitgespeichert, damit der spätere Token-Tausch denselben
 * Schlüssel nutzt.
 */
export async function startDropboxConnectAction(appKey: string): Promise<{ url?: string; error?: string }> {
	await requireAdmin();
	const t = await getT();
	const key = (appKey ?? "").trim() || getDropboxAppKey();
	if (!key) {
		return { error: t("settings.cards.dropbox.errors.appKeyMissing") };
	}
	try {
		return { url: beginDropboxConnect(key) };
	} catch (error) {
		console.error("startDropboxConnectAction failed", error);
		return { error: t("settings.cards.dropbox.errors.connectStartFailed") };
	}
}

/**
 * Schließt den Verbindungsvorgang mit dem von Dropbox angezeigten Code ab
 * (Token-Tausch + Kontoinfo). Bei Erfolg wird die Konto-E-Mail zurückgegeben.
 */
export async function completeDropboxConnectAction(code: string): Promise<{ email?: string; error?: string }> {
	const admin = await requireAdmin();
	const t = await getT();
	if (!code || !code.trim()) {
		return { error: t("settings.cards.dropbox.errors.codeMissing") };
	}
	try {
		const result = await completeDropboxConnect(code);
		logActivity(admin, "CREATE", "einstellungen", `Dropbox-Konto „${result.email}“ verbunden`);
		revalidatePath("/einstellungen");
		return { email: result.email };
	} catch (error) {
		console.error("completeDropboxConnectAction failed", error);
		return { error: error instanceof Error ? error.message : t("settings.cards.dropbox.errors.connectCompleteFailed") };
	}
}

/** Bricht einen gestarteten, aber nicht abgeschlossenen Verbindungsvorgang ab. */
export async function cancelDropboxConnectAction(): Promise<ActionState> {
	await requireAdmin();
	cancelDropboxConnect();
	revalidatePath("/einstellungen");
	return { success: true };
}

/** Trennt die Dropbox-Verbindung (löscht Tokens + Kontoinfo, behält die Backup-Konfiguration). */
export async function disconnectDropboxAction(): Promise<ActionState> {
	const admin = await requireAdmin();
	const t = await getT();
	try {
		disconnectDropbox();
		logActivity(admin, "DELETE", "einstellungen", "Dropbox-Verbindung getrennt");
	} catch (error) {
		console.error("disconnectDropboxAction failed", error);
		return { error: t("settings.cards.dropbox.errors.disconnectFailed") };
	}
	revalidatePath("/einstellungen");
	return { success: true };
}

/**
 * Speichert die Backup-Konfiguration (aktiviert, Intervall, Aufbewahrung,
 * optionale Passwort-Verschlüsselung). Leere Passwort-Felder bei aktivierter
 * Verschlüsselung lassen ein vorhandenes Passwort unverändert (Muster wie
 * bei den SMTP-/LetterXpress-Geheimnissen).
 */
export async function saveDropboxBackupSettingsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const admin = await requireAdmin();
	const t = await getT();

	const enabled = formData.get("enabled") === "on";
	const interval = formData.get("interval") === "weekly" ? ("weekly" as const) : ("daily" as const);
	const retentionRaw = Number(getString(formData, "retention"));
	const retention = Number.isInteger(retentionRaw) && retentionRaw >= 1 ? retentionRaw : getDropboxBackupSettings().retention;
	const encrypt = formData.get("encrypt") === "on";
	const password = getString(formData, "password");
	const passwordConfirm = getString(formData, "passwordConfirm");

	if (encrypt && password) {
		if (password.length < MIN_BACKUP_PASSWORD_LENGTH) {
			return { error: t("settings.errors.passwordTooShort", { min: MIN_BACKUP_PASSWORD_LENGTH }) };
		}
		if (password !== passwordConfirm) {
			return { error: t("settings.errors.passwordMismatch") };
		}
	}
	if (encrypt && !password && !getDropboxBackupSettings().passwordSet) {
		return { error: t("settings.cards.dropbox.errors.passwordRequired") };
	}
	if (enabled && !isDropboxConnected()) {
		return { error: t("settings.cards.dropbox.errors.notConnected") };
	}

	try {
		saveDropboxBackupSettings({ enabled, interval, retention, encrypt, password: password || undefined });
		logActivity(admin, "UPDATE", "einstellungen", "Dropbox-Backup-Einstellungen aktualisiert");
	} catch (error) {
		console.error("saveDropboxBackupSettingsAction failed", error);
		return { error: t("settings.errors.saveFailed") };
	}

	revalidatePath("/einstellungen");
	return { success: true };
}

/** Löst sofort einen Backup-Durchlauf aus (unabhängig vom Scheduler-Fahrplan). */
export async function runDropboxBackupNowAction(): Promise<ActionState> {
	const admin = await requireAdmin();
	const t = await getT();
	const result = await runDropboxBackup("manual");
	if (result.ok) {
		logActivity(admin, "CREATE", "system", `Datensicherung „${result.fileName}“ nach Dropbox hochgeladen`);
	}
	revalidatePath("/einstellungen");
	if (!result.ok) {
		return { error: t("settings.cards.dropbox.errors.backupFailed", { error: result.error }) };
	}
	return { success: true, message: t("settings.cards.dropbox.success.backupUploaded", { fileName: result.fileName }) };
}
