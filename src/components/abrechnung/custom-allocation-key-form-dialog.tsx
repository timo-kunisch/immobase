"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { saveCustomAllocationKeyAction } from "@/app/(app)/abrechnung/actions";
import type { CustomAllocationKey } from "@/data/types";

export function CustomAllocationKeyFormDialog({ propertyId, customAllocationKey }: { propertyId: string; customAllocationKey?: CustomAllocationKey }) {
	const { t } = useI18n();
	const isEdit = Boolean(customAllocationKey);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveCustomAllocationKeyAction, initialActionState);

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
					<Button type="button" size="sm" variant="outline">
						<Plus />
						{t("billing.allocationKeys.actions.create")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("billing.allocationKeys.dialog.editTitle") : t("billing.allocationKeys.dialog.createTitle")}</DialogTitle>
						<DialogDescription>{t("billing.allocationKeys.dialog.description")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="propertyId" value={propertyId} />
					{isEdit ? <input type="hidden" name="id" value={customAllocationKey!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="label">{t("billing.fields.label")} *</Label>
							<Input id="label" name="label" placeholder={t("billing.allocationKeys.placeholder.label")} defaultValue={customAllocationKey?.label} required />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" defaultValue={customAllocationKey?.notes ?? ""} />
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
