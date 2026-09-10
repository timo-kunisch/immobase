"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translator";

import { uploadDocumentAction } from "@/app/(app)/dokumente/actions";
import { ALLOWED_DOCUMENT_ACCEPT, ALLOWED_DOCUMENT_TYPES_LABEL } from "@/app/(app)/dokumente/upload-constraints";
import type { Property, Tenant, Unit } from "@/data/types";

const typeLabelKeys: Record<string, MessageKey> = {
	CONTRACT: "documents.category.CONTRACT",
	INVOICE: "documents.category.INVOICE",
	FLOORPLAN: "documents.category.FLOORPLAN",
	OTHER: "documents.category.OTHER",
};

export function DocumentUploadDialog({ properties, units, tenants }: { properties: Property[]; units: Unit[]; tenants: Tenant[] }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const formRef = useRef<HTMLFormElement>(null);
	const [state, formAction, isPending] = useActionState(uploadDocumentAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
			formRef.current?.reset();
		}
	}, [state.success]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button type="button">
					<Upload />
					{t("documents.actions.uploadFile")}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction} ref={formRef}>
					<DialogHeader>
						<DialogTitle>{t("documents.dialog.uploadTitle")}</DialogTitle>
						<DialogDescription>{t("documents.dialog.uploadDescription", { types: ALLOWED_DOCUMENT_TYPES_LABEL })}</DialogDescription>
					</DialogHeader>

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="file">{t("documents.fields.file")} *</Label>
							<input
								id="file"
								name="file"
								type="file"
								required
								accept={ALLOWED_DOCUMENT_ACCEPT}
								className="flex h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1.5 text-sm shadow-xs outline-none file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
							/>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="type">{t("documents.fields.type")}</Label>
							<Select name="type" defaultValue="OTHER">
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
								<Select name="propertyId" defaultValue="none">
									<SelectTrigger id="propertyId" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">{t("common.none")}</SelectItem>
										{properties.map((property) => (
											<SelectItem key={property.id} value={property.id}>
												{property.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="unitId">{t("common.unit")}</Label>
								<Select name="unitId" defaultValue="none">
									<SelectTrigger id="unitId" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">{t("common.none")}</SelectItem>
										{units.map((unit) => (
											<SelectItem key={unit.id} value={unit.id}>
												{unit.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="tenantId">{t("common.tenant")}</Label>
								<Select name="tenantId" defaultValue="none">
									<SelectTrigger id="tenantId" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">{t("documents.fields.noTenant")}</SelectItem>
										{tenants.map((tenant) => (
											<SelectItem key={tenant.id} value={tenant.id}>
												{tenant.firstName} {tenant.lastName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							{t("common.cancel")}
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							{t("common.upload")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
