import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { KnowledgeBaseArticle } from "./types";

/**
 * Repository für die Wissensdatenbank (Tabelle `knowledge_base_articles`,
 * Modul /wissen): einfache Text-Artikel (Richtlinien, Anweisungen,
 * Erklärungen …) mit optionalem Kategorie-Schlagwort. Die Suche läuft
 * per LIKE über Titel/Kategorie/Inhalt - für die erwartete Datenmenge
 * einer lokalen Desktop-App ausreichend (kein FTS-Index nötig).
 */

const ARTICLE_COLUMNS = `
	id, title, category, content, created_at AS createdAt, updated_at AS updatedAt
`;

export interface KnowledgeBaseArticleInput {
	title: string;
	category: string | null;
	content: string;
}

/** Listet Artikel (neueste zuerst), optional gefiltert per Suchbegriff (Titel/Kategorie/Inhalt). */
export function listKnowledgeBaseArticles(filter: { search?: string } = {}): KnowledgeBaseArticle[] {
	const search = filter.search?.trim();
	if (search) {
		const pattern = `%${search}%`;
		return getDb()
			.prepare(
				`SELECT ${ARTICLE_COLUMNS} FROM knowledge_base_articles
				 WHERE title LIKE ? OR category LIKE ? OR content LIKE ?
				 ORDER BY title ASC`
			)
			.all(pattern, pattern, pattern) as KnowledgeBaseArticle[];
	}
	return getDb().prepare(`SELECT ${ARTICLE_COLUMNS} FROM knowledge_base_articles ORDER BY title ASC`).all() as KnowledgeBaseArticle[];
}

export function getKnowledgeBaseArticle(id: string): KnowledgeBaseArticle | null {
	const row = getDb().prepare(`SELECT ${ARTICLE_COLUMNS} FROM knowledge_base_articles WHERE id = ?`).get(id) as
		| KnowledgeBaseArticle
		| undefined;
	return row ?? null;
}

/** Alle vergebenen Kategorien (für Vorschläge im Formular/Filter), alphabetisch. */
export function listKnowledgeBaseCategories(): string[] {
	const rows = getDb()
		.prepare("SELECT DISTINCT category FROM knowledge_base_articles WHERE category IS NOT NULL ORDER BY category ASC")
		.all() as { category: string }[];
	return rows.map((row) => row.category);
}

export function createKnowledgeBaseArticle(input: KnowledgeBaseArticleInput): KnowledgeBaseArticle {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO knowledge_base_articles (id, title, category, content, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.title, input.category, input.content, timestamp, timestamp);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

export function updateKnowledgeBaseArticle(id: string, input: KnowledgeBaseArticleInput): void {
	getDb()
		.prepare(
			`UPDATE knowledge_base_articles
			 SET title = ?, category = ?, content = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.title, input.category, input.content, now(), id);
}

export function deleteKnowledgeBaseArticle(id: string): void {
	getDb().prepare("DELETE FROM knowledge_base_articles WHERE id = ?").run(id);
}
