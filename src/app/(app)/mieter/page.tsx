import { Users } from "lucide-react";

import { getTenantStats, listTenants } from "@/data/tenants";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { TenantsTable } from "@/components/mieter/tenants-table";
import { TenantFormDialog } from "@/components/mieter/tenant-form-dialog";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function MieterPage() {
	const t = await getT();
	const tenantList = listTenants();
	const statsMap = getTenantStats();

	// Statistiken in die Zeilen einbetten (Maps sind als Client-Props nicht serialisierbar).
	const rows = tenantList.map((tenant) => ({ ...tenant, stats: statsMap.get(tenant.id) }));

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("tenants.title")} description={t("tenants.description")} actions={<TenantFormDialog />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<Card>
					<CardContent className="p-0">
						{rows.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Users className="size-8" />
								<p>{t("tenants.empty")}</p>
							</div>
						) : (
							<TenantsTable rows={rows} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
