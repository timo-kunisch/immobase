import { hoaMeetings as deHoaMeetings } from "../de/hoaMeetings";

/** Englische Übersetzungen des Namespace "hoaMeetings" (Parität per Typ erzwungen). */
export const hoaMeetings: typeof deHoaMeetings = {
	// Empty state (no HOA created yet)
	noHoas: "Please create an HOA under “HOA management” first.",

	// Meeting types
	"meetingType.ORDINARY": "Ordinary meeting",
	"meetingType.EXTRAORDINARY": "Extraordinary meeting",
	"meetingType.CIRCULATION": "Circulation procedure",
	// Meeting status
	"meetingStatus.PLANNED": "Planned",
	"meetingStatus.INVITED": "Invited",
	"meetingStatus.HELD": "Held",
	"meetingStatus.MINUTES_FINALIZED": "Minutes finalized",
	"meetingStatus.CANCELLED": "Cancelled",
	// Voting results of resolutions
	"votingResult.ACCEPTED": "Accepted",
	"votingResult.REJECTED": "Rejected",

	// ============================================================
	// Meetings (list + form dialog)
	// ============================================================
	"meetings.title": "Owners' meetings",
	"meetings.description": "Meetings per HOA.",
	"meetings.empty": "No meetings created yet.",
	// Table headers
	"meetings.table.hoa": "HOA",
	"meetings.table.title": "Title",
	"meetings.table.type": "Type",
	"meetings.table.date": "Date",
	"meetings.details": "Details",
	// Delete confirmation (ConfirmDeleteButton)
	"meetings.confirm.delete": "Really delete meeting \"{title}\"?",
	// Form dialog (create/edit)
	"meetings.actions.create": "New meeting",
	"meetings.dialog.createTitle": "New owners' meeting",
	"meetings.dialog.editTitle": "Edit meeting",
	"meetings.dialog.description": "Ordinary/extraordinary meeting or circulation procedure.",
	"meetings.fields.title": "Title",
	"meetings.fields.type": "Type",
	"meetings.fields.meetingDate": "Date",
	"meetings.fields.location": "Location",
	"meetings.placeholder.title": "e.g. Owners' meeting 2026",
	"meetings.placeholder.location": "e.g. community room",
	// Server action error messages
	"meetings.errors.titleRequired": "Please provide a title for the meeting.",
	"meetings.errors.saveFailed": "The meeting could not be saved.",
	"meetings.errors.hasResolutions":
		"This meeting already contains resolutions and can therefore no longer be deleted (resolution collection, § 24 para. 6 German WEG Act).",
	"meetings.errors.deleteFailed": "The meeting could not be deleted.",
	"meetings.errors.notFound": "The meeting was not found.",
	"meetings.errors.invalid": "Invalid meeting.",

	// ============================================================
	// Agenda (OwnerMeetingAgendaItem)
	// ============================================================
	"agenda.title": "Agenda",
	"agenda.empty": "No agenda items recorded yet.",
	"agenda.table.number": "No.",
	"agenda.table.title": "Title",
	"agenda.confirm.delete": "Really delete agenda item \"{title}\"?",
	"agenda.actions.create": "Agenda item",
	"agenda.dialog.createTitle": "New agenda item",
	"agenda.dialog.editTitle": "Edit agenda item",
	"agenda.fields.position": "No.",
	"agenda.fields.title": "Title",
	// Server action error messages
	"agenda.errors.titleRequired": "Please provide a title for the agenda item.",
	"agenda.errors.saveFailed": "The agenda item could not be saved.",
	"agenda.errors.deleteFailed": "The agenda item could not be deleted.",

	// ============================================================
	// Invitation / minutes (PDF generation + postal delivery)
	// ============================================================
	"invitation.title": "Invitation",
	"invitation.errors.generateFailed": "The invitation could not be generated.",
	"invitation.errors.saveFailed": "The invitation could not be saved.",
	"invitation.errors.pdfRequired": "Please generate the invitation as a PDF first.",
	"minutes.title": "Minutes",
	"minutes.placeholder": "Course of the meeting, attendance, discussion points...",
	"minutes.actions.save": "Save minutes text",
	"minutes.finalizedAt": "Minutes finalized on {date}.",
	"minutes.errors.textRequired": "Please enter the minutes text first.",
	"minutes.errors.saveFailed": "The minutes could not be saved.",
	"minutes.errors.generateFailed": "The minutes could not be generated.",
	"minutes.errors.pdfRequired": "Please generate the minutes as a PDF first.",
	// "Generate PDF" button (GenerateMeetingPdfButton)
	"actions.generateInvitation": "Generate invitation",
	"actions.generateMinutes": "Generate minutes",
	"actions.regenerate": "{label} again",

	// ============================================================
	// Resolutions (within a meeting + form dialog)
	// ============================================================
	"resolutions.title": "Resolutions",
	"resolutions.empty": "No resolutions recorded yet.",
	"resolutions.table.number": "No.",
	"resolutions.table.title": "Title",
	"resolutions.table.result": "Result",
	"resolutions.confirm.delete": "Really delete resolution \"{title}\"?",
	"resolutions.actions.create": "Record resolution",
	"resolutions.dialog.createTitle": "New resolution",
	"resolutions.dialog.editTitle": "Edit resolution",
	"resolutions.dialog.description": "Added to the immutable resolution collection (§ 24 para. 6 German WEG Act) with a sequential number.",
	"resolutions.fields.agendaItem": "Agenda item",
	"resolutions.agendaItemNone": "None",
	"resolutions.fields.title": "Title",
	"resolutions.fields.content": "Resolution text",
	"resolutions.fields.resolvedAt": "Resolution date",
	"resolutions.fields.votingResult": "Result",
	"resolutions.fields.votesFor": "Yes votes",
	"resolutions.fields.votesAgainst": "No votes",
	"resolutions.fields.votesAbstained": "Abstentions",
	// Server action error messages
	"resolutions.errors.requiredFields": "Please provide title, resolution text and resolution date.",
	"resolutions.errors.invalidVotingResult": "Invalid voting result.",
	"resolutions.errors.saveFailed": "The resolution could not be saved.",
	"resolutions.errors.notFound": "The resolution was not found.",
	"resolutions.errors.deleteOnlyLast":
		"Only the most recently recorded resolution can be deleted to avoid gaps in the sequential resolution collection.",
	"resolutions.errors.deleteFailed": "The resolution could not be deleted.",

	// ============================================================
	// Resolution collection (/weg/beschluesse, § 24 para. 6 WEG Act)
	// ============================================================
	"collection.title": "Resolution collection",
	"collection.description": "Sequential resolution collection per HOA (§ 24 para. 6 German WEG Act).",
	"collection.info":
		"Complete, immutable resolution collection (§ 24 para. 6 German WEG Act) - each resolution receives a sequential number when recorded. The one-month contestation period (§ 45 German WEG Act) is calculated automatically for each resolution.",
	"collection.empty": "No resolutions recorded yet.",
	"collection.table.number": "No.",
	"collection.table.hoa": "HOA",
	"collection.table.title": "Title",
	"collection.table.meeting": "Meeting",
	"collection.table.result": "Result",
	"collection.table.contestableUntil": "Contestable until",
	"collection.contestableBadge": "Period running",
};
