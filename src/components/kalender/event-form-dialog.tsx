"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";
import { showError } from "@/lib/toast";
import { cn } from "@/lib/utils";

import { deleteCalendarEventAction, saveCalendarEventAction } from "@/app/(app)/kalender/actions";
import type { CalendarEvent } from "@/data/types";

/**
 * Dialog zum Anlegen/Bearbeiten eines manuellen Kalender-Ereignisses.
 * Ohne `event`-Prop: "Neues Ereignis"-Button (Seitenkopf). Mit `event`:
 * der Trigger ist das Ereignis-Chip im Tagesraster (`label` = Anzeige-
 * Text des Chips inkl. Uhrzeit-Präfix aus der Kalender-Aggregation);
 * im Bearbeiten-Dialog steht zusätzlich ein Löschen-Button bereit.
 * Uhrzeiten sind optional (null/leer = ganztägig).
 */
export function EventFormDialog({ event, defaultDate, label, className }: { event?: CalendarEvent; defaultDate?: string; label?: string; className?: string }) {
	const { t } = useI18n();
	const isEdit = Boolean(event);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveCalendarEventAction, initialActionState);
	const [isDeleting, startDelete] = useTransition();

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	function handleDelete() {
		if (!event) return;
		if (typeof window !== "undefined" && !window.confirm(t("calendar.confirm.delete", { title: event.title }))) {
			return;
		}
		startDelete(async () => {
			const result = await deleteCalendarEventAction(event.id);
			if (result?.error) {
				showError(result.error);
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
						title={event!.description ? `${label ?? event!.title}\n${event!.description}` : label ?? event!.title}
						className={cn(
							"block w-full truncate rounded px-1.5 py-0.5 text-left text-xs font-medium bg-primary/15 text-primary hover:bg-primary/25",
							className
						)}
					>
						{label ?? event!.title}
					</button>
				) : (
					<Button type="button">
						<Plus />
						{t("calendar.actions.new")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("calendar.dialog.editTitle") : t("calendar.dialog.newTitle")}</DialogTitle>
						<DialogDescription>{t("calendar.dialog.description")}</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={event!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="title">{t("calendar.fields.title")}</Label>
							<Input id="title" name="title" placeholder={t("calendar.fields.titlePlaceholder")} defaultValue={event?.title} required />
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="startDate">{t("calendar.fields.startDate")}</Label>
								<Input id="startDate" name="startDate" type="date" defaultValue={event?.startDate ?? defaultDate} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="startTime">{t("calendar.fields.startTime")}</Label>
								<Input id="startTime" name="startTime" type="time" defaultValue={event?.startTime ?? ""} />
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="endDate">{t("calendar.fields.endDate")}</Label>
								<Input id="endDate" name="endDate" type="date" defaultValue={event?.endDate ?? ""} />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="endTime">{t("calendar.fields.endTime")}</Label>
								<Input id="endTime" name="endTime" type="time" defaultValue={event?.endTime ?? ""} />
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="description">{t("common.description")}</Label>
							<Textarea
								id="description"
								name="description"
								placeholder={t("calendar.fields.descriptionPlaceholder")}
								defaultValue={event?.description ?? ""}
							/>
						</div>

						<ActionErrorToast state={state} />
					</div>

					<DialogFooter className="sm:justify-between">
						{isEdit ? (
							<Button type="button" variant="destructive" onClick={handleDelete} disabled={isDeleting || isPending}>
								{isDeleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
								{t("common.delete")}
							</Button>
						) : null}
						<div className="flex justify-end gap-2">
							<Button type="button" variant="outline" onClick={() => setOpen(false)}>
								{t("common.cancel")}
							</Button>
							<Button type="submit" disabled={isPending || isDeleting}>
								{isPending ? <Loader2 className="animate-spin" /> : null}
								{t("common.save")}
							</Button>
						</div>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
