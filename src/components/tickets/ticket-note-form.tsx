"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, StickyNote } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { addTicketNoteAction } from "@/app/(app)/tickets/actions";

/** Interne Notiz zum Ticket-Verlauf hinzufügen (Basis-Funktion, immer verfügbar). */
export function TicketNoteForm({ ticketId }: { ticketId: string }) {
	const { t } = useI18n();
	const [state, formAction, isPending] = useActionState(addTicketNoteAction, initialActionState);
	const formRef = useRef<HTMLFormElement>(null);

	useEffect(() => {
		if (state.success) {
			formRef.current?.reset();
		}
	}, [state.success]);

	return (
		<form ref={formRef} action={formAction} className="grid gap-3">
			<input type="hidden" name="ticketId" value={ticketId} />
			<div className="grid gap-2">
				<Label htmlFor="note-body">{t("tickets.note.label")}</Label>
				<Textarea id="note-body" name="body" rows={3} placeholder={t("tickets.note.placeholder")} required />
			</div>
			<ActionErrorToast state={state} />
			<div className="flex justify-end">
				<Button type="submit" variant="outline" disabled={isPending}>
					{isPending ? <Loader2 className="animate-spin" /> : <StickyNote />}
					{t("tickets.note.submit")}
				</Button>
			</div>
		</form>
	);
}
