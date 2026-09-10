import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";

import { listHoas, listOwnerMeetings } from "@/data/meetings";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { OwnerMeetingFormDialog } from "@/components/weg/owner-meeting-form-dialog";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { ownerMeetingStatusStyles } from "@/lib/hoa-meetings";

import { deleteOwnerMeetingAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function VersammlungenListPage({ searchParams }: { searchParams: Promise<{ hoaId?: string }> }) {
	const t = await getT();
	const { hoaId } = await searchParams;

	const meetingTypeLabels: Record<string, string> = {
		ORDINARY: t("hoaMeetings.meetingType.ORDINARY"),
		EXTRAORDINARY: t("hoaMeetings.meetingType.EXTRAORDINARY"),
		CIRCULATION: t("hoaMeetings.meetingType.CIRCULATION"),
	};
	const meetingStatusLabels: Record<string, string> = {
		PLANNED: t("hoaMeetings.meetingStatus.PLANNED"),
		INVITED: t("hoaMeetings.meetingStatus.INVITED"),
		HELD: t("hoaMeetings.meetingStatus.HELD"),
		MINUTES_FINALIZED: t("hoaMeetings.meetingStatus.MINUTES_FINALIZED"),
		CANCELLED: t("hoaMeetings.meetingStatus.CANCELLED"),
	};

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
							<Table>
								<TableHeader>
									<TableRow>
										{!selectedHoa ? <TableHead>{t("hoaMeetings.meetings.table.hoa")}</TableHead> : null}
										<TableHead>{t("hoaMeetings.meetings.table.title")}</TableHead>
										<TableHead>{t("hoaMeetings.meetings.table.type")}</TableHead>
										<TableHead>{t("hoaMeetings.meetings.table.date")}</TableHead>
										<TableHead>{t("common.status")}</TableHead>
										<TableHead className="w-[140px] text-right">{t("common.actions")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{meetingList.map((meeting) => (
										<TableRow key={meeting.id} id={`meeting-${meeting.id}`}>
											{!selectedHoa ? <TableCell className="text-muted-foreground">{meeting.hoaName}</TableCell> : null}
											<TableCell className="font-medium">{meeting.title}</TableCell>
											<TableCell className="text-muted-foreground">{meetingTypeLabels[meeting.type]}</TableCell>
											<TableCell className="text-muted-foreground">{meeting.meetingDate ? formatDate(meeting.meetingDate) : "–"}</TableCell>
											<TableCell>
												<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ownerMeetingStatusStyles[meeting.status]}`}>
													{meetingStatusLabels[meeting.status]}
												</span>
											</TableCell>
											<TableCell>
												<div className="flex items-center justify-end gap-1">
													<Button variant="ghost" size="icon-sm" aria-label={t("hoaMeetings.meetings.details")} title={t("hoaMeetings.meetings.details")} asChild>
														<Link href={`/weg/versammlungen/${meeting.id}`}>
															<ChevronRight className="size-4" />
														</Link>
													</Button>
													<ConfirmDeleteButton action={deleteOwnerMeetingAction.bind(null, meeting.id, meeting.hoaId)} confirmMessage={t("hoaMeetings.meetings.confirm.delete", { title: meeting.title })} />
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
