import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { PromptTemplate } from "./types";

/**
 * Repository für die eigenen Prompt-Vorlagen der Nutzer (Tabelle
 * `prompt_templates`) - wiederverwendbare Textbausteine für den
 * KI-Assistenten, die im Chat-Dialog per Klick in das Eingabefeld
 * übernommen werden. Alle Operationen sind strikt auf den jeweiligen
 * Nutzer eingeschränkt (user_id im WHERE), damit keine fremden Vorlagen
 * gelesen oder verändert werden können. Die lokalisierten Vorlagen ab
 * Werk liegen nicht in der Datenbank, sondern als Konstanten im Code
 * (src/lib/ai/prompt-templates.ts).
 */

const PROMPT_TEMPLATE_COLUMNS = `
	id, user_id AS userId, title, content, created_at AS createdAt, updated_at AS updatedAt
`;

/** Listet die eigenen Prompt-Vorlagen eines Nutzers (Anlegereihenfolge). */
export function listPromptTemplates(userId: string): PromptTemplate[] {
	return getDb()
		.prepare(`SELECT ${PROMPT_TEMPLATE_COLUMNS} FROM prompt_templates WHERE user_id = ? ORDER BY rowid ASC`)
		.all(userId) as unknown as PromptTemplate[];
}

/** Anzahl der eigenen Vorlagen (für die Obergrenze beim Anlegen). */
export function countPromptTemplates(userId: string): number {
	const row = getDb()
		.prepare("SELECT COUNT(*) AS count FROM prompt_templates WHERE user_id = ?")
		.get(userId) as { count: number };
	return row.count;
}

/** Legt eine neue Prompt-Vorlage an und gibt sie zurück. */
export function createPromptTemplate(userId: string, input: { title: string; content: string }): PromptTemplate {
	const timestamp = now();
	const template: PromptTemplate = {
		id: newId(),
		userId,
		title: input.title,
		content: input.content,
		createdAt: timestamp,
		updatedAt: timestamp,
	};
	getDb()
		.prepare(
			`INSERT INTO prompt_templates (id, user_id, title, content, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?)`
		)
		.run(template.id, template.userId, template.title, template.content, template.createdAt, template.updatedAt);
	return template;
}

/**
 * Aktualisiert Titel und Text einer eigenen Vorlage. Liefert null, wenn
 * die Vorlage nicht existiert oder einem anderen Nutzer gehört.
 */
export function updatePromptTemplate(
	userId: string,
	id: string,
	input: { title: string; content: string }
): PromptTemplate | null {
	const updatedAt = now();
	const result = getDb()
		.prepare("UPDATE prompt_templates SET title = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = ?")
		.run(input.title, input.content, updatedAt, id, userId);
	if (result.changes === 0) return null;
	const row = getDb()
		.prepare(`SELECT ${PROMPT_TEMPLATE_COLUMNS} FROM prompt_templates WHERE id = ?`)
		.get(id) as unknown as PromptTemplate;
	return row;
}

/**
 * Löscht eine eigene Vorlage. Liefert false, wenn sie nicht existiert
 * oder einem anderen Nutzer gehört.
 */
export function deletePromptTemplate(userId: string, id: string): boolean {
	const result = getDb().prepare("DELETE FROM prompt_templates WHERE id = ? AND user_id = ?").run(id, userId);
	return result.changes > 0;
}
