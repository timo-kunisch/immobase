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
import { ownerMeetingStatusLabels, ownerMeetingTypeLabels } from "@/lib/hoa-meetings";

import { saveOwnerMeetingAction } from "@/app/(app)/weg/versammlungen/actions";
import type { OwnerMeeting } from "@/data/types";

function toDateTimeInputValue(value: string | null | undefined): string {
	if (!value) return "";
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return "";
	const offset = date.getTimezoneOffset();
	const local = new Date(date.getTime() - offset * 60000);
	return local.toISOString().slice(0, 16);
}

export function OwnerMeetingFormDialog({ hoaId, meeting }: { hoaId: string; meeting?: OwnerMeeting }) {
	const isEdit = Boolean(meeting);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveOwnerMeetingAction, initialActionState);

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
						Neue Versammlung
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Versammlung bearbeiten" : "Neue Eigentümerversammlung"}</DialogTitle>
						<DialogDescription>Ordentliche/außerordentliche Versammlung oder Umlaufbeschluss-Verfahren.</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="hoaId" value={hoaId} />
					{isEdit ? <input type="hidden" name="id" value={meeting!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="title">Titel *</Label>
							<Input id="title" name="title" placeholder="z. B. Eigentümerversammlung 2026" defaultValue={meeting?.title} required />
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="type">Art</Label>
								<Select name="type" defaultValue={meeting?.type ?? "ORDINARY"}>
									<SelectTrigger id="type" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(ownerMeetingTypeLabels).map(([value, label]) => (
											<SelectItem key={value} value={value}>
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="status">Status</Label>
								<Select name="status" defaultValue={meeting?.status ?? "PLANNED"}>
									<SelectTrigger id="status" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(ownerMeetingStatusLabels).map(([value, label]) => (
											<SelectItem key={value} value={value}>
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="meetingDate">Termin</Label>
								<Input id="meetingDate" name="meetingDate" type="datetime-local" defaultValue={toDateTimeInputValue(meeting?.meetingDate)} />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="location">Ort</Label>
								<Input id="location" name="location" placeholder="z. B. Gemeinschaftsraum" defaultValue={meeting?.location ?? ""} />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">Notizen</Label>
							<Textarea id="notes" name="notes" defaultValue={meeting?.notes ?? ""} />
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
