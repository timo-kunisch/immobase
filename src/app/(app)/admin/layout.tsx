import { requireAdmin } from "@/lib/auth/dal";

/**
 * Zusätzlicher Guard für den gesamten Admin-Bereich: requireAdmin() prüft
 * (aufbauend auf requireUser() im übergeordneten (app)-Layout) zusätzlich
 * die Rolle und leitet Nicht-Admins zur Startseite um.
 */
export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	await requireAdmin();
	return <>{children}</>;
}
