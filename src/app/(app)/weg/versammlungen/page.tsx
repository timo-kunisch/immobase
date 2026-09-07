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
import { ownerMeetingStatusLabels, ownerMeetingStatusStyles, ownerMeetingTypeLabels } from "@/lib/hoa-meetings";

import { deleteOwnerMeetingAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function VersammlungenListPage({ searchParams }: { searchParams: Promise<{ hoaId?: string }> }) {
	const { hoaId } = await searchParams;

	const hoaList = listHoas();

	if (hoaList.length === 0) {
		return (
			<div className="flex flex-1 flex-col">
				<SiteHeader title="Eigentümerversammlungen" description="Versammlungen je WEG." />
				<div className="flex-1 p-4 sm:p-6">
					<p className="text-sm text-muted-foreground">Legen Sie zuerst unter „WEG-Verwaltung“ eine WEG an.</p>
				</div>
			</div>
		);
	}

	const selectedHoa = hoaId ? hoaList.find((h) => h.id === hoaId) : undefined;

	const meetingList = listOwnerMeetings(selectedHoa ? { hoaId: selectedHoa.id } : undefined);

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title="Eigentümerversammlungen" description="Versammlungen je WEG." actions={selectedHoa ? <OwnerMeetingFormDialog hoaId={selectedHoa.id} /> : undefined} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<HoaFilter hoas={hoaList} value={hoaId} basePath="/weg/versammlungen" />

				<Card>
					<CardContent className="p-0">
						{meetingList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<CalendarDays className="size-8" />
								<p>Noch keine Versammlungen angelegt.</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										{!selectedHoa ? <TableHead>WEG</TableHead> : null}
										<TableHead>Titel</TableHead>
										<TableHead>Art</TableHead>
										<TableHead>Termin</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="w-[140px] text-right">Aktionen</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{meetingList.map((meeting) => (
										<TableRow key={meeting.id} id={`meeting-${meeting.id}`}>
											{!selectedHoa ? <TableCell className="text-muted-foreground">{meeting.hoaName}</TableCell> : null}
											<TableCell className="font-medium">{meeting.title}</TableCell>
											<TableCell className="text-muted-foreground">{ownerMeetingTypeLabels[meeting.type]}</TableCell>
											<TableCell className="text-muted-foreground">{meeting.meetingDate ? formatDate(meeting.meetingDate) : "–"}</TableCell>
											<TableCell>
												<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ownerMeetingStatusStyles[meeting.status]}`}>
													{ownerMeetingStatusLabels[meeting.status]}
												</span>
											</TableCell>
											<TableCell>
												<div className="flex items-center justify-end gap-1">
													<Button variant="ghost" size="icon-sm" aria-label="Details" title="Details" asChild>
														<Link href={`/weg/versammlungen/${meeting.id}`}>
															<ChevronRight className="size-4" />
														</Link>
													</Button>
													<ConfirmDeleteButton action={deleteOwnerMeetingAction.bind(null, meeting.id, meeting.hoaId)} confirmMessage={`Versammlung "${meeting.title}" wirklich löschen?`} />
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
