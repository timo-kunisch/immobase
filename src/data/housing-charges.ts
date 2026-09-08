import { getDb } from "./db";
import { newId, now, intToBool } from "./helpers";
import type { Hoa, HousingCharge, HousingChargeStatus, Owner, Unit } from "./types";

/**
 * Repository für Hausgeld-Sollstellungen (Tabelle `housing_charges`) -
 * analog zu src/data/transactions.ts (Mieteingänge) in der Mietverwaltung.
 * Konventionen siehe src/data/properties.ts.
 *
 * Enthält zusätzlich die domänenübergreifenden Lesefragmente, die nur das
 * Hausgeld-Modul benötigt (WEG-Stammdaten für den HoaFilter, Einheiten der
 * betroffenen Liegenschaften, Eigentümer für das Erfassungsformular).
 */

const HOA_COLUMNS = `
	id, property_id AS propertyId, name, total_shares AS totalShares,
	bank_iban AS bankIban, bank_bic AS bankBic, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

// ============================================================
// Querschnitts-Lesefragmente (WEG-Stammdaten, Einheiten, Eigentümer)
// ============================================================

/** Alle WEGs, alphabetisch sortiert (für den HoaFilter auf den WEG-Seiten). */
export function listHoasSortedByName(): Hoa[] {
	return getDb().prepare(`SELECT ${HOA_COLUMNS} FROM hoas ORDER BY name`).all() as Hoa[];
}

/** Einheiten der übergebenen Liegenschaften, nach Bezeichnung sortiert (Auswahl im Erfassungsformular). */
export function listUnitsForProperties(propertyIds: string[]): Unit[] {
	if (propertyIds.length === 0) return [];
	const placeholders = propertyIds.map(() => "?").join(", ");
	return getDb()
		.prepare(
			`SELECT id, property_id AS propertyId, label, living_space AS livingSpace, rooms,
				floor, co_ownership_share AS coOwnershipShare,
				created_at AS createdAt, updated_at AS updatedAt
			 FROM units
			 WHERE property_id IN (${placeholders})
			 ORDER BY label`
		)
		.all(...propertyIds) as Unit[];
}

interface OwnerRawRow extends Omit<Owner, "isCompany"> {
	isCompany: number;
}

/** Alle Eigentümer, nach Nachname sortiert (Auswahl im Erfassungsformular). */
export function listOwnersSortedByLastName(): Owner[] {
	const rows = getDb()
		.prepare(
			`SELECT id, first_name AS firstName, last_name AS lastName, is_company, company_name AS companyName,
				street, zip_code AS zipCode, city, country, email, phone, notes,
				created_at AS createdAt, updated_at AS updatedAt
			 FROM owners
			 ORDER BY last_name`
		)
		.all() as OwnerRawRow[];
	return rows.map((row) => ({ ...row, isCompany: intToBool(row.isCompany) }));
}

// ============================================================
// Hausgeld-Sollstellungen (HousingCharge)
// ============================================================

export interface HousingChargeInput {
	unitId: string;
	ownerId: string;
	amount: string;
	dueDate: string;
	paidDate: string | null;
	purpose: string | null;
	status: HousingChargeStatus;
}

/** Hausgeld-Sollstellung inkl. Einheit, Eigentümer und zugehöriger WEG (Listenansicht). */
export interface HousingChargeWithRelations extends HousingCharge {
	unit: Unit;
	owner: Owner;
	/** WEG der Liegenschaft der Einheit - LEFT JOIN, da eine Einheit ohne WEG erfasst sein könnte. */
	hoa: Hoa | null;
}

interface HousingChargeJoinRow extends HousingCharge {
	unitLabel: string;
	unitPropertyId: string;
	unitLivingSpace: number | null;
	unitRooms: number | null;
	unitFloor: string | null;
	unitCoOwnershipShare: number | null;
	unitCreatedAt: string;
	unitUpdatedAt: string;
	ownerFirstName: string;
	ownerLastName: string;
	ownerIsCompany: number;
	ownerCompanyName: string | null;
	ownerStreet: string;
	ownerZipCode: string;
	ownerCity: string;
	ownerCountry: string;
	ownerEmail: string | null;
	ownerPhone: string | null;
	ownerNotes: string | null;
	ownerCreatedAt: string;
	ownerUpdatedAt: string;
	hoaId: string | null;
	hoaPropertyId: string | null;
	hoaName: string | null;
	hoaTotalShares: number | null;
	hoaBankIban: string | null;
	hoaBankBic: string | null;
	hoaNotes: string | null;
	hoaCreatedAt: string | null;
	hoaUpdatedAt: string | null;
}

function mapHousingChargeRow(row: HousingChargeJoinRow): HousingChargeWithRelations {
	return {
		id: row.id,
		unitId: row.unitId,
		ownerId: row.ownerId,
		economicPlanId: row.economicPlanId,
		amount: row.amount,
		dueDate: row.dueDate,
		paidDate: row.paidDate,
		purpose: row.purpose,
		status: row.status,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		unit: {
			id: row.unitId,
			propertyId: row.unitPropertyId,
			label: row.unitLabel,
			livingSpace: row.unitLivingSpace,
			rooms: row.unitRooms,
			floor: row.unitFloor,
			coOwnershipShare: row.unitCoOwnershipShare,
			createdAt: row.unitCreatedAt,
			updatedAt: row.unitUpdatedAt,
		},
		owner: {
			id: row.ownerId,
			firstName: row.ownerFirstName,
			lastName: row.ownerLastName,
			isCompany: intToBool(row.ownerIsCompany),
			companyName: row.ownerCompanyName,
			street: row.ownerStreet,
			zipCode: row.ownerZipCode,
			city: row.ownerCity,
			country: row.ownerCountry,
			email: row.ownerEmail,
			phone: row.ownerPhone,
			notes: row.ownerNotes,
			createdAt: row.ownerCreatedAt,
			updatedAt: row.ownerUpdatedAt,
		},
		hoa: row.hoaId
			? {
					id: row.hoaId,
					propertyId: row.hoaPropertyId!,
					name: row.hoaName!,
					totalShares: row.hoaTotalShares!,
					bankIban: row.hoaBankIban,
					bankBic: row.hoaBankBic,
					notes: row.hoaNotes,
					createdAt: row.hoaCreatedAt!,
					updatedAt: row.hoaUpdatedAt!,
				}
			: null,
	};
}

/**
 * SELECT-/JOIN-Fragment des Hausgeld-Stammjoins (Einheit + Eigentümer +
 * WEG der Liegenschaft) - gemeinsam genutzt von listHousingChargesForUnits
 * und listHousingChargesForUnitsPage. Sortierung: neueste Fälligkeit
 * zuerst, ID als Tie-Breaker für eine stabile Pagination (LIMIT/OFFSET).
 */
const HOUSING_CHARGE_SELECT = `
	SELECT c.id, c.unit_id AS unitId, c.owner_id AS ownerId, c.economic_plan_id AS economicPlanId,
		c.amount, c.due_date AS dueDate, c.paid_date AS paidDate, c.purpose, c.status,
		c.created_at AS createdAt, c.updated_at AS updatedAt,
		u.label AS unitLabel, u.property_id AS unitPropertyId, u.living_space AS unitLivingSpace,
		u.rooms AS unitRooms, u.floor AS unitFloor, u.co_ownership_share AS unitCoOwnershipShare,
		u.created_at AS unitCreatedAt, u.updated_at AS unitUpdatedAt,
		o.first_name AS ownerFirstName, o.last_name AS ownerLastName, o.is_company AS ownerIsCompany,
		o.company_name AS ownerCompanyName, o.street AS ownerStreet, o.zip_code AS ownerZipCode,
		o.city AS ownerCity, o.country AS ownerCountry, o.email AS ownerEmail, o.phone AS ownerPhone,
		o.notes AS ownerNotes, o.created_at AS ownerCreatedAt, o.updated_at AS ownerUpdatedAt,
		h.id AS hoaId, h.property_id AS hoaPropertyId, h.name AS hoaName, h.total_shares AS hoaTotalShares,
		h.bank_iban AS hoaBankIban, h.bank_bic AS hoaBankBic, h.notes AS hoaNotes,
		h.created_at AS hoaCreatedAt, h.updated_at AS hoaUpdatedAt
	FROM housing_charges c
	JOIN units u ON u.id = c.unit_id
	JOIN owners o ON o.id = c.owner_id
	LEFT JOIN hoas h ON h.property_id = u.property_id
`;

const HOUSING_CHARGE_ORDER = "ORDER BY c.due_date DESC, c.id DESC";

/** Listet Hausgeld-Sollstellungen der übergebenen Einheiten (neueste Fälligkeit zuerst) inkl. Einheit/Eigentümer/WEG. */
export function listHousingChargesForUnits(unitIds: string[]): HousingChargeWithRelations[] {
	if (unitIds.length === 0) return [];
	const placeholders = unitIds.map(() => "?").join(", ");
	const rows = getDb()
		.prepare(`${HOUSING_CHARGE_SELECT} WHERE c.unit_id IN (${placeholders}) ${HOUSING_CHARGE_ORDER}`)
		.all(...unitIds) as HousingChargeJoinRow[];
	return rows.map(mapHousingChargeRow);
}

/** Zählt Hausgeld-Sollstellungen der übergebenen Einheiten - Grundlage der Seitennummerierung. */
export function countHousingChargesForUnits(unitIds: string[]): number {
	if (unitIds.length === 0) return 0;
	const placeholders = unitIds.map(() => "?").join(", ");
	const row = getDb()
		.prepare(`SELECT COUNT(*) AS value FROM housing_charges c WHERE c.unit_id IN (${placeholders})`)
		.get(...unitIds) as { value: number };
	return row.value;
}

/**
 * Seitenweise Variante von listHousingChargesForUnits (LIMIT/OFFSET) für
 * die paginierte Hausgeld-Liste (/weg/hausgeld). `limit`/`offset` kommen
 * aus resolvePagination (src/lib/pagination.ts).
 */
export function listHousingChargesForUnitsPage(unitIds: string[], page: { limit: number; offset: number }): HousingChargeWithRelations[] {
	if (unitIds.length === 0) return [];
	const placeholders = unitIds.map(() => "?").join(", ");
	const rows = getDb()
		.prepare(`${HOUSING_CHARGE_SELECT} WHERE c.unit_id IN (${placeholders}) ${HOUSING_CHARGE_ORDER} LIMIT ? OFFSET ?`)
		.all(...unitIds, page.limit, page.offset) as HousingChargeJoinRow[];
	return rows.map(mapHousingChargeRow);
}

/**
 * Beträge (Decimal-Strings) aller fälligen/überfälligen Sollstellungen der
 * übergebenen Einheiten (Status OPEN/OVERDUE, Fälligkeit <= `date`) für
 * die Rückstands-Karte auf /weg/hausgeld (unabhängig von der aktuell
 * angezeigten Seite). Die Summe wird im Aufrufer gebildet.
 */
export function listOpenHousingChargeArrearAmounts(unitIds: string[], date: Date): string[] {
	if (unitIds.length === 0) return [];
	const placeholders = unitIds.map(() => "?").join(", ");
	const rows = getDb()
		.prepare(`SELECT amount FROM housing_charges WHERE status IN ('OPEN', 'OVERDUE') AND due_date <= ? AND unit_id IN (${placeholders})`)
		.all(date.toISOString(), ...unitIds) as { amount: string }[];
	return rows.map((row) => row.amount);
}

export function createHousingCharge(input: HousingChargeInput): HousingCharge {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO housing_charges (id, unit_id, owner_id, economic_plan_id, amount, due_date, paid_date, purpose, status, created_at, updated_at)
			 VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.unitId, input.ownerId, input.amount, input.dueDate, input.paidDate, input.purpose, input.status, timestamp, timestamp);
	return { id, ...input, economicPlanId: null, createdAt: timestamp, updatedAt: timestamp };
}

export function updateHousingCharge(id: string, input: HousingChargeInput): void {
	getDb()
		.prepare(
			`UPDATE housing_charges
			 SET unit_id = ?, owner_id = ?, amount = ?, due_date = ?, paid_date = ?, purpose = ?, status = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.unitId, input.ownerId, input.amount, input.dueDate, input.paidDate, input.purpose, input.status, now(), id);
}

export function deleteHousingCharge(id: string): void {
	getDb().prepare("DELETE FROM housing_charges WHERE id = ?").run(id);
}

/** Schnellaktion: Sollstellung direkt aus der Tabelle als "bezahlt" markieren. */
export function markHousingChargePaid(id: string): void {
	const timestamp = now();
	getDb().prepare("UPDATE housing_charges SET status = 'PAID', paid_date = ?, updated_at = ? WHERE id = ?").run(timestamp, timestamp, id);
}
