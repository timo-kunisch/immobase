import type { Migration } from "../migrate.ts";

/**
 * Postanschrift für Mieter: Straße, PLZ, Ort und Land - analog zur
 * Eigentümer-Verwaltung, aber bewusst optional (NULL = keine eigene
 * Postanschrift hinterlegt; der postalische Versand adressiert dann
 * weiterhin die gemietete Einheit). Die Spalten sind nicht Teil von
 * Indizes, Constraints oder Fremdschlüsseln - daher genügt ein
 * einfaches ADD/DROP COLUMN (Muster wie 0018/0019).
 */
export const migration0020: Migration = {
	version: 20,
	name: "tenant_postal_address",
	up: `
		ALTER TABLE tenants ADD COLUMN street text;
		ALTER TABLE tenants ADD COLUMN zip_code text;
		ALTER TABLE tenants ADD COLUMN city text;
		ALTER TABLE tenants ADD COLUMN country text;
	`,
	down: `
		ALTER TABLE tenants DROP COLUMN street;
		ALTER TABLE tenants DROP COLUMN zip_code;
		ALTER TABLE tenants DROP COLUMN city;
		ALTER TABLE tenants DROP COLUMN country;
	`,
};
