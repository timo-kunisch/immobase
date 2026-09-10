"use server";

import { revalidatePath } from "next/cache";

import {
	countResolutionsForMeeting,
	createAgendaItem,
	createOwnerMeeting,
	createResolution,
	deleteAgendaItem,
	deleteOwnerMeeting,
	deleteResolution,
	getOwnerMeeting,
	getOwnerMeetingWithHoaAndProperty,
	getOwnerResolution,
	listAgendaItemsForMeeting,
	listResolutionSequenceNumbersForHoa,
	listResolutionsForMeeting,
	setOwnerMeetingInvitationPdf,
	setOwnerMeetingMinutesPdf,
	updateAgendaItem,
	updateOwnerMeeting,
	updateOwnerMeetingMinutesText,
	updateResolution,
} from "@/data/meetings";
import type { OwnerMeetingStatus, OwnerMeetingType, ResolutionVotingResult } from "@/data/types";
import { requireUser } from "@/lib/auth/dal";
import { logActivity } from "@/lib/audit";
import { getT } from "@/lib/i18n/server";
import { ActionState } from "@/lib/action-state";
import { getString, getOptionalFloat, getOptionalInt } from "@/lib/form-data";
import { calculateContestationDeadline } from "@/lib/hoa-meetings";
import { deleteUploadedFile, saveGeneratedFile } from "@/lib/storage";
import { generateLetterPdf } from "@/lib/pdf/document";
import { formatDate } from "@/lib/format";
import { sendPdfByPostForSource, type PostalShipmentActionState } from "@/lib/postal-shipments";

const MEETING_TYPES: OwnerMeetingType[] = ["ORDINARY", "EXTRAORDINARY", "CIRCULATION"];
const MEETING_STATUSES: OwnerMeetingStatus[] = ["PLANNED", "INVITED", "HELD", "MINUTES_FINALIZED", "CANCELLED"];
const VOTING_RESULTS: ResolutionVotingResult[] = ["ACCEPTED", "REJECTED"];

// ============================================================
// Eigentümerversammlung (OwnerMeeting)
// ============================================================

export async function saveOwnerMeetingAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const hoaId = getString(formData, "hoaId");
	const title = getString(formData, "title");
	const typeRaw = getString(formData, "type") as OwnerMeetingType;
	const statusRaw = getString(formData, "status") as OwnerMeetingStatus;
	const meetingDateRaw = getString(formData, "meetingDate");
	const location = getString(formData, "location");
	const notes = getString(formData, "notes");

	if (!hoaId || !title) {
		return { error: t("hoaMeetings.meetings.errors.titleRequired") };
	}

	const type: OwnerMeetingType = MEETING_TYPES.includes(typeRaw) ? typeRaw : "ORDINARY";
	const status: OwnerMeetingStatus = MEETING_STATUSES.includes(statusRaw) ? statusRaw : "PLANNED";

	const data = {
		hoaId,
		title,
		type,
		status,
		meetingDate: meetingDateRaw ? new Date(meetingDateRaw).toISOString() : null,
		location: location || null,
		notes: notes || null,
	};

	try {
		if (id) {
			updateOwnerMeeting(id, data);
			logActivity(user, "UPDATE", "versammlungen", `Eigentümerversammlung „${title}“ bearbeitet`, id);
		} else {
			const meeting = createOwnerMeeting(data);
			logActivity(user, "CREATE", "versammlungen", `Eigentümerversammlung „${title}“ angelegt`, meeting.id);
		}
	} catch (error) {
		console.error("saveOwnerMeetingAction failed", error);
		return { error: t("hoaMeetings.meetings.errors.saveFailed") };
	}

	revalidatePath(`/weg/versammlungen`);
	return { success: true };
}

export async function deleteOwnerMeetingAction(id: string, _hoaId: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	if (countResolutionsForMeeting(id) > 0) {
		return { error: t("hoaMeetings.meetings.errors.hasResolutions") };
	}

	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const meeting = getOwnerMeeting(id);
	try {
		deleteOwnerMeeting(id);
	} catch (error) {
		console.error("deleteOwnerMeetingAction failed", error);
		return { error: t("hoaMeetings.meetings.errors.deleteFailed") };
	}

	logActivity(user, "DELETE", "versammlungen", `Eigentümerversammlung „${meeting ? meeting.title : id}“ gelöscht`, id);

	revalidatePath(`/weg/versammlungen`);
	return { success: true };
}

// ============================================================
// Tagesordnung (OwnerMeetingAgendaItem)
// ============================================================

export async function saveAgendaItemAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const meetingId = getString(formData, "meetingId");
	const title = getString(formData, "title");
	const description = getString(formData, "description");
	const position = getOptionalInt(formData, "position") ?? 1;

	if (!meetingId || !title) {
		return { error: t("hoaMeetings.agenda.errors.titleRequired") };
	}

	const data = { meetingId, title, description: description || null, position };

	try {
		if (id) {
			updateAgendaItem(id, data);
			logActivity(user, "UPDATE", "versammlungen", `Tagesordnungspunkt „${title}“ bearbeitet`, id);
		} else {
			const agendaItem = createAgendaItem(data);
			logActivity(user, "CREATE", "versammlungen", `Tagesordnungspunkt „${title}“ angelegt`, agendaItem.id);
		}
	} catch (error) {
		console.error("saveAgendaItemAction failed", error);
		return { error: t("hoaMeetings.agenda.errors.saveFailed") };
	}

	revalidatePath(`/weg/versammlungen/${meetingId}`);
	return { success: true };
}

export async function deleteAgendaItemAction(id: string, _hoaId: string, meetingId: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	// Bezeichnung vor dem Löschen ermitteln (für den Log-Eintrag).
	const agendaItem = listAgendaItemsForMeeting(meetingId).find((item) => item.id === id) ?? null;
	try {
		deleteAgendaItem(id);
	} catch (error) {
		console.error("deleteAgendaItemAction failed", error);
		return { error: t("hoaMeetings.agenda.errors.deleteFailed") };
	}

	logActivity(user, "DELETE", "versammlungen", `Tagesordnungspunkt „${agendaItem ? agendaItem.title : id}“ gelöscht`, id);

	revalidatePath(`/weg/versammlungen/${meetingId}`);
	return { success: true };
}

// ============================================================
// Beschlüsse (OwnerResolution) - Beschluss-Sammlung § 24 Abs. 6 WEG
// ============================================================

export async function saveResolutionAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const id = getString(formData, "id");
	const hoaId = getString(formData, "hoaId");
	const meetingId = getString(formData, "meetingId");
	const agendaItemIdRaw = getString(formData, "agendaItemId");
	const agendaItemId = agendaItemIdRaw === "none" ? "" : agendaItemIdRaw;
	const title = getString(formData, "title");
	const content = getString(formData, "content");
	const votingResultRaw = getString(formData, "votingResult") as ResolutionVotingResult;
	const votesFor = getOptionalFloat(formData, "votesFor");
	const votesAgainst = getOptionalFloat(formData, "votesAgainst");
	const votesAbstained = getOptionalFloat(formData, "votesAbstained");
	const resolvedAtRaw = getString(formData, "resolvedAt");
	const notes = getString(formData, "notes");

	if (!hoaId || !meetingId || !title || !content || !resolvedAtRaw) {
		return { error: t("hoaMeetings.resolutions.errors.requiredFields") };
	}
	if (!VOTING_RESULTS.includes(votingResultRaw)) {
		return { error: t("hoaMeetings.resolutions.errors.invalidVotingResult") };
	}

	const resolvedAt = new Date(resolvedAtRaw);
	const contestedUntil = calculateContestationDeadline(resolvedAt);

	if (id) {
		// Beim Bearbeiten bleibt die fortlaufende sequenceNumber unverändert
		// (Beschluss-Sammlung ist unveränderlich in ihrer Nummerierung).
		const data = {
			meetingId,
			agendaItemId: agendaItemId || null,
			title,
			content,
			votingResult: votingResultRaw,
			votesFor,
			votesAgainst,
			votesAbstained,
			resolvedAt: resolvedAt.toISOString(),
			contestedUntil: contestedUntil.toISOString(),
			notes: notes || null,
		};
		try {
			updateResolution(id, data);
			logActivity(user, "UPDATE", "beschluesse", `Beschluss „${title}“ bearbeitet`, id);
		} catch (error) {
			console.error("saveResolutionAction (update) failed", error);
			return { error: t("hoaMeetings.resolutions.errors.saveFailed") };
		}
	} else {
		const data = {
			hoaId,
			meetingId,
			agendaItemId: agendaItemId || null,
			title,
			content,
			votingResult: votingResultRaw,
			votesFor,
			votesAgainst,
			votesAbstained,
			resolvedAt: resolvedAt.toISOString(),
			contestedUntil: contestedUntil.toISOString(),
			notes: notes || null,
		};
		try {
			// Vergabe der nächsten fortlaufenden Nummer (MAX+1) und Insert
			// laufen im Repository atomar in einer Transaktion.
			const resolution = createResolution(data);
			logActivity(user, "CREATE", "beschluesse", `Beschluss Nr. ${resolution.sequenceNumber} „${title}“ angelegt`, resolution.id);
		} catch (error) {
			console.error("saveResolutionAction (insert) failed", error);
			return { error: t("hoaMeetings.resolutions.errors.saveFailed") };
		}
	}

	revalidatePath(`/weg/versammlungen/${meetingId}`);
	revalidatePath(`/weg/beschluesse`);
	return { success: true };
}

/**
 * Löscht einen Beschluss NUR, wenn er der zuletzt vergebenen Nummer
 * entspricht (die Beschluss-Sammlung muss lückenlos und nachvollziehbar
 * bleiben, § 24 Abs. 6 WEG - ein rückwirkendes Löschen mittendrin würde
 * eine Lücke in der fortlaufenden Nummerierung reißen).
 */
export async function deleteResolutionAction(id: string, hoaId: string, meetingId: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const resolution = getOwnerResolution(id);
	if (!resolution) {
		return { error: t("hoaMeetings.resolutions.errors.notFound") };
	}

	const maxNumber = Math.max(...listResolutionSequenceNumbersForHoa(hoaId));
	if (resolution.sequenceNumber !== maxNumber) {
		return { error: t("hoaMeetings.resolutions.errors.deleteOnlyLast") };
	}

	try {
		deleteResolution(id);
	} catch (error) {
		console.error("deleteResolutionAction failed", error);
		return { error: t("hoaMeetings.resolutions.errors.deleteFailed") };
	}

	logActivity(user, "DELETE", "beschluesse", `Beschluss Nr. ${resolution.sequenceNumber} „${resolution.title}“ gelöscht`, id);

	revalidatePath(`/weg/versammlungen/${meetingId}`);
	revalidatePath(`/weg/beschluesse`);
	return { success: true };
}

// ============================================================
// PDF-Erzeugung: Einladung & Protokoll
// ============================================================

export async function generateInvitationPdfAction(meetingId: string, _hoaId: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const meeting = getOwnerMeetingWithHoaAndProperty(meetingId);
	if (!meeting) {
		return { error: t("hoaMeetings.meetings.errors.notFound") };
	}
	const agendaItems = listAgendaItemsForMeeting(meetingId);

	const agendaText = agendaItems.length > 0 ? agendaItems.map((item, index) => `${index + 1}. ${item.title}${item.description ? `\n   ${item.description}` : ""}`).join("\n\n") : "Es liegt noch keine Tagesordnung vor.";

	const body = [
		`Sehr geehrte Damen und Herren,`,
		``,
		`hiermit lädt die Verwaltung zur ${meeting.type === "EXTRAORDINARY" ? "außerordentlichen" : "ordentlichen"} Eigentümerversammlung der ${meeting.hoaName} ein.`,
		``,
		meeting.meetingDate ? `Termin: ${formatDate(meeting.meetingDate)}` : "",
		meeting.location ? `Ort: ${meeting.location}` : "",
		``,
		`Tagesordnung:`,
		``,
		agendaText,
	]
		.filter((line) => line !== "")
		.join("\n");

	let pdfBuffer: Buffer;
	try {
		pdfBuffer = await generateLetterPdf({
			recipientLines: [meeting.propertyName, meeting.propertyStreet, `${meeting.propertyZipCode} ${meeting.propertyCity}`],
			dateLine: formatDate(new Date()),
			subject: `Einladung zur Eigentümerversammlung: ${meeting.title}`,
			body,
		});
	} catch (error) {
		console.error("generateInvitationPdfAction: PDF-Erzeugung fehlgeschlagen", error);
		return { error: t("hoaMeetings.invitation.errors.generateFailed") };
	}

	const previousPdfPath = meeting.invitationPdfPath;

	try {
		const saved = await saveGeneratedFile(pdfBuffer, "hoa-meeting-invitations", `Einladung ${meeting.title}.pdf`);
		setOwnerMeetingInvitationPdf(meetingId, {
			pdfPath: saved.relativePath,
			pdfFileSize: saved.fileSize,
			pdfGeneratedAt: new Date().toISOString(),
			status: meeting.status === "PLANNED" ? "INVITED" : meeting.status,
		});

		if (previousPdfPath && previousPdfPath !== saved.relativePath) {
			await deleteUploadedFile(previousPdfPath);
		}
	} catch (error) {
		console.error("generateInvitationPdfAction: Speichern fehlgeschlagen", error);
		return { error: t("hoaMeetings.invitation.errors.saveFailed") };
	}

	logActivity(user, "UPDATE", "versammlungen", `Einladung zur Eigentümerversammlung „${meeting.title}“ erzeugt`, meetingId);

	revalidatePath(`/weg/versammlungen/${meetingId}`);
	revalidatePath(`/weg/versammlungen`);
	return { success: true };
}

export async function saveMinutesTextAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const meetingId = getString(formData, "meetingId");
	const minutesText = getString(formData, "minutesText");

	if (!meetingId) {
		return { error: t("hoaMeetings.meetings.errors.invalid") };
	}

	// Titel für den Log-Eintrag auflösen.
	const meeting = getOwnerMeeting(meetingId);
	try {
		updateOwnerMeetingMinutesText(meetingId, minutesText || null);
		logActivity(user, "UPDATE", "versammlungen", `Protokolltext der Eigentümerversammlung „${meeting ? meeting.title : meetingId}“ gespeichert`, meetingId);
	} catch (error) {
		console.error("saveMinutesTextAction failed", error);
		return { error: t("hoaMeetings.minutes.errors.saveFailed") };
	}

	revalidatePath(`/weg/versammlungen/${meetingId}`);
	return { success: true };
}

export async function generateMinutesPdfAction(meetingId: string, _hoaId: string): Promise<ActionState> {
	const user = await requireUser();
	const t = await getT();
	const meeting = getOwnerMeetingWithHoaAndProperty(meetingId);
	if (!meeting) {
		return { error: t("hoaMeetings.meetings.errors.notFound") };
	}
	if (!meeting.minutesText) {
		return { error: t("hoaMeetings.minutes.errors.textRequired") };
	}
	const resolutions = listResolutionsForMeeting(meetingId);

	const resolutionsText =
		resolutions.length > 0
			? resolutions.map((r) => `Beschluss Nr. ${r.sequenceNumber}: ${r.title}\n${r.content}\nErgebnis: ${r.votingResult === "ACCEPTED" ? "Angenommen" : "Abgelehnt"}`).join("\n\n")
			: "Für diese Versammlung wurden keine Beschlüsse erfasst.";

	const body = [meeting.minutesText, ``, `Beschlüsse:`, ``, resolutionsText].join("\n");

	let pdfBuffer: Buffer;
	try {
		pdfBuffer = await generateLetterPdf({
			recipientLines: [meeting.propertyName, meeting.propertyStreet, `${meeting.propertyZipCode} ${meeting.propertyCity}`],
			dateLine: formatDate(new Date()),
			subject: `Protokoll: ${meeting.title}`,
			body,
		});
	} catch (error) {
		console.error("generateMinutesPdfAction: PDF-Erzeugung fehlgeschlagen", error);
		return { error: t("hoaMeetings.minutes.errors.generateFailed") };
	}

	const previousPdfPath = meeting.minutesPdfPath;

	try {
		const saved = await saveGeneratedFile(pdfBuffer, "hoa-meeting-minutes", `Protokoll ${meeting.title}.pdf`);
		const timestamp = new Date().toISOString();
		setOwnerMeetingMinutesPdf(meetingId, {
			pdfPath: saved.relativePath,
			pdfFileSize: saved.fileSize,
			pdfGeneratedAt: timestamp,
			minutesFinalizedAt: timestamp,
			status: "MINUTES_FINALIZED",
		});

		if (previousPdfPath && previousPdfPath !== saved.relativePath) {
			await deleteUploadedFile(previousPdfPath);
		}
	} catch (error) {
		console.error("generateMinutesPdfAction: Speichern fehlgeschlagen", error);
		return { error: t("hoaMeetings.minutes.errors.saveFailed") };
	}

	logActivity(user, "UPDATE", "versammlungen", `Protokoll der Eigentümerversammlung „${meeting.title}“ erzeugt`, meetingId);

	revalidatePath(`/weg/versammlungen/${meetingId}`);
	revalidatePath(`/weg/versammlungen`);
	return { success: true };
}

// ============================================================
// Postversand: Einladung/Protokoll per LetterXpress verschicken
// ============================================================

export async function sendInvitationByPostAction(meetingId: string, _hoaId: string): Promise<PostalShipmentActionState> {
	const user = await requireUser();
	const t = await getT();
	const meeting = getOwnerMeeting(meetingId);
	if (!meeting) {
		return { error: t("hoaMeetings.meetings.errors.notFound") };
	}
	if (!meeting.invitationPdfPath) {
		return { error: t("hoaMeetings.invitation.errors.pdfRequired") };
	}

	const result = await sendPdfByPostForSource("HOA_MEETING_INVITATION", meetingId, user.id, await getT());
	if ("success" in result) {
		logActivity(user, "CREATE", "postversand", `Einladung zur Eigentümerversammlung „${meeting.title}“ per Post versendet`, meetingId);
	}
	revalidatePath(`/weg/versammlungen/${meetingId}`);
	return result;
}

export async function sendMinutesByPostAction(meetingId: string, _hoaId: string): Promise<PostalShipmentActionState> {
	const user = await requireUser();
	const t = await getT();
	const meeting = getOwnerMeeting(meetingId);
	if (!meeting) {
		return { error: t("hoaMeetings.meetings.errors.notFound") };
	}
	if (!meeting.minutesPdfPath) {
		return { error: t("hoaMeetings.minutes.errors.pdfRequired") };
	}

	const result = await sendPdfByPostForSource("HOA_MEETING_MINUTES", meetingId, user.id, await getT());
	if ("success" in result) {
		logActivity(user, "CREATE", "postversand", `Protokoll der Eigentümerversammlung „${meeting.title}“ per Post versendet`, meetingId);
	}
	revalidatePath(`/weg/versammlungen/${meetingId}`);
	return result;
}
