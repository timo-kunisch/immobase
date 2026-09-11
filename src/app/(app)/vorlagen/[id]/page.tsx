import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText } from "lucide-react";

import { getDocumentTemplate, listGeneratedDocumentsByTemplate, listLeaseOptions } from "@/data/templates";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GeneratedDocumentsTable } from "@/components/vorlagen/generated-documents-table";
import { GenerateDocumentForm } from "@/components/vorlagen/generate-document-form";
import { getT } from "@/lib/i18n/server";
import { isLetterXpressConfigured } from "@/lib/letterxpress";
import { documentTemplateCategoryLabelKeys } from "@/lib/templates";

export const dynamic = "force-dynamic";

export default async function VorlageDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const t = await getT();
	const { id } = await params;

	const template = getDocumentTemplate(id);
	const postalConfigured = isLetterXpressConfigured();
	if (!template) {
		notFound();
	}

	const generatedDocumentList = listGeneratedDocumentsByTemplate(id);
	// Bewusst nur die für die Vertragsauswahl benötigten Felder selektieren
	// (kein voller Lease-Datensatz an eine Client Component übergeben).
	const leaseList = listLeaseOptions();

	return (
		<div className="flex flex-1 flex-col">
		<SiteHeader
			title={template.title}
			description={t("templates.detail.description")}
			actions={
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" asChild>
						<Link href="/vorlagen">
							<ChevronLeft />
							{t("common.back")}
						</Link>
					</Button>
					<Badge variant="secondary">{t(documentTemplateCategoryLabelKeys[template.category])}</Badge>
				</div>
			}
		/>

		<div className="flex-1 space-y-6 p-4 sm:p-6">
			<div>
				<h2 className="mb-3 text-base font-semibold">{t("templates.detail.generateHeading")}</h2>
				<GenerateDocumentForm templateId={template.id} leases={leaseList} />
			</div>

			<div>
				<h2 className="mb-3 text-base font-semibold">{t("templates.detail.generatedHeading")}</h2>
				<Card>
					<CardContent className="p-0">
						{generatedDocumentList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-muted-foreground">
								<FileText className="size-8" />
								<p>{t("templates.generated.emptyForTemplate")}</p>
							</div>
						) : (
							<GeneratedDocumentsTable rows={generatedDocumentList} showTenantColumn showSendByPost postalConfigured={postalConfigured} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
		</div>
	);
}
