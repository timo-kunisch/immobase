/**
 * Namespace "hoaStatement" (Deutsch): WEG-Modul "Jahresabrechnung" - Listen-
 * und Detail-Seite, Formular-Dialog, Finalisierung, Notizen, Verbrauchswerte-
 * Dialog, Banking-Import, PDF/Postversand, Plausibilitätsprüfung, BetrKV-
 * Brücke und Meldungen der Server Actions. Die Umlageschlüssel-Beschriftungen
 * entsprechen denen des Namespace "hoaPlan" (geteilter Kostenpositionen-
 * Dialog, siehe dort).
 */
export const hoaStatement = {
	// Listen-Seite
	title: "Jahresabrechnungen",
	description: "Jahresabrechnungen je WEG und Abrechnungszeitraum.",
	"empty.noHoa": "Legen Sie zuerst unter „WEG-Verwaltung“ eine WEG an.",
	empty: "Noch keine Jahresabrechnungen angelegt.",
	"table.hoa": "WEG",
	"table.period": "Zeitraum",
	"confirm.delete": "Diese Jahresabrechnung wirklich löschen?",
	"confirm.deleteFinalized":
		"Diese finalisierte Jahresabrechnung wirklich löschen? Alle eingefrorenen Einzelabrechnungen, erzeugten PDFs und Postversand-Protokolle werden mitgelöscht.",
	// Status-Badges
	"status.DRAFT": "Entwurf",
	"status.FINALIZED": "Finalisiert",
	// Detail-Seite (Kostenpositionen)
	"detail.title": "Jahresabrechnung: {name}",
	"costItems.heading": "Kostenpositionen ({from} – {to})",
	"costItems.empty": "Noch keine Kostenpositionen erfasst.",
	"costItems.fallbackLabel": "Kostenposition",
	"table.label": "Bezeichnung",
	"table.allocationKey": "Umlageschlüssel",
	"table.apportionable": "Umlagefähig",
	"confirm.deleteCostItem": "Kostenposition \"{label}\" wirklich löschen?",
	"warnings.noBasis": "konnte nicht umgelegt werden: Es liegt keine gültige Verteilungsgrundlage vor.",
	// Notizen (Karte + Dialog, jederzeit bearbeitbar - auch nach Finalisierung)
	"notesDialog.trigger": "Notizen",
	"notesDialog.title": "Notizen zur Jahresabrechnung",
	"notesDialog.description": "Interne Anmerkungen zur Abrechnung - jederzeit bearbeitbar, auch nach der Finalisierung.",
	"fields.notesPlaceholder": "Interne Anmerkungen zur Jahresabrechnung …",
	// Plausibilitätsprüfung vor der Finalisierung
	"consistency.unassignedCosts":
		"Die Summe der Einzelabrechnungen weicht um {amount} von den Kostenpositionen ab (z. B. Tage ohne erfasstes Eigentumsverhältnis oder Cent-Rundung).",
	"consistency.planDeviation":
		"Abweichung vom finalisierten Wirtschaftsplan {year}: geplant {planned}, tatsächlich {actual} (Differenz {difference}).",
	"consistency.housingChargeArrears":
		"Es gibt {count} offene/überfällige Hausgeld-Sollstellung(en) mit insgesamt {amount} im Abrechnungszeitraum - offene Beträge fließen bewusst NICHT als Vorauszahlung in die Abrechnung ein.",
	"consistency.noEconomicPlan": "Kein finalisierter Wirtschaftsplan überlappt den Abrechnungszeitraum - Plan-/Ist-Abgleich nicht möglich.",
	// Detail-Seite (Einzelabrechnung je Eigentümer-Zeitanteil)
	"results.heading": "Einzelabrechnung je Eigentümer-Zeitanteil",
	"results.emptyDraft": "Für den gewählten Zeitraum wurden keine Eigentumsverhältnisse gefunden.",
	"results.emptyFinalized": "Keine Abrechnungsergebnisse vorhanden.",
	"results.noPaidPrepayments": "Keine bezahlten Vorauszahlungen erfasst",
	"table.ownerUnit": "Eigentümer / Einheit",
	"table.timeShare": "Zeitanteil",
	"table.allocatedCosts": "Umgelegte Kosten",
	"table.prepayments": "Vorauszahlungen",
	"table.balance": "Saldo",
	"table.pdf": "PDF",
	"table.betrkv": "BetrKV",
	"results.days": "{days} Tage",
	"results.balanceDue": "Nachzahlung {amount}",
	"results.balanceCredit": "Guthaben {amount}",
	// Umlageschlüssel (Enum HoaAllocationKey, gleiche Werte wie Namespace "hoaPlan")
	"allocationKey.MEA": "Miteigentumsanteile (MEA)",
	"allocationKey.LIVING_SPACE": "Wohnfläche",
	"allocationKey.UNITS": "Einheiten",
	"allocationKey.CONSUMPTION": "Verbrauch",
	"allocationKey.DIRECT": "Direkte Zuordnung",
	"allocationKey.CUSTOM": "Frei definierter Schlüssel",
	// Formular-Dialog (Anlegen/Bearbeiten)
	"actions.create": "Neue Jahresabrechnung",
	"dialog.createTitle": "Neue Jahresabrechnung",
	"dialog.editTitle": "Jahresabrechnung bearbeiten",
	"dialog.description": "Abrechnungszeitraum (i. d. R. ein Kalenderjahr) für die Hausgeldabrechnung.",
	"fields.periodFrom": "Zeitraum von",
	"fields.periodTo": "Zeitraum bis",
	// Banking-Import („Aus Buchhaltung übernehmen")
	"bankingImport.trigger": "Aus Buchhaltung übernehmen",
	"bankingImport.title": "Kontobewegungen übernehmen",
	"bankingImport.description":
		"Je Konto wird EINE Kostenposition in Höhe der Nettosumme seiner Buchungen im Abrechnungszeitraum angelegt (Erstattungen werden verrechnet, Buchungen gegen Hausgeld-Sollstellungen bleiben ausgenommen).",
	"bankingImport.emptyTrigger": "Keine Kontobewegungen im Abrechnungszeitraum.",
	"bankingImport.table.account": "Konto",
	"bankingImport.table.bookings": "Buchungen",
	"bankingImport.table.costItem": "Kostenposition",
	"bankingImport.allocationKey": "Verteilerschlüssel",
	"bankingImport.hint.editable": "Der Schlüssel gilt einheitlich für alle importierten Positionen und kann je Position nachträglich geändert werden.",
	"bankingImport.submit": "Übernehmen",
	// Finalisierung (Button + Bestätigung)
	"actions.finalize": "Jahresabrechnung finalisieren",
	"confirm.finalize":
		"Diese Jahresabrechnung wirklich finalisieren? Danach können Kostenpositionen, Verbrauchswerte und Zeitraum nicht mehr geändert werden.",
	"confirm.finalizeWithIssues":
		"Die Plausibilitätsprüfung hat {count} offene(n) Hinweis(e) (siehe Karte oben). Diese Jahresabrechnung trotzdem finalisieren? Danach kann sie nicht mehr geändert werden.",
	// PDF-Erzeugung + Postversand (je Eigentümer-Einzelabrechnung)
	"actions.generatePdf": "PDF erzeugen",
	"actions.viewPdf": "Ansehen",
	"actions.regeneratePdf": "PDF neu erzeugen",
	"actions.generateAllPdfs": "PDF für alle Eigentümer",
	// Verbrauchswerte-Dialog
	"consumption.action": "Verbrauchswerte erfassen",
	"consumption.title": "Verbrauchswerte: {label}",
	"consumption.description": "Verbrauch je Einheit für den Abrechnungszeitraum.",
	"consumption.noUnits": "Diese Liegenschaft hat noch keine Einheiten.",
	// BetrKV-Brücke-Dialog
	"bridge.title": "In Nebenkostenabrechnung übernehmen",
	"bridge.description":
		"Überträgt die umlagefähigen Kostenpositionen dieser WEG-Einzelabrechnung als direkt zugeordnete Kostenpositionen in eine bestehende Nebenkostenabrechnungsperiode dieser Einheit. Nicht umlagefähige Positionen (z. B. Verwaltervergütung, Rücklage) werden nicht übertragen.",
	"bridge.field": "Abrechnungsperiode",
	"bridge.placeholder": "Abrechnungsperiode auswählen",
	"bridge.submit": "Übernehmen",
	// Fehlermeldungen der Server Actions
	"errors.notFound": "Die Jahresabrechnung wurde nicht gefunden.",
	"errors.statementNotFound": "Die Einzelabrechnung wurde nicht gefunden.",
	"errors.alreadyFinalized": "Diese Jahresabrechnung ist bereits finalisiert und kann nicht mehr geändert werden.",
	"errors.periodRequired": "Bitte den Abrechnungszeitraum (von/bis) angeben.",
	"errors.periodOrder": "Das Ende des Zeitraums darf nicht vor dem Beginn liegen.",
	"errors.saveFailed": "Die Jahresabrechnung konnte nicht gespeichert werden.",
	"errors.deleteFailed": "Die Jahresabrechnung konnte nicht gelöscht werden.",
	"errors.costItemRequired": "Bitte Bezeichnung, Betrag und Umlageschlüssel angeben.",
	"errors.invalidAllocationKey": "Ungültiger Umlageschlüssel.",
	"errors.directUnitRequired": "Bei direkter Zuordnung muss eine Einheit ausgewählt werden.",
	"errors.customKeyRequired": "Bei einem frei definierten Schlüssel muss dieser ausgewählt werden.",
	"errors.costItemSaveFailed": "Die Kostenposition konnte nicht gespeichert werden.",
	"errors.costItemDeleteFailed": "Die Kostenposition konnte nicht gelöscht werden.",
	"errors.invalidCostItem": "Ungültige Kostenposition.",
	"errors.costItemNotFound": "Die Kostenposition wurde nicht gefunden.",
	"errors.consumptionSaveFailed": "Die Verbrauchswerte konnten nicht gespeichert werden.",
	"errors.bankingImportNothingFound": "Im Abrechnungszeitraum wurden keine Kontobewegungen gefunden, die übernommen werden könnten.",
	"errors.bankingImportFailed": "Der Import aus der Buchhaltung ist fehlgeschlagen.",
	"errors.alreadyFinalizedShort": "Diese Jahresabrechnung wurde bereits finalisiert.",
	"errors.noCostItems": "Bitte erfassen Sie mindestens eine Kostenposition, bevor Sie finalisieren.",
	"errors.noOwnerships": "Für den gewählten Zeitraum wurden keine Eigentumsverhältnisse gefunden, die abgerechnet werden könnten.",
	"errors.finalizeFailed": "Die Jahresabrechnung konnte nicht finalisiert werden.",
	"errors.pdfFailed": "Das PDF konnte nicht erzeugt werden.",
	"errors.pdfRequiresFinalized": "PDFs können nur für finalisierte Jahresabrechnungen erzeugt werden.",
	"errors.somePdfsFailed": "{failed} von {total} PDFs konnten nicht erzeugt werden.",
	"errors.pdfRequiredBeforePost": "Bitte erzeugen Sie zuerst das PDF, bevor Sie es per Post versenden.",
	"errors.bridgeNoPeriod": "Bitte eine Nebenkostenabrechnungsperiode auswählen.",
	"errors.bridgeResultNotFound": "Die WEG-Einzelabrechnung wurde nicht gefunden.",
	"errors.bridgePeriodNotFound": "Die Nebenkostenabrechnungsperiode wurde nicht gefunden.",
	"errors.bridgePeriodFinalized": "Diese Abrechnungsperiode ist bereits finalisiert und kann nicht mehr geändert werden.",
	"errors.bridgePeriodMismatch": "Die gewählte Abrechnungsperiode gehört nicht zur Liegenschaft dieser Einheit.",
	"errors.bridgeNoApportionable": "Diese WEG-Einzelabrechnung enthält keine umlagefähigen Positionen.",
	"errors.bridgeFailed": "Der Übertrag in die Nebenkostenabrechnung ist fehlgeschlagen.",
	// Erfolgsmeldungen
	"success.bridged.one": "{count} Kostenposition übertragen.",
	"success.bridged.other": "{count} Kostenpositionen übertragen.",
	"success.bankingImport.one": "{count} Kostenposition aus der Buchhaltung übernommen.",
	"success.bankingImport.other": "{count} Kostenpositionen aus der Buchhaltung übernommen.",
};
