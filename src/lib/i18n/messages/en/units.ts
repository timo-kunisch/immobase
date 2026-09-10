import { units as deUnits } from "../de/units";

/** Englische Übersetzungen des Namespace "units" (Parität per Typ erzwungen). */
export const units: typeof deUnits = {
	title: "Rental units",
	description: "Apartments and commercial units per property.",
	noProperties: "Create a property first in order to add units.",
	empty: "No units created yet.",
	emptyFiltered: "No units found for this property.",
	// Table headers and cell content
	"table.livingSpace": "Living space",
	"table.linked": "Linked",
	areaValue: "{value} m²",
	roomsValue: " · {value} rms.",
	// Occupancy status (badge in the list)
	"status.rentedTo": "Rented to {firstName} {lastName}",
	"status.vacant": "Vacant",
	// CountLinkBadge labels (linked records)
	"badge.leases": "Leases",
	"badge.tickets": "Tickets",
	"badge.documents": "Documents",
	// Property filter above the list
	"filter.allProperties": "All properties",
	// Delete confirmation (ConfirmDeleteButton)
	"confirm.delete": "Really delete unit \"{name}\"?",
	// Form dialog
	"actions.create": "New unit",
	"dialog.createTitle": "New rental unit",
	"dialog.editTitle": "Edit unit",
	"dialog.description": "A rental unit always belongs to exactly one property.",
	"fields.label": "Name",
	"fields.floor": "Floor",
	"fields.livingSpace": "Living space (m²)",
	"fields.rooms": "Rooms",
	"fields.coOwnershipShare": "Co-ownership share (MEA)",
	"fields.coOwnershipShareHint": "Only relevant if the property is managed as a homeowners' association under “HOA” (/weg).",
	"placeholder.property": "Select property",
	"placeholder.label": "e.g. 1st floor left",
	"placeholder.floor": "Ground floor, 1st floor…",
	// Server action error messages
	"errors.requiredFields": "Please select a property and enter a name.",
	"errors.saveFailed": "The unit could not be saved.",
	"errors.deleteFailed": "Deletion failed. Please remove all associated leases first.",
};
