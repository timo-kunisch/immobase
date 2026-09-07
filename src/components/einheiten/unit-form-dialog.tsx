"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";

import { saveUnitAction } from "@/app/(app)/einheiten/actions";
import type { Property, Unit } from "@/data/types";

export function UnitFormDialog({ unit, properties }: { unit?: Unit; properties: Property[] }) {
	const isEdit = Boolean(unit);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveUnitAction, initialActionState);

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
					<Button type="button" disabled={properties.length === 0}>
						<Plus />
						Neue Einheit
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Einheit bearbeiten" : "Neue Mieteinheit"}</DialogTitle>
						<DialogDescription>Eine Mieteinheit gehört immer zu genau einer Liegenschaft.</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={unit!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="propertyId">Liegenschaft *</Label>
							<Select name="propertyId" defaultValue={unit?.propertyId ?? properties[0]?.id} required>
								<SelectTrigger id="propertyId" className="w-full">
									<SelectValue placeholder="Liegenschaft auswählen" />
								</SelectTrigger>
								<SelectContent>
									{properties.map((property) => (
										<SelectItem key={property.id} value={property.id}>
											{property.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="label">Bezeichnung *</Label>
							<Input id="label" name="label" placeholder="z. B. 1. OG links" defaultValue={unit?.label} required />
						</div>
						<div className="grid grid-cols-3 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="floor">Etage</Label>
								<Input id="floor" name="floor" placeholder="EG, 1. OG…" defaultValue={unit?.floor ?? ""} />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="livingSpace">Wohnfläche (m²)</Label>
								<Input id="livingSpace" name="livingSpace" type="number" step="0.01" min="0" defaultValue={unit?.livingSpace ?? ""} />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="rooms">Zimmer</Label>
								<Input id="rooms" name="rooms" type="number" step="0.5" min="0" defaultValue={unit?.rooms ?? ""} />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="coOwnershipShare">Miteigentumsanteil (MEA)</Label>
							<Input id="coOwnershipShare" name="coOwnershipShare" type="number" step="0.01" min="0" defaultValue={unit?.coOwnershipShare ?? ""} />
							<p className="text-xs text-muted-foreground">Nur relevant, wenn die Liegenschaft unter „WEG“ (/weg) als Wohnungseigentümergemeinschaft verwaltet wird.</p>
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
