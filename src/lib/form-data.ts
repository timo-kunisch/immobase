/**
 * Kleine, wiederverwendbare FormData-Hilfsfunktionen für Server Actions.
 *
 * Die bestehenden Module (liegenschaften/vertraege/abrechnung/finanzen/...)
 * definieren `getString`/`getDecimalString` bisher jeweils lokal und
 * identisch in ihrer eigenen actions.ts-Datei. Für die neu hinzukommende
 * WEG-Verwaltung (7 weitere actions.ts-Dateien) wird diese Duplikation
 * bewusst hier zentralisiert, statt sie ein achtes Mal zu wiederholen - die
 * bestehenden Module bleiben unverändert (kein Refactoring-Risiko für
 * funktionierenden Code), neue WEG-Module nutzen ausschließlich diese
 * zentrale Version.
 */

export function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

/** Wandelt ein Formularfeld (Komma oder Punkt als Dezimaltrenner) in einen Decimal-String ("12.34") für eine Geld-Spalte um. */
export function getDecimalString(formData: FormData, key: string): string | null {
	const raw = getString(formData, key).replace(",", ".");
	if (!raw) return null;
	const parsed = Number(raw);
	return Number.isNaN(parsed) ? null : parsed.toFixed(2);
}

/** Wandelt ein Formularfeld in eine optionale Fließkommazahl um (z. B. Wohnfläche, MEA-Anteil). */
export function getOptionalFloat(formData: FormData, key: string): number | null {
	const raw = getString(formData, key);
	if (!raw) return null;
	const parsed = Number(raw.replace(",", "."));
	return Number.isNaN(parsed) ? null : parsed;
}

/** Wandelt ein Formularfeld in eine Ganzzahl um, oder null bei ungültigem/leerem Wert. */
export function getOptionalInt(formData: FormData, key: string): number | null {
	const raw = getString(formData, key);
	if (!raw) return null;
	const parsed = Number(raw);
	return Number.isInteger(parsed) ? parsed : null;
}
