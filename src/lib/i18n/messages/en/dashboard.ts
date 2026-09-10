import { dashboard as deDashboard } from "../de/dashboard";

/** Englische Übersetzungen des Namespace "dashboard" (Parität per Typ erzwungen). */
export const dashboard: typeof deDashboard = {
	// Page header
	title: "Dashboard",
	description: "ImmoBase key figures at a glance.",
	// Metric cards
	"cards.properties.title": "Properties",
	"cards.properties.description": "{count} tenants in total",
	"cards.units.title": "Rental units",
	"cards.units.description": "{occupied} occupied · {vacant} vacant",
	"cards.vacancyRate.title": "Vacancy rate",
	"cards.vacancyRate.description": "{vacant} of {total} units vacant",
	"cards.totalRent.title": "Total rent / month",
	"cards.totalRent.description": "{baseRent} base rent + {serviceCharges} service charges",
	"cards.openTickets.title": "Open tickets",
	"cards.openTickets.description": "Damage & maintenance",
	"cards.rentArrears.title": "Rent arrears",
	"cards.rentArrears.description": "Due/overdue payments",
	// Ticket status labels (only the states shown on the dashboard)
	// "Latest open tickets" card
	"latestTickets.title": "Latest open tickets",
	"latestTickets.allTickets": "All tickets →",
	"latestTickets.empty": "No open tickets – everything done.",
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
