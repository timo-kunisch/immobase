import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileText } from "lucide-react";

import { getDocumentTemplate, listGeneratedDocumentsByTemplate, listLeaseOptions } from "@/data/templates";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { GenerateDocumentForm } from "@/components/vorlagen/generate-document-form";
import { SendByPostButton } from "@/components/postal-shipments/send-by-post-button";
import { formatDate } from "@/lib/format";
import { formatFileSize } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { isLetterXpressConfigured } from "@/lib/letterxpress";
import { documentTemplateCategoryLabelKeys } from "@/lib/templates";

import { deleteGeneratedDocumentAction, sendGeneratedDocumentByPostAction } from "../actions";

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
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("templates.generated.table.subject")}</TableHead>
										<TableHead>{t("common.tenant")}</TableHead>
										<TableHead>{t("templates.generated.table.createdAt")}</TableHead>
										<TableHead className="w-[100px] text-right">{t("common.actions")}</TableHead>
									</TableRow>
								</TableHeader>
									<TableBody>
										{generatedDocumentList.map((document) => (
											<TableRow key={document.id}>
												<TableCell className="font-medium">
													<a href={`/api/uploads/${document.filePath}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline">
														<FileText className="size-4 text-muted-foreground" />
														{document.subject || document.templateTitle}
													</a>
													<span className="block pl-6 text-xs text-muted-foreground">{formatFileSize(document.fileSize)}</span>
												</TableCell>
												<TableCell className="text-muted-foreground">
													{document.tenant ? (
														<Link href={`/mieter#tenant-${document.tenant.id}`} className="hover:underline">
															{document.tenant.firstName} {document.tenant.lastName}
														</Link>
													) : (
														"–"
													)}
												</TableCell>
												<TableCell className="text-muted-foreground">{formatDate(document.createdAt)}</TableCell>
												<TableCell>
													<div className="flex items-center justify-end gap-1">
													<SendByPostButton sendAction={sendGeneratedDocumentByPostAction.bind(null, document.id)} disabled={!postalConfigured} disabledReason={t("postal.notConfiguredShort")} />
													<ConfirmDeleteButton action={deleteGeneratedDocumentAction.bind(null, document.id)} confirmMessage={t("templates.generated.confirmDelete")} />
													</div>
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							)}
						</CardContent>
					</Card>
				</div>
			</div>
		</div>
	);
}
