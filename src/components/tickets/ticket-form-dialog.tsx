"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";

import { saveTicketAction } from "@/app/(app)/tickets/actions";
import type { Property, Ticket, Unit } from "@/data/types";

const statusLabels: Record<string, string> = {
	OPEN: "Offen",
	IN_PROGRESS: "In Bearbeitung",
	DONE: "Erledigt",
};

export function TicketFormDialog({
	ticket,
	properties,
	units,
	defaultPropertyId,
}: {
	ticket?: Ticket;
	properties: Property[];
	units: Unit[];
	defaultPropertyId?: string;
}) {
	const isEdit = Boolean(ticket);
	const [open, setOpen] = useState(false);
	const [propertyId, setPropertyId] = useState(ticket?.propertyId ?? defaultPropertyId ?? properties[0]?.id ?? "");
	const [state, formAction, isPending] = useActionState(saveTicketAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	const filteredUnits = useMemo(() => units.filter((unit) => unit.propertyId === propertyId), [units, propertyId]);

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
						Neues Ticket
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Ticket bearbeiten" : "Neues Ticket"}</DialogTitle>
						<DialogDescription>Schäden oder Instandhaltungsaufgaben einer Liegenschaft bzw. Einheit erfassen.</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={ticket!.id} /> : null}

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
								<Select name="unitId" defaultValue={ticket?.unitId ?? "none"} key={propertyId}>
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
							<Input id="title" name="title" placeholder="z. B. Heizung defekt" defaultValue={ticket?.title} required />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="description">Beschreibung</Label>
							<Textarea id="description" name="description" placeholder="Was ist das Problem?" defaultValue={ticket?.description ?? ""} />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="status">Status</Label>
							<Select name="status" defaultValue={ticket?.status ?? "OPEN"}>
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

						<div className="grid gap-2">
							<Label htmlFor="contractorNotes">Handwerker-Notizen</Label>
							<Textarea id="contractorNotes" name="contractorNotes" placeholder="Rückmeldung, Termine, Ersatzteile…" defaultValue={ticket?.contractorNotes ?? ""} />
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
