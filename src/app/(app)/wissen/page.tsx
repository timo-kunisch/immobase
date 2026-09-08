import Link from "next/link";
import { BookOpen } from "lucide-react";

import { listKnowledgeBaseArticles, listKnowledgeBaseCategories } from "@/data/knowledge-base";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArticleFormDialog } from "@/components/wissen/article-form-dialog";
import { ArticleSearchForm } from "@/components/wissen/article-search-form";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function WissenPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
	const { q } = await searchParams;
	const search = q?.trim() ?? "";

	const articles = listKnowledgeBaseArticles({ search: search || undefined });
	const categories = listKnowledgeBaseCategories();

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title="Wissensdatenbank"
				description="Richtlinien, Anweisungen und Erklärungen hinterlegen und nachschlagen."
				actions={<ArticleFormDialog categories={categories} />}
			/>

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<div className="flex flex-wrap items-center gap-2">
					<ArticleSearchForm defaultValue={search || undefined} />
					{search ? (
						<p className="text-sm text-muted-foreground">
							Suche nach: <span className="font-medium text-foreground">{search}</span> ·{" "}
							<Link href="/wissen" className="text-primary hover:underline">
								Suche zurücksetzen
							</Link>
						</p>
					) : null}
				</div>

				{articles.length === 0 ? (
					<Card>
						<CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
							<BookOpen className="size-8" />
							<p>{search ? "Keine Artikel gefunden." : "Noch keine Artikel hinterlegt."}</p>
						</CardContent>
					</Card>
				) : (
					<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
						{articles.map((article) => (
							<Card key={article.id} id={`article-${article.id}`}>
								<CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
									<CardTitle className="text-sm font-medium leading-snug">
										<Link href={`/wissen/${article.id}`} className="hover:text-primary hover:underline">
											{article.title}
										</Link>
									</CardTitle>
									{article.category ? <Badge variant="secondary">{article.category}</Badge> : null}
								</CardHeader>
								<CardContent className="flex flex-col gap-3">
									<p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">{article.content}</p>
									<div className="flex items-center justify-between gap-2">
										<span className="text-xs text-muted-foreground">Aktualisiert: {formatDate(article.updatedAt)}</span>
										<Link href={`/wissen/${article.id}`} className="text-xs text-primary hover:underline">
											Lesen →
										</Link>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
