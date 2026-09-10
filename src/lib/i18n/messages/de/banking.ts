/**
 * Namespace "banking" (Deutsch): Modul "Buchhaltung" - Konten
 * (Kontenrahmen je Liegenschaft), Banktransaktionen und ihre Buchungs-
 * zuordnung (Konto bzw. fällige Sollstellung) inkl. der Fehlertexte der
 * Server Actions.
 */
export const banking = {
	title: "Buchhaltung",
	description: "Banktransaktionen und Konten je Liegenschaft.",
	// Reiter
	"tabs.bankTransactions": "Banktransaktionen",
	"tabs.accounts": "Konten",
	// Info-Kasten
	info: "Erfassen Sie die Bewegungen des Bankkontos je Liegenschaft und ordnen Sie sie Konten (z. B. Gebäudeversicherung) oder offenen Sollstellungen (Mieten) zu. Vollständig zugeordnete Sollstellungen gelten als bezahlt und zählen in der Nebenkostenabrechnung als geleistete Vorauszahlung.",
	// Leer-Zustände
	"empty.noProperties": "Legen Sie zuerst eine Liegenschaft an, um die Buchhaltung nutzen zu können.",
	"empty.selectProperty": "Bitte eine Liegenschaft auswählen.",
	"empty.transactions": "Noch keine Banktransaktionen erfasst.",
	"empty.transactionsFiltered": "Keine Banktransaktionen mit diesem Status gefunden.",
	"empty.accounts": "Noch keine Konten angelegt.",
	// Konten
	"accounts.management": "Kontenrahmen dieser Liegenschaft",
	// Status (Enum BankTransactionStatus)
	"status.OPEN": "Offen",
	"status.PARTIAL": "Teilweise zugeordnet",
	"status.RECONCILED": "Zugeordnet",
	// Tabellenköpfe
	"table.bookingDate": "Buchungsdatum",
	"table.description": "Beschreibung",
	"table.allocatedTo": "Zugeordnet",
	"table.account": "Konto",
	"table.allocatedAmount": "Gebuchter Betrag",
	"table.bookings": "Buchungen",
	// Filter
	"filter.allProperties": "Alle Liegenschaften",
	"filter.allStatuses": "Alle Status",
	"filter.reset": "Filter zurücksetzen",
	// Buchungsrichtung (Eingang/Ausgang)
	"direction.INCOME": "Eingang (Gutschrift)",
	"direction.EXPENSE": "Ausgang (Belastung)",
	// Dialog "Konto"
	"accountDialog.trigger": "Neues Konto",
	"accountDialog.createTitle": "Neues Konto",
	"accountDialog.editTitle": "Konto bearbeiten",
	"accountDialog.description": "Konto des Kontenrahmens der Liegenschaft (z. B. Gebäudeversicherung) - Ziel der Zuordnung von Banktransaktionen.",
	// Dialog "Banktransaktion"
	"transactionDialog.trigger": "Banktransaktion erfassen",
	"transactionDialog.createTitle": "Banktransaktion erfassen",
	"transactionDialog.editTitle": "Banktransaktion bearbeiten",
	"transactionDialog.description": "Tatsächliche Bewegung auf dem Bankkonto der Liegenschaft laut Kontoauszug.",
	// Zuordnen (Buchungszeilen)
	"allocate.open": "Zuordnen",
	"allocate.title": "Banktransaktion zuordnen",
	"allocate.description": "Transaktion \"{description}\" über {amount} € zuordnen: Teilbeträge auf Konten oder offene Sollstellungen buchen (Split möglich).",
	"allocate.target": "Zuordnen auf",
	"allocate.targetPlaceholder": "Ziel auswählen",
	"allocate.groupAccounts": "Konten",
	"allocate.groupTransactions": "Offene Sollstellungen",
	"allocate.shareAmount": "Teilbetrag (€)",
	"allocate.addRow": "Weitere Zeile",
	"allocate.remaining": "Nicht zugeordnet: {amount} €",
	// Formular-Felder
	"fields.bookingDate": "Buchungsdatum",
	"fields.direction": "Richtung",
	"fields.amount": "Betrag (€)",
	"fields.description": "Beschreibung",
	"fields.descriptionPlaceholder": "z. B. Abbuchung Gebäudeversicherung",
	"fields.partner": "Zahlungspartner",
	"fields.partnerPlaceholder": "z. B. Versicherungsgesellschaft",
	"fields.accountLabel": "Kontobezeichnung",
	"fields.accountLabelPlaceholder": "z. B. Gebäudeversicherung",
	// Bestätigungsdialoge
	"confirm.deleteTransaction": "Banktransaktion \"{description}\" inkl. ihrer Buchungszeilen wirklich löschen? Zugeordnete Sollstellungen verlieren ggf. den bezahlt-Status.",
	"confirm.deleteAccount": "Konto \"{label}\" wirklich löschen?",
	// Fehlermeldungen (Server Actions)
	"errors.accountRequiredFields": "Bitte eine Kontobezeichnung angeben.",
	"errors.accountSaveFailed": "Das Konto konnte nicht gespeichert werden.",
	"errors.accountDeleteFailed": "Das Konto konnte nicht gelöscht werden.",
	"errors.accountNotFound": "Das Konto wurde nicht gefunden.",
	"errors.accountHasBookings": "Dieses Konto hat bereits Buchungen und kann daher nicht gelöscht werden.",
	"errors.bankTransactionNotFound": "Die Banktransaktion wurde nicht gefunden.",
	"errors.bankTransactionRequiredFields": "Bitte Buchungsdatum, Betrag und Beschreibung angeben.",
	"errors.invalidBookingDate": "Bitte ein gültiges Buchungsdatum angeben.",
	"errors.bankTransactionSaveFailed": "Die Banktransaktion konnte nicht gespeichert werden.",
	"errors.bankTransactionDeleteFailed": "Die Banktransaktion konnte nicht gelöscht werden.",
	"errors.allocateFailed": "Die Zuordnung konnte nicht gespeichert werden.",
	"errors.allocationTargetRequired": "Zeile {index}: Bitte ein Zuordnungsziel (Konto oder Sollstellung) angeben.",
	"errors.allocationAmountInvalid": "Zeile {index}: Bitte einen von 0 verschiedenen Teilbetrag angeben.",
	"errors.allocationWrongSign": "Zeile {index}: Der Teilbetrag muss dieselbe Richtung (Eingang/Ausgang) haben wie die Banktransaktion.",
	"errors.accountWrongProperty": "Das Konto gehört zu einer anderen Liegenschaft als die Banktransaktion.",
	"errors.transactionNotFound": "Die Sollstellung wurde nicht gefunden.",
	"errors.transactionWrongProperty": "Die Sollstellung gehört zu einer anderen Liegenschaft als die Banktransaktion.",
	"errors.transactionCancelled": "Stornierte Sollstellungen können nicht zugeordnet werden.",
	"errors.overAllocation": "Die Teilbeträge übersteigen den Betrag der Banktransaktion.",
};
