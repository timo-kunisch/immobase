/**
 * Locale → Dictionary. Fehlende englische Einträge fallen defensiv auf
 * Deutsch zurück (die Parität ist zwar bereits per Typ und Test
 * abgesichert, die Merge-Schicht macht das System zusätzlich robust gegen
 * Fehler zur Laufzeit, z. B. durch manuell editierte Dateien).
 */
import { DEFAULT_LOCALE, type Locale } from "../config";
import { deMessages, type Messages } from "./de";
import { enMessages } from "./en";

export function getMessages(locale: Locale): Messages {
	if (locale === DEFAULT_LOCALE) return deMessages;
	const merged: Record<string, Record<string, string>> = {};
	for (const [namespace, bucket] of Object.entries(deMessages)) {
		merged[namespace] = { ...bucket, ...(enMessages as unknown as Record<string, Record<string, string>>)[namespace] };
	}
	return merged as unknown as Messages;
}

export type { Messages };
