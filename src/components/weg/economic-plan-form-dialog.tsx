"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";
import { toDateInputValue } from "@/lib/format";

import { saveEconomicPlanAction } from "@/app/(app)/weg/wirtschaftsplan/actions";
import type { EconomicPlan } from "@/data/types";

export function EconomicPlanFormDialog({ hoaId, economicPlan }: { hoaId: string; economicPlan?: EconomicPlan }) {
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
					<Button variant="ghost" size="icon-sm" aria-label="Bearbeiten" title="Bearbeiten">
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button">
						<Plus />
						Neuer Wirtschaftsplan
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Wirtschaftsplan bearbeiten" : "Neuer Wirtschaftsplan"}</DialogTitle>
						<DialogDescription>Geschäftsjahr (üblicherweise ein Kalenderjahr), für das die geplanten Kosten umgelegt werden.</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="hoaId" value={hoaId} />
					{isEdit ? <input type="hidden" name="id" value={economicPlan!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="fiscalYearFrom">Geschäftsjahr von *</Label>
								<Input id="fiscalYearFrom" name="fiscalYearFrom" type="date" defaultValue={toDateInputValue(economicPlan?.fiscalYearFrom)} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="fiscalYearTo">Geschäftsjahr bis *</Label>
								<Input id="fiscalYearTo" name="fiscalYearTo" type="date" defaultValue={toDateInputValue(economicPlan?.fiscalYearTo)} required />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">Notizen</Label>
							<Textarea id="notes" name="notes" defaultValue={economicPlan?.notes ?? ""} />
						</div>
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
