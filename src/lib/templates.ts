import { formatCurrency, formatDate } from "@/lib/format";
import { getRentForDate } from "@/lib/rent-history";

/**
 * Zentrale Platzhalter-Logik für Dokumentvorlagen (Schreiben an Mieter).
 * Kapselt sowohl die Liste der verfügbaren Platzhalter (für die Anzeige im
 * Vorlagen-Editor) als auch das tatsächliche Ersetzen im Vorlagentext -
 * damit Editor-Hilfe und Erzeugung immer exakt dieselben Platzhalter kennen.
 *
 * Platzhalter-Syntax: "{{gruppe.feld}}", z. B. "{{mieter.name}}". Unbekannte
 * Platzhalter werden bewusst NICHT stillschweigend entfernt, sondern
 * unverändert im Text gelassen, damit ein Tippfehler im Ergebnis auffällt
 * statt lautlos zu verschwinden.
 */

type TemplateLease = {
	startDate: string;
	endDate: string | null;
	coldRent: string;
	serviceCharges: string;
	rentAdjustments: { id: string; validFrom: string; coldRent: string; serviceCharges: string; notes: string | null }[];
};

type TemplateTenant = {
	firstName: string;
	lastName: string;
	email: string | null;
	phone: string | null;
};

type TemplateUnit = {
	label: string;
	livingSpace: number | null;
};

type TemplateProperty = {
	name: string;
	street: string;
	zipCode: string;
	city: string;
};

/** Alle Daten, die für das Rendern einer Vorlage für einen Mietvertrag benötigt werden. */
export type TemplateContext = {
	lease: TemplateLease | null;
	tenant: TemplateTenant | null;
	unit: (TemplateUnit & { property: TemplateProperty }) | null;
	/** Datum, das für "{{heute.*}}" verwendet wird (Standard: jetzt). */
	today?: Date;
};

type PlaceholderGroup = {
	group: string;
	groupLabel: string;
	placeholders: { key: string; label: string }[];
};

/** Für die Anzeige im Vorlagen-Editor: alle verfügbaren Platzhalter, gruppiert. */
export const AVAILABLE_PLACEHOLDERS: PlaceholderGroup[] = [
	{
		group: "mieter",
		groupLabel: "Mieter",
		placeholders: [
			{ key: "mieter.vorname", label: "Vorname" },
			{ key: "mieter.nachname", label: "Nachname" },
			{ key: "mieter.name", label: "Vor- und Nachname" },
			{ key: "mieter.email", label: "E-Mail-Adresse" },
			{ key: "mieter.telefon", label: "Telefonnummer" },
		],
	},
	{
		group: "einheit",
		groupLabel: "Mieteinheit",
		placeholders: [
			{ key: "einheit.bezeichnung", label: 'Bezeichnung (z. B. "1. OG links")' },
			{ key: "einheit.wohnflaeche", label: "Wohnfläche (m²)" },
		],
	},
	{
		group: "liegenschaft",
		groupLabel: "Liegenschaft",
		placeholders: [
			{ key: "liegenschaft.name", label: "Name" },
			{ key: "liegenschaft.strasse", label: "Straße" },
			{ key: "liegenschaft.plz", label: "Postleitzahl" },
			{ key: "liegenschaft.ort", label: "Ort" },
			{ key: "liegenschaft.adresse", label: "Vollständige Adresse (Straße, PLZ Ort)" },
		],
	},
	{
		group: "vertrag",
		groupLabel: "Mietvertrag",
		placeholders: [
			{ key: "vertrag.mietbeginn", label: "Mietbeginn" },
			{ key: "vertrag.mietende", label: 'Mietende (oder "unbefristet")' },
			{ key: "vertrag.kaltmiete", label: "Aktuelle Kaltmiete" },
			{ key: "vertrag.nebenkosten", label: "Aktuelle Nebenkosten" },
			{ key: "vertrag.gesamtmiete", label: "Aktuelle Gesamtmiete (Kalt + NK)" },
		],
	},
	{
		group: "heute",
		groupLabel: "Aktuelles Datum",
		placeholders: [{ key: "heute.datum", label: "Heutiges Datum" }],
	},
];

/** Löst alle Platzhalter-Schlüssel zu ihrem aktuellen Wert (String) auf. */
function buildPlaceholderValues(context: TemplateContext): Record<string, string> {
	const { lease, tenant, unit, today = new Date() } = context;

	const rent = lease != null ? getRentForDate(lease, lease.rentAdjustments, today) : null;

	return {
		"mieter.vorname": tenant?.firstName ?? "",
		"mieter.nachname": tenant?.lastName ?? "",
		"mieter.name": tenant != null ? `${tenant.firstName} ${tenant.lastName}` : "",
		"mieter.email": tenant?.email ?? "",
		"mieter.telefon": tenant?.phone ?? "",

		"einheit.bezeichnung": unit?.label ?? "",
		"einheit.wohnflaeche": unit?.livingSpace != null ? `${unit.livingSpace} m²` : "",

		"liegenschaft.name": unit?.property.name ?? "",
		"liegenschaft.strasse": unit?.property.street ?? "",
		"liegenschaft.plz": unit?.property.zipCode ?? "",
		"liegenschaft.ort": unit?.property.city ?? "",
		"liegenschaft.adresse": unit != null ? `${unit.property.street}, ${unit.property.zipCode} ${unit.property.city}` : "",

		"vertrag.mietbeginn": lease ? formatDate(lease.startDate) : "",
		"vertrag.mietende": lease ? (lease.endDate ? formatDate(lease.endDate) : "unbefristet") : "",
		"vertrag.kaltmiete": rent ? formatCurrency(rent.coldRent) : "",
		"vertrag.nebenkosten": rent ? formatCurrency(rent.serviceCharges) : "",
		"vertrag.gesamtmiete": rent ? formatCurrency(rent.coldRent + rent.serviceCharges) : "",

		"heute.datum": formatDate(today),
	};
}

const PLACEHOLDER_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

/**
 * Ersetzt alle bekannten "{{gruppe.feld}}"-Platzhalter im übergebenen Text
 * durch die Werte aus dem Kontext. Unbekannte Platzhalter bleiben
 * unverändert stehen (siehe Modul-Kommentar).
 */
export function renderTemplateText(text: string, context: TemplateContext): string {
	const values = buildPlaceholderValues(context);
	return text.replace(PLACEHOLDER_PATTERN, (match, key: string) => {
		return key in values ? values[key] : match;
	});
}

export const documentTemplateCategoryLabels: Record<string, string> = {
	WARNING: "Abmahnung",
	BILLING: "Abrechnung / Zahlungsaufforderung",
	GENERAL: "Allgemeines Schreiben",
	TERMINATION: "Kündigung",
	OTHER: "Sonstiges",
};
