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

import { saveBillingPeriodAction } from "@/app/(app)/abrechnung/actions";
import type { BillingPeriod, Property } from "@/data/types";

export function BillingPeriodFormDialog({ billingPeriod, properties }: { billingPeriod?: BillingPeriod; properties: Property[] }) {
	const isEdit = Boolean(billingPeriod);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveBillingPeriodAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	const disabled = !isEdit && properties.length === 0;

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
						Neue Abrechnungsperiode
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Abrechnungsperiode bearbeiten" : "Neue Abrechnungsperiode"}</DialogTitle>
						<DialogDescription>Zeitraum (i. d. R. ein Kalenderjahr) für die Nebenkostenabrechnung einer Liegenschaft.</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={billingPeriod!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="propertyId">Liegenschaft *</Label>
							<Select name="propertyId" defaultValue={billingPeriod?.propertyId ?? properties[0]?.id} required>
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

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="periodFrom">Zeitraum von *</Label>
								<Input id="periodFrom" name="periodFrom" type="date" defaultValue={toDateInputValue(billingPeriod?.periodFrom)} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="periodTo">Zeitraum bis *</Label>
								<Input id="periodTo" name="periodTo" type="date" defaultValue={toDateInputValue(billingPeriod?.periodTo)} required />
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="notes">Notizen</Label>
							<Textarea id="notes" name="notes" placeholder="Optionale interne Anmerkungen" defaultValue={billingPeriod?.notes ?? ""} />
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
