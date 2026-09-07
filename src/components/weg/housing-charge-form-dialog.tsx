"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { toDateInputValue } from "@/lib/format";

import { saveHousingChargeAction } from "@/app/(app)/weg/hausgeld/actions";
import type { HousingCharge, Owner, Unit } from "@/data/types";

const statusLabels: Record<string, string> = {
	OPEN: "Fällig",
	PAID: "Bezahlt",
	OVERDUE: "Überfällig",
	CANCELLED: "Storniert",
};

export function HousingChargeFormDialog({ hoaId, units, owners, housingCharge }: { hoaId: string; units: Unit[]; owners: Owner[]; housingCharge?: HousingCharge }) {
	const isEdit = Boolean(housingCharge);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveHousingChargeAction, initialActionState);

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
					<Button type="button" disabled={units.length === 0 || owners.length === 0}>
						<Plus />
						Neue Sollstellung
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Hausgeld bearbeiten" : "Neue Hausgeld-Sollstellung"}</DialogTitle>
						<DialogDescription>Manuelle Erfassung einer Hausgeld-Sollstellung außerhalb des automatischen Fälligstellens aus dem Wirtschaftsplan.</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="hoaId" value={hoaId} />
					{isEdit ? <input type="hidden" name="id" value={housingCharge!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="unitId">Einheit *</Label>
							<Select name="unitId" defaultValue={housingCharge?.unitId ?? units[0]?.id} required>
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
							<Select name="ownerId" defaultValue={housingCharge?.ownerId ?? owners[0]?.id} required>
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
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="amount">Betrag (€) *</Label>
								<Input id="amount" name="amount" type="number" step="0.01" min="0" defaultValue={housingCharge?.amount} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="dueDate">Fällig am *</Label>
								<Input id="dueDate" name="dueDate" type="date" defaultValue={toDateInputValue(housingCharge?.dueDate)} required />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="purpose">Verwendungszweck</Label>
							<Input id="purpose" name="purpose" placeholder="z. B. Hausgeld Januar 2026" defaultValue={housingCharge?.purpose ?? ""} />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="status">Status</Label>
							<Select name="status" defaultValue={housingCharge?.status ?? "OPEN"}>
								<SelectTrigger id="status" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(statusLabels).map(([value, label]) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
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
