"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { toDateInputValue } from "@/lib/format";

import { saveUnitOwnershipAction } from "@/app/(app)/weg/eigentumsverhaeltnisse/actions";
import type { Owner, Unit, UnitOwnership } from "@/data/types";

/**
 * Formular zum Erfassen eines Eigentumsverhältnisses - dient sowohl dem
 * Erst-Eintrag (Einheit erhält erstmals einen Eigentümer) als auch dem
 * Erfassen eines Eigentümerwechsels (neue Zeile mit späterem startDate,
 * die vorherige laufende Zeile wird serverseitig automatisch beendet,
 * siehe saveUnitOwnershipAction). Beim Bearbeiten (isEdit) wird
 * ausschließlich die bestehende Zeile aktualisiert, kein automatisches
 * Beenden einer anderen Zeile.
 */
export function UnitOwnershipFormDialog({ units, owners, ownership, defaultUnitId }: { units: Unit[]; owners: Owner[]; ownership?: UnitOwnership; defaultUnitId?: string }) {
	const isEdit = Boolean(ownership);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveUnitOwnershipAction, initialActionState);

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
					<Button type="button" size="sm" variant="outline" disabled={units.length === 0 || owners.length === 0}>
						<Plus />
						Eigentumsverhältnis
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Eigentumsverhältnis bearbeiten" : "Eigentumsverhältnis erfassen"}</DialogTitle>
						<DialogDescription>
							{isEdit
								? "Änderungen an einer bestehenden Zeile."
								: "Bei einem Eigentümerwechsel wird das bisher laufende Eigentumsverhältnis dieser Einheit automatisch zum Vortag beendet."}
						</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={ownership!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="unitId">Einheit *</Label>
							<Select name="unitId" defaultValue={ownership?.unitId ?? defaultUnitId ?? units[0]?.id} required>
								<SelectTrigger id="unitId" className="w-full">
									<SelectValue placeholder="Einheit auswählen" />
								</SelectTrigger>
								<SelectContent>
									{units.map((unit) => (
										<SelectItem key={unit.id} value={unit.id}>
											{unit.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="ownerId">Eigentümer *</Label>
							<Select name="ownerId" defaultValue={ownership?.ownerId} required>
								<SelectTrigger id="ownerId" className="w-full">
									<SelectValue placeholder="Eigentümer auswählen" />
								</SelectTrigger>
								<SelectContent>
									{owners.map((owner) => (
										<SelectItem key={owner.id} value={owner.id}>
											{owner.firstName} {owner.lastName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="coOwnerId">Miteigentümer (z. B. Ehepartner)</Label>
							<Select name="coOwnerId" defaultValue={ownership?.coOwnerId ?? "none"}>
								<SelectTrigger id="coOwnerId" className="w-full">
									<SelectValue placeholder="Kein Miteigentümer" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">Kein Miteigentümer</SelectItem>
									{owners.map((owner) => (
										<SelectItem key={owner.id} value={owner.id}>
											{owner.firstName} {owner.lastName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="startDate">{isEdit ? "Beginn *" : "Beginn (Eigentumsübergang) *"}</Label>
							<Input id="startDate" name="startDate" type="date" defaultValue={toDateInputValue(ownership?.startDate)} required />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">Notizen</Label>
							<Textarea id="notes" name="notes" placeholder="z. B. Notar, Kaufvertragsdatum" defaultValue={ownership?.notes ?? ""} />
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
