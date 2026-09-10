import Link from "next/link";
import { FileText, FolderOpen } from "lucide-react";

import { getTenant, getUnitWithPropertyName, listTenantsByLastName, listUnitsByLabel } from "@/data/documents";
import { getProperty, listProperties } from "@/data/properties";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { DocumentUploadDialog } from "@/components/dokumente/document-upload-dialog";
import { DocumentSearchForm } from "@/components/dokumente/document-search-form";
import { SendByPostButton } from "@/components/postal-shipments/send-by-post-button";
import { formatDate } from "@/lib/format";
import { formatFileSize } from "@/lib/format";
import { loadUnifiedDocuments } from "@/lib/documents-overview";
import { getT } from "@/lib/i18n/server";
import type { MessageKey } from "@/lib/i18n/translator";
import { resolvePagination } from "@/lib/pagination";

import { deleteAnyDocumentAction, sendAnyDocumentByPostAction } from "./actions";
import { isLetterXpressConfigured } from "@/lib/letterxpress";

export const dynamic = "force-dynamic";

const typeLabelKeys: Record<string, MessageKey> = {
	CONTRACT: "documents.category.CONTRACT",
	INVOICE: "documents.category.INVOICE",
	FLOORPLAN: "documents.category.FLOORPLAN",
	OTHER: "documents.category.OTHER",
};

const sourceTypeLabelKeys: Record<string, MessageKey> = {
	DOCUMENT: "documents.sourceType.DOCUMENT",
	GENERATED_DOCUMENT: "documents.sourceType.GENERATED_DOCUMENT",
	TENANT_STATEMENT: "documents.sourceType.TENANT_STATEMENT",
};

const sourceTypeStyles: Record<string, string> = {
	DOCUMENT: "bg-muted text-muted-foreground",
	GENERATED_DOCUMENT: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
	TENANT_STATEMENT: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
};

export default async function DokumentePage({
	searchParams,
}: {
	searchParams: Promise<{
		q?: string;
		propertyId?: string;
		unitId?: string;
		tenantId?: string;
		page?: string;
	}>;
}) {
	const t = await getT();
	const { q, propertyId, unitId, tenantId, page: pageParam } = await searchParams;
	const postalConfigured = isLetterXpressConfigured();
	const query = q?.trim();

	const documentRows = await loadUnifiedDocuments({ propertyId, unitId, tenantId, search: query });

	// Paginierung der gemergten Übersicht (die drei Quellen werden in
	// src/lib/documents-overview.ts im Speicher zusammengeführt - der Slice
	// erfolgt daher hier statt auf SQL-Ebene, eine Seite = 50 Einträge).
	const documentPagination = resolvePagination(pageParam, documentRows.length);
	const pagedDocumentRows = documentRows.slice(documentPagination.offset, documentPagination.offset + documentPagination.limit);
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
		<SiteHeader title={t("documents.title")} description={t("documents.description")} actions={<DocumentUploadDialog properties={propertyList} units={unitList} tenants={tenantList} />} />

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
							<Table>
								<TableHeader>
								<TableRow>
									<TableHead>{t("documents.table.file")}</TableHead>
									<TableHead>{t("documents.table.source")}</TableHead>
									<TableHead>{t("documents.table.linkedTo")}</TableHead>
									<TableHead>{t("common.date")}</TableHead>
									<TableHead className="w-[100px] text-right">{t("common.actions")}</TableHead>
								</TableRow>
								</TableHeader>
							<TableBody>
								{pagedDocumentRows.map((document) => (
										<TableRow key={`${document.sourceType}-${document.id}`}>
											<TableCell className="font-medium">
												<a href={`/api/uploads/${document.filePath}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline">
													<FileText className="size-4 text-muted-foreground" />
													{document.fileName}
												</a>
												<span className="block pl-6 text-xs text-muted-foreground">{formatFileSize(document.fileSize)}</span>
											</TableCell>
											<TableCell>
												<div className="flex flex-col gap-1">
												<Badge className={sourceTypeStyles[document.sourceType]}>{t(sourceTypeLabelKeys[document.sourceType])}</Badge>
												{document.documentType ? <Badge variant="secondary">{t(typeLabelKeys[document.documentType])}</Badge> : null}
												</div>
											</TableCell>
											<TableCell className="text-muted-foreground">
												{document.property || document.unit || document.tenant ? (
													<div className="flex flex-col gap-0.5">
														{document.property ? (
															<Link href={`/liegenschaften#property-${document.property.id}`} className="hover:text-foreground hover:underline">
																{document.property.label}
															</Link>
														) : null}
														{document.unit ? (
															<Link href={`/einheiten#unit-${document.unit.id}`} className="hover:text-foreground hover:underline">
																{document.unit.label}
															</Link>
														) : null}
														{document.tenant ? (
															<Link href={`/mieter#tenant-${document.tenant.id}`} className="hover:text-foreground hover:underline">
																{document.tenant.label}
															</Link>
														) : null}
													</div>
												) : (
													"–"
												)}
											</TableCell>
											<TableCell className="text-muted-foreground">{formatDate(document.createdAt)}</TableCell>
											<TableCell>
												<div className="flex items-center justify-end gap-1">
												<SendByPostButton
													sendAction={sendAnyDocumentByPostAction.bind(null, document.sourceType, document.id)}
													disabled={!postalConfigured || document.mimeType !== "application/pdf"}
													disabledReason={!postalConfigured ? t("postal.notConfiguredShort") : t("documents.errors.onlyPdf")}
												/>
												{document.sourceType !== "TENANT_STATEMENT" ? (
													<ConfirmDeleteButton
														action={deleteAnyDocumentAction.bind(null, document.sourceType, document.id)}
														confirmMessage={t("documents.confirm.delete", { name: document.fileName })}
													/>
												) : null}
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>

				<PaginationBar basePath="/dokumente" pagination={documentPagination} params={{ q: query, propertyId, unitId, tenantId }} />
			</div>
		</div>
	);
}
