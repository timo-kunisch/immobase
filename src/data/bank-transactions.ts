import { getDb } from "./db";
import { newId, now } from "./helpers";
import { getAccount } from "./accounts";
import type { Account, BankTransaction, BankTransactionAllocation, BankTransactionStatus } from "./types";

/**
 * Repository für die Buchhaltung (Tabellen `bank_transactions` +
 * `bank_transaction_allocations`): Tatsächliche Bewegungen auf dem Bankkonto
 * einer Liegenschaft sowie ihre Buchungszeilen - die Zuordnung eines
 * Teilbetrags entweder auf ein Konto (accountId, z. B. "Gebäudeversicherung"),
 * gegen eine fällige Miet-Sollstellung (transactionId, "Mieteingänge") oder
 * gegen eine Hausgeld-Sollstellung (housingChargeId, WEG-Verwaltung). Genau
 * eines der drei ist je Zeile gesetzt (anwendungsseitig geprüft); die
 * Buchungskreise Miete und WEG berühren sich nie - dieselbe Liegenschaft
 * kann beides gleichzeitig führen, ohne dass Buchungen des einen Kreises den
 * Bezahl-Status des anderen verändern.
 *
 * Der Zuordnungsstatus einer Banktransaktion (OPEN/PARTIAL/RECONCILED)
 * wird nicht gespeichert, sondern aus der Summe der Buchungszeilen
 * berechnet. Der Bezahl-Status einer Sollstellung (Miete ODER Hausgeld)
 * wird aus den Buchungszeilen ABGELEITET und gepflegt
 * (recomputeDueItemStatuses): Vollständig zugeordnet = bezahlt (PAID inkl.
 * paid_date aus dem Buchungsdatum) - damit berücksichtigen sowohl die
 * Nebenkostenabrechnung als auch die WEG-Jahresabrechnung ausschließlich
 * tatsächlich geleistete Vorauszahlungen.
 *
 * Zusammenhängende Mehr-Schreib-Operationen (Zuordnung ersetzen, Löschen)
 * laufen in echten better-sqlite3-Transaktionen (atomar).
 */

/** Teilbetrags-Summe einer Banktransaktion aus ihren Buchungszeilen (Subselect). */
const ALLOCATED_AMOUNT_SQ = `(SELECT COALESCE(SUM(a.amount), 0) FROM bank_transaction_allocations a WHERE a.bank_transaction_id = bt.id)`;

export interface BankTransactionInput {
	propertyId: string;
	bookingDate: string;
	/** Signed Decimal-String: positiv = Eingang (Gutschrift), negativ = Ausgang (Belastung). */
	amount: string;
	description: string;
	/** Zahlungspartner laut Kontoauszug (z. B. Mieter, Versicherung). */
	partner: string | null;
	notes: string | null;
}

/**
 * Eine zu setztende Buchungszeile: genau EINES von accountId/transactionId/
 * housingChargeId ist gesetzt (Konto, Miet-Sollstellung oder Hausgeld-
 * Sollstellung).
 */
export interface BankTransactionAllocationInput {
	accountId: string | null;
	transactionId: string | null;
	housingChargeId: string | null;
	/** Signed wie die zugeordnete Banktransaktion (Teilbetrag, Decimal-String). */
	amount: string;
}

/** Buchungszeile inkl. aufgelöster Anzeige-Referenzen (Konto bzw. Sollstellung). */
export interface BankTransactionAllocationView extends BankTransactionAllocation {
	account: Account | null;
	/** Anzeige-Bezeichnung des Zuordnungsziels (Kontobezeichnung oder Sollstellung). */
	transactionLabel: string | null;
	/** Anzeige-Bezeichnung des Zuordnungsziels im Buchungskreis WEG (Hausgeld-Sollstellung). */
	housingChargeLabel: string | null;
}

/** Banktransaktion inkl. Buchungszeilen und abgeleiteter Zuordnungs-Summe. */
export interface BankTransactionWithAllocations extends BankTransaction {
	allocations: BankTransactionAllocationView[];
	/** Summe der zugeordneten Teilbeträge (signed, Decimal-String). */
	allocatedAmount: string;
	/** Abgeleiteter Zuordnungsstatus aus allocatedAmount vs. amount. */
	status: BankTransactionStatus;
}

export interface BankTransactionFilter {
	propertyId?: string;
	/** Mehrere Liegenschaften (z. B. alle WEGs der WEG-Buchhaltung, /weg/buchhaltung). */
	propertyIds?: string[];
	status?: BankTransactionStatus;
}

function deriveStatus(amount: string, allocatedAmount: string): BankTransactionStatus {
	const amountAbs = Math.abs(Number(amount));
	const allocatedAbs = Math.abs(Number(allocatedAmount));
	if (allocatedAbs >= amountAbs && amountAbs > 0) return "RECONCILED";
	if (allocatedAbs > 0) return "PARTIAL";
	return "OPEN";
}

/** Kompakte Anzeige-Infos einer Sollstellung (für die Zuordnungs-Ansicht). */
interface TransactionInfoRow {
	id: string;
	purpose: string | null;
	amount: string;
	dueDate: string;
	firstName: string;
	lastName: string;
}

/** Kompakte Anzeige-Infos einer Hausgeld-Sollstellung (für die Zuordnungs-Ansicht). */
interface HousingChargeInfoRow {
	id: string;
	purpose: string | null;
	amount: string;
	dueDate: string;
	firstName: string;
	lastName: string;
}

/**
 * Lädt die Buchungszeilen der übergebenen Banktransaktionen in EINEM Zug
 * (Batch) inkl. aufgelöster Anzeige-Referenzen (Konto-Bezeichnung, Miet-
 * bzw. Hausgeld-Sollstellungs-Beschreibung mit Eigentümer/Mieter) - kein N+1.
 */
function loadAllocationViews(bankTransactionIds: string[]): Map<string, BankTransactionAllocationView[]> {
	const viewsByBankTransaction = new Map<string, BankTransactionAllocationView[]>();
	if (bankTransactionIds.length === 0) return viewsByBankTransaction;

	const db = getDb();
	const placeholders = bankTransactionIds.map(() => "?").join(", ");
	const allocations = db
		.prepare(
			`SELECT id, bank_transaction_id AS bankTransactionId, account_id AS accountId,
			 		transaction_id AS transactionId, housing_charge_id AS housingChargeId, amount,
			 		created_at AS createdAt, updated_at AS updatedAt
			 FROM bank_transaction_allocations WHERE bank_transaction_id IN (${placeholders}) ORDER BY created_at`
		)
		.all(...bankTransactionIds) as BankTransactionAllocation[];

	const accountIds = [...new Set(allocations.map((a) => a.accountId).filter((id): id is string => id !== null))];
	const accountsById = new Map(
		accountIds
			.map((id) => getAccount(id))
			.filter((account): account is Account => account !== null)
			.map((account) => [account.id, account])
	);

	const transactionIds = [...new Set(allocations.map((a) => a.transactionId).filter((id): id is string => id !== null))];
	const transactionInfos = transactionIds.length
		? (db
				.prepare(
					`SELECT tr.id, tr.purpose, tr.amount, tr.due_date AS dueDate,
						 	 tenant.first_name AS firstName, tenant.last_name AS lastName
					 FROM transactions tr
					 JOIN leases l ON l.id = tr.lease_id
					 JOIN tenants tenant ON tenant.id = l.tenant_id
					 WHERE tr.id IN (${transactionIds.map(() => "?").join(", ")})`
				)
				.all(...transactionIds) as TransactionInfoRow[])
		: [];
	const infoById = new Map(transactionInfos.map((info) => [info.id, info]));

	const housingChargeIds = [...new Set(allocations.map((a) => a.housingChargeId).filter((id): id is string => id !== null))];
	const housingChargeInfos = housingChargeIds.length
		? (db
				.prepare(
					`SELECT hc.id, hc.purpose, hc.amount, hc.due_date AS dueDate,
						 	 owner.first_name AS firstName, owner.last_name AS lastName
					 FROM housing_charges hc
					 JOIN owners owner ON owner.id = hc.owner_id
					 WHERE hc.id IN (${housingChargeIds.map(() => "?").join(", ")})`
				)
				.all(...housingChargeIds) as HousingChargeInfoRow[])
		: [];
	const housingChargeInfoById = new Map(housingChargeInfos.map((info) => [info.id, info]));

	for (const allocation of allocations) {
		const account = allocation.accountId ? accountsById.get(allocation.accountId) ?? null : null;
		let transactionLabel: string | null = null;
		if (allocation.transactionId) {
			const info = infoById.get(allocation.transactionId);
			if (info) {
				transactionLabel = `${info.purpose ?? "Sollstellung"} · ${info.firstName} ${info.lastName} (${info.amount} €)`;
			}
		}
		let housingChargeLabel: string | null = null;
		if (allocation.housingChargeId) {
			const info = housingChargeInfoById.get(allocation.housingChargeId);
			if (info) {
				housingChargeLabel = `${info.purpose ?? "Hausgeld"} · ${info.firstName} ${info.lastName} (${info.amount} €)`;
			}
		}
		const view: BankTransactionAllocationView = { ...allocation, account, transactionLabel, housingChargeLabel };
		const list = viewsByBankTransaction.get(allocation.bankTransactionId) ?? [];
		list.push(view);
		viewsByBankTransaction.set(allocation.bankTransactionId, list);
	}
	return viewsByBankTransaction;
}

/** Listet Banktransaktionen (neueste Buchung zuerst) inkl. Buchungszeilen und abgeleiteter Zuordnungs-Summe. */
export function listBankTransactions(filter: BankTransactionFilter = {}): BankTransactionWithAllocations[] {
	const conditions: string[] = [];
	const params: string[] = [];
	if (filter.propertyId) {
		conditions.push("bt.property_id = ?");
		params.push(filter.propertyId);
	} else if (filter.propertyIds && filter.propertyIds.length > 0) {
		conditions.push(`bt.property_id IN (${filter.propertyIds.map(() => "?").join(", ")})`);
		params.push(...filter.propertyIds);
	}
	if (filter.status) {
		// Abgeleiteter Status per Teilbetrags-Summe (Subselect) filterbar.
		if (filter.status === "OPEN") {
			conditions.push(`${ALLOCATED_AMOUNT_SQ} = 0`);
		} else if (filter.status === "RECONCILED") {
			conditions.push(`ABS(${ALLOCATED_AMOUNT_SQ}) >= ABS(bt.amount) AND ABS(bt.amount) > 0`);
		} else {
			conditions.push(`ABS(${ALLOCATED_AMOUNT_SQ}) > 0 AND ABS(${ALLOCATED_AMOUNT_SQ}) < ABS(bt.amount)`);
		}
	}
	const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
	const rows = getDb()
		.prepare(
			`SELECT bt.id, bt.property_id AS propertyId, bt.booking_date AS bookingDate, bt.amount,
					bt.description, bt.partner, bt.notes, bt.created_at AS createdAt, bt.updated_at AS updatedAt,
					COALESCE(${ALLOCATED_AMOUNT_SQ}, 0) AS allocatedAmountRaw
			 FROM bank_transactions bt
			 ${where}
			 ORDER BY bt.booking_date DESC, bt.id DESC`
		)
		.all(...params) as (Omit<BankTransaction, "id"> & { id: string; allocatedAmountRaw: number })[];
	const viewsByBankTransaction = loadAllocationViews(rows.map((row) => row.id));
	return rows.map((row) => ({
		...row,
		allocatedAmount: row.allocatedAmountRaw.toFixed(2),
		status: deriveStatus(row.amount, String(row.allocatedAmountRaw)),
		allocations: viewsByBankTransaction.get(row.id) ?? [],
	}));
}

/** Zählt Banktransaktionen (gleicher Filter wie listBankTransactions) - Grundlage der Seitennummerierung. */
export function countBankTransactions(filter: BankTransactionFilter = {}): number {
	// Offene Implementierung über listBankTransactions (Subselect je Zeile),
	// Filter-Logik dadurch exakt identisch zur Listen-Funktion.
	return listBankTransactions(filter).length;
}

/**
 * Seitenweise Variante von listBankTransactions (LIMIT/OFFSET) für die
 * paginierte Buchhaltungs-Übersicht (/buchhaltung, 50/Seite).
 */
export function listBankTransactionsPage(
	filter: BankTransactionFilter = {},
	page: { limit: number; offset: number }
): BankTransactionWithAllocations[] {
	const all = listBankTransactions(filter);
	return all.slice(page.offset, page.offset + page.limit);
}

/** Einzelne Banktransaktion inkl. aufgelöster Buchungszeilen. */
export function getBankTransaction(id: string): BankTransactionWithAllocations | null {
	const row = getDb()
		.prepare(
			`SELECT bt.id, bt.property_id AS propertyId, bt.booking_date AS bookingDate, bt.amount,
					bt.description, bt.partner, bt.notes, bt.created_at AS createdAt, bt.updated_at AS updatedAt,
					COALESCE(${ALLOCATED_AMOUNT_SQ}, 0) AS allocatedAmountRaw
			 FROM bank_transactions bt WHERE bt.id = ?`
		)
		.get(id) as (Omit<BankTransaction, "id"> & { id: string; allocatedAmountRaw: number }) | undefined;
	if (!row) return null;
	return {
		...row,
		allocatedAmount: row.allocatedAmountRaw.toFixed(2),
		status: deriveStatus(row.amount, String(row.allocatedAmountRaw)),
		allocations: loadAllocationViews([id]).get(id) ?? [],
	};
}

export function createBankTransaction(input: BankTransactionInput): BankTransaction {
	const id = newId();
	const timestamp = now();
	getDb()
		.prepare(
			`INSERT INTO bank_transactions (id, property_id, booking_date, amount, description, partner, notes, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
		)
		.run(id, input.propertyId, input.bookingDate, input.amount, input.description, input.partner, input.notes, timestamp, timestamp);
	return { id, ...input, createdAt: timestamp, updatedAt: timestamp };
}

/** Aktualisiert die Stammfelder (Buchungszeilen bleiben unberührt - siehe setBankTransactionAllocations). */
export function updateBankTransaction(id: string, input: BankTransactionInput): void {
	getDb()
		.prepare(
			`UPDATE bank_transactions
			 SET property_id = ?, booking_date = ?, amount = ?, description = ?, partner = ?, notes = ?, updated_at = ?
			 WHERE id = ?`
		)
		.run(input.propertyId, input.bookingDate, input.amount, input.description, input.partner, input.notes, now(), id);
}

/**
 * Löscht eine Banktransaktion; ihre Buchungszeilen werden per ON DELETE
 * CASCADE mitentfernt. Die davon betroffenen Sollstellungen beider
 * Buchungskreise (Miete UND Hausgeld) werden danach neu bewertet
 * (vollständig zugeordnete verlieren den bezahlt-Status).
 */
export function deleteBankTransaction(id: string): void {
	const affected = listAffectedDueItemIds(id);
	getDb().prepare("DELETE FROM bank_transactions WHERE id = ?").run(id);
	recomputeDueItemStatuses(affected);
}

/** IDs aller über Buchungszeilen dieser Banktransaktion angebundenen Sollstellungen (Miete + Hausgeld). */
function listAffectedDueItemIds(bankTransactionId: string): { transactionIds: string[]; housingChargeIds: string[] } {
	const rows = getDb()
		.prepare(
			`SELECT transaction_id AS transactionId, housing_charge_id AS housingChargeId
			 FROM bank_transaction_allocations WHERE bank_transaction_id = ?`
		)
		.all(bankTransactionId) as { transactionId: string | null; housingChargeId: string | null }[];
	return {
		transactionIds: rows.map((row) => row.transactionId).filter((id): id is string => id !== null),
		housingChargeIds: rows.map((row) => row.housingChargeId).filter((id): id is string => id !== null),
	};
}

/**
 * Ersetzt SÄMTLICHE Buchungszeilen einer Banktransaktion durch die
 * übergebenen (leere Liste = Zuordnung entfernen). Läuft in EINER
 * better-sqlite3-Transaktion; danach werden alle betroffenen Sollstellungen
 * beider Buchungskreise (alte wie neue) neu bewertet. Die fachlichen
 * Prüfungen (Referenzen, gleiche Liegenschaft, kein Storno, Vorzeichen,
 * Summe) liegen in der aufrufenden Schicht (Server Action + MCP-Werkzeug,
 * identisch über src/lib/bank-allocations.ts).
 */
export function setBankTransactionAllocations(bankTransactionId: string, allocations: BankTransactionAllocationInput[]): void {
	const db = getDb();
	const timestamp = now();

	const oldAffected = listAffectedDueItemIds(bankTransactionId);

	db.transaction(() => {
		db.prepare("DELETE FROM bank_transaction_allocations WHERE bank_transaction_id = ?").run(bankTransactionId);
		const insert = db.prepare(
			`INSERT INTO bank_transaction_allocations (id, bank_transaction_id, account_id, transaction_id, housing_charge_id, amount, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
		);
		for (const allocation of allocations) {
			insert.run(newId(), bankTransactionId, allocation.accountId, allocation.transactionId, allocation.housingChargeId, allocation.amount, timestamp, timestamp);
		}
	})();

	recomputeDueItemStatuses({
		transactionIds: [...oldAffected.transactionIds, ...allocations.map((a) => a.transactionId).filter((id): id is string => id !== null)],
		housingChargeIds: [...oldAffected.housingChargeIds, ...allocations.map((a) => a.housingChargeId).filter((id): id is string => id !== null)],
	});
}

/**
 * Bewertet den Bezahl-Status der übergebenen Sollstellungen anhand ihrer
 * Buchungszeilen NEU (wird nach jeder Änderung von Buchungszeilen
 * aufgerufen) - einmalig implementiert und identisch verwendet für BEIDE
 * Buchungskreise, deren Tabellen (`transactions` der Mietverwaltung und
 * `housing_charges` der WEG-Verwaltung) den gleichen Spaltenaufbau haben
 * (id, amount, status, paid_date):
 * - vollständig zugeordnet (Betragssumme >= Sollbetrag): Status PAID,
 *   paid_date = frühestes Buchungsdatum der zugeordneten Banktransaktionen
 *   (überschreibt auch einen manuell gesetzten PAID-Status, siehe
 *   /finanzen bzw. /weg/hausgeld).
 * - gar nicht zugeordnet: Status OPEN, paid_date = null. Ein manuell
 *   auf PAID gesetzter Status bleibt dabei unberührt - nur Sollstellungen,
 *   die Buchungszeilen HATTEN, werden überhaupt neubewertet.
 * - teilweise zugeordnet (0 < Summe < Sollbetrag): Status unverändert -
 *   Teilzahlungen werden im Zahlungsmodell nicht abgebildet; die
 *   teilweise Zuordnung ist als Arbeitsstand sichtbar, der Rest kann
 *   nachträglich zugeordnet oder die Sollstellung manuell als bezahlt
 *   markiert werden.
 * Stornierte (CANCELLED) Sollstellungen werden nie angefasst.
 */
function recomputeDueItemStatuses(affected: { transactionIds: string[]; housingChargeIds: string[] }): void {
	const db = getDb();

	const recompute = (tableName: "transactions" | "housing_charges", dueItemIds: string[]): void => {
		const uniqueIds = [...new Set(dueItemIds)];
		if (uniqueIds.length === 0) return;

		// Die Spalte der Buchungszeilen hängt vom Buchungskreis ab - beide
		// Kreis-Tabellen werden über ihre eigene Spalte verknüpft.
		const allocationColumn = tableName === "transactions" ? "transaction_id" : "housing_charge_id";

		for (const dueItemId of uniqueIds) {
			const dueItem = db
				.prepare(`SELECT id, amount, status, paid_date AS paidDate FROM ${tableName} WHERE id = ?`)
				.get(dueItemId) as { id: string; amount: string; status: string; paidDate: string | null } | undefined;
			if (!dueItem || dueItem.status === "CANCELLED") continue;

			const allocationAmounts = db
				.prepare(`SELECT amount FROM bank_transaction_allocations WHERE ${allocationColumn} = ?`)
				.all(dueItemId) as { amount: string }[];
			const allocatedCents = allocationAmounts.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
			const targetCents = Math.round(Number(dueItem.amount) * 100);

			if (allocatedCents >= targetCents) {
				const earliest = db
					.prepare(
						`SELECT MIN(bt.booking_date) AS earliest FROM bank_transaction_allocations a
						 JOIN bank_transactions bt ON bt.id = a.bank_transaction_id WHERE a.${allocationColumn} = ?`
					)
					.get(dueItemId) as { earliest: string | null };
				db.prepare(`UPDATE ${tableName} SET status = 'PAID', paid_date = ?, updated_at = ? WHERE id = ?`).run(
					earliest?.earliest ?? now(),
					now(),
					dueItemId
				);
			} else if (allocatedCents === 0) {
				db.prepare(`UPDATE ${tableName} SET status = 'OPEN', paid_date = NULL, updated_at = ? WHERE id = ?`).run(now(), dueItemId);
			}
		}
	};

	recompute("transactions", affected.transactionIds);
	recompute("housing_charges", affected.housingChargeIds);
}
