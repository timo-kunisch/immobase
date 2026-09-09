"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Paperclip } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";

import { linkMessageToTicketAction } from "@/app/(app)/postfach/actions";
import type { TicketMessage } from "@/data/types";

/** Auswahl-Option für den Anheften-Dialog (flach, serialisierbar). */
export interface LinkableTicket {
	id: string;
	title: string;
	propertyName: string;
}

/** Heftet eine Postfach-E-Mail an ein bestehendes (nicht erledigtes) Ticket. */
export function LinkToTicketDialog({ message, tickets }: { message: TicketMessage; tickets: LinkableTicket[] }) {
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(linkMessageToTicketAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button type="button" variant="outline" size="sm" disabled={tickets.length === 0}>
					<Paperclip className="size-4" />
					An Ticket anheften
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>E-Mail an Ticket anheften</DialogTitle>
						<DialogDescription>Die E-Mail erscheint im Verlauf des ausgewählten Tickets.</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="messageId" value={message.id} />

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="ticketId">Ticket *</Label>
							<Select name="ticketId" required>
								<SelectTrigger id="ticketId" className="w-full">
									<SelectValue placeholder="Ticket auswählen" />
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
							Abbrechen
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							Zuordnen
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
