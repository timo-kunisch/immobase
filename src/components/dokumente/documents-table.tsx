"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { SendByPostButton } from "@/components/postal-shipments/send-by-post-button";
import { DocumentEditDialog } from "@/components/dokumente/document-edit-dialog";
import { Badge } from "@/components/ui/badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { DocumentSourceType, UnifiedDocument } from "@/lib/documents-overview";
import type { Property, Tenant, Unit } from "@/data/types";
import { formatDate, formatFileSize } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translator";
import { LIST_PAGE_SIZE } from "@/lib/pagination";

import { deleteAnyDocumentAction, sendAnyDocumentByPostAction } from "@/app/(app)/dokumente/actions";

/**
 * Zeilen-Typ der Dokumente-Tabelle: die vereinheitlichte Übersichts-Zeile
 * über alle vier Datei-Quellen (siehe src/lib/documents-overview.ts) -
 * vollständig serialisierbar, daher direkt als Client-Prop geeignet.
 */
export type DocumentRow = UnifiedDocument;

const typeLabelKeys: Record<string, MessageKey> = {
	CONTRACT: "documents.category.CONTRACT",
	INVOICE: "documents.category.INVOICE",
	FLOORPLAN: "documents.category.FLOORPLAN",
	OTHER: "documents.category.OTHER",
};

const sourceTypeLabelKeys: Record<string, MessageKey> = {
	DOCUMENT: "documents.sourceType.DOCUMENT",
	GENERATED_DOCUMENT: "documents.sourceType.GENERATED_DOCUMENT",
	TENANT_STATEMENT: "documents.sourceType.TENANT_STATEMENT",
	HOA_ANNUAL_STATEMENT: "documents.sourceType.HOA_ANNUAL_STATEMENT",
};

const sourceTypeStyles: Record<string, string> = {
	DOCUMENT: "bg-muted text-muted-foreground",
	GENERATED_DOCUMENT: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
	TENANT_STATEMENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
	HOA_ANNUAL_STATEMENT: "bg-teal-100 text-teal-700 dark:bg-teal-500/10 dark:text-teal-400",
};

/** Alle Datei-Quellen der Übersicht (DocumentSourceType) für den Select-Filter. */
const sourceTypes: DocumentSourceType[] = ["DOCUMENT", "GENERATED_DOCUMENT", "TENANT_STATEMENT", "HOA_ANNUAL_STATEMENT"];

/**
 * Dokumente-Tabelle (/dokumente): clientseitige Sortierung, Filterung je
 * Spalte und Client-Pagination (50/Seite) über ALLE Datei-Quellen - die
 * Server-Seite lädt die per ?q=/?propertyId=/?unitId=/?tenantId=
 * vorgefilterte Vollliste.
 */
export function DocumentsTable({
	rows,
	postalConfigured,
	properties,
	units,
	tenants,
}: {
	rows: DocumentRow[];
	postalConfigured: boolean;
	/** Picker-Listen für den Bearbeiten-Dialog (nur Quelle "DOCUMENT"). */
	properties: Property[];
	units: Unit[];
	tenants: Tenant[];
}) {
	const { t } = useI18n();

	const columns: DataTableColumn<DocumentRow>[] = [
		{
			key: "file",
			header: t("documents.table.file"),
			sortValue: (row) => row.fileName,
			filter: { type: "text", value: (row) => row.fileName },
			cellClassName: "font-medium",
			cell: (row) => (
				<>
					<a href={`/api/uploads/${row.filePath}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline">
						<FileText className="size-4 text-muted-foreground" />
						{row.fileName}
					</a>
					<span className="block pl-6 text-xs text-muted-foreground">{formatFileSize(row.fileSize)}</span>
				</>
			),
		},
		{
			key: "source",
			header: t("documents.table.source"),
			filter: {
				type: "select",
				value: (row) => row.sourceType,
				options: sourceTypes.map((value) => ({ value, label: t(sourceTypeLabelKeys[value]) })),
			},
			cell: (row) => (
				<div className="flex flex-col gap-1">
					<Badge className={sourceTypeStyles[row.sourceType]}>{t(sourceTypeLabelKeys[row.sourceType])}</Badge>
					{row.documentType ? <Badge variant="secondary">{t(typeLabelKeys[row.documentType])}</Badge> : null}
				</div>
			),
		},
		{
			key: "linkedTo",
			header: t("documents.table.linkedTo"),
			filter: {
				type: "text",
				value: (row) => [row.property?.label, row.unit?.label, row.tenant?.label].filter(Boolean).join(" "),
			},
			cellClassName: "text-muted-foreground",
			cell: (row) =>
				row.property || row.unit || row.tenant ? (
					<div className="flex flex-col gap-0.5">
						{row.property ? (
							<Link href={`/liegenschaften#property-${row.property.id}`} className="hover:text-foreground hover:underline">
								{row.property.label}
							</Link>
						) : null}
						{row.unit ? (
							<Link href={`/einheiten#unit-${row.unit.id}`} className="hover:text-foreground hover:underline">
								{row.unit.label}
							</Link>
						) : null}
						{row.tenant ? (
							<Link href={`/mieter#tenant-${row.tenant.id}`} className="hover:text-foreground hover:underline">
								{row.tenant.label}
							</Link>
						) : null}
					</div>
				) : (
					"–"
				),
		},
		{
			key: "createdAt",
			header: t("common.date"),
			sortValue: (row) => row.createdAt,
			cellClassName: "text-muted-foreground",
			cell: (row) => formatDate(row.createdAt),
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[132px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<SendByPostButton
						sendAction={sendAnyDocumentByPostAction.bind(null, row.sourceType, row.id)}
						disabled={!postalConfigured || row.mimeType !== "application/pdf"}
						disabledReason={!postalConfigured ? t("postal.notConfiguredShort") : t("documents.errors.onlyPdf")}
					/>
					{row.sourceType === "DOCUMENT" ? (
						<DocumentEditDialog row={row} properties={properties} units={units} tenants={tenants} />
					) : null}
					{row.sourceType !== "TENANT_STATEMENT" && row.sourceType !== "HOA_ANNUAL_STATEMENT" ? (
						<ConfirmDeleteButton
							action={deleteAnyDocumentAction.bind(null, row.sourceType, row.id)}
							confirmMessage={t("documents.confirm.delete", { name: row.fileName })}
						/>
					) : null}
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => `${row.sourceType}-${row.id}`} pageSize={LIST_PAGE_SIZE} />;
}
