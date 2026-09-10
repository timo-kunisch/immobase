"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { toDateInputValue } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { saveBillingPeriodAction } from "@/app/(app)/abrechnung/actions";
import type { BillingPeriod, Property } from "@/data/types";

export function BillingPeriodFormDialog({ billingPeriod, properties }: { billingPeriod?: BillingPeriod; properties: Property[] }) {
	const { t } = useI18n();
	const isEdit = Boolean(billingPeriod);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveBillingPeriodAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	const disabled = !isEdit && properties.length === 0;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{isEdit ? (
					<Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} title={t("common.edit")}>
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button" disabled={disabled}>
						<Plus />
						{t("billing.periodDialog.trigger")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("billing.periodDialog.editTitle") : t("billing.periodDialog.createTitle")}</DialogTitle>
						<DialogDescription>{t("billing.periodDialog.description")}</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={billingPeriod!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="propertyId">{t("common.property")} *</Label>
							<Select name="propertyId" defaultValue={billingPeriod?.propertyId ?? properties[0]?.id} required>
								<SelectTrigger id="propertyId" className="w-full">
									<SelectValue placeholder={t("billing.fields.propertyPlaceholder")} />
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

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="periodFrom">{t("billing.fields.periodFrom")} *</Label>
								<Input id="periodFrom" name="periodFrom" type="date" defaultValue={toDateInputValue(billingPeriod?.periodFrom)} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="periodTo">{t("billing.fields.periodTo")} *</Label>
								<Input id="periodTo" name="periodTo" type="date" defaultValue={toDateInputValue(billingPeriod?.periodTo)} required />
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" placeholder={t("billing.fields.notesPlaceholder")} defaultValue={billingPeriod?.notes ?? ""} />
						</div>

						{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
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
