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
import { getT } from "@/lib/i18n/server";

import { deleteMailboxMessageAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function PostfachPage() {
	const t = await getT();
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
				.map((ticket) => ({ id: ticket.id, title: ticket.title, propertyName: ticket.property?.name ?? null }))
		: [];

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title={t("tickets.mailbox.title")}
				description={t("tickets.mailbox.description")}
				actions={configured ? <MailboxSyncButton /> : null}
			/>

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				{!configured ? (
					<Card>
						<CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
							<Inbox className="size-8" />
							<p>{t("tickets.mailbox.notConfigured")}</p>
							<p className="text-xs">
								{t("tickets.mailbox.notConfiguredHint1")}{" "}
								<Link href="/einstellungen" className="text-primary hover:underline">
									{t("tickets.mailbox.notConfiguredSettingsLink")}
								</Link>{" "}
								{t("tickets.mailbox.notConfiguredHint2")}
							</p>
						</CardContent>
					</Card>
				) : (
					<>
						<p className="text-xs text-muted-foreground">
							{t("tickets.mailbox.folder", { name: mailbox ?? "INBOX" })}
							{syncState?.lastSyncAt
								? ` · ${t("tickets.mailbox.lastFetch")}: ${formatDateTime(syncState.lastSyncAt)}`
								: ` · ${t("tickets.mailbox.neverFetched")}`}
							{syncState?.lastError ? <span className="text-destructive">{` · ${t("tickets.mailbox.lastError")}: ${syncState.lastError}`}</span> : null}
						</p>

						{messages.length === 0 ? (
							<Card>
								<CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
									<Inbox className="size-8" />
									<p>{t("tickets.mailbox.empty")}</p>
								</CardContent>
							</Card>
						) : (
							<div className="flex flex-col gap-3">
								{messages.map((message) => (
									<Card key={message.id}>
										<CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
											<div className="min-w-0">
												<CardTitle className="text-sm font-medium leading-snug">{message.subject ?? t("tickets.email.noSubject")}</CardTitle>
												<p className="mt-1 truncate text-xs text-muted-foreground">
													{t("common.from")}: {message.fromAddress ?? "–"} · {formatDateTime(message.createdAt)}
												</p>
											</div>
											<ConfirmDeleteButton
												action={deleteMailboxMessageAction.bind(null, message.id)}
												confirmMessage={t("tickets.mailbox.confirm.delete", { subject: message.subject ?? t("tickets.email.noSubject") })}
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
