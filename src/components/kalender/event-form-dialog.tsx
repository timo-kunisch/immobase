"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

import { deleteCalendarEventAction, saveCalendarEventAction } from "@/app/(app)/kalender/actions";
import type { CalendarEvent } from "@/data/types";

/**
 * Dialog zum Anlegen/Bearbeiten eines manuellen Kalender-Ereignisses.
 * Ohne `event`-Prop: "Neues Ereignis"-Button (Seitenkopf). Mit `event`:
 * der Trigger ist das Ereignis-Chip im Tagesraster; im Bearbeiten-Dialog
 * steht zusätzlich ein Löschen-Button bereit.
 */
export function EventFormDialog({ event, defaultDate, className }: { event?: CalendarEvent; defaultDate?: string; className?: string }) {
	const isEdit = Boolean(event);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveCalendarEventAction, initialActionState);
	const [isDeleting, startDelete] = useTransition();
	const [deleteError, setDeleteError] = useState<string | null>(null);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	function handleDelete() {
		if (!event) return;
		if (typeof window !== "undefined" && !window.confirm(`Ereignis "${event.title}" wirklich löschen?`)) {
			return;
		}
		setDeleteError(null);
		startDelete(async () => {
			const result = await deleteCalendarEventAction(event.id);
			if (result?.error) {
				setDeleteError(result.error);
			} else {
				setOpen(false);
			}
		});
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{isEdit ? (
					<button
						type="button"
						title={event!.description ? `${event!.title}\n${event!.description}` : event!.title}
						className={cn(
							"block w-full truncate rounded px-1.5 py-0.5 text-left text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25",
							className
						)}
					>
						{event!.title}
					</button>
				) : (
					<Button type="button">
						<Plus />
						Neues Ereignis
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Ereignis bearbeiten" : "Neues Ereignis"}</DialogTitle>
						<DialogDescription>Manuellen Termin im Kalender eintragen (z. B. Wartung, Abnahme, Behördentermin).</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={event!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="title">Titel *</Label>
							<Input id="title" name="title" placeholder="z. B. Heizungswartung" defaultValue={event?.title} required />
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="startDate">Datum *</Label>
								<Input id="startDate" name="startDate" type="date" defaultValue={event?.startDate ?? defaultDate} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="endDate">Enddatum (optional)</Label>
								<Input id="endDate" name="endDate" type="date" defaultValue={event?.endDate ?? ""} />
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="description">Beschreibung</Label>
							<Textarea id="description" name="description" placeholder="Details zum Termin…" defaultValue={event?.description ?? ""} />
						</div>

						{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
						{deleteError ? <p className="text-sm text-destructive">{deleteError}</p> : null}
					</div>

					<DialogFooter className="sm:justify-between">
						{isEdit ? (
							<Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting || isPending}>
								{isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
								Löschen
							</Button>
						) : null}
						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" onClick={() => setOpen(false)}>
								Abbrechen
							</Button>
							<Button type="submit" disabled={isPending || isDeleting}>
								{isPending ? <Loader2 className="animate-spin" /> : null}
								Speichern
							</Button>
						</div>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
