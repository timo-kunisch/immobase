/**
 * Namespace "tickets" (Deutsch): Instandhaltungs-Tickets (Kanban-Übersicht,
 * Detailseite mit Kommunikationsverlauf) und E-Mail-Postfach (IMAP-Eingang,
 * "mailbox.*"-Schlüssel) inkl. der Fehlertexte aus den Server Actions.
 * Schlüssel-Parität mit Englisch wird per Typ (en-Datei) und
 * src/lib/i18n/messages.test.ts erzwungen.
 */
export const tickets = {
	// Seitenkopf der Kanban-Übersicht
	title: "Tickets",
	description: "Schäden & Instandhaltung - optional einer Liegenschaft/Einheit zugeordnet.",
	// Kanban-Übersicht
	filteredBy: "Gefiltert nach:",
	empty: "Noch keine Tickets erfasst.",
	emptyColumn: "Keine Tickets",
	contractorLabel: "Handwerker:",
	// Ticket-Status (Enum-Labels)
	"status.OPEN": "Offen",
	"status.IN_PROGRESS": "In Bearbeitung",
	"status.DONE": "Erledigt",
	// Detailseite
	"detail.description": "Ticket-Details mit komplettem Kommunikationsverlauf.",
	"detail.backToList": "Zurück zur Übersicht",
	"detail.createdAt": "Erstellt am {date}",
	"detail.resolvedAt": "· Erledigt am {date}",
	// Kommunikationsverlauf
	"history.title": "Verlauf ({count})",
	"history.empty": "Noch keine Kommunikation vorhanden.",
	"history.addTitle": "Kommunikation hinzufügen",
	"history.outbound": "E-Mail gesendet",
	"history.inbound": "E-Mail empfangen",
	"history.internalBadge": "Intern",
	"history.unknownAuthor": "Unbekannt",
	"history.subjectTagHint":
		"Dem Betreff wird beim Versand automatisch die Ticket-Kennung {tag} angehängt - Antworten des Empfängers werden so beim nächsten Postfach-Abruf automatisch diesem Ticket zugeordnet.",
	"history.smtpDisabled":
		"E-Mail-Antworten sind deaktiviert, solange kein SMTP-Server konfiguriert ist (Einstellungen → Integrationen & KI).",
	// Interne Notiz (Verlauf-Eintrag und Formular)
	"note.label": "Interne Notiz",
	"note.placeholder": "Nur intern sichtbar - wird nicht versendet…",
	"note.submit": "Notiz hinzufügen",
	// E-Mail-Antwort-Formular
	"reply.toLabel": "E-Mail-Antwort an",
	"reply.toPlaceholder": "empfaenger@example.com",
	"reply.subjectLabel": "Betreff",
	"reply.messageLabel": "Nachricht",
	"reply.messagePlaceholder": "Antworttext…",
	"reply.submit": "E-Mail senden",
	// E-Mail-Metadaten (Empfänger-Adresse; Absender = common.from)
	"email.to": "An",
	"email.noSubject": "(ohne Betreff)",
	"email.noContent": "(kein Inhalt)",
	// Formular-Felder (Ticket-Dialog und Postfach-Umwandlung)
	"fields.title": "Titel",
	"fields.titlePlaceholder": "z. B. Heizung defekt",
	"fields.descriptionPlaceholder": "Was ist das Problem?",
	"fields.contractorNotes": "Handwerker-Notizen",
	"fields.contractorNotesPlaceholder": "Rückmeldung, Termine, Ersatzteile…",
	"fields.propertyPlaceholder": "Liegenschaft auswählen",
	"fields.noProperty": "Keine bestimmte Liegenschaft",
	"fields.noUnit": "Keine bestimmte Einheit",
	"fields.ticket": "Ticket",
	"fields.ticketPlaceholder": "Ticket auswählen",
	// Aktionen / Buttons
	"actions.new": "Neues Ticket",
	"actions.showHistory": "Verlauf anzeigen",
	"actions.unlink": "Zuordnung aufheben",
	"actions.unlinkTitle": "Zuordnung aufheben (zurück ins Postfach)",
	"actions.reassign": "Anderem Ticket zuordnen",
	"actions.assign": "Zuordnen",
	// Dialoge
	"dialog.editTitle": "Ticket bearbeiten",
	"dialog.formDescription": "Schäden oder Instandhaltungsaufgaben erfassen - optional einer Liegenschaft bzw. Einheit zugeordnet.",
	"dialog.reassignTitle": "E-Mail anderem Ticket zuordnen",
	"dialog.reassignDescription":
		"Die E-Mail „{subject}“ wird aus dem aktuellen Verlauf entfernt und dem ausgewählten Ticket zugeordnet.",
	// Bestätigungsdialoge
	"confirm.delete": 'Ticket "{title}" wirklich löschen?',
	"confirm.unlink": 'Zuordnung der E-Mail "{subject}" zu diesem Ticket aufheben? Sie erscheint wieder im Postfach.',
	// Erfolgsmeldungen
	"success.replySent": "Die E-Mail wurde versendet.",
	// Fehlermeldungen aus den Server Actions
	"errors.missingTitle": "Bitte vergeben Sie einen Titel.",
	"errors.saveFailed": "Das Ticket konnte nicht gespeichert werden.",
	"errors.statusFailed": "Status konnte nicht geändert werden.",
	"errors.deleteFailed": "Das Ticket konnte nicht gelöscht werden.",
	"errors.noteRequired": "Bitte geben Sie einen Notiztext ein.",
	"errors.ticketNotFound": "Das Ticket wurde nicht gefunden.",
	"errors.noteFailed": "Die Notiz konnte nicht gespeichert werden.",
	"errors.replyRequired": "Bitte füllen Sie Empfänger, Betreff und Nachricht aus.",
	"errors.smtpNotConfigured": "Der E-Mail-Versand ist nicht konfiguriert (SMTP, siehe Einstellungen).",
	"errors.replyFailed": "Die E-Mail konnte nicht versendet werden ({detail}).",
	"errors.emailNotFound": "Die E-Mail wurde nicht gefunden.",
	"errors.unlinkFailed": "Die Zuordnung konnte nicht aufgehoben werden.",
	"errors.selectTicket": "Bitte wählen Sie ein Ticket aus.",
	"errors.alreadyAssigned": "Die E-Mail ist bereits diesem Ticket zugeordnet.",
	"errors.targetTicketNotFound": "Das ausgewählte Ticket wurde nicht gefunden.",
	"errors.reassignFailed": "Die E-Mail konnte nicht neu zugeordnet werden.",
	// Postfach (IMAP-E-Mail-Eingang)
	"mailbox.title": "Postfach",
	"mailbox.description": "Eingehende E-Mails - in Tickets umwandeln oder an bestehende Tickets anheften.",
	"mailbox.notConfigured": "Das E-Mail-Postfach ist nicht konfiguriert.",
	"mailbox.notConfiguredHint1": "Ein Administrator kann unter",
	"mailbox.notConfiguredSettingsLink": "Einstellungen → Integrationen & KI",
	"mailbox.notConfiguredHint2":
		"einen IMAP-Server hinterlegen. Das Ticket-System funktioniert auch ohne Postfach (manuell angelegte Tickets und interne Notizen).",
	"mailbox.folder": "Ordner „{name}“",
	"mailbox.lastFetch": "Letzter Abruf",
	"mailbox.neverFetched": "Noch kein Abruf erfolgt",
	"mailbox.lastError": "Letzter Fehler",
	"mailbox.empty": "Keine neuen E-Mails im Postfach.",
	"mailbox.syncNow": "Jetzt abrufen",
	"mailbox.confirm.delete": 'E-Mail "{subject}" aus dem Postfach löschen? (Die Nachricht auf dem Server bleibt erhalten.)',
	"mailbox.actions.convert": "In Ticket umwandeln",
	"mailbox.actions.attach": "An Ticket anheften",
	"mailbox.dialog.convertTitle": "E-Mail in Ticket umwandeln",
	"mailbox.dialog.convertDescription": "Die E-Mail wird dem neuen Ticket als erster Verlauf-Eintrag zugeordnet.",
	"mailbox.dialog.convertSubmit": "Ticket anlegen",
	"mailbox.dialog.attachTitle": "E-Mail an Ticket anheften",
	"mailbox.dialog.attachDescription": "Die E-Mail erscheint im Verlauf des ausgewählten Tickets.",
	"mailbox.errors.syncFailed": "Abruf fehlgeschlagen: {detail}",
	"mailbox.errors.alreadyLinked": "Diese E-Mail ist bereits einem Ticket zugeordnet.",
	"mailbox.errors.convertFailed": "Die E-Mail konnte nicht in ein Ticket umgewandelt werden.",
	"mailbox.errors.linkFailed": "Die E-Mail konnte nicht zugeordnet werden.",
	"mailbox.errors.deleteFailed": "Die E-Mail konnte nicht gelöscht werden.",
	"mailbox.success.synced": "{imported} neue E-Mail(s) abgerufen{linked}.",
	"mailbox.success.syncedLinked": " ({count} automatisch einem Ticket zugeordnet)",
};
