import Link from "next/link";
import { Inbox } from "lucide-react";

import { listProperties } from "@/data/properties";
import { getImapSyncState } from "@/data/imap-sync-state";
import { listMailboxMessages } from "@/data/ticket-messages";
import { listTickets, listUnitsByLabel } from "@/data/tickets";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { ConvertToTicketDialog } from "@/components/postfach/convert-to-ticket-dialog";
import { LinkToTicketDialog } from "@/components/postfach/link-to-ticket-dialog";
import { MailboxSyncButton } from "@/components/postfach/mailbox-sync-button";
import { ViewMessageDialog } from "@/components/postfach/view-message-dialog";
import { getImapConfig, isImapConfigured } from "@/lib/email/imap";
import { formatDateTime } from "@/lib/format";

import { deleteMailboxMessageAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PostfachPage() {
	const configured = isImapConfigured();
	const mailbox = configured ? (getImapConfig()?.mailbox ?? "INBOX") : null;
	const syncState = configured && mailbox ? getImapSyncState(mailbox) : null;

	const messages = configured ? listMailboxMessages() : [];
	const propertyList = configured ? listProperties().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) : [];
	const unitList = configured ? listUnitsByLabel() : [];
	// Nur offene/in Bearbeitung befindliche Tickets zum Anheften anbieten.
	const linkableTickets = configured
		? listTickets()
				.filter((ticket) => ticket.status !== "DONE")
				.map((ticket) => ({ id: ticket.id, title: ticket.title, propertyName: ticket.property.name }))
		: [];

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title="Postfach"
				description="Eingehende E-Mails - in Tickets umwandeln oder an bestehende Tickets anheften."
				actions={configured ? <MailboxSyncButton /> : null}
			/>

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				{!configured ? (
					<Card>
						<CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
							<Inbox className="size-8" />
							<p>Das E-Mail-Postfach ist nicht konfiguriert.</p>
							<p className="text-xs">
								Ein Administrator kann unter{" "}
								<Link href="/einstellungen" className="text-primary hover:underline">
									Einstellungen → Integrationen &amp; KI
								</Link>{" "}
								einen IMAP-Server hinterlegen. Das Ticket-System funktioniert auch ohne Postfach (manuell angelegte Tickets und interne
								Notizen).
							</p>
						</CardContent>
					</Card>
				) : (
					<>
						<p className="text-xs text-muted-foreground">
							Ordner „{mailbox}“
							{syncState?.lastSyncAt ? <> · Letzter Abruf: {formatDateTime(syncState.lastSyncAt)}</> : " · Noch kein Abruf erfolgt"}
							{syncState?.lastError ? <span className="text-destructive"> · Letzter Fehler: {syncState.lastError}</span> : null}
						</p>

						{messages.length === 0 ? (
							<Card>
								<CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
									<Inbox className="size-8" />
									<p>Keine neuen E-Mails im Postfach.</p>
								</CardContent>
							</Card>
						) : (
							<div className="flex flex-col gap-3">
								{messages.map((message) => (
									<Card key={message.id}>
										<CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
											<div className="min-w-0">
												<CardTitle className="text-sm font-medium leading-snug">{message.subject ?? "(ohne Betreff)"}</CardTitle>
												<p className="mt-1 truncate text-xs text-muted-foreground">
													Von: {message.fromAddress ?? "–"} · {formatDateTime(message.createdAt)}
												</p>
											</div>
											<ConfirmDeleteButton
												action={deleteMailboxMessageAction.bind(null, message.id)}
												confirmMessage={`E-Mail "${message.subject ?? "(ohne Betreff)"}" aus dem Postfach löschen? (Die Nachricht auf dem Server bleibt erhalten.)`}
											/>
										</CardHeader>
										<CardContent className="flex flex-col gap-3">
											{message.bodyText ? <p className="text-sm whitespace-pre-wrap text-muted-foreground line-clamp-4">{message.bodyText}</p> : null}
											<div className="flex flex-wrap items-center gap-2">
												<ViewMessageDialog message={message} />
												<ConvertToTicketDialog message={message} properties={propertyList} units={unitList} />
												<LinkToTicketDialog message={message} tickets={linkableTickets} />
											</div>
										</CardContent>
									</Card>
								))}
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
