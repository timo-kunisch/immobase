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

import { saveRentAdjustmentAction } from "@/app/(app)/vertraege/actions";
import type { RentAdjustment } from "@/data/types";

export function RentAdjustmentFormDialog({ leaseId, adjustment, onSaved }: { leaseId: string; adjustment?: RentAdjustment; onSaved?: () => void }) {
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
					<Button variant="ghost" size="icon-sm" aria-label="Änderung bearbeiten" title="Änderung bearbeiten">
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button" variant="outline" size="sm">
						<Plus />
						Änderung hinterlegen
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Änderung bearbeiten" : "Miet-/Nebenkostenänderung"}</DialogTitle>
						<DialogDescription>Ab dem gewählten Datum gilt die neue Kaltmiete/Nebenkosten. Der bisherige Betrag bleibt für den Zeitraum davor erhalten.</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="leaseId" value={leaseId} />
					{isEdit ? <input type="hidden" name="id" value={adjustment!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="validFrom">Gültig ab *</Label>
							<Input id="validFrom" name="validFrom" type="date" defaultValue={toDateInputValue(adjustment?.validFrom)} required />
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="coldRent">Kaltmiete (€) *</Label>
								<Input id="coldRent" name="coldRent" type="number" step="0.01" min="0" defaultValue={adjustment?.coldRent} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="serviceCharges">Nebenkosten (€) *</Label>
								<Input id="serviceCharges" name="serviceCharges" type="number" step="0.01" min="0" defaultValue={adjustment?.serviceCharges} required />
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="notes">Notizen</Label>
							<Textarea id="notes" name="notes" placeholder="z. B. Mieterhöhung nach § 558 BGB" defaultValue={adjustment?.notes ?? ""} />
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
