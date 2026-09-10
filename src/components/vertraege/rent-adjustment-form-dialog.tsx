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
import { toDateInputValue } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { saveRentAdjustmentAction } from "@/app/(app)/vertraege/actions";
import type { RentAdjustment } from "@/data/types";

export function RentAdjustmentFormDialog({ leaseId, adjustment, onSaved }: { leaseId: string; adjustment?: RentAdjustment; onSaved?: () => void }) {
	const { t } = useI18n();
	const isEdit = Boolean(adjustment);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveRentAdjustmentAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
			onSaved?.();
		}
		// onSaved bewusst nicht in den Deps, um bei jedem Render neu ausgelöste
		// Effekte zu vermeiden - reagiert werden soll nur auf state.success.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [state.success]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{isEdit ? (
					<Button variant="ghost" size="icon-sm" aria-label={t("leases.adjustment.editTitle")} title={t("leases.adjustment.editTitle")}>
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button" variant="outline" size="sm">
						<Plus />
						{t("leases.adjustment.add")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("leases.adjustment.editTitle") : t("leases.adjustment.createTitle")}</DialogTitle>
						<DialogDescription>{t("leases.adjustment.description")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="leaseId" value={leaseId} />
					{isEdit ? <input type="hidden" name="id" value={adjustment!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="validFrom">{t("leases.adjustment.fields.validFrom")} *</Label>
							<Input id="validFrom" name="validFrom" type="date" defaultValue={toDateInputValue(adjustment?.validFrom)} required />
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="coldRent">{t("leases.fields.coldRent")} *</Label>
								<Input id="coldRent" name="coldRent" type="number" step="0.01" min="0" defaultValue={adjustment?.coldRent} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="serviceCharges">{t("leases.fields.serviceCharges")} *</Label>
								<Input id="serviceCharges" name="serviceCharges" type="number" step="0.01" min="0" defaultValue={adjustment?.serviceCharges} required />
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" placeholder={t("leases.adjustment.fields.notesPlaceholder")} defaultValue={adjustment?.notes ?? ""} />
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
