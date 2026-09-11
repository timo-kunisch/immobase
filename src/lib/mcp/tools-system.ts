import { createCalendarEvent, deleteCalendarEvent, getCalendarEvent, listCalendarEvents, updateCalendarEvent, type CalendarEventInput } from "@/data/calendar-events";
import {
	createKnowledgeBaseArticle,
	deleteKnowledgeBaseArticle,
	getKnowledgeBaseArticle,
	listKnowledgeBaseArticles,
	updateKnowledgeBaseArticle,
	type KnowledgeBaseArticleInput,
} from "@/data/knowledge-base";
import { listLeasesWithDetails } from "@/data/leases";
import { listOwnerMeetings } from "@/data/meetings";
import { deleteAllSessionsForUser } from "@/data/sessions";
import { getUserById, listUsers, updateUserApproval, updateUserName } from "@/data/users";
import { buildCalendarItems } from "@/lib/calendar";
import { userDisplayName } from "@/lib/user-name";

import { McpToolError, buildInputSchema, coerceArgs, registerCrudTools, registerTool, type FieldSpec } from "./registry";

/**
 * MCP-Werkzeuge der Benutzerverwaltung und der allgemeinen Module
 * (Kalender, Wissensdatenbank). Die Werkzeuge der Benutzerverwaltung sind
 * als adminOnly markiert: Sie stehen nur im Scope "ADMIN" zur Verfügung
 * (Admin-Token bzw. Admin-Session im KI-Chat), weil die Nutzerverwaltung
 * auch in der App nur Administratoren offensteht.
 */

registerTool({
	name: "users_list",
	description: "Listet alle Benutzerkonten auf (ohne Passwort-Hashes).",
	inputSchema: buildInputSchema({}),
	adminOnly: true,
	handler: () =>
		listUsers().map((user) => ({
			id: user.id,
			email: user.email,
			firstName: user.firstName,
			lastName: user.lastName,
			displayName: userDisplayName(user),
			role: user.role,
			isApproved: user.isApproved,
			emailVerified: user.emailVerified,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		})),
});

registerTool({
	name: "users_set_name",
	description:
		"Ändert Vor- und Nachname eines Benutzerkontos (z. B. Korrektur oder Nachpflege bei Altkonten). " +
		"Der Name dient in der App als Bezeichnung des Nutzers statt der E-Mail-Adresse.",
	inputSchema: buildInputSchema({
		userId: { type: "string" },
		firstName: { type: "string", description: "Vorname (Pflicht)" },
		lastName: { type: "string", description: "Nachname (Pflicht)" },
	}),
	adminOnly: true,
	handler: (args) => {
		const input = coerceArgs(
			{ userId: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" } },
			args
		) as { userId: string; firstName: string; lastName: string };

		const userId = input.userId;
		const firstName = input.firstName.trim();
		const lastName = input.lastName.trim();
		if (firstName.length === 0 || lastName.length === 0) {
			throw new McpToolError("Vor- und Nachname dürfen nicht leer sein.");
		}

		const targetUser = getUserById(userId);
		if (!targetUser) throw new McpToolError(`Nutzer mit ID "${userId}" wurde nicht gefunden.`);

		updateUserName(userId, firstName, lastName);
		return { success: true, userId, firstName, lastName };
	},
});

registerTool({
	name: "users_set_approval",
	description:
		"Setzt oder entzieht die Freigabe (isApproved) eines Benutzerkontos. Beim Entzug werden alle aktiven " +
		"Sessions des Nutzers sofort beendet. Die Freigabe des letzten freigegebenen Administrators kann nicht " +
		"entzogen werden (Aussperr-Schutz).",
	inputSchema: buildInputSchema({
		userId: { type: "string" },
		isApproved: { type: "boolean" },
	}),
	adminOnly: true,
	handler: (args) => {
		const input = coerceArgs({ userId: { type: "string" }, isApproved: { type: "boolean" } }, args);
		const userId = input.userId as string;
		const isApproved = input.isApproved as boolean;

		const targetUser = getUserById(userId);
		if (!targetUser) throw new McpToolError(`Nutzer mit ID "${userId}" wurde nicht gefunden.`);

		if (!isApproved && targetUser.role === "ADMIN") {
			const otherApprovedAdmins = listUsers().filter((user) => user.role === "ADMIN" && user.isApproved && user.id !== userId);
			if (otherApprovedAdmins.length === 0) {
				throw new McpToolError("Die Freigabe des letzten freigegebenen Administrators kann nicht entzogen werden.");
			}
		}

		updateUserApproval(userId, isApproved);
		if (!isApproved) {
			// Serverseitiger Widerruf aller Sessions (wie in der Admin-UI).
			deleteAllSessionsForUser(userId);
		}
		return { success: true, userId, isApproved };
	},
});

// ============================================================
// Kalender (manuelle Ereignisse + aggregierte Gesamtansicht)
// ============================================================

const calendarEventFields: Record<string, FieldSpec> = {
	title: { type: "string" },
	description: { type: "string", nullable: true },
	startDate: { type: "date", description: "Datum (bzw. erster Tag) des Ereignisses" },
	endDate: { type: "date", nullable: true, description: "Letzter Tag bei mehrtägigen Ereignissen (null = eintägig)" },
	startTime: { type: "string", nullable: true, description: 'Optionale Startuhrzeit "HH:MM" (24h; null = ganztägig)' },
	endTime: { type: "string", nullable: true, description: 'Optionale Enduhrzeit "HH:MM" (24h) am Endtag (erfordert Startuhrzeit)' },
};

/** Fachliche Prüfung eines Kalender-Ereignisses (Datums- und Uhrzeit-Logik wie in der App-Action). */
function validateCalendarEvent(input: Pick<CalendarEventInput, "startDate" | "endDate" | "startTime" | "endTime">): string | null {
	if (input.endDate && input.endDate < input.startDate) return "Das Enddatum darf nicht vor dem Startdatum liegen.";
	if (input.endTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.endTime)) return 'Die Enduhrzeit muss im Format "HH:MM" (24h) angegeben werden.';
	if (input.startTime && !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.startTime)) return 'Die Startuhrzeit muss im Format "HH:MM" (24h) angegeben werden.';
	if (input.endTime && !input.startTime) return "Eine Enduhrzeit setzt eine Startuhrzeit voraus.";
	// Am selben Tag darf die Enduhrzeit nicht vor der Startuhrzeit liegen
	// (über mehrtägige Zeiträume hinweg ist eine Spanne über Mitternacht zulässig).
	if (
		input.startTime &&
		input.endTime &&
		input.endTime < input.startTime &&
		(!input.endDate || input.endDate === input.startDate)
	) {
		return "Die Enduhrzeit darf nicht vor der Startuhrzeit liegen (am selben Tag).";
	}
	return null;
}

registerCrudTools<CalendarEventInput>({
	entity: "calendar_events",
	entityLabel: "Kalender-Ereignis",
	fields: calendarEventFields,
	fieldsHint: "Nur manuell gepflegte Ereignisse - die automatischen Termine (Einzug/Auszug, Versammlungen) liefert calendar_list.",
	beforeUpdate: (_id, input) => validateCalendarEvent(input),
	beforeCreate: (input) => validateCalendarEvent(input),
	list: () => listCalendarEvents(),
	get: (id) => getCalendarEvent(id),
	create: (input) => createCalendarEvent(input),
	update: (id, input) => updateCalendarEvent(id, input),
	delete: (id) => deleteCalendarEvent(id),
});

registerTool({
	name: "calendar_list",
	description:
		"Listet alle Kalender-Termine eines Zeitraums: manuell gepflegte Ereignisse (kind MANUAL) und automatisch " +
		"berechnete Termine aus den Fachdaten - Einzug/Mietbeginn (LEASE_START), Auszug/Mietende (LEASE_END) und " +
		"Eigentümerversammlungen (MEETING). Ein-/Auszug sind ganztägig (time null), Versammlungen und Ereignisse " +
		"mit Uhrzeit tragen diese in time (HH:MM bzw. HH:MM-HH:MM). Optional filterbar über from/to (jeweils inklusive).",
	inputSchema: buildInputSchema({
		from: { type: "date", nullable: true, description: "Zeitraum-Beginn (inklusive)" },
		to: { type: "date", nullable: true, description: "Zeitraum-Ende (inklusive)" },
	}),
	handler: (args) => {
		const { from, to } = coerceArgs(
			{ from: { type: "date", nullable: true }, to: { type: "date", nullable: true } },
			args
		) as { from: string | null; to: string | null };
		// coerceDate liefert ISO-Zeitstempel - auf den Tag kürzen.
		const fromDay = from ? from.slice(0, 10) : null;
		const toDay = to ? to.slice(0, 10) : null;
		if (fromDay && toDay && toDay < fromDay) throw new McpToolError('"to" darf nicht vor "from" liegen.');

		const items = buildCalendarItems({
			events: listCalendarEvents(),
			leases: listLeasesWithDetails(),
			meetings: listOwnerMeetings(),
		});
		return items
			.filter((item) => (!fromDay || item.dayKey >= fromDay) && (!toDay || item.dayKey <= toDay))
			.map(({ event: _event, ...item }) => item);
	},
});

// ============================================================
// Wissensdatenbank
// ============================================================

const knowledgeArticleFields: Record<string, FieldSpec> = {
	title: { type: "string" },
	category: { type: "string", nullable: true, description: "Optionales Kategorie-Schlagwort" },
	content: { type: "string" },
};

registerCrudTools<KnowledgeBaseArticleInput>({
	entity: "knowledge_articles",
	entityLabel: "Wissensartikel",
	fields: knowledgeArticleFields,
	listFilters: { search: { type: "string", nullable: true, description: "Suchbegriff (durchsucht Titel, Kategorie und Inhalt)" } },
	list: (filter) => listKnowledgeBaseArticles({ search: (filter.search as string) ?? undefined }),
	get: (id) => getKnowledgeBaseArticle(id),
	create: (input) => createKnowledgeBaseArticle(input),
	update: (id, input) => updateKnowledgeBaseArticle(id, input),
	delete: (id) => deleteKnowledgeBaseArticle(id),
});
