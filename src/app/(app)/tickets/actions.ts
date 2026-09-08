"use server";

import { revalidatePath } from "next/cache";

import { createTicket, deleteTicket, listTickets, updateTicket, updateTicketStatus } from "@/data/tickets";
import type { TicketStatus } from "@/data/types";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { ActionState } from "@/lib/action-state";

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
	return { success: true };
}
