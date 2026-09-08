import "server-only";

import { createAuditLogEntry } from "@/data/audit-log";
import type { AuditAction, AuditCategory } from "@/data/types";

/**
 * Schreibt einen Eintrag ins Aktivitätsprotokoll (siehe
 * src/data/audit-log.ts). Wird am Ende erfolgreicher Server Actions
 * aufgerufen - mit dem dort ohnehin geprüften Nutzer
 * (requireUser()/requireAdmin()) und einem fertig formulierten deutschen
 * Satz als `description` (nur am Aufrufort sind die fachlichen
 * Bezeichnungen wie Mietername oder Liegenschaft bekannt).
 *
 * Best Effort: Ein Fehler beim Protokollieren wird nur auf der Konsole
 * ausgegeben und bricht die eigentliche Fachoperation niemals ab.
 */
export function logActivity(
	user: { id: string | null; email: string },
	action: AuditAction,
	category: AuditCategory,
	description: string,
	entityId?: string | null
): void {
	try {
		createAuditLogEntry({ userId: user.id, userEmail: user.email, action, category, description, entityId });
	} catch (error) {
		console.error("logActivity failed", error);
	}
}
