import { Users } from "lucide-react";

import { getOwnershipCountsByOwner, listOwners } from "@/data/owners";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { OwnerFormDialog } from "@/components/weg/owner-form-dialog";
import { OwnersTable } from "@/components/weg/owners-table";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function EigentuemerPage() {
	const t = await getT();
	const ownerList = listOwners();
	const ownershipCountMap = getOwnershipCountsByOwner();

	// Eigentumsverhältnis-Zähler in die Zeilen einbetten (Map ist als
	// Client-Prop nicht serialisierbar).
	const rows = ownerList.map((owner) => ({ ...owner, ownershipCount: ownershipCountMap.get(owner.id) ?? 0 }));

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("hoa.owners.title")} description={t("hoa.owners.description")} actions={<OwnerFormDialog />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<Card>
					<CardContent className="p-0">
						{rows.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Users className="size-8" />
								<p>{t("hoa.owners.empty")}</p>
							</div>
						) : (
							<OwnersTable rows={rows} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
