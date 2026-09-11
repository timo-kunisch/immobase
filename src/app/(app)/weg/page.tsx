import { Building2 } from "lucide-react";

import { getHoaStats, listAvailablePropertiesForHoa, listHoasWithProperty } from "@/data/hoas";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { HoaFormDialog } from "@/components/weg/hoa-form-dialog";
import { HoasTable } from "@/components/weg/hoas-table";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function WegPage() {
	const t = await getT();
	const hoaList = listHoasWithProperty();
	// Nur Liegenschaften anbieten, die noch keiner WEG zugeordnet sind
	// (1:1-Beziehung über hoas.property_id).
	const availableProperties = listAvailablePropertiesForHoa();
	const statsMap = getHoaStats();

	// Statistiken in die Zeilen einbetten (Maps sind als Client-Props nicht serialisierbar).
	const rows = hoaList.map((hoa) => ({ ...hoa, stats: statsMap.get(hoa.id) }));

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("hoa.title")} description={t("hoa.description")} actions={<HoaFormDialog availableProperties={availableProperties} />} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<Card>
					<CardContent className="p-0">
						{rows.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Building2 className="size-8" />
								<p>{t("hoa.empty")}</p>
							</div>
						) : (
							<HoasTable rows={rows} availableProperties={availableProperties} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
