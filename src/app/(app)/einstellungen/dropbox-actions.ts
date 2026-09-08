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
import { MIN_BACKUP_PASSWORD_LENGTH } from "@/lib/backup-crypto";

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
	const key = (appKey ?? "").trim() || getDropboxAppKey();
	if (!key) {
		return { error: "Bitte zuerst den Dropbox-App-Schlüssel eintragen (siehe Hinweis im Formular)." };
	}
	try {
		return { url: beginDropboxConnect(key) };
	} catch (error) {
		console.error("startDropboxConnectAction failed", error);
		return { error: "Der Verbindungsvorgang konnte nicht gestartet werden." };
	}
}

/**
 * Schließt den Verbindungsvorgang mit dem von Dropbox angezeigten Code ab
 * (Token-Tausch + Kontoinfo). Bei Erfolg wird die Konto-E-Mail zurückgegeben.
 */
export async function completeDropboxConnectAction(code: string): Promise<{ email?: string; error?: string }> {
	await requireAdmin();
	if (!code || !code.trim()) {
		return { error: "Bitte den von Dropbox angezeigten Code eingeben." };
	}
	try {
		const result = await completeDropboxConnect(code);
		revalidatePath("/einstellungen");
		return { email: result.email };
	} catch (error) {
		console.error("completeDropboxConnectAction failed", error);
		return { error: error instanceof Error ? error.message : "Die Verbindung konnte nicht abgeschlossen werden." };
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
	await requireAdmin();
	try {
		disconnectDropbox();
	} catch (error) {
		console.error("disconnectDropboxAction failed", error);
		return { error: "Die Verbindung konnte nicht getrennt werden." };
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
	await requireAdmin();

	const enabled = formData.get("enabled") === "on";
	const interval = formData.get("interval") === "weekly" ? ("weekly" as const) : ("daily" as const);
	const retentionRaw = Number(getString(formData, "retention"));
	const retention = Number.isInteger(retentionRaw) && retentionRaw >= 1 ? retentionRaw : getDropboxBackupSettings().retention;
	const encrypt = formData.get("encrypt") === "on";
	const password = getString(formData, "password");
	const passwordConfirm = getString(formData, "passwordConfirm");

	if (encrypt && password) {
		if (password.length < MIN_BACKUP_PASSWORD_LENGTH) {
			return { error: `Das Passwort muss mindestens ${MIN_BACKUP_PASSWORD_LENGTH} Zeichen lang sein.` };
		}
		if (password !== passwordConfirm) {
			return { error: "Die Passwörter stimmen nicht überein." };
		}
	}
	if (encrypt && !password && !getDropboxBackupSettings().passwordSet) {
		return { error: "Bitte ein Passwort für die Verschlüsselung vergeben (min. 8 Zeichen)." };
	}
	if (enabled && !isDropboxConnected()) {
		return { error: "Dropbox ist nicht verbunden - bitte zuerst das Konto verbinden." };
	}

	try {
		saveDropboxBackupSettings({ enabled, interval, retention, encrypt, password: password || undefined });
	} catch (error) {
		console.error("saveDropboxBackupSettingsAction failed", error);
		return { error: "Die Einstellungen konnten nicht gespeichert werden." };
	}

	revalidatePath("/einstellungen");
	return { success: true };
}

/** Löst sofort einen Backup-Durchlauf aus (unabhängig vom Scheduler-Fahrplan). */
export async function runDropboxBackupNowAction(): Promise<ActionState> {
	await requireAdmin();
	const result = await runDropboxBackup("manual");
	revalidatePath("/einstellungen");
	if (!result.ok) {
		return { error: `Das Dropbox-Backup ist fehlgeschlagen: ${result.error}` };
	}
	return { success: true, message: `Die Sicherung „${result.fileName}“ wurde nach Dropbox hochgeladen.` };
}
