/**
 * Namespace "hoa" (Deutsch): WEG-Stammdaten (WEGs, Eigentümer,
 * Eigentumsverhältnisse, Verteilerschlüssel) + der modulübergreifende
 * WEG-Filter (HoaFilter, verwendet auf allen /weg/*-Seiten).
 */
export const hoa = {
	// WEG-Übersicht (/weg)
	title: "WEG-Verwaltung",
	description: "Wohnungseigentümergemeinschaften verwalten.",
	empty: "Noch keine WEG angelegt.",
	noHoa: "Legen Sie zuerst unter „WEG-Verwaltung“ eine WEG an.",
	"table.name": "Bezeichnung",
	"table.property": "Liegenschaft",
	"table.linked": "Verknüpft",
	// Beschriftungen der CountLinkBadges (verknüpfte Datensätze)
	"badge.units": "Einheiten",
	"badge.ownerships": "Eigentumsverhältnisse",
	// Lösch-Bestätigung (ConfirmDeleteButton)
	"confirm.delete": "WEG \"{name}\" wirklich löschen?",
	// WEG-Formular-Dialog
	"actions.create": "Neue WEG",
	"dialog.createTitle": "Neue Wohnungseigentümergemeinschaft",
	"dialog.editTitle": "WEG bearbeiten",
	"dialog.description": "Eine WEG ist immer genau einer bestehenden Liegenschaft zugeordnet.",
	"fields.name": "Bezeichnung",
	"fields.totalShares": "Gesamtsumme Miteigentumsanteile (MEA)",
	"fields.totalSharesHint": "Nenner laut Teilungserklärung, üblich sind z. B. 1000 oder 10000. Der Anteil je Einheit wird bei der Einheit selbst gepflegt.",
	"fields.bankIban": "IBAN (Gemeinschaftskonto)",
	"fields.bankBic": "BIC",
	"placeholder.name": "z. B. WEG Musterstraße 12",
	"placeholder.property": "Liegenschaft auswählen",
	"placeholder.bankIban": "DE...",
	"placeholder.notes": "Optionale interne Anmerkungen",
	// Fehlermeldungen der Server Actions
	"errors.requiredFields": "Bitte Liegenschaft, Bezeichnung und eine gültige Gesamtsumme der Miteigentumsanteile angeben.",
	"errors.saveFailed": "Die WEG konnte nicht gespeichert werden. Ist die Liegenschaft bereits einer anderen WEG zugeordnet?",
	"errors.deleteFailed": "Löschen fehlgeschlagen. Bitte entfernen Sie zuerst alle zugehörigen Wirtschaftspläne/Jahresabrechnungen/Versammlungen.",

	// Eigentümer (/weg/eigentuemer)
	"owners.title": "Eigentümer",
	"owners.description": "Alle Eigentümer im Überblick.",
	"owners.empty": "Noch keine Eigentümer angelegt.",
	"owners.table.address": "Anschrift",
	"owners.table.contact": "Kontakt",
	"owners.confirm.delete": "Eigentümer \"{name}\" wirklich löschen?",
	// Eigentümer-Formular-Dialog
	"owners.actions.create": "Neuer Eigentümer",
	"owners.dialog.createTitle": "Neuer Eigentümer",
	"owners.dialog.editTitle": "Eigentümer bearbeiten",
	"owners.dialog.description": "Stammdaten des Eigentümers für die WEG-Verwaltung.",
	"owners.fields.isCompany": "Institutioneller Eigentümer (z. B. GmbH)",
	"owners.fields.companyName": "Firmenname",
	"owners.fields.contactFirstName": "Ansprechpartner (Vorname)",
	"owners.fields.contactLastName": "Ansprechpartner (Nachname)",
	"owners.fields.street": "Straße & Hausnummer",
	"owners.fields.zipCode": "PLZ",
	"owners.fields.city": "Stadt",
	"owners.fields.country": "Land",
	"owners.errors.requiredFields": "Bitte geben Sie Name und vollständige Anschrift des Eigentümers an.",
	"owners.errors.saveFailed": "Der Eigentümer konnte nicht gespeichert werden.",
	"owners.errors.deleteFailed": "Löschen fehlgeschlagen. Bitte entfernen Sie zuerst alle zugehörigen Eigentumsverhältnisse.",

	// Eigentumsverhältnisse (/weg/eigentumsverhaeltnisse)
	"ownerships.title": "Eigentumsverhältnisse",
	"ownerships.description": "Eigentümer je Einheit, zeitversioniert bei Eigentümerwechsel.",
	"ownerships.empty": "Noch kein Eigentumsverhältnis erfasst.",
	"ownerships.noUnits": "Legen Sie zuerst Einheiten für diese Liegenschaft unter „Einheiten“ an.",
	"ownerships.table.period": "Zeitraum",
	"ownerships.meaValue": "MEA: {share} / {total}",
	"ownerships.livingSpaceSuffix": " · {value} m²",
	"ownerships.coOwnerValue": "Miteigentümer: {name}",
	"ownerships.ongoing": "laufend",
	// Status-Badges (Werte von OwnershipStatusValue aus src/lib/hoa-ownership.ts)
	"ownerships.status.ACTIVE": "Aktuell",
	"ownerships.status.UPCOMING": "Zukünftig",
	"ownerships.status.ENDED": "Beendet",
	"ownerships.confirm.delete": "Dieses Eigentumsverhältnis wirklich löschen?",
	// Eigentumsverhältnis-Formular-Dialog
	"ownerships.actions.create": "Eigentumsverhältnis",
	"ownerships.dialog.createTitle": "Eigentumsverhältnis erfassen",
	"ownerships.dialog.editTitle": "Eigentumsverhältnis bearbeiten",
	"ownerships.dialog.createDescription": "Bei einem Eigentümerwechsel wird das bisher laufende Eigentumsverhältnis dieser Einheit automatisch zum Vortag beendet.",
	"ownerships.dialog.editDescription": "Änderungen an einer bestehenden Zeile.",
	"ownerships.fields.coOwner": "Miteigentümer (z. B. Ehepartner)",
	"ownerships.fields.noCoOwner": "Kein Miteigentümer",
	"ownerships.fields.startDate": "Beginn",
	"ownerships.fields.startDateCreate": "Beginn (Eigentumsübergang)",
	"ownerships.placeholder.unit": "Einheit auswählen",
	"ownerships.placeholder.owner": "Eigentümer auswählen",
	"ownerships.placeholder.notes": "z. B. Notar, Kaufvertragsdatum",
	"ownerships.errors.requiredFields": "Bitte Einheit, Eigentümer und Beginn-Datum angeben.",
	"ownerships.errors.coOwnerSame": "Eigentümer und Miteigentümer dürfen nicht identisch sein.",
	"ownerships.errors.startDateNotAfterCurrent": "Das Beginn-Datum muss nach dem Beginn des aktuell laufenden Eigentumsverhältnisses dieser Einheit liegen.",
	"ownerships.errors.saveFailed": "Das Eigentumsverhältnis konnte nicht gespeichert werden.",
	"ownerships.errors.deleteFailed": "Das Eigentumsverhältnis konnte nicht gelöscht werden.",

	// Verteilerschlüssel (/weg/verteilerschluessel)
	"allocationKeys.title": "Verteilerschlüssel",
	"allocationKeys.description": "Frei definierte Verteilerschlüssel je WEG.",
	"allocationKeys.info": "Neben den festen Verteilerschlüsseln (Miteigentumsanteile, Wohnfläche, Einheiten, Verbrauch, direkte Zuordnung) können hier zusätzliche, frei definierte Verteilerschlüssel angelegt werden (z. B. „Anzahl Stellplätze“). Diese stehen anschließend bei Kostenpositionen im Wirtschaftsplan und der Jahresabrechnung zur Auswahl.",
	"allocationKeys.selectHoa": "Wählen Sie oben eine WEG aus, um Verteilerschlüssel anzulegen oder zu bearbeiten.",
	"allocationKeys.empty": "Noch keine frei definierten Verteilerschlüssel angelegt.",
	"allocationKeys.confirm.delete": "Verteilerschlüssel \"{name}\" wirklich löschen?",
	// Verteilerschlüssel-Formular-Dialog
	"allocationKeys.actions.create": "Neuer Verteilerschlüssel",
	"allocationKeys.dialog.createTitle": "Neuer frei definierter Verteilerschlüssel",
	"allocationKeys.dialog.editTitle": "Verteilerschlüssel bearbeiten",
	"allocationKeys.dialog.description": "Die Gewichte je Einheit werden nach dem Speichern erfasst.",
	"allocationKeys.placeholder.label": "z. B. Anzahl Stellplätze",
	// Gewichte-Dialog (je Einheit ein Gewicht)
	"allocationKeys.weights.open": "Gewichte je Einheit erfassen",
	"allocationKeys.weights.title": "Gewichte: {name}",
	"allocationKeys.weights.description": "Frei vergebbares Gewicht je Einheit für diesen Verteilerschlüssel.",
	"allocationKeys.weights.noUnits": "Diese Liegenschaft hat noch keine Einheiten.",
	"allocationKeys.errors.requiredFields": "Bitte eine Bezeichnung für den Verteilerschlüssel angeben.",
	"allocationKeys.errors.saveFailed": "Der Verteilerschlüssel konnte nicht gespeichert werden.",
	"allocationKeys.errors.deleteFailed": "Löschen fehlgeschlagen. Wird dieser Schlüssel noch von einer Kostenposition verwendet?",
	"allocationKeys.errors.invalidKey": "Ungültiger Verteilerschlüssel.",
	"allocationKeys.errors.weightsSaveFailed": "Die Gewichte konnten nicht gespeichert werden.",

	// Modulübergreifender WEG-Filter (HoaFilter)
	"filter.placeholder": "WEG auswählen",
	"filter.all": "Alle WEGs",
};
