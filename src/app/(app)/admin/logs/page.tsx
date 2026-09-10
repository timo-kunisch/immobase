import Link from "next/link";
import { History } from "lucide-react";

import { countAuditLogEntries, listAuditLogCategories, listAuditLogEntriesPage, type AuditLogFilter } from "@/data/audit-log";
import { listUsers } from "@/data/users";
import type { AuditAction, AuditCategory } from "@/data/types";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translator";
import { resolvePagination } from "@/lib/pagination";

export const dynamic = "force-dynamic";

/** Übersetzungs-Schlüssel der Aktions-Labels (AuditAction). */
const actionLabelKeys: Record<AuditAction, MessageKey> = {
	CREATE: "admin.action.CREATE",
	UPDATE: "admin.action.UPDATE",
	DELETE: "admin.action.DELETE",
	LOGIN: "admin.action.LOGIN",
	LOGOUT: "admin.action.LOGOUT",
};

const actionStyles: Record<AuditAction, string> = {
	CREATE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
	UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
	DELETE: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
	LOGIN: "bg-muted text-muted-foreground",
	LOGOUT: "bg-muted text-muted-foreground",
};

/** Übersetzungs-Schlüssel der Anzeige-Labels der Modul-Schlüssel (AuditCategory). */
const categoryLabelKeys: Record<AuditCategory, MessageKey> = {
	auth: "admin.category.auth",
	liegenschaften: "admin.category.liegenschaften",
	einheiten: "admin.category.einheiten",
	tickets: "admin.category.tickets",
	dokumente: "admin.category.dokumente",
	kalender: "admin.category.kalender",
	wissen: "admin.category.wissen",
	mieter: "admin.category.mieter",
	vertraege: "admin.category.vertraege",
	finanzen: "admin.category.finanzen",
	buchhaltung: "admin.category.buchhaltung",
	abrechnung: "admin.category.abrechnung",
	vorlagen: "admin.category.vorlagen",
	weg: "admin.category.weg",
	eigentuemer: "admin.category.eigentuemer",
	eigentumsverhaeltnisse: "admin.category.eigentumsverhaeltnisse",
	verteilerschluessel: "admin.category.verteilerschluessel",
	wirtschaftsplan: "admin.category.wirtschaftsplan",
	jahresabrechnung: "admin.category.jahresabrechnung",
	hausgeld: "admin.category.hausgeld",
	ruecklage: "admin.category.ruecklage",
	versammlungen: "admin.category.versammlungen",
	beschluesse: "admin.category.beschluesse",
	admin: "admin.category.admin",
	einstellungen: "admin.category.einstellungen",
	postversand: "admin.category.postversand",
	postfach: "admin.category.postfach",
	system: "admin.category.system",
};

export default async function AdminLogsPage({
	searchParams,
}: {
	searchParams: Promise<{ page?: string; userId?: string; category?: string }>;
}) {
	const { page: pageParam, userId, category: categoryParam } = await searchParams;
	const t = await getT();

	// Der Kategorie-Filter wird gegen die tatsächlich vorkommenden Werte
	// geprüft, damit beliebige Query-Strings keine leeren Ergebnismengen
	// erzeugen (und das Dropdown nur sinnvolle Optionen anbietet).
	const categories = listAuditLogCategories();
	const category = categories.find((value) => value === categoryParam);
	const filter: AuditLogFilter = { userId: userId || undefined, category };
	const hasFilter = Boolean(filter.userId || filter.category);

	const pagination = resolvePagination(pageParam, countAuditLogEntries(filter));
	const entries = listAuditLogEntriesPage(filter, pagination.limit, pagination.offset);
	const userList = listUsers();

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title={t("admin.logs.title")}
				description={t("admin.logs.description")}
			/>

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				{/* Filter als schlichtes GET-Formular (Server-Navigation, kein
				    Client-State nötig; page wird dadurch automatisch zurückgesetzt). */}
				<form method="get" className="flex flex-wrap items-end gap-2">
					<div className="flex flex-col gap-1">
						<label htmlFor="userId" className="text-xs text-muted-foreground">
							{t("admin.logs.filter.user")}
						</label>
						<select id="userId" name="userId" defaultValue={filter.userId ?? ""} className="h-9 rounded-md border bg-background px-3 text-sm">
							<option value="">{t("admin.logs.filter.allUsers")}</option>
							{userList.map((user) => (
								<option key={user.id} value={user.id}>
									{user.email}
								</option>
							))}
						</select>
					</div>
					<div className="flex flex-col gap-1">
						<label htmlFor="category" className="text-xs text-muted-foreground">
							{t("admin.logs.filter.category")}
						</label>
						<select id="category" name="category" defaultValue={filter.category ?? ""} className="h-9 rounded-md border bg-background px-3 text-sm">
							<option value="">{t("admin.logs.filter.allCategories")}</option>
							{categories.map((value) => (
								<option key={value} value={value}>
									{t(categoryLabelKeys[value] ?? value)}
								</option>
							))}
						</select>
					</div>
					<Button type="submit" variant="outline" size="sm">
						{t("common.filter")}
					</Button>
					{hasFilter ? (
						<Button asChild variant="ghost" size="sm">
							<Link href="/admin/logs">{t("admin.logs.filter.reset")}</Link>
						</Button>
					) : null}
				</form>

				<Card>
					<CardContent className="p-0">
						{entries.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<History className="size-8" />
								<p>{hasFilter ? t("admin.logs.empty.filtered") : t("admin.logs.empty.unfiltered")}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("admin.logs.table.time")}</TableHead>
										<TableHead>{t("admin.logs.table.user")}</TableHead>
										<TableHead>{t("admin.logs.table.action")}</TableHead>
										<TableHead>{t("admin.logs.table.category")}</TableHead>
										<TableHead>{t("admin.logs.table.description")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{entries.map((entry) => (
										<TableRow key={entry.id}>
											<TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(entry.createdAt)}</TableCell>
											<TableCell className="font-medium">{entry.userEmail}</TableCell>
											<TableCell>
												<Badge className={actionStyles[entry.action]}>{t(actionLabelKeys[entry.action] ?? entry.action)}</Badge>
											</TableCell>
											<TableCell className="text-muted-foreground">{t(categoryLabelKeys[entry.category] ?? entry.category)}</TableCell>
											<TableCell>{entry.description}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>

				<PaginationBar basePath="/admin/logs" pagination={pagination} params={{ userId: filter.userId, category: filter.category }} />
			</div>
		</div>
	);
}
