"use server";

import { revalidatePath } from "next/cache";

import { countAllocationsForAccount, createAccount, deleteAccount, getAccount, updateAccount } from "@/data/accounts";
import {
	createBankTransaction,
	deleteBankTransaction,
	getBankTransaction,
	setBankTransactionAllocations,
	updateBankTransaction,
	type BankTransactionInput,
} from "@/data/bank-transactions";
import { getTransaction } from "@/data/transactions";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { getT } from "@/lib/i18n/server";
import { ActionState } from "@/lib/action-state";
import { getString, getDecimalString } from "@/lib/form-data";
import { toCents } from "@/lib/money";

/**
 * Server Actions der Buchhaltung: Konten (Kontenrahmen je Liegenschaft),
 * Banktransaktionen (tatsächliche Bewegungen auf dem Konto der
 * Liegenschaft) und ihre Buchungszeilen (Zuordnung eines Teilbetrags auf
 * ein Konto oder gegen eine fällige Sollstellung). Die Fachregeln der
 * Zuordnung (gleiche Liegenschaft, kein Storno, Vorzeichen, Summe) werden
 * identisch im MCP-Werkzeug gespiegelt (src/lib/mcp/tools-rental.ts).
 *
 * Sollstellungen (status "PAID") gelten durch vollständige Zuordnung als
 * bezahlt - dadurch berücksichtigt die Nebenkostenabrechnung nur
 * tatsächlich geleistete Vorauszahlungen.
 */

// ============================================================
// Konten (Kontenrahmen je Liegenschaft)
// ============================================================

export async function saveAccountAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const propertyId = getString(formData, "propertyId");
	const label = getString(formData, "label");
	const notes = getString(formData, "notes");

	if (!propertyId || !label) {
		return { error: t("banking.errors.accountRequiredFields") };
	}

	try {
		if (id) {
			updateAccount(id, { label, notes: notes || null });
			logActivity(user, "UPDATE", "buchhaltung", `Konto „${label}“ bearbeitet`, id);
		} else {
			const account = createAccount({ propertyId, label, notes: notes || null });
			logActivity(user, "CREATE", "buchhaltung", `Konto „${label}“ angelegt`, account.id);
		}
	} catch (error) {
		console.error("saveAccountAction failed", error);
		return { error: t("banking.errors.accountSaveFailed") };
	}

	revalidatePath("/buchhaltung");
	return { success: true };
}

export async function deleteAccountAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const account = getAccount(id);
	if (!account) {
		return { error: t("banking.errors.accountNotFound") };
	}

	// Konten mit Buchungen nicht löschbar (sonst verlören gebuchte
	// Banktransaktionen rückwirkend ihre Zuordnung).
	if (countAllocationsForAccount(id) > 0) {
		return { error: t("banking.errors.accountHasBookings") };
	}

	try {
		deleteAccount(id);
	} catch (error) {
		console.error("deleteAccountAction failed", error);
		return { error: t("banking.errors.accountDeleteFailed") };
	}

	logActivity(user, "DELETE", "buchhaltung", `Konto „${account.label}“ gelöscht`, id);

	revalidatePath("/buchhaltung");
	return { success: true };
}

// ============================================================
// Banktransaktionen
// ============================================================

/**
 * Prüft die fachlichen Regeln einer Zuordnungs-Liste gegen eine
 * Banktransaktion (Referenzen, gleiche Liegenschaft, kein Storno,
 * Vorzeichen, Betragssumme) - identische Prüfung im MCP-Werkzeug
 * bank_transactions_allocate.
 */
async function validateAllocations(
	bankTransactionId: string,
	rawAllocations: { accountId: string | null; transactionId: string | null; amount: string }[]
): Promise<ActionState | null> {
	const t = await getT();
	const bankTransaction = getBankTransaction(bankTransactionId);
	if (!bankTransaction) {
		return { error: t("banking.errors.bankTransactionNotFound") };
	}

	const bankAmountCents = toCents(bankTransaction.amount);
	let allocatedCents = 0;

	for (const [index, allocation] of rawAllocations.entries()) {
		const hasAccount = Boolean(allocation.accountId);
		const hasTransaction = Boolean(allocation.transactionId);
		if (hasAccount === hasTransaction) {
			return { error: t("banking.errors.allocationTargetRequired", { index: index + 1 }) };
		}

		const amountCents = toCents(allocation.amount);
		if (amountCents === 0 || Number.isNaN(amountCents)) {
			return { error: t("banking.errors.allocationAmountInvalid", { index: index + 1 }) };
		}
		// Der Teilbetrag muss das Vorzeichen der Banktransaktion teilen
		// (Eingang wird mit Eingängen zugeordnet, Ausgang mit Ausgängen).
		if ((amountCents < 0) !== (bankAmountCents < 0)) {
			return { error: t("banking.errors.allocationWrongSign", { index: index + 1 }) };
		}

		if (allocation.accountId) {
			const account = getAccount(allocation.accountId);
			if (!account) {
				return { error: t("banking.errors.accountNotFound") };
			}
			if (account.propertyId !== bankTransaction.propertyId) {
				return { error: t("banking.errors.accountWrongProperty") };
			}
		}

		if (allocation.transactionId) {
			const transaction = getTransaction(allocation.transactionId);
			if (!transaction) {
				return { error: t("banking.errors.transactionNotFound") };
			}
			if (transaction.lease.unit.propertyId !== bankTransaction.propertyId) {
				return { error: t("banking.errors.transactionWrongProperty") };
			}
			if (transaction.status === "CANCELLED") {
				return { error: t("banking.errors.transactionCancelled") };
			}
		}

		allocatedCents += amountCents;
	}

	if (Math.abs(allocatedCents) > Math.abs(bankAmountCents)) {
		return { error: t("banking.errors.overAllocation") };
	}

	return null;
}

export async function saveBankTransactionAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const propertyId = getString(formData, "propertyId");
	const bookingDateRaw = getString(formData, "bookingDate");
	const direction = getString(formData, "direction");
	const amount = getDecimalString(formData, "amount");
	const description = getString(formData, "description");
	const partner = getString(formData, "partner");
	const notes = getString(formData, "notes");

	if (!propertyId || !bookingDateRaw || amount === null || !description) {
		return { error: t("banking.errors.bankTransactionRequiredFields") };
	}

	const bookingDate = new Date(bookingDateRaw);
	if (Number.isNaN(bookingDate.getTime())) {
		return { error: t("banking.errors.invalidBookingDate") };
	}

	// Richtung (Eingang/Ausgang) + positiver Betrag -> signed Decimal-String.
	const signedAmount = direction === "EXPENSE" ? `-${amount}` : amount;

	const data: BankTransactionInput = {
		propertyId,
		bookingDate: bookingDate.toISOString(),
		amount: signedAmount,
		description,
		partner: partner || null,
		notes: notes || null,
	};

	try {
		if (id) {
			updateBankTransaction(id, data);
			logActivity(user, "UPDATE", "buchhaltung", `Banktransaktion „${description}“ bearbeitet`, id);
		} else {
			const bankTransaction = createBankTransaction(data);
			logActivity(user, "CREATE", "buchhaltung", `Banktransaktion „${description}“ erfasst`, bankTransaction.id);
		}
	} catch (error) {
		console.error("saveBankTransactionAction failed", error);
		return { error: t("banking.errors.bankTransactionSaveFailed") };
	}

	revalidatePath("/buchhaltung");
	return { success: true };
}

export async function deleteBankTransactionAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const bankTransaction = getBankTransaction(id);
	if (!bankTransaction) {
		return { error: t("banking.errors.bankTransactionNotFound") };
	}

	try {
		deleteBankTransaction(id);
	} catch (error) {
		console.error("deleteBankTransactionAction failed", error);
		return { error: t("banking.errors.bankTransactionDeleteFailed") };
	}

	logActivity(user, "DELETE", "buchhaltung", `Banktransaktion „${bankTransaction.description}“ gelöscht`, id);

	revalidatePath("/buchhaltung");
	revalidatePath("/finanzen");
	return { success: true };
}

/**
 * Ersetzt SÄMTLICHE Buchungszeilen einer Banktransaktion durch die im
 * Formular erfassten Zeilen (Ziel: Konto oder offene Sollstellung +
 * Teilbetrag). Vollständig zugeordnete Sollstellungen werden als bezahlt
 * markiert (Status PAID inkl. paid_date aus dem Buchungsdatum), siehe
 * setBankTransactionAllocations.
 */
export async function saveBankTransactionAllocationsAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const bankTransactionId = getString(formData, "bankTransactionId");
	if (!bankTransactionId) {
		return { error: t("banking.errors.bankTransactionNotFound") };
	}

	// Zeilenweisen FormData-Aufbau: target-<index> = "account:<id>" bzw.
	// "transaction:<id>", amount-<index> = Teilbetrag (Komma oder Punkt).
	const rawAllocations: { accountId: string | null; transactionId: string | null; amount: string }[] = [];
	for (const key of formData.keys()) {
		const match = /^(?:target|amount)-(\d+)$/.exec(key);
		if (!match) continue;
		const index = Number(match[1]);
		rawAllocations[index] = rawAllocations[index] ?? { accountId: null, transactionId: null, amount: "0" };
	}
	for (let index = 0; index < rawAllocations.length; index += 1) {
		if (!rawAllocations[index]) continue;
		const target = getString(formData, `target-${index}`);
		const amount = getDecimalString(formData, `amount-${index}`);
		if (target.startsWith("account:")) {
			rawAllocations[index].accountId = target.slice("account:".length) || null;
		} else if (target.startsWith("transaction:")) {
			rawAllocations[index].transactionId = target.slice("transaction:".length) || null;
		}
		rawAllocations[index].amount = amount ?? "0";
	}
	const allocations: { accountId: string | null; transactionId: string | null; amount: string }[] = rawAllocations.filter(
		(allocation) => allocation && (allocation.accountId || allocation.transactionId)
	);

	const validationError = await validateAllocations(bankTransactionId, allocations);
	if (validationError) return validationError;

	try {
		setBankTransactionAllocations(bankTransactionId, allocations);
		const bankTransaction = getBankTransaction(bankTransactionId);
		logActivity(
			user,
			"UPDATE",
			"buchhaltung",
			`Banktransaktion „${bankTransaction?.description ?? bankTransactionId}“ zugeordnet (${allocations.length} Buchungszeile${allocations.length === 1 ? "" : "n"})`,
			bankTransactionId
		);
	} catch (error) {
		console.error("saveBankTransactionAllocationsAction failed", error);
		return { error: t("banking.errors.allocateFailed") };
	}

	revalidatePath("/buchhaltung");
	revalidatePath("/finanzen");
	return { success: true };
}
