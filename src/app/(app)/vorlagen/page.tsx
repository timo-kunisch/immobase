import Link from "next/link";
import { FileText } from "lucide-react";

import { getGeneratedDocumentCountsByTemplate, getLeaseTenantName, listDocumentTemplates, listGeneratedDocumentsFiltered } from "@/data/templates";
import { getTenant } from "@/data/tenants";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { GeneratedDocumentsTable } from "@/components/vorlagen/generated-documents-table";
import { TemplateFormDialog } from "@/components/vorlagen/template-form-dialog";
import { TemplatesTable } from "@/components/vorlagen/templates-table";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function VorlagenPage({ searchParams }: { searchParams: Promise<{ tenantId?: string; leaseId?: string }> }) {
	const t = await getT();
	const { tenantId, leaseId } = await searchParams;

	// Bei aktivem Filter (Verlinkung von Mieter/Vertrag aus) wird statt der
	// Vorlagen-Übersicht eine flache Liste der für diesen Mieter/Vertrag
	// bereits erzeugten Schreiben angezeigt - analog zum Filter-Muster der
	// Dokumente-Seite.
	if (tenantId || leaseId) {
		const documentList = listGeneratedDocumentsFiltered({ tenantId, leaseId });
		const filteredTenant = tenantId ? getTenant(tenantId) : null;
		const filteredLeaseTenant = leaseId ? getLeaseTenantName(leaseId) : null;

		const filterLabel = filteredTenant
			? `${filteredTenant.firstName} ${filteredTenant.lastName}`
			: filteredLeaseTenant
				? `${filteredLeaseTenant.firstName} ${filteredLeaseTenant.lastName}`
				: null;

		return (
			<div className="flex flex-1 flex-col">
				<SiteHeader title={t("templates.generated.title")} description={t("templates.generated.description")} />
				<div className="flex-1 space-y-4 p-4 sm:p-6">
					{filterLabel ? (
						<p className="text-sm text-muted-foreground">
							{t("templates.filter.filteredBy")} <span className="font-medium text-foreground">{filterLabel}</span> ·{" "}
							<Link href="/vorlagen" className="text-primary hover:underline">
								{t("common.resetFilters")}
							</Link>
						</p>
					) : null}
					<Card>
						<CardContent className="p-0">
							{documentList.length === 0 ? (
								<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
									<FileText className="size-8" />
									<p>{t("templates.generated.empty")}</p>
								</div>
							) : (
								<GeneratedDocumentsTable rows={documentList} showTemplateColumn />
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	const templateList = listDocumentTemplates();
	const generatedCountMap = getGeneratedDocumentCountsByTemplate();
	// Counts-Map serverseitig auflösen (Maps sind als Client-Props nicht
	// serialisierbar).
	const rows = templateList.map((template) => ({ ...template, generatedCount: generatedCountMap.get(template.id) ?? 0 }));

	return (
		<div className="flex flex-1 flex-col">
		<SiteHeader title={t("templates.title")} description={t("templates.description")} actions={<TemplateFormDialog />} />

		<div className="flex-1 space-y-4 p-4 sm:p-6">
			<Card>
				<CardContent className="p-0">
					{rows.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
							<FileText className="size-8" />
							<p>{t("templates.empty")}</p>
						</div>
					) : (
						<TemplatesTable rows={rows} />
					)}
				</CardContent>
			</Card>
		</div>
		</div>
	);
}
