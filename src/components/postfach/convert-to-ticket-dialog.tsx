"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2, Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";

import { convertMessageToTicketAction } from "@/app/(app)/postfach/actions";
import type { Property, TicketMessage, Unit } from "@/data/types";

/**
 * Wandelt eine Postfach-E-Mail in ein neues Ticket um (Betreff/Inhalt sind
 * als Titel/Beschreibung vorbefüllt).
 */
export function ConvertToTicketDialog({ message, properties, units }: { message: TicketMessage; properties: Property[]; units: Unit[] }) {
	const [open, setOpen] = useState(false);
	const [propertyId, setPropertyId] = useState(properties[0]?.id ?? "");
	const [state, formAction, isPending] = useActionState(convertMessageToTicketAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	const filteredUnits = useMemo(() => units.filter((unit) => unit.propertyId === propertyId), [units, propertyId]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button type="button" variant="outline" size="sm" disabled={properties.length === 0}>
					<Wrench className="size-4" />
					In Ticket umwandeln
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>E-Mail in Ticket umwandeln</DialogTitle>
						<DialogDescription>Die E-Mail wird dem neuen Ticket als erster Verlauf-Eintrag zugeordnet.</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="messageId" value={message.id} />

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="propertyId">Liegenschaft *</Label>
								<Select name="propertyId" value={propertyId} onValueChange={setPropertyId} required>
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
								<Label htmlFor="unitId">Einheit (optional)</Label>
								<Select name="unitId" defaultValue="none" key={propertyId}>
									<SelectTrigger id="unitId" className="w-full">
										<SelectValue placeholder="Keine bestimmte Einheit" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">Keine bestimmte Einheit</SelectItem>
										{filteredUnits.map((unit) => (
											<SelectItem key={unit.id} value={unit.id}>
												{unit.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="title">Titel *</Label>
							<Input id="title" name="title" defaultValue={message.subject ?? ""} required />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="description">Beschreibung</Label>
							<Textarea id="description" name="description" rows={8} defaultValue={message.bodyText ?? ""} />
						</div>

						{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							Abbrechen
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							Ticket anlegen
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
