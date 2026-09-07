import { getDb } from "./db";
import { now } from "./helpers";

/**
 * Repository für die einfache Key/Value-Tabelle `app_settings`
 * (technische App-Konfiguration, die nicht ins Repo gehört: SMTP-Zugang,
 * LetterXpress-Credentials, URL-Overrides, ...). Ersetzt die früheren
 * Cloudflare-Umgebungsvariablen/-Secrets als Speicherort - die
 * Umgebungsvariablen selbst bleiben als Fallback für Dev-/Test-Szenarien
 * auswertbar (siehe getSetting).
 */

interface AppSettingRow {
	key: string;
	value: string;
	updated_at: string;
}

/** Liest eine Einstellung. `undefined`, wenn der Schlüssel nicht existiert. */
export function getSetting(key: string): string | undefined {
	const row = getDb().prepare("SELECT key, value, updated_at FROM app_settings WHERE key = ?").get(key) as
		| AppSettingRow
		| undefined;
	return row?.value;
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

/** Setzt/überschreibt eine Einstellung (Upsert). */
export function setSetting(key: string, value: string): void {
	getDb()
		.prepare(
			`INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
		)
		.run(key, value, now());
}

/** Entfernt eine Einstellung (No-Op, wenn nicht vorhanden). */
export function deleteSetting(key: string): void {
	getDb().prepare("DELETE FROM app_settings WHERE key = ?").run(key);
}

/** Listet alle Einstellungen (für Diagnose/Export, NICHT für Secrets in der UI). */
export function listSettings(): { key: string; value: string }[] {
	const rows = getDb().prepare("SELECT key, value FROM app_settings ORDER BY key").all() as Pick<
		AppSettingRow,
		"key" | "value"
	>[];
	return rows.map((row) => ({ key: row.key, value: row.value }));
}
