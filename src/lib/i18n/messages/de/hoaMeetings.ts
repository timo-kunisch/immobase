/**
 * Namespace "hoaMeetings" (Deutsch): Eigentümerversammlungen (Liste,
 * Detailseite mit Tagesordnung, Einladung, Beschlüssen und Protokoll),
 * die Beschluss-Sammlung (§ 24 Abs. 6 WEG) sowie die zugehörigen Dialoge
 * und die Meldungen der Server Actions. Die Inhalte der erzeugten PDFs
 * (Einladung/Protokoll) bleiben bewusst deutsch und liegen NICHT hier.
 * Schlüssel-Parität mit Englisch wird per Typ (en-Datei) und
 * src/lib/i18n/messages.test.ts erzwungen.
 */
export const hoaMeetings = {
	// Leerer Bestand (keine WEG angelegt)
	noHoas: "Legen Sie zuerst unter „WEG-Verwaltung“ eine WEG an.",

	// Versammlungsarten
	"meetingType.ORDINARY": "Ordentliche Versammlung",
	"meetingType.EXTRAORDINARY": "Außerordentliche Versammlung",
	"meetingType.CIRCULATION": "Umlaufbeschluss-Verfahren",
	// Versammlungs-Status
	"meetingStatus.PLANNED": "Geplant",
	"meetingStatus.INVITED": "Eingeladen",
	"meetingStatus.HELD": "Durchgeführt",
	"meetingStatus.MINUTES_FINALIZED": "Protokoll finalisiert",
	"meetingStatus.CANCELLED": "Abgesagt",
	// Abstimmungsergebnisse von Beschlüssen
	"votingResult.ACCEPTED": "Angenommen",
	"votingResult.REJECTED": "Abgelehnt",

	// ============================================================
	// Versammlungen (Liste + Formular-Dialog)
	// ============================================================
	"meetings.title": "Eigentümerversammlungen",
	"meetings.description": "Versammlungen je WEG.",
	"meetings.empty": "Noch keine Versammlungen angelegt.",
	// Tabellenköpfe
	"meetings.table.hoa": "WEG",
	"meetings.table.title": "Titel",
	"meetings.table.type": "Art",
	"meetings.table.date": "Termin",
	"meetings.details": "Details",
	// Lösch-Bestätigung (ConfirmDeleteButton)
	"meetings.confirm.delete": "Versammlung \"{title}\" wirklich löschen?",
	// Formular-Dialog (Anlegen/Bearbeiten)
	"meetings.actions.create": "Neue Versammlung",
	"meetings.dialog.createTitle": "Neue Eigentümerversammlung",
	"meetings.dialog.editTitle": "Versammlung bearbeiten",
	"meetings.dialog.description": "Ordentliche/außerordentliche Versammlung oder Umlaufbeschluss-Verfahren.",
	"meetings.fields.title": "Titel",
	"meetings.fields.type": "Art",
	"meetings.fields.meetingDate": "Termin",
	"meetings.fields.location": "Ort",
	"meetings.placeholder.title": "z. B. Eigentümerversammlung 2026",
	"meetings.placeholder.location": "z. B. Gemeinschaftsraum",
	// Fehlermeldungen der Server Actions
	"meetings.errors.titleRequired": "Bitte einen Titel für die Versammlung angeben.",
	"meetings.errors.saveFailed": "Die Versammlung konnte nicht gespeichert werden.",
	"meetings.errors.hasResolutions":
		"Diese Versammlung enthält bereits Beschlüsse und kann daher nicht mehr gelöscht werden (Beschluss-Sammlung, § 24 Abs. 6 WEG).",
	"meetings.errors.deleteFailed": "Die Versammlung konnte nicht gelöscht werden.",
	"meetings.errors.notFound": "Die Versammlung wurde nicht gefunden.",
	"meetings.errors.invalid": "Ungültige Versammlung.",

	// ============================================================
	// Tagesordnung (OwnerMeetingAgendaItem)
	// ============================================================
	"agenda.title": "Tagesordnung",
	"agenda.empty": "Noch keine Tagesordnungspunkte erfasst.",
	"agenda.table.number": "Nr.",
	"agenda.table.title": "Titel",
	"agenda.confirm.delete": "Tagesordnungspunkt \"{title}\" wirklich löschen?",
	"agenda.actions.create": "Tagesordnungspunkt",
	"agenda.dialog.createTitle": "Neuer Tagesordnungspunkt",
	"agenda.dialog.editTitle": "Tagesordnungspunkt bearbeiten",
	"agenda.fields.position": "Nr.",
	"agenda.fields.title": "Titel",
	// Fehlermeldungen der Server Actions
	"agenda.errors.titleRequired": "Bitte einen Titel für den Tagesordnungspunkt angeben.",
	"agenda.errors.saveFailed": "Der Tagesordnungspunkt konnte nicht gespeichert werden.",
	"agenda.errors.deleteFailed": "Der Tagesordnungspunkt konnte nicht gelöscht werden.",

	// ============================================================
	// Einladung / Protokoll (PDF-Erzeugung + Postversand)
	// ============================================================
	"invitation.title": "Einladung",
	"invitation.errors.generateFailed": "Die Einladung konnte nicht erzeugt werden.",
	"invitation.errors.saveFailed": "Die Einladung konnte nicht gespeichert werden.",
	"invitation.errors.pdfRequired": "Bitte erzeugen Sie zunächst die Einladung als PDF.",
	"minutes.title": "Protokoll",
	"minutes.placeholder": "Verlauf der Versammlung, Anwesenheit, Diskussionspunkte...",
	"minutes.actions.save": "Protokolltext speichern",
	"minutes.finalizedAt": "Protokoll finalisiert am {date}.",
	"minutes.errors.textRequired": "Bitte erfassen Sie zunächst den Protokolltext.",
	"minutes.errors.saveFailed": "Das Protokoll konnte nicht gespeichert werden.",
	"minutes.errors.generateFailed": "Das Protokoll konnte nicht erzeugt werden.",
	"minutes.errors.pdfRequired": "Bitte erzeugen Sie zunächst das Protokoll als PDF.",
	// "PDF erzeugen"-Button (GenerateMeetingPdfButton)
	"actions.generateInvitation": "Einladung erzeugen",
	"actions.generateMinutes": "Protokoll erzeugen",
	"actions.regenerate": "{label} erneuern",

	// ============================================================
	// Beschlüsse (innerhalb einer Versammlung + Formular-Dialog)
	// ============================================================
	"resolutions.title": "Beschlüsse",
	"resolutions.empty": "Noch keine Beschlüsse erfasst.",
	"resolutions.table.number": "Nr.",
	"resolutions.table.title": "Titel",
	"resolutions.table.result": "Ergebnis",
	"resolutions.confirm.delete": "Beschluss \"{title}\" wirklich löschen?",
	"resolutions.actions.create": "Beschluss erfassen",
	"resolutions.dialog.createTitle": "Neuer Beschluss",
	"resolutions.dialog.editTitle": "Beschluss bearbeiten",
	"resolutions.dialog.description":
		"Wird der unveränderlichen Beschluss-Sammlung (§ 24 Abs. 6 WEG) mit fortlaufender Nummer hinzugefügt.",
	"resolutions.fields.agendaItem": "Tagesordnungspunkt",
	"resolutions.agendaItemNone": "Keiner",
	"resolutions.fields.title": "Titel",
	"resolutions.fields.content": "Beschlusstext",
	"resolutions.fields.resolvedAt": "Beschlussdatum",
	"resolutions.fields.votingResult": "Ergebnis",
	"resolutions.fields.votesFor": "Ja-Stimmen",
	"resolutions.fields.votesAgainst": "Nein-Stimmen",
	"resolutions.fields.votesAbstained": "Enthaltungen",
	// Fehlermeldungen der Server Actions
	"resolutions.errors.requiredFields": "Bitte Titel, Beschlusstext und Beschlussdatum angeben.",
	"resolutions.errors.invalidVotingResult": "Ungültiges Abstimmungsergebnis.",
	"resolutions.errors.saveFailed": "Der Beschluss konnte nicht gespeichert werden.",
	"resolutions.errors.notFound": "Der Beschluss wurde nicht gefunden.",
	"resolutions.errors.deleteOnlyLast":
		"Nur der zuletzt erfasste Beschluss kann gelöscht werden, um Lücken in der fortlaufenden Beschluss-Sammlung zu vermeiden.",
	"resolutions.errors.deleteFailed": "Der Beschluss konnte nicht gelöscht werden.",

	// ============================================================
	// Beschluss-Sammlung (/weg/beschluesse, § 24 Abs. 6 WEG)
	// ============================================================
	"collection.title": "Beschluss-Sammlung",
	"collection.description": "Fortlaufende Beschluss-Sammlung je WEG (§ 24 Abs. 6 WEG).",
	"collection.info":
		"Vollständige, unveränderliche Beschluss-Sammlung (§ 24 Abs. 6 WEG) - jeder Beschluss erhält beim Erfassen eine fortlaufende Nummer. Die einmonatige Anfechtungsfrist (§ 45 WEG) wird je Beschluss automatisch berechnet.",
	"collection.empty": "Noch keine Beschlüsse erfasst.",
	"collection.table.number": "Nr.",
	"collection.table.hoa": "WEG",
	"collection.table.title": "Titel",
	"collection.table.meeting": "Versammlung",
	"collection.table.result": "Ergebnis",
	"collection.table.contestableUntil": "Anfechtbar bis",
	"collection.contestableBadge": "Frist läuft",
};
