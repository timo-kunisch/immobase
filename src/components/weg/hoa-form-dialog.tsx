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

import { saveHoaAction } from "@/app/(app)/weg/actions";
import type { Hoa, Property } from "@/data/types";

/**
 * Bewusst nur Liegenschaften anbieten, die noch keiner WEG zugeordnet sind
 * (1:1-Beziehung, siehe hoas.propertyId in src/db/schema.ts) - beim
 * Bearbeiten wird die aktuelle Liegenschaft der WEG selbst zusätzlich mit
 * angeboten (sonst wäre das Feld beim Bearbeiten leer, falls die
 * Liegenschaft aus der "freien" Liste bereits herausgefiltert wurde).
 */
export function HoaFormDialog({ hoa, availableProperties }: { hoa?: Hoa; availableProperties: Property[] }) {
	const isEdit = Boolean(hoa);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveHoaAction, initialActionState);

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
					<Button type="button" disabled={availableProperties.length === 0}>
						<Plus />
						Neue WEG
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "WEG bearbeiten" : "Neue Wohnungseigentümergemeinschaft"}</DialogTitle>
						<DialogDescription>Eine WEG ist immer genau einer bestehenden Liegenschaft zugeordnet.</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={hoa!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="propertyId">Liegenschaft *</Label>
							<Select name="propertyId" defaultValue={hoa?.propertyId ?? availableProperties[0]?.id} required>
								<SelectTrigger id="propertyId" className="w-full">
									<SelectValue placeholder="Liegenschaft auswählen" />
								</SelectTrigger>
								<SelectContent>
									{availableProperties.map((property) => (
										<SelectItem key={property.id} value={property.id}>
											{property.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="name">Bezeichnung *</Label>
							<Input id="name" name="name" placeholder="z. B. WEG Musterstraße 12" defaultValue={hoa?.name} required />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="totalShares">Gesamtsumme Miteigentumsanteile (MEA) *</Label>
							<Input id="totalShares" name="totalShares" type="number" step="0.01" min="0.01" defaultValue={hoa?.totalShares ?? 1000} required />
							<p className="text-xs text-muted-foreground">Nenner laut Teilungserklärung, üblich sind z. B. 1000 oder 10000. Der Anteil je Einheit wird bei der Einheit selbst gepflegt.</p>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="bankIban">IBAN (Gemeinschaftskonto)</Label>
								<Input id="bankIban" name="bankIban" placeholder="DE..." defaultValue={hoa?.bankIban ?? ""} />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="bankBic">BIC</Label>
								<Input id="bankBic" name="bankBic" defaultValue={hoa?.bankBic ?? ""} />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">Notizen</Label>
							<Textarea id="notes" name="notes" placeholder="Optionale interne Anmerkungen" defaultValue={hoa?.notes ?? ""} />
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
