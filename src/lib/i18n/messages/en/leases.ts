import { leases as deLeases } from "../de/leases";

/** Englische Übersetzungen des Namespace "leases" (Parität per Typ erzwungen). */
export const leases: typeof deLeases = {
	title: "Leases",
	description: "All leases incl. base rent and service charges.",
	empty: "No leases created yet.",
	emptyFiltered: "No leases found for this selection.",
	// Filter hint line above the table (reset via "common.resetFilters")
	"filter.filteredBy": "Filtered by:",
	// Table columns (unit/tenant/status/actions via "common")
	"table.period": "Period",
	"table.coldRentCurrent": "Base rent (current)",
	"table.serviceChargesCurrent": "Service charges (current)",
	// Period cell without a lease end ("from – open")
	"period.open": "open",
	// Lease status (derived from lease start/end, see src/lib/lease-status.ts)
	"status.ACTIVE": "Active",
	"status.UPCOMING": "Upcoming",
	"status.ENDED": "Ended",
	// Row actions (icon buttons, aria-label/title)
	"actions.finances": "Finances for this lease",
	"actions.letters": "Letters for this lease",
	// Form dialog (create/edit)
	"dialog.createTitle": "New lease",
	"dialog.editTitle": "Edit lease",
	"dialog.description": "Links a tenant to a rental unit incl. terms.",
	"fields.unit": "Rental unit",
	"fields.selectUnit": "Select unit",
	"fields.selectTenant": "Select tenant",
	"fields.startDate": "Lease start",
	"fields.endDate": "Lease end",
	"fields.coldRent": "Base rent (€)",
	"fields.serviceCharges": "Service charges (€)",
	"fields.deposit": "Security deposit (€)",
	// Rent/service charge adjustment (RentAdjustmentFormDialog)
	"adjustment.add": "Record adjustment",
	"adjustment.createTitle": "Rent/service charge adjustment",
	"adjustment.editTitle": "Edit adjustment",
	"adjustment.description":
		"From the selected date, the new base rent/service charges apply. The previous amount is kept for the period before.",
	"adjustment.fields.validFrom": "Valid from",
	"adjustment.fields.notesPlaceholder": "e.g. rent increase under § 558 BGB",
	// History dialog (RentHistoryDialog)
	"history.triggerHistory": "History of rent/service charges",
	"history.triggerAdd": "Record rent/service charge adjustment",
	"history.title": "History of the agreed payments",
	"history.description":
		"Overview of all base rent/service charge amounts over the lease term incl. later adjustments (e.g. rent increases).",
	"history.table.validUntil": "Valid until",
	"history.table.coldRent": "Base rent",
	"history.table.serviceCharges": "Service charges",
	"history.table.note": "Note",
	"history.ongoing": "ongoing",
	"history.initialAmount": "Original lease amount",
	// Delete confirmations (ConfirmDeleteButton)
	"confirm.delete": "Really delete this lease?",
	"confirm.deleteAdjustment": "Really delete this adjustment?",
	// Error messages of the server actions
	"errors.requiredFields": "Please select unit & tenant and enter lease start, base rent and service charges.",
	"errors.saveFailed": "The lease could not be saved.",
	"errors.deleteFailed": "The lease could not be deleted.",
	"errors.adjustmentRequiredFields": "Please enter valid-from date, base rent and service charges.",
	"errors.leaseNotFound": "The associated lease was not found.",
	"errors.validFromAfterStart":
		"The valid-from date must be after the lease start (the amount at lease start is maintained directly in the lease).",
	"errors.adjustmentSaveFailed": "The adjustment could not be saved. Does an entry already exist for this date?",
	"errors.adjustmentDeleteFailed": "The adjustment could not be deleted.",
};
