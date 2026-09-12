import { History } from "lucide-react";

import { AuditLogTable } from "@/components/admin/audit-log-table";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ServerPagination } from "@/components/ui/server-pagination";
import {
	countAuditLogEntries,
	listAuditLogCategories,
	listAuditLogEntriesPage,
	listAuditLogUserEmails,
	type AuditLogFilter,
} from "@/data/audit-log";
import { AUDIT_CATEGORIES } from "@/data/types";
import { listUserDisplayNameByEmail } from "@/data/users";
import { auditCategoryLabelKeys } from "@/lib/audit-categories";
import { getT } from "@/lib/i18n/server";
import { LIST_PAGE_SIZE } from "@/lib/pagination";

export const dynamic = "force-dynamic";

interface AdminLogsSearchParams {
	page?: string;
	user?: string;
	category?: string;
}

/**
 * Serverseitige Pagination des Aktivitätsprotokolls: Das Log ist append-only
 * und wächst mit jeder datenverändernden Aktion unbegrenzt - deshalb wird
 * hier (abweichend vom Client-Pagination-Muster der DataTable) nur die
 * aktuelle Seite (50 Einträge) geladen und über `?page=` geblättert. Die
 * Filter Nutzer/Bereich laufen ebenfalls serverseitig als GET-Parameter,
 * damit die gefilterte Treffermenge selbst bei großem Log klein bleibt.
 */
export default async function AdminLogsPage({ searchParams }: { searchParams: Promise<AdminLogsSearchParams> }) {
	const t = await getT();
	const params = await searchParams;

	// Serverseitige Filter (Nutzer/Bereich) aus der URL; unbekannte Werte
	// werden still verworfen (Wirken als Vorfilter auf die DB-Abfrage).
	const filter: AuditLogFilter = {};
	if (params.user) filter.userEmail = params.user;
	if (params.category && (AUDIT_CATEGORIES as readonly string[]).includes(params.category)) {
		filter.category = params.category as AuditLogFilter["category"];
	}
	const hasFilter = Boolean(filter.userEmail || filter.category);

	const totalCount = countAuditLogEntries(filter);
	const totalPages = Math.max(1, Math.ceil(totalCount / LIST_PAGE_SIZE));
	const requestedPage = Number.parseInt(params.page ?? "1", 10);
	const currentPage = Number.isFinite(requestedPage) ? Math.min(Math.max(requestedPage, 1), totalPages) : 1;

	const entries =
		totalCount === 0
			? []
			: listAuditLogEntriesPage(filter, LIST_PAGE_SIZE, (currentPage - 1) * LIST_PAGE_SIZE);

	// Audit-Einträge speichern die E-Mail-Adresse als denormalisierten
	// Snapshot - für die Anzeige wird sie hier zum Namen des Kontos
	// aufgelöst (gelöschte Konten fallen auf die E-Mail zurück).
	const displayNameByEmail = listUserDisplayNameByEmail();
	const userLabels = [...displayNameByEmail.entries()].map(([email, name]) => ({ email, name }));

	// Filter-Dropdowns: nur tatsächlich im Log vorkommende Werte anbieten.
	const userEmails = listAuditLogUserEmails();
	const userLabel = (email: string) => displayNameByEmail.get(email) ?? email;
	const categories = listAuditLogCategories();

	const buildHref = (page: number) => {
		const query = new URLSearchParams();
		if (page > 1) query.set("page", String(page));
		if (filter.userEmail) query.set("user", filter.userEmail);
		if (filter.category) query.set("category", filter.category);
		const queryString = query.toString();
		return queryString ? `/admin/logs?${queryString}` : "/admin/logs";
	};

	const selectClassName =
		"h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring";

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title={t("admin.logs.title")}
				description={t("admin.logs.description")}
			/>

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<Card>
					<CardContent className="p-0">
						{/* Serverseitiges Filter-Formular (GET): Filterkriterien landen in
						    der URL, die Seite lädt nur die gefilterte Trefferseite. */}
						<form method="get" action="/admin/logs" className="flex flex-wrap items-end gap-3 border-b px-4 py-3">
							<div className="flex min-w-48 flex-col gap-1.5">
								<label htmlFor="audit-user-filter" className="text-xs font-medium text-muted-foreground">
									{t("admin.logs.table.user")}
								</label>
								<select
									id="audit-user-filter"
									name="user"
									defaultValue={filter.userEmail ?? ""}
									className={selectClassName}
								>
									<option value="">{t("common.all")}</option>
									{userEmails.map((email) => (
										<option key={email} value={email}>
											{userLabel(email)}
										</option>
									))}
								</select>
							</div>
							<div className="flex min-w-48 flex-col gap-1.5">
								<label htmlFor="audit-category-filter" className="text-xs font-medium text-muted-foreground">
									{t("admin.logs.table.category")}
								</label>
								<select
									id="audit-category-filter"
									name="category"
									defaultValue={filter.category ?? ""}
									className={selectClassName}
								>
									<option value="">{t("common.all")}</option>
									{categories.map((category) => (
										<option key={category} value={category}>
											{t(auditCategoryLabelKeys[category])}
										</option>
									))}
								</select>
							</div>
							<Button type="submit" variant="outline" size="sm">
								{t("admin.logs.filter.apply")}
							</Button>
							{hasFilter ? (
								<Button asChild variant="ghost" size="sm">
									<a href="/admin/logs">{t("common.resetFilters")}</a>
								</Button>
							) : null}
						</form>

						{totalCount === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<History className="size-8" />
								<p>{t(hasFilter ? "admin.logs.empty.filtered" : "admin.logs.empty.unfiltered")}</p>
							</div>
						) : (
							<AuditLogTable rows={entries} userLabels={userLabels} />
						)}

						<ServerPagination
							currentPage={currentPage}
							totalPages={totalPages}
							totalCount={totalCount}
							pageSize={LIST_PAGE_SIZE}
							buildHref={buildHref}
						/>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
