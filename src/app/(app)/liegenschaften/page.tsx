import { Building2 } from "lucide-react";

import { listProperties, getPropertyStats } from "@/data/properties";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { PropertiesTable } from "@/components/liegenschaften/properties-table";
import { PropertyFormDialog } from "@/components/liegenschaften/property-form-dialog";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function LiegenschaftenPage() {
	const t = await getT();
	const propertyList = listProperties();
	const statsMap = getPropertyStats();

	// Statistiken in die Zeilen einbetten (Maps sind als Client-Props nicht serialisierbar).
	const rows = propertyList.map((property) => ({ ...property, stats: statsMap.get(property.id) }));

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("properties.title")} description={t("properties.description")} actions={<PropertyFormDialog />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<Card>
					<CardContent className="p-0">
						{rows.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
							<Building2 className="size-8" />
							<p>{t("properties.empty")}</p>
							</div>
						) : (
							<PropertiesTable rows={rows} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
