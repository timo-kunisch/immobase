"use client";

import { useActionState, useEffect, useRef } from "react";
import { Loader2, Send } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmailRecipientInput, type EmailContact } from "@/components/tickets/email-recipient-input";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { sendTicketEmailAction } from "@/app/(app)/tickets/actions";

/**
 * E-Mail-Antwort aus dem Ticket heraus versenden (nur gerendert, wenn SMTP
 * konfiguriert ist). Empfänger/Betreff sind aus der letzten eingehenden
 * E-Mail vorbefüllt; das Empfänger-Feld vervollständigt Mieter- und
 * Eigentümer-Adressen aus den Stammdaten.
 */
export function TicketReplyForm({
	ticketId,
	defaultTo,
	defaultSubject,
	contacts,
}: {
	ticketId: string;
	defaultTo: string;
	defaultSubject: string;
	contacts: EmailContact[];
}) {
	const { t } = useI18n();
	const [state, formAction, isPending] = useActionState(sendTicketEmailAction, initialActionState);
	const formRef = useRef<HTMLFormElement>(null);

	useEffect(() => {
		if (state.success) {
			formRef.current?.reset();
		}
	}, [state]);

	return (
		<form ref={formRef} action={formAction} className="grid gap-3">
			<input type="hidden" name="ticketId" value={ticketId} />
			<div className="grid gap-2">
				<Label htmlFor="reply-to">{t("tickets.reply.toLabel")}</Label>
				<EmailRecipientInput id="reply-to" name="to" defaultValue={defaultTo} placeholder={t("tickets.reply.toPlaceholder")} contacts={contacts} required />
			</div>
			<div className="grid gap-2">
				<Label htmlFor="reply-subject">{t("tickets.reply.subjectLabel")}</Label>
				<Input id="reply-subject" name="subject" defaultValue={defaultSubject} required />
			</div>
			<div className="grid gap-2">
				<Label htmlFor="reply-body">{t("tickets.reply.messageLabel")}</Label>
				<Textarea id="reply-body" name="body" rows={5} placeholder={t("tickets.reply.messagePlaceholder")} required />
			</div>
			<ActionErrorToast state={state} />
			{state.success ? <p className="text-sm text-emerald-600">{t("tickets.success.replySent")}</p> : null}
			<div className="flex justify-end">
				<Button type="submit" disabled={isPending}>
					{isPending ? <Loader2 className="animate-spin" /> : <Send />}
					{t("tickets.reply.submit")}
				</Button>
			</div>
		</form>
	);
}
