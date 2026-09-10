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

import { saveEconomicPlanAction } from "@/app/(app)/weg/wirtschaftsplan/actions";
import type { EconomicPlan } from "@/data/types";

export function EconomicPlanFormDialog({ hoaId, economicPlan }: { hoaId: string; economicPlan?: EconomicPlan }) {
	const { t } = useI18n();
	const isEdit = Boolean(economicPlan);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveEconomicPlanAction, initialActionState);

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
					<Button type="button">
						<Plus />
						{t("hoaPlan.actions.create")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("hoaPlan.dialog.editTitle") : t("hoaPlan.dialog.createTitle")}</DialogTitle>
						<DialogDescription>{t("hoaPlan.dialog.description")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="hoaId" value={hoaId} />
					{isEdit ? <input type="hidden" name="id" value={economicPlan!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="fiscalYearFrom">{t("hoaPlan.fields.fiscalYearFrom")} *</Label>
								<Input id="fiscalYearFrom" name="fiscalYearFrom" type="date" defaultValue={toDateInputValue(economicPlan?.fiscalYearFrom)} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="fiscalYearTo">{t("hoaPlan.fields.fiscalYearTo")} *</Label>
								<Input id="fiscalYearTo" name="fiscalYearTo" type="date" defaultValue={toDateInputValue(economicPlan?.fiscalYearTo)} required />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" defaultValue={economicPlan?.notes ?? ""} />
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
