"use client";

import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { AuditAction, AuditLogEntry } from "@/data/types";
import { auditCategoryLabelKeys } from "@/lib/audit-categories";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translator";

/**
 * Zeilen-Typ der Aktivitätsprotokoll-Tabelle: Repository-Zeile aus
 * src/data/audit-log.ts - vollständig serialisierbar (nur Primitive),
 * daher direkt als Client-Prop geeignet.
 */
export type AuditLogRow = AuditLogEntry;

/** Anzeige-Name je E-Mail-Adresse (serverseitig aufgelöst, serialisierbar). */
export interface AuditUserLabel {
	email: string;
	name: string;
}

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

/** Übersetzungs-Schlüssel der Aktions-Labels (AuditAction). */
const auditActions: AuditAction[] = ["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"];

/**
 * Aktivitätsprotokoll-Tabelle (/admin/logs): zeigt die von der Server-Page
 * geladene SEITE der Einträge (serverseitige Pagination, neueste zuerst);
 * Sortierung/Filterung (Aktion als Select-, Beschreibung als Text-Filter)
 * laufen clientseitig innerhalb dieser Seite. Die serverseitigen Filter
 * (Nutzer/Bereich) und das Blättern liegen in der Page selbst.
 *
 * Die Nutzer-Spalte zeigt den Anzeige-Namen („Vorname Nachname") statt
 * der gespeicherten E-Mail-Adresse; die Auflösung liefert die Server-Page
 * als Lookup-Prop mit (gelöschte oder unbenannte Konten fallen auf die
 * E-Mail-Adresse zurück).
 */
export function AuditLogTable({ rows, userLabels }: { rows: AuditLogRow[]; userLabels: AuditUserLabel[] }) {
	const { t } = useI18n();

	const labelByEmail = new Map(userLabels.map((label) => [label.email, label.name]));
	const userLabel = (email: string) => labelByEmail.get(email) ?? email;

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
			sortValue: (row) => userLabel(row.userEmail),
			cellClassName: "font-medium",
			cell: (row) => userLabel(row.userEmail),
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
			sortValue: (row) => t(auditCategoryLabelKeys[row.category] ?? row.category),
			cellClassName: "text-muted-foreground",
			cell: (row) => t(auditCategoryLabelKeys[row.category] ?? row.category),
		},
		{
			key: "description",
			header: t("admin.logs.table.description"),
			filter: { type: "text", value: (row) => row.description },
			cell: (row) => row.description,
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
