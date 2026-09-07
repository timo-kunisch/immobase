import { getDb } from "./db";
import { now } from "./helpers";
import type { CompanySettings } from "./types";

/**
 * Repository für den CompanySettings-Singleton (Absenderdaten des
 * Vermieters/der Hausverwaltung für Briefköpfe in PDFs). Es gibt genau
 * einen Datensatz mit der festen ID "singleton".
 */

export const COMPANY_SETTINGS_ID = "singleton";

const COLUMNS = "id, name, street, zip_code AS zipCode, city, additional, updated_at AS updatedAt";

/**
 * Lädt die Absenderdaten. Legt beim allerersten Aufruf automatisch einen
 * leeren Datensatz an, damit Aufrufer (z. B. die PDF-Erzeugung) nie mit
 * "nicht gefunden" umgehen müssen.
 */
export function getCompanySettings(): CompanySettings {
	const db = getDb();
	const existing = db.prepare(`SELECT ${COLUMNS} FROM company_settings WHERE id = ?`).get(COMPANY_SETTINGS_ID) as
		| CompanySettings
		| undefined;
	if (existing) return existing;

	const timestamp = now();
	db.prepare(
		"INSERT INTO company_settings (id, name, street, zip_code, city, additional, updated_at) VALUES (?, '', '', '', '', NULL, ?)"
	).run(COMPANY_SETTINGS_ID, timestamp);
	return {
		id: COMPANY_SETTINGS_ID,
		name: "",
		street: "",
		zipCode: "",
		city: "",
		additional: null,
		updatedAt: timestamp,
	};
}

export interface CompanySettingsInput {
	name: string;
	street: string;
	zipCode: string;
	city: string;
	additional: string | null;
}

/** Aktualisiert die Absenderdaten (legt den Datensatz bei Bedarf zuvor an). */
export function saveCompanySettings(data: CompanySettingsInput): CompanySettings {
	getCompanySettings(); // stellt sicher, dass der Datensatz existiert
	const timestamp = now();
	getDb()
		.prepare("UPDATE company_settings SET name = ?, street = ?, zip_code = ?, city = ?, additional = ?, updated_at = ? WHERE id = ?")
		.run(data.name, data.street, data.zipCode, data.city, data.additional, timestamp, COMPANY_SETTINGS_ID);
	return { id: COMPANY_SETTINGS_ID, ...data, updatedAt: timestamp };
}

/** Baut aus den Absenderdaten die Zeilen für den Briefkopf (leere Felder werden übersprungen). */
export function companySettingsToAddressLines(settings: Pick<CompanySettings, "name" | "street" | "zipCode" | "city">): string[] {
	const lines: string[] = [];
	if (settings.name) lines.push(settings.name);
	if (settings.street) lines.push(settings.street);
	if (settings.zipCode || settings.city) {
		lines.push(`${settings.zipCode} ${settings.city}`.trim());
	}
	return lines;
}
