/**
 * Namespace "hoaFinance" (Deutsch): WEG-Finanzen - Hausgeld-Sollstellungen
 * (Liste, Formular-Dialog, Schnellaktion "als bezahlt markieren",
 * Fälligstellen-Dialog aus dem Wirtschaftsplan) und Erhaltungsrücklage
 * (Kontobuch, Vermögensbericht, Buchungs-Dialog) inkl. der Meldungen der
 * zugehörigen Server Actions.
 * Schlüssel-Parität mit Englisch wird per Typ (en-Datei) und
 * src/lib/i18n/messages.test.ts erzwungen.
 */
export const hoaFinance = {
	// Leerer Bestand (keine WEG angelegt)
	noHoas: "Legen Sie zuerst unter „WEG-Verwaltung“ eine WEG an.",

	// ============================================================
	// Hausgeld (housingCharges)
	// ============================================================
	"charges.title": "Hausgeld",
	"charges.description": "Hausgeld-Sollstellungen je WEG und Eigentümer.",
	"charges.empty": "Noch keine Hausgeld-Sollstellungen erfasst.",
	// Hinweiskarte zum Rückstand (Betrag wird vorangestellt)
	"charges.arrears.suffix": "an Hausgeld-Rückständen (fällige/überfällige Sollstellungen).",
	// Tabellenköpfe
	"charges.table.hoa": "WEG",
	"charges.table.ownerUnit": "Eigentümer / Einheit",
	"charges.table.purpose": "Verwendungszweck",
	"charges.table.dueDate": "Fällig am",
	// Lösch-Bestätigung (ConfirmDeleteButton)
	"charges.confirm.delete": "Diese Hausgeld-Sollstellung wirklich löschen?",
	// Sollstellungs-Status (Badge + Select)
	"charges.status.OPEN": "Fällig",
	"charges.status.PAID": "Bezahlt",
	"charges.status.OVERDUE": "Überfällig",
	"charges.status.CANCELLED": "Storniert",
	// Formular-Dialog (Anlegen/Bearbeiten)
	"charges.actions.create": "Neue Sollstellung",
	"charges.actions.markPaid": "Als bezahlt markieren",
	"charges.dialog.createTitle": "Neue Hausgeld-Sollstellung",
	"charges.dialog.editTitle": "Hausgeld bearbeiten",
	"charges.dialog.description":
		"Manuelle Erfassung einer Hausgeld-Sollstellung außerhalb des automatischen Fälligstellens aus dem Wirtschaftsplan.",
	"charges.fields.amount": "Betrag (€)",
	"charges.fields.dueDate": "Fällig am",
	"charges.fields.purpose": "Verwendungszweck",
	"charges.placeholder.unit": "Einheit auswählen",
	"charges.placeholder.owner": "Eigentümer auswählen",
	"charges.placeholder.purpose": "z. B. Hausgeld Januar 2026",
	// Fälligstellen-Dialog (aus dem Wirtschaftsplan)
	"charges.actions.generate": "Hausgeld fällig stellen",
	"charges.actions.makeDue": "Fällig stellen",
	"charges.dialog.generateTitle": "Hausgeld für dieses Geschäftsjahr fällig stellen",
	"charges.dialog.generateDescription":
		"Legt für jede Einheit und jeden Monat des Geschäftsjahres eine Hausgeld-Sollstellung anhand des Einzelwirtschaftsplans an. Der Eigentümer wird je Monat aus den erfassten Eigentumsverhältnissen ermittelt (unterjähriger Wechsel wird berücksichtigt). Bereits vorhandene Sollstellungen werden nicht doppelt angelegt.",
	"charges.dialog.generatedTitle": "Fällig gestellt",
	"charges.fields.dueDay": "Fällig jeweils am (Tag des Monats)",
	"charges.fields.dueDayHint": "Tag zwischen 1 und 28, um für jeden Monat ein gültiges Datum zu garantieren.",
	// Fehlermeldungen der Server Actions
	"charges.errors.requiredFields": "Bitte Einheit, Eigentümer, Fälligkeitsdatum und Betrag angeben.",
	"charges.errors.saveFailed": "Die Hausgeld-Sollstellung konnte nicht gespeichert werden.",
	"charges.errors.markPaidFailed": "Sollstellung konnte nicht als bezahlt markiert werden.",
	"charges.errors.deleteFailed": "Die Hausgeld-Sollstellung konnte nicht gelöscht werden.",

	// ============================================================
	// Erhaltungsrücklage (reserveFundBookings)
	// ============================================================
	"reserve.title": "Rücklage",
	"reserve.description": "Erhaltungsrücklage-Kontobuch je WEG.",
	"reserve.selectHoa": "Wählen Sie oben eine WEG aus, um die Erhaltungsrücklage einzusehen oder zu bearbeiten.",
	// Kennzahlen (vereinfachter Vermögensbericht, § 28 Abs. 4 WEG)
	"reserve.stats.reserveFund": "Erhaltungsrücklage",
	"reserve.stats.openReceivables": "Offene Hausgeldforderungen",
	"reserve.stats.totalAssets": "Vermögen (vereinfacht)",
	"reserve.wealthReportNote":
		"Vereinfachter Vermögensbericht (§ 28 Abs. 4 WEG): Summe aus Erhaltungsrücklage und offenen Hausgeldforderungen. Ersetzt keine vollständige Bankbuchhaltung - der tatsächliche Kontostand des Gemeinschaftskontos ist weiterhin außerhalb dieser App zu führen.",
	"reserve.ledgerTitle": "Rücklagen-Kontobuch",
	"reserve.empty": "Noch keine Rücklagenbuchungen erfasst.",
	// Tabellenköpfe
	"reserve.table.description": "Bezeichnung",
	"reserve.table.type": "Art",
	"reserve.table.balance": "Saldo",
	// Buchungsarten
	"reserve.bookingType.CONTRIBUTION": "Zuführung",
	"reserve.bookingType.WITHDRAWAL": "Entnahme",
	// Lösch-Bestätigung (ConfirmDeleteButton)
	"reserve.confirm.delete": "Diese Buchung wirklich löschen?",
	// Formular-Dialog (Anlegen/Bearbeiten)
	"reserve.actions.create": "Neue Buchung",
	"reserve.dialog.createTitle": "Neue Rücklagenbuchung",
	"reserve.dialog.editTitle": "Rücklagenbuchung bearbeiten",
	"reserve.dialog.description": "Zuführung oder Entnahme der Erhaltungsrücklage.",
	"reserve.fields.type": "Buchungsart",
	"reserve.fields.amount": "Betrag (€)",
	"reserve.fields.description": "Bezeichnung",
	"reserve.placeholder.description": "z. B. Dachreparatur",
	// Fehlermeldungen der Server Actions
	"reserve.errors.requiredFields": "Bitte Datum, Betrag und Bezeichnung der Buchung angeben.",
	"reserve.errors.invalidType": "Ungültige Buchungsart.",
	"reserve.errors.amountPositive": "Der Betrag muss größer als 0 sein (die Buchungsart bestimmt das Vorzeichen).",
	"reserve.errors.saveFailed": "Die Buchung konnte nicht gespeichert werden.",
	"reserve.errors.deleteFailed": "Die Buchung konnte nicht gelöscht werden.",

	// ============================================================
	// WEG-Buchhaltung (/weg/buchhaltung, geteilte liegenschaftsbezogene
	// Tabellen mit der Mietverwaltung - WEG-Sicht mit Hausgeld-Zielen)
	// ============================================================
	"banking.title": "WEG-Buchhaltung",
	"banking.description": "Banktransaktionen und Konten je WEG - Zahlungseingänge von Eigentümern gegen Hausgeld-Sollstellungen buchen.",
	"banking.info":
		"Erfassen Sie die Bewegungen des Gemeinschaftskontos der WEG und ordnen Sie sie Konten (z. B. Gebäudeversicherung) oder offenen Hausgeld-Sollstellungen zu. Vollständig zugeordnete Hausgelder gelten automatisch als bezahlt und fließen so als tatsächlich geleistete Vorauszahlungen in die Jahresabrechnung ein.",
	"banking.selectHoa": "Wählen Sie oben eine WEG aus, um Konten anzusehen oder zu verwalten.",
};
