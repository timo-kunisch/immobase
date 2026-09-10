import { getDb } from "./db";
import { newId, now } from "./helpers";
import type { ChatMessage, ChatMessageAttachment, ChatMessageRole, ChatMessageToolCall } from "./types";

/**
 * Repository für den persistenten Chat-Verlauf des KI-Assistenten
 * (Tabelle `chat_messages`). Der Verlauf wird pro Nutzer serverseitig
 * gehalten, damit er über Seiten-Neuladen und App-Neustarts hinaus
 * erhalten bleibt - gelöscht wird er nur manuell über den Dialog
 * (clearChatMessages, Papierkorb-Button bzw. Größen-Warnung).
 * Von Datei-Anhängen werden nur die Metadaten (Name + Größe, JSON in
 * `attachments`) gespeichert, damit der Verlauf zeigen kann, welche
 * Dateien an einer Nachricht hingen - der Inhalt fließt nur aufbereitet
 * in den aktuellen KI-Request (src/lib/ai/attachments.ts). Die
 * Werkzeug-Liste einer Assistenten-Runde dient nur der Anzeige in der UI.
 */

const CHAT_MESSAGE_COLUMNS = `
	id, user_id AS userId, role, content, tool_calls AS toolCalls, attachments, created_at AS createdAt
`;

/** Zeilenform, wie better-sqlite3 sie liefert (toolCalls/attachments noch als JSON-TEXT). */
type ChatMessageRow = Omit<ChatMessage, "role" | "toolCalls" | "attachments"> & {
	role: string;
	toolCalls: string | null;
	attachments: string | null;
};

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

/** Parst die JSON-Spalte attachments (defensiv: ungültig/leer -> []). */
function parseAttachments(value: string | null): ChatMessageAttachment[] {
	if (!value) return [];
	try {
		const parsed: unknown = JSON.parse(value);
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(
			(entry): entry is ChatMessageAttachment =>
				typeof entry === "object" &&
				entry !== null &&
				typeof (entry as ChatMessageAttachment).name === "string" &&
				typeof (entry as ChatMessageAttachment).size === "number"
		);
	} catch {
		return [];
	}
}

function mapChatMessageRow(row: ChatMessageRow): ChatMessage {
	return {
		...row,
		role: row.role as ChatMessageRole,
		toolCalls: parseToolCalls(row.toolCalls),
		attachments: parseAttachments(row.attachments),
	};
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
	attachments?: ChatMessageAttachment[];
}

/**
 * Hängt neue Nachrichten an den Verlauf eines Nutzers an (eine
 * Transaktion, damit Nutzerfrage und Assistenten-Antwort nie getrennt
 * gespeichert werden).
 */
export function appendChatMessages(userId: string, messages: NewChatMessage[]): void {
	const db = getDb();
	const insert = db.prepare(
		`INSERT INTO chat_messages (id, user_id, role, content, tool_calls, attachments, created_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`
	);
	db.transaction(() => {
		for (const message of messages) {
			insert.run(
				newId(),
				userId,
				message.role,
				message.content,
				message.toolCalls && message.toolCalls.length > 0 ? JSON.stringify(message.toolCalls) : null,
				message.attachments && message.attachments.length > 0 ? JSON.stringify(message.attachments) : null,
				now()
			);
		}
	})();
}

/** Löscht den gesamten Chat-Verlauf eines Nutzers (manueller Reset im Dialog). */
export function clearChatMessages(userId: string): void {
	getDb().prepare("DELETE FROM chat_messages WHERE user_id = ?").run(userId);
}
