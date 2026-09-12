/**
 * Namespace "setup" (Deutsch): Ersteinrichtungs-Wizard (/setup) inkl. der
 * Fehlertexte aus den zugehörigen Server Actions.
 * Schlüssel-Parität mit Englisch wird per Typ (en-Datei) und
 * src/lib/i18n/messages.test.ts erzwungen.
 */
export const setup = {
	// Seiten-Titel (Browser-Tab via generateMetadata)
	"meta.title": "Ersteinrichtung – ImmoBase",
	// Schritt-Leiste
	"steps.welcome": "Willkommen",
	"steps.mode": "Betriebsmodus",
	"steps.company": "Absenderdaten",
	"steps.integrations": "Online-Integrationen",
	"steps.recoveryKey": "Wiederherstellungsschlüssel",
	"steps.account": "Administratorkonto",
	"progress.stepOf": "Schritt {step} von {total}: {title}",
	// Schritt 1: Willkommen
	"welcome.title": "Willkommen bei ImmoBase",
	"welcome.description": "Die Ersteinrichtung führt Sie in wenigen Schritten durch die Grundeinstellungen der App.",
	"welcome.offline": "ImmoBase läuft vollständig offline – alle Daten bleiben auf diesem Rechner.",
	"welcome.stepsIntro": "Die folgenden Schritte richten die App ein:",
	"welcome.itemMode": "Betriebsmodus (Lokal/Host/Client – Desktop-App)",
	"welcome.itemCompany": "Absenderdaten für erzeugte PDFs (optional)",
	"welcome.itemIntegrations": "Online-Integrationen (Überblick – die Einrichtung erfolgt später unter „Einstellungen“)",
	"welcome.itemRecoveryKey": "Wiederherstellungsschlüssel der lokalen Datenverschlüsselung sichern (erforderlich)",
	"welcome.itemAccount": "Ihr Administratorkonto (erforderlich)",
	"welcome.optionalHint": "Optionale Schritte können übersprungen und jederzeit unter „Einstellungen“ nachgeholt werden.",
	"welcome.start": "Einrichtung starten",
	// Schritt 2: Betriebsmodus (Titel = steps.mode)
	"mode.description":
		"Wie möchten Sie ImmoBase nutzen? Die Wahl ist später jederzeit unter „Einstellungen“ → „Verbindung & Mehrbenutzer“ änderbar.",
	"mode.options.local.title": "Lokal (Standard)",
	"mode.options.local.description": "Nur dieser Rechner. Alle Daten bleiben hier.",
	"mode.options.host.title": "Host",
	"mode.options.host.description": "Dieser Rechner stellt die Daten im lokalen Netzwerk bereit.",
	"mode.options.client.title": "Client",
	"mode.options.client.description": "Mit einem Host im lokalen Netzwerk verbinden (keine lokalen Daten).",
	"mode.browserHint":
		"Die Modus-Auswahl steht nur in der Desktop-App zur Verfügung – im Browser läuft ImmoBase immer lokal auf diesem Rechner.",
	"mode.hostHint":
		"Die Datenbank liegt immer auf der lokalen Festplatte des Hosts – niemals auf einem Netzlaufwerk (SMB/NFS). Clients benötigen die Adresse des Hosts und das Zugangs-Token.",
	"mode.clientHint":
		"Im Client-Modus werden auf diesem Gerät keine Daten gespeichert. Nach der Auswahl öffnet sich die Verbindungsseite, auf der Sie den Host auswählen und das Zugangs-Token eingeben. Die übrigen Einrichtungsschritte entfallen auf diesem Gerät – sie werden auf dem Host durchgeführt.",
	// Schritt 3: Absenderdaten (Titel = steps.company)
	"company.description":
		"Diese Angaben erscheinen als Briefkopf auf erzeugten PDFs (z. B. Nebenkostenabrechnungen). Optional – jederzeit unter „Einstellungen“ nachpflegbar.",
	"company.skip": "Überspringen",
	"company.saveAndNext": "Speichern und weiter",
	"fields.name": "Name / Firma",
	"fields.namePlaceholder": "Max Mustermann Hausverwaltung",
	"fields.street": "Straße und Hausnummer",
	"fields.streetPlaceholder": "Musterstraße 1",
	"fields.zipCode": "PLZ",
	"fields.city": "Ort",
	"fields.cityPlaceholder": "Musterstadt",
	"fields.additional": "Weitere Angaben",
	"fields.additionalPlaceholder": "z. B. Bankverbindung, Steuernummer, Kontaktdaten",
	// Schritt 4: Online-Integrationen (Hinweisschritt)
	"integrations.title": "Online-Integrationen (optional)",
	"integrations.description":
		"ImmoBase läuft vollständig offline – alle Daten bleiben auf diesem Rechner. Die folgenden optionalen Dienste richten Sie bei Bedarf nach der Einrichtung unter „Einstellungen“ ein.",
	"integrations.groupIntegrations": "Einstellungen → „Integrationen & KI“",
	"integrations.itemSmtp": "E-Mail-Versand (SMTP) – z. B. für Verifizierungs- und Ticket-E-Mails",
	"integrations.itemImap": "E-Mail-Postfach (IMAP) – eingehende E-Mails im Ticket-System",
	"integrations.itemLetterxpress": "Postversand (LetterXpress) – PDFs (z. B. Abrechnungen) als physische Briefe",
	"integrations.itemAi": "KI-Assistent – Chatbot in der Sidebar, KI-Rechenkraft über unseren Partner arbeitskraft.app (Einrichtung nur mit API-Schlüssel)",
	"integrations.itemMcp": "MCP-Server – lesender und schreibender Zugriff externer KI-Clients auf die Fachdaten",
	"integrations.groupBackup": "Einstellungen → „Datensicherung“",
	"integrations.itemDropbox": "Dropbox-Backup – automatische, optional passwortgeschützte Cloud-Sicherung",
	"integrations.smtpHint":
		"Ohne SMTP-Konfiguration sind alle E-Mail-Funktionen (Verifizierung, Passwort-Reset) deaktiviert – das Ticket-System und alle übrigen Funktionen laufen uneingeschränkt offline.",
	// Schritt 5: Wiederherstellungsschlüssel
	"recovery.title": "Wiederherstellungsschlüssel sichern",
	"recovery.description":
		"ImmoBase verschlüsselt Ihre Datenbank, abgelegte Dateien und gespeicherte Zugangsdaten auf diesem Gerät (AES-256). Der Schlüssel dazu ist an dieses Gerät gebunden.",
	"recovery.explanation":
		"Mit dem folgenden Wiederherstellungsschlüssel können Sie Ihre Daten entschlüsseln, falls der Geräteschlüssel verloren geht (z. B. nach einer Neuinstallation des Betriebssystems). Verwahren Sie ihn wie ein Passwort an einem sicheren Ort – ohne ihn sind die verschlüsselten Daten in diesem Fall unwiederbringlich verloren. Wer den Schlüssel besitzt, kann sämtliche Daten entschlüsseln: zeigen Sie ihn niemandem.",
	"recovery.loading": "Schlüssel wird geladen …",
	"recovery.copy": "In die Zwischenablage kopieren",
	"recovery.copied": "Kopiert",
	"recovery.confirm":
		"Ich habe den Wiederherstellungsschlüssel sicher außerhalb dieses Geräts verwahrt (z. B. notiert oder in einem Passwort-Manager).",
	"recovery.laterHint": "Der Schlüssel ist später jederzeit unter „Einstellungen“ → „Lokale Datenverschlüsselung“ erneut einsehbar.",
	// Schritt 6: Administratorkonto (Feldlabels E-Mail/Passwort aus dem auth-Namespace)
	"account.title": "Administratorkonto anlegen",
	"account.description": "Zum Abschluss wird Ihr Benutzerkonto angelegt. Das erste Konto erhält automatisch Administrator-Rechte.",
	"account.submit": "Konto erstellen und Einrichtung abschließen",
	// Fehler der Server Actions und Schritte
	"errors.saveCompany": "Die Angaben konnten nicht gespeichert werden.",
	"errors.recoveryKeyRead": "Der Wiederherstellungsschlüssel konnte nicht gelesen werden.",
	"errors.modeApply": "Der Modus konnte nicht übernommen werden.",
	"errors.accountCreate": "Das Konto konnte nicht angelegt werden.",
};
