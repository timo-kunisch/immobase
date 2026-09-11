import { AlertTriangle, Wallet } from "lucide-react";

import {
	listHousingChargesForUnits,
	listHoasSortedByName,
	listOpenHousingChargeArrearAmounts,
	listOwnersSortedByLastName,
	listUnitsForProperties,
} from "@/data/housing-charges";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { HousingChargeFormDialog } from "@/components/weg/housing-charge-form-dialog";
import { HousingChargesTable } from "@/components/weg/housing-charges-table";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { formatCurrency } from "@/lib/format";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function HausgeldPage({ searchParams }: { searchParams: Promise<{ hoaId?: string }> }) {
	const t = await getT();
	const { hoaId } = await searchParams;

	const hoaList = listHoasSortedByName();

	if (hoaList.length === 0) {
		return (
			<div className="flex flex-1 flex-col">
				<SiteHeader title={t("hoaFinance.charges.title")} description={t("hoaFinance.charges.description")} />
				<div className="flex-1 p-4 sm:p-6">
					<p className="text-sm text-muted-foreground">{t("hoaFinance.noHoas")}</p>
				</div>
			</div>
		);
	}

	const selectedHoa = hoaId ? hoaList.find((h) => h.id === hoaId) : undefined;
	const relevantHoas = selectedHoa ? [selectedHoa] : hoaList;

	const units = listUnitsForProperties(relevantHoas.map((h) => h.propertyId));
	const ownerList = listOwnersSortedByLastName();
	const unitIds = units.map((u) => u.id);

	// Vollständige Sollstellungs-Liste (Sortierung/Filterung/Pagination übernimmt
	// die Client-Datentabelle inkl. Status-Select-Filter je Spalte).
	const chargeList = listHousingChargesForUnits(unitIds);

	// Rückstände über ALLE Sollstellungen (unabhängig vom Filter-Status).
	const now = new Date();
	const arrears = listOpenHousingChargeArrearAmounts(unitIds, now).reduce((sum, amount) => sum + Number(amount), 0);

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("hoaFinance.charges.title")} description={t("hoaFinance.charges.description")} actions={selectedHoa ? <HousingChargeFormDialog hoaId={selectedHoa.id} units={units} owners={ownerList} /> : undefined} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<HoaFilter hoas={hoaList} value={hoaId} basePath="/weg/hausgeld" />

				{arrears > 0 ? (
					<Card className="border-red-200 dark:border-red-900">
						<CardContent className="flex items-center gap-3 py-4">
							<AlertTriangle className="size-5 text-red-600" />
							<p className="text-sm">
								<span className="font-semibold">{formatCurrency(arrears)}</span> {t("hoaFinance.charges.arrears.suffix")}
							</p>
						</CardContent>
					</Card>
				) : null}

				<Card>
					<CardContent className="p-0">
						{chargeList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Wallet className="size-8" />
								<p>{t("hoaFinance.charges.empty")}</p>
							</div>
						) : (
							<HousingChargesTable rows={chargeList} units={units} owners={ownerList} showHoaColumn={!selectedHoa} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}