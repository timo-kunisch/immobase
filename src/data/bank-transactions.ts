import { getDb } from "./db";
import { newId, now } from "./helpers";
import { getAccount } from "./accounts";
import type { Account, BankTransaction, BankTransactionAllocation, BankTransactionStatus } from "./types";

/**
 * Repository für die Buchhaltung (Tabellen `bank_transactions` +
 * `bank_transaction_allocations`): Tatsächliche Bewegungen auf dem
 * Bankkonto einer Liegenschaft sowie ihre Buchungszeilen - die Zuordnung
 * eines Teilbetrags entweder auf ein Konto (accountId, z. B.
 * "Gebäudeversicherung") oder gegen eine fällige Sollstellung
 * (transactionId, "Mieteingänge"). Genau eines von beiden ist je Zeile
 * gesetzt (anwendungsseitig geprüft).
 *
 * Der Zuordnungsstatus einer Banktransaktion (OPEN/PARTIAL/RECONCILED)
 * wird nicht gespeichert, sondern aus der Summe der Buchungszeilen
 * berechnet. Der Bezahl-Status einer Sollstellung wird aus den
 * Buchungszeilen ABGELEITET und gepflegt (recomputeTransactionStatus):
 * Vollständig zugeordnet = bezahlt (PAID inkl. paid_date aus dem
 * Buchungsdatum) - damit berücksichtigt die Nebenkostenabrechnung nur
 * tatsächlich geleistete Vorauszahlungen (computePaidPrepaymentsCents in
 * src/lib/billing.ts).
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

/** Eine zu setztende Buchungszeile: genau EINES von accountId/transactionId ist gesetzt. */
export interface BankTransactionAllocationInput {
	accountId: string | null;
	transactionId: string | null;
	/** Signed wie die zugeordnete Banktransaktion (Teilbetrag, Decimal-String). */
	amount: string;
}

/** Buchungszeile inkl. aufgelöster Anzeige-Referenzen (Konto bzw. Sollstellung). */
export interface BankTransactionAllocationView extends BankTransactionAllocation {
	account: Account | null;
	/** Anzeige-Bezeichnung des Zuordnungsziels (Kontobezeichnung oder Sollstellung). */
	transactionLabel: string | null;
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

/**
 * Lädt die Buchungszeilen der übergebenen Banktransaktionen in EINEM Zug
 * (Batch) inkl. aufgelöster Anzeige-Referenzen (Konto-Bezeichnung bzw.
 * Sollstellungs-Beschreibung mit Mieter) - kein N+1.
 */
function loadAllocationViews(bankTransactionIds: string[]): Map<string, BankTransactionAllocationView[]> {
	const viewsByBankTransaction = new Map<string, BankTransactionAllocationView[]>();
	if (bankTransactionIds.length === 0) return viewsByBankTransaction;

	const db = getDb();
	const placeholders = bankTransactionIds.map(() => "?").join(", ");
	const allocations = db
		.prepare(
			`SELECT id, bank_transaction_id AS bankTransactionId, account_id AS accountId,
			 		transaction_id AS transactionId, amount, created_at AS createdAt, updated_at AS updatedAt
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

	for (const allocation of allocations) {
		const account = allocation.accountId ? accountsById.get(allocation.accountId) ?? null : null;
		let transactionLabel: string | null = null;
		if (allocation.transactionId) {
			const info = infoById.get(allocation.transactionId);
			if (info) {
				transactionLabel = `${info.purpose ?? "Sollstellung"} · ${info.firstName} ${info.lastName} (${info.amount} €)`;
			}
		}
		const view: BankTransactionAllocationView = { ...allocation, account, transactionLabel };
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
 * CASCADE mitentfernt. Die davon betroffenen Sollstellungen werden danach
 * neu bewertet (vollständig zugeordnete verlieren den bezahlt-Status).
 */
export function deleteBankTransaction(id: string): void {
	const affectedTransactionIds = (
		getDb()
			.prepare("SELECT DISTINCT transaction_id AS transactionId FROM bank_transaction_allocations WHERE bank_transaction_id = ? AND transaction_id IS NOT NULL")
			.all(id) as { transactionId: string }[]
	).map((row) => row.transactionId);
	getDb().prepare("DELETE FROM bank_transactions WHERE id = ?").run(id);
	recomputeTransactionStatuses(affectedTransactionIds);
}

/**
 * Ersetzt SÄMTLICHE Buchungszeilen einer Banktransaktion durch die
 * übergebenen (leere Liste = Zuordnung entfernen). Läuft in EINER
 * better-sqlite3-Transaktion; danach werden alle betroffenen Sollstellungen
 * (alte wie neue) neu bewertet. Die fachlichen Prüfungen (Referenzen,
 * gleiche Liegenschaft, kein Storno, Vorzeichen, Summe) liegen in der
 * aufrufenden Schicht (Server Action + MCP-Werkzeug, identisch).
 */
export function setBankTransactionAllocations(bankTransactionId: string, allocations: BankTransactionAllocationInput[]): void {
	const db = getDb();
	const timestamp = now();

	const oldTransactionIds = (
		db
			.prepare("SELECT DISTINCT transaction_id AS transactionId FROM bank_transaction_allocations WHERE bank_transaction_id = ? AND transaction_id IS NOT NULL")
			.all(bankTransactionId) as { transactionId: string }[]
	).map((row) => row.transactionId);

	db.transaction(() => {
		db.prepare("DELETE FROM bank_transaction_allocations WHERE bank_transaction_id = ?").run(bankTransactionId);
		const insert = db.prepare(
			`INSERT INTO bank_transaction_allocations (id, bank_transaction_id, account_id, transaction_id, amount, created_at, updated_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?)`
		);
		for (const allocation of allocations) {
			insert.run(newId(), bankTransactionId, allocation.accountId, allocation.transactionId, allocation.amount, timestamp, timestamp);
		}
	})();

	recomputeTransactionStatuses([...new Set([...oldTransactionIds, ...allocations.map((a) => a.transactionId).filter((id): id is string => id !== null)])]);
}

/**
 * Bewertet den Bezahl-Status der übergebenen Sollstellungen anhand ihrer
 * Buchungszeilen NEU (wird nach jeder Änderung von Buchungszeilen
 * aufgerufen):
 * - vollständig zugeordnet (Betragssumme >= Sollbetrag): Status PAID,
 *   paid_date = frühestes Buchungsdatum der zugeordneten Banktransaktionen
 *   (überschreibt auch einen manuell gesetzten PAID-Status, siehe
 *   /finanzen).
 * - gar nicht zugeordnet: Status OPEN, paid_date = null. Ein manuell
 *   (über /finanzen) auf PAID gesetzter Status bleibt dabei unberührt -
 *   nur Sollstellungen, die Buchungszeilen HATTEN, werden überhaupt
 *   neubewertet.
 * - teilweise zugeordnet (0 < Summe < Sollbetrag): Status unverändert -
 *   Teilzahlungen werden im Zahlungsmodell nicht abgebildet; die
 *   teilweise Zuordnung ist als Arbeitsstand sichtbar, der Rest kann
 *   nachträglich zugeordnet oder die Sollstellung manuell als bezahlt
 *   markiert werden.
 * Stornierte (CANCELLED) Sollstellungen werden nie angefasst.
 */
function recomputeTransactionStatuses(transactionIds: string[]): void {
	const db = getDb();
	const uniqueIds = [...new Set(transactionIds)];
	if (uniqueIds.length === 0) return;

	for (const transactionId of uniqueIds) {
		const transaction = db
			.prepare("SELECT id, amount, status, paid_date AS paidDate FROM transactions WHERE id = ?")
			.get(transactionId) as { id: string; amount: string; status: string; paidDate: string | null } | undefined;
		if (!transaction || transaction.status === "CANCELLED") continue;

		const amounts = db
			.prepare("SELECT amount FROM bank_transaction_allocations WHERE transaction_id = ?")
			.all(transactionId) as { amount: string }[];
		const allocatedCents = amounts.reduce((sum, row) => sum + Math.round(Number(row.amount) * 100), 0);
		const targetCents = Math.round(Number(transaction.amount) * 100);

		if (allocatedCents >= targetCents) {
			const earliest = db
				.prepare(
					`SELECT MIN(bt.booking_date) AS earliest FROM bank_transaction_allocations a
					 JOIN bank_transactions bt ON bt.id = a.bank_transaction_id WHERE a.transaction_id = ?`
				)
				.get(transactionId) as { earliest: string | null };
			db.prepare("UPDATE transactions SET status = 'PAID', paid_date = ?, updated_at = ? WHERE id = ?").run(
				earliest?.earliest ?? now(),
				now(),
				transactionId
			);
		} else if (allocatedCents === 0) {
			db.prepare("UPDATE transactions SET status = 'OPEN', paid_date = NULL, updated_at = ? WHERE id = ?").run(now(), transactionId);
		}
	}
}
