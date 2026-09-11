import { Gavel } from "lucide-react";

import { listHoas, listOwnerResolutions } from "@/data/meetings";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { ResolutionsTable } from "@/components/weg/resolutions-table";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

/**
 * Vollständige, chronologisch fortlaufend nummerierte Beschluss-Sammlung
 * (§ 24 Abs. 6 WEG) über ALLE Versammlungen einer WEG hinweg - anders als
 * die Beschluss-Liste innerhalb einer einzelnen Versammlungs-Detailseite
 * (/weg/versammlungen/[meetingId]) ist dies eine reine Lesansicht ohne
 * Bearbeiten/Löschen (Bearbeitung erfolgt ausschließlich über die
 * jeweilige Versammlung, siehe Verlinkung je Zeile). Flache Top-Level-
 * Seite mit optionalem hoaId-Filter (siehe HoaFilter), analog zu den
 * übrigen WEG-Funktionen.
 */
export default async function BeschluesseUebersichtPage({ searchParams }: { searchParams: Promise<{ hoaId?: string }> }) {
	const t = await getT();
	const { hoaId } = await searchParams;

	const hoaList = listHoas();

	if (hoaList.length === 0) {
		return (
			<div className="flex flex-1 flex-col">
				<SiteHeader title={t("hoaMeetings.collection.title")} description={t("hoaMeetings.collection.description")} />
				<div className="flex-1 p-4 sm:p-6">
					<p className="text-sm text-muted-foreground">{t("hoaMeetings.noHoas")}</p>
				</div>
			</div>
		);
	}

	const selectedHoa = hoaId ? hoaList.find((h) => h.id === hoaId) : undefined;

	// Vollständige Beschluss-Sammlung (Sortierung/Filterung/Pagination
	// übernimmt die Client-Datentabelle, 50/Seite).
	const resolutionList = listOwnerResolutions(selectedHoa ? { hoaId: selectedHoa.id } : undefined);

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("hoaMeetings.collection.title")} description={t("hoaMeetings.collection.description")} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<HoaFilter hoas={hoaList} value={hoaId} basePath="/weg/beschluesse" />

				<div className="rounded-lg border bg-muted/40 p-4 text-sm text-muted-foreground">{t("hoaMeetings.collection.info")}</div>

				<Card>
					<CardContent className="p-0">
						{resolutionList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Gavel className="size-8" />
								<p>{t("hoaMeetings.collection.empty")}</p>
							</div>
						) : (
							<ResolutionsTable rows={resolutionList} showHoa={!selectedHoa} nowIso={new Date().toISOString()} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
