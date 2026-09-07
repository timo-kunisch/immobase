"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";

import { savePropertyAction } from "@/app/(app)/liegenschaften/actions";
import type { Property } from "@/data/types";

export function PropertyFormDialog({ property }: { property?: Property }) {
	const isEdit = Boolean(property);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(savePropertyAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	return (
		<Dialog
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
			}}
		>
			<DialogTrigger asChild>
				{isEdit ? (
					<Button variant="ghost" size="icon-sm" aria-label="Bearbeiten" title="Bearbeiten">
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button">
						<Plus />
						Neue Liegenschaft
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Liegenschaft bearbeiten" : "Neue Liegenschaft"}</DialogTitle>
						<DialogDescription>Erfassen Sie die Stammdaten der Liegenschaft (Gebäude/Objekt).</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={property!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="name">Bezeichnung *</Label>
							<Input id="name" name="name" placeholder="z. B. Musterstraße 12" defaultValue={property?.name} required />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="street">Straße & Hausnummer *</Label>
							<Input id="street" name="street" placeholder="Musterstraße 12" defaultValue={property?.street} required />
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="zipCode">PLZ *</Label>
								<Input id="zipCode" name="zipCode" placeholder="12345" defaultValue={property?.zipCode} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="city">Stadt *</Label>
								<Input id="city" name="city" placeholder="Musterstadt" defaultValue={property?.city} required />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="country">Land</Label>
							<Input id="country" name="country" defaultValue={property?.country ?? "Deutschland"} />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">Notizen</Label>
							<Textarea id="notes" name="notes" placeholder="Optionale interne Anmerkungen" defaultValue={property?.notes ?? ""} />
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
