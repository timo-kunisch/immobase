import { randomId } from "@/lib/id";

/**
 * Hilfsfunktionen, die von allen Repository-Modulen unter src/data/
 * geteilt werden. Kein fachliches Wissen hier - nur mechanische Mapping-
 * und Zeit-Helfer.
 */

/** Aktueller Zeitpunkt als ISO-8601-String (Konvention für created_at/updated_at). */
export function now(): string {
	return new Date().toISOString();
}

/** Erzeugt eine neue Primärschlüssel-ID (URL-sicherer Zufallsstring). */
export function newId(): string {
	return randomId();
}

/** boolean (TS) -> integer 0/1 (SQLite). */
export function boolToInt(value: boolean): number {
	return value ? 1 : 0;
}

/** integer 0/1 (SQLite) -> boolean (TS). */
export function intToBool(value: number | null | undefined): boolean {
	return value === 1;
}

/**
 * Serialisiert ein String-Array für eine JSON-TEXT-Spalte
 * (z. B. protocols.photo_paths).
 */
export function jsonStringify(value: string[]): string {
	return JSON.stringify(value);
}

/** Parst eine JSON-TEXT-Spalte als String-Array (defensiv: ungültig -> []). */
export function jsonParseArray(value: string | null | undefined): string[] {
	if (!value) return [];
	try {
		const parsed: unknown = JSON.parse(value);
		return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
	} catch {
		return [];
	}
}
