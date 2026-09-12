import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { getT } from "@/lib/i18n/server";
import { buildPageNumbers } from "@/lib/pagination";

/**
 * Serverseitige Pagination-Leiste für Seiten, die ihre Zeilenmenge nicht
 * vollständig an den Client übergeben, sondern seitenweise über die URL
 * (`?page=`) laden (z. B. das Aktivitätsprotokoll). Pendant zur Client-
 * Pagination der DataTable: gleiche Seitenzahlen-Kompaktansicht, Navigation
 * hier jedoch als Links statt Buttons, damit der Filter-Query-String erhalten
 * bleibt (über `buildHref`).
 */
export async function ServerPagination({
	currentPage,
	totalPages,
	totalCount,
	pageSize,
	buildHref,
}: {
	currentPage: number;
	totalPages: number;
	totalCount: number;
	pageSize: number;
	/** URL der Seite N (Filter-Parameter müssen vom Aufrufer eingehängt werden). */
	buildHref: (page: number) => string;
}) {
	const t = await getT();
	const rangeFrom = totalCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
	const rangeTo = Math.min(currentPage * pageSize, totalCount);

	return (
		<div className="flex flex-col gap-2 border-t px-4 py-2 sm:flex-row sm:items-center sm:justify-between">
			<p className="text-xs text-muted-foreground">
				{t("common.dataTable.showingRange", { from: rangeFrom, to: rangeTo, total: totalCount })}
			</p>
			{totalPages > 1 ? (
				<div className="flex items-center gap-1">
					{currentPage > 1 ? (
						<Button asChild variant="outline" size="icon-sm">
							<Link href={buildHref(currentPage - 1)} aria-label={t("common.pagination.previous")} rel="prev">
								<ChevronLeft />
							</Link>
						</Button>
					) : (
						<Button variant="outline" size="icon-sm" disabled aria-label={t("common.pagination.previous")}>
							<ChevronLeft />
						</Button>
					)}
					{buildPageNumbers(currentPage, totalPages).map((entry, index) =>
						entry === "ellipsis" ? (
							<span key={`ellipsis-${index}`} className="px-1 text-sm text-muted-foreground">
								…
							</span>
						) : entry === currentPage ? (
							<Button key={entry} variant="default" size="icon-sm" aria-current="page" disabled>
								{entry}
							</Button>
						) : (
							<Button key={entry} asChild variant="outline" size="icon-sm">
								<Link href={buildHref(entry)}>{entry}</Link>
							</Button>
						),
					)}
					{currentPage < totalPages ? (
						<Button asChild variant="outline" size="icon-sm">
							<Link href={buildHref(currentPage + 1)} aria-label={t("common.pagination.next")} rel="next">
								<ChevronRight />
							</Link>
						</Button>
					) : (
						<Button variant="outline" size="icon-sm" disabled aria-label={t("common.pagination.next")}>
							<ChevronRight />
						</Button>
					)}
				</div>
			) : null}
		</div>
	);
}
