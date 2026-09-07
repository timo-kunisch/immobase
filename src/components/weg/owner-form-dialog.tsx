"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { initialActionState } from "@/lib/action-state";

import { saveOwnerAction } from "@/app/(app)/weg/eigentuemer/actions";
import type { Owner } from "@/data/types";

export function OwnerFormDialog({ owner }: { owner?: Owner }) {
	const isEdit = Boolean(owner);
	const [open, setOpen] = useState(false);
	const [isCompany, setIsCompany] = useState(owner?.isCompany ?? false);
	const [state, formAction, isPending] = useActionState(saveOwnerAction, initialActionState);

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
						Neuer Eigentümer
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Eigentümer bearbeiten" : "Neuer Eigentümer"}</DialogTitle>
						<DialogDescription>Stammdaten des Eigentümers für die WEG-Verwaltung.</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={owner!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="flex items-center gap-2">
							<Switch id="isCompany" name="isCompany" checked={isCompany} onCheckedChange={setIsCompany} />
							<Label htmlFor="isCompany">Institutioneller Eigentümer (z. B. GmbH)</Label>
						</div>

						{isCompany ? (
							<div className="grid gap-2">
								<Label htmlFor="companyName">Firmenname</Label>
								<Input id="companyName" name="companyName" defaultValue={owner?.companyName ?? ""} />
							</div>
						) : null}

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="firstName">{isCompany ? "Ansprechpartner (Vorname) *" : "Vorname *"}</Label>
								<Input id="firstName" name="firstName" defaultValue={owner?.firstName} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="lastName">{isCompany ? "Ansprechpartner (Nachname) *" : "Nachname *"}</Label>
								<Input id="lastName" name="lastName" defaultValue={owner?.lastName} required />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="street">Straße & Hausnummer *</Label>
							<Input id="street" name="street" defaultValue={owner?.street} required />
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="zipCode">PLZ *</Label>
								<Input id="zipCode" name="zipCode" defaultValue={owner?.zipCode} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="city">Stadt *</Label>
								<Input id="city" name="city" defaultValue={owner?.city} required />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="country">Land</Label>
							<Input id="country" name="country" defaultValue={owner?.country ?? "Deutschland"} />
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="email">E-Mail</Label>
								<Input id="email" name="email" type="email" defaultValue={owner?.email ?? ""} />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="phone">Telefon</Label>
								<Input id="phone" name="phone" defaultValue={owner?.phone ?? ""} />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">Notizen</Label>
							<Textarea id="notes" name="notes" defaultValue={owner?.notes ?? ""} />
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
