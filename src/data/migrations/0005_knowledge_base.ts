import type { Migration } from "../migrate.ts";

/**
 * 0005_knowledge_base - Wissensdatenbank (Modul /wissen): Nutzer legen
 * hier Richtlinien, Anweisungen, Erklärungen usw. als einfache
 * Text-Artikel ab (optional mit Kategorie-Schlagwort). Die Suche läuft
 * per LIKE über Titel/Kategorie/Inhalt (src/data/knowledge-base.ts).
 */
export const migration0005: Migration = {
	version: 5,
	name: "knowledge_base",
	up: `
CREATE TABLE knowledge_base_articles (
	id text PRIMARY KEY NOT NULL,
	title text NOT NULL,
	category text,
	content text NOT NULL,
	created_at text NOT NULL,
	updated_at text NOT NULL
);
CREATE INDEX knowledge_base_articles_title_idx ON knowledge_base_articles (title);
`,
	down: `
DROP TABLE IF EXISTS knowledge_base_articles;
`,
};
