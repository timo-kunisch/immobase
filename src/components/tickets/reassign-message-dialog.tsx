"use client";

import { useActionState, useEffect, useState } from "react";
import { Forward, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { reassignTicketMessageAction } from "@/app/(app)/tickets/actions";
import type { TicketMessage } from "@/data/types";

/** Auswahl-Option für den Neu-zuordnen-Dialog (flach, serialisierbar). */
export interface ReassignableTicket {
	id: string;
	title: string;
	propertyName: string;
}

/** Ordnet eine bereits verknüpfte eingehende E-Mail einem anderen Ticket zu. */
export function ReassignMessageDialog({ message, tickets }: { message: TicketMessage; tickets: ReassignableTicket[] }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(reassignTicketMessageAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					disabled={tickets.length === 0}
					aria-label={t("tickets.actions.reassign")}
					title={t("tickets.actions.reassign")}
				>
					<Forward className="size-4 text-muted-foreground" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{t("tickets.dialog.reassignTitle")}</DialogTitle>
						<DialogDescription>
							{t("tickets.dialog.reassignDescription", { subject: message.subject ?? t("tickets.email.noSubject") })}
						</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="messageId" value={message.id} />

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="reassign-ticketId">{t("tickets.fields.ticket")} *</Label>
							<Select name="ticketId" required>
								<SelectTrigger id="reassign-ticketId" className="w-full">
									<SelectValue placeholder={t("tickets.fields.ticketPlaceholder")} />
								</SelectTrigger>
								<SelectContent>
									{tickets.map((ticket) => (
										<SelectItem key={ticket.id} value={ticket.id}>
											{ticket.title} ({ticket.propertyName})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							{t("common.cancel")}
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							{t("tickets.actions.assign")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
