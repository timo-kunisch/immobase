import { requireAdmin } from "@/lib/auth/dal";

/**
 * Zusätzlicher Guard für den Einstellungen-Bereich: requireAdmin() prüft
 * (aufbauend auf requireUser() im übergeordneten (app)-Layout) zusätzlich
 * die Rolle und leitet Nicht-Admins zur Startseite um - analog zu
 * app/(app)/admin/layout.tsx.
 */
export default async function EinstellungenLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	await requireAdmin();
	return <>{children}</>;
}
