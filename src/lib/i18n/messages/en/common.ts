import { common as deCommon } from "../de/common";

/**
 * Englische Übersetzungen des Namespace "common". Der Typ `typeof deCommon`
 * erzwingt zur Compile-Zeit vollständige Schlüssel-Parität mit Deutsch;
 * src/lib/i18n/messages.test.ts prüft sie zusätzlich zur Laufzeit.
 */
export const common: typeof deCommon = {
	appDescription: "Management of properties, rental units, tenants and leases",
	// Actions / buttons
	save: "Save",
	cancel: "Cancel",
	delete: "Delete",
	edit: "Edit",
	create: "Create",
	add: "Add",
	remove: "Remove",
	close: "Close",
	back: "Back",
	next: "Next",
	search: "Search",
	filter: "Filter",
	resetFilters: "Reset filters",
	all: "All",
	none: "None",
	yes: "Yes",
	no: "No",
	confirm: "Confirm",
	open: "Open",
	download: "Download",
	upload: "Upload",
	select: "Select",
	retry: "Try again",
	send: "Send",
	// States
	loading: "Loading…",
	pageLoading: "Page is loading",
	saving: "Saving…",
	error: "Error",
	success: "Success",
	optional: "optional",
	required: "required",
	// Field labels (recurring across modules)
	actions: "Actions",
	status: "Status",
	date: "Date",
	amount: "Amount",
	name: "Name",
	firstName: "First name",
	lastName: "Last name",
	email: "Email",
	phone: "Phone",
	address: "Address",
	notes: "Notes",
	description: "Description",
	details: "Details",
	total: "Total",
	from: "From",
	to: "To",
	year: "Year",
	today: "Today",
	// Core domain terms (used in several modules)
	property: "Property",
	unit: "Unit",
	tenant: "Tenant",
	owner: "Owner",
	// Placeholders in selects
	pleaseSelect: "Please select…",
	// SearchableSelect (searchable pick lists for dynamic data sets)
	"searchableSelect.searchPlaceholder": "Search…",
	"searchableSelect.noResults": "No results",
	// Default delete confirmation (ConfirmDeleteButton)
	confirmDeleteDefault: "Really delete this entry permanently?",
	// Pagination (client-side pagination of the DataTable; pageOf is also
	// used by messages.test.ts as an interpolation example)
	"pagination.pageOf": "Page {page} of {totalPages}",
	"pagination.previous": "Previous page",
	"pagination.next": "Next page",
	// DataTable (client-side sorting/filtering/pagination)
	"dataTable.sort": "Sort column",
	"dataTable.filter": "Filter column",
	"dataTable.filterPlaceholder": "Filter…",
	"dataTable.noMatches": "No entries match the current filters.",
	"dataTable.filteredCount": "{count} of {total}",
	"dataTable.entry.one": "{count} entry",
	"dataTable.entry.other": "{count} entries",
	"dataTable.showingRange": "{from}–{to} of {total}",
};
