/**
 * Namespace "units" (Deutsch): Modul "Einheiten" (Mieteinheiten) -
 * Listen-Seite, Formular-Dialog (Anlegen/Bearbeiten) und Meldungen
 * der Server Actions.
 */
export const units = {
	title: "Mieteinheiten",
	description: "Wohnungen und Gewerbeeinheiten je Liegenschaft.",
	noProperties: "Legen Sie zuerst eine Liegenschaft an, um Einheiten erfassen zu können.",
	empty: "Noch keine Einheiten angelegt.",
	emptyFiltered: "Keine Einheiten für diese Liegenschaft gefunden.",
	// Tabellenköpfe und Zelleninhalte
	"table.livingSpace": "Wohnfläche",
	"table.linked": "Verknüpft",
	areaValue: "{value} m²",
	roomsValue: " · {value} Zi.",
	// Vermietungs-Status (Badge in der Liste)
	"status.rented": "Vermietet",
	"status.rentedTo": "Vermietet an {firstName} {lastName}",
	"status.vacant": "Leerstand",
	// Beschriftungen der CountLinkBadges (verknüpfte Datensätze)
	"badge.leases": "Verträge",
	"badge.tickets": "Tickets",
	"badge.documents": "Dokumente",
	// Lösch-Bestätigung (ConfirmDeleteButton)
	"confirm.delete": "Einheit \"{name}\" wirklich löschen?",
	// Formular-Dialog
	"actions.create": "Neue Einheit",
	"dialog.createTitle": "Neue Mieteinheit",
	"dialog.editTitle": "Einheit bearbeiten",
	"dialog.description": "Eine Mieteinheit gehört immer zu genau einer Liegenschaft.",
	"fields.label": "Bezeichnung",
	"fields.floor": "Etage",
	"fields.livingSpace": "Wohnfläche (m²)",
	"fields.rooms": "Zimmer",
	"fields.coOwnershipShare": "Miteigentumsanteil (MEA)",
	"fields.coOwnershipShareHint":
		"Nur relevant, wenn die Liegenschaft unter „WEG“ (/weg) als Wohnungseigentümergemeinschaft verwaltet wird.",
	"placeholder.property": "Liegenschaft auswählen",
	"placeholder.label": "z. B. 1. OG links",
	"placeholder.floor": "EG, 1. OG…",
	// Fehlermeldungen der Server Actions
	"errors.requiredFields": "Bitte wählen Sie eine Liegenschaft und vergeben Sie eine Bezeichnung.",
	"errors.saveFailed": "Die Einheit konnte nicht gespeichert werden.",
	"errors.deleteFailed": "Löschen fehlgeschlagen. Bitte entfernen Sie zuerst alle zugehörigen Mietverträge.",
};
