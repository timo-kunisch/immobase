"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { saveUnitAction } from "@/app/(app)/einheiten/actions";
import type { Property, Unit } from "@/data/types";

export function UnitFormDialog({ unit, properties }: { unit?: Unit; properties: Property[] }) {
	const { t } = useI18n();
	const isEdit = Boolean(unit);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveUnitAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
			{isEdit ? (
				<Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} title={t("common.edit")}>
					<Pencil className="size-4" />
				</Button>
			) : (
				<Button type="button" disabled={properties.length === 0}>
					<Plus />
					{t("units.actions.create")}
				</Button>
			)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
				<DialogHeader>
					<DialogTitle>{isEdit ? t("units.dialog.editTitle") : t("units.dialog.createTitle")}</DialogTitle>
					<DialogDescription>{t("units.dialog.description")}</DialogDescription>
				</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={unit!.id} /> : null}

					<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="propertyId">{t("common.property")} *</Label>
						<Select name="propertyId" defaultValue={unit?.propertyId ?? properties[0]?.id} required>
							<SelectTrigger id="propertyId" className="w-full">
								<SelectValue placeholder={t("units.placeholder.property")} />
							</SelectTrigger>
								<SelectContent>
									{properties.map((property) => (
										<SelectItem key={property.id} value={property.id}>
											{property.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
					<div className="grid gap-2">
						<Label htmlFor="label">{t("units.fields.label")} *</Label>
						<Input id="label" name="label" placeholder={t("units.placeholder.label")} defaultValue={unit?.label} required />
					</div>
					<div className="grid grid-cols-3 gap-4">
						<div className="grid gap-2">
							<Label htmlFor="floor">{t("units.fields.floor")}</Label>
							<Input id="floor" name="floor" placeholder={t("units.placeholder.floor")} defaultValue={unit?.floor ?? ""} />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="livingSpace">{t("units.fields.livingSpace")}</Label>
							<Input id="livingSpace" name="livingSpace" type="number" step="0.01" min="0" defaultValue={unit?.livingSpace ?? ""} />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="rooms">{t("units.fields.rooms")}</Label>
							<Input id="rooms" name="rooms" type="number" step="0.5" min="0" defaultValue={unit?.rooms ?? ""} />
						</div>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="coOwnershipShare">{t("units.fields.coOwnershipShare")}</Label>
						<Input id="coOwnershipShare" name="coOwnershipShare" type="number" step="0.01" min="0" defaultValue={unit?.coOwnershipShare ?? ""} />
						<p className="text-xs text-muted-foreground">{t("units.fields.coOwnershipShareHint")}</p>
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
