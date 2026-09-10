import Link from "next/link";
import { FilePlus2, FileText } from "lucide-react";

import { getGeneratedDocumentCountsByTemplate, getLeaseTenantName, listDocumentTemplates, listGeneratedDocumentsFiltered } from "@/data/templates";
import { getTenant } from "@/data/tenants";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { CountLinkBadge } from "@/components/ui/count-link-badge";
import { TemplateFormDialog } from "@/components/vorlagen/template-form-dialog";
import { formatDate } from "@/lib/format";
import { formatFileSize } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { documentTemplateCategoryLabelKeys } from "@/lib/templates";

import { deleteDocumentTemplateAction, deleteGeneratedDocumentAction } from "./actions";

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
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead>{t("templates.generated.table.subject")}</TableHead>
											<TableHead>{t("templates.generated.table.template")}</TableHead>
											<TableHead>{t("templates.generated.table.createdAt")}</TableHead>
											<TableHead className="w-[100px] text-right">{t("common.actions")}</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{documentList.map((document) => (
											<TableRow key={document.id}>
												<TableCell className="font-medium">
													<a href={`/api/uploads/${document.filePath}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:underline">
														<FileText className="size-4 text-muted-foreground" />
														{document.subject || document.templateTitle}
													</a>
													<span className="block pl-6 text-xs text-muted-foreground">{formatFileSize(document.fileSize)}</span>
												</TableCell>
												<TableCell className="text-muted-foreground">
													{document.templateId ? (
														<Link href={`/vorlagen/${document.templateId}`} className="hover:underline">
															{document.templateTitle}
														</Link>
													) : (
														document.templateTitle
													)}
												</TableCell>
												<TableCell className="text-muted-foreground">{formatDate(document.createdAt)}</TableCell>
												<TableCell>
													<div className="flex items-center justify-end gap-1">
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
		);
	}

	const templateList = listDocumentTemplates();
	const generatedCountMap = getGeneratedDocumentCountsByTemplate();

	return (
		<div className="flex flex-1 flex-col">
		<SiteHeader title={t("templates.title")} description={t("templates.description")} actions={<TemplateFormDialog />} />

		<div className="flex-1 space-y-4 p-4 sm:p-6">
			<Card>
				<CardContent className="p-0">
					{templateList.length === 0 ? (
						<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
							<FileText className="size-8" />
							<p>{t("templates.empty")}</p>
						</div>
					) : (
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("templates.table.title")}</TableHead>
									<TableHead>{t("templates.table.category")}</TableHead>
									<TableHead>{t("templates.table.generatedCount")}</TableHead>
									<TableHead className="w-[160px] text-right">{t("common.actions")}</TableHead>
								</TableRow>
							</TableHeader>
								<TableBody>
									{templateList.map((template) => (
										<TableRow key={template.id} id={`template-${template.id}`}>
											<TableCell className="font-medium">
												{template.title}
												{template.subject ? <span className="block text-xs text-muted-foreground">{template.subject}</span> : null}
											</TableCell>
										<TableCell>
											<Badge variant="secondary">{t(documentTemplateCategoryLabelKeys[template.category])}</Badge>
										</TableCell>
										<TableCell>
											<CountLinkBadge href={`/vorlagen/${template.id}`} count={generatedCountMap.get(template.id) ?? 0} label={t("templates.generated.countLabel")} icon={FileText} />
										</TableCell>
										<TableCell>
											<div className="flex items-center justify-end gap-1">
												<Button variant="ghost" size="icon-sm" aria-label={t("templates.actions.apply")} title={t("templates.actions.apply")} asChild>
													<Link href={`/vorlagen/${template.id}`}>
														<FilePlus2 className="size-4" />
													</Link>
												</Button>
												<TemplateFormDialog template={template} />
												<ConfirmDeleteButton
													action={deleteDocumentTemplateAction.bind(null, template.id)}
													confirmMessage={t("templates.confirm.deleteTemplate", { title: template.title })}
												/>
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
	);
}
