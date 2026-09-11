import { Calculator } from "lucide-react";

import { listEconomicPlans, listHoasSortedByName } from "@/data/economic-plans";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { EconomicPlanFormDialog } from "@/components/weg/economic-plan-form-dialog";
import { EconomicPlansTable } from "@/components/weg/economic-plans-table";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function WirtschaftsplanListPage({ searchParams }: { searchParams: Promise<{ hoaId?: string }> }) {
	const { hoaId } = await searchParams;
	const t = await getT();

	const hoaList = listHoasSortedByName();

	if (hoaList.length === 0) {
		return (
			<div className="flex flex-1 flex-col">
				<SiteHeader title={t("hoaPlan.title")} description={t("hoaPlan.description")} />
				<div className="flex-1 p-4 sm:p-6">
					<p className="text-sm text-muted-foreground">{t("hoaPlan.empty.noHoa")}</p>
				</div>
			</div>
		);
	}

	const selectedHoa = hoaId ? hoaList.find((h) => h.id === hoaId) : undefined;

	const planList = listEconomicPlans(selectedHoa ? { hoaId: selectedHoa.id } : undefined);

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("hoaPlan.title")} description={t("hoaPlan.description")} actions={selectedHoa ? <EconomicPlanFormDialog hoaId={selectedHoa.id} /> : undefined} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<HoaFilter hoas={hoaList} value={hoaId} basePath="/weg/wirtschaftsplan" />

				<Card>
					<CardContent className="p-0">
						{planList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Calculator className="size-8" />
								<p>{t("hoaPlan.empty")}</p>
							</div>
						) : (
							<EconomicPlansTable rows={planList} showHoaColumn={!selectedHoa} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
