/**
 * Namespace "finances" (Deutsch): Modul "Finanzen" - Kautionskonten und
 * Mieteingänge (Transaktionen) inkl. der Fehlertexte aus den Server Actions.
 * Schlüssel-Parität mit Englisch wird per Typ (en-Datei) und
 * src/lib/i18n/messages.test.ts erzwungen.
 */
export const finances = {
	title: "Finanzen",
	description: "Kautionskonten und Mieteingänge.",
	// Tabs der Übersichtsseite
	"tabs.transactions": "Mieteingänge",
	"tabs.deposits": "Kautionskonten",
	// Filter
	"filter.filteredBy": "Gefiltert nach:",
	"filter.allStatuses": "Alle Status",
	"filter.reset": "Zurücksetzen",
	// Rückstands-Karte (Betrag wird als {amount} davor eingeblendet)
	"stats.arrears": "an Mietrückständen (fällige/überfällige Zahlungen).",
	// Leer-Zustände
	"empty.transactions": "Noch keine Zahlungen erfasst.",
	"empty.transactionsFiltered": "Keine Zahlungen für den gewählten Status.",
	"empty.leases": "Noch keine Mietverträge vorhanden.",
	// Tabellenköpfe
	"table.tenantUnit": "Mieter / Einheit",
	"table.purpose": "Verwendungszweck",
	"table.dueDate": "Fällig am",
	"table.depositContract": "Kaution (Vertrag)",
	"table.depositAccount": "Betrag (Konto)",
	// Bestätigungsdialoge
	"confirm.deleteTransaction": "Diese Zahlung wirklich löschen?",
	// Zahlungsstatus (Enum TransactionStatus)
	"status.OPEN": "Fällig",
	"status.PAID": "Bezahlt",
	"status.OVERDUE": "Überfällig",
	"status.CANCELLED": "Storniert",
	// Kautionsstatus (Enum DepositStatus)
	"depositStatus.PENDING": "Ausstehend",
	"depositStatus.RECEIVED": "Hinterlegt",
	"depositStatus.PARTIALLY_REFUNDED": "Teilweise zurückgezahlt",
	"depositStatus.REFUNDED": "Vollständig zurückgezahlt",
	"deposit.notRecorded": "Nicht erfasst",
	// Kautionsart (Enum DepositType)
	"depositType.CASH": "Barkaution",
	"depositType.BANK_GUARANTEE": "Bankgarantie/Bürgschaft",
	"depositType.BLOCKED_ACCOUNT": "Kautionskonto (Sparbuch)",
	// Formular-Felder (Zahlung + Kaution)
	"fields.lease": "Mietvertrag",
	"fields.leasePlaceholder": "Mietvertrag auswählen",
	"fields.amount": "Betrag (€)",
	"fields.dueDate": "Fällig am",
	"fields.purpose": "Verwendungszweck",
	"fields.purposePlaceholder": "z. B. Miete Januar 2026",
	"fields.type": "Art der Kaution",
	"fields.receivedDate": "Hinterlegt am",
	"fields.refundedDate": "Zurückgezahlt am",
	"fields.refundedAmount": "Zurückgezahlter Betrag (€)",
	// Schnellaktionen
	"actions.markPaid": "Als bezahlt markieren",
	// Kautions-Dialog
	"depositDialog.trigger": "Kaution erfassen",
	"depositDialog.title": "Kautionskonto",
	// Zahlungs-Dialog
	"transactionDialog.createTitle": "Zahlung erfassen",
	"transactionDialog.editTitle": "Zahlung bearbeiten",
	"transactionDialog.description": "Manuell erfasster Mieteingang bzw. fällige Zahlung.",
	"transactionDialog.suggestedTotal": "Miete gesamt zum Fälligkeitsdatum (Kalt + NK): {total} €",
	// Dialog "Zahlungen für Zeitraum fällig stellen"
	"generate.trigger": "Zahlungen für Zeitraum fällig stellen",
	"generate.title": "Zahlungen automatisch fällig stellen",
	"generate.description":
		"Legt für alle aktiven Mietverträge und jeden Monat im gewählten Zeitraum eine offene Zahlung an (Kaltmiete + Nebenkosten). Bereits vorhandene Zahlungen für einen Monat werden nicht doppelt angelegt.",
	"generate.successTitle": "Fällig gestellt",
	"generate.fromMonth": "Von (Monat)",
	"generate.toMonth": "Bis (Monat)",
	"generate.dueDay": "Fällig jeweils am (Tag des Monats)",
	"generate.dueDayHint": "Tag zwischen 1 und 28, um für jeden Monat ein gültiges Datum zu garantieren.",
	"generate.submit": "Fällig stellen",
	// Fehlermeldungen (Server Actions)
	"errors.leaseAndAmountRequired": "Bitte Mietvertrag und Betrag angeben.",
	"errors.depositSaveFailed": "Das Kautionskonto konnte nicht gespeichert werden.",
	"errors.leaseDueDateAmountRequired": "Bitte Mietvertrag, Fälligkeitsdatum und Betrag angeben.",
	"errors.transactionSaveFailed": "Die Zahlung konnte nicht gespeichert werden.",
	"errors.markPaidFailed": "Zahlung konnte nicht als bezahlt markiert werden.",
	"errors.transactionDeleteFailed": "Die Zahlung konnte nicht gelöscht werden.",
	"errors.invalidPeriod": "Bitte einen gültigen Zeitraum (Von/Bis) angeben.",
	"errors.invalidDueDay": "Der Fälligkeitstag muss zwischen 1 und 28 liegen.",
	"errors.endBeforeStart": "Das Enddatum darf nicht vor dem Startdatum liegen.",
	"errors.periodTooLong": "Der Zeitraum darf maximal 61 Monate umfassen.",
	// Ergebnis der Fälligstellung (Erfolgsmeldungen mit Platzhaltern)
	"success.noActiveLeases": "Keine aktiven Mietverträge im gewählten Zeitraum gefunden.",
	"success.noneCreatedAllSkipped":
		"Keine neuen Zahlungen angelegt - für alle {skipped} Vertrag/Monat-Kombinationen im Zeitraum existierten bereits Zahlungen.",
	"success.created.one": "{created} Zahlung angelegt{skippedSuffix}.",
	"success.created.other": "{created} Zahlungen angelegt{skippedSuffix}.",
	"success.createdSuffix": " ({skipped} bereits vorhanden, übersprungen)",
};
