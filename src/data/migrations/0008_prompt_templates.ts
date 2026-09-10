import type { Migration } from "../migrate.ts";

/**
 * Prompt-Vorlagen für den KI-Assistenten (Button im Eingabebereich des
 * Chat-Dialogs): Pro Nutzer verwaltete, wiederverwendbare Textbausteine,
 * die per Klick in das Eingabefeld übernommen werden. Die Vorlagen ab
 * Werk stehen NICHT in dieser Tabelle, sondern als lokalisierte
 * Konstanten im Code (src/lib/ai/prompt-templates.ts + i18n-Schlüssel),
 * damit sie mit der App-Sprache umschalten und für alle Nutzer ohne
 * Duplikate verfügbar sind.
 */
export const migration0008: Migration = {
	version: 8,
	name: "prompt_templates",
	up: `
CREATE TABLE prompt_templates (
	id text PRIMARY KEY NOT NULL,
	user_id text NOT NULL,
	title text NOT NULL,
	content text NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX prompt_templates_user_idx ON prompt_templates (user_id);
`,
	down: `
DROP TABLE IF EXISTS prompt_templates;
`,
};
