import { getDb } from "./db";
import { newId, now, intToBool } from "./helpers";
import { toCents } from "@/lib/money";
import type {
	EconomicPlan,
	EconomicPlanUnitShare,
	Hoa,
	HoaCostItem,
	HoaCustomAllocationKey,
	HoaAllocationKey,
	Unit,
} from "./types";

/**
 * Repository für Wirtschaftspläne (Tabellen `economic_plans`,
 * `economic_plan_unit_shares`) inkl. der zugehörigen Kostenpositionen
 * (`hoa_cost_items` mit context = "PLAN", siehe Annahme 7 in
 * src/data/types.ts bzw. AGENTS.md). Konventionen siehe
 * src/data/properties.ts.
 *
 * Zusätzlich liegen hier die domänenübergreifenden Lesefragmente, die nur
 * der Wirtschaftsplan benötigt (WEG-Stammdaten, Einheiten der Liegenschaft,
 * frei definierte Verteilerschlüssel, Eigentumsverhältnisse für das
 * Fälligstellen der Hausgeld-Sollstellungen) sowie die beiden
 * Mehr-Schreib-Operationen Finalisierung (Einfrieren der
 * Einzelwirtschaftspläne) und Generierung der Hausgeld-Sollstellungen -
 * beide laufen in EINER better-sqlite3-Transaktion und sind damit atomar.
 */

const ECONOMIC_PLAN_COLUMNS = `
	id, hoa_id AS hoaId, fiscal_year_from AS fiscalYearFrom, fiscal_year_to AS fiscalYearTo,
	status, finalized_at AS finalizedAt, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

const UNIT_SHARE_COLUMNS = `
	id, economic_plan_id AS economicPlanId, unit_id AS unitId,
	annual_amount AS annualAmount, monthly_amount AS monthlyAmount,
	created_at AS createdAt, updated_at AS updatedAt
`;

// is_apportionable ist eine integer-Spalte (0/1) und wird daher nicht per
// Alias gemappt, sondern in mapHoaCostItemRow (intToBool).
const HOA_COST_ITEM_RAW_COLUMNS = `
	id, context, economic_plan_id AS economicPlanId, annual_statement_id AS annualStatementId,
	label, amount, allocation_key AS allocationKey,
	direct_unit_id AS directUnitId, custom_allocation_key_id AS customAllocationKeyId,
	is_apportionable, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

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

const CUSTOM_ALLOCATION_KEY_COLUMNS = `
	id, hoa_id AS hoaId, label, notes,
	created_at AS createdAt, updated_at AS updatedAt
`;

interface HoaCostItemRawRow extends Omit<HoaCostItem, "isApportionable"> {
	isApportionable: number;
}

function mapHoaCostItemRow(row: HoaCostItemRawRow): HoaCostItem {
	return { ...row, isApportionable: intToBool(row.isApportionable) };
}

// ============================================================
// Querschnitts-Lesefragmente (WEG-Stammdaten)
// ============================================================

/** Alle WEGs, alphabetisch sortiert (für den HoaFilter auf den WEG-Seiten). */
export function listHoasSortedByName(): Hoa[] {
	return getDb().prepare(`SELECT ${HOA_COLUMNS} FROM hoas ORDER BY name`).all() as Hoa[];
}

// ============================================================
// Wirtschaftsplan (EconomicPlan)
// ============================================================

export interface EconomicPlanInput {
	hoaId: string;
	fiscalYearFrom: string;
	fiscalYearTo: string;
	notes: string | null;
}

/** Wirtschaftsplan inkl. Name der zugehörigen WEG (Listenansicht). */
export interface EconomicPlanWithHoaName extends EconomicPlan {
	hoaName: string;
}

export function listEconomicPlans(filter?: { hoaId?: string }): EconomicPlanWithHoaName[] {
	const where = filter?.hoaId ? "WHERE ep.hoa_id = ?" : "";
	const params = filter?.hoaId ? [filter.hoaId] : [];
	return getDb()
		.prepare(
			`SELECT ep.id, ep.hoa_id AS hoaId, ep.fiscal_year_from AS fiscalYearFrom, ep.fiscal_year_to AS fiscalYearTo,
				ep.status, ep.finalized_at AS finalizedAt, ep.notes,
				ep.created_at AS createdAt, ep.updated_at AS updatedAt,
				h.name AS hoaName
			 FROM economic_plans ep
			 JOIN hoas h ON h.id = ep.hoa_id
			 ${where}
			 ORDER BY ep.fiscal_year_from DESC`
		)
		.all(...params) as EconomicPlanWithHoaName[];
}

export function getEconomicPlan(id: string): EconomicPlan | null {
	const row = getDb().prepare(`SELECT ${ECONOMIC_PLAN_COLUMNS} FROM economic_plans WHERE id = ?`).get(id) as EconomicPlan | undefined;
	return row ?? null;
}

export function createEconomicPlan(input: EconomicPlanInput): EconomicPlan {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO economic_plans (id, hoa_id, fiscal_year_from, fiscal_year_to, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.hoaId, input.fiscalYearFrom, input.fiscalYearTo, input.notes, timestamp, timestamp);
	return { id, ...input, status: "DRAFT", finalizedAt: null, createdAt: timestamp, updatedAt: timestamp };
}

export function updateEconomicPlan(id: string, input: EconomicPlanInput): void {
	getDb()
		.prepare(
			`UPDATE economic_plans
			 SET hoa_id = ?, fiscal_year_from = ?, fiscal_year_to = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.hoaId, input.fiscalYearFrom, input.fiscalYearTo, input.notes, now(), id);
}

export function deleteEconomicPlan(id: string): void {
	getDb().prepare("DELETE FROM economic_plans WHERE id = ?").run(id);
}

// ============================================================
// Kostenpositionen des Wirtschaftsplans (HoaCostItem, context = "PLAN")
// ============================================================

export interface EconomicPlanCostItemInput {
	label: string;
	amount: string;
	allocationKey: HoaAllocationKey;
	directUnitId: string | null;
	customAllocationKeyId: string | null;
	notes: string | null;
}

export function createEconomicPlanCostItem(economicPlanId: string, input: EconomicPlanCostItemInput): HoaCostItem {
	const id = newId();
	const timestamp = now();
	// is_apportionable ist nur bei context = "STATEMENT" fachlich relevant
	// (BetrKV-Brücke) und bleibt hier auf dem DB-Default 1.
	getDb()
		.prepare(
			`INSERT INTO hoa_cost_items
			 (id, context, economic_plan_id, annual_statement_id, label, amount,
			  allocation_key, direct_unit_id, custom_allocation_key_id, notes, created_at, updated_at)
			 VALUES (?, 'PLAN', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(
			id,
			economicPlanId,
			input.label,
			input.amount,
			input.allocationKey,
			input.directUnitId,
			input.customAllocationKeyId,
			input.notes,
			timestamp,
			timestamp
		);
	return {
		id,
		context: "PLAN",
		economicPlanId,
		annualStatementId: null,
		isApportionable: true,
		...input,
		createdAt: timestamp,
		updatedAt: timestamp,
	};
}

export function updateEconomicPlanCostItem(id: string, economicPlanId: string, input: EconomicPlanCostItemInput): void {
	getDb()
		.prepare(
			`UPDATE hoa_cost_items
			 SET context = 'PLAN', economic_plan_id = ?, annual_statement_id = NULL,
			     label = ?, amount = ?, allocation_key = ?,
			     direct_unit_id = ?, custom_allocation_key_id = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(
			economicPlanId,
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

export function deleteEconomicPlanCostItem(id: string): void {
	getDb().prepare("DELETE FROM hoa_cost_items WHERE id = ?").run(id);
}

// ============================================================
// Zusammengesetzte Lade-Funktion (Detailansicht/Finalisierung)
// ============================================================

/** Eingefrorener Einzelwirtschaftsplan je Einheit inkl. Einheiten-Bezeichnung. */
export interface EconomicPlanUnitShareWithUnit extends EconomicPlanUnitShare {
	unit: Unit;
}

/** Vollständig geladener Wirtschaftsplan (Detailansicht + Finalisierung). */
export interface EconomicPlanDetail {
	plan: EconomicPlan;
	hoa: Hoa;
	/** Einheiten der Liegenschaft der WEG (Verteilungsgrundlage). */
	units: Unit[];
	/** Frei definierte Verteilerschlüssel der WEG (für CUSTOM-Kostenpositionen). */
	customAllocationKeys: HoaCustomAllocationKey[];
	/** Kostenpositionen des Plans (context = "PLAN"). */
	costItems: HoaCostItem[];
	/** Eingefrorene Einzelwirtschaftspläne (nach der Finalisierung). */
	unitShares: EconomicPlanUnitShareWithUnit[];
}

/**
 * Lädt einen Wirtschaftsplan mit allem, was die Detailansicht, die
 * Live-Vorschau und die Finalisierung benötigen: WEG, Einheiten der
 * Liegenschaft, frei definierte Verteilerschlüssel, Kostenpositionen und
 * bereits eingefrorene Einzelwirtschaftspläne.
 */
export function getEconomicPlanDetail(id: string): EconomicPlanDetail | null {
	const db = getDb();
	const plan = getEconomicPlan(id);
	if (!plan) return null;
	// hoa_id ist eine restrict-FK - die WEG existiert garantiert.
	const hoa = db.prepare(`SELECT ${HOA_COLUMNS} FROM hoas WHERE id = ?`).get(plan.hoaId) as Hoa;

	const units = db.prepare(`SELECT ${UNIT_COLUMNS} FROM units WHERE property_id = ? ORDER BY created_at`).all(hoa.propertyId) as Unit[];

	const customAllocationKeys = db
		.prepare(`SELECT ${CUSTOM_ALLOCATION_KEY_COLUMNS} FROM hoa_custom_allocation_keys WHERE hoa_id = ? ORDER BY created_at`)
		.all(hoa.id) as HoaCustomAllocationKey[];

	const costItemRows = db
		.prepare(`SELECT ${HOA_COST_ITEM_RAW_COLUMNS} FROM hoa_cost_items WHERE economic_plan_id = ? ORDER BY created_at`)
		.all(id) as HoaCostItemRawRow[];
	const costItems = costItemRows.map(mapHoaCostItemRow);

	const shareRows = db.prepare(`SELECT ${UNIT_SHARE_COLUMNS} FROM economic_plan_unit_shares WHERE economic_plan_id = ? ORDER BY created_at`).all(id) as EconomicPlanUnitShare[];
	const unitById = new Map(units.map((unit) => [unit.id, unit]));
	const unitShares = shareRows.map((share) => ({
		...share,
		// unit_id ist eine restrict-FK - die Einheit existiert garantiert
		// (und liegt auf derselben Liegenschaft wie die WEG).
		unit: unitById.get(share.unitId)!,
	}));

	return { plan, hoa, units, customAllocationKeys, costItems, unitShares };
}

/**
 * Summen der Wirtschaftspläne einer WEG für den Plan-/Ist-Abgleich der
 * Jahresabrechnung (src/lib/hoa-annual-statement.ts): je Plan Geschäftsjahr,
 * Status und Summe der PLAN-Kostenpositionen. Die Betragssumme wird
 * anwendungsseitig über toCents gebildet (kein SQLite-SUM über TEXT-
 * Decimal-Strings, Muster wie listAccountBookingSumsForPeriod).
 */
export function listEconomicPlanTotalsForHoa(hoaId: string): { id: string; fiscalYearFrom: string; fiscalYearTo: string; status: EconomicPlan["status"]; plannedTotalCents: number }[] {
	const plans = getDb().prepare(`SELECT ${ECONOMIC_PLAN_COLUMNS} FROM economic_plans WHERE hoa_id = ? ORDER BY fiscal_year_from`).all(hoaId) as EconomicPlan[];
	return plans.map((plan) => {
		const rows = getDb().prepare("SELECT amount FROM hoa_cost_items WHERE economic_plan_id = ?").all(plan.id) as { amount: string }[];
		const plannedTotalCents = rows.reduce((sum, row) => sum + toCents(row.amount), 0);
		return {
			id: plan.id,
			fiscalYearFrom: plan.fiscalYearFrom,
			fiscalYearTo: plan.fiscalYearTo,
			status: plan.status,
			plannedTotalCents,
		};
	});
}

/** Gewicht je Einheit eines frei definierten Verteilerschlüssels (für CUSTOM-Kostenpositionen). */
export interface CustomAllocationWeightRow {
	customAllocationKeyId: string;
	unitId: string;
	weight: number;
}

/** Lädt die Gewichte aller übergebenen frei definierten Verteilerschlüssel. */
export function listCustomAllocationKeyWeights(customAllocationKeyIds: string[]): CustomAllocationWeightRow[] {
	if (customAllocationKeyIds.length === 0) return [];
	const placeholders = customAllocationKeyIds.map(() => "?").join(", ");
	return getDb()
		.prepare(
			`SELECT custom_allocation_key_id AS customAllocationKeyId, unit_id AS unitId, weight
			 FROM hoa_custom_allocation_key_weights
			 WHERE custom_allocation_key_id IN (${placeholders})`
		)
		.all(...customAllocationKeyIds) as CustomAllocationWeightRow[];
}

/** Eingefrorene Einzelwirtschaftspläne eines Plans (Grundlage für das Fälligstellen der Hausgeld-Sollstellungen). */
export function listEconomicPlanUnitShares(economicPlanId: string): EconomicPlanUnitShare[] {
	return getDb()
		.prepare(`SELECT ${UNIT_SHARE_COLUMNS} FROM economic_plan_unit_shares WHERE economic_plan_id = ? ORDER BY created_at`)
		.all(economicPlanId) as EconomicPlanUnitShare[];
}

// ============================================================
// Finalisierung: Entwurf -> eingefrorener Einzelwirtschaftsplan je Einheit
// ============================================================

export interface FinalizedUnitShareInput {
	unitId: string;
	/** Decimal-Strings (Umrechnung aus Cent liegt in src/lib/hoa-economic-plan.ts). */
	annualAmount: string;
	monthlyAmount: string;
}

/**
 * Friert die zuvor berechneten Einzelwirtschaftspläne (Berechnung bleibt in
 * src/lib/hoa-economic-plan.ts) ein: Löscht etwaige bereits vorhandene
 * Zeilen dieses Plans, legt die neuen an und setzt den Plan abschließend
 * auf FINALIZED.
 *
 * Läuft in EINER better-sqlite3-Transaktion und ist damit atomar. Das
 * Vorgehen "vorher löschen + Status zuletzt setzen" bleibt darüber hinaus
 * defensiv erhalten.
 */
export function finalizeEconomicPlan(economicPlanId: string, shares: FinalizedUnitShareInput[]): void {
	const db = getDb();
	const timestamp = now();
	db.transaction(() => {
		db.prepare("DELETE FROM economic_plan_unit_shares WHERE economic_plan_id = ?").run(economicPlanId);

		const insertShare = db.prepare(
			`INSERT INTO economic_plan_unit_shares (id, economic_plan_id, unit_id, annual_amount, monthly_amount, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		);
		for (const share of shares) {
			insertShare.run(newId(), economicPlanId, share.unitId, share.annualAmount, share.monthlyAmount, timestamp, timestamp);
		}

		db.prepare("UPDATE economic_plans SET status = 'FINALIZED', finalized_at = ?, updated_at = ? WHERE id = ?").run(timestamp, timestamp, economicPlanId);
	})();
}

// ============================================================
// Monatliche Hausgeld-Sollstellungen aus dem finalisierten Wirtschaftsplan
// ============================================================

/** Zeitraum eines Eigentumsverhältnisses (für die Eigentümer-Ermittlung je Fälligkeitsmonat). */
export interface UnitOwnershipPeriod {
	unitId: string;
	ownerId: string;
	startDate: string;
	endDate: string | null;
}

/** Lädt die Eigentumsverhältnisse aller übergebenen Einheiten. */
export function listUnitOwnershipsForUnits(unitIds: string[]): UnitOwnershipPeriod[] {
	if (unitIds.length === 0) return [];
	const placeholders = unitIds.map(() => "?").join(", ");
	return getDb()
		.prepare(
			`SELECT unit_id AS unitId, owner_id AS ownerId, start_date AS startDate, end_date AS endDate
			 FROM unit_ownerships
			 WHERE unit_id IN (${placeholders})`
		)
		.all(...unitIds) as UnitOwnershipPeriod[];
}

/**
 * Eine anzulegende Hausgeld-Sollstellung. Die fachliche Ermittlung (welcher
 * Eigentümer in welchem Monat, welcher Betrag aus dem eingefrorenen
 * Einzelwirtschaftsplan) erfolgt in der Server Action; das Repository
 * übernimmt die Duplikatprüfung und das atomare Anlegen (Muster wie
 * generateDueTransactions in src/data/transactions.ts).
 */
export interface DueHousingChargeCandidate {
	unitId: string;
	/** Snapshot des Eigentümers zum Stellungs-Zeitpunkt (siehe housing_charges-Kommentar in src/data/types.ts). */
	ownerId: string;
	economicPlanId: string;
	amount: string;
	/** Fälligkeitsdatum (ISO-8601). */
	dueDate: string;
	purpose: string;
	/** Monatsgrenzen (ISO-8601, [monthStart, monthEnd)) für die Duplikatprüfung. */
	monthStart: string;
	monthEnd: string;
}

/**
 * Legt die übergebenen Hausgeld-Sollstellungen an, sofern für dieselbe
 * Einheit im jeweiligen Monat noch keine Sollstellung existiert.
 * Duplikatprüfung und Inserts laufen in einer better-sqlite3-Transaktion
 * (atomar).
 */
export function generateHousingCharges(candidates: DueHousingChargeCandidate[]): { created: number; skipped: number } {
	const db = getDb();
	const existsStmt = db.prepare("SELECT id FROM housing_charges WHERE unit_id = ? AND due_date >= ? AND due_date < ? LIMIT 1");
	const insertStmt = db.prepare(
		`INSERT INTO housing_charges (id, unit_id, owner_id, economic_plan_id, amount, due_date, paid_date, purpose, status, created_at, updated_at)
		 VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 'OPEN', ?, ?)`
	);

	let created = 0;
	let skipped = 0;
	db.transaction(() => {
		for (const candidate of candidates) {
			if (existsStmt.get(candidate.unitId, candidate.monthStart, candidate.monthEnd)) {
				skipped += 1;
				continue;
			}
			const timestamp = now();
			insertStmt.run(newId(), candidate.unitId, candidate.ownerId, candidate.economicPlanId, candidate.amount, candidate.dueDate, candidate.purpose, timestamp, timestamp);
			created += 1;
		}
	})();
	return { created, skipped };
}
