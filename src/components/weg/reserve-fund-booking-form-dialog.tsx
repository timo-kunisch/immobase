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
import { reserveFundBookingTypeLabels } from "@/lib/hoa-reserve";

import { saveReserveFundBookingAction } from "@/app/(app)/weg/ruecklage/actions";
import type { ReserveFundBooking, ReserveFundBookingType } from "@/data/types";

export function ReserveFundBookingFormDialog({ hoaId, booking }: { hoaId: string; booking?: ReserveFundBooking }) {
	const isEdit = Boolean(booking);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveReserveFundBookingAction, initialActionState);

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
						Neue Buchung
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Rücklagenbuchung bearbeiten" : "Neue Rücklagenbuchung"}</DialogTitle>
						<DialogDescription>Zuführung oder Entnahme der Erhaltungsrücklage.</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="hoaId" value={hoaId} />
					{isEdit ? <input type="hidden" name="id" value={booking!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="type">Buchungsart *</Label>
							<Select name="type" defaultValue={booking?.type ?? ("CONTRIBUTION" satisfies ReserveFundBookingType)} required>
								<SelectTrigger id="type" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(reserveFundBookingTypeLabels).map(([value, label]) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="bookingDate">Datum *</Label>
								<Input id="bookingDate" name="bookingDate" type="date" defaultValue={toDateInputValue(booking?.bookingDate)} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="amount">Betrag (€) *</Label>
								<Input id="amount" name="amount" type="number" step="0.01" min="0.01" defaultValue={booking?.amount} required />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="description">Bezeichnung *</Label>
							<Input id="description" name="description" placeholder="z. B. Dachreparatur" defaultValue={booking?.description} required />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">Notizen</Label>
							<Textarea id="notes" name="notes" defaultValue={booking?.notes ?? ""} />
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
