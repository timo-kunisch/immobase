"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, PencilLine } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { updateTicketNoteAction } from "@/app/(app)/tickets/actions";
import type { TicketMessage } from "@/data/types";

/** Bearbeitet den Text einer internen Notiz im Ticket-Verlauf. */
export function NoteEditDialog({ message }: { message: TicketMessage }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(updateTicketNoteAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					aria-label={t("tickets.actions.editNote")}
					title={t("tickets.actions.editNote")}
				>
					<PencilLine className="size-4 text-muted-foreground" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{t("tickets.note.editTitle")}</DialogTitle>
					</DialogHeader>

					<input type="hidden" name="messageId" value={message.id} />

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor={`note-edit-${message.id}`}>{t("tickets.note.label")}</Label>
							<Textarea
								id={`note-edit-${message.id}`}
								name="body"
								rows={5}
								defaultValue={message.bodyText ?? ""}
								placeholder={t("tickets.note.placeholder")}
								required
							/>
						</div>

						<ActionErrorToast state={state} />
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							{t("common.cancel")}
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							{t("common.save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}