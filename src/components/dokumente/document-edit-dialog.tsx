"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import type { UnifiedDocument } from "@/lib/documents-overview";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translator";

import { updateDocumentAction } from "@/app/(app)/dokumente/actions";
import type { Property, Tenant, Unit } from "@/data/types";

const typeLabelKeys: Record<string, MessageKey> = {
	CONTRACT: "documents.category.CONTRACT",
	INVOICE: "documents.category.INVOICE",
	FLOORPLAN: "documents.category.FLOORPLAN",
	OTHER: "documents.category.OTHER",
};

/**
 * Bearbeiten-Dialog eines hochgeladenen DMS-Dokuments (Quelle "DOCUMENT"):
 * Dokumententyp und die Zuordnungen zu Liegenschaft/Einheit/Mieter anpassen -
 * die hochgeladene Datei selbst (Name, Inhalt, Ablage) bleibt unverändert.
 * Bewusst nur für hochgeladene Dokumente verfügbar: Vorlagen-Schreiben und
 * Abrechnungs-PDFs leiten ihre Zuordnungen aus den Fachdaten ab.
 */
export function DocumentEditDialog({
	row,
	properties,
	units,
	tenants,
}: {
	row: UnifiedDocument;
	properties: Property[];
	units: Unit[];
	tenants: Tenant[];
}) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(updateDocumentAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} title={t("common.edit")}>
					<Pencil className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{t("documents.dialog.editTitle")}</DialogTitle>
						<DialogDescription>{t("documents.dialog.editDescription", { name: row.fileName })}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="id" value={row.id} />

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="type">{t("documents.fields.type")}</Label>
							<Select name="type" defaultValue={row.documentType ?? "OTHER"}>
								<SelectTrigger id="type" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(typeLabelKeys).map(([value, labelKey]) => (
										<SelectItem key={value} value={value}>
											{t(labelKey)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<p className="text-xs text-muted-foreground">{t("documents.fields.assignmentHint")}</p>

						<div className="grid grid-cols-3 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="propertyId">{t("common.property")}</Label>
								<SearchableSelect
									name="propertyId"
									id="propertyId"
									options={[
										{ value: "none", label: t("common.none") },
										...properties.map((property) => ({ value: property.id, label: property.name })),
									]}
									defaultValue={row.property?.id ?? "none"}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="unitId">{t("common.unit")}</Label>
								<SearchableSelect
									name="unitId"
									id="unitId"
									options={[
										{ value: "none", label: t("common.none") },
										...units.map((unit) => ({ value: unit.id, label: unit.label })),
									]}
									defaultValue={row.unit?.id ?? "none"}
								/>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="tenantId">{t("common.tenant")}</Label>
								<SearchableSelect
									name="tenantId"
									id="tenantId"
									options={[
										{ value: "none", label: t("documents.fields.noTenant") },
										...tenants.map((tenant) => ({ value: tenant.id, label: `${tenant.firstName} ${tenant.lastName}` })),
									]}
									defaultValue={row.tenant?.id ?? "none"}
								/>
							</div>
						</div>

						<ActionErrorToast state={state} />
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							{t("common.cancel")}
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							{t("common.save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
