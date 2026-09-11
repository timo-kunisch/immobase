import { tenants as deTenants } from "../de/tenants";

/** Englische Übersetzungen des Namespace "tenants" (Parität per Typ erzwungen). */
export const tenants: typeof deTenants = {
	title: "Tenants",
	description: "All tenants at a glance.",
	empty: "No tenants created yet.",
	// Table columns (name/actions via "common")
	"table.contact": "Contact",
	"table.address": "Address",
	"table.linked": "Linked",
	// Labels of the CountLinkBadges in the "Linked" column
	"linked.leases": "Leases",
	"linked.documents": "Documents",
	"linked.letters": "Letters",
	// Delete confirmation (ConfirmDeleteButton)
	"confirm.delete": "Really delete tenant \"{name}\"?",
	// Form dialog (create/edit)
	"dialog.createTitle": "New tenant",
	"dialog.editTitle": "Edit tenant",
	"dialog.description": "Master data of the tenant for lease management.",
	// Postal address fields (optional; NULL = delivery to the rented unit)
	"fields.street": "Street & house number",
	"fields.zipCode": "Postal code",
	"fields.city": "City",
	"fields.country": "Country",
	"fields.countryDefault": "Germany",
	// Error messages of the server actions
	"errors.nameRequired": "Please enter first and last name.",
	"errors.saveFailed": "The tenant could not be saved.",
	"errors.deleteFailed": "Deletion failed. Please remove all associated leases first.",
};
