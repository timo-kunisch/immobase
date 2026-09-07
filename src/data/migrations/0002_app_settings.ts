import type { Migration } from "../migrate.ts";

/**
 * 0002_app_settings - einfache Key/Value-Tabelle für technische
 * App-Einstellungen (z. B. SMTP-Zugangsdaten, LetterXpress-Credentials,
 * APP_URL-Override).
 *
 * Nie für fachliche Stammdaten verwenden - nur für technische
 * Konfiguration, die nicht ins Repo gehört. Zugriff ausschließlich über
 * src/data/app-settings.ts.
 */
export const migration0002: Migration = {
	version: 2,
	name: "app_settings",
	up: `
CREATE TABLE app_settings (
	key text PRIMARY KEY NOT NULL,
	value text NOT NULL,
	updated_at text NOT NULL
);
`,
	down: `
DROP TABLE IF EXISTS app_settings;
`,
};
