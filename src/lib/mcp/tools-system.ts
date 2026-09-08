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
import { getUserById, listUsers, updateUserApproval } from "@/data/users";
import { buildCalendarItems } from "@/lib/calendar";

import { McpToolError, buildInputSchema, coerceArgs, registerCrudTools, registerTool, type FieldSpec } from "./registry";

/**
 * MCP-Werkzeuge der Benutzerverwaltung und der allgemeinen Module
 * (Kalender, Wissensdatenbank). Da das MCP-Token faktisch Admin-Rechte
 * hat (nur Admins können den MCP-Server aktivieren), sind hier auch die
 * Admin-Aktionen der Nutzerverwaltung verfügbar.
 */

registerTool({
	name: "users_list",
	description: "Listet alle Benutzerkonten auf (ohne Passwort-Hashes).",
	inputSchema: buildInputSchema({}),
	handler: () =>
		listUsers().map((user) => ({
			id: user.id,
			email: user.email,
			role: user.role,
			isApproved: user.isApproved,
			emailVerified: user.emailVerified,
			createdAt: user.createdAt,
			updatedAt: user.updatedAt,
		})),
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
};

registerCrudTools<CalendarEventInput>({
	entity: "calendar_events",
	entityLabel: "Kalender-Ereignis",
	fields: calendarEventFields,
	fieldsHint: "Nur manuell gepflegte Ereignisse - die automatischen Termine (Einzug/Auszug, Versammlungen) liefert calendar_list.",
	beforeUpdate: (_id, input) => (input.endDate && input.endDate < input.startDate ? "Das Enddatum darf nicht vor dem Startdatum liegen." : null),
	beforeCreate: (input) => (input.endDate && input.endDate < input.startDate ? "Das Enddatum darf nicht vor dem Startdatum liegen." : null),
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
		"Eigentümerversammlungen (MEETING). Optional filterbar über from/to (jeweils inklusive).",
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
