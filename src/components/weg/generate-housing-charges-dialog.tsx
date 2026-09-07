"use client";

import { useActionState, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";

import { generateHousingChargesAction } from "@/app/(app)/weg/wirtschaftsplan/actions";

export function GenerateHousingChargesDialog({ economicPlanId, hoaId }: { economicPlanId: string; hoaId: string }) {
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(generateHousingChargesAction, initialActionState);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button type="button" variant="outline">
					<CalendarClock />
					Hausgeld fällig stellen
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				{state.success ? (
					<>
						<DialogHeader>
							<DialogTitle>Fällig gestellt</DialogTitle>
							<DialogDescription>{state.message}</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button type="button" onClick={() => setOpen(false)}>
								Schließen
							</Button>
						</DialogFooter>
					</>
				) : (
					<form action={formAction}>
						<DialogHeader>
							<DialogTitle>Hausgeld für dieses Geschäftsjahr fällig stellen</DialogTitle>
							<DialogDescription>
								Legt für jede Einheit und jeden Monat des Geschäftsjahres eine Hausgeld-Sollstellung anhand des Einzelwirtschaftsplans an. Der Eigentümer wird je Monat aus den
								erfassten Eigentumsverhältnissen ermittelt (unterjähriger Wechsel wird berücksichtigt). Bereits vorhandene Sollstellungen werden nicht doppelt angelegt.
							</DialogDescription>
						</DialogHeader>

						<input type="hidden" name="economicPlanId" value={economicPlanId} />
						<input type="hidden" name="hoaId" value={hoaId} />

						<div className="grid gap-4 py-4">
							<div className="grid gap-2">
								<Label htmlFor="dueDay">Fällig jeweils am (Tag des Monats) *</Label>
								<Input id="dueDay" name="dueDay" type="number" min="1" max="28" defaultValue="3" required />
								<p className="text-xs text-muted-foreground">Tag zwischen 1 und 28, um für jeden Monat ein gültiges Datum zu garantieren.</p>
							</div>
							{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
						</div>

						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setOpen(false)}>
								Abbrechen
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending ? <Loader2 className="animate-spin" /> : null}
								Fällig stellen
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
