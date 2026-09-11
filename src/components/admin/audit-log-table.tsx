"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { AuditAction, AuditCategory, AuditLogEntry } from "@/data/types";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translator";
import { LIST_PAGE_SIZE } from "@/lib/pagination";

/**
 * Zeilen-Typ der Aktivitätsprotokoll-Tabelle: Repository-Zeile aus
 * src/data/audit-log.ts - vollständig serialisierbar (nur Primitive),
 * daher direkt als Client-Prop geeignet.
 */
export type AuditLogRow = AuditLogEntry;

/** Übersetzungs-Schlüssel der Aktions-Labels (AuditAction). */
const actionLabelKeys: Record<AuditAction, MessageKey> = {
	CREATE: "admin.action.CREATE",
	UPDATE: "admin.action.UPDATE",
	DELETE: "admin.action.DELETE",
	LOGIN: "admin.action.LOGIN",
	LOGOUT: "admin.action.LOGOUT",
};

const actionStyles: Record<AuditAction, string> = {
	CREATE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
	UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
	DELETE: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
	LOGIN: "bg-muted text-muted-foreground",
	LOGOUT: "bg-muted text-muted-foreground",
};

/** Übersetzungs-Schlüssel der Anzeige-Labels der Modul-Schlüssel (AuditCategory). */
const categoryLabelKeys: Record<AuditCategory, MessageKey> = {
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

/** Alle Aktions-Arten (Enum AuditAction) für den Select-Filter. */
const auditActions: AuditAction[] = ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"];

/** Alle Modul-Schlüssel (Enum AuditCategory) für den Select-Filter. */
const auditCategories = Object.keys(categoryLabelKeys) as AuditCategory[];

/**
 * Aktivitätsprotokoll-Tabelle (/admin/logs): clientseitige Sortierung,
 * Filterung je Spalte (Nutzer/Kategorie/Aktion als Select-Filter,
 * Beschreibung als Text-Filter) und Client-Pagination (50/Seite) - die
 * Server-Seite lädt die Vollliste (neueste zuerst als Grundsordnung).
 */
export function AuditLogTable({ rows }: { rows: AuditLogRow[] }) {
	const { t } = useI18n();

	// Nutzer-Filter: nur die in den Zeilen tatsächlich vorkommenden
	// E-Mails (distinct) anbieten.
	const userEmails = [...new Set(rows.map((row) => row.userEmail))].sort((a, b) => a.localeCompare(b, "de"));

	const columns: DataTableColumn<AuditLogRow>[] = [
		{
			key: "time",
			header: t("admin.logs.table.time"),
			sortValue: (row) => row.createdAt,
			cellClassName: "whitespace-nowrap text-muted-foreground",
			cell: (row) => formatDateTime(row.createdAt),
		},
		{
			key: "user",
			header: t("admin.logs.table.user"),
			filter: {
				type: "select",
				value: (row) => row.userEmail,
				options: userEmails.map((email) => ({ value: email, label: email })),
			},
			cellClassName: "font-medium",
			cell: (row) => row.userEmail,
		},
		{
			key: "action",
			header: t("admin.logs.table.action"),
			filter: {
				type: "select",
				value: (row) => row.action,
				options: auditActions.map((value) => ({ value, label: t(actionLabelKeys[value]) })),
			},
			cell: (row) => <Badge className={actionStyles[row.action]}>{t(actionLabelKeys[row.action] ?? row.action)}</Badge>,
		},
		{
			key: "category",
			header: t("admin.logs.table.category"),
			filter: {
				type: "select",
				value: (row) => row.category,
				options: auditCategories.map((value) => ({ value, label: t(categoryLabelKeys[value]) })),
			},
			cellClassName: "text-muted-foreground",
			cell: (row) => t(categoryLabelKeys[row.category] ?? row.category),
		},
		{
			key: "description",
			header: t("admin.logs.table.description"),
			filter: { type: "text", value: (row) => row.description },
			cell: (row) => row.description,
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} pageSize={LIST_PAGE_SIZE} />;
}
