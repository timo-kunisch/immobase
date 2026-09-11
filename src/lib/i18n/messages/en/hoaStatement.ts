import { hoaStatement as deHoaStatement } from "../de/hoaStatement";

/** Englische Übersetzungen des Namespace "hoaStatement" (Parität per Typ erzwungen). */
export const hoaStatement: typeof deHoaStatement = {
	// List page
	title: "Annual statements",
	description: "Annual statements per HOA and billing period.",
	"empty.noHoa": "Please create an HOA under “HOA management” first.",
	empty: "No annual statements created yet.",
	"table.hoa": "HOA",
	"table.period": "Period",
	"confirm.delete": "Really delete this annual statement?",
	"confirm.deleteFinalized":
		"Really delete this finalized annual statement? All frozen unit statements, generated PDFs and postal shipment records will be deleted as well.",
	// Status badges
	"status.DRAFT": "Draft",
	"status.FINALIZED": "Finalized",
	// Detail page (cost items)
	"detail.title": "Annual statement: {name}",
	"costItems.heading": "Cost items ({from} – {to})",
	"costItems.empty": "No cost items recorded yet.",
	"costItems.fallbackLabel": "Cost item",
	"table.label": "Label",
	"table.allocationKey": "Allocation key",
	"table.apportionable": "Apportionable",
	"confirm.deleteCostItem": "Really delete cost item \"{label}\"?",
	"warnings.noBasis": "could not be allocated: no valid allocation basis exists.",
	// Notes (card + dialog, editable at any time - even after finalization)
	"notesDialog.trigger": "Notes",
	"notesDialog.title": "Notes on the annual statement",
	"notesDialog.description": "Internal notes on the statement - editable at any time, even after finalization.",
	"fields.notesPlaceholder": "Internal notes on the annual statement …",
	// Consistency check before finalization
	"consistency.unassignedCosts":
		"The total of the unit statements differs by {amount} from the cost items (e.g. days without recorded ownership or cent rounding).",
	"consistency.planDeviation":
		"Deviation from the finalized economic plan {year}: planned {planned}, actual {actual} (difference {difference}).",
	"consistency.housingChargeArrears":
		"There are {count} open/overdue housing charge(s) totalling {amount} in the billing period - open amounts are deliberately NOT counted as advance payments.",
	"consistency.noEconomicPlan": "No finalized economic plan overlaps the billing period - plan/actual comparison not possible.",
	// Detail page (unit statement per owner time share)
	"results.heading": "Unit statement per owner time share",
	"results.emptyDraft": "No ownership records were found for the selected period.",
	"results.emptyFinalized": "No statement results available.",
	"results.noPaidPrepayments": "No paid advance payments recorded",
	"table.ownerUnit": "Owner / Unit",
	"table.timeShare": "Time share",
	"table.allocatedCosts": "Allocated costs",
	"table.prepayments": "Advance payments",
	"table.balance": "Balance",
	"table.pdf": "PDF",
	"table.betrkv": "BetrKV",
	"results.days": "{days} days",
	"results.balanceDue": "Payment due {amount}",
	"results.balanceCredit": "Credit {amount}",
	// Allocation keys (enum HoaAllocationKey, same values as namespace "hoaPlan")
	"allocationKey.MEA": "Co-ownership shares (MEA)",
	"allocationKey.LIVING_SPACE": "Living space",
	"allocationKey.UNITS": "Units",
	"allocationKey.CONSUMPTION": "Consumption",
	"allocationKey.DIRECT": "Direct allocation",
	"allocationKey.CUSTOM": "Custom key",
	// Form dialog (create/edit)
	"actions.create": "New annual statement",
	"dialog.createTitle": "New annual statement",
	"dialog.editTitle": "Edit annual statement",
	"dialog.description": "Billing period (usually a calendar year) for the HOA fee statement.",
	"fields.periodFrom": "Period from",
	"fields.periodTo": "Period to",
	// Banking import ("Import from bookkeeping")
	"bankingImport.trigger": "Import from bookkeeping",
	"bankingImport.title": "Import account transactions",
	"bankingImport.description":
		"One cost item is created per ACCOUNT with the net total of its bookings in the billing period (refunds are offset, bookings against housing charges are excluded).",
	"bankingImport.emptyTrigger": "No account transactions in the billing period.",
	"bankingImport.table.account": "Account",
	"bankingImport.table.bookings": "Bookings",
	"bankingImport.table.costItem": "Cost item",
	"bankingImport.allocationKey": "Allocation key",
	"bankingImport.hint.editable": "The key applies uniformly to all imported items and can be changed per item afterwards.",
	"bankingImport.submit": "Import",
	// Finalization (button + confirmation)
	"actions.finalize": "Finalize annual statement",
	"confirm.finalize":
		"Really finalize this annual statement? Cost items, consumption values and the period can no longer be changed afterwards.",
	"confirm.finalizeWithIssues":
		"The consistency check has {count} open hint(s) (see card above). Finalize this annual statement anyway? It cannot be changed afterwards.",
	// PDF generation + postal shipment (per owner unit statement)
	"actions.generatePdf": "Generate PDF",
	"actions.viewPdf": "View",
	"actions.regeneratePdf": "Regenerate PDF",
	"actions.generateAllPdfs": "PDF for all owners",
	// Consumption values dialog
	"consumption.action": "Record consumption values",
	"consumption.title": "Consumption values: {label}",
	"consumption.description": "Consumption per unit for the billing period.",
	"consumption.noUnits": "This property does not have any units yet.",
	// BetrKV bridge dialog
	"bridge.title": "Transfer to utility billing",
	"bridge.description":
		"Transfers the apportionable cost items of this HOA unit statement as directly allocated cost items to an existing utility billing period for this unit. Non-apportionable items (e.g. administrator fee, reserve fund) are not transferred.",
	"bridge.field": "Billing period",
	"bridge.placeholder": "Select billing period",
	"bridge.submit": "Transfer",
	// Server action error messages
	"errors.notFound": "The annual statement was not found.",
	"errors.statementNotFound": "The unit statement was not found.",
	"errors.alreadyFinalized": "This annual statement is already finalized and can no longer be changed.",
	"errors.periodRequired": "Please enter the billing period (from/to).",
	"errors.periodOrder": "The end of the period must not be before its start.",
	"errors.saveFailed": "The annual statement could not be saved.",
	"errors.deleteFailed": "The annual statement could not be deleted.",
	"errors.costItemRequired": "Please enter label, amount and allocation key.",
	"errors.invalidAllocationKey": "Invalid allocation key.",
	"errors.directUnitRequired": "A unit must be selected for direct allocation.",
	"errors.customKeyRequired": "A custom key must be selected.",
	"errors.costItemSaveFailed": "The cost item could not be saved.",
	"errors.costItemDeleteFailed": "The cost item could not be deleted.",
	"errors.invalidCostItem": "Invalid cost item.",
	"errors.costItemNotFound": "The cost item was not found.",
	"errors.consumptionSaveFailed": "The consumption values could not be saved.",
	"errors.bankingImportNothingFound": "No account transactions to import were found in the billing period.",
	"errors.bankingImportFailed": "The import from bookkeeping failed.",
	"errors.alreadyFinalizedShort": "This annual statement has already been finalized.",
	"errors.noCostItems": "Please record at least one cost item before finalizing.",
	"errors.noOwnerships": "No ownership records that could be settled were found for the selected period.",
	"errors.finalizeFailed": "The annual statement could not be finalized.",
	"errors.pdfFailed": "The PDF could not be generated.",
	"errors.pdfRequiresFinalized": "PDFs can only be generated for finalized annual statements.",
	"errors.somePdfsFailed": "{failed} of {total} PDFs could not be generated.",
	"errors.pdfRequiredBeforePost": "Please generate the PDF before sending it by post.",
	"errors.bridgeNoPeriod": "Please select a utility billing period.",
	"errors.bridgeResultNotFound": "The HOA unit statement was not found.",
	"errors.bridgePeriodNotFound": "The utility billing period was not found.",
	"errors.bridgePeriodFinalized": "This billing period is already finalized and can no longer be changed.",
	"errors.bridgePeriodMismatch": "The selected billing period does not belong to the property of this unit.",
	"errors.bridgeNoApportionable": "This HOA unit statement contains no apportionable items.",
	"errors.bridgeFailed": "The transfer to the utility billing failed.",
	// Success messages
	"success.bridged.one": "{count} cost item transferred.",
	"success.bridged.other": "{count} cost items transferred.",
	"success.bankingImport.one": "{count} cost item imported from bookkeeping.",
	"success.bankingImport.other": "{count} cost items imported from bookkeeping.",
};