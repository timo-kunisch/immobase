"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { savePropertyAction } from "@/app/(app)/liegenschaften/actions";
import type { Property } from "@/data/types";

export function PropertyFormDialog({ property }: { property?: Property }) {
	const { t } = useI18n();
	const isEdit = Boolean(property);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(savePropertyAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
			}}
		>
			<DialogTrigger asChild>
			{isEdit ? (
				<Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} title={t("common.edit")}>
					<Pencil className="size-4" />
				</Button>
			) : (
				<Button type="button">
					<Plus />
					{t("properties.actions.create")}
				</Button>
			)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
				<DialogHeader>
					<DialogTitle>{isEdit ? t("properties.dialog.editTitle") : t("properties.dialog.createTitle")}</DialogTitle>
					<DialogDescription>{t("properties.dialog.description")}</DialogDescription>
				</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={property!.id} /> : null}

					<div className="grid gap-4 py-4">
					<div className="grid gap-2">
						<Label htmlFor="name">{t("properties.fields.name")} *</Label>
						<Input id="name" name="name" placeholder={t("properties.placeholder.name")} defaultValue={property?.name} required />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="street">{t("properties.fields.street")} *</Label>
						<Input id="street" name="street" placeholder={t("properties.placeholder.street")} defaultValue={property?.street} required />
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="grid gap-2">
							<Label htmlFor="zipCode">{t("properties.fields.zipCode")} *</Label>
							<Input id="zipCode" name="zipCode" placeholder={t("properties.placeholder.zipCode")} defaultValue={property?.zipCode} required />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="city">{t("properties.fields.city")} *</Label>
							<Input id="city" name="city" placeholder={t("properties.placeholder.city")} defaultValue={property?.city} required />
						</div>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="country">{t("properties.fields.country")}</Label>
						<Input id="country" name="country" defaultValue={property?.country ?? t("properties.fields.countryDefault")} />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="notes">{t("common.notes")}</Label>
						<Textarea id="notes" name="notes" placeholder={t("properties.placeholder.notes")} defaultValue={property?.notes ?? ""} />
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
