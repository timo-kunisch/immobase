"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ArchiveRestore, FileText, Loader2 } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import type { TrashedDocumentRow, TrashedDocumentSourceType } from "@/lib/document-trash";
import { formatDate, formatFileSize } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translator";
import { LIST_PAGE_SIZE } from "@/lib/pagination";
import { showError } from "@/lib/toast";

import { deleteAnyDocumentPermanentlyAction, restoreAnyDocumentAction } from "@/app/(app)/dokumente/actions";

/**
 * Papierkorb-Tabelle (/dokumente?trash=1): die im Papierkorb liegenden
 * hochgeladenen Dokumente und Vorlagen-Schreiben (siehe
 * src/lib/document-trash.ts) mit Wiederherstellen und endgültigem Löschen.
 */

const typeLabelKeys: Record<string, MessageKey> = {
	CONTRACT: "documents.category.CONTRACT",
	INVOICE: "documents.category.INVOICE",
	FLOORPLAN: "documents.category.FLOORPLAN",
	OTHER: "documents.category.OTHER",
};

const sourceTypeLabelKeys: Record<string, MessageKey> = {
	DOCUMENT: "documents.sourceType.DOCUMENT",
	GENERATED_DOCUMENT: "documents.sourceType.GENERATED_DOCUMENT",
};

const sourceTypeStyles: Record<string, string> = {
	DOCUMENT: "bg-muted text-muted-foreground",
	GENERATED_DOCUMENT: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
};

/** Beide Papierkorb-Quellen (TrashedDocumentSourceType) für den Select-Filter. */
const sourceTypes: TrashedDocumentSourceType[] = ["DOCUMENT", "GENERATED_DOCUMENT"];

/** Wiederherstellen ohne Bestätigungsdialog (nicht destruktiv). */
function RestoreButton({ action }: { action: () => Promise<{ error?: string } | void> }) {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			disabled={isPending}
			aria-label={t("documents.trash.restore")}
			title={t("documents.trash.restore")}
			onClick={() =>
				startTransition(async () => {
					const result = await action();
					if (result?.error) {
						showError(result.error);
					}
				})
			}
		>
			{isPending ? <Loader2 className="size-4 animate-spin" /> : <ArchiveRestore className="size-4" />}
		</Button>
	);
}

export function DocumentsTrashTable({ rows }: { rows: TrashedDocumentRow[] }) {
	const { t } = useI18n();

	const columns: DataTableColumn<TrashedDocumentRow>[] = [
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
			key: "deletedAt",
			header: t("documents.table.deletedAt"),
			sortValue: (row) => row.deletedAt,
			cellClassName: "text-muted-foreground",
			cell: (row) => (
				<>
					{formatDate(row.deletedAt)}
					<span className="block text-xs text-muted-foreground">
						{t("documents.trash.permanentDeleteAt", { date: formatDate(row.permanentDeleteAt) })}
					</span>
				</>
			),
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[100px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<RestoreButton action={restoreAnyDocumentAction.bind(null, row.sourceType, row.id)} />
					<ConfirmDeleteButton
						action={deleteAnyDocumentPermanentlyAction.bind(null, row.sourceType, row.id)}
						confirmMessage={t("documents.confirm.permanentDelete", { name: row.fileName })}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => `${row.sourceType}-${row.id}`} pageSize={LIST_PAGE_SIZE} />;
}
