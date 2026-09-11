import { formatCurrency, formatDate } from "@/lib/format";
import type { MessageKey } from "@/lib/i18n/translator";
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
	street?: string | null;
	zipCode?: string | null;
	city?: string | null;
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
	/** i18n-Schlüssel der Gruppenbezeichnung (Anzeige im Editor via t()). */
	groupLabelKey: MessageKey;
	placeholders: { key: string; labelKey: MessageKey }[];
};

/** Für die Anzeige im Vorlagen-Editor: alle verfügbaren Platzhalter, gruppiert. */
export const AVAILABLE_PLACEHOLDERS: PlaceholderGroup[] = [
	{
		group: "mieter",
		groupLabelKey: "templates.placeholders.group.mieter",
		placeholders: [
			{ key: "mieter.vorname", labelKey: "templates.placeholders.mieter.vorname" },
			{ key: "mieter.nachname", labelKey: "templates.placeholders.mieter.nachname" },
			{ key: "mieter.name", labelKey: "templates.placeholders.mieter.name" },
			{ key: "mieter.strasse", labelKey: "templates.placeholders.mieter.strasse" },
			{ key: "mieter.plz", labelKey: "templates.placeholders.mieter.plz" },
			{ key: "mieter.ort", labelKey: "templates.placeholders.mieter.ort" },
			{ key: "mieter.adresse", labelKey: "templates.placeholders.mieter.adresse" },
			{ key: "mieter.email", labelKey: "templates.placeholders.mieter.email" },
			{ key: "mieter.telefon", labelKey: "templates.placeholders.mieter.telefon" },
		],
	},
	{
		group: "einheit",
		groupLabelKey: "templates.placeholders.group.einheit",
		placeholders: [
			{ key: "einheit.bezeichnung", labelKey: "templates.placeholders.einheit.bezeichnung" },
			{ key: "einheit.wohnflaeche", labelKey: "templates.placeholders.einheit.wohnflaeche" },
		],
	},
	{
		group: "liegenschaft",
		groupLabelKey: "templates.placeholders.group.liegenschaft",
		placeholders: [
			{ key: "liegenschaft.name", labelKey: "templates.placeholders.liegenschaft.name" },
			{ key: "liegenschaft.strasse", labelKey: "templates.placeholders.liegenschaft.strasse" },
			{ key: "liegenschaft.plz", labelKey: "templates.placeholders.liegenschaft.plz" },
			{ key: "liegenschaft.ort", labelKey: "templates.placeholders.liegenschaft.ort" },
			{ key: "liegenschaft.adresse", labelKey: "templates.placeholders.liegenschaft.adresse" },
		],
	},
	{
		group: "vertrag",
		groupLabelKey: "templates.placeholders.group.vertrag",
		placeholders: [
			{ key: "vertrag.mietbeginn", labelKey: "templates.placeholders.vertrag.mietbeginn" },
			{ key: "vertrag.mietende", labelKey: "templates.placeholders.vertrag.mietende" },
			{ key: "vertrag.kaltmiete", labelKey: "templates.placeholders.vertrag.kaltmiete" },
			{ key: "vertrag.nebenkosten", labelKey: "templates.placeholders.vertrag.nebenkosten" },
			{ key: "vertrag.gesamtmiete", labelKey: "templates.placeholders.vertrag.gesamtmiete" },
		],
	},
	{
		group: "heute",
		groupLabelKey: "templates.placeholders.group.heute",
		placeholders: [{ key: "heute.datum", labelKey: "templates.placeholders.heute.datum" }],
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
		"mieter.strasse": tenant?.street ?? "",
		"mieter.plz": tenant?.zipCode ?? "",
		"mieter.ort": tenant?.city ?? "",
		"mieter.adresse":
			tenant?.street != null ? [tenant.street, [tenant.zipCode, tenant.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") : "",
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

/** i18n-Schlüssel der Kategorie-Bezeichnungen (Anzeige via t() auflösen). */
export const documentTemplateCategoryLabelKeys: Record<string, MessageKey> = {
	WARNING: "templates.category.WARNING",
	BILLING: "templates.category.BILLING",
	GENERAL: "templates.category.GENERAL",
	TERMINATION: "templates.category.TERMINATION",
	OTHER: "templates.category.OTHER",
};
