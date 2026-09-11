"use client";

import Link from "next/link";

import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { Badge } from "@/components/ui/badge";
import { ArticleFormDialog } from "@/components/wissen/article-form-dialog";
import type { KnowledgeBaseArticle } from "@/data/types";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { deleteKnowledgeArticleAction } from "@/app/(app)/wissen/actions";

/** Tabelle der Wissensdatenbank-Artikel (Kategorien als Select-Filter-Optionen). */
export function ArticlesTable({ rows, categories }: { rows: KnowledgeBaseArticle[]; categories: string[] }) {
	const { t } = useI18n();

	const columns: DataTableColumn<KnowledgeBaseArticle>[] = [
		{
			key: "title",
			header: t("knowledge.table.title"),
			sortValue: (row) => row.title,
			filter: { type: "text", value: (row) => row.title },
			cell: (row) => (
				<Link href={`/wissen/${row.id}`} className="font-medium hover:text-primary hover:underline">
					{row.title}
				</Link>
			),
		},
		{
			key: "category",
			header: t("knowledge.table.category"),
			sortValue: (row) => row.category ?? "",
			filter: {
				type: "select",
				value: (row) => row.category ?? "",
				options: categories.map((category) => ({ value: category, label: category })),
			},
			cell: (row) => (row.category ? <Badge variant="secondary">{row.category}</Badge> : null),
		},
		{
			key: "content",
			header: t("knowledge.table.content"),
			filter: { type: "text", value: (row) => row.content },
			cell: (row) => <p className="max-w-md text-sm text-muted-foreground line-clamp-2 whitespace-pre-wrap">{row.content}</p>,
		},
		{
			key: "updatedAt",
			header: t("knowledge.table.updatedAt"),
			sortValue: (row) => row.updatedAt,
			filter: { type: "text", value: (row) => formatDate(row.updatedAt) },
			cell: (row) => <span className="text-muted-foreground">{formatDate(row.updatedAt)}</span>,
		},
		{
			key: "actions",
			header: t("common.actions"),
			headClassName: "w-[160px] text-right",
			cellClassName: "text-right",
			cell: (row) => (
				<div className="flex items-center justify-end gap-1">
					<ArticleFormDialog article={row} categories={categories} />
					<ConfirmDeleteButton
						action={deleteKnowledgeArticleAction.bind(null, row.id)}
						confirmMessage={t("knowledge.confirm.delete", { title: row.title })}
					/>
				</div>
			),
		},
	];

	return <DataTable columns={columns} rows={rows} rowKey={(row) => row.id} rowId={(row) => `article-${row.id}`} />;
}
