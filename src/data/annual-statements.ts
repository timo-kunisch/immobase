import { getDb } from "./db";
import { boolToInt, intToBool, newId, now } from "./helpers";
import type {
	AnnualStatement,
	AnnualStatementUnitResult,
	AnnualStatementUnitResultLine,
	Hoa,
	HoaCostItem,
	HoaCostItemConsumptionValue,
	HoaCustomAllocationKey,
	HoaCustomAllocationKeyWeight,
	HousingCharge,
	Owner,
	Unit,
	UnitOwnership,
} from "./types";

/**
 * Repository für die WEG-Jahresabrechnung (Tabellen `annual_statements`,
 * `hoa_cost_items` mit context = "STATEMENT", `hoa_cost_item_consumption_values`,
 * `annual_statement_unit_results`, `annual_statement_unit_result_lines`).
 * Konventionen siehe src/data/properties.ts.
 *
 * Zusätzlich liegen hier die domänenübergreifenden Lesefragmente, die nur
 * die Jahresabrechnung benötigt (WEGs, Einheiten inkl. Eigentumsverhältnisse,
 * Eigentümer, freie Verteilerschlüssel inkl. Gewichte, Hausgeld-Sollstellungen
 * sowie die Entwurfs-Abrechnungsperioden der Mietverwaltung für die
 * BetrKV-Brücke).
 *
 * Besonderheiten:
 * - `hoa_cost_items.is_apportionable` und `owners.is_company` sind in SQLite
 *   integer 0/1 - das boolean-Mapping erfolgt ausschließlich hier.
 * - Zusammenhängende Mehr-Schreib-Operationen (Verbrauchswerte-Upserts,
 *   Finalisierung) laufen in echten better-sqlite3-Transaktionen (atomar,
 *   mit Rollback bei Fehlern).
 */

const ANNUAL_STATEMENT_COLUMNS = `
	id, hoa_id AS hoaId, period_from AS periodFrom, period_to AS periodTo,
	status, finalized_at AS finalizedAt, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

const HOA_COST_ITEM_COLUMNS = `
	id, context, economic_plan_id AS economicPlanId, annual_statement_id AS annualStatementId,
	category, label, amount, allocation_key AS allocationKey, direct_unit_id AS directUnitId,
	custom_allocation_key_id AS customAllocationKeyId, is_apportionable AS isApportionable, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

const HOA_CONSUMPTION_VALUE_COLUMNS = `
	id, cost_item_id AS costItemId, unit_id AS unitId, value,
	created_at AS createdAt, updated_at AS updatedAt
`;

const UNIT_RESULT_COLUMNS = `
	id, annual_statement_id AS annualStatementId, unit_id AS unitId, owner_id AS ownerId,
	owned_from AS ownedFrom, owned_to AS ownedTo, owned_days AS ownedDays,
	total_allocated_costs AS totalAllocatedCosts, total_prepayments AS totalPrepayments, balance,
	pdf_path AS pdfPath, pdf_file_size AS pdfFileSize, pdf_generated_at AS pdfGeneratedAt,
	created_at AS createdAt, updated_at AS updatedAt
`;

const UNIT_RESULT_LINE_COLUMNS = `
	id, unit_result_id AS unitResultId, cost_item_id AS costItemId, amount, created_at AS createdAt
`;

// ------------------------------------------------------------
// Domänenübergreifende Lese-Fragmente (nur für die Jahresabrechnung)
// ------------------------------------------------------------

const HOA_COLUMNS = `
	id, property_id AS propertyId, name, total_shares AS totalShares,
	bank_iban AS bankIban, bank_bic AS bankBic, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

const UNIT_COLUMNS = `
	id, property_id AS propertyId, label, living_space AS livingSpace, rooms,
	floor, co_ownership_share AS coOwnershipShare,
	created_at AS createdAt, updated_at AS updatedAt
`;

const UNIT_OWNERSHIP_COLUMNS = `
	id, unit_id AS unitId, owner_id AS ownerId, co_owner_id AS coOwnerId,
	start_date AS startDate, end_date AS endDate, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

const OWNER_COLUMNS = `
	id, first_name AS firstName, last_name AS lastName, is_company AS isCompany, company_name AS companyName,
	street, zip_code AS zipCode, city, country, email, phone, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

const CUSTOM_ALLOCATION_KEY_COLUMNS = `
	id, hoa_id AS hoaId, label, notes, created_at AS createdAt, updated_at AS updatedAt
`;

const CUSTOM_ALLOCATION_KEY_WEIGHT_COLUMNS = `
	id, custom_allocation_key_id AS customAllocationKeyId, unit_id AS unitId, weight,
	created_at AS createdAt, updated_at AS updatedAt
`;

const HOUSING_CHARGE_COLUMNS = `
	id, unit_id AS unitId, owner_id AS ownerId, economic_plan_id AS economicPlanId,
	amount, due_date AS dueDate, paid_date AS paidDate, purpose, status,
	created_at AS createdAt, updated_at AS updatedAt
`;

/** Zeilenform, wie better-sqlite3 sie liefert (isApportionable noch als 0/1). */
type HoaCostItemRow = Omit<HoaCostItem, "isApportionable"> & { isApportionable: number };

function mapHoaCostItemRow(row: HoaCostItemRow): HoaCostItem {
	return { ...row, isApportionable: intToBool(row.isApportionable) };
}

/** Zeilenform, wie better-sqlite3 sie liefert (isCompany noch als 0/1). */
type OwnerRow = Omit<Owner, "isCompany"> & { isCompany: number };

function mapOwnerRow(row: OwnerRow): Owner {
	return { ...row, isCompany: intToBool(row.isCompany) };
}

function getHoaRow(id: string): Hoa | null {
	const row = getDb().prepare(`SELECT ${HOA_COLUMNS} FROM hoas WHERE id = ?`).get(id) as Hoa | undefined;
	return row ?? null;
}

function getUnitRow(id: string): Unit | null {
	const row = getDb().prepare(`SELECT ${UNIT_COLUMNS} FROM units WHERE id = ?`).get(id) as Unit | undefined;
	return row ?? null;
}

function getOwnerRow(id: string): Owner | null {
	const row = getDb().prepare(`SELECT ${OWNER_COLUMNS} FROM owners WHERE id = ?`).get(id) as OwnerRow | undefined;
	return row ? mapOwnerRow(row) : null;
}

// ============================================================
// Jahresabrechnung (AnnualStatement)
// ============================================================

export interface AnnualStatementInput {
	hoaId: string;
	periodFrom: string;
	periodTo: string;
	notes: string | null;
}

/** Jahresabrechnung inklusive Name der zugehörigen WEG (Listenansicht). */
export interface AnnualStatementWithHoaName extends AnnualStatement {
	hoaName: string;
}

export function listAnnualStatements(filter?: { hoaId?: string }): AnnualStatementWithHoaName[] {
	const where = filter?.hoaId ? "WHERE s.hoa_id = ?" : "";
	const params = filter?.hoaId ? [filter.hoaId] : [];
	return getDb()
		.prepare(
			`SELECT s.id, s.hoa_id AS hoaId, s.period_from AS periodFrom, s.period_to AS periodTo,
				s.status, s.finalized_at AS finalizedAt, s.notes,
				s.created_at AS createdAt, s.updated_at AS updatedAt,
				h.name AS hoaName
			 FROM annual_statements s
			 JOIN hoas h ON h.id = s.hoa_id
			 ${where}
			 ORDER BY s.period_from DESC`
		)
		.all(...params) as AnnualStatementWithHoaName[];
}

export function getAnnualStatement(id: string): AnnualStatement | null {
	const row = getDb().prepare(`SELECT ${ANNUAL_STATEMENT_COLUMNS} FROM annual_statements WHERE id = ?`).get(id) as
		| AnnualStatement
		| undefined;
	return row ?? null;
}

export function createAnnualStatement(input: AnnualStatementInput): AnnualStatement {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO annual_statements (id, hoa_id, period_from, period_to, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.hoaId, input.periodFrom, input.periodTo, input.notes, timestamp, timestamp);
	return { id, ...input, status: "DRAFT", finalizedAt: null, createdAt: timestamp, updatedAt: timestamp };
}

export function updateAnnualStatement(id: string, input: AnnualStatementInput): void {
	getDb()
		.prepare(
			`UPDATE annual_statements
			 SET hoa_id = ?, period_from = ?, period_to = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.hoaId, input.periodFrom, input.periodTo, input.notes, now(), id);
}

/**
 * Löscht eine Jahresabrechnung. Kostenpositionen (context = "STATEMENT"),
 * deren Verbrauchswerte sowie etwaige Einzelabrechnungen (inkl. Zeilen)
 * werden per ON DELETE CASCADE der Datenbank mitentfernt. Löschbar sind
 * ohnehin nur Entwürfe (geprüft in der Server Action).
 */
export function deleteAnnualStatement(id: string): void {
	getDb().prepare("DELETE FROM annual_statements WHERE id = ?").run(id);
}

/**
 * WEGs alphabetisch für den HoaFilter und das Anlage-Formular der
 * Listenansicht (domänenfremde Daten, bewusst als eigene Abfrage hier im
 * Jahresabrechnungs-Repository statt eines Cross-Imports).
 */
export function listHoasSortedByName(): Hoa[] {
	return getDb().prepare(`SELECT ${HOA_COLUMNS} FROM hoas ORDER BY name`).all() as Hoa[];
}

// ============================================================
// Kostenpositionen (HoaCostItem, context = "STATEMENT")
// ============================================================

export interface HoaCostItemInput {
	context: HoaCostItem["context"];
	economicPlanId: string | null;
	annualStatementId: string | null;
	category: HoaCostItem["category"];
	label: string;
	amount: string;
	allocationKey: HoaCostItem["allocationKey"];
	directUnitId: string | null;
	customAllocationKeyId: string | null;
	isApportionable: boolean;
	notes: string | null;
}

export function getHoaCostItem(id: string): HoaCostItem | null {
	const row = getDb().prepare(`SELECT ${HOA_COST_ITEM_COLUMNS} FROM hoa_cost_items WHERE id = ?`).get(id) as
		| HoaCostItemRow
		| undefined;
	return row ? mapHoaCostItemRow(row) : null;
}

export function createHoaCostItem(input: HoaCostItemInput): HoaCostItem {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO hoa_cost_items
			 (id, context, economic_plan_id, annual_statement_id, category, label, amount,
			  allocation_key, direct_unit_id, custom_allocation_key_id, is_apportionable, notes,
			  created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			id,
			input.context,
			input.economicPlanId,
			input.annualStatementId,
			input.category,
			input.label,
			input.amount,
			input.allocationKey,
			input.directUnitId,
			input.customAllocationKeyId,
			boolToInt(input.isApportionable),
			input.notes,
			timestamp,
			timestamp
		);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

export function updateHoaCostItem(id: string, input: HoaCostItemInput): void {
	getDb()
		.prepare(
			`UPDATE hoa_cost_items
			 SET context = ?, economic_plan_id = ?, annual_statement_id = ?, category = ?, label = ?, amount = ?,
			     allocation_key = ?, direct_unit_id = ?, custom_allocation_key_id = ?, is_apportionable = ?,
			     notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(
			input.context,
			input.economicPlanId,
			input.annualStatementId,
			input.category,
			input.label,
			input.amount,
			input.allocationKey,
			input.directUnitId,
			input.customAllocationKeyId,
			boolToInt(input.isApportionable),
			input.notes,
			now(),
			id
		);
}

export function deleteHoaCostItem(id: string): void {
	getDb().prepare("DELETE FROM hoa_cost_items WHERE id = ?").run(id);
}

// ============================================================
// Verbrauchswerte je Einheit und Kostenposition (allocationKey = CONSUMPTION)
// ============================================================

export interface HoaConsumptionValueInput {
	unitId: string;
	value: string;
}

/**
 * Speichert die Verbrauchswerte (Upsert je Einheit) einer WEG-
 * Kostenposition.
 *
 * Läuft in EINER better-sqlite3-Transaktion: Entweder werden alle Werte
 * gespeichert oder (bei einem Fehler) keiner. `updated_at` eines
 * bestehenden Datensatzes bleibt beim Konflikt-Update unverändert (nur
 * der Wert wird ersetzt).
 */
export function saveHoaConsumptionValuesForCostItem(costItemId: string, values: HoaConsumptionValueInput[]): void {
	const db = getDb();
	const upsert = db.prepare(
		`INSERT INTO hoa_cost_item_consumption_values (id, cost_item_id, unit_id, value, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?)
		 ON CONFLICT (cost_item_id, unit_id) DO UPDATE SET value = excluded.value`
	);
	const timestamp = now();
	db.transaction(() => {
		for (const { unitId, value } of values) {
			upsert.run(newId(), costItemId, unitId, value, timestamp, timestamp);
		}
	})();
}

// ============================================================
// Zusammengesetzte Lade-Funktion (Detailansicht/Finalisierung)
// ============================================================

/** Einheit inkl. aller (zeitversionierten) Eigentumsverhältnisse. */
export interface UnitWithOwnerships extends Unit {
	ownerships: UnitOwnership[];
}

/** Kostenposition inkl. Verbrauchswerte. */
export interface HoaCostItemWithConsumptionValues extends HoaCostItem {
	consumptionValues: HoaCostItemConsumptionValue[];
}

/** Eine Zeile der eingefrorenen Einzelabrechnung inkl. Kostenposition. */
export interface AnnualStatementUnitResultLineWithCostItem extends AnnualStatementUnitResultLine {
	costItem: HoaCostItem;
}

/** Eingefrorene Einzelabrechnung inkl. Einheit, Eigentümer und Positionen. */
export interface AnnualStatementUnitResultWithDetails extends AnnualStatementUnitResult {
	unit: Unit;
	owner: Owner;
	lines: AnnualStatementUnitResultLineWithCostItem[];
}

/** Vollständig geladene Jahresabrechnung (Detailansicht + Finalisierung). */
export interface AnnualStatementDetail {
	statement: AnnualStatement;
	hoa: Hoa;
	customAllocationKeys: HoaCustomAllocationKey[];
	units: UnitWithOwnerships[];
	costItems: HoaCostItemWithConsumptionValues[];
	unitResults: AnnualStatementUnitResultWithDetails[];
}

function listConsumptionValuesForCostItem(costItemId: string): HoaCostItemConsumptionValue[] {
	return getDb()
		.prepare(`SELECT ${HOA_CONSUMPTION_VALUE_COLUMNS} FROM hoa_cost_item_consumption_values WHERE cost_item_id = ?`)
		.all(costItemId) as HoaCostItemConsumptionValue[];
}

function listUnitResultLines(unitResultId: string): AnnualStatementUnitResultLineWithCostItem[] {
	const lines = getDb()
		.prepare(`SELECT ${UNIT_RESULT_LINE_COLUMNS} FROM annual_statement_unit_result_lines WHERE unit_result_id = ? ORDER BY created_at`)
		.all(unitResultId) as AnnualStatementUnitResultLine[];
	return lines.map((line) => ({
		...line,
		// cost_item_id ist eine restrict-FK - die Kostenposition existiert garantiert.
		costItem: getHoaCostItem(line.costItemId)!,
	}));
}

function listUnitResultsForStatement(annualStatementId: string): AnnualStatementUnitResultWithDetails[] {
	const results = getDb()
		.prepare(`SELECT ${UNIT_RESULT_COLUMNS} FROM annual_statement_unit_results WHERE annual_statement_id = ? ORDER BY owned_from`)
		.all(annualStatementId) as AnnualStatementUnitResult[];
	return results.map((result) => ({
		...result,
		// unit_id/owner_id sind restrict-FKs - beide existieren garantiert.
		unit: getUnitRow(result.unitId)!,
		owner: getOwnerRow(result.ownerId)!,
		lines: listUnitResultLines(result.id),
	}));
}

/**
 * Lädt eine Jahresabrechnung mit allem, was die Detailansicht und die
 * Finalisierung benötigen: WEG inkl. freier Verteilerschlüssel, Einheiten
 * der Liegenschaft inkl. Eigentumsverhältnisse, Kostenpositionen inkl.
 * Verbrauchswerte und bereits eingefrorene Einzelabrechnungen.
 */
export function getAnnualStatementDetail(id: string): AnnualStatementDetail | null {
	const statement = getAnnualStatement(id);
	if (!statement) return null;
	// hoa_id ist eine restrict-FK - die WEG existiert garantiert.
	const hoa = getHoaRow(statement.hoaId)!;

	const db = getDb();
	const customAllocationKeys = db
		.prepare(`SELECT ${CUSTOM_ALLOCATION_KEY_COLUMNS} FROM hoa_custom_allocation_keys WHERE hoa_id = ?`)
		.all(statement.hoaId) as HoaCustomAllocationKey[];

	const unitRows = db.prepare(`SELECT ${UNIT_COLUMNS} FROM units WHERE property_id = ? ORDER BY created_at`).all(hoa.propertyId) as Unit[];
	const units: UnitWithOwnerships[] = unitRows.map((unit) => ({
		...unit,
		ownerships: db.prepare(`SELECT ${UNIT_OWNERSHIP_COLUMNS} FROM unit_ownerships WHERE unit_id = ?`).all(unit.id) as UnitOwnership[],
	}));

	const costItemRows = db
		.prepare(`SELECT ${HOA_COST_ITEM_COLUMNS} FROM hoa_cost_items WHERE annual_statement_id = ? ORDER BY created_at`)
		.all(id) as HoaCostItemRow[];
	const costItems: HoaCostItemWithConsumptionValues[] = costItemRows.map((row) => ({
		...mapHoaCostItemRow(row),
		consumptionValues: listConsumptionValuesForCostItem(row.id),
	}));

	return {
		statement,
		hoa,
		customAllocationKeys,
		units,
		costItems,
		unitResults: listUnitResultsForStatement(id),
	};
}

/**
 * Alle Eigentümer (für die Namensauflösung der Live-Vorschau im Entwurf -
 * die Einheiten-Eigentumsverhältnisse werden bewusst schlank ohne
 * Owner-Join gehalten).
 */
export function listOwners(): Owner[] {
	const rows = getDb().prepare(`SELECT ${OWNER_COLUMNS} FROM owners`).all() as OwnerRow[];
	return rows.map(mapOwnerRow);
}

/** Hausgeld-Sollstellungen (Vorauszahlungen) aller übergebenen Einheiten. */
export function listHousingChargesForUnits(unitIds: string[]): HousingCharge[] {
	if (unitIds.length === 0) return [];
	const placeholders = unitIds.map(() => "?").join(", ");
	return getDb()
		.prepare(`SELECT ${HOUSING_CHARGE_COLUMNS} FROM housing_charges WHERE unit_id IN (${placeholders})`)
		.all(...unitIds) as HousingCharge[];
}

/** Gewichte eines frei definierten Verteilerschlüssels (für die Umlage bei CUSTOM). */
export function listCustomAllocationKeyWeights(customAllocationKeyId: string): HoaCustomAllocationKeyWeight[] {
	return getDb()
		.prepare(`SELECT ${CUSTOM_ALLOCATION_KEY_WEIGHT_COLUMNS} FROM hoa_custom_allocation_key_weights WHERE custom_allocation_key_id = ?`)
		.all(customAllocationKeyId) as HoaCustomAllocationKeyWeight[];
}

// ============================================================
// Finalisierung (atomares Einfrieren der Einzelabrechnungen)
// ============================================================

export interface FinalizedUnitResultLineInput {
	costItemId: string;
	/** Decimal-String (Umrechnung aus Cent liegt beim Aufrufer, siehe src/lib/money.ts). */
	amount: string;
}

export interface FinalizedUnitResultInput {
	unitId: string;
	ownerId: string;
	ownedFrom: string;
	ownedTo: string;
	ownedDays: number;
	totalAllocatedCosts: string;
	totalPrepayments: string;
	balance: string;
	lines: FinalizedUnitResultLineInput[];
}

/**
 * Friert die zuvor berechneten Einzelabrechnungen (Berechnung bleibt in
 * src/lib/hoa-annual-statement.ts) einer Jahresabrechnung dauerhaft ein:
 * Löscht etwaige bereits vorhandene Ergebnisse dieser Abrechnung (die
 * zugehörigen Zeilen entfernt die ON-DELETE-CASCADE), legt die neuen
 * Ergebnisse inkl. Zeilen an und setzt die Abrechnung abschließend auf
 * FINALIZED.
 *
 * Läuft in EINER better-sqlite3-Transaktion und ist damit atomar. Das
 * Vorgehen "vorher löschen + Status zuletzt setzen" bleibt darüber hinaus
 * defensiv erhalten.
 */
export function finalizeAnnualStatement(annualStatementId: string, results: FinalizedUnitResultInput[]): void {
	const db = getDb();
	const timestamp = now();
	db.transaction(() => {
		db.prepare("DELETE FROM annual_statement_unit_results WHERE annual_statement_id = ?").run(annualStatementId);

		const insertResult = db.prepare(
			`INSERT INTO annual_statement_unit_results
			 (id, annual_statement_id, unit_id, owner_id, owned_from, owned_to, owned_days,
			  total_allocated_costs, total_prepayments, balance, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		);
		const insertLine = db.prepare(
			`INSERT INTO annual_statement_unit_result_lines (id, unit_result_id, cost_item_id, amount, created_at)
			 VALUES (?, ?, ?, ?, ?)`
		);

		for (const result of results) {
			const resultId = newId();
			insertResult.run(
				resultId,
				annualStatementId,
				result.unitId,
				result.ownerId,
				result.ownedFrom,
				result.ownedTo,
				result.ownedDays,
				result.totalAllocatedCosts,
				result.totalPrepayments,
				result.balance,
				timestamp,
				timestamp
			);
			for (const line of result.lines) {
				insertLine.run(newId(), resultId, line.costItemId, line.amount, timestamp);
			}
		}

		db.prepare("UPDATE annual_statements SET status = 'FINALIZED', finalized_at = ?, updated_at = ? WHERE id = ?").run(
			timestamp,
			timestamp,
			annualStatementId
		);
	})();
}

// ============================================================
// BetrKV-Brücke (Übertrag in die Nebenkostenabrechnung)
// ============================================================

/** Eingefrorene Einzelabrechnung inkl. Einheit und Positionen (für die BetrKV-Brücke). */
export interface AnnualStatementUnitResultForBridge {
	unitResult: AnnualStatementUnitResult;
	unit: Unit;
	lines: AnnualStatementUnitResultLineWithCostItem[];
}

export function getAnnualStatementUnitResultForBridge(unitResultId: string): AnnualStatementUnitResultForBridge | null {
	const unitResultRow = getDb().prepare(`SELECT ${UNIT_RESULT_COLUMNS} FROM annual_statement_unit_results WHERE id = ?`).get(unitResultId) as
		| AnnualStatementUnitResult
		| undefined;
	if (!unitResultRow) return null;

	// unit_id ist eine restrict-FK - die Einheit existiert garantiert.
	const unit = getUnitRow(unitResultRow.unitId)!;
	return { unitResult: unitResultRow, unit, lines: listUnitResultLines(unitResultRow.id) };
}

/** Entwurfs-Abrechnungsperiode der Mietverwaltung (Auswahloption im Brücken-Dialog). */
export interface DraftBillingPeriodOption {
	id: string;
	periodFrom: string;
	periodTo: string;
}

/**
 * Entwurfs-Abrechnungsperioden einer Liegenschaft der Mietverwaltung
 * (domänenfremde Daten, nur für den BetrKV-Brücken-Dialog - das
 * eigentliche Schreiben der übertragenen Kostenpositionen erfolgt über
 * src/data/billing.ts).
 */
export function listDraftBillingPeriodsForProperty(propertyId: string): DraftBillingPeriodOption[] {
	return getDb()
		.prepare("SELECT id, period_from AS periodFrom, period_to AS periodTo FROM billing_periods WHERE property_id = ? AND status = 'DRAFT'")
		.all(propertyId) as DraftBillingPeriodOption[];
}
