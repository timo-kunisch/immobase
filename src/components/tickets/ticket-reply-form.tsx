"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";

import { sendTicketEmailAction } from "@/app/(app)/tickets/actions";

/**
 * E-Mail-Antwort aus dem Ticket heraus versenden (nur gerendert, wenn SMTP
 * konfiguriert ist). Empfänger/Betreff sind aus der letzten eingehenden
 * E-Mail vorbefüllt.
 */
export function TicketReplyForm({ ticketId, defaultTo, defaultSubject }: { ticketId: string; defaultTo: string; defaultSubject: string }) {
	const [state, formAction, isPending] = useActionState(sendTicketEmailAction, initialActionState);
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
				<Label htmlFor="reply-to">E-Mail-Antwort an</Label>
				<Input id="reply-to" name="to" type="text" defaultValue={defaultTo} placeholder="empfaenger@example.com" required />
			</div>
			<div className="grid gap-2">
				<Label htmlFor="reply-subject">Betreff</Label>
				<Input id="reply-subject" name="subject" defaultValue={defaultSubject} required />
			</div>
			<div className="grid gap-2">
				<Label htmlFor="reply-body">Nachricht</Label>
				<Textarea id="reply-body" name="body" rows={5} placeholder="Antworttext…" required />
			</div>
			{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
			{state.success ? <p className="text-sm text-emerald-600">Die E-Mail wurde versendet.</p> : null}
			<div className="flex justify-end">
				<Button type="submit" disabled={isPending}>
					{isPending ? <Loader2 className="animate-spin" /> : <Send />}
					E-Mail senden
				</Button>
			</div>
		</form>
	);
}
