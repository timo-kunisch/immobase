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

import { saveLeaseAction } from "@/app/(app)/vertraege/actions";
import type { Lease, Property, Tenant, Unit } from "@/data/types";

type UnitWithProperty = Unit & { property: Property };

export function LeaseFormDialog({ lease, units, tenants }: { lease?: Lease; units: UnitWithProperty[]; tenants: Tenant[] }) {
	const isEdit = Boolean(lease);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveLeaseAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	const disabled = units.length === 0 || tenants.length === 0;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{isEdit ? (
					<Button variant="ghost" size="icon-sm" aria-label="Bearbeiten" title="Bearbeiten">
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button" disabled={disabled}>
						<Plus />
						Neuer Mietvertrag
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-xl">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Mietvertrag bearbeiten" : "Neuer Mietvertrag"}</DialogTitle>
						<DialogDescription>Verknüpft einen Mieter mit einer Mieteinheit inkl. Konditionen.</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={lease!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="unitId">Mieteinheit *</Label>
								<Select name="unitId" defaultValue={lease?.unitId ?? units[0]?.id} required>
									<SelectTrigger id="unitId" className="w-full">
										<SelectValue placeholder="Einheit auswählen" />
									</SelectTrigger>
									<SelectContent>
										{units.map((unit) => (
											<SelectItem key={unit.id} value={unit.id}>
												{unit.property.name} – {unit.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="tenantId">Mieter *</Label>
								<Select name="tenantId" defaultValue={lease?.tenantId ?? tenants[0]?.id} required>
									<SelectTrigger id="tenantId" className="w-full">
										<SelectValue placeholder="Mieter auswählen" />
									</SelectTrigger>
									<SelectContent>
										{tenants.map((tenant) => (
											<SelectItem key={tenant.id} value={tenant.id}>
												{tenant.firstName} {tenant.lastName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="startDate">Mietbeginn *</Label>
								<Input id="startDate" name="startDate" type="date" defaultValue={toDateInputValue(lease?.startDate)} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="endDate">Mietende</Label>
								<Input id="endDate" name="endDate" type="date" defaultValue={toDateInputValue(lease?.endDate)} />
							</div>
						</div>

						<div className="grid grid-cols-3 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="coldRent">Kaltmiete (€) *</Label>
								<Input id="coldRent" name="coldRent" type="number" step="0.01" min="0" defaultValue={lease?.coldRent} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="serviceCharges">Nebenkosten (€) *</Label>
								<Input id="serviceCharges" name="serviceCharges" type="number" step="0.01" min="0" defaultValue={lease?.serviceCharges} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="deposit">Kaution (€)</Label>
								<Input id="deposit" name="deposit" type="number" step="0.01" min="0" defaultValue={lease?.deposit ?? ""} />
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="numberOfOccupants">Anzahl Personen im Haushalt *</Label>
							<Input id="numberOfOccupants" name="numberOfOccupants" type="number" step="1" min="1" defaultValue={lease?.numberOfOccupants ?? 1} required />
							<p className="text-xs text-muted-foreground">Grundlage für den Umlageschlüssel &quot;Personen&quot; in der Nebenkostenabrechnung.</p>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="notes">Notizen</Label>
							<Textarea id="notes" name="notes" defaultValue={lease?.notes ?? ""} />
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
