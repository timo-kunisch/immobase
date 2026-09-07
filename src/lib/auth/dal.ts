import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { deleteSessionById, getSessionByToken } from "@/data/sessions";
import { getUserById } from "@/data/users";
import type { User } from "@/data/types";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";

export type CurrentUser = User;

/**
 * Data Access Layer (DAL) für Authentifizierung/Autorisierung.
 *
 * Empfehlung aus der Next.js-Doku (guides/authentication.md): Middleware
 * darf nur "optimistische" Checks (Cookie vorhanden?) machen, die
 * eigentliche, autoritative Prüfung (Datenbank, Ablaufdatum,
 * Freigabestatus) erfolgt hier – möglichst nah an den eigentlichen
 * Datenzugriffen (Layouts, Server Actions, Route Handlers).
 *
 * `cache()` sorgt dafür, dass innerhalb eines einzelnen Request/Render-
 * Durchlaufs nur eine DB-Anfrage nötig ist, auch wenn getCurrentUser()
 * mehrfach aufgerufen wird (z. B. im Layout UND in einer Page UND in einer
 * Server Action).
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
	const cookieStore = await cookies();
	const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
	if (!token) return null;

	const session = getSessionByToken(token);
	if (!session) return null;

	if (new Date(session.expires) < new Date()) {
		// Abgelaufene Session gleich aufräumen (Best Effort - ein Fehler beim
		// Aufräumen darf die eigentliche Prüfung nicht scheitern lassen).
		try {
			deleteSessionById(session.id);
		} catch {
			// Ignorieren, wie bisher (.catch(() => {}) im Vorgänger).
		}
		return null;
	}

	// Zusätzliche Absicherung: Falls einem Nutzer nach dem Login die
	// Freigabe entzogen wurde, aber seine Session(s) noch nicht abgelaufen
	// sind, behandeln wir ihn ab sofort trotzdem als nicht angemeldet.
	const user = getUserById(session.userId);
	if (!user || !user.isApproved || !user.emailVerified) return null;

	return user;
});

/** Wie getCurrentUser(), leitet aber nicht angemeldete Nutzer zu /login um. */
export async function requireUser(): Promise<CurrentUser> {
	const user = await getCurrentUser();
	if (!user) {
		redirect("/login");
	}
	return user;
}

/** Wie requireUser(), verlangt zusätzlich die Rolle ADMIN. */
export async function requireAdmin(): Promise<CurrentUser> {
	const user = await requireUser();
	if (user.role !== "ADMIN") {
		redirect("/");
	}
	return user;
}
