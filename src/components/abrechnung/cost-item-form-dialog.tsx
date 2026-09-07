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
import { allocationKeyLabels, costCategoryLabels } from "@/lib/billing";

import { saveCostItemAction } from "@/app/(app)/abrechnung/actions";
import type { AllocationKey, CostItem, Unit } from "@/data/types";

export function CostItemFormDialog({ billingPeriodId, costItem, units }: { billingPeriodId: string; costItem?: CostItem; units: Unit[] }) {
	const isEdit = Boolean(costItem);
	const [open, setOpen] = useState(false);
	const [allocationKey, setAllocationKey] = useState<AllocationKey>(costItem?.allocationKey ?? "LIVING_SPACE");
	const [state, formAction, isPending] = useActionState(saveCostItemAction, initialActionState);

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
					<Button type="button" variant="outline" size="sm">
						<Plus />
						Kostenposition
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Kostenposition bearbeiten" : "Neue Kostenposition"}</DialogTitle>
						<DialogDescription>Kostenart nach § 2 BetrKV inkl. Umlageschlüssel.</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="billingPeriodId" value={billingPeriodId} />
					{isEdit ? <input type="hidden" name="id" value={costItem!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="label">Bezeichnung *</Label>
							<Input id="label" name="label" placeholder="z. B. Gebäudeversicherung" defaultValue={costItem?.label} required />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="category">Kostenart (§ 2 BetrKV) *</Label>
							<Select name="category" defaultValue={costItem?.category ?? "OTHER"} required>
								<SelectTrigger id="category" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(costCategoryLabels).map(([value, label]) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="amount">Gesamtbetrag (€) *</Label>
								<Input id="amount" name="amount" type="number" step="0.01" min="0" defaultValue={costItem?.amount} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="allocationKey">Umlageschlüssel *</Label>
								<Select name="allocationKey" value={allocationKey} onValueChange={(value) => setAllocationKey(value as AllocationKey)} required>
									<SelectTrigger id="allocationKey" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(allocationKeyLabels).map(([value, label]) => (
											<SelectItem key={value} value={value}>
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						{allocationKey === "DIRECT" ? (
							<div className="grid gap-2">
								<Label htmlFor="directUnitId">Einheit (direkte Zuordnung) *</Label>
								<Select name="directUnitId" defaultValue={costItem?.directUnitId ?? units[0]?.id} required>
									<SelectTrigger id="directUnitId" className="w-full">
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
						) : null}

						{allocationKey === "CONSUMPTION" ? (
							<p className="text-xs text-muted-foreground">Die Verbrauchswerte je Einheit können nach dem Speichern über die Tabellenzeile dieser Kostenposition erfasst werden.</p>
						) : null}

						<div className="grid gap-2">
							<Label htmlFor="notes">Notizen</Label>
							<Textarea id="notes" name="notes" defaultValue={costItem?.notes ?? ""} />
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
