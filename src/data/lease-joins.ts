import type { Property, Tenant, Unit } from "./types";

/**
 * Gemeinsame JOIN-Bausteine für die Repositories leases.ts und
 * transactions.ts: Beide reichern ihre Zeilen um die Mieteinheit (inkl.
 * Liegenschaft) und den Mieter an. Damit die Mapper hier einheitlich
 * greifen, gilt in beiden Repositories dieselbe Alias-Konvention:
 *
 * - Tabellen-Aliase: `u` = units, `p` = properties, `t` = tenants
 * - Spalten-Aliase: unitLabel, propertyName, tenantFirstName, ...
 *
 * Die IDs von Einheit/Mieter werden im JOIN nicht erneut selektiert - sie
 * entsprechen den FK-Spalten des jeweiligen Datensatzes (lease.unitId /
 * lease.tenantId) und werden den Mappern als Argument übergeben.
 */

/** Mieteinheit inkl. zugehöriger Liegenschaft (z. B. für Auswahllisten). */
export interface UnitWithProperty extends Unit {
	property: Property;
}

/** SELECT-Fragment: Einheit + Liegenschaft (Tabellen-Aliase u/p). */
export const UNIT_PROPERTY_COLUMNS = `
	u.property_id AS unitPropertyId, u.label AS unitLabel,
	u.living_space AS unitLivingSpace, u.rooms AS unitRooms, u.floor AS unitFloor,
	u.co_ownership_share AS unitCoOwnershipShare,
	u.created_at AS unitCreatedAt, u.updated_at AS unitUpdatedAt,
	p.name AS propertyName, p.street AS propertyStreet, p.zip_code AS propertyZipCode,
	p.city AS propertyCity, p.country AS propertyCountry, p.notes AS propertyNotes,
	p.created_at AS propertyCreatedAt, p.updated_at AS propertyUpdatedAt
`;

/** SELECT-Fragment: Mieter (Tabellen-Alias t). */
export const TENANT_COLUMNS = `
	t.first_name AS tenantFirstName, t.last_name AS tenantLastName,
	t.email AS tenantEmail, t.phone AS tenantPhone, t.notes AS tenantNotes,
	t.created_at AS tenantCreatedAt, t.updated_at AS tenantUpdatedAt
`;

/** Zeilenform der von UNIT_PROPERTY_COLUMNS erzeugten Aliase. */
export interface UnitPropertyJoinRow {
	unitPropertyId: string;
	unitLabel: string;
	unitLivingSpace: number | null;
	unitRooms: number | null;
	unitFloor: string | null;
	unitCoOwnershipShare: number | null;
	unitCreatedAt: string;
	unitUpdatedAt: string;
	propertyName: string;
	propertyStreet: string;
	propertyZipCode: string;
	propertyCity: string;
	propertyCountry: string;
	propertyNotes: string | null;
	propertyCreatedAt: string;
	propertyUpdatedAt: string;
}

/** Zeilenform der von TENANT_COLUMNS erzeugten Aliase. */
export interface TenantJoinRow {
	tenantFirstName: string;
	tenantLastName: string;
	tenantEmail: string | null;
	tenantPhone: string | null;
	tenantNotes: string | null;
	tenantCreatedAt: string;
	tenantUpdatedAt: string;
}

/** Baut aus einer JOIN-Zeile die verschachtelte Einheit inkl. Liegenschaft. */
export function mapUnitWithProperty(unitId: string, row: UnitPropertyJoinRow): UnitWithProperty {
	return {
		id: unitId,
		propertyId: row.unitPropertyId,
		label: row.unitLabel,
		livingSpace: row.unitLivingSpace,
		rooms: row.unitRooms,
		floor: row.unitFloor,
		coOwnershipShare: row.unitCoOwnershipShare,
		createdAt: row.unitCreatedAt,
		updatedAt: row.unitUpdatedAt,
		property: {
			id: row.unitPropertyId,
			name: row.propertyName,
			street: row.propertyStreet,
			zipCode: row.propertyZipCode,
			city: row.propertyCity,
			country: row.propertyCountry,
			notes: row.propertyNotes,
			createdAt: row.propertyCreatedAt,
			updatedAt: row.propertyUpdatedAt,
		},
	};
}

/** Baut aus einer JOIN-Zeile den verschachtelten Mieter. */
export function mapTenant(tenantId: string, row: TenantJoinRow): Tenant {
	return {
		id: tenantId,
		firstName: row.tenantFirstName,
		lastName: row.tenantLastName,
		email: row.tenantEmail,
		phone: row.tenantPhone,
		notes: row.tenantNotes,
		createdAt: row.tenantCreatedAt,
		updatedAt: row.tenantUpdatedAt,
	};
}
