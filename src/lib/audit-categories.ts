import type { AuditCategory } from "@/data/types";
import type { MessageKey } from "@/lib/i18n/translator";

/**
 * Übersetzungs-Schlüssel der Anzeige-Labels der Modul-Schlüssel
 * (AuditCategory) - geteilt zwischen der Log-Tabelle (Client) und der
 * serverseitigen Filter-Auswahl der Admin-Seite /admin/logs.
 */
export const auditCategoryLabelKeys: Record<AuditCategory, MessageKey> = {
	auth: "admin.category.auth",
	liegenschaften: "admin.category.liegenschaften",
	einheiten: "admin.category.einheiten",
	tickets: "admin.category.tickets",
	dokumente: "admin.category.dokumente",
	kalender: "admin.category.kalender",
	wissen: "admin.category.wissen",
	mieter: "admin.category.mieter",
	vertraege: "admin.category.vertraege",
	finanzen: "admin.category.finanzen",
	buchhaltung: "admin.category.buchhaltung",
	abrechnung: "admin.category.abrechnung",
	vorlagen: "admin.category.vorlagen",
	weg: "admin.category.weg",
	eigentuemer: "admin.category.eigentuemer",
	eigentumsverhaeltnisse: "admin.category.eigentumsverhaeltnisse",
	verteilerschluessel: "admin.category.verteilerschluessel",
	wirtschaftsplan: "admin.category.wirtschaftsplan",
	jahresabrechnung: "admin.category.jahresabrechnung",
	hausgeld: "admin.category.hausgeld",
	ruecklage: "admin.category.ruecklage",
	versammlungen: "admin.category.versammlungen",
	beschluesse: "admin.category.beschluesse",
	admin: "admin.category.admin",
	einstellungen: "admin.category.einstellungen",
	postversand: "admin.category.postversand",
	postfach: "admin.category.postfach",
	system: "admin.category.system",
};
