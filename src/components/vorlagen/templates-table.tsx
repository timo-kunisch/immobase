"use client";

import Link from "next/link";
import { FilePlus2, FileText } from "lucide-react";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { Button } from "@/components/ui/button";
import { CountLinkBadge } from "@/components/ui/count-link-badge";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { TemplateFormDialog } from "@/components/vorlagen/template-form-dialog";
import type { DocumentTemplate } from "@/data/types";
import { useI18n } from "@/lib/i18n/provider";
import { documentTemplateCategoryLabelKeys } from "@/lib/templates";

import { deleteDocumentTemplateAction } from "@/app/(app)/vorlagen/actions";

/** Zeile der Vorlagen-Tabelle: Vorlage angereichert um die Anzahl erzeugter Schreiben. */
export type TemplateRow = DocumentTemplate & { generatedCount: number };

export function TemplatesTable({ rows }: { rows: TemplateRow[] }) {
	const { t } = useI18n();

	const columns: DataTableColumn<TemplateRow>[] = [
		{
			key: "title",
			header: t("templates.table.title"),
			sortValue: (row) => row.title,
			filter: { type: "text", value: (row) => row.title },
			cell: (row) => (
				<span className="font-medium">
					{row.title}
					{row.subject ? <span className="block text-xs text-muted-foreground">{row.subject}</span> : null}
				</span>
			),
		},
		{
			key: "category",
			header: t("templates.table.category"),
			sortValue: (row) => t(documentTemplateCategoryLabelKeys[row.category]),
			filter: {
				type: "select",
				value: (row) => row.category,
				options: (Object.keys(documentTemplateCategoryLabelKeys) as (keyof typeof documentTemplateCategoryLabelKeys)[]).map((category) => ({
					value: category,
					label: t(documentTemplateCategoryLabelKeys[category]),
				})),
			},
			cell: (row) => <Badge variant="secondary">{t(documentTemplateCategoryLabelKeys[row.category])}</Badge>,
		},
		{
			key: "generatedCount",
			header: t("templates.table.generatedCount"),
			sortValue: (row) => row.generatedCount,
			cell: (row) => (
				<CountLinkBadge href={`/vorlagen/${row.id}`} count={row.generatedCount} label={t("templates.generated.countLabel")} icon={FileText} />
			),
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[160px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<Button variant="ghost" size="icon-sm" aria-label={t("templates.actions.apply")} title={t("templates.actions.apply")} asChild>
						<Link href={`/vorlagen/${row.id}`}>
							<FilePlus2 className="size-4" />
						</Link>
					</Button>
					<TemplateFormDialog template={row} />
					<ConfirmDeleteButton
						action={deleteDocumentTemplateAction.bind(null, row.id)}
						confirmMessage={t("templates.confirm.deleteTemplate", { title: row.title })}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} rowId={(row) => `template-${row.id}`} />;
}
