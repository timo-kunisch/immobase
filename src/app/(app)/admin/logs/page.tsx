import { History } from "lucide-react";

import { listAuditLogEntries } from "@/data/audit-log";
import { listUserDisplayNameByEmail } from "@/data/users";
import { AuditLogTable } from "@/components/admin/audit-log-table";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function AdminLogsPage() {
	const t = await getT();

	// Vollständige Liste (neueste zuerst) - Sortierung, Filterung je Spalte
	// (Nutzer/Bereich/Aktion/Beschreibung) und Pagination (50/Seite)
	// übernimmt die Client-Datentabelle.
	const entries = listAuditLogEntries();
	// Audit-Einträge speichern die E-Mail-Adresse als denormalisierten
	// Snapshot - für die Anzeige wird sie hier zum Namen des Kontos
	// aufgelöst (gelöschte Konten fallen auf die E-Mail zurück).
	const userLabels = [...listUserDisplayNameByEmail().entries()].map(([email, name]) => ({ email, name }));

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title={t("admin.logs.title")}
				description={t("admin.logs.description")}
			/>

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<Card>
					<CardContent className="p-0">
						{entries.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<History className="size-8" />
								<p>{t("admin.logs.empty.unfiltered")}</p>
							</div>
						) : (
							<AuditLogTable rows={entries} userLabels={userLabels} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
