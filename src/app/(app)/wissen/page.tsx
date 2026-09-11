import Link from "next/link";
import { BookOpen } from "lucide-react";

import { listKnowledgeBaseArticles, listKnowledgeBaseCategories } from "@/data/knowledge-base";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { ArticleFormDialog } from "@/components/wissen/article-form-dialog";
import { ArticleSearchForm } from "@/components/wissen/article-search-form";
import { ArticlesTable } from "@/components/wissen/articles-table";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function WissenPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
	const t = await getT();
	const { q } = await searchParams;
	const search = q?.trim() ?? "";

	const articles = listKnowledgeBaseArticles({ search: search || undefined });
	const categories = listKnowledgeBaseCategories();

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title={t("knowledge.title")}
				description={t("knowledge.description")}
				actions={<ArticleFormDialog categories={categories} />}
			/>

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<div className="flex flex-wrap items-center gap-2">
					<ArticleSearchForm defaultValue={search || undefined} />
					{search ? (
						<p className="text-sm text-muted-foreground">
							{t("knowledge.search.label")} <span className="font-medium text-foreground">{search}</span> ·{" "}
							<Link href="/wissen" className="text-primary hover:underline">
								{t("knowledge.search.reset")}
							</Link>
						</p>
					) : null}
				</div>

				<Card>
					<CardContent className="p-0">
						{articles.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<BookOpen className="size-8" />
								<p>{search ? t("knowledge.empty.noResults") : t("knowledge.empty.noArticles")}</p>
							</div>
						) : (
							<ArticlesTable rows={articles} categories={categories} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
