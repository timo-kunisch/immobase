"use server";

import { revalidatePath } from "next/cache";

import { getDepositByLeaseId, upsertDepositForLease } from "@/data/deposits";
import { getLeaseWithDetails, listLeasesWithRentAdjustments, type LeaseWithDetails } from "@/data/leases";
import {
	createTransaction,
	deleteTransaction,
	generateDueTransactions,
	getTransaction,
	markTransactionPaid,
	updateTransaction,
	type DueTransactionCandidate,
} from "@/data/transactions";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { getT } from "@/lib/i18n/server";
import { ActionState } from "@/lib/action-state";
import { formatCurrency, formatDate } from "@/lib/format";
import { getTotalRentForDate } from "@/lib/rent-history";
import type { DepositStatus, DepositType, TransactionStatus } from "@/data/types";

const MONTH_NAMES = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

const DEPOSIT_TYPES: DepositType[] = ["CASH", "BANK_GUARANTEE", "BLOCKED_ACCOUNT"];
const DEPOSIT_STATUSES: DepositStatus[] = ["PENDING", "RECEIVED", "PARTIALLY_REFUNDED", "REFUNDED"];
const TRANSACTION_STATUSES: TransactionStatus[] = ["OPEN", "PAID", "OVERDUE", "CANCELLED"];

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

function getDecimalString(formData: FormData, key: string): string | null {
	const raw = getString(formData, key).replace(",", ".");
	if (!raw) return null;
	const parsed = Number(raw);
	return Number.isNaN(parsed) ? null : parsed.toFixed(2);
}

/** Sprechende Bezeichnung eines Mietvertrags für das Aktivitätsprotokoll (Liegenschaft – Einheit / Mieter). */
function describeLease(lease: LeaseWithDetails | null, fallback: string): string {
	if (!lease) return fallback;
	return `${lease.unit.property.name} – ${lease.unit.label} / ${lease.tenant.firstName} ${lease.tenant.lastName}`;
}

/** Bezeichnung einer Zahlung für das Aktivitätsprotokoll (Verwendungszweck, sonst Betrag/Fälligkeit). */
function describeTransaction(transaction: { amount: string; dueDate: string; purpose: string | null }): string {
	return transaction.purpose ?? `${formatCurrency(transaction.amount)} fällig am ${formatDate(transaction.dueDate)}`;
}

// ============================================================
// Kautionskonten (Deposit)
// ============================================================

export async function saveDepositAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const leaseId = getString(formData, "leaseId");
	const typeRaw = getString(formData, "type") as DepositType;
	const statusRaw = getString(formData, "status") as DepositStatus;
	const amount = getDecimalString(formData, "amount");
	const receivedDateRaw = getString(formData, "receivedDate");
	const refundedDateRaw = getString(formData, "refundedDate");
	const refundedAmount = getDecimalString(formData, "refundedAmount");
	const notes = getString(formData, "notes");

	if (!leaseId || amount === null) {
		return { error: t("finances.errors.leaseAndAmountRequired") };
	}

	const type: DepositType = DEPOSIT_TYPES.includes(typeRaw) ? typeRaw : "CASH";
	const status: DepositStatus = DEPOSIT_STATUSES.includes(statusRaw) ? statusRaw : "PENDING";

	const data = {
		leaseId,
		type,
		status,
		amount,
		receivedDate: receivedDateRaw ? new Date(receivedDateRaw).toISOString() : null,
		refundedDate: refundedDateRaw ? new Date(refundedDateRaw).toISOString() : null,
		refundedAmount,
		notes: notes || null,
	};

	// Vor dem Upsert prüfen, ob bereits ein Kautionskonto existiert (für die
	// CREATE/UPDATE-Unterscheidung im Aktivitätsprotokoll), und die Bezeichnung
	// des zugehörigen Mietvertrags für den Log-Eintrag ermitteln.
	const existing = getDepositByLeaseId(leaseId);
	const leaseDetails = getLeaseWithDetails(leaseId);

	try {
		const deposit = upsertDepositForLease(data);
		logActivity(
			user,
			existing ? "UPDATE" : "CREATE",
			"finanzen",
			`Kautionskonto zum Mietvertrag „${describeLease(leaseDetails, leaseId)}“ ${existing ? "bearbeitet" : "angelegt"}`,
			deposit.id
		);
	} catch (error) {
		console.error("saveDepositAction failed", error);
		return { error: t("finances.errors.depositSaveFailed") };
	}

	revalidatePath("/finanzen");
	revalidatePath("/");
	return { success: true };
}

// ============================================================
// Mieteingänge (Transaction)
// ============================================================

export async function saveTransactionAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const leaseId = getString(formData, "leaseId");
	const dueDateRaw = getString(formData, "dueDate");
	const purpose = getString(formData, "purpose");
	const statusRaw = getString(formData, "status") as TransactionStatus;
	const amount = getDecimalString(formData, "amount");

	if (!leaseId || !dueDateRaw || amount === null) {
		return {
			error: t("finances.errors.leaseDueDateAmountRequired"),
		};
	}

	const status: TransactionStatus = TRANSACTION_STATUSES.includes(statusRaw) ? statusRaw : "OPEN";

	const data = {
		leaseId,
		amount,
		dueDate: new Date(dueDateRaw).toISOString(),
		purpose: purpose || null,
		status,
		paidDate: status === "PAID" ? new Date().toISOString() : null,
	};

	try {
		if (id) {
			updateTransaction(id, data);
			logActivity(user, "UPDATE", "finanzen", `Zahlung „${describeTransaction(data)}“ bearbeitet`, id);
		} else {
			const transaction = createTransaction(data);
			logActivity(user, "CREATE", "finanzen", `Zahlung „${describeTransaction(data)}“ angelegt`, transaction.id);
		}
	} catch (error) {
		console.error("saveTransactionAction failed", error);
		return { error: t("finances.errors.transactionSaveFailed") };
	}

	revalidatePath("/finanzen");
	revalidatePath("/");
	return { success: true };
}

/** Schnellaktion: Zahlung direkt aus der Tabelle als "bezahlt" markieren. */
export async function markTransactionPaidAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	// Bezeichnung für den Log-Eintrag ermitteln.
	const transaction = getTransaction(id);
	try {
		markTransactionPaid(id);
	} catch (error) {
		console.error("markTransactionPaidAction failed", error);
		return { error: t("finances.errors.markPaidFailed") };
	}

	logActivity(user, "UPDATE", "finanzen", `Zahlung „${transaction ? describeTransaction(transaction) : id}“ als bezahlt markiert`, id);

	revalidatePath("/finanzen");
	revalidatePath("/");
	return { success: true };
}

/**
 * Stellt für einen definierten Zeitraum automatisch die Mietzahlungen (Kaltmiete +
 * Nebenkosten) für alle aktiven Mietverträge fällig. Für jeden Monat im Zeitraum wird
 * pro aktivem Vertrag (sofern der Vertrag in diesem Monat läuft) eine offene Zahlung
 * angelegt - es sei denn, für diesen Vertrag existiert für den jeweiligen Monat
 * bereits eine Zahlung (Duplikate werden übersprungen, damit der Button beliebig oft
 * gefahrlos ausgeführt werden kann).
 */
export async function generateDueTransactionsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const fromMonthRaw = getString(formData, "fromMonth"); // Format: YYYY-MM
	const toMonthRaw = getString(formData, "toMonth"); // Format: YYYY-MM
	const dueDayRaw = getString(formData, "dueDay");

	const fromMatch = /^(\d{4})-(\d{2})$/.exec(fromMonthRaw);
	const toMatch = /^(\d{4})-(\d{2})$/.exec(toMonthRaw);

	if (!fromMatch || !toMatch) {
		return { error: t("finances.errors.invalidPeriod") };
	}

	const dueDay = Number(dueDayRaw);
	if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
		return { error: t("finances.errors.invalidDueDay") };
	}

	const fromYear = Number(fromMatch[1]);
	const fromMonth = Number(fromMatch[2]) - 1; // 0-basiert
	const toYear = Number(toMatch[1]);
	const toMonth = Number(toMatch[2]) - 1;

	const startIndex = fromYear * 12 + fromMonth;
	const endIndex = toYear * 12 + toMonth;

	if (endIndex < startIndex) {
		return { error: t("finances.errors.endBeforeStart") };
	}
	if (endIndex - startIndex > 60) {
		return {
			error: t("finances.errors.periodTooLong"),
		};
	}

	const months: { year: number; month: number }[] = [];
	for (let index = startIndex; index <= endIndex; index += 1) {
		months.push({ year: Math.floor(index / 12), month: index % 12 });
	}

	// Kein Status-Filter nötig: Ob ein Vertrag im jeweiligen Fälligkeitsmonat
	// tatsächlich läuft, wird unten pro Monat anhand von startDate/endDate
	// geprüft (relevant z. B. für rückwirkende Zeiträume, in denen ein Vertrag
	// inzwischen beendet, aber damals noch aktiv war).
	const leaseList = listLeasesWithRentAdjustments();

	// Kandidaten fachlich ermitteln (Vertrag läuft im Fälligkeitsmonat, gültiger
	// Betrag aus dem Mietverlauf); Duplikatprüfung und atomares Anlegen
	// übernimmt das Repository.
	const candidates: DueTransactionCandidate[] = [];

	for (const lease of leaseList) {
		for (const { year, month } of months) {
			const dueDate = new Date(year, month, dueDay);

			// Vertrag muss zum Fälligkeitsdatum bereits laufen und noch nicht beendet sein.
			if (new Date(lease.startDate) > dueDate) continue;
			if (lease.endDate && new Date(lease.endDate) < dueDate) continue;

			const monthStart = new Date(year, month, 1);
			const monthEnd = new Date(year, month + 1, 1);

			// Für den jeweiligen Fälligkeitsmonat den zu diesem Zeitpunkt gültigen
			// Betrag verwenden (berücksichtigt spätere Mieterhöhungen/-senkungen),
			// statt immer den aktuellen Lease-Basiswert heranzuziehen.
			const amount = getTotalRentForDate(lease, lease.rentAdjustments, dueDate).toFixed(2);

			candidates.push({
				leaseId: lease.id,
				amount,
				dueDate: dueDate.toISOString(),
				purpose: `Miete ${MONTH_NAMES[month]} ${year}`,
				monthStart: monthStart.toISOString(),
				monthEnd: monthEnd.toISOString(),
			});
		}
	}

	const { created, skipped } = generateDueTransactions(candidates);

	// Nur protokollieren, wenn tatsächlich neue Zahlungen angelegt wurden.
	if (created > 0) {
		logActivity(user, "CREATE", "finanzen", `Mieten fällig gestellt (${created} neue ${created === 1 ? "Position" : "Positionen"})`);
	}

	revalidatePath("/finanzen");
	revalidatePath("/");

	if (created === 0) {
		return {
			success: true,
			message: skipped > 0 ? t("finances.success.noneCreatedAllSkipped", { skipped }) : t("finances.success.noActiveLeases"),
		};
	}

	return {
		success: true,
		message: t(created === 1 ? "finances.success.created.one" : "finances.success.created.other", {
			created,
			skippedSuffix: skipped > 0 ? t("finances.success.createdSuffix", { skipped }) : "",
		}),
	};
}

export async function deleteTransactionAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const transaction = getTransaction(id);
	try {
		deleteTransaction(id);
	} catch (error) {
		console.error("deleteTransactionAction failed", error);
		return { error: t("finances.errors.transactionDeleteFailed") };
	}

	logActivity(user, "DELETE", "finanzen", `Zahlung „${transaction ? describeTransaction(transaction) : id}“ gelöscht`, id);

	revalidatePath("/finanzen");
	revalidatePath("/");
	return { success: true };
}
