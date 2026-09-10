/**
 * Namespace "hoaPlan" (Deutsch): WEG-Modul "Wirtschaftsplan" - Listen- und
 * Detail-Seite, Formular-Dialog, Finalisierung, Hausgeld-Fälligstellung und
 * Meldungen der Server Actions. Enthält außerdem die Texte des geteilten
 * Kostenpositionen-Dialogs (hoa-cost-item-form-dialog.tsx), der auch von der
 * Jahresabrechnung genutzt wird, sowie die Kostenarten-/Umlageschlüssel-
 * Beschriftungen (identische Werte im Namespace "hoaStatement").
 */
export const hoaPlan = {
	// Listen-Seite
	title: "Wirtschaftspläne",
	description: "Wirtschaftspläne je WEG und Geschäftsjahr.",
	"empty.noHoa": "Legen Sie zuerst unter „WEG-Verwaltung“ eine WEG an.",
	empty: "Noch keine Wirtschaftspläne angelegt.",
	"table.hoa": "WEG",
	"table.fiscalYear": "Geschäftsjahr",
	"confirm.delete": "Diesen Wirtschaftsplan wirklich löschen?",
	// Status-Badges
	"status.DRAFT": "Entwurf",
	"status.FINALIZED": "Finalisiert",
	// Detail-Seite
	"detail.title": "Wirtschaftsplan: {name}",
	"costItems.heading": "Kostenpositionen ({from} – {to})",
	"costItems.empty": "Noch keine Kostenpositionen erfasst.",
	"costItems.fallbackLabel": "Kostenposition",
	"table.label": "Bezeichnung",
	"table.category": "Kostenart",
	"table.allocationKey": "Umlageschlüssel",
	"confirm.deleteCostItem": "Kostenposition \"{label}\" wirklich löschen?",
	"warnings.noBasis":
		"konnte nicht umgelegt werden: Es liegt keine gültige Verteilungsgrundlage vor (z. B. fehlender MEA-Anteil oder fehlende Wohnfläche).",
	"unitShares.heading": "Einzelwirtschaftsplan je Einheit",
	"unitShares.emptyDraft": "Noch keine berechenbaren Kostenpositionen vorhanden.",
	"unitShares.emptyFinalized": "Keine Einzelwirtschaftsplan-Ergebnisse vorhanden.",
	"table.annualAmount": "Jahresbetrag",
	"table.monthlyAmount": "Monatsbetrag",
	// Kostenarten (Enum HoaCostCategory)
	"category.RESERVE_CONTRIBUTION": "Zuführung Erhaltungsrücklage",
	"category.ADMINISTRATOR_FEE": "Verwaltervergütung",
	"category.INSURANCE": "Versicherung",
	"category.CARETAKER": "Hauswart",
	"category.MAINTENANCE_REPAIR": "Instandhaltung/Reparatur",
	"category.WATER_DRAINAGE": "Wasser/Abwasser",
	"category.HEATING": "Heizung",
	"category.ELECTRICITY_COMMON": "Strom Gemeinschaftsflächen",
	"category.CLEANING": "Reinigung",
	"category.GARDEN_MAINTENANCE": "Gartenpflege",
	"category.ELEVATOR": "Aufzug",
	"category.LEGAL_ADVICE": "Rechts-/Steuerberatung",
	"category.BANK_FEES": "Bankgebühren",
	"category.OTHER": "Sonstige Kosten",
	// Umlageschlüssel (Enum HoaAllocationKey)
	"allocationKey.MEA": "Miteigentumsanteile (MEA)",
	"allocationKey.LIVING_SPACE": "Wohnfläche",
	"allocationKey.UNITS": "Einheiten",
	"allocationKey.CONSUMPTION": "Verbrauch",
	"allocationKey.DIRECT": "Direkte Zuordnung",
	"allocationKey.CUSTOM": "Frei definierter Schlüssel",
	// Formular-Dialog (Anlegen/Bearbeiten)
	"actions.create": "Neuer Wirtschaftsplan",
	"dialog.createTitle": "Neuer Wirtschaftsplan",
	"dialog.editTitle": "Wirtschaftsplan bearbeiten",
	"dialog.description": "Geschäftsjahr (üblicherweise ein Kalenderjahr), für das die geplanten Kosten umgelegt werden.",
	"fields.fiscalYearFrom": "Geschäftsjahr von",
	"fields.fiscalYearTo": "Geschäftsjahr bis",
	// Finalisierung (Button + Bestätigung)
	"actions.finalize": "Wirtschaftsplan finalisieren",
	"confirm.finalize":
		"Diesen Wirtschaftsplan wirklich finalisieren? Danach können Kostenpositionen und Zeitraum nicht mehr geändert werden.",
	// Geteilter Kostenpositionen-Dialog (hoa-cost-item-form-dialog.tsx,
	// wird auch von der Jahresabrechnung verwendet)
	"costItem.add": "Kostenposition",
	"costItem.createTitle": "Neue Kostenposition",
	"costItem.editTitle": "Kostenposition bearbeiten",
	"costItem.description": "Kostenart und Umlageschlüssel für die WEG-Verwaltung.",
	"costItem.fieldLabel": "Bezeichnung",
	"costItem.labelPlaceholder": "z. B. Gebäudeversicherung",
	"costItem.fieldCategory": "Kostenart",
	"costItem.fieldAmount": "Betrag (€)",
	"costItem.fieldAllocationKey": "Umlageschlüssel",
	"costItem.fieldDirectUnit": "Einheit (direkte Zuordnung)",
	"costItem.fieldCustomAllocationKey": "Verteilerschlüssel",
	"costItem.fieldApportionable": "Umlagefähig auf Mieter (BetrKV)",
	"costItem.selectUnit": "Einheit auswählen",
	"costItem.selectCustomAllocationKey": "Verteilerschlüssel auswählen",
	"costItem.noCustomKeys": "Legen Sie zuerst unter „Verteilerschlüssel“ einen frei definierten Schlüssel an.",
	"costItem.consumptionHint":
		"Die Verbrauchswerte je Einheit können nach dem Speichern über die Tabellenzeile dieser Kostenposition erfasst werden.",
	// Fehlermeldungen der Server Actions
	"errors.notFound": "Der Wirtschaftsplan wurde nicht gefunden.",
	"errors.alreadyFinalized": "Dieser Wirtschaftsplan ist bereits finalisiert und kann nicht mehr geändert werden.",
	"errors.fiscalYearRequired": "Bitte das Geschäftsjahr (von/bis) angeben.",
	"errors.fiscalYearOrder": "Das Ende des Geschäftsjahres darf nicht vor dessen Beginn liegen.",
	"errors.saveFailed": "Der Wirtschaftsplan konnte nicht gespeichert werden.",
	"errors.deleteFailed": "Der Wirtschaftsplan konnte nicht gelöscht werden.",
	"errors.costItemRequired": "Bitte Bezeichnung, Betrag und Umlageschlüssel angeben.",
	"errors.invalidAllocationKey": "Ungültiger Umlageschlüssel.",
	"errors.directUnitRequired": "Bei direkter Zuordnung muss eine Einheit ausgewählt werden.",
	"errors.customKeyRequired": "Bei einem frei definierten Schlüssel muss dieser ausgewählt werden.",
	"errors.costItemSaveFailed": "Die Kostenposition konnte nicht gespeichert werden.",
	"errors.costItemDeleteFailed": "Die Kostenposition konnte nicht gelöscht werden.",
	"errors.alreadyFinalizedShort": "Dieser Wirtschaftsplan wurde bereits finalisiert.",
	"errors.noCostItems": "Bitte erfassen Sie mindestens eine Kostenposition, bevor Sie finalisieren.",
	"errors.noUnits": "Diese Liegenschaft hat noch keine Einheiten.",
	"errors.finalizeFailed": "Der Wirtschaftsplan konnte nicht finalisiert werden.",
	"errors.dueDayRange": "Der Fälligkeitstag muss zwischen 1 und 28 liegen.",
	"errors.chargesRequireFinalized": "Hausgeld kann erst fällig gestellt werden, wenn der Wirtschaftsplan finalisiert wurde.",
	"errors.chargesFailed": "Die Hausgeld-Sollstellungen konnten nicht angelegt werden.",
	// Erfolgsmeldungen der Hausgeld-Fälligstellung
	"success.chargesNoneExisting":
		"Keine neuen Sollstellungen angelegt - für alle {skipped} Einheit/Monat-Kombinationen existierten bereits Sollstellungen.",
	"success.chargesNoneNoOwner": "Für keine der Einheiten war zum jeweiligen Fälligkeitsmonat ein Eigentümer erfasst.",
	"success.chargesNoneNoShares": "Keine Einheiten mit Einzelwirtschaftsplan gefunden.",
	"success.chargesCreated.one": "{created} Hausgeld-Sollstellung angelegt",
	"success.chargesCreated.other": "{created} Hausgeld-Sollstellungen angelegt",
	"success.chargesExistingHint": "{skipped} bereits vorhanden",
	"success.chargesNoOwnerHint": "{skippedNoOwner} ohne erfassten Eigentümer übersprungen",
};
