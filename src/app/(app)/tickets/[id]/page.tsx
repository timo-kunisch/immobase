import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowLeftRight, CirclePlus, FileX, Forward, Mail, MailCheck, MailPlus, MailX, Pencil, PenLine, StickyNote } from "lucide-react";

import { listOwners } from "@/data/owners";
import { listProperties } from "@/data/properties";
import { listTenants } from "@/data/tenants";
import { listTicketActivity } from "@/data/ticket-activity";
import { listTicketMessages } from "@/data/ticket-messages";
import { getTicket, listTickets, listUnitsByLabel } from "@/data/tickets";
import { listUserDisplayNameByEmail } from "@/data/users";
import type { TicketActivity, TicketActivityAction, TicketMessage, TicketStatus } from "@/data/types";
import { SiteHeader } from "@/components/layout/site-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import type { EmailContact } from "@/components/tickets/email-recipient-input";
import { MessageUnlinkButton } from "@/components/tickets/message-unlink-button";
import { NoteEditDialog } from "@/components/tickets/note-edit-dialog";
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

import { deleteTicketAction, deleteTicketNoteAction } from "../actions";

export const dynamic = "force-dynamic";

const statusVariants: Record<TicketStatus, "default" | "secondary" | "outline"> = {
	OPEN: "default",
	IN_PROGRESS: "secondary",
	DONE: "outline",
};

/** Icon je protokollierter Aktion (TicketActivityAction). */
const activityIcons: Record<TicketActivityAction, typeof CirclePlus> = {
	CREATED: CirclePlus,
	UPDATED: Pencil,
	STATUS_CHANGED: ArrowLeftRight,
	NOTE_EDITED: PenLine,
	NOTE_DELETED: FileX,
	EMAIL_LINKED: MailCheck,
	EMAIL_UNLINKED: MailX,
	EMAIL_REASSIGNED: Forward,
};

/**
 * Gemischte Chronologie der Detailseite: Kommunikations-Einträge und
 * protokollierte Aktionen in einer zeitlich sortierten Liste.
 */
type TimelineItem = { kind: "message"; message: TicketMessage } | { kind: "activity"; activity: TicketActivity };

/** Ein Verlauf-Eintrag (eingehende/ausgehende E-Mail oder interne Notiz). */
function TimelineEntry({
	message,
	reassignTickets,
	t,
	userNameByEmail,
}: {
	message: TicketMessage;
	reassignTickets: ReassignableTicket[];
	t: TranslateFn;
	/** Auflösung E-Mail → Anzeige-Name für interne Notizen (Autor = App-Nutzer). */
	userNameByEmail: Map<string, string>;
}) {
	const isNote = message.direction === "NOTE";
	const isOutbound = message.direction === "OUTBOUND";
	const Icon = isNote ? StickyNote : isOutbound ? MailPlus : Mail;
	// Autor einer internen Notiz ist ein App-Nutzer - angezeigt wird dessen
	// Name statt der E-Mail-Adresse (Fallback Adresse bei gelöschten Konten).
	const authorLabel = message.authorEmail ? (userNameByEmail.get(message.authorEmail) ?? message.authorEmail) : null;

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
						{/* Interne Notizen sind bearbeitbar und löschbar. */}
						{isNote ? (
							<>
								<NoteEditDialog message={message} />
								<ConfirmDeleteButton
									action={deleteTicketNoteAction.bind(null, message.id)}
									confirmMessage={t("tickets.confirm.deleteNote")}
								/>
							</>
						) : null}
						<span className="text-xs text-muted-foreground">{formatDateTime(message.createdAt)}</span>
					</div>
				</div>
				<p className="text-xs text-muted-foreground">
					{isNote
						? (authorLabel ?? t("tickets.history.unknownAuthor"))
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

/**
 * Protokollierte Aktion im Ticket-Verlauf (z. B. Statuswechsel): kompakte
 * Zeile mit Aktion, Akteur und Zeitpunkt. Akteur leer = System-Aktion
 * ohne Nutzerkontext (MCP-Werkzeuge).
 */
function ActivityEntry({
	activity,
	t,
	userNameByEmail,
}: {
	activity: TicketActivity;
	t: TranslateFn;
	/** Auflösung E-Mail → Anzeige-Name (Fallback Adresse bei gelöschten Konten). */
	userNameByEmail: Map<string, string>;
}) {
	const Icon = activityIcons[activity.action];
	const actorLabel = activity.actorEmail ? (userNameByEmail.get(activity.actorEmail) ?? activity.actorEmail) : null;
	return (
		<div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
			<Icon className="size-4 shrink-0 text-muted-foreground" />
			<span className="inline-flex flex-wrap items-center gap-1 text-muted-foreground">
				{t(`tickets.activity.${activity.action}`)}
				{/* Anlage: initialer Status (z. B. direkt „Erledigt" angelegt). */}
				{activity.action === "CREATED" && activity.toValue ? (
					<Badge variant="outline">{t(`tickets.status.${activity.toValue as TicketStatus}`)}</Badge>
				) : null}
				{/* Statuswechsel: alter -> neuer Status als Badges. */}
				{activity.action === "STATUS_CHANGED" && activity.fromValue && activity.toValue ? (
					<>
						<Badge variant="outline">{t(`tickets.status.${activity.fromValue as TicketStatus}`)}</Badge>
						<span aria-hidden>→</span>
						<Badge variant="secondary">{t(`tickets.status.${activity.toValue as TicketStatus}`)}</Badge>
					</>
				) : null}
				{/* Kontext: Herkunfts-/betroffene E-Mail. */}
				{activity.detail ? (
					<span>
						{" · "}
						{t(
							activity.action === "CREATED" ? "tickets.activity.createdFromEmail" : "tickets.activity.email",
							{ subject: activity.detail }
						)}
					</span>
				) : null}
			</span>
			<span className="ml-auto text-xs text-muted-foreground">
				{actorLabel ?? t("tickets.activity.system")} · {formatDateTime(activity.createdAt)}
			</span>
		</div>
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
	const activities = listTicketActivity(ticket.id);
	// Gemeinsame Chronologie aus Kommunikation und protokollierten Aktionen;
	// bei exakt gleichem Zeitpunkt zuerst die Nachricht (sie war bereits da,
	// die Aktion beschreibt die Änderung danach). Der Sort ist stabil -
	// innerhalb einer Gruppe bleibt die jeweilige Listen-Reihenfolge.
	const timeline: TimelineItem[] = [
		...messages.map((message) => ({ kind: "message" as const, message })),
		...activities.map((activity) => ({ kind: "activity" as const, activity })),
	].sort((a, b) => {
		const timeA = a.kind === "message" ? a.message.createdAt : a.activity.createdAt;
		const timeB = b.kind === "message" ? b.message.createdAt : b.activity.createdAt;
		if (timeA !== timeB) return timeA < timeB ? -1 : 1;
		if (a.kind === b.kind) return 0;
		return a.kind === "message" ? -1 : 1;
	});
	const propertyList = listProperties().sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
	const unitList = listUnitsByLabel();
	const smtpConfigured = isSmtpConfigured();
	// Akteure (Aktivitätsprotokoll) und Notiz-Autoren werden über ihre
	// E-Mail-Adresse gespeichert - hier für die Anzeige zum Namen aufgelöst.
	const userNameByEmail = listUserDisplayNameByEmail();
	// Andere offene Tickets als Ziel für „Anderem Ticket zuordnen".
	const reassignTickets = listTickets()
		.filter((other) => other.id !== ticket.id && other.status !== "DONE")
		.map((other) => ({ id: other.id, title: other.title, propertyName: other.property?.name ?? null }));

	// Vorbefüllung der Antwort aus der letzten eingehenden E-Mail.
	const lastInbound = [...messages].reverse().find((message) => message.direction === "INBOUND");
	const defaultTo = lastInbound?.fromAddress ?? "";
	// Betreff-Standard = Ticketname; die Ticket-Kennung hängt der Versand
	// automatisch an (ensureTicketSubjectTag, src/lib/ticket-mailer.ts).
	const defaultSubject = ticket.title;

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
				<h2 className="text-sm font-semibold text-muted-foreground">{t("tickets.history.title", { count: timeline.length })}</h2>
				{timeline.length === 0 ? (
					<div className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
						{t("tickets.history.empty")}
					</div>
				) : (
					timeline.map((item) =>
						item.kind === "message" ? (
							<TimelineEntry
								key={`message-${item.message.id}`}
								message={item.message}
								reassignTickets={reassignTickets}
								t={t}
								userNameByEmail={userNameByEmail}
							/>
						) : (
							<ActivityEntry key={`activity-${item.activity.id}`} activity={item.activity} t={t} userNameByEmail={userNameByEmail} />
						)
					)
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
