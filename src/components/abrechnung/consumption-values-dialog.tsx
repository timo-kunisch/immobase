"use client";

import { useActionState, useEffect, useState } from "react";
import { Gauge, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";

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
				<Button variant="ghost" size="icon-sm" aria-label="Verbrauchswerte erfassen" title="Verbrauchswerte erfassen">
					<Gauge className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>Verbrauchswerte: {costItemLabel}</DialogTitle>
						<DialogDescription>Verbrauch je Einheit für den Abrechnungszeitraum (z. B. m³ Wasser oder Verbrauchseinheiten Heizung).</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="costItemId" value={costItemId} />

					<div className="grid gap-4 py-4">
						{units.length === 0 ? (
							<p className="text-sm text-muted-foreground">Diese Liegenschaft hat noch keine Einheiten.</p>
						) : (
							units.map((unit) => (
								<div key={unit.id} className="grid gap-2">
									<Label htmlFor={`value-${unit.id}`}>{unit.label}</Label>
									<Input id={`value-${unit.id}`} name={`value-${unit.id}`} type="number" step="0.001" min="0" defaultValue={valueByUnit.get(unit.id) ?? ""} />
								</div>
							))
						)}

						{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							Abbrechen
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							Speichern
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
