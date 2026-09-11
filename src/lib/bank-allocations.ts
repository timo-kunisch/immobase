import { getAccount } from "@/data/accounts";
import { getBankTransaction } from "@/data/bank-transactions";
import { getHousingCharge } from "@/data/housing-charges";
import { getTransaction } from "@/data/transactions";
import { toCents } from "@/lib/money";

/**
 * Geteilte Fachvalidierung für Buchungszeilen einer Banktransaktion -
 * identisch verwendet von der Server Action (src/app/(app)/buchhaltung/
 * actions.ts) und den MCP-Werkzeugen bank_transactions_allocate und
 * bank_transactions_import (src/lib/mcp/tools-rental.ts), damit alle
 * Schichten dieselben Regeln durchsetzen.
 *
 * Regeln je Buchungszeile: genau EINES der Ziele Konto (accountId), Miet-
 * Sollstellung (transactionId) oder Hausgeld-Sollstellung (housingChargeId)
 * ist gesetzt; der Teilbetrag ist ungleich 0, teilt das Vorzeichen der
 * Banktransaktion und verweist auf ein Ziel derselben Liegenschaft; eine
 * Sollstellung darf nicht storniert sein. Insgesamt darf die Summe der
 * Teilbeträge den Betrag der Banktransaktion nicht übersteigen.
 *
 * Die Fehler werden als strukturierter Code (+ 1-basierte Zeilennummer)
 * zurückgegeben, damit jede Aufrufschicht ihre eigene Sprache/Präsentation
 * darauf abbauen kann (Action: i18n-Schlüssel, MCP: deutsche Meldung).
 */

export type BankAllocationInput = {
	accountId: string | null;
	transactionId: string | null;
	housingChargeId: string | null;
	/** Signed Decimal-String (teilt das Vorzeichen der Banktransaktion). */
	amount: string;
};

/** Banktransaktion in der Form, die die Validierung braucht (Liegenschaft + Betrag). */
export type BankAllocationBankTransaction = {
	propertyId: string;
	amount: string;
};

export type BankAllocationValidationError =
	| { code: "bankTransactionNotFound" }
	| { code: "targetRequired"; line: number }
	| { code: "amountInvalid"; line: number }
	| { code: "wrongSign"; line: number }
	| { code: "accountNotFound"; line: number }
	| { code: "accountWrongProperty"; line: number }
	| { code: "transactionNotFound"; line: number }
	| { code: "transactionWrongProperty"; line: number }
	| { code: "transactionCancelled"; line: number }
	| { code: "housingChargeNotFound"; line: number }
	| { code: "housingChargeWrongProperty"; line: number }
	| { code: "housingChargeCancelled"; line: number }
	| { code: "overAllocation" };

/**
 * Prüft die Buchungszeilen gegen eine bereits vorhandene Banktransaktion -
 * erster Regelverstoß gewinnt. Gibt `null` zurück, wenn alles in Ordnung ist.
 */
export function validateBankAllocations(bankTransactionId: string, allocations: BankAllocationInput[]): BankAllocationValidationError | null {
	const bankTransaction = getBankTransaction(bankTransactionId);
	if (!bankTransaction) return { code: "bankTransactionNotFound" };
	return validateBankAllocationsAgainst(bankTransaction, allocations);
}

/**
 * Kern der Validierung gegen eine Banktransaktions-"Form" (Liegenschaft +
 * Betrag) - wird auch für den Vorab-Check eines Kontoauszug-Imports
 * verwendet, bevor die Banktransaktionen tatsächlich angelegt werden.
 */
export function validateBankAllocationsAgainst(
	bankTransaction: BankAllocationBankTransaction,
	allocations: BankAllocationInput[]
): BankAllocationValidationError | null {
	const bankAmountCents = toCents(bankTransaction.amount);
	let allocatedCents = 0;

	for (const [index, allocation] of allocations.entries()) {
		const line = index + 1;
		const targets = [allocation.accountId, allocation.transactionId, allocation.housingChargeId].filter(Boolean);
		if (targets.length !== 1) {
			return { code: "targetRequired", line };
		}

		const amountCents = toCents(allocation.amount);
		if (amountCents === 0 || Number.isNaN(amountCents)) {
			return { code: "amountInvalid", line };
		}
		// Der Teilbetrag muss das Vorzeichen der Banktransaktion teilen
		// (Eingang wird mit Eingängen zugeordnet, Ausgang mit Ausgängen).
		if ((amountCents < 0) !== (bankAmountCents < 0)) {
			return { code: "wrongSign", line };
		}

		if (allocation.accountId) {
			const account = getAccount(allocation.accountId);
			if (!account) return { code: "accountNotFound", line };
			if (account.propertyId !== bankTransaction.propertyId) return { code: "accountWrongProperty", line };
		}

		if (allocation.transactionId) {
			const transaction = getTransaction(allocation.transactionId);
			if (!transaction) return { code: "transactionNotFound", line };
			if (transaction.lease.unit.propertyId !== bankTransaction.propertyId) return { code: "transactionWrongProperty", line };
			if (transaction.status === "CANCELLED") return { code: "transactionCancelled", line };
		}

		if (allocation.housingChargeId) {
			const housingCharge = getHousingCharge(allocation.housingChargeId);
			if (!housingCharge) return { code: "housingChargeNotFound", line };
			if (housingCharge.unit.propertyId !== bankTransaction.propertyId) return { code: "housingChargeWrongProperty", line };
			if (housingCharge.status === "CANCELLED") return { code: "housingChargeCancelled", line };
		}

		allocatedCents += amountCents;
	}

	if (Math.abs(allocatedCents) > Math.abs(bankAmountCents)) {
		return { code: "overAllocation" };
	}

	return null;
}

/**
 * Bildet einen Validierungs-Fehler auf eine deutsche Meldung ab (Konvention
 * der MCP-Werkzeuge) - `lineLabel` benennt die Zeile im Kontext des
 * Aufrufers (z. B. "Zeile 2" bzw. "Eintrag 3, Zeile 2").
 */
export function bankAllocationErrorToGermanMessage(error: BankAllocationValidationError, lineLabel: (line: number) => string): string {
	switch (error.code) {
		case "bankTransactionNotFound":
			return "Die Banktransaktion wurde nicht gefunden.";
		case "targetRequired":
			return `${lineLabel(error.line)}: Bitte genau ein Ziel (accountId ODER transactionId ODER housingChargeId) angeben.`;
		case "amountInvalid":
			return `${lineLabel(error.line)}: Bitte einen von 0 verschiedenen Teilbetrag angeben.`;
		case "wrongSign":
			return `${lineLabel(error.line)}: Der Teilbetrag muss dasselbe Vorzeichen haben wie die Banktransaktion.`;
		case "accountNotFound":
			return `${lineLabel(error.line)}: Das angegebene Konto existiert nicht.`;
		case "accountWrongProperty":
			return `${lineLabel(error.line)}: Das Konto gehört zu einer anderen Liegenschaft als die Banktransaktion.`;
		case "transactionNotFound":
			return `${lineLabel(error.line)}: Die angegebene Sollstellung existiert nicht.`;
		case "transactionWrongProperty":
			return `${lineLabel(error.line)}: Die Sollstellung gehört zu einer anderen Liegenschaft als die Banktransaktion.`;
		case "transactionCancelled":
			return `${lineLabel(error.line)}: Stornierte Sollstellungen können nicht zugeordnet werden.`;
		case "housingChargeNotFound":
			return `${lineLabel(error.line)}: Die angegebene Hausgeld-Sollstellung existiert nicht.`;
		case "housingChargeWrongProperty":
			return `${lineLabel(error.line)}: Die Hausgeld-Sollstellung gehört zu einer anderen Liegenschaft als die Banktransaktion.`;
		case "housingChargeCancelled":
			return `${lineLabel(error.line)}: Stornierte Hausgeld-Sollstellungen können nicht zugeordnet werden.`;
		case "overAllocation":
			return "Die Teilbeträge übersteigen den Betrag der Banktransaktion.";
	}
}