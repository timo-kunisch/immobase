"use client";

import { useActionState, useEffect, useState } from "react";
import { Gauge, Loader2 } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { saveConsumptionValuesAction } from "@/app/(app)/abrechnung/actions";
import type { ConsumptionValue, Unit } from "@/data/types";

export function ConsumptionValuesDialog({
	costItemId,
	costItemLabel,
	units,
	consumptionValues,
}: {
	costItemId: string;
	costItemLabel: string;
	units: Unit[];
	consumptionValues: ConsumptionValue[];
}) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveConsumptionValuesAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	const valueByUnit = new Map(consumptionValues.map((cv) => [cv.unitId, cv.value]));

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label={t("billing.consumption.trigger")} title={t("billing.consumption.trigger")}>
					<Gauge className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{t("billing.consumption.title", { label: costItemLabel })}</DialogTitle>
						<DialogDescription>{t("billing.consumption.description")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="costItemId" value={costItemId} />

					<div className="grid gap-4 py-4">
						{units.length === 0 ? (
							<p className="text-sm text-muted-foreground">{t("billing.consumption.noUnits")}</p>
						) : (
							units.map((unit) => (
								<div key={unit.id} className="grid gap-2">
									<Label htmlFor={`value-${unit.id}`}>{unit.label}</Label>
									<Input id={`value-${unit.id}`} name={`value-${unit.id}`} type="number" step="0.001" min="0" defaultValue={valueByUnit.get(unit.id) ?? ""} />
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
