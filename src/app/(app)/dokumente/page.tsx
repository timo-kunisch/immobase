import Link from "next/link";
import { FolderOpen, Trash2 } from "lucide-react";

import { getTenant, getUnitWithPropertyName, listTenantsByLastName, listUnitsByLabel } from "@/data/documents";
import { getProperty, listProperties } from "@/data/properties";
import { SiteHeader } from "@/components/layout/site-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DocumentUploadDialog } from "@/components/dokumente/document-upload-dialog";
import { DocumentSearchForm } from "@/components/dokumente/document-search-form";
import { DocumentsTable } from "@/components/dokumente/documents-table";
import { DocumentsTrashTable } from "@/components/dokumente/documents-trash-table";
import { loadUnifiedDocuments } from "@/lib/documents-overview";
import { DOCUMENT_TRASH_RETENTION_DAYS, loadTrashedDocuments, purgeExpiredDocuments } from "@/lib/document-trash";
import { getT } from "@/lib/i18n/server";
import { isLetterXpressConfigured } from "@/lib/letterxpress";

export const dynamic = "force-dynamic";

export default async function DokumentePage({
	searchParams,
}: {
	searchParams: Promise<{
		q?: string;
		propertyId?: string;
		unitId?: string;
		tenantId?: string;
		trash?: string;
	}>;
}) {
	const t = await getT();
	const { q, propertyId, unitId, tenantId, trash } = await searchParams;
	const showTrash = trash === "1";
	const postalConfigured = isLetterXpressConfigured();
	const query = q?.trim();

	// ------------------------------------------------------------
	// Papierkorb-Ansicht (?trash=1): gelöschte Dokumente beider
	// löschbarer Quellen mit Wiederherstellen/Endgültig-Löschen.
	// ------------------------------------------------------------
	if (showTrash) {
		// Abgelaufene Einträge vor dem Anzeigen endgültig löschen, damit die
		// Aufbewahrungsfrist auch dann zuverlässig greift, wenn die App nur
		// kurz läuft (der Scheduler in src/lib/document-trash.ts deckt
		// laufende Sitzungen ab).
		await purgeExpiredDocuments();
		const trashRows = loadTrashedDocuments();

		return (
			<div className="flex flex-1 flex-col">
				<SiteHeader
					title={t("documents.trash.title")}
					description={t("documents.trash.description", { days: DOCUMENT_TRASH_RETENTION_DAYS })}
					actions={
						<Button variant="outline" asChild>
							<Link href="/dokumente">{t("documents.trash.back")}</Link>
						</Button>
					}
				/>

				<div className="flex-1 space-y-4 p-4 sm:p-6">
					<Card>
						<CardContent className="p-0">
							{trashRows.length === 0 ? (
								<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
									<Trash2 className="size-8" />
									<p>{t("documents.trash.empty")}</p>
								</div>
							) : (
								<DocumentsTrashTable rows={trashRows} />
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	// Vollständige, serverseitig vorgefilterte Liste (die vier Quellen
	// werden in src/lib/documents-overview.ts im Speicher zusammengeführt) -
	// Sortierung, Spalten-Filterung und Pagination (50/Seite) übernimmt die
	// Client-Datentabelle.
	const documentRows = await loadUnifiedDocuments({ propertyId, unitId, tenantId, search: query });

	// Picker-Listen alphabetisch (bisher: SQL ORDER BY name/label/lastName ASC).
	const propertyList = listProperties().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
	const unitList = listUnitsByLabel();
	const tenantList = listTenantsByLastName();

	// Filter-Hinweis (Priorität wie bisher: Liegenschaft > Einheit > Mieter).
	let filterLabel: string | null = null;
	if (propertyId) {
		filterLabel = getProperty(propertyId)?.name ?? null;
	} else if (unitId) {
		const filteredUnit = getUnitWithPropertyName(unitId);
		filterLabel = filteredUnit ? `${filteredUnit.propertyName} – ${filteredUnit.label}` : null;
	} else if (tenantId) {
		const filteredTenant = getTenant(tenantId);
		filterLabel = filteredTenant ? `${filteredTenant.firstName} ${filteredTenant.lastName}` : null;
	}

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title={t("documents.title")}
				description={t("documents.description")}
				actions={
					<>
						<Button variant="outline" asChild>
							<Link href="/dokumente?trash=1">{t("documents.trash.open")}</Link>
						</Button>
						<DocumentUploadDialog properties={propertyList} units={unitList} tenants={tenantList} />
					</>
				}
			/>

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				{filterLabel ? (
					<p className="text-sm text-muted-foreground">
						{t("documents.filter.filteredBy")} <span className="font-medium text-foreground">{filterLabel}</span> ·{" "}
						<Link href="/dokumente" className="text-primary hover:underline">
							{t("common.resetFilters")}
						</Link>
					</p>
				) : null}
				<DocumentSearchForm defaultValue={query} />

				<Card>
					<CardContent className="p-0">
						{documentRows.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<FolderOpen className="size-8" />
								<p>{query ? t("documents.emptySearch", { query }) : t("documents.empty")}</p>
							</div>
						) : (
							<DocumentsTable
								rows={documentRows}
								postalConfigured={postalConfigured}
								properties={propertyList}
								units={unitList}
								tenants={tenantList}
							/>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
