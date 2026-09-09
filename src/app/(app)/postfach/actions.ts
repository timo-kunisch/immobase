"use server";

import { revalidatePath } from "next/cache";

import { getTicketMessage, convertMessageToTicket, deleteMailboxMessage, linkMessageToTicket } from "@/data/ticket-messages";
import { getTicket } from "@/data/tickets";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";

function getString(formData: FormData, key: string): string {
	const value = formData.get(key);
	return typeof value === "string" ? value.trim() : "";
}

function revalidateMailbox() {
	revalidatePath("/postfach");
	revalidatePath("/tickets");
	revalidatePath("/");
}

/**
 * Manueller Abruf des IMAP-Postfachs (Button im Postfach). Der eigentliche
 * Abruf liegt in src/lib/email/imap-sync.ts (dort auch der Scheduler).
 */
export async function syncMailboxAction(): Promise<ActionState> {
	await requireUser();
	const { syncImapMailbox } = await import("@/lib/email/imap-sync");
	const result = await syncImapMailbox();
	revalidateMailbox();
	if (result.error) {
		return { error: `Abruf fehlgeschlagen: ${result.error}` };
	}
	const linked = result.linked > 0 ? ` (${result.linked} automatisch einem Ticket zugeordnet)` : "";
	return { success: true, message: `${result.imported} neue E-Mail(s) abgerufen${linked}.` };
}

/**
 * Wandelt eine Postfach-Nachricht in ein neues Ticket um (Titel/Beschreibung
 * sind aus Betreff/Inhalt vorbefüllt, Liegenschaft ist Pflicht).
 */
export async function convertMessageToTicketAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const messageId = getString(formData, "messageId");
	const propertyId = getString(formData, "propertyId");
	const unitIdRaw = getString(formData, "unitId");
	const unitId = unitIdRaw === "none" ? "" : unitIdRaw;
	const title = getString(formData, "title");
	const description = getString(formData, "description");

	if (!messageId || !propertyId || !title) {
		return { error: "Bitte wählen Sie eine Liegenschaft und vergeben Sie einen Titel." };
	}

	const message = getTicketMessage(messageId);
	if (!message || message.direction !== "INBOUND") {
		return { error: "Die E-Mail wurde nicht gefunden." };
	}
	if (message.ticketId) {
		return { error: "Diese E-Mail ist bereits einem Ticket zugeordnet." };
	}

	try {
		const ticket = convertMessageToTicket(messageId, {
			propertyId,
			unitId: unitId || null,
			title,
			description: description || null,
			status: "OPEN",
			contractorNotes: null,
			resolvedAt: null,
		});
		logActivity(user, "CREATE", "tickets", `Ticket „${title}“ aus E-Mail „${message.subject ?? "(ohne Betreff)"}“ angelegt`, ticket.id);
	} catch (error) {
		console.error("convertMessageToTicketAction failed", error);
		return { error: "Die E-Mail konnte nicht in ein Ticket umgewandelt werden." };
	}

	revalidateMailbox();
	return { success: true };
}

/** Heftet eine Postfach-Nachricht an ein bestehendes Ticket an. */
export async function linkMessageToTicketAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const messageId = getString(formData, "messageId");
	const ticketId = getString(formData, "ticketId");

	if (!messageId || !ticketId) {
		return { error: "Bitte wählen Sie ein Ticket aus." };
	}

	const message = getTicketMessage(messageId);
	if (!message || message.direction !== "INBOUND") {
		return { error: "Die E-Mail wurde nicht gefunden." };
	}
	if (message.ticketId) {
		return { error: "Diese E-Mail ist bereits einem Ticket zugeordnet." };
	}
	const ticket = getTicket(ticketId);
	if (!ticket) {
		return { error: "Das ausgewählte Ticket wurde nicht gefunden." };
	}

	try {
		linkMessageToTicket(messageId, ticketId);
		logActivity(user, "UPDATE", "tickets", `E-Mail „${message.subject ?? "(ohne Betreff)"}“ dem Ticket „${ticket.title}“ zugeordnet`, ticketId);
	} catch (error) {
		console.error("linkMessageToTicketAction failed", error);
		return { error: "Die E-Mail konnte nicht zugeordnet werden." };
	}

	revalidateMailbox();
	return { success: true };
}

/**
 * Entfernt eine E-Mail aus dem Postfach (nur die lokale Kopie in der App;
 * die Nachricht auf dem IMAP-Server bleibt unberührt und wird wegen des
 * Abgleichstands nicht erneut importiert).
 */
export async function deleteMailboxMessageAction(id: string): Promise<ActionState> {
	const user = await requireUser();
	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const message = getTicketMessage(id);
	try {
		deleteMailboxMessage(id);
	} catch (error) {
		console.error("deleteMailboxMessageAction failed", error);
		return { error: "Die E-Mail konnte nicht gelöscht werden." };
	}

	if (message) {
		logActivity(user, "DELETE", "postfach", `E-Mail „${message.subject ?? "(ohne Betreff)"}“ aus dem Postfach gelöscht`, id);
	}

	revalidateMailbox();
	return { success: true };
}
