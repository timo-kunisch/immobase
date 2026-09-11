"use client";

import Link from "next/link";
import { FileText } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SendByPostButton } from "@/components/postal-shipments/send-by-post-button";
import type { GeneratedDocumentWithTenant } from "@/data/templates";
import { formatDate, formatFileSize } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { deleteGeneratedDocumentAction, sendGeneratedDocumentByPostAction } from "@/app/(app)/vorlagen/actions";

/**
 * Tabelle der erzeugten Schreiben - geteilt zwischen der gefilterten Liste
 * auf /vorlagen (Spalte "Vorlage") und der Vorlagen-Detailseite
 * (/vorlagen/[id], Spalte "Mieter" + Postversand-Button).
 */
export function GeneratedDocumentsTable({
	rows,
	showTemplateColumn = false,
	showTenantColumn = false,
	showSendByPost = false,
	postalConfigured = false,
}: {
	rows: GeneratedDocumentWithTenant[];
	showTemplateColumn?: boolean;
	showTenantColumn?: boolean;
	showSendByPost?: boolean;
	postalConfigured?: boolean;
}) {
	const { t } = useI18n();

	const columns: DataTableColumn<GeneratedDocumentWithTenant>[] = [
		{
			key: "subject",
			header: t("templates.generated.table.subject"),
			sortValue: (row) => row.subject || row.templateTitle,
			filter: { type: "text", value: (row) => row.subject || row.templateTitle },
			cell: (row) => (
				<span className="font-medium">
					<a href={`/api/uploads/${row.filePath}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline">
						<FileText className="size-4 text-muted-foreground" />
						{row.subject || row.templateTitle}
					</a>
					<span className="block pl-6 text-xs text-muted-foreground">{formatFileSize(row.fileSize)}</span>
				</span>
			),
		},
	];

	if (showTemplateColumn) {
		columns.push({
			key: "template",
			header: t("templates.generated.table.template"),
			sortValue: (row) => row.templateTitle,
			filter: { type: "text", value: (row) => row.templateTitle },
			cell: (row) =>
				row.templateId ? (
					<Link href={`/vorlagen/${row.templateId}`} className="text-muted-foreground hover:underline">
						{row.templateTitle}
					</Link>
				) : (
					<span className="text-muted-foreground">{row.templateTitle}</span>
				),
		});
	}

	if (showTenantColumn) {
		columns.push({
			key: "tenant",
			header: t("common.tenant"),
			sortValue: (row) => (row.tenant ? `${row.tenant.lastName} ${row.tenant.firstName}` : null),
			filter: { type: "text", value: (row) => (row.tenant ? `${row.tenant.firstName} ${row.tenant.lastName}` : null) },
			cell: (row) =>
				row.tenant ? (
					<Link href={`/mieter#tenant-${row.tenant.id}`} className="text-muted-foreground hover:underline">
						{row.tenant.firstName} {row.tenant.lastName}
					</Link>
				) : (
					<span className="text-muted-foreground">–</span>
				),
		});
	}

	columns.push(
		{
			key: "createdAt",
			header: t("templates.generated.table.createdAt"),
			sortValue: (row) => row.createdAt,
			filter: { type: "text", value: (row) => formatDate(row.createdAt) },
			cell: (row) => <span className="text-muted-foreground">{formatDate(row.createdAt)}</span>,
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: showSendByPost ? "w-[140px] text-right" : "w-[100px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					{showSendByPost ? (
						<SendByPostButton
							sendAction={sendGeneratedDocumentByPostAction.bind(null, row.id)}
							disabled={!postalConfigured}
							disabledReason={t("postal.notConfiguredShort")}
						/>
					) : null}
					<ConfirmDeleteButton action={deleteGeneratedDocumentAction.bind(null, row.id)} confirmMessage={t("templates.generated.confirmDelete")} />
				</div>
			),
		},
	);

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} />;
}
