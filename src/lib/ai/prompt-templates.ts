import type { MessageKey } from "@/lib/i18n/translator";

/**
 * Geteilte Konstanten und die Werk-Vorlagen für die Prompt-Vorlagen des
 * KI-Assistenten - bewusst OHNE Node-Abhängigkeiten, damit sie Server
 * (API-Route src/app/api/chat/prompt-templates) und Client
 * (src/components/layout/prompt-templates-panel.tsx) gemeinsam nutzen
 * können (Muster wie attachment-types.ts).
 *
 * Die Vorlagen ab Werk werden NICHT in der Datenbank gehalten, sondern
 * hier als Referenz auf i18n-Schlüssel: Titel und Text schalten so mit
 * der App-Sprache um und stehen allen Nutzern ohne Duplikate zur
 * Verfügung. Werk-Vorlagen können nicht bearbeitet oder gelöscht werden;
 * eigene Vorlagen verwaltet der Nutzer selbst (Tabelle prompt_templates).
 */

/** Maximale Titellänge einer eigenen Prompt-Vorlage. */
export const MAX_PROMPT_TEMPLATE_TITLE_CHARS = 100;

/** Maximale Textlänge einer eigenen Prompt-Vorlage. */
export const MAX_PROMPT_TEMPLATE_CONTENT_CHARS = 4000;

/** Maximale Anzahl eigener Vorlagen pro Nutzer. */
export const MAX_PROMPT_TEMPLATES_PER_USER = 50;

/** Eine Vorlage ab Werk: Verweis auf die lokalisierten Texte im Namespace "chat". */
export interface DefaultPromptTemplate {
	/** Stabiler interner Schlüssel (für React-Keys). */
	id: string;
	titleKey: MessageKey;
	contentKey: MessageKey;
}

/**
 * Vorlagen ab Werk, die im Vorlagen-Panel über den eigenen Vorlagen
 * angezeigt werden. Die erste Vorlage ("Datei importieren") ist der
 * zentrale Einstieg für den Import beliebiger Dateien (Excel, PDF, …):
 * Der Nutzer hängt nur noch die Datei an, das Modell extrahiert die
 * Daten und pflegt sie über die MCP-Werkzeuge ein.
 */
export const DEFAULT_PROMPT_TEMPLATES: readonly DefaultPromptTemplate[] = [
	{
		id: "file-import",
		titleKey: "chat.templates.defaults.fileImport.title",
		contentKey: "chat.templates.defaults.fileImport.content",
	},
	{
		id: "arrears",
		titleKey: "chat.templates.defaults.arrears.title",
		contentKey: "chat.templates.defaults.arrears.content",
	},
	{
		id: "vacancies",
		titleKey: "chat.templates.defaults.vacancies.title",
		contentKey: "chat.templates.defaults.vacancies.content",
	},
	{
		id: "lease-expiry",
		titleKey: "chat.templates.defaults.leaseExpiry.title",
		contentKey: "chat.templates.defaults.leaseExpiry.content",
	},
	{
		id: "meeting-prep",
		titleKey: "chat.templates.defaults.meetingPrep.title",
		contentKey: "chat.templates.defaults.meetingPrep.content",
	},
];
