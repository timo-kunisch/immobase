"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Scale } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";

import { saveCustomAllocationWeightsAction } from "@/app/(app)/weg/verteilerschluessel/actions";
import type { HoaCustomAllocationKeyWeight as Weight, Unit } from "@/data/types";

export function CustomAllocationWeightsDialog({
	hoaId,
	customAllocationKeyId,
	customAllocationKeyLabel,
	units,
	weights,
}: {
	hoaId: string;
	customAllocationKeyId: string;
	customAllocationKeyLabel: string;
	units: Unit[];
	weights: Weight[];
}) {
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveCustomAllocationWeightsAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	const weightByUnit = new Map(weights.map((w) => [w.unitId, w.weight]));

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label="Gewichte je Einheit erfassen" title="Gewichte je Einheit erfassen">
					<Scale className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>Gewichte: {customAllocationKeyLabel}</DialogTitle>
						<DialogDescription>Frei vergebbares Gewicht je Einheit für diesen Verteilerschlüssel.</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="hoaId" value={hoaId} />
					<input type="hidden" name="customAllocationKeyId" value={customAllocationKeyId} />

					<div className="grid gap-4 py-4">
						{units.length === 0 ? (
							<p className="text-sm text-muted-foreground">Diese Liegenschaft hat noch keine Einheiten.</p>
						) : (
							units.map((unit) => (
								<div key={unit.id} className="grid gap-2">
									<Label htmlFor={`weight-${unit.id}`}>{unit.label}</Label>
									<Input id={`weight-${unit.id}`} name={`weight-${unit.id}`} type="number" step="0.01" min="0" defaultValue={weightByUnit.get(unit.id) ?? ""} />
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
