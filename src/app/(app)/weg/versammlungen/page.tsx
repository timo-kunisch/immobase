import { CalendarDays } from "lucide-react";

import { listHoas, listOwnerMeetings } from "@/data/meetings";
import { SiteHeader } from "@/components/layout/site-header";
import { Card, CardContent } from "@/components/ui/card";
import { OwnerMeetingFormDialog } from "@/components/weg/owner-meeting-form-dialog";
import { OwnerMeetingsTable } from "@/components/weg/owner-meetings-table";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function VersammlungenListPage({ searchParams }: { searchParams: Promise<{ hoaId?: string }> }) {
	const t = await getT();
	const { hoaId } = await searchParams;

	const hoaList = listHoas();

	if (hoaList.length === 0) {
		return (
			<div className="flex flex-1 flex-col">
				<SiteHeader title={t("hoaMeetings.meetings.title")} description={t("hoaMeetings.meetings.description")} />
				<div className="flex-1 p-4 sm:p-6">
					<p className="text-sm text-muted-foreground">{t("hoaMeetings.noHoas")}</p>
				</div>
			</div>
		);
	}

	const selectedHoa = hoaId ? hoaList.find((h) => h.id === hoaId) : undefined;

	// WEG-Filter (?hoaId=) bleibt serverseitig als Vorfilter wirksam;
	// Sortierung/Filterung/Pagination übernimmt die Client-Datentabelle.
	const meetingList = listOwnerMeetings(selectedHoa ? { hoaId: selectedHoa.id } : undefined);

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title={t("hoaMeetings.meetings.title")} description={t("hoaMeetings.meetings.description")} actions={selectedHoa ? <OwnerMeetingFormDialog hoaId={selectedHoa.id} /> : undefined} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<HoaFilter hoas={hoaList} value={hoaId} basePath="/weg/versammlungen" />

				<Card>
					<CardContent className="p-0">
						{meetingList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<CalendarDays className="size-8" />
								<p>{t("hoaMeetings.meetings.empty")}</p>
							</div>
						) : (
							<OwnerMeetingsTable rows={meetingList} showHoa={!selectedHoa} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
