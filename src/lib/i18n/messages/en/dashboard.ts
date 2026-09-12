import { dashboard as deDashboard } from "../de/dashboard";

/** Englische Übersetzungen des Namespace "dashboard" (Parität per Typ erzwungen). */
export const dashboard: typeof deDashboard = {
	// Page header
	title: "Dashboard",
	description: "ImmoBase key figures at a glance.",
	// Metric cards: general
	"cards.properties.title": "Properties",
	"cards.properties.description": "{units} units · {hoas} HOAs",
	"cards.units.title": "Rental units",
	"cards.units.description": "{occupied} occupied · {vacant} vacant",
	"cards.openTickets.title": "Open tickets",
	"cards.openTickets.description": "Damage & maintenance",
	"cards.documents.title": "Documents",
	"cards.documents.description": "Uploads & generated letters",
	// Metric cards: rental management
	"cards.tenants.title": "Tenants",
	"cards.tenants.description": "Master data & contacts",
	"cards.activeLeases.title": "Active leases",
	"cards.activeLeases.description": "Current tenancies",
	"cards.totalRent.title": "Total rent / month",
	"cards.totalRent.description": "{baseRent} base rent + {serviceCharges} service charges",
	"cards.vacancyRate.title": "Vacancy rate",
	"cards.vacancyRate.description": "{vacant} of {total} units vacant",
	"cards.rentArrears.title": "Rent arrears",
	"cards.rentArrears.description": "Due/overdue payments",
	"cards.draftBillingPeriods.title": "Billings in progress",
	"cards.draftBillingPeriods.description": "Draft utility billings",
	// Metric cards: HOA management
	"cards.hoas.title": "HOAs",
	"cards.hoas.description": "Homeowners' associations",
	"cards.owners.title": "Owners",
	"cards.owners.description": "Owner master data",
	"cards.housingChargeArrears.title": "HOA fee arrears",
	"cards.housingChargeArrears.description": "Due/overdue charges",
	"cards.reserveFund.title": "Reserve fund",
	"cards.reserveFund.description": "Balance across all HOAs",
	"cards.draftEconomicPlans.title": "Economic plans in progress",
	"cards.draftEconomicPlans.description": "Drafts, not yet finalized",
	"cards.draftAnnualStatements.title": "Annual statements in progress",
	"cards.draftAnnualStatements.description": "Drafts, not yet finalized",
	// Ticket status labels (only the states shown on the dashboard)
	// "Latest open tickets" card
	"latestTickets.title": "Latest open tickets",
	"latestTickets.allTickets": "All tickets →",
	"latestTickets.empty": "No open tickets – everything done.",
	// "Upcoming events" card (from the calendar aggregation)
	"upcoming.title": "Upcoming events",
	"upcoming.allEvents": "All events →",
	"upcoming.empty": "No upcoming events.",
	// Welcome card shown while no property exists yet
	// (three parts so the module name can be highlighted within the text)
	"welcome.textPrefix": "Welcome! First create a property under",
	"welcome.propertiesLabel": "Properties",
	"welcome.textSuffix": "to start managing.",
	// Priority support info card (external link help.immobase.app)
	"support.title": "Priority support directly from the developer",
	"support.description":
		"ImmoBase remains free and open source. For property management companies and businesses that need guaranteed response times and personal assistance, paid support packages are available.",
	"support.learnMore": "Learn more",
};
