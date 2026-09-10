import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { getKnowledgeBaseArticle, listKnowledgeBaseCategories } from "@/data/knowledge-base";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { ArticleFormDialog } from "@/components/wissen/article-form-dialog";
import { formatDateTime } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

import { deleteKnowledgeArticleAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function WissenDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const t = await getT();
	const { id } = await params;

	const article = getKnowledgeBaseArticle(id);
	if (!article) {
		notFound();
	}

	const categories = listKnowledgeBaseCategories();

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title={article.title}
				description={article.category ? t("knowledge.categoryLine", { category: article.category }) : t("knowledge.articleFallback")}
				actions={
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" asChild>
							<Link href="/wissen">
								<ChevronLeft />
								{t("common.back")}
							</Link>
						</Button>
						<ArticleFormDialog article={article} categories={categories} />
						<ConfirmDeleteButton
							action={deleteKnowledgeArticleAction.bind(null, article.id)}
							confirmMessage={t("knowledge.confirm.delete", { title: article.title })}
						/>
					</div>
				}
			/>

			<div className="flex-1 p-4 sm:p-6">
				<Card>
					<CardContent className="flex flex-col gap-4">
						<div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
							{article.category ? <Badge variant="secondary">{article.category}</Badge> : null}
							<span>{t("knowledge.createdAt", { date: formatDateTime(article.createdAt) })}</span>
							<span>{t("knowledge.updatedAt", { date: formatDateTime(article.updatedAt) })}</span>
						</div>
						<p className="text-sm whitespace-pre-wrap">{article.content}</p>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
