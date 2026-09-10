/**
 * Namespace "settings" (Deutsch): Einstellungs-Seite inkl. aller Karten,
 * der Fehlertexte aus den zugehörigen Server Actions und der Backup-/
 * Upload-API-Routen.
 * Hinweis: Der Abschnitt "language" ist die Sprachwahl selbst (wird auch
 * vom LanguageSwitcher auf den Auth-Seiten verwendet).
 * Schlüssel-Parität mit Englisch wird per Typ (en-Datei) und
 * src/lib/i18n/messages.test.ts erzwungen.
 */
export const settings = {
	"language.title": "Sprache",
	"language.description": "Sprache der Benutzeroberfläche wählen. Die Einstellung gilt für dieses Gerät.",
	"language.label": "Sprache",

	// Seite (/einstellungen)
	title: "Einstellungen",
	description: "Absenderdaten für erzeugte PDFs, Datensicherung, Integrationen & KI und Sicherheit - thematisch gruppiert in Bereichen.",
	"tabs.allgemein": "Allgemein",
	"tabs.datensicherung": "Datensicherung",
	"tabs.integrationen": "Integrationen & KI",
	"tabs.sicherheit": "Sicherheit",
	integrationsHint: "Die App läuft vollständig offline. Alle Dienste in diesem Bereich sind optional und lassen sich einzeln einrichten.",

	// Geteilte Feld-/Status-Texte der Karten
	"fields.username": "Benutzername",
	"fields.password": "Passwort",
	"fields.port": "Port",
	"password.savedPlaceholder": "•••••••• (gespeichert, unverändert wenn leer)",
	"password.placeholderMin": "Passwort (min. {min} Zeichen)",
	"password.repeatPlaceholder": "Passwort wiederholen",
	"password.encryptToggle": "Mit Passwort verschlüsseln (.imbak)",
	"success.saved": "Die Einstellungen wurden gespeichert.",
	"errors.saveFailed": "Die Einstellungen konnten nicht gespeichert werden.",
	"errors.passwordTooShort": "Das Passwort muss mindestens {min} Zeichen lang sein.",
	"errors.passwordMismatch": "Die Passwörter stimmen nicht überein.",
	"errors.unknown": "Unbekannter Fehler",

	// Karte: Absenderdaten
	"cards.company.title": "Absenderdaten",
	"cards.company.description": "Diese Angaben erscheinen als Briefkopf auf erzeugten PDFs (aktuell: Nebenkostenabrechnungen).",
	"cards.company.name": "Name / Firma",
	"cards.company.namePlaceholder": "Max Mustermann Hausverwaltung",
	"cards.company.street": "Straße und Hausnummer",
	"cards.company.streetPlaceholder": "Musterstraße 1",
	"cards.company.zipCode": "PLZ",
	"cards.company.zipCodePlaceholder": "12345",
	"cards.company.city": "Ort",
	"cards.company.cityPlaceholder": "Musterstadt",
	"cards.company.additional": "Weitere Angaben",
	"cards.company.additionalPlaceholder": "z. B. Bankverbindung, Steuernummer, Kontaktdaten",
	"cards.company.additionalHint": "Wird unverändert am Ende des Briefkopfs von erzeugten PDFs ausgegeben (aktuell: Nebenkostenabrechnungen).",

	// Karte: Verbindung & Mehrbenutzer (nur Desktop-App)
	"cards.connection.title": "Verbindung & Mehrbenutzer",
	"cards.connection.description":
		"Betriebsmodus der App. Im Modus „Host“ wird die Datenbank anderen Arbeitsplätzen im lokalen Netzwerk bereitgestellt; im Modus „Client“ verbindet sich diese Installation mit einem Host (keine lokalen Daten).",
	"cards.connection.mode.local": "Lokal (nur dieser Rechner)",
	"cards.connection.mode.host": "Host (stellt Daten im Netzwerk bereit)",
	"cards.connection.mode.client": "Client (verbunden mit einem Host)",
	"cards.connection.notConfigured": "Nicht konfiguriert",
	"cards.connection.connected": "verbunden",
	"cards.connection.disconnected": "nicht verbunden",
	"cards.connection.localServer": "Lokaler Server: {url}",
	"cards.connection.hostUrl": "Host: {url}",
	"cards.connection.openSettings": "Verbindungseinstellungen öffnen",

	// Karte: Datensicherung (manueller Export/Import)
	"cards.backup.title": "Datensicherung",
	"cards.backup.description":
		"Sichert die komplette Anwendung (Datenbank + alle Dateien) als eine ZIP-Datei mit Prüfsummen - geeignet für Backups und den Umzug auf ein anderes Gerät. Optional mit Passwort verschlüsselt (AES-256).",
	"cards.backup.exportButton": "Backup exportieren ({extension})",
	"cards.backup.downloadButton": "Backup herunterladen (.zip)",
	"cards.backup.importButton": "Backup importieren",
	"cards.backup.importMode.replace": "Ersetzen (Bestand wird überschrieben)",
	"cards.backup.importMode.merge": "Zusammenführen (nur fehlende Einträge ergänzen)",
	"cards.backup.importMode.replaceUpper": "ERSETZT",
	"cards.backup.importMode.mergeUpper": "ZUSAMMENGEFÜHRT",
	"cards.backup.importPasswordPlaceholder": "Passwort (nur falls die Sicherung verschlüsselt ist)",
	"cards.backup.importHint":
		"Vor dem Import wird automatisch eine Sicherung des aktuellen Standes unter „backups/“ im Datenverzeichnis abgelegt. „Zusammenführen“ übernimmt nur Einträge, die lokal noch nicht existieren (vorhandene lokale Einträge bleiben unverändert). Verschlüsselte Sicherungen (.imbak) werden automatisch erkannt.",
	"cards.backup.desktopOnlyHint": "Import und verschlüsselter Export stehen in der Desktop-App zur Verfügung (nativer Dateidialog, automatische Vor-Sicherung).",
	"cards.backup.privacyHint":
		"Enthält personenbezogene Daten (Mieter, Eigentümer, Nutzer) - Sicherungsdatei sicher verwahren. Ein vergessenes Passwort kann nicht wiederhergestellt werden.",
	"cards.backup.importConfirm":
		"Sicherung wirklich importieren?\n\n{path}\n\nDer aktuelle Datenbestand wird {mode}. Vorher wird automatisch ein Backup des aktuellen Standes angelegt.",
	"cards.backup.exportSuccess": "Backup gespeichert ({count} Dateien): {path}",
	"cards.backup.exportSuccessEncrypted": "Verschlüsseltes Backup gespeichert ({count} Dateien): {path}",
	"cards.backup.exportFailed": "Export fehlgeschlagen.",
	"cards.backup.importSuccess": "Backup importiert. Die Seite wird neu geladen.",
	"cards.backup.importSuccessWithBackup": "Backup importiert. Sicherung des vorherigen Standes: {backupPath} Die Seite wird neu geladen.",
	"cards.backup.importFailed": "Import fehlgeschlagen.",

	// Karte: Dropbox-Backup (Cloud-Sicherung)
	"cards.dropbox.title": "Dropbox-Backup (Cloud-Sicherung)",
	"cards.dropbox.description":
		"Verbindet die App mit einem Dropbox-Konto und lädt die Datensicherung (Datenbank + alle Dateien) regelmäßig automatisch hoch - optional mit Passwort verschlüsselt wie beim manuellen Export.",
	"cards.dropbox.status.connection": "Verbindung",
	"cards.dropbox.status.connected": "Verbunden",
	"cards.dropbox.status.connectedAs": "Verbunden als {email}",
	"cards.dropbox.status.notConnected": "Nicht verbunden",
	"cards.dropbox.status.lastBackup": "Letzte erfolgreiche Sicherung",
	"cards.dropbox.status.lastBackupNever": "noch keine",
	"cards.dropbox.lastError": "Letzte Sicherung fehlgeschlagen: {error}",
	"cards.dropbox.lastErrorAt": "Letzte Sicherung fehlgeschlagen ({at}): {error}",
	"cards.dropbox.guide.title": "Anleitung: Dropbox-Backup einrichten",
	"cards.dropbox.guide.step1.title": "Dropbox-App anlegen (einmalig)",
	"cards.dropbox.guide.step1.part1": "Mit dem eigenen Dropbox-Konto auf",
	"cards.dropbox.guide.step1.part2":
		"anmelden und auf „Create app“ klicken. Dabei „Scoped access“ wählen, als Zugriffsbereich „App folder“ und einen beliebigen Namen vergeben, z. B. „ImmoBase-Sicherung“. Die Sicherungen landen später in genau diesem Ordner in der Dropbox.",
	"cards.dropbox.guide.step2.title": "Berechtigungen setzen",
	"cards.dropbox.guide.step2.part1": "In der neu angelegten App zum Reiter „Permissions“ wechseln und die Häkchen bei",
	"cards.dropbox.guide.step2.part2": "und",
	"cards.dropbox.guide.step2.part3": "setzen, dann unten auf „Submit“ klicken.",
	"cards.dropbox.guide.step3.title": "App-Schlüssel kopieren",
	"cards.dropbox.guide.step3.body": "Zurück im Reiter „Settings“ den „App key“ kopieren und unten im Feld „Dropbox-App-Schlüssel“ eintragen.",
	"cards.dropbox.guide.step4.title": "Konto verknüpfen",
	"cards.dropbox.guide.step4.body":
		"Auf „Mit Dropbox verbinden“ klicken: Es öffnet sich eine Dropbox-Seite im Browser. Dort anmelden, den Zugriff erlauben und den anschließend angezeigten Code hier einfügen.",
	"cards.dropbox.guide.step5.title": "Automatische Sicherung einrichten",
	"cards.dropbox.guide.step5.body":
		"Nach dem Verbinden Intervall und Aufbewahrung festlegen und auf Wunsch ein Passwort für die Verschlüsselung setzen. Die App lädt die Sicherung dann automatisch hoch, solange sie geöffnet ist - ohne Internetverbindung holt sie es beim nächsten Start nach.",
	"cards.dropbox.appKeyFromEnv": "Der Dropbox-App-Schlüssel ist per Umgebungsvariable (DROPBOX_APP_KEY) vorgegeben.",
	"cards.dropbox.appKeyLabel": "Dropbox-App-Schlüssel",
	"cards.dropbox.appKeyPlaceholder": "App-Schlüssel der eigenen Dropbox-App",
	"cards.dropbox.connect": "Mit Dropbox verbinden",
	"cards.dropbox.codePrompt": "1. Auf der geöffneten Dropbox-Seite den Zugriff erlauben. 2. Den dort angezeigten Code hier einfügen:",
	"cards.dropbox.codePlaceholder": "Autorisierungscode",
	"cards.dropbox.link": "Verknüpfen",
	"cards.dropbox.reopen": "Dropbox-Seite erneut öffnen",
	"cards.dropbox.enabledLabel": "Automatische Sicherung aktiviert (läuft, solange die App geöffnet ist)",
	"cards.dropbox.intervalLabel": "Intervall",
	"cards.dropbox.interval.daily": "Täglich",
	"cards.dropbox.interval.weekly": "Wöchentlich",
	"cards.dropbox.retentionLabel": "Aufbewahrung (Anzahl Sicherungen)",
	"cards.dropbox.passwordHint": "Ein vergessenes Passwort kann nicht wiederhergestellt werden - ohne Passwort lässt sich die Sicherung nicht einspielen.",
	"cards.dropbox.backupNow": "Jetzt sichern",
	"cards.dropbox.disconnect": "Verbindung trennen",
	"cards.dropbox.disconnectConfirm":
		"Dropbox-Verbindung wirklich trennen?\n\nEs werden dann keine automatischen Sicherungen mehr hochgeladen. Die Backup-Konfiguration bleibt erhalten.",
	"cards.dropbox.disconnectSuccess": "Die Dropbox-Verbindung wurde getrennt. Die Seite wird neu geladen.",
	"cards.dropbox.connectStarted": "Die Dropbox-Seite wurde im Browser geöffnet. Nach der Freigabe wird dort ein Code angezeigt - bitte hier einfügen.",
	"cards.dropbox.connectedSuccess": "Dropbox ist jetzt verbunden. Die Seite wird neu geladen.",
	"cards.dropbox.connectedSuccessAs": "Dropbox ist jetzt verbunden als {email}. Die Seite wird neu geladen.",
	"cards.dropbox.backupUploaded": "Die Sicherung wurde hochgeladen.",
	"cards.dropbox.backupUploadedReload": "{message} Die Seite wird neu geladen.",
	"cards.dropbox.backupRunFailed": "Das Dropbox-Backup konnte nicht ausgeführt werden.",
	"cards.dropbox.footerHint":
		"Die Sicherung enthält personenbezogene Daten (Mieter, Eigentümer, Nutzer) - sie liegt zusätzlich zur lokalen Datei in der Dropbox des verbundenen Kontos. Verbindung und Upload laufen über die offizielle Dropbox-API; ohne Internetverbindung werden Sicherungen beim nächsten Start nachgeholt.",
	"cards.dropbox.footerHintSince":
		"Die Sicherung enthält personenbezogene Daten (Mieter, Eigentümer, Nutzer) - sie liegt zusätzlich zur lokalen Datei in der Dropbox des verbundenen Kontos. Verbindung seit {since} und Upload laufen über die offizielle Dropbox-API; ohne Internetverbindung werden Sicherungen beim nächsten Start nachgeholt.",
	// Server Actions (dropbox-actions.ts)
	"cards.dropbox.errors.appKeyMissing": "Bitte zuerst den Dropbox-App-Schlüssel eintragen (siehe Hinweis im Formular).",
	"cards.dropbox.errors.connectStartFailed": "Der Verbindungsvorgang konnte nicht gestartet werden.",
	"cards.dropbox.errors.codeMissing": "Bitte den von Dropbox angezeigten Code eingeben.",
	"cards.dropbox.errors.connectCompleteFailed": "Die Verbindung konnte nicht abgeschlossen werden.",
	"cards.dropbox.errors.disconnectFailed": "Die Verbindung konnte nicht getrennt werden.",
	"cards.dropbox.errors.passwordRequired": "Bitte ein Passwort für die Verschlüsselung vergeben (min. 8 Zeichen).",
	"cards.dropbox.errors.notConnected": "Dropbox ist nicht verbunden - bitte zuerst das Konto verbinden.",
	"cards.dropbox.errors.backupFailed": "Das Dropbox-Backup ist fehlgeschlagen: {error}",
	"cards.dropbox.success.backupUploaded": "Die Sicherung „{fileName}“ wurde nach Dropbox hochgeladen.",

	// Karte: E-Mail-Versand (SMTP)
	"cards.smtp.title": "E-Mail-Versand (SMTP, optional)",
	"cards.smtp.description": "Ausgehende E-Mails (Verifizierung, Passwort-Reset, Ticket-Antworten) über einen eigenen SMTP-Server versenden.",
	"cards.smtp.host": "SMTP-Server",
	"cards.smtp.from": "Absenderadresse",
	"cards.smtp.secure": "SSL/TLS (Port 465)",
	"cards.smtp.hint": "Ohne SMTP-Konfiguration sind alle E-Mail-Funktionen (Verifizierung, Passwort-Reset) deaktiviert.",

	// Karte: E-Mail-Postfach (IMAP)
	"cards.imap.title": "E-Mail-Postfach (IMAP, optional)",
	"cards.imap.description": "Eingehende E-Mails für das Ticket-System abrufen (Postfach mit Umwandlung in Tickets).",
	"cards.imap.host": "IMAP-Server",
	"cards.imap.mailbox": "Postfach-Ordner",
	"cards.imap.secure": "SSL/TLS (Port 993)",
	"cards.imap.hint":
		"Ohne IMAP-Konfiguration ist das Postfach deaktiviert - das Ticket-System funktioniert dann weiterhin mit manuell angelegten Tickets und internen Notizen.",
	"cards.imap.testConnection": "Verbindung testen",
	"cards.imap.testFailed": "Verbindung fehlgeschlagen: {error}",
	"cards.imap.testSuccess": "Die Verbindung zum IMAP-Server war erfolgreich.",

	// Karte: Postversand (LetterXpress)
	"cards.letterxpress.title": "Postversand (LetterXpress, optional)",
	"cards.letterxpress.description": "PDF-Dokumente (z. B. Abrechnungen) als physische Briefe über die LetterXpress-API versenden.",
	"cards.letterxpress.apiKey": "API-Schlüssel",
	"cards.letterxpress.mode": "Modus",
	"cards.letterxpress.mode.test": "Test (kein echter Versand, Aufträge landen nur in der LetterXpress-Postbox)",
	"cards.letterxpress.mode.live": "Live (echter, kostenpflichtiger Versand)",
	"cards.letterxpress.hint": "Ohne Zugangsdaten sind die Postversand-Schaltflächen deaktiviert.",

	// Karte: MCP-Server (KI-Zugriff)
	"cards.mcp.title": "MCP-Server (KI-Zugriff)",
	"cards.mcp.description":
		"Aktiviert einen MCP-Endpunkt (Model Context Protocol), über den KI-Assistenten (z. B. Claude) die Daten der Anwendung lesen, anlegen, bearbeiten und löschen können. Standardmäßig deaktiviert.",
	"cards.mcp.statusLabel": "Status",
	"cards.mcp.status.enabled": "Aktiviert - Endpunkt erreichbar",
	"cards.mcp.status.disabled": "Deaktiviert",
	"cards.mcp.endpoint": "Endpunkt (URL)",
	"cards.mcp.adminToken": "Admin-Token (Vollzugriff)",
	"cards.mcp.userToken": "Nutzer-Token (eingeschränkt)",
	"cards.mcp.tokenSet": "eingerichtet",
	"cards.mcp.tokenNotSet": "noch nicht erzeugt",
	"cards.mcp.enable": "MCP-Server aktivieren",
	"cards.mcp.disable": "MCP-Server deaktivieren",
	"cards.mcp.enabledSuccess": "Der MCP-Server wurde aktiviert. Die Seite wird neu geladen.",
	"cards.mcp.disabledSuccess": "Der MCP-Server wurde deaktiviert. Bestehende Tokens verlieren sofort ihre Wirkung.",
	"cards.mcp.adminTokenDescription": "Alle Werkzeuge inkl. Administration (Nutzerverwaltung, Absenderdaten).",
	"cards.mcp.userTokenDescription": "Nur fachliche Werkzeuge - entspricht den Rechten eines normalen Nutzers der App.",
	"cards.mcp.warning":
		"Das Admin-Token gewährt vollständigen Lese- UND Schreibzugriff auf alle Daten inkl. Administrations-Funktionen - behandeln Sie es wie ein Administrator-Passwort. Das Nutzer-Token ist für KI-Clients normaler Nutzer gedacht (keine Administrations-Funktionen, aber ebenfalls Lese-/Schreibzugriff auf die Fachdaten inkl. Löschen und Finalisieren). Geben Sie Token nur an vertrauenswürdige KI-Clients weiter. Der Zugriff erfolgt lokal über diese App (im Mehrbenutzer-Betrieb zusätzlich durch das LAN-Zugangs-Token geschützt).",
	"cards.mcp.tokenKind.ADMIN": "Admin-Token",
	"cards.mcp.tokenKind.USER": "Nutzer-Token",
	"cards.mcp.token.show": "Token anzeigen",
	"cards.mcp.token.hide": "Token ausblenden",
	"cards.mcp.token.regenerate": "Neues Token erzeugen",
	"cards.mcp.token.regenerateConfirm":
		"Neues Zugriffs-Token erzeugen?\n\nDas bisherige Token verliert sofort seine Wirkung - verbundene KI-Clients müssen anschließend mit dem neuen Token konfiguriert werden.",
	"cards.mcp.token.regenerated": "Ein neues Token wurde erzeugt und wird unten angezeigt.",
	"cards.mcp.token.readFailed": "Das MCP-Token konnte nicht gelesen werden.",
	"cards.mcp.token.regenerateFailed": "Das MCP-Token konnte nicht neu erzeugt werden.",
	"cards.mcp.token.copy": "Kopieren",
	"cards.mcp.token.copied": "Kopiert",
	"cards.mcp.token.copyFailed": "Kopieren in die Zwischenablage ist fehlgeschlagen.",
	"cards.mcp.token.configExample": "Beispiel-Konfiguration für MCP-Clients (Token einsetzen):",
	"cards.mcp.errors.saveFailed": "Die MCP-Einstellung konnte nicht gespeichert werden.",
	"cards.mcp.errors.unknownTokenKind": "Unbekannte Token-Stufe.",
	"cards.mcp.errors.tokenMissing": "Es ist noch kein {kind} vorhanden - MCP-Server zuerst aktivieren.",

	// Karte: Anwendung zurücksetzen
	"cards.reset.title": "Anwendung zurücksetzen",
	"cards.reset.description":
		"Löscht die komplette Datenbank (inkl. Benutzerkonten und Einstellungen), alle abgelegten Dateien und die lokal gespeicherten Sicherungen unwiderruflich und versetzt die Anwendung in den Auslieferungszustand. Falls Sie die Daten später noch benötigen, exportieren Sie vorher ein Backup über die Datensicherung.",
	"cards.reset.button": "Anwendung zurücksetzen …",
	"cards.reset.dialogTitle": "Anwendung endgültig zurücksetzen?",
	"cards.reset.dialogDescription": "Diese Aktion kann nicht rückgängig gemacht werden.",
	"cards.reset.doneTitle": "Anwendung zurückgesetzt",
	"cards.reset.redirecting": "Sie werden zur Ersteinrichtung weitergeleitet …",
	"cards.reset.deletedIntro": "Folgende Daten werden unwiderruflich gelöscht:",
	"cards.reset.deletedDatabase": "die gesamte Datenbank: Liegenschaften, Einheiten, Mieter, Verträge, Tickets, Finanzen, Abrechnungen, WEG-Verwaltung, Dokumente, Vorlagen",
	"cards.reset.deletedAccounts": "alle Benutzerkonten, Freigaben und Sitzungen (alle Nutzer werden abgemeldet)",
	"cards.reset.deletedSettings": "alle Einstellungen inkl. gespeicherter Zugangsdaten (SMTP, LetterXpress, Dropbox)",
	"cards.reset.deletedFiles": "alle abgelegten Dateien (Uploads und erzeugte Dokumente)",
	"cards.reset.deletedBackups": "die lokal gespeicherten Sicherungen (backups/)",
	"cards.reset.confirmLabel": "Zur Bestätigung bitte exakt „{phrase}“ eingeben",
	"cards.reset.confirmMismatch": "Bitte geben Sie zur Bestätigung exakt „{phrase}“ ein.",
	"cards.reset.confirmButton": "Endgültig löschen",
	"cards.reset.failed": "Die Anwendung konnte nicht vollständig zurückgesetzt werden (Details im Server-Log).",
	"cards.reset.success": "Die Anwendung wurde zurückgesetzt.",

	// Karte: Lokale Datenverschlüsselung
	"cards.security.title": "Lokale Datenverschlüsselung",
	"cards.security.description":
		"Dateien und gespeicherte Zugangsdaten (z. B. SMTP-Passwort) werden auf diesem Gerät verschlüsselt abgelegt (AES-256). Der Schlüssel ist an dieses Gerät gebunden: {keySource}.",
	"cards.security.keySource.systemKeychain": "Schlüsselbund des Betriebssystems (Desktop-App)",
	"cards.security.keySource.keyFile": "Schlüsseldatei im Datenverzeichnis (Entwicklung)",
	"cards.security.database": "Datenbank",
	"cards.security.database.encrypted": "verschlüsselt abgelegt (Ruhezustand)",
	"cards.security.database.unlocked": "aktiv entsperrt - wird beim Beenden der App verschlüsselt",
	"cards.security.files": "Dateien in der Ablage",
	"cards.security.files.none": "keine vorhanden",
	"cards.security.secrets": "Gespeicherte Zugangsdaten",
	"cards.security.secrets.none": "keine konfiguriert",
	"cards.security.countEncrypted": "{encrypted} von {total} verschlüsselt",
	"cards.security.countPlain": "{plaintext} von {total} noch unverschlüsselt",
	"cards.security.encryptNow": "Bestandsdateien jetzt verschlüsseln",
	"cards.security.encryptSuccess": "{count} Datei(en) wurden verschlüsselt.",
	"cards.security.encryptNone": "Alle Dateien waren bereits verschlüsselt.",
	"cards.security.encryptRunFailed": "Die Dateiverschlüsselung konnte nicht ausgeführt werden.",
	"cards.security.encryptFailedCount": "{count} Datei(en) konnten nicht verschlüsselt werden (Details im Server-Log).",
	"cards.security.recoveryKey.show": "Wiederherstellungsschlüssel anzeigen",
	"cards.security.recoveryKey.hide": "Wiederherstellungsschlüssel ausblenden",
	"cards.security.recoveryKey.readFailed": "Der Wiederherstellungsschlüssel konnte nicht gelesen werden.",
	"cards.security.recoveryKey.hint":
		"Den Schlüssel wie ein Passwort sicher verwahren und niemandem zeigen: Er entschlüsselt sämtliche Dateien und gespeicherten Zugangsdaten dieses Geräts. Er wird benötigt, falls der Schlüsselbund des Betriebssystems verloren geht (z. B. nach einer Neuinstallation ohne Datensicherung).",
	"cards.security.databaseNote":
		"Hinweis: Die Datenbank liegt nur im beendeten Zustand als verschlüsselter Container vor - während die App läuft (und nach einem Absturz ohne sauberes Beenden) ist sie entsperrt. Für vollständigen Schutz in diesen Zuständen wird zusätzlich die Festplattenverschlüsselung des Betriebssystems (FileVault/BitLocker/LUKS) empfohlen.",

	// Karte: KI-Assistent (OpenAI-kompatibel)
	"cards.ai.title": "KI-Assistent (OpenAI-kompatibel)",
	"cards.ai.description":
		"Verbindet den KI-Assistenten (Sprechblase in der Sidebar) mit einem OpenAI-kompatiblen Chat-Endpunkt - z. B. OpenAI, ein kompatibles Gateway oder ein lokaler Server (LM Studio, Ollama). Der Assistent kann über die Werkzeuge des MCP-Servers Daten der Anwendung lesen und ändern. Ohne Konfiguration ist die Sprechblase deaktiviert.",
	"cards.ai.statusLabel": "Status",
	"cards.ai.status.configured": "Konfiguriert - Assistent freigegeben",
	"cards.ai.status.notConfigured": "Nicht konfiguriert - Assistent deaktiviert",
	"cards.ai.apiKeyStatus": "API-Schlüssel",
	"cards.ai.apiKeyStatus.set": "hinterlegt",
	"cards.ai.apiKeyStatus.notSet": "nicht hinterlegt (optional)",
	"cards.ai.guide.title": "Anleitung: KI-Assistenten einrichten",
	"cards.ai.guide.step1.title": "Anbieter wählen",
	"cards.ai.guide.step1.body":
		"Entweder ein KI-Anbieter in der Cloud (z. B. OpenAI - kostenpflichtig nach Verbrauch) oder ein lokales Modell auf diesem Rechner (z. B. mit LM Studio oder Ollama - kostenlos, die Daten bleiben auf dem eigenen Gerät).",
	"cards.ai.guide.step2.title": "Zugang vorbereiten",
	"cards.ai.guide.step2.openai.part1": "Auf",
	"cards.ai.guide.step2.openai.part2": "unter „API keys“ einen neuen Schlüssel erzeugen (beginnt mit „sk-…“).",
	"cards.ai.guide.step2.lmStudio.part1": "Programm installieren, ein Modell herunterladen und darin den lokalen Server starten (Standard-Adresse:",
	"cards.ai.guide.step2.lmStudio.part2": ").",
	"cards.ai.guide.step3.title": "Basis-URL und Modell eintragen",
	"cards.ai.guide.step3.andExample": "und z. B.",
	"cards.ai.guide.step3.lmStudio": ". LM Studio:",
	"cards.ai.guide.step3.modelName": "und den Namen des geladenen Modells.",
	"cards.ai.guide.step3.toolCalling":
		"Wichtig: Das Modell muss Werkzeug-Aufrufe (Function/Tool-Calling) unterstützen - sonst kann der Assistent nicht auf die App-Daten zugreifen.",
	"cards.ai.guide.step4.title": "API-Schlüssel eintragen",
	"cards.ai.guide.step4.body": "Bei OpenAI den erzeugten Schlüssel einfügen (wird verschlüsselt gespeichert). Bei einem lokalen Server das Feld einfach leer lassen.",
	"cards.ai.guide.step5.title": "Speichern und ausprobieren",
	"cards.ai.guide.step5.body": "Nach dem Speichern wird die Sprechblase unten in der Seitenleiste aktiv. Ein erster Test: „Welche Liegenschaften sind angelegt?“",
	"cards.ai.baseUrl": "Basis-URL des Endpunkts",
	"cards.ai.baseUrlHint": "Ohne Pfad „/chat/completions“ - dieser wird automatisch angehängt. Basis-URL und Modell gemeinsam leeren, um den Assistenten zu deaktivieren.",
	"cards.ai.model": "Modell",
	"cards.ai.modelHint":
		"Das Modell muss Werkzeug-Aufrufe (Function/Tool-Calling) unterstützen, damit der Assistent auf die App-Daten zugreifen kann. Für angehängte Bilder ist zusätzlich ein multimodales („vision“-fähiges) Modell nötig.",
	"cards.ai.apiKey": "API-Schlüssel (optional)",
	"cards.ai.apiKeyPlaceholderSet": "hinterlegt - leer lassen, um ihn beizubehalten",
	"cards.ai.apiKeyHint": "Wird verschlüsselt gespeichert. Lokale Endpunkte (z. B. LM Studio, Ollama) kommen meist ohne Schlüssel aus.",
	"cards.ai.savedReload": "Gespeichert. Die Seite wird neu geladen.",
	"cards.ai.warning":
		"Der Assistent erhält über die MCP-Werkzeuge Lese- UND Schreibzugriff auf die Daten (inkl. Löschen und Finalisieren) und steht allen angemeldeten Nutzern offen - normale Nutzer dabei ohne Administrations-Funktionen (Nutzerverwaltung, Absenderdaten). Anfragen samt anfragbarem Datenbestand werden an den konfigurierten Endpunkt übertragen: Nutzen Sie einen Anbieter, dem Sie Ihre Daten anvertrauen wollen (alternativ ein lokales Modell).",
	"cards.ai.errors.invalidBaseUrl": "Die Basis-URL muss mit http:// oder https:// beginnen (z. B. https://api.openai.com/v1).",
	"cards.ai.errors.modelRequired": "Bitte geben Sie auch ein Modell an (z. B. gpt-4o-mini).",
	"cards.ai.errors.baseUrlRequired": "Bitte geben Sie auch die Basis-URL an (oder beide Felder leeren, um den KI-Assistenten zu deaktivieren).",
	"cards.ai.errors.saveFailed": "Die KI-Einstellungen konnten nicht gespeichert werden.",

	// Backup-API-Routen (/api/backup/*)
	"backup.errors.invalidRequest": "Ungültige Anfrage.",
	"backup.errors.targetPathMissing": "Zielpfad fehlt.",
	"backup.errors.pathMissing": "Pfad zur Sicherungsdatei fehlt.",
	"backup.errors.exportFailed": "Export fehlgeschlagen: {error}",
	"backup.errors.importFailed": "Import fehlgeschlagen: {error}",

	// Upload-Auslieferung (/api/uploads/*)
	"uploads.errors.notFound": "Datei nicht gefunden.",
};
