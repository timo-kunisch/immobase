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
import { resolvePagination } from "@/lib/pagination";

export const dynamic = "force-dynamic";

const actionLabels: Record<AuditAction, string> = {
	CREATE: "Angelegt",
	UPDATE: "Bearbeitet",
	DELETE: "Gelöscht",
	LOGIN: "Anmeldung",
	LOGOUT: "Abmeldung",
};

const actionStyles: Record<AuditAction, string> = {
	CREATE: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
	UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
	DELETE: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
	LOGIN: "bg-muted text-muted-foreground",
	LOGOUT: "bg-muted text-muted-foreground",
};

/** Deutsche Anzeige-Labels der Modul-Schlüssel (AuditCategory). */
const categoryLabels: Record<AuditCategory, string> = {
	auth: "Anmeldung",
	liegenschaften: "Liegenschaften",
	einheiten: "Einheiten",
	tickets: "Tickets",
	dokumente: "Dokumente",
	kalender: "Kalender",
	wissen: "Wissensdatenbank",
	mieter: "Mieter",
	vertraege: "Verträge",
	finanzen: "Finanzen",
	abrechnung: "Abrechnung",
	vorlagen: "Vorlagen",
	weg: "WEGs",
	eigentuemer: "Eigentümer",
	eigentumsverhaeltnisse: "Eigentumsverhältnisse",
	verteilerschluessel: "Verteilerschlüssel",
	wirtschaftsplan: "Wirtschaftsplan",
	jahresabrechnung: "Jahresabrechnung (WEG)",
	hausgeld: "Hausgeld",
	ruecklage: "Rücklage",
	versammlungen: "Versammlungen",
	beschluesse: "Beschluss-Sammlung",
	admin: "Nutzerverwaltung",
	einstellungen: "Einstellungen",
	postversand: "Postversand",
	system: "System",
};

export default async function AdminLogsPage({
	searchParams,
}: {
	searchParams: Promise<{ page?: string; userId?: string; category?: string }>;
}) {
	const { page: pageParam, userId, category: categoryParam } = await searchParams;

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
				title="Aktivitätsprotokoll"
				description="Nachvollziehen, welcher Nutzer wann welche Änderungen in der App vorgenommen hat."
			/>

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				{/* Filter als schlichtes GET-Formular (Server-Navigation, kein
				    Client-State nötig; page wird dadurch automatisch zurückgesetzt). */}
				<form method="get" className="flex flex-wrap items-end gap-2">
					<div className="flex flex-col gap-1">
						<label htmlFor="userId" className="text-xs text-muted-foreground">
							Nutzer
						</label>
						<select id="userId" name="userId" defaultValue={filter.userId ?? ""} className="h-9 rounded-md border bg-background px-3 text-sm">
							<option value="">Alle Nutzer</option>
							{userList.map((user) => (
								<option key={user.id} value={user.id}>
									{user.email}
								</option>
							))}
						</select>
					</div>
					<div className="flex flex-col gap-1">
						<label htmlFor="category" className="text-xs text-muted-foreground">
							Bereich
						</label>
						<select id="category" name="category" defaultValue={filter.category ?? ""} className="h-9 rounded-md border bg-background px-3 text-sm">
							<option value="">Alle Bereiche</option>
							{categories.map((value) => (
								<option key={value} value={value}>
									{categoryLabels[value] ?? value}
								</option>
							))}
						</select>
					</div>
					<Button type="submit" variant="outline" size="sm">
						Filtern
					</Button>
					{hasFilter ? (
						<Button asChild variant="ghost" size="sm">
							<Link href="/admin/logs">Zurücksetzen</Link>
						</Button>
					) : null}
				</form>

				<Card>
					<CardContent className="p-0">
						{entries.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<History className="size-8" />
								<p>{hasFilter ? "Keine Einträge für die gewählten Filter." : "Noch keine Aktivitäten protokolliert."}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Zeitpunkt</TableHead>
										<TableHead>Nutzer</TableHead>
										<TableHead>Aktion</TableHead>
										<TableHead>Bereich</TableHead>
										<TableHead>Beschreibung</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{entries.map((entry) => (
										<TableRow key={entry.id}>
											<TableCell className="whitespace-nowrap text-muted-foreground">{formatDateTime(entry.createdAt)}</TableCell>
											<TableCell className="font-medium">{entry.userEmail}</TableCell>
											<TableCell>
												<Badge className={actionStyles[entry.action]}>{actionLabels[entry.action] ?? entry.action}</Badge>
											</TableCell>
											<TableCell className="text-muted-foreground">{categoryLabels[entry.category] ?? entry.category}</TableCell>
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
