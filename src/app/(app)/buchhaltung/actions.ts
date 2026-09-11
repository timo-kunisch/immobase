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
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { getT } from "@/lib/i18n/server";
import { ActionState } from "@/lib/action-state";
import { getString, getDecimalString } from "@/lib/form-data";
import { validateBankAllocations, type BankAllocationInput, type BankAllocationValidationError } from "@/lib/bank-allocations";

/**
 * Server Actions der Buchhaltung: Konten (Kontenrahmen je Liegenschaft),
 * Banktransaktionen (tatsächliche Bewegungen auf dem Konto der
 * Liegenschaft) und ihre Buchungszeilen (Zuordnung eines Teilbetrags auf
 * ein Konto, gegen eine fällige Miet-Sollstellung oder gegen eine Hausgeld-
 * Sollstellung der WEG-Verwaltung). Die Fachregeln der Zuordnung (gleiche
 * Liegenschaft, kein Storno, Vorzeichen, Summe) liegen geteilt in
 * src/lib/bank-allocations.ts und werden identisch im MCP-Werkzeug
 * gespiegelt (src/lib/mcp/tools-rental.ts).
 *
 * Sollstellungen beider Buchungskreise (Miete UND Hausgeld) gelten durch
 * vollständige Zuordnung als bezahlt - dadurch berücksichtigen sowohl die
 * Nebenkostenabrechnung als auch die WEG-Jahresabrechnung ausschließlich
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
	revalidatePath("/weg/buchhaltung");
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
	revalidatePath("/weg/buchhaltung");
	return { success: true };
}

// ============================================================
// Banktransaktionen
// ============================================================

/**
 * Bildet einen strukturierten Validierungs-Fehler aus src/lib/bank-
 * allocations.ts auf den passenden i18n-Schlüssel der Buchhaltung ab.
 */
function allocationErrorToActionState(error: BankAllocationValidationError, t: Awaited<ReturnType<typeof getT>>): ActionState {
	switch (error.code) {
		case "bankTransactionNotFound":
			return { error: t("banking.errors.bankTransactionNotFound") };
		case "targetRequired":
			return { error: t("banking.errors.allocationTargetRequired", { index: error.line }) };
		case "amountInvalid":
			return { error: t("banking.errors.allocationAmountInvalid", { index: error.line }) };
		case "wrongSign":
			return { error: t("banking.errors.allocationWrongSign", { index: error.line }) };
		case "accountNotFound":
			return { error: t("banking.errors.accountNotFound") };
		case "accountWrongProperty":
			return { error: t("banking.errors.accountWrongProperty") };
		case "transactionNotFound":
			return { error: t("banking.errors.transactionNotFound") };
		case "transactionWrongProperty":
			return { error: t("banking.errors.transactionWrongProperty") };
		case "transactionCancelled":
			return { error: t("banking.errors.transactionCancelled") };
		case "housingChargeNotFound":
			return { error: t("banking.errors.housingChargeNotFound") };
		case "housingChargeWrongProperty":
			return { error: t("banking.errors.housingChargeWrongProperty") };
		case "housingChargeCancelled":
			return { error: t("banking.errors.housingChargeCancelled") };
		case "overAllocation":
			return { error: t("banking.errors.overAllocation") };
	}
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
	revalidatePath("/weg/buchhaltung");
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
	revalidatePath("/weg/buchhaltung");
	revalidatePath("/finanzen");
	revalidatePath("/weg/hausgeld");
	return { success: true };
}

/**
 * Ersetzt SÄMTLICHE Buchungszeilen einer Banktransaktion durch die im
 * Formular erfassten Zeilen (Ziel: Konto, offene Miet-Sollstellung oder
 * offene Hausgeld-Sollstellung + Teilbetrag). Vollständig zugeordnete
 * Sollstellungen beider Buchungskreise werden als bezahlt markiert
 * (Status PAID inkl. paid_date aus dem Buchungsdatum), siehe
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
	// "transaction:<id>" bzw. "housingcharge:<id>", amount-<index> = Teilbetrag
	// (Komma oder Punkt).
	const rawAllocations: BankAllocationInput[] = [];
	for (const key of formData.keys()) {
		const match = /^(?:target|amount)-(\d+)$/.exec(key);
		if (!match) continue;
		const index = Number(match[1]);
		rawAllocations[index] = rawAllocations[index] ?? { accountId: null, transactionId: null, housingChargeId: null, amount: "0" };
	}
	for (let index = 0; index < rawAllocations.length; index += 1) {
		if (!rawAllocations[index]) continue;
		const target = getString(formData, `target-${index}`);
		const amount = getDecimalString(formData, `amount-${index}`);
		if (target.startsWith("account:")) {
			rawAllocations[index].accountId = target.slice("account:".length) || null;
		} else if (target.startsWith("transaction:")) {
			rawAllocations[index].transactionId = target.slice("transaction:".length) || null;
		} else if (target.startsWith("housingcharge:")) {
			rawAllocations[index].housingChargeId = target.slice("housingcharge:".length) || null;
		}
		rawAllocations[index].amount = amount ?? "0";
	}
	const allocations: BankAllocationInput[] = rawAllocations.filter(
		(allocation) => allocation && (allocation.accountId || allocation.transactionId || allocation.housingChargeId)
	);

	const validationError = validateBankAllocations(bankTransactionId, allocations);
	if (validationError) return allocationErrorToActionState(validationError, t);

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
	revalidatePath("/weg/buchhaltung");
	revalidatePath("/finanzen");
	revalidatePath("/weg/hausgeld");
	return { success: true };
}
