import type { Migration } from "../migrate.ts";

/**
 * Persistenter Chat-Verlauf des KI-Assistenten (Sprechblase in der
 * Sidebar): Pro Nutzer werden alle Chat-Nachrichten (Rollen "user"/
 * "assistant") serverseitig gespeichert, damit das Gespräch über
 * Seiten-Neuladen und App-Neustarts hinaus erhalten bleibt - es endet
 * nur durch manuelles Löschen im Dialog. `tool_calls` ist ein JSON-Array
 * der in dieser Assistenten-Runde ausgeführten Werkzeuge (nur für die
 * Anzeige in der UI); Datei-Anhänge werden bewusst nicht gespeichert
 * (nur der Begleittext der Nachricht).
 */
export const migration0007: Migration = {
	version: 7,
	name: "chat_messages",
	up: `
CREATE TABLE chat_messages (
	id text PRIMARY KEY NOT NULL,
	user_id text NOT NULL,
	role text NOT NULL,
	content text NOT NULL,
	tool_calls text,
	created_at text NOT NULL,
	FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE no action ON DELETE cascade
);
CREATE INDEX chat_messages_user_idx ON chat_messages (user_id);
`,
	down: `
DROP TABLE IF EXISTS chat_messages;
`,
};
