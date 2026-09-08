import { deleteAllSessionsForUser } from "@/data/sessions";
import { getUserById, listUsers, updateUserApproval } from "@/data/users";

import { McpToolError, buildInputSchema, coerceArgs, registerTool } from "./registry";

/**
 * MCP-Werkzeuge der Benutzerverwaltung. Da das MCP-Token faktisch
 * Admin-Rechte hat (nur Admins können den MCP-Server aktivieren), sind
 * hier auch die Admin-Aktionen der Nutzerverwaltung verfügbar.
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
