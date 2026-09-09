"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createTicket, deleteTicket, getTicket, listTickets, updateTicket, updateTicketStatus } from "@/data/tickets";
import { createTicketMessage } from "@/data/ticket-messages";
import type { TicketStatus } from "@/data/types";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";
import { isSmtpConfigured } from "@/lib/email/mailer";
import { sendTicketEmail } from "@/lib/ticket-mailer";

const TICKET_STATUSES: TicketStatus[] = ["OPEN", "IN_PROGRESS", "DONE"];

/** Deutsche Anzeige-Labels der Ticket-Status (für den Log-Eintrag). */
const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
	OPEN: "Offen",
	IN_PROGRESS: "In Bearbeitung",
	DONE: "Erledigt",
};

/** Einzelnes Ticket über die bestehende Listenabfrage ermitteln (für den Log-Eintrag). */
function findTicket(id: string) {
	return listTickets().find((ticket) => ticket.id === id) ?? null;
}

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

export async function saveTicketAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const id = getString(formData, "id");
	const propertyId = getString(formData, "propertyId");
	const unitIdRaw = getString(formData, "unitId");
	const unitId = unitIdRaw === "none" ? "" : unitIdRaw;
	const title = getString(formData, "title");
	const description = getString(formData, "description");
	const statusRaw = getString(formData, "status") as TicketStatus;
	const contractorNotes = getString(formData, "contractorNotes");

	if (!propertyId || !title) {
		return {
			error: "Bitte wählen Sie eine Liegenschaft und vergeben Sie einen Titel.",
		};
	}

	const status: TicketStatus = TICKET_STATUSES.includes(statusRaw) ? statusRaw : "OPEN";

	const data = {
		propertyId,
		unitId: unitId || null,
		title,
		description: description || null,
		status,
		contractorNotes: contractorNotes || null,
		resolvedAt: status === "DONE" ? new Date().toISOString() : null,
	};

	try {
		if (id) {
			updateTicket(id, data);
			logActivity(user, "UPDATE", "tickets", `Ticket „${title}“ bearbeitet`, id);
		} else {
			const ticket = createTicket(data);
			logActivity(user, "CREATE", "tickets", `Ticket „${title}“ angelegt`, ticket.id);
		}
	} catch (error) {
		console.error("saveTicketAction failed", error);
		return { error: "Das Ticket konnte nicht gespeichert werden." };
	}

	if (id) revalidatePath(`/tickets/${id}`);
	revalidatePath("/tickets");
	revalidatePath("/");
	return { success: true };
}

/** Schneller Status-Wechsel direkt aus der Kanban-Ansicht (ohne Dialog). */
export async function updateTicketStatusAction(id: string, status: TicketStatus): Promise<ActionState> {
	const user = await requireUser();
	// Bezeichnung für den Log-Eintrag ermitteln.
	const ticket = findTicket(id);
	try {
		updateTicketStatus(id, status, status === "DONE" ? new Date().toISOString() : null);
	} catch (error) {
		console.error("updateTicketStatusAction failed", error);
		return { error: "Status konnte nicht geändert werden." };
	}

	logActivity(user, "UPDATE", "tickets", `Ticket „${ticket ? ticket.title : id}“ auf „${TICKET_STATUS_LABELS[status] ?? status}“ gesetzt`, id);

	revalidatePath(`/tickets/${id}`);
	revalidatePath("/tickets");
	revalidatePath("/");
	return { success: true };
}

export async function deleteTicketAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const ticket = findTicket(id);
	try {
		deleteTicket(id);
	} catch (error) {
		console.error("deleteTicketAction failed", error);
		return { error: "Das Ticket konnte nicht gelöscht werden." };
	}

	logActivity(user, "DELETE", "tickets", `Ticket „${ticket ? ticket.title : id}“ gelöscht`, id);

	revalidatePath("/tickets");
	revalidatePath("/");
	// Von der Detailseite aus zurück zur Übersicht (in der Kanban-Ansicht ist
	// das die bereits angezeigte Seite).
	redirect("/tickets");
}

// ------------------------------------------------------------
// Ticket-Kommunikation (Verlauf: interne Notizen + E-Mail-Antworten)
// ------------------------------------------------------------

/** Fügt eine interne Notiz zum Ticket-Verlauf hinzu (immer verfügbar - Basis-Funktion). */
export async function addTicketNoteAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const ticketId = getString(formData, "ticketId");
	const body = getString(formData, "body");

	if (!ticketId || !body) {
		return { error: "Bitte geben Sie einen Notiztext ein." };
	}
	const ticket = getTicket(ticketId);
	if (!ticket) {
		return { error: "Das Ticket wurde nicht gefunden." };
	}

	try {
		createTicketMessage({
			ticketId,
			direction: "NOTE",
			bodyText: body,
			authorUserId: user.id,
			authorEmail: user.email,
		});
		logActivity(user, "CREATE", "tickets", `Interne Notiz zum Ticket „${ticket.title}“ hinzugefügt`, ticketId);
	} catch (error) {
		console.error("addTicketNoteAction failed", error);
		return { error: "Die Notiz konnte nicht gespeichert werden." };
	}

	revalidatePath(`/tickets/${ticketId}`);
	revalidatePath("/tickets");
	return { success: true };
}

/**
 * Versendet eine E-Mail-Antwort aus dem Ticket heraus (nur wenn SMTP
 * konfiguriert ist) und legt sie als OUTBOUND-Eintrag im Verlauf ab -
 * Antworten des Empfängers werden über die Threading-Header (In-Reply-To/
 * References) beim nächsten IMAP-Abruf automatisch dem Ticket zugeordnet.
 */
export async function sendTicketEmailAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const ticketId = getString(formData, "ticketId");
	const to = getString(formData, "to");
	const subject = getString(formData, "subject");
	const body = getString(formData, "body");

	if (!ticketId || !to || !subject || !body) {
		return { error: "Bitte füllen Sie Empfänger, Betreff und Nachricht aus." };
	}
	const ticket = getTicket(ticketId);
	if (!ticket) {
		return { error: "Das Ticket wurde nicht gefunden." };
	}
	if (!isSmtpConfigured()) {
		return { error: "Der E-Mail-Versand ist nicht konfiguriert (SMTP, siehe Einstellungen)." };
	}

	try {
		await sendTicketEmail({ ticketId, to, subject, body, authorUserId: user.id, authorEmail: user.email });
		logActivity(user, "CREATE", "tickets", `E-Mail-Antwort zu Ticket „${ticket.title}“ an ${to} versendet`, ticketId);
	} catch (error) {
		console.error("sendTicketEmailAction failed", error);
		const detail = error instanceof Error ? error.message : String(error);
		return { error: `Die E-Mail konnte nicht versendet werden (${detail}).` };
	}

	revalidatePath(`/tickets/${ticketId}`);
	revalidatePath("/tickets");
	return { success: true };
}
