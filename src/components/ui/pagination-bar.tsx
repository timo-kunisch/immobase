import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import { buildPageNumbers, type PaginationState } from "@/lib/pagination";

/**
 * Pagination-Leiste für die paginierten Listen-Seiten (siehe
 * src/lib/pagination.ts). Reine Server-Komponente: Die Navigation läuft
 * über echte Links auf `basePath` mit Query-Param `page`, bestehende
 * Filter-Parameter (z. B. `hoaId`, `leaseId`, `q`) werden über `params`
 * mitgeschleift. Bei nur einer Seite wird nichts gerendert.
 */
export async function PaginationBar({
	basePath,
	pagination,
	params,
}: {
	basePath: string;
	pagination: PaginationState;
	/** Bestehende Filter-Query-Params, die auf jeder Seite erhalten bleiben sollen. */
	params?: Record<string, string | undefined>;
}) {
	const t = await getT();
	const { page, totalPages, totalItems } = pagination;
	if (totalPages <= 1) return null;

	const hrefFor = (target: number): string => {
		const search = new URLSearchParams();
		for (const [key, value] of Object.entries(params ?? {})) {
			if (value) search.set(key, value);
		}
		if (target > 1) search.set("page", String(target));
		const queryString = search.toString();
		return queryString ? `${basePath}?${queryString}` : basePath;
	};

	return (
		<nav aria-label={t("common.pagination.aria")} className="flex flex-col gap-2 px-1 sm:flex-row sm:items-center sm:justify-between">
			<p className="text-sm text-muted-foreground">
				{t("common.pagination.pageOf", { page, totalPages })} ·{" "}
				{totalItems === 1
					? t("common.pagination.entries.one", { count: totalItems })
					: t("common.pagination.entries.other", { count: totalItems })}
			</p>
			<div className="flex items-center gap-1">
				{page > 1 ? (
					<Button asChild variant="outline" size="icon-sm" aria-label={t("common.pagination.previous")}>
						<Link href={hrefFor(page - 1)}>
							<ChevronLeft />
						</Link>
					</Button>
				) : (
					<Button variant="outline" size="icon-sm" disabled aria-label={t("common.pagination.previous")}>
						<ChevronLeft />
					</Button>
				)}
				{buildPageNumbers(page, totalPages).map((entry, index) =>
					entry === "ellipsis" ? (
						<span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground">
							…
						</span>
					) : entry === page ? (
						<Button key={entry} variant="default" size="icon-sm" aria-current="page" disabled>
							{entry}
						</Button>
					) : (
						<Button key={entry} asChild variant="outline" size="icon-sm">
							<Link href={hrefFor(entry)}>{entry}</Link>
						</Button>
					)
				)}
				{page < totalPages ? (
					<Button asChild variant="outline" size="icon-sm" aria-label={t("common.pagination.next")}>
						<Link href={hrefFor(page + 1)}>
							<ChevronRight />
						</Link>
					</Button>
				) : (
					<Button variant="outline" size="icon-sm" disabled aria-label={t("common.pagination.next")}>
						<ChevronRight />
					</Button>
				)}
			</div>
		</nav>
	);
}
