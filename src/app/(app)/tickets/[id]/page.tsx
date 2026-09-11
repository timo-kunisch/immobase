import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Mail, MailPlus, StickyNote } from "lucide-react";

import { listOwners } from "@/data/owners";
import { listProperties } from "@/data/properties";
import { listTenants } from "@/data/tenants";
import { listTicketMessages } from "@/data/ticket-messages";
import { getTicket, listTickets, listUnitsByLabel } from "@/data/tickets";
import type { TicketMessage, TicketStatus } from "@/data/types";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import type { EmailContact } from "@/components/tickets/email-recipient-input";
import { MessageUnlinkButton } from "@/components/tickets/message-unlink-button";
import { ReassignMessageDialog, type ReassignableTicket } from "@/components/tickets/reassign-message-dialog";
import { TicketFormDialog } from "@/components/tickets/ticket-form-dialog";
import { TicketNoteForm } from "@/components/tickets/ticket-note-form";
import { TicketReplyForm } from "@/components/tickets/ticket-reply-form";
import { TicketStatusSelect } from "@/components/tickets/ticket-status-select";
import { isSmtpConfigured } from "@/lib/email/mailer";
import { getT } from "@/lib/i18n/server";
import type { TranslateFn } from "@/lib/i18n/translator";
import { buildTicketSubjectTag } from "@/lib/ticket-ref";
import { formatDate, formatDateTime } from "@/lib/format";

import { deleteTicketAction } from "../actions";

export const dynamic = "force-dynamic";

const statusVariants: Record<TicketStatus, "default" | "secondary" | "outline"> = {
	OPEN: "default",
	IN_PROGRESS: "secondary",
	DONE: "outline",
};

/** Ein Verlauf-Eintrag (eingehende/ausgehende E-Mail oder interne Notiz). */
function TimelineEntry({ message, reassignTickets, t }: { message: TicketMessage; reassignTickets: ReassignableTicket[]; t: TranslateFn }) {
	const isNote = message.direction === "NOTE";
	const isOutbound = message.direction === "OUTBOUND";
	const Icon = isNote ? StickyNote : isOutbound ? MailPlus : Mail;

	return (
		<Card className={isNote ? "border-dashed bg-muted/40" : undefined}>
			<CardHeader className="pb-2">
				<div className="flex flex-wrap items-center justify-between gap-2">
					<div className="flex items-center gap-2 text-sm font-medium">
						<Icon className="size-4 text-muted-foreground" />
						{isNote ? t("tickets.note.label") : isOutbound ? t("tickets.history.outbound") : t("tickets.history.inbound")}
						{isNote ? <Badge variant="secondary">{t("tickets.history.internalBadge")}</Badge> : null}
					</div>
					<div className="flex items-center gap-1">
						{/* Eingehende E-Mails können wieder ins Postfach gelöst oder
						    einem anderen Ticket zugeordnet werden. */}
						{message.direction === "INBOUND" ? (
							<>
								<ReassignMessageDialog message={message} tickets={reassignTickets} />
								<MessageUnlinkButton message={message} />
							</>
						) : null}
						<span className="text-xs text-muted-foreground">{formatDateTime(message.createdAt)}</span>
					</div>
				</div>
				<p className="text-xs text-muted-foreground">
					{isNote
						? (message.authorEmail ?? t("tickets.history.unknownAuthor"))
						: `${t("common.from")}: ${message.fromAddress ?? "–"}${message.toAddresses ? ` · ${t("tickets.email.to")}: ${message.toAddresses}` : ""}`}
					{!isNote && message.subject ? ` · ${message.subject}` : ""}
				</p>
			</CardHeader>
			{message.bodyText ? (
				<CardContent>
					<p className="text-sm whitespace-pre-wrap">{message.bodyText}</p>
				</CardContent>
			) : null}
		</Card>
	);
}

export default async function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const t = await getT();
	const { id } = await params;
	const ticket = getTicket(id);
	if (!ticket) {
		notFound();
	}

	const messages = listTicketMessages(ticket.id);
	const propertyList = listProperties().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
	const unitList = listUnitsByLabel();
	const smtpConfigured = isSmtpConfigured();
	// Andere offene Tickets als Ziel für „Anderem Ticket zuordnen".
	const reassignTickets = listTickets()
		.filter((other) => other.id !== ticket.id && other.status !== "DONE")
		.map((other) => ({ id: other.id, title: other.title, propertyName: other.property?.name ?? null }));

	// Vorbefüllung der Antwort aus der letzten eingehenden E-Mail.
	const lastInbound = [...messages].reverse().find((message) => message.direction === "INBOUND");
	const defaultTo = lastInbound?.fromAddress ?? "";
	const baseSubject = lastInbound?.subject ?? ticket.title;
	const defaultSubject = baseSubject.toLowerCase().startsWith("re:") ? baseSubject : `Re: ${baseSubject}`;

	// Kontakte für die Empfänger-Vervollständigung: Mieter und Eigentümer mit
	// hinterlegter E-Mail-Adresse, dedupliziert (E-Mail) und alphabetisch.
	const contactsByEmail = new Map<string, EmailContact>();
	for (const tenant of listTenants()) {
		if (!tenant.email) {
			continue;
		}
		contactsByEmail.set(tenant.email.toLowerCase(), {
			name: `${tenant.firstName} ${tenant.lastName}`.trim(),
			email: tenant.email,
			kind: "tenant",
		});
	}
	for (const owner of listOwners()) {
		if (!owner.email) {
			continue;
		}
		contactsByEmail.set(owner.email.toLowerCase(), {
			name: (owner.companyName ?? `${owner.firstName} ${owner.lastName}`).trim(),
			email: owner.email,
			kind: "owner",
		});
	}
	const emailContacts = [...contactsByEmail.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title={ticket.title}
				description={t("tickets.detail.description")}
				actions={
					<>
						<TicketFormDialog ticket={ticket} properties={propertyList} units={unitList} />
						<ConfirmDeleteButton action={deleteTicketAction.bind(null, ticket.id)} confirmMessage={t("tickets.confirm.delete", { title: ticket.title })} />
					</>
				}
			/>

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<Link href="/tickets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground hover:underline">
					<ArrowLeft className="size-4" />
					{t("tickets.detail.backToList")}
				</Link>

				<Card>
					<CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
						<div className="flex items-center gap-2">
							<Badge variant={statusVariants[ticket.status]}>{t(`tickets.status.${ticket.status}`)}</Badge>
							<span className="text-xs text-muted-foreground">{t("tickets.detail.createdAt", { date: formatDate(ticket.createdAt) })}</span>
							{ticket.resolvedAt ? <span className="text-xs text-muted-foreground">{t("tickets.detail.resolvedAt", { date: formatDate(ticket.resolvedAt) })}</span> : null}
						</div>
						<div className="w-40">
							<TicketStatusSelect ticketId={ticket.id} status={ticket.status} />
						</div>
					</CardHeader>
				<CardContent className="flex flex-col gap-2">
					<p className="text-sm text-muted-foreground">
						{ticket.property ? (
							<Link href={`/liegenschaften#property-${ticket.property.id}`} className="hover:text-foreground hover:underline">
								{ticket.property.name}
							</Link>
						) : (
							t("tickets.fields.noProperty")
						)}
						{ticket.unit ? (
								<>
									{" · "}
									<Link href={`/einheiten#unit-${ticket.unit.id}`} className="hover:text-foreground hover:underline">
										{ticket.unit.label}
									</Link>
								</>
							) : null}
						</p>
					{ticket.description ? <p className="text-sm whitespace-pre-wrap">{ticket.description}</p> : null}
				</CardContent>
				</Card>

				<div className="flex flex-col gap-3">
					<h2 className="text-sm font-semibold text-muted-foreground">{t("tickets.history.title", { count: messages.length })}</h2>
					{messages.length === 0 ? (
						<div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
							{t("tickets.history.empty")}
						</div>
					) : (
						messages.map((message) => <TimelineEntry key={message.id} message={message} reassignTickets={reassignTickets} t={t} />)
					)}
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="text-sm">{t("tickets.history.addTitle")}</CardTitle>
					</CardHeader>
					<CardContent className="flex flex-col gap-6">
						<TicketNoteForm ticketId={ticket.id} />
						{smtpConfigured ? (
							<div className="border-t pt-4">
								<TicketReplyForm ticketId={ticket.id} defaultTo={defaultTo} defaultSubject={defaultSubject} contacts={emailContacts} />
								<p className="mt-2 text-xs text-muted-foreground">
									{t("tickets.history.subjectTagHint", { tag: buildTicketSubjectTag(ticket.id) })}
								</p>
							</div>
						) : (
							<p className="border-t pt-4 text-xs text-muted-foreground">
								{t("tickets.history.smtpDisabled")}
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
