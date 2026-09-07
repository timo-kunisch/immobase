"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";

import { saveTenantAction } from "@/app/(app)/mieter/actions";
import type { Tenant } from "@/data/types";

export function TenantFormDialog({ tenant }: { tenant?: Tenant }) {
	const isEdit = Boolean(tenant);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveTenantAction, initialActionState);

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
						Neuer Mieter
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Mieter bearbeiten" : "Neuer Mieter"}</DialogTitle>
						<DialogDescription>Stammdaten des Mieters für die Vertragsverwaltung.</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={tenant!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="firstName">Vorname *</Label>
								<Input id="firstName" name="firstName" defaultValue={tenant?.firstName} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="lastName">Nachname *</Label>
								<Input id="lastName" name="lastName" defaultValue={tenant?.lastName} required />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="email">E-Mail</Label>
							<Input id="email" name="email" type="email" defaultValue={tenant?.email ?? ""} />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="phone">Telefon</Label>
							<Input id="phone" name="phone" defaultValue={tenant?.phone ?? ""} />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">Notizen</Label>
							<Textarea id="notes" name="notes" defaultValue={tenant?.notes ?? ""} />
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
