import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { UpdateBanner } from "@/components/layout/update-banner";
import { requireUser } from "@/lib/auth/dal";
import { isAiConfigured } from "@/lib/ai/config";
import { startDropboxBackupScheduler } from "@/lib/dropbox-backup";
import { isImapConfigured } from "@/lib/email/imap";
import { startImapSyncScheduler } from "@/lib/email/imap-sync";
import { startDocumentTrashPurgeScheduler } from "@/lib/document-trash";

// Autoritativer Auth-Check für den gesamten geschützten Bereich der App
// (siehe src/proxy.ts für den vorgelagerten, günstigen Cookie-Check).
// requireUser() leitet nicht angemeldete Nutzer zu /login um.
export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	const user = await requireUser();

	// Scheduler für die automatische Dropbox-Cloud-Sicherung (idempotent,
	// blockiert das Rendering nicht). Start bewusst HIER statt in
	// src/instrumentation.ts: Der Instrumentation-Entry wird von den
	// outputFileTracingExcludes nicht erfasst und würde die Backup-Kette
	// (archiver/Streams) ungefiltert in den Standalone-Trace ziehen - die
	// Route-Traces dagegen werden korrekt gefiltert (siehe next.config.ts).
	startDropboxBackupScheduler();
	// Scheduler für den automatischen IMAP-Abruf des Ticket-Postfachs
	// (idempotent, no-op ohne IMAP-Konfiguration; gleicher Startpunkt-Grund
	// wie beim Dropbox-Scheduler oben).
	startImapSyncScheduler();
	// Scheduler für die automatische Endlöschung abgelaufener Dokumente aus
	// dem Papierkorb (28 Tage Aufbewahrung; idempotent, gleicher
	// Startpunkt-Grund wie beim Dropbox-Scheduler oben).
	startDocumentTrashPurgeScheduler();

	return (
		<SidebarProvider>
			<AppSidebar user={{ email: user.email, role: user.role }} aiConfigured={isAiConfigured()} mailboxEnabled={isImapConfigured()} />
			<SidebarInset>
				<UpdateBanner />
				{children}
			</SidebarInset>
		</SidebarProvider>
	);
}
