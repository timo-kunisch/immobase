"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";

import { saveCustomAllocationKeyAction } from "@/app/(app)/weg/verteilerschluessel/actions";
import type { HoaCustomAllocationKey as CustomAllocationKey } from "@/data/types";

export function CustomAllocationKeyFormDialog({ hoaId, customAllocationKey }: { hoaId: string; customAllocationKey?: CustomAllocationKey }) {
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
					<Button variant="ghost" size="icon-sm" aria-label="Bearbeiten" title="Bearbeiten">
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button" size="sm" variant="outline">
						<Plus />
						Neuer Verteilerschlüssel
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Verteilerschlüssel bearbeiten" : "Neuer frei definierter Verteilerschlüssel"}</DialogTitle>
						<DialogDescription>Die Gewichte je Einheit werden nach dem Speichern erfasst.</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="hoaId" value={hoaId} />
					{isEdit ? <input type="hidden" name="id" value={customAllocationKey!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="label">Bezeichnung *</Label>
							<Input id="label" name="label" placeholder="z. B. Anzahl Stellplätze" defaultValue={customAllocationKey?.label} required />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">Notizen</Label>
							<Textarea id="notes" name="notes" defaultValue={customAllocationKey?.notes ?? ""} />
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
