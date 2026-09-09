import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { ChatMessage, ChatMessageRole, ChatMessageToolCall } from "./types";

/**
 * Repository für den persistenten Chat-Verlauf des KI-Assistenten
 * (Tabelle `chat_messages`). Der Verlauf wird pro Nutzer serverseitig
 * gehalten, damit er über Seiten-Neuladen und App-Neustarts hinaus
 * erhalten bleibt - gelöscht wird er nur manuell über den Dialog
 * (clearChatMessages, Papierkorb-Button bzw. Größen-Warnung).
 * Datei-Anhänge werden nicht gespeichert (nur der Begleittext der
 * Nachricht); die Werkzeug-Liste einer Assistenten-Runde dient nur der
 * Anzeige in der UI.
 */

const CHAT_MESSAGE_COLUMNS = `
	id, user_id AS userId, role, content, tool_calls AS toolCalls, created_at AS createdAt
`;

/** Zeilenform, wie better-sqlite3 sie liefert (toolCalls noch als JSON-TEXT). */
type ChatMessageRow = Omit<ChatMessage, "role" | "toolCalls"> & { role: string; toolCalls: string | null };

/** Parst die JSON-Spalte tool_calls (defensiv: ungültig/leer -> []). */
function parseToolCalls(value: string | null): ChatMessageToolCall[] {
	if (!value) return [];
	try {
		const parsed: unknown = JSON.parse(value);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(entry): entry is ChatMessageToolCall =>
				typeof entry === "object" &&
				entry !== null &&
				typeof (entry as ChatMessageToolCall).name === "string" &&
				typeof (entry as ChatMessageToolCall).ok === "boolean"
		);
	} catch {
		return [];
	}
}

function mapChatMessageRow(row: ChatMessageRow): ChatMessage {
	return { ...row, role: row.role as ChatMessageRole, toolCalls: parseToolCalls(row.toolCalls) };
}

/**
 * Listet den gesamten Chat-Verlauf eines Nutzers in Gesprächsreihenfolge.
 * Sortierung bewusst per rowid (Einfügereihenfolge): created_at hat nur
 * Millisekunden-Auflösung - die zu einer Anfrage gehörende Nutzer- und
 * Assistenten-Nachricht können denselben Zeitstempel tragen, und die
 * Zufalls-IDs taugen nicht als Tie-Breaker.
 */
export function listChatMessages(userId: string): ChatMessage[] {
	const rows = getDb()
		.prepare(`SELECT ${CHAT_MESSAGE_COLUMNS} FROM chat_messages WHERE user_id = ? ORDER BY rowid ASC`)
		.all(userId) as ChatMessageRow[];
	return rows.map(mapChatMessageRow);
}

export interface NewChatMessage {
	role: ChatMessageRole;
	content: string;
	toolCalls?: ChatMessageToolCall[];
}

/**
 * Hängt neue Nachrichten an den Verlauf eines Nutzers an (eine
 * Transaktion, damit Nutzerfrage und Assistenten-Antwort nie getrennt
 * gespeichert werden).
 */
export function appendChatMessages(userId: string, messages: NewChatMessage[]): void {
	const db = getDb();
	const insert = db.prepare(
		`INSERT INTO chat_messages (id, user_id, role, content, tool_calls, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`
	);
	db.transaction(() => {
		for (const message of messages) {
			insert.run(
				newId(),
				userId,
				message.role,
				message.content,
				message.toolCalls && message.toolCalls.length > 0 ? JSON.stringify(message.toolCalls) : null,
				now()
			);
		}
	})();
}

/** Löscht den gesamten Chat-Verlauf eines Nutzers (manueller Reset im Dialog). */
export function clearChatMessages(userId: string): void {
	getDb().prepare("DELETE FROM chat_messages WHERE user_id = ?").run(userId);
}
