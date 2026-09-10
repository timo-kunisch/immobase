import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ClipboardList, FileText, Gavel } from "lucide-react";

import { getOwnerMeetingWithHoaAndProperty, listAgendaItemsForMeeting, listResolutionsForMeeting } from "@/data/meetings";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { AgendaItemFormDialog } from "@/components/weg/agenda-item-form-dialog";
import { ResolutionFormDialog } from "@/components/weg/resolution-form-dialog";
import { GenerateMeetingPdfButton } from "@/components/weg/generate-meeting-pdf-button";
import { MinutesTextForm } from "@/components/weg/minutes-text-form";
import { SendByPostButton } from "@/components/postal-shipments/send-by-post-button";
import { formatDate } from "@/lib/format";
import { getT } from "@/lib/i18n/server";
import { ownerMeetingStatusStyles, resolutionVotingResultStyles } from "@/lib/hoa-meetings";

import { deleteAgendaItemAction, deleteResolutionAction, generateInvitationPdfAction, generateMinutesPdfAction, sendInvitationByPostAction, sendMinutesByPostAction } from "../actions";
import { isLetterXpressConfigured } from "@/lib/letterxpress";

export const dynamic = "force-dynamic";

export default async function OwnerMeetingDetailPage({ params }: { params: Promise<{ meetingId: string }> }) {
	const t = await getT();
	const { meetingId } = await params;
	const postalConfigured = isLetterXpressConfigured();

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
	const votingResultLabels: Record<string, string> = {
		ACCEPTED: t("hoaMeetings.votingResult.ACCEPTED"),
		REJECTED: t("hoaMeetings.votingResult.REJECTED"),
	};

	const meeting = getOwnerMeetingWithHoaAndProperty(meetingId);

	if (!meeting) {
		notFound();
	}

	const agendaItems = listAgendaItemsForMeeting(meetingId);
	const resolutions = listResolutionsForMeeting(meetingId);

	const nextPosition = agendaItems.length > 0 ? Math.max(...agendaItems.map((a) => a.position)) + 1 : 1;
	const defaultResolvedAt = meeting.meetingDate ? meeting.meetingDate.slice(0, 10) : undefined;

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader
				title={meeting.title}
				description={`${meeting.hoaName} · ${meetingTypeLabels[meeting.type]}${meeting.meetingDate ? ` · ${formatDate(meeting.meetingDate)}` : ""}${meeting.location ? ` · ${meeting.location}` : ""}`}
				actions={
					<div className="flex items-center gap-2">
						<Button variant="outline" size="sm" asChild>
							<Link href={`/weg/versammlungen?hoaId=${meeting.hoaId}`}>
								<ChevronLeft />
								{t("common.back")}
							</Link>
						</Button>
						<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ownerMeetingStatusStyles[meeting.status]}`}>{meetingStatusLabels[meeting.status]}</span>
					</div>
				}
			/>
			<div className="flex-1 space-y-6 p-4 sm:p-6">
				{/* Tagesordnung */}
				<div className="flex items-center justify-between">
					<h3 className="text-base font-semibold">{t("hoaMeetings.agenda.title")}</h3>
					<AgendaItemFormDialog hoaId={meeting.hoaId} meetingId={meeting.id} nextPosition={nextPosition} />
				</div>
				<Card>
					<CardContent className="p-0">
						{agendaItems.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
								<ClipboardList className="size-6" />
								<p className="text-sm">{t("hoaMeetings.agenda.empty")}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-[60px]">{t("hoaMeetings.agenda.table.number")}</TableHead>
										<TableHead>{t("hoaMeetings.agenda.table.title")}</TableHead>
										<TableHead>{t("common.description")}</TableHead>
										<TableHead className="w-[100px] text-right">{t("common.actions")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{agendaItems.map((item) => (
										<TableRow key={item.id}>
											<TableCell>{item.position}</TableCell>
											<TableCell className="font-medium">{item.title}</TableCell>
											<TableCell className="text-muted-foreground">{item.description ?? "–"}</TableCell>
											<TableCell>
												<div className="flex items-center justify-end gap-1">
													<AgendaItemFormDialog hoaId={meeting.hoaId} meetingId={meeting.id} agendaItem={item} nextPosition={nextPosition} />
													<ConfirmDeleteButton action={deleteAgendaItemAction.bind(null, item.id, meeting.hoaId, meeting.id)} confirmMessage={t("hoaMeetings.agenda.confirm.delete", { title: item.title })} />
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>

				{/* Einladung */}
				<div className="flex items-center justify-between">
					<h3 className="text-base font-semibold">{t("hoaMeetings.invitation.title")}</h3>
				</div>
				<Card>
					<CardContent className="flex flex-wrap items-center gap-3 py-4">
						<GenerateMeetingPdfButton action={generateInvitationPdfAction.bind(null, meeting.id, meeting.hoaId)} label={t("hoaMeetings.actions.generateInvitation")} pdfPath={meeting.invitationPdfPath} pdfFileSize={meeting.invitationPdfFileSize} pdfGeneratedAt={meeting.invitationPdfGeneratedAt} />
						{meeting.invitationPdfPath ? <SendByPostButton sendAction={sendInvitationByPostAction.bind(null, meeting.id, meeting.hoaId)} disabled={!postalConfigured} disabledReason={t("postal.notConfiguredShort")} /> : null}
					</CardContent>
				</Card>

				{/* Beschlüsse */}
				<div className="flex items-center justify-between">
					<h3 className="text-base font-semibold">{t("hoaMeetings.resolutions.title")}</h3>
					<ResolutionFormDialog hoaId={meeting.hoaId} meetingId={meeting.id} agendaItems={agendaItems} defaultResolvedAt={defaultResolvedAt} />
				</div>
				<Card>
					<CardContent className="p-0">
						{resolutions.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-8 text-center text-muted-foreground">
								<Gavel className="size-6" />
								<p className="text-sm">{t("hoaMeetings.resolutions.empty")}</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead className="w-[60px]">{t("hoaMeetings.resolutions.table.number")}</TableHead>
										<TableHead>{t("hoaMeetings.resolutions.table.title")}</TableHead>
										<TableHead>{t("common.date")}</TableHead>
										<TableHead>{t("hoaMeetings.resolutions.table.result")}</TableHead>
										<TableHead className="w-[100px] text-right">{t("common.actions")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{resolutions.map((resolution) => (
										<TableRow key={resolution.id} id={`resolution-${resolution.id}`}>
											<TableCell>{resolution.sequenceNumber}</TableCell>
											<TableCell className="font-medium">{resolution.title}</TableCell>
											<TableCell className="text-muted-foreground">{formatDate(resolution.resolvedAt)}</TableCell>
											<TableCell>
												<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${resolutionVotingResultStyles[resolution.votingResult]}`}>{votingResultLabels[resolution.votingResult]}</span>
											</TableCell>
											<TableCell>
												<div className="flex items-center justify-end gap-1">
													<ResolutionFormDialog hoaId={meeting.hoaId} meetingId={meeting.id} agendaItems={agendaItems} resolution={resolution} />
													<ConfirmDeleteButton action={deleteResolutionAction.bind(null, resolution.id, meeting.hoaId, meeting.id)} confirmMessage={t("hoaMeetings.resolutions.confirm.delete", { title: resolution.title })} />
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>

				{/* Protokoll */}
				<div className="flex items-center justify-between">
					<h3 className="text-base font-semibold">{t("hoaMeetings.minutes.title")}</h3>
				</div>
				<Card>
					<CardContent className="space-y-4 pt-6">
						<MinutesTextForm hoaId={meeting.hoaId} meetingId={meeting.id} minutesText={meeting.minutesText} />
						<div className="flex flex-wrap items-center gap-3 border-t pt-4">
							<GenerateMeetingPdfButton action={generateMinutesPdfAction.bind(null, meeting.id, meeting.hoaId)} label={t("hoaMeetings.actions.generateMinutes")} pdfPath={meeting.minutesPdfPath} pdfFileSize={meeting.minutesPdfFileSize} pdfGeneratedAt={meeting.minutesPdfGeneratedAt} />
							{meeting.minutesPdfPath ? <SendByPostButton sendAction={sendMinutesByPostAction.bind(null, meeting.id, meeting.hoaId)} disabled={!postalConfigured} disabledReason={t("postal.notConfiguredShort")} /> : null}
						</div>
						{meeting.minutesFinalizedAt ? (
							<p className="flex items-center gap-2 text-xs text-muted-foreground">
								<FileText className="size-3.5" />
								{t("hoaMeetings.minutes.finalizedAt", { date: formatDate(meeting.minutesFinalizedAt) })}
							</p>
						) : null}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
