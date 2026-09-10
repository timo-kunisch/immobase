import { getDb } from "./db";
import { newId, now } from "./helpers";
import { deletePostalShipmentsForSource } from "./postal-shipments";
import type {
	BillingPeriod,
	ConsumptionValue,
	CostItem,
	CustomAllocationKey,
	Lease,
	Property,
	RentAdjustment,
	Tenant,
	TenantStatement,
	TenantStatementLine,
	Unit,
} from "./types";
import { deleteUploadedFile } from "@/lib/storage";

/**
 * Repository für die Nebenkostenabrechnung (Tabellen `billing_periods`,
 * `cost_items`, `consumption_values`, `tenant_statements`,
 * `tenant_statement_lines`). Konventionen siehe src/data/properties.ts.
 *
 * Zusätzlich liegen hier die zusammengesetzten Lade-Funktionen, die das
 * Abrechnungs-Modul für die Berechnung (src/lib/billing.ts), die
 * Detailansicht und die PDF-Erzeugung benötigt - inkl. der domänen-
 * übergreifenden Lesefragmente (Liegenschaften, Einheiten, Mietverträge,
 * Mieter, Mietanpassungen), die nur für die Abrechnung gebraucht werden.
 *
 * Zusammenhängende Mehr-Schreib-Operationen (Verbrauchswerte-Upserts,
 * Finalisierung) laufen in echten better-sqlite3-Transaktionen (atomar,
 * mit Rollback bei Fehlern).
 */

const BILLING_PERIOD_COLUMNS = `
	id, property_id AS propertyId, period_from AS periodFrom, period_to AS periodTo,
	status, finalized_at AS finalizedAt, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

const COST_ITEM_COLUMNS = `
	id, billing_period_id AS billingPeriodId, label, amount,
	allocation_key AS allocationKey, direct_unit_id AS directUnitId,
	custom_allocation_key_id AS customAllocationKeyId, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

const CONSUMPTION_VALUE_COLUMNS = `
	id, cost_item_id AS costItemId, unit_id AS unitId, value,
	created_at AS createdAt, updated_at AS updatedAt
`;

const TENANT_STATEMENT_COLUMNS = `
	id, billing_period_id AS billingPeriodId, lease_id AS leaseId,
	occupied_from AS occupiedFrom, occupied_to AS occupiedTo, occupied_days AS occupiedDays,
	total_allocated_costs AS totalAllocatedCosts, total_prepayments AS totalPrepayments, balance,
	pdf_path AS pdfPath, pdf_file_size AS pdfFileSize, pdf_generated_at AS pdfGeneratedAt,
	created_at AS createdAt, updated_at AS updatedAt
`;

// ------------------------------------------------------------
// Domänenübergreifende Lese-Fragmente (nur für die Abrechnung)
// ------------------------------------------------------------

const PROPERTY_COLUMNS = `
	id, name, street, zip_code AS zipCode, city, country, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

const UNIT_COLUMNS = `
	id, property_id AS propertyId, label, living_space AS livingSpace, rooms,
	floor, co_ownership_share AS coOwnershipShare,
	created_at AS createdAt, updated_at AS updatedAt
`;

const TENANT_COLUMNS = `
	id, first_name AS firstName, last_name AS lastName, email, phone, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

const LEASE_COLUMNS = `
	id, unit_id AS unitId, tenant_id AS tenantId, start_date AS startDate, end_date AS endDate,
	cold_rent AS coldRent, service_charges AS serviceCharges, number_of_occupants AS numberOfOccupants,
	deposit, notes, created_at AS createdAt, updated_at AS updatedAt
`;

const RENT_ADJUSTMENT_COLUMNS = `
	id, lease_id AS leaseId, valid_from AS validFrom, cold_rent AS coldRent,
	service_charges AS serviceCharges, notes, created_at AS createdAt, updated_at AS updatedAt
`;

function getPropertyRow(id: string): Property | null {
	const row = getDb().prepare(`SELECT ${PROPERTY_COLUMNS} FROM properties WHERE id = ?`).get(id) as Property | undefined;
	return row ?? null;
}

function getUnitRow(id: string): Unit | null {
	const row = getDb().prepare(`SELECT ${UNIT_COLUMNS} FROM units WHERE id = ?`).get(id) as Unit | undefined;
	return row ?? null;
}

function getTenantRow(id: string): Tenant | null {
	const row = getDb().prepare(`SELECT ${TENANT_COLUMNS} FROM tenants WHERE id = ?`).get(id) as Tenant | undefined;
	return row ?? null;
}

function getLeaseRow(id: string): Lease | null {
	const row = getDb().prepare(`SELECT ${LEASE_COLUMNS} FROM leases WHERE id = ?`).get(id) as Lease | undefined;
	return row ?? null;
}

function listRentAdjustmentRows(leaseId: string): RentAdjustment[] {
	return getDb()
		.prepare(`SELECT ${RENT_ADJUSTMENT_COLUMNS} FROM rent_adjustments WHERE lease_id = ? ORDER BY valid_from`)
		.all(leaseId) as RentAdjustment[];
}

// ============================================================
// Abrechnungsperiode (BillingPeriod)
// ============================================================

export interface BillingPeriodInput {
	propertyId: string;
	periodFrom: string;
	periodTo: string;
	notes: string | null;
}

/** Abrechnungsperiode inklusive Name der zugehörigen Liegenschaft (Listenansicht). */
export interface BillingPeriodWithPropertyName extends BillingPeriod {
	propertyName: string;
}

export function listBillingPeriods(filter?: { propertyId?: string }): BillingPeriodWithPropertyName[] {
	const where = filter?.propertyId ? "WHERE bp.property_id = ?" : "";
	const params = filter?.propertyId ? [filter.propertyId] : [];
	return getDb()
		.prepare(
			`SELECT bp.id, bp.property_id AS propertyId, bp.period_from AS periodFrom, bp.period_to AS periodTo,
				bp.status, bp.finalized_at AS finalizedAt, bp.notes,
				bp.created_at AS createdAt, bp.updated_at AS updatedAt,
				p.name AS propertyName
			 FROM billing_periods bp
			 JOIN properties p ON p.id = bp.property_id
			 ${where}
			 ORDER BY bp.period_from DESC`
		)
		.all(...params) as BillingPeriodWithPropertyName[];
}

export function getBillingPeriod(id: string): BillingPeriod | null {
	const row = getDb().prepare(`SELECT ${BILLING_PERIOD_COLUMNS} FROM billing_periods WHERE id = ?`).get(id) as
		| BillingPeriod
		| undefined;
	return row ?? null;
}

export function createBillingPeriod(input: BillingPeriodInput): BillingPeriod {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO billing_periods (id, property_id, period_from, period_to, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.propertyId, input.periodFrom, input.periodTo, input.notes, timestamp, timestamp);
	return { id, ...input, status: "DRAFT", finalizedAt: null, createdAt: timestamp, updatedAt: timestamp };
}

export function updateBillingPeriod(id: string, input: BillingPeriodInput): void {
	getDb()
		.prepare(
			`UPDATE billing_periods
			 SET property_id = ?, period_from = ?, period_to = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.propertyId, input.periodFrom, input.periodTo, input.notes, now(), id);
}

/**
 * Löscht eine Abrechnungsperiode. Kostenpositionen, Verbrauchswerte sowie
 * etwaige TenantStatements (inkl. Zeilen) werden per ON DELETE CASCADE
 * der Datenbank mitentfernt (foreign_keys-Pragma ist aktiv, siehe
 * src/data/db.ts).
 *
 * Löschbar sind seit Wegfall der Löschsperre auch FINALISIERTE Perioden
 * (bewusste Entscheidung: Sie sind nicht mehr bearbeitbar, ihre Löschung
 * bleibt aber möglich, z. B. um fehlerhafte Abrechnungen zu entsorgen) -
 * deshalb räumen die aufrufenden Schichten (Server Action/MCP) vorher die
 * erzeugten Abrechnungs-PDFs aus der Dateiablage sowie die Postversand-
 * Protokolle weg, siehe deleteBillingPeriodWithArtifacts.
 */
export function deleteBillingPeriod(id: string): void {
	getDb().prepare("DELETE FROM billing_periods WHERE id = ?").run(id);
}

/**
 * Dateipfade aller erzeugten Abrechnungs-PDFs einer Periode (null-Werte
 * ausgelassen) - Grundlage der Aufräumlogik beim Löschen.
 */
export function listTenantStatementPdfPathsForPeriod(billingPeriodId: string): string[] {
	const rows = getDb()
		.prepare("SELECT pdf_path AS pdfPath FROM tenant_statements WHERE billing_period_id = ? AND pdf_path IS NOT NULL")
		.all(billingPeriodId) as { pdfPath: string }[];
	return rows.map((row) => row.pdfPath);
}

/**
 * Löscht eine Abrechnungsperiode inkl. aller erzeugten Artefakte: die
 * erzeugten Abrechnungs-PDFs aus der Dateiablage, die Postversand-Protokolle
 * (postal_shipments) der Einzelabrechnungen sowie die Periode selbst
 * (Kostenpositionen/Verbrauchswerte/Einzelabrechnungen per ON DELETE
 * CASCADE). Wird von Server Action und MCP identisch genutzt.
 */
export async function deleteBillingPeriodWithArtifacts(id: string): Promise<void> {
	const pdfPaths = listTenantStatementPdfPathsForPeriod(id);
	const statementIds = listTenantStatementIdsForPeriod(id);
	deletePostalShipmentsForSource("TENANT_STATEMENT", statementIds);
	deleteBillingPeriod(id);
	for (const pdfPath of pdfPaths) {
		await deleteUploadedFile(pdfPath);
	}
}

/** Anzahl der Kostenpositionen je Abrechnungsperiode (für die Listenansicht). */
export function getCostItemCountsByPeriod(): Map<string, number> {
	const rows = getDb()
		.prepare("SELECT billing_period_id AS billingPeriodId, COUNT(*) AS value FROM cost_items GROUP BY billing_period_id")
		.all() as { billingPeriodId: string; value: number }[];
	return new Map(rows.map((row) => [row.billingPeriodId, row.value]));
}

/**
 * Liegenschaften alphabetisch für den Filter und das Anlage-Formular der
 * Listenansicht (domänenfremde Daten, bewusst als eigene Abfrage hier im
 * Abrechnungs-Repository statt eines Cross-Imports).
 */
export function listPropertiesSortedByName(): Property[] {
	return getDb().prepare(`SELECT ${PROPERTY_COLUMNS} FROM properties ORDER BY name`).all() as Property[];
}

// ============================================================
// Kostenpositionen (CostItem)
// ============================================================

export interface CostItemInput {
	billingPeriodId: string;
	label: string;
	amount: string;
	allocationKey: CostItem["allocationKey"];
	directUnitId: string | null;
	/** Nur gesetzt bei allocationKey = "CUSTOM" (sonst null). */
	customAllocationKeyId: string | null;
	notes: string | null;
}

export function getCostItem(id: string): CostItem | null {
	const row = getDb().prepare(`SELECT ${COST_ITEM_COLUMNS} FROM cost_items WHERE id = ?`).get(id) as CostItem | undefined;
	return row ?? null;
}

export function createCostItem(input: CostItemInput): CostItem {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO cost_items (id, billing_period_id, label, amount, allocation_key, direct_unit_id, custom_allocation_key_id, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			id,
			input.billingPeriodId,
			input.label,
			input.amount,
			input.allocationKey,
			input.directUnitId,
			input.customAllocationKeyId,
			input.notes,
			timestamp,
			timestamp
		);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

export function updateCostItem(id: string, input: CostItemInput): void {
	getDb()
		.prepare(
			`UPDATE cost_items
			 SET billing_period_id = ?, label = ?, amount = ?, allocation_key = ?, direct_unit_id = ?, custom_allocation_key_id = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(
			input.billingPeriodId,
			input.label,
			input.amount,
			input.allocationKey,
			input.directUnitId,
			input.customAllocationKeyId,
			input.notes,
			now(),
			id
		);
}

export function deleteCostItem(id: string): void {
	getDb().prepare("DELETE FROM cost_items WHERE id = ?").run(id);
}

// ============================================================
// Verbrauchswerte (ConsumptionValue)
// ============================================================

export interface ConsumptionValueInput {
	unitId: string;
	value: string;
}

/**
 * Speichert die Verbrauchswerte (Upsert je Einheit) einer Kostenposition.
 *
 * Läuft in EINER better-sqlite3-Transaktion: Entweder werden alle Werte
 * gespeichert oder (bei einem Fehler) keiner. `updated_at` eines
 * bestehenden Datensatzes bleibt beim Konflikt-Update unverändert (nur
 * der Wert wird ersetzt).
 */
export function saveConsumptionValuesForCostItem(costItemId: string, values: ConsumptionValueInput[]): void {
	const db = getDb();
	const upsert = db.prepare(
		`INSERT INTO consumption_values (id, cost_item_id, unit_id, value, created_at, updated_at)
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

/** Eine als bezahlt markierte Monats-Sollstellung eines Mietvertrags. */
export interface BillingPaidTransaction {
	/** Fälligkeitsdatum (der zugehörige Monat zählt als geleistete Vorauszahlung). */
	dueDate: string;
	/** Sollbetrag der Zahlung (nur Anzeige). */
	amount: string;
	purpose: string | null;
}

/** Mietvertrag inkl. Mieter, Mietanpassungs-Verlauf und bezahlten Sollstellungen. */
export interface BillingLease extends Lease {
	tenant: Tenant;
	rentAdjustments: RentAdjustment[];
	/** Als bezahlt (status "PAID") markierte Sollstellungen des Vertrags - Grundlage der tatsächlich geleisteten Vorauszahlungen (computePaidPrepaymentsCents). */
	paidTransactions: BillingPaidTransaction[];
}

/** Einheit inkl. aller Mietverträge (mit Mieter + Verlauf). */
export interface BillingUnit extends Unit {
	leases: BillingLease[];
}

/** Kostenposition inkl. Verbrauchswerten, (bei DIRECT) Ziel-Einheit und (bei CUSTOM) Umlageschlüssel. */
export interface BillingCostItem extends CostItem {
	consumptionValues: ConsumptionValue[];
	directUnit: Unit | null;
	/** Aufgelöster frei definierbarer Umlageschlüssel (nur bei allocationKey = "CUSTOM"). */
	customAllocationKey: CustomAllocationKey | null;
}

/** Eine Zeile der eingefrorenen Einzelabrechnung inkl. Kostenposition. */
export interface TenantStatementLineWithCostItem extends TenantStatementLine {
	costItem: CostItem;
}

/** Eingefrorene Einzelabrechnung inkl. Vertrag/Mieter/Einheit und Positionen. */
export interface BillingTenantStatement extends TenantStatement {
	lease: Lease & { tenant: Tenant; unit: Unit };
	lines: TenantStatementLineWithCostItem[];
}

/** Vollständig geladene Abrechnungsperiode (Detailansicht + Finalisierung). */
export interface BillingPeriodDetail {
	billingPeriod: BillingPeriod;
	property: Property;
	units: BillingUnit[];
	costItems: BillingCostItem[];
	/** Frei definierbare Umlageschlüssel der Liegenschaft (für CUSTOM-Kostenpositionen). */
	customAllocationKeys: CustomAllocationKey[];
	tenantStatements: BillingTenantStatement[];
}

function listPaidTransactionsForLease(leaseId: string): BillingPaidTransaction[] {
	return getDb()
		.prepare(
			`SELECT due_date AS dueDate, amount, purpose FROM transactions
			 WHERE lease_id = ? AND status = 'PAID' ORDER BY due_date`
		)
		.all(leaseId) as BillingPaidTransaction[];
}

function listLeasesForUnit(unitId: string): BillingLease[] {
	const leases = getDb()
		.prepare(`SELECT ${LEASE_COLUMNS} FROM leases WHERE unit_id = ? ORDER BY created_at`)
		.all(unitId) as Lease[];
	return leases.map((lease) => ({
		...lease,
		// tenant_id ist eine restrict-FK - der Mieter existiert garantiert.
		tenant: getTenantRow(lease.tenantId)!,
		rentAdjustments: listRentAdjustmentRows(lease.id),
		paidTransactions: listPaidTransactionsForLease(lease.id),
	}));
}

function listCostItemsForPeriod(billingPeriodId: string, keyById: Map<string, CustomAllocationKey>): BillingCostItem[] {
	const costItems = getDb()
		.prepare(`SELECT ${COST_ITEM_COLUMNS} FROM cost_items WHERE billing_period_id = ? ORDER BY created_at`)
		.all(billingPeriodId) as CostItem[];
	return costItems.map((costItem) => ({
		...costItem,
		consumptionValues: getDb()
			.prepare(`SELECT ${CONSUMPTION_VALUE_COLUMNS} FROM consumption_values WHERE cost_item_id = ?`)
			.all(costItem.id) as ConsumptionValue[],
		directUnit: costItem.directUnitId ? getUnitRow(costItem.directUnitId) : null,
		customAllocationKey: costItem.customAllocationKeyId ? keyById.get(costItem.customAllocationKeyId) ?? null : null,
	}));
}

function listLinesForStatement(tenantStatementId: string): TenantStatementLineWithCostItem[] {
	const lines = getDb()
		.prepare(
			`SELECT id, tenant_statement_id AS tenantStatementId, cost_item_id AS costItemId, amount, created_at AS createdAt
			 FROM tenant_statement_lines WHERE tenant_statement_id = ? ORDER BY created_at`
		)
		.all(tenantStatementId) as TenantStatementLine[];
	return lines.map((line) => ({
		...line,
		// cost_item_id ist eine cascade-FK auf dieselbe Periode - die
		// Kostenposition existiert garantiert.
		costItem: getCostItem(line.costItemId)!,
	}));
}

function listStatementsForPeriod(billingPeriodId: string): BillingTenantStatement[] {
	const statements = getDb()
		.prepare(`SELECT ${TENANT_STATEMENT_COLUMNS} FROM tenant_statements WHERE billing_period_id = ? ORDER BY occupied_from`)
		.all(billingPeriodId) as TenantStatement[];
	return statements.map((statement) => {
		// lease_id ist eine restrict-FK - Vertrag, Mieter und Einheit
		// existieren garantiert.
		const lease = getLeaseRow(statement.leaseId)!;
		return {
			...statement,
			lease: {
				...lease,
				tenant: getTenantRow(lease.tenantId)!,
				unit: getUnitRow(lease.unitId)!,
			},
			lines: listLinesForStatement(statement.id),
		};
	});
}

/**
 * Lädt eine Abrechnungsperiode mit allem, was die Detailansicht und die
 * Finalisierung benötigen: Liegenschaft, Einheiten inkl. Mietverträge
 * (+ Mieter, Mietanpassungen, bezahlte Sollstellungen), Kostenpositionen
 * inkl. Verbrauchswerten, frei definierbare Umlageschlüssel der Liegenschaft
 * und bereits eingefrorene Einzelabrechnungen.
 */
export function getBillingPeriodDetail(id: string): BillingPeriodDetail | null {
	const billingPeriod = getBillingPeriod(id);
	if (!billingPeriod) return null;
	// property_id ist eine restrict-FK - die Liegenschaft existiert garantiert.
	const property = getPropertyRow(billingPeriod.propertyId)!;

	const unitRows = getDb()
		.prepare(`SELECT ${UNIT_COLUMNS} FROM units WHERE property_id = ? ORDER BY created_at`)
		.all(billingPeriod.propertyId) as Unit[];

	const customAllocationKeys = getDb()
		.prepare(
			`SELECT id, property_id AS propertyId, label, notes, created_at AS createdAt, updated_at AS updatedAt
			 FROM custom_allocation_keys WHERE property_id = ? ORDER BY created_at`
		)
		.all(billingPeriod.propertyId) as CustomAllocationKey[];

	return {
		billingPeriod,
		property,
		units: unitRows.map((unit) => ({ ...unit, leases: listLeasesForUnit(unit.id) })),
		costItems: listCostItemsForPeriod(billingPeriod.id, new Map(customAllocationKeys.map((key) => [key.id, key]))),
		customAllocationKeys,
		tenantStatements: listStatementsForPeriod(billingPeriod.id),
	};
}

// ============================================================
// Finalisierung (atomares Einfrieren der Ergebnisse)
// ============================================================

export interface FinalizedTenantStatementLineInput {
	costItemId: string;
	/** Decimal-String (Umrechnung aus Cent liegt beim Aufrufer, siehe src/lib/money.ts). */
	amount: string;
}

export interface FinalizedTenantStatementInput {
	leaseId: string;
	occupiedFrom: string;
	occupiedTo: string;
	occupiedDays: number;
	totalAllocatedCosts: string;
	totalPrepayments: string;
	balance: string;
	lines: FinalizedTenantStatementLineInput[];
}

/**
 * Friert die zuvor berechneten Einzelabrechnungen (Berechnung bleibt in
 * src/lib/billing.ts) einer Abrechnungsperiode dauerhaft ein: Löscht
 * etwaige bereits vorhandene Statements dieser Periode (die zugehörigen
 * Zeilen entfernt die ON-DELETE-CASCADE), legt die neuen Statements inkl.
 * Zeilen an und setzt die Periode abschließend auf FINALIZED.
 *
 * Läuft in EINER better-sqlite3-Transaktion und ist damit atomar. Das
 * Vorgehen "vorher löschen + Status zuletzt setzen" bleibt darüber hinaus
 * defensiv erhalten.
 */
export function finalizeBillingPeriod(billingPeriodId: string, statements: FinalizedTenantStatementInput[]): void {
	const db = getDb();
	const timestamp = now();
	db.transaction(() => {
		db.prepare("DELETE FROM tenant_statements WHERE billing_period_id = ?").run(billingPeriodId);

		const insertStatement = db.prepare(
			`INSERT INTO tenant_statements
			 (id, billing_period_id, lease_id, occupied_from, occupied_to, occupied_days,
			  total_allocated_costs, total_prepayments, balance, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
		);
		const insertLine = db.prepare(
			`INSERT INTO tenant_statement_lines (id, tenant_statement_id, cost_item_id, amount, created_at)
			 VALUES (?, ?, ?, ?, ?)`
		);

		for (const statement of statements) {
			const statementId = newId();
			insertStatement.run(
				statementId,
				billingPeriodId,
				statement.leaseId,
				statement.occupiedFrom,
				statement.occupiedTo,
				statement.occupiedDays,
				statement.totalAllocatedCosts,
				statement.totalPrepayments,
				statement.balance,
				timestamp,
				timestamp
			);
			for (const line of statement.lines) {
				insertLine.run(newId(), statementId, line.costItemId, line.amount, timestamp);
			}
		}

		db.prepare("UPDATE billing_periods SET status = 'FINALIZED', finalized_at = ?, updated_at = ? WHERE id = ?").run(
			timestamp,
			timestamp,
			billingPeriodId
		);
	})();
}

// ============================================================
// PDF-Erzeugung (versandfertige Einzelabrechnungen)
// ============================================================

/** Alle Daten, die die PDF-Erzeugung einer Einzelabrechnung benötigt. */
export interface TenantStatementPdfData {
	statement: TenantStatement;
	billingPeriod: BillingPeriod;
	/** Liegenschaft der Abrechnungsperiode (Betreffzeile des PDFs). */
	property: Property;
	tenant: Tenant;
	unit: Unit;
	/** Liegenschaft der gemieteten Einheit (Empfängeranschrift). */
	unitProperty: Property;
	lines: TenantStatementLineWithCostItem[];
}

export function getTenantStatementForPdf(id: string): TenantStatementPdfData | null {
	const statementRow = getDb().prepare(`SELECT ${TENANT_STATEMENT_COLUMNS} FROM tenant_statements WHERE id = ?`).get(id) as
		| TenantStatement
		| undefined;
	if (!statementRow) return null;

	// Sämtliche Folge-Zeilen sind über restrict-/cascade-FKs verbunden und
	// existieren garantiert (Periode -> Liegenschaft, Vertrag -> Mieter/Einheit
	// -> deren Liegenschaft).
	const billingPeriod = getBillingPeriod(statementRow.billingPeriodId)!;
	const property = getPropertyRow(billingPeriod.propertyId)!;
	const lease = getLeaseRow(statementRow.leaseId)!;
	const tenant = getTenantRow(lease.tenantId)!;
	const unit = getUnitRow(lease.unitId)!;
	const unitProperty = getPropertyRow(unit.propertyId)!;

	return {
		statement: statementRow,
		billingPeriod,
		property,
		tenant,
		unit,
		unitProperty,
		lines: listLinesForStatement(statementRow.id),
	};
}

/** IDs aller eingefrorenen Einzelabrechnungen einer Periode (Massen-PDF-Erzeugung). */
export function listTenantStatementIdsForPeriod(billingPeriodId: string): string[] {
	const rows = getDb().prepare("SELECT id FROM tenant_statements WHERE billing_period_id = ?").all(billingPeriodId) as {
		id: string;
	}[];
	return rows.map((row) => row.id);
}

export interface TenantStatementPdfUpdate {
	pdfPath: string;
	pdfFileSize: number;
	pdfGeneratedAt: string;
}

/** Hinterlegt Dateipfad/-größe/-zeitpunkt eines frisch erzeugten Abrechnungs-PDFs. */
export function updateTenantStatementPdf(id: string, pdf: TenantStatementPdfUpdate): void {
	getDb()
		.prepare("UPDATE tenant_statements SET pdf_path = ?, pdf_file_size = ?, pdf_generated_at = ?, updated_at = ? WHERE id = ?")
		.run(pdf.pdfPath, pdf.pdfFileSize, pdf.pdfGeneratedAt, now(), id);
}
