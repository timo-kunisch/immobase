import type { Migration } from "../migrate.ts";

/**
 * Anhang-Metadaten im Chat-Verlauf des KI-Assistenten: Zu jeder Nachricht
 * werden die Metadaten der Datei-Anhänge (Name + Größe, KEIN Inhalt) als
 * JSON-Array in `attachments` abgelegt, damit der Verlauf im Dialog zeigen
 * kann, welche Dateien an einer Nachricht hingen. Der Datei-Inhalt selbst
 * wird bewusst nicht gespeichert (Größe/Vertraulichkeit - er fließt nur
 * aufbereitet in den aktuellen KI-Request, siehe src/lib/ai/attachments.ts).
 */
export const migration0009: Migration = {
	version: 9,
	name: "chat_message_attachments",
	up: `
ALTER TABLE chat_messages ADD COLUMN attachments text;
`,
	down: `
ALTER TABLE chat_messages DROP COLUMN attachments;
`,
};
