import { properties as deProperties } from "../de/properties";

/** Englische Übersetzungen des Namespace "properties" (Parität per Typ erzwungen). */
export const properties: typeof deProperties = {
	title: "Properties",
	description: "Manage your buildings and properties.",
	empty: "No properties created yet.",
	// Table headers
	"table.name": "Name",
	"table.linked": "Linked",
	// CountLinkBadge labels (linked records)
	"badge.units": "Units",
	"badge.tickets": "Tickets",
	"badge.documents": "Documents",
	// Delete confirmation (ConfirmDeleteButton)
	"confirm.delete": "Really delete property \"{name}\"?",
	// Form dialog
	"actions.create": "New property",
	"dialog.createTitle": "New property",
	"dialog.editTitle": "Edit property",
	"dialog.description": "Enter the master data of the property (building/object).",
	"fields.name": "Name",
	"fields.street": "Street & house number",
	"fields.zipCode": "Postal code",
	"fields.city": "City",
	"fields.country": "Country",
	"fields.countryDefault": "Germany",
	"placeholder.name": "e.g. Sample Street 12",
	"placeholder.street": "Sample Street 12",
	"placeholder.zipCode": "12345",
	"placeholder.city": "Sample City",
	"placeholder.notes": "Optional internal notes",
	// Server action error messages
	"errors.requiredFields": "Please fill in all required fields.",
	"errors.saveFailed": "The property could not be saved.",
	"errors.deleteFailed": "Deletion failed. Please remove all associated units first.",
};
