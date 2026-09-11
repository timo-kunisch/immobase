import { hoaFinance as deHoaFinance } from "../de/hoaFinance";

/** Englische Übersetzungen des Namespace "hoaFinance" (Parität per Typ erzwungen). */
export const hoaFinance: typeof deHoaFinance = {
	// Empty state (no HOA created yet)
	noHoas: "Please create an HOA under “HOA management” first.",

	// ============================================================
	// HOA fees (housingCharges)
	// ============================================================
	"charges.title": "HOA fees",
	"charges.description": "HOA fee charges per HOA and owner.",
	"charges.empty": "No HOA fee charges recorded yet.",
	// Arrears notice card (the amount is prepended)
	"charges.arrears.suffix": "in HOA fee arrears (due/overdue charges).",
	// Table headers
	"charges.table.hoa": "HOA",
	"charges.table.ownerUnit": "Owner / Unit",
	"charges.table.purpose": "Purpose",
	"charges.table.dueDate": "Due date",
	// Delete confirmation (ConfirmDeleteButton)
	"charges.confirm.delete": "Really delete this HOA fee charge?",
	// Charge status (badge + select)
	"charges.status.OPEN": "Due",
	"charges.status.PAID": "Paid",
	"charges.status.OVERDUE": "Overdue",
	"charges.status.CANCELLED": "Cancelled",
	// Form dialog (create/edit)
	"charges.actions.create": "New charge",
	"charges.actions.markPaid": "Mark as paid",
	"charges.dialog.createTitle": "New HOA fee charge",
	"charges.dialog.editTitle": "Edit HOA fee",
	"charges.dialog.description": "Manual entry of an HOA fee charge outside the automatic due-date generation from the economic plan.",
	"charges.fields.amount": "Amount (€)",
	"charges.fields.dueDate": "Due date",
	"charges.fields.purpose": "Purpose",
	"charges.placeholder.unit": "Select unit",
	"charges.placeholder.owner": "Select owner",
	"charges.placeholder.purpose": "e.g. HOA fee January 2026",
	// Make-due dialog (from the economic plan)
	"charges.actions.generate": "Make HOA fees due",
	"charges.actions.makeDue": "Make due",
	"charges.dialog.generateTitle": "Make HOA fees due for this fiscal year",
	"charges.dialog.generateDescription":
		"Creates an HOA fee charge for each unit and each month of the fiscal year based on the individual economic plan. The owner is determined monthly from the recorded ownership (mid-year changes are taken into account). Existing charges are not duplicated.",
	"charges.dialog.generatedTitle": "Made due",
	"charges.fields.dueDay": "Due on (day of the month)",
	"charges.fields.dueDayHint": "Day between 1 and 28 to guarantee a valid date for every month.",
	// Server action error messages
	"charges.errors.requiredFields": "Please provide unit, owner, due date and amount.",
	"charges.errors.saveFailed": "The HOA fee charge could not be saved.",
	"charges.errors.markPaidFailed": "The charge could not be marked as paid.",
	"charges.errors.deleteFailed": "The HOA fee charge could not be deleted.",

	// ============================================================
	// Reserve fund (reserveFundBookings)
	// ============================================================
	"reserve.title": "Reserve fund",
	"reserve.description": "Reserve fund ledger per HOA.",
	"reserve.selectHoa": "Select an HOA above to view or edit the reserve fund.",
	// Key figures (simplified asset report, § 28 para. 4 German WEG Act)
	"reserve.stats.reserveFund": "Reserve fund",
	"reserve.stats.openReceivables": "Open HOA fee receivables",
	"reserve.stats.totalAssets": "Assets (simplified)",
	"reserve.wealthReportNote":
		"Simplified asset report (§ 28 para. 4 German WEG Act): sum of the reserve fund and open HOA fee receivables. It does not replace full bank accounting - the actual balance of the community account must still be maintained outside this app.",
	"reserve.ledgerTitle": "Reserve fund ledger",
	"reserve.empty": "No reserve fund bookings recorded yet.",
	// Table headers
	"reserve.table.description": "Description",
	"reserve.table.type": "Type",
	"reserve.table.balance": "Balance",
	// Booking types
	"reserve.bookingType.CONTRIBUTION": "Allocation",
	"reserve.bookingType.WITHDRAWAL": "Withdrawal",
	// Delete confirmation (ConfirmDeleteButton)
	"reserve.confirm.delete": "Really delete this booking?",
	// Form dialog (create/edit)
	"reserve.actions.create": "New booking",
	"reserve.dialog.createTitle": "New reserve fund booking",
	"reserve.dialog.editTitle": "Edit reserve fund booking",
	"reserve.dialog.description": "Allocation to or withdrawal from the reserve fund.",
	"reserve.fields.type": "Booking type",
	"reserve.fields.amount": "Amount (€)",
	"reserve.fields.description": "Description",
	"reserve.placeholder.description": "e.g. roof repair",
	// Server action error messages
	"reserve.errors.requiredFields": "Please provide date, amount and description of the booking.",
	"reserve.errors.invalidType": "Invalid booking type.",
	"reserve.errors.amountPositive": "The amount must be greater than 0 (the booking type determines the sign).",
	"reserve.errors.saveFailed": "The booking could not be saved.",
	"reserve.errors.deleteFailed": "The booking could not be deleted.",

	// ============================================================
	// HOA bookkeeping (/weg/buchhaltung, property-scoped tables shared with
	// the rental management - HOA view with housing charge targets)
	// ============================================================
	"banking.title": "HOA bookkeeping",
	"banking.description": "Bank transactions and accounts per HOA - book owners' incoming payments against housing charges.",
	"banking.info":
		"Record the movements of the HOA's community account and allocate them to accounts (e.g. building insurance) or open housing charges. Fully allocated housing charges automatically count as paid and thus flow into the annual statement as actually paid advance payments.",
	"banking.selectHoa": "Select an HOA above to view or manage accounts.",
};
