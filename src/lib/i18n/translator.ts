/**
 * Isomorphe Übersetzungs-Funktion (läuft in Server UND Client Components).
 * Darf keine Server-APIs importieren (next/headers o. ä.) - die
 * Locale-Ermittlung liegt in server.ts, der Client bekommt das Dictionary
 * über den I18nProvider aus dem Root-Layout.
 *
 * Die Schlüssel sind punktiert: "<namespace>.<subkey>", wobei <namespace>
 * eine Datei unter messages/de/ bzw. messages/en/ entspricht und <subkey>
 * innerhalb des flachen Namespace-Objekts ebenfalls Punkte enthalten darf
 * (z. B. "tenants.fields.firstName").
 */

import type { Messages } from "./messages/de";

export type { Messages };

/** Abgeleiteter Union-Typ aller gültigen Übersetzungsschlüssel (Typsicherheit). */
export type MessageKey = {
	[NS in keyof Messages & string]: `${NS}.${keyof Messages[NS] & string}`;
}[keyof Messages & string];

export type TranslateParams = Record<string, string | number>;

export type TranslateFn = (key: MessageKey, params?: TranslateParams) => string;

/** Löst "<ns>.<subkey>" gegen das Dictionary auf (Namespace = Segment vor dem ersten Punkt). */
function resolve(messages: Messages, key: string): string | undefined {
	const dot = key.indexOf(".");
	if (dot <= 0) return undefined;
	const namespace = key.slice(0, dot) as keyof Messages;
	const subKey = key.slice(dot + 1);
	const bucket = messages[namespace] as Record<string, string> | undefined;
	return bucket?.[subKey];
}

/** Ersetzt "{name}"-Platzhalter durch die übergebenen Werte. */
function interpolate(template: string, params: TranslateParams): string {
	return template.replace(/\{(\w+)\}/g, (match, name: string) =>
		Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
	);
}

/**
 * Baut die t()-Funktion für ein Dictionary. Unbekannte Schlüssel fallen auf
 * den Schlüssel selbst zurück (fehlende englische Einträge sind bereits beim
 * Zusammenführen der Dictionaries mit Deutsch aufgefüllt worden).
 */
export function createTranslator(messages: Messages): TranslateFn {
	return (key, params) => {
		const raw = resolve(messages, key) ?? key;
		return params ? interpolate(raw, params) : raw;
	};
}
