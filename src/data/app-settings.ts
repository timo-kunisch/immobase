import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import type BetterSqlite3 from "better-sqlite3";

import { getDataKey } from "@/lib/data-key";

import { getDb } from "./db";
import { now } from "./helpers";

/**
 * Repository für die einfache Key/Value-Tabelle `app_settings`
 * (technische App-Konfiguration, die nicht ins Repo gehört: SMTP-Zugang,
 * LetterXpress-Credentials, URL-Overrides, ...). Umgebungsvariablen
 * bleiben als Fallback für Dev-/Test-Szenarien auswertbar (siehe
 * getSetting).
 *
 * Geheimnisse (Schlüssel in SECRET_SETTING_KEYS: SMTP-Passwort,
 * LetterXpress-API-Key, Dropbox-Tokens/-Backup-Passwort) werden transparent
 * FELD-VERSCHLÜSSELT gespeichert
 * (AES-256-GCM, Master-Schlüssel siehe src/lib/data-key.ts), Format:
 * "enc:v1:" + base64(Nonce | Ciphertext | Auth-Tag). Damit liegen die
 * Zugangsdaten nicht mehr im Klartext in der Datenbankdatei.
 *
 * Verhalten im Detail:
 * - setSetting verschlüsselt Secret-Schlüssel automatisch (Leerwerte bleiben
 *   unverschlüsselt - sie stehen für "deaktiviert").
 * - getSetting entschlüsselt automatisch; nicht entschlüsselbare Werte
 *   (z. B. eine data.db, die manuell auf ein anderes Gerät kopiert wurde -
 *   dort liegt ein anderer Master-Schlüssel vor) liefern bewusst `undefined`
 *   (fail-closed): Die zugehörige Online-Funktion gilt dann als nicht
 *   konfiguriert und das Secret muss neu eingegeben werden.
 * - Der Backup-Export (src/data/backup.ts) entschlüsselt Secrets in die
 *   Export-Kopie, damit Sicherungen geräteübergreifend portierbar bleiben;
 *   der Import verschlüsselt sie mit dem lokalen Schlüssel wieder
 *   (ensureSecretsEncrypted).
 */

interface AppSettingRow {
	key: string;
	value: string;
	updated_at: string;
}

const SECRET_PREFIX = "enc:v1:";
const SECRET_NONCE_LENGTH = 12;
const SECRET_TAG_LENGTH = 16;

/**
 * Schlüssel, deren Werte als Geheimnisse verschlüsselt gespeichert werden.
 * Dropbox: Refresh-/Access-Token des verbundenen Kontos, das zwischenge-
 * speicherte PKCE-Paar des laufenden Verbindungsvorgangs sowie das optionale
 * Passwort für die automatische Cloud-Sicherung (src/lib/dropbox-backup.ts).
 * MCP: die Zugriffs-Token des optionalen MCP-Servers (Admin-Token mit
 * Vollzugriff, Nutzer-Token mit eingeschränktem Werkzeug-Scope, siehe
 * src/lib/mcp/auth.ts).
 * KI-Assistent: der API-Schlüssel des konfigurierten KI-Endpunkts - Partner
 * arbeitskraft.app oder benutzerdefinierter Endpunkt (src/lib/ai/config.ts).
 */
const SECRET_SETTING_KEYS = new Set([
	"smtp.pass",
	"imap.pass",
	"letterxpress.apikey",
	"dropbox.refresh_token",
	"dropbox.access_token",
	"dropbox.oauth_pending",
	"dropbox.backup_password",
	"mcp.token",
	"mcp.user_token",
	"ai.apikey",
]);

/** Ist der Schlüssel ein Geheimnis (feldverschlüsselte Ablage)? */
export function isSecretSettingKey(key: string): boolean {
	return SECRET_SETTING_KEYS.has(key);
}

function encryptSecretValue(plaintext: string): string {
	const nonce = randomBytes(SECRET_NONCE_LENGTH);
	const cipher = createCipheriv("aes-256-gcm", getDataKey(), nonce);
	const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
	return SECRET_PREFIX + Buffer.concat([nonce, ciphertext, cipher.getAuthTag()]).toString("base64");
}

/**
 * Entschlüsselt einen "enc:v1:"-Wert. Gibt `undefined` zurück, wenn der Wert
 * nicht entschlüsselbar ist (falscher/verlorener Master-Schlüssel,
 * beschädigte Daten) - Aufrufer behandeln das wie "nicht konfiguriert".
 */
function decryptSecretValue(stored: string): string | undefined {
	try {
		const blob = Buffer.from(stored.slice(SECRET_PREFIX.length), "base64");
		const nonce = blob.subarray(0, SECRET_NONCE_LENGTH);
		const tag = blob.subarray(blob.length - SECRET_TAG_LENGTH);
		const ciphertext = blob.subarray(SECRET_NONCE_LENGTH, blob.length - SECRET_TAG_LENGTH);
		const decipher = createDecipheriv("aes-256-gcm", getDataKey(), nonce);
		decipher.setAuthTag(tag);
		return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
	} catch (error) {
		console.warn("app_settings: Geheimnis konnte nicht entschlüsselt werden (anderer Datenschlüssel?) - Wert wird ignoriert.", error);
		return undefined;
	}
}

/** Liest eine Einstellung. `undefined`, wenn der Schlüssel nicht existiert. */
export function getSetting(key: string): string | undefined {
	const row = getDb().prepare("SELECT key, value, updated_at FROM app_settings WHERE key = ?").get(key) as
		| AppSettingRow
		| undefined;
	if (!row) return undefined;
	if (SECRET_SETTING_KEYS.has(key) && row.value.startsWith(SECRET_PREFIX)) {
		return decryptSecretValue(row.value);
	}
	return row.value;
}

/**
 * Liest eine Einstellung mit Fallback auf eine Umgebungsvariable (für
 * Dev-/Test-Szenarien ohne gefüllte app_settings-Tabelle). Reihenfolge:
 * app_settings > process.env > defaultValue.
 */
export function getSettingWithEnvFallback(key: string, envName: string, defaultValue = ""): string {
	const value = getSetting(key);
	if (value !== undefined) return value;
	const envValue = process.env[envName];
	if (envValue !== undefined) return envValue;
	return defaultValue;
}

/** Setzt/überschreibt eine Einstellung (Upsert). Geheimnisse werden verschlüsselt abgelegt. */
export function setSetting(key: string, value: string): void {
	// Leere Secret-Werte bleiben unverschlüsselt: Sie stehen für "nicht
	// konfiguriert" und dürfen nicht wie ein echtes Geheimnis aussehen.
	const storedValue = SECRET_SETTING_KEYS.has(key) && value !== "" && !value.startsWith(SECRET_PREFIX) ? encryptSecretValue(value) : value;
	getDb()
		.prepare(
			`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
		)
		.run(key, storedValue, now());
}

/** Entfernt eine Einstellung (No-Op, wenn nicht vorhanden). */
export function deleteSetting(key: string): void {
	getDb().prepare("DELETE FROM app_settings WHERE key = ?").run(key);
}

/**
 * Listet alle Einstellungen (für Diagnose/Export, NICHT für Secrets in der
 * UI). Werte von Geheimnissen werden grundsätzlich maskiert zurückgegeben.
 */
export function listSettings(): { key: string; value: string }[] {
	const rows = getDb().prepare("SELECT key, value FROM app_settings ORDER BY key").all() as Pick<
		AppSettingRow,
		"key" | "value"
	>[];
	return rows.map((row) => ({
		key: row.key,
		value: SECRET_SETTING_KEYS.has(row.key) && row.value !== "" ? "********" : row.value,
	}));
}

/**
 * Verschlüsselt alle noch im Klartext gespeicherten Geheimnisse (Bestands-
 * daten von Installationen vor der Feldverschlüsselung sowie frisch
 * importierte Backups - der Export legt Secrets bewusst entschlüsselt ins
 * Backup, damit es geräteübergreifend portierbar bleibt). Idempotent;
 * Aufrufe: Server-Start (instrumentation.ts) und Backup-Import.
 */
export function ensureSecretsEncrypted(): number {
	const db = getDb();
	let migrated = 0;
	for (const key of SECRET_SETTING_KEYS) {
		const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
		if (row && row.value !== "" && !row.value.startsWith(SECRET_PREFIX)) {
			db.prepare("UPDATE app_settings SET value = ?, updated_at = ? WHERE key = ?").run(encryptSecretValue(row.value), now(), key);
			migrated++;
		}
	}
	return migrated;
}

/** Status der Secret-Ablage (für die Sicherheits-Anzeige in den Einstellungen). */
export function getSecretSettingsStatus(): { secretsSet: number; secretsEncrypted: number } {
	const db = getDb();
	let secretsSet = 0;
	let secretsEncrypted = 0;
	for (const key of SECRET_SETTING_KEYS) {
		const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
		if (row && row.value !== "") {
			secretsSet++;
			if (row.value.startsWith(SECRET_PREFIX)) secretsEncrypted++;
		}
	}
	return { secretsSet, secretsEncrypted };
}

/**
 * Entschlüsselt alle Geheimnisse einer OFFENEN Fremd-Datenbank (z. B. dem
 * DB-Snapshot beim Backup-Export) zurück in Klartext - mit dem LOKALEN
 * Master-Schlüssel. Nicht entschlüsselbare Werte (fremder Schlüssel) bleiben
 * unverändert. Gibt die Anzahl entschlüsselter Werte zurück.
 *
 * Hintergrund: Backup-ZIPs sollen auf jedem Gerät wiederherstellbar sein.
 * Da die komplette Backup-DB ohnehin Klartext enthält (bzw. der
 * .imbak-Container passwortgeschützt ist), werden die Secret-Felder für den
 * Export entschlüsselt und beim Import mit dem dortigen Schlüssel wieder
 * verschlüsselt (ensureSecretsEncrypted).
 */
export function decryptSecretsInDatabase(db: BetterSqlite3.Database): number {
	let migrated = 0;
	for (const key of SECRET_SETTING_KEYS) {
		const row = db.prepare("SELECT value FROM app_settings WHERE key = ?").get(key) as { value: string } | undefined;
		if (row && row.value.startsWith(SECRET_PREFIX)) {
			const plain = decryptSecretValue(row.value);
			if (plain !== undefined) {
				db.prepare("UPDATE app_settings SET value = ? WHERE key = ?").run(plain, key);
				migrated++;
			}
		}
	}
	return migrated;
}
