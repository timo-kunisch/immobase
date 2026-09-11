"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Scale } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { saveCustomAllocationWeightsAction } from "@/app/(app)/abrechnung/actions";
import type { CustomAllocationKeyWeight as Weight, Unit } from "@/data/types";

export function CustomAllocationWeightsDialog({
	propertyId,
	customAllocationKeyId,
	customAllocationKeyLabel,
	units,
	weights,
}: {
	propertyId: string;
	customAllocationKeyId: string;
	customAllocationKeyLabel: string;
	units: Unit[];
	weights: Weight[];
}) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveCustomAllocationWeightsAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state]);

	const weightByUnit = new Map(weights.map((w) => [w.unitId, w.weight]));

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label={t("billing.allocationKeys.weights.open")} title={t("billing.allocationKeys.weights.open")}>
					<Scale className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{t("billing.allocationKeys.weights.title", { name: customAllocationKeyLabel })}</DialogTitle>
						<DialogDescription>{t("billing.allocationKeys.weights.description")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="propertyId" value={propertyId} />
					<input type="hidden" name="customAllocationKeyId" value={customAllocationKeyId} />

					<div className="grid gap-4 py-4">
						{units.length === 0 ? (
							<p className="text-sm text-muted-foreground">{t("billing.allocationKeys.weights.noUnits")}</p>
						) : (
							units.map((unit) => (
								<div key={unit.id} className="grid gap-2">
									<Label htmlFor={`weight-${unit.id}`}>{unit.label}</Label>
									<Input id={`weight-${unit.id}`} name={`weight-${unit.id}`} type="number" step="0.01" min="0" defaultValue={weightByUnit.get(unit.id) ?? ""} />
								</div>
							))
						)}
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
