"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";

import { saveAgendaItemAction } from "@/app/(app)/weg/versammlungen/actions";
import type { OwnerMeetingAgendaItem } from "@/data/types";

export function AgendaItemFormDialog({ hoaId, meetingId, agendaItem, nextPosition }: { hoaId: string; meetingId: string; agendaItem?: OwnerMeetingAgendaItem; nextPosition: number }) {
	const isEdit = Boolean(agendaItem);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveAgendaItemAction, initialActionState);

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
						Tagesordnungspunkt
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Tagesordnungspunkt bearbeiten" : "Neuer Tagesordnungspunkt"}</DialogTitle>
					</DialogHeader>

					<input type="hidden" name="hoaId" value={hoaId} />
					<input type="hidden" name="meetingId" value={meetingId} />
					{isEdit ? <input type="hidden" name="id" value={agendaItem!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-3 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="position">Nr. *</Label>
								<Input id="position" name="position" type="number" min="1" defaultValue={agendaItem?.position ?? nextPosition} required />
							</div>
							<div className="col-span-2 grid gap-2">
								<Label htmlFor="title">Titel *</Label>
								<Input id="title" name="title" defaultValue={agendaItem?.title} required />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="description">Beschreibung</Label>
							<Textarea id="description" name="description" defaultValue={agendaItem?.description ?? ""} />
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
