"use server";

import { revalidatePath } from "next/cache";

import { upsertDepositForLease } from "@/data/deposits";
import { listLeasesWithRentAdjustments } from "@/data/leases";
import {
	createTransaction,
	deleteTransaction,
	generateDueTransactions,
	markTransactionPaid,
	updateTransaction,
	type DueTransactionCandidate,
} from "@/data/transactions";
import { requireUser } from "@/lib/auth/dal";
import { ActionState } from "@/lib/action-state";
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

// ============================================================
// Kautionskonten (Deposit)
// ============================================================

export async function saveDepositAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const leaseId = getString(formData, "leaseId");
	const typeRaw = getString(formData, "type") as DepositType;
	const statusRaw = getString(formData, "status") as DepositStatus;
	const amount = getDecimalString(formData, "amount");
	const receivedDateRaw = getString(formData, "receivedDate");
	const refundedDateRaw = getString(formData, "refundedDate");
	const refundedAmount = getDecimalString(formData, "refundedAmount");
	const notes = getString(formData, "notes");

	if (!leaseId || amount === null) {
		return { error: "Bitte Mietvertrag und Betrag angeben." };
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

	try {
		upsertDepositForLease(data);
	} catch (error) {
		console.error("saveDepositAction failed", error);
		return { error: "Das Kautionskonto konnte nicht gespeichert werden." };
	}

	revalidatePath("/finanzen");
	revalidatePath("/");
	return { success: true };
}

// ============================================================
// Mieteingänge (Transaction)
// ============================================================

export async function saveTransactionAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	await requireUser();
	const id = getString(formData, "id");
	const leaseId = getString(formData, "leaseId");
	const dueDateRaw = getString(formData, "dueDate");
	const purpose = getString(formData, "purpose");
	const statusRaw = getString(formData, "status") as TransactionStatus;
	const amount = getDecimalString(formData, "amount");

	if (!leaseId || !dueDateRaw || amount === null) {
		return {
			error: "Bitte Mietvertrag, Fälligkeitsdatum und Betrag angeben.",
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
		} else {
			createTransaction(data);
		}
	} catch (error) {
		console.error("saveTransactionAction failed", error);
		return { error: "Die Zahlung konnte nicht gespeichert werden." };
	}

	revalidatePath("/finanzen");
	revalidatePath("/");
	return { success: true };
}

/** Schnellaktion: Zahlung direkt aus der Tabelle als "bezahlt" markieren. */
export async function markTransactionPaidAction(id: string): Promise<ActionState> {
	await requireUser();
	try {
		markTransactionPaid(id);
	} catch (error) {
		console.error("markTransactionPaidAction failed", error);
		return { error: "Zahlung konnte nicht als bezahlt markiert werden." };
	}

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
	await requireUser();
	const fromMonthRaw = getString(formData, "fromMonth"); // Format: YYYY-MM
	const toMonthRaw = getString(formData, "toMonth"); // Format: YYYY-MM
	const dueDayRaw = getString(formData, "dueDay");

	const fromMatch = /^(\d{4})-(\d{2})$/.exec(fromMonthRaw);
	const toMatch = /^(\d{4})-(\d{2})$/.exec(toMonthRaw);

	if (!fromMatch || !toMatch) {
		return { error: "Bitte einen gültigen Zeitraum (Von/Bis) angeben." };
	}

	const dueDay = Number(dueDayRaw);
	if (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 28) {
		return { error: "Der Fälligkeitstag muss zwischen 1 und 28 liegen." };
	}

	const fromYear = Number(fromMatch[1]);
	const fromMonth = Number(fromMatch[2]) - 1; // 0-basiert
	const toYear = Number(toMatch[1]);
	const toMonth = Number(toMatch[2]) - 1;

	const startIndex = fromYear * 12 + fromMonth;
	const endIndex = toYear * 12 + toMonth;

	if (endIndex < startIndex) {
		return { error: "Das Enddatum darf nicht vor dem Startdatum liegen." };
	}
	if (endIndex - startIndex > 60) {
		return {
			error: "Der Zeitraum darf maximal 61 Monate umfassen.",
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

	revalidatePath("/finanzen");
	revalidatePath("/");

	if (created === 0) {
		return {
			success: true,
			message:
				skipped > 0
					? `Keine neuen Zahlungen angelegt - für alle ${skipped} Vertrag/Monat-Kombinationen im Zeitraum existierten bereits Zahlungen.`
					: "Keine aktiven Mietverträge im gewählten Zeitraum gefunden.",
		};
	}

	return {
		success: true,
		message: `${created} Zahlung${created === 1 ? "" : "en"} angelegt${skipped > 0 ? ` (${skipped} bereits vorhanden, übersprungen)` : ""}.`,
	};
}

export async function deleteTransactionAction(id: string): Promise<ActionState> {
	await requireUser();
	try {
		deleteTransaction(id);
	} catch (error) {
		console.error("deleteTransactionAction failed", error);
		return { error: "Die Zahlung konnte nicht gelöscht werden." };
	}

	revalidatePath("/finanzen");
	revalidatePath("/");
	return { success: true };
}
