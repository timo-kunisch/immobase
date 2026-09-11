import { Scale } from "lucide-react";

import { listHoasWithProperty } from "@/data/hoas";
import { listCustomAllocationKeysWithWeights, listUnitsForHoa } from "@/data/hoa-allocation-keys";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { AllocationKeysTable } from "@/components/weg/allocation-keys-table";
import { CustomAllocationKeyFormDialog } from "@/components/weg/custom-allocation-key-form-dialog";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function VerteilerschluesselPage({ searchParams }: { searchParams: Promise<{ hoaId?: string }> }) {
	const { hoaId } = await searchParams;
	const t = await getT();

	// WEGs für den Filter alphabetisch (bisher per SQL ORDER BY name, jetzt im
	// Anschluss an listHoasWithProperty() sortiert - Code-Unit-Vergleich
	// entspricht der SQLite-BINARY-Kollation).
	const hoaList = [...listHoasWithProperty()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));

	if (hoaList.length === 0) {
		return (
			<div className="flex flex-1 flex-col">
				<SiteHeader title={t("hoa.allocationKeys.title")} description={t("hoa.allocationKeys.description")} />
				<div className="flex-1 p-4 sm:p-6">
					<p className="text-sm text-muted-foreground">{t("hoa.noHoa")}</p>
				</div>
			</div>
		);
	}

	const selectedHoa = hoaId ? hoaList.find((h) => h.id === hoaId) : undefined;

	// Schlüssel + Einheiten werden nur für die ausgewählte WEG benötigt (ohne
	// Auswahl wird keine Tabelle gerendert).
	const customAllocationKeys = selectedHoa ? listCustomAllocationKeysWithWeights(selectedHoa.id) : [];
	const units = selectedHoa ? listUnitsForHoa(selectedHoa.id) : [];

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title={t("hoa.allocationKeys.title")}
				description={t("hoa.allocationKeys.description")}
				actions={selectedHoa ? <CustomAllocationKeyFormDialog hoaId={selectedHoa.id} /> : undefined}
			/>

			<div className="flex-1 space-y-6 p-4 sm:p-6">
				<HoaFilter hoas={hoaList} value={hoaId} basePath="/weg/verteilerschluessel" />

				<div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">{t("hoa.allocationKeys.info")}</div>

				{!selectedHoa ? (
					<p className="text-sm text-muted-foreground">{t("hoa.allocationKeys.selectHoa")}</p>
				) : (
					<Card>
						<CardContent className="p-0">
							{customAllocationKeys.length === 0 ? (
								<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
									<Scale className="size-8" />
									<p>{t("hoa.allocationKeys.empty")}</p>
								</div>
							) : (
								<AllocationKeysTable rows={customAllocationKeys} hoaId={selectedHoa.id} units={units} />
							)}
						</CardContent>
					</Card>
				)}
			</div>
		</div>
	);
}
