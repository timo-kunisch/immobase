/**
 * Namespace "chat": KI-Assistent (Chatbot-Dialog im Sidebar-Footer).
 * Die Antworten des Modells selbst sind davon ausgenommen - sie kommen vom
 * konfigurierten KI-Endpunkt.
 */
export const chat = {
	title: "KI-Assistent",
	description:
		"Beantwortet Fragen zu Ihren Daten und kann auf Wunsch Änderungen vornehmen (über die Werkzeuge des MCP-Servers). Dateien (PDF, Office-Dokumente, Excel, Bilder, Text/Code) können angehängt werden.",
	disabledHint:
		"Der KI-Assistent ist deaktiviert - ein Administrator kann unter Einstellungen → KI-Assistent einen Endpunkt konfigurieren",
	loadingHistory: "Der gespeicherte Chatverlauf wird geladen…",
	emptyGreeting:
		"Stellen Sie eine Frage zu Ihren Daten oder bitten Sie um Änderungen,\nz. B. „Welche Mietverträge laufen 2026 aus?“ oder „Lege die Mieter aus der angehängten Excel-Tabelle an“.",
	emptyPersistenceHint: "Der Verlauf bleibt gespeichert, bis Sie ihn über den Papierkorb-Button löschen.",
	toolOk: "Werkzeug erfolgreich ausgeführt",
	toolFailed: "Werkzeug-Aufruf fehlgeschlagen",
	showFewerTools: "Weniger Werkzeug-Aufrufe anzeigen",
	showAllTools: "Alle {count} Werkzeug-Aufrufe anzeigen",
	showLessLabel: "weniger",
	loadFailed: "Der Chat-Verlauf konnte nicht geladen werden.",
	loadFailedHttp: "Der Chat-Verlauf konnte nicht geladen werden (HTTP {status}).",
	deleteFailed: "Der Chat-Verlauf konnte nicht gelöscht werden.",
	deleteFailedHttp: "Der Chat-Verlauf konnte nicht gelöscht werden (HTTP {status}).",
	requestFailed: "Die Anfrage ist fehlgeschlagen.",
	requestFailedHttp: "Die Anfrage ist fehlgeschlagen (HTTP {status}).",
	serverResponseSnippet: " Antwort des Servers: {snippet}",
	replyReady: "Die Antwort auf Ihre Nachricht ist fertig.",
	replyFailedPrefix: "Die Anfrage ist fehlgeschlagen: {message}",
	attachmentOnly: "(Datei-Anhang ohne Begleittext)",
	aiWorking: "Die KI arbeitet (Werkzeug-Aufrufe können einen Moment dauern)…",
	maxAttachments: "Es sind höchstens {max} Anhänge pro Nachricht erlaubt.",
	fileTooLarge: "Die Datei \"{name}\" ist zu groß ({size} - erlaubt sind höchstens {max}).",
	fileUnreadable: "Die Datei \"{name}\" konnte nicht gelesen werden.",
	hardLimitReached: "Der Chatverlauf hat die maximale Größe von {max} Zeichen erreicht ({current} Zeichen).",
	hardLimitHint: "Bevor Sie weitermachen können, muss der Verlauf gelöscht werden - der gesamte Verlauf wird bei jeder Nachricht an die KI mitgesendet.",
	clearingHistory: "Verlauf wird gelöscht…",
	clearHistoryNow: "Verlauf jetzt löschen",
	historyLarge: "Der Chatverlauf ist sehr groß geworden ({current} Zeichen).",
	historyLargeHint:
		"Da der gesamte Verlauf bei jeder Nachricht an die KI mitgesendet wird, steigt der Token-Verbrauch (und damit Kosten und Antwortzeit) spürbar. Es wird empfohlen, den Verlauf zu löschen und ein neues Gespräch zu beginnen. Ab {max} Zeichen wird das Fortsetzen gesperrt.",
	removeAttachment: "Anhang {name} entfernen",
	attachTitle: "Datei anhängen (PDF, Office, Excel, Bilder, Text/Code)",
	attachAria: "Datei anhängen",
	placeholderDefault: "Nachricht an die KI… (Enter sendet, Umschalt+Enter für Zeilenumbruch)",
	placeholderHardLimit: "Maximale Verlaufsgröße erreicht - bitte zuerst den Verlauf löschen.",
	sendTitle: "Senden",
	clearTitle: "Chatverlauf löschen (neues Gespräch beginnen)",
	clearAria: "Chatverlauf löschen",
	openChat: "Chat öffnen",
	closeNotice: "Benachrichtigung schließen",
	// Route /api/chat (+ /api/chat/history): Fehlermeldungen an den Client
	"route.unauthorized": "Nicht angemeldet.",
	"route.notConfigured": "Es ist kein KI-Endpunkt konfiguriert. Einrichtung: Einstellungen → KI-Assistent.",
	"route.invalidJson": "Der Request-Body ist kein gültiges JSON.",
	"route.bodyNotObject": "Der Request-Body muss ein JSON-Objekt sein.",
	"route.messageInvalid": "Erwartet wird eine nicht-leere Nachricht mit höchstens {max} Zeichen.",
	"route.attachmentsTooMany": "Erwartet werden höchstens {max} Datei-Anhänge.",
	"route.attachmentInvalid": "Ungültiges Anhang-Format.",
	"route.attachmentNameInvalid": "Ungültiger Dateiname im Anhang.",
	"route.attachmentTooLarge": "Der Anhang \"{name}\" ist zu groß oder beschädigt.",
	"route.hardLimit":
		"Der Chatverlauf hat die maximale Größe von {max} Zeichen erreicht. Bitte löschen Sie den Verlauf im Dialog (Papierkorb-Button), bevor Sie weitermachen.",
	"route.internalError": "Interner Fehler bei der Verarbeitung (Details im Server-Log).",
	"route.serverError": "Interner Serverfehler im Chat-Endpunkt (Details im Server-Log).",
	"route.historyLoadFailed": "Der Chat-Verlauf konnte nicht geladen werden (Details im Server-Log).",
	"route.historyDeleteFailed": "Der Chat-Verlauf konnte nicht gelöscht werden (Details im Server-Log).",
	// KI-Stack (src/lib/ai/*): Systemprompt + modell-interne Hinweise des
	// Tool-Loops sowie nutzersichtbare Fehler - sprachlich konsistent zur
	// gewählten App-Sprache (runChat erhält die Locale von der Chat-Route).
	"system.intro":
		"Du bist der KI-Assistent von ImmoBase, einer Desktop-Anwendung zur Miet- und WEG-Verwaltung (deutsches Mietrecht bzw. WEG i. d. F. der Reform 2020).",
	"system.access":
		"Du hast über die bereitgestellten Werkzeuge Lese- und Schreibzugriff auf die Live-Daten der Anwendung: Liegenschaften, Einheiten, Mieter, Verträge, Kautionen, Tickets, Dokumente, Finanzen, Nebenkostenabrechnungen, Dokumentvorlagen sowie die WEG-Verwaltung (Eigentümer, Eigentumsverhältnisse, Verteilerschlüssel, Wirtschaftspläne, Jahresabrechnungen, Hausgeld, Erhaltungsrücklage, Versammlungen, Beschluss-Sammlung).",
	"system.rulesHeader": "Verhaltensregeln:",
	"system.ruleLanguage": "- Antworte auf Deutsch, sachlich und prägnant. Fasse dich kurz; bei langen Ergebnissen nutze Listen/Tabellen.",
	"system.ruleTools":
		"- Nutze die Werkzeuge, um aktuelle Daten abzufragen, statt zu raten oder zu erfinden. IDs vorhandener Datensätze ermittelst du über die *_list-Werkzeuge (mit Filtern), Details über die *_get-Werkzeuge.",
	"system.ruleFormats":
		"- Geldbeträge sind Dezimal-Strings (\"123.45\"), Datumswerte ISO-8601 (\"2026-09-08\"). Die Werkzeuge akzeptieren bei Beträgen auch Komma-Schreibweise.",
	"system.ruleDestructive":
		"- Vor destruktiven oder unwiderruflichen Aktionen (Löschen, Finalisieren von Abrechnungen/Wirtschaftsplänen/Jahresabrechnungen) fasse die geplante Aktion samt betroffenen Datensätzen kurz zusammen und hole die ausdrückliche Bestätigung des Nutzers ein - es sei denn, der Nutzer hat die Aktion bereits eindeutig angefordert.",
	"system.ruleAttachments":
		"- Wenn der Nutzer Dateien anhängt (z. B. Excel-Tabellen, PDFs, Office-Dokumente), wird deren Inhalt als Text in seine Nachricht eingefügt; angehängte Bilder werden dir direkt als Bild-Input übergeben. Übernimm Daten aus den Anhängen gewissenhaft über die passenden *_create-Werkzeuge. Prüfe vor dem Anlegen, welche verknüpften Datensätze (z. B. Liegenschaft, Einheit) bereits existieren, und berichte abschließend knapp, was angelegt wurde und was nicht geklappt hat.",
	"system.ruleToolErrors": "- Melde Werkzeug-Fehler (isError/Fehlertext) ehrlich zurück und versuche nicht, sie zu verbergen.",
	"system.ruleUserScope":
		"- Der angemeldete Nutzer ist KEIN Administrator: Administrations-Funktionen (Nutzerverwaltung, Einstellungen wie die Absenderdaten) stehen nicht als Werkzeuge zur Verfügung. Weise bei entsprechenden Anfragen freundlich darauf hin, dass dafür ein Administratorkonto nötig ist.",
	"system.footer": "Aktuelles Datum: {today}. Angemeldeter Nutzer: {userEmail}.",
	"system.toolInvalidArgsDetail": "Ungültige Argumente (kein JSON) des Modells.",
	"system.toolInvalidArgsMessage": "Fehler: Die angeforderten Argumente sind kein gültiges JSON - bitte erneut versuchen.",
	"system.toolInternalError": "Interner Fehler bei der Ausführung (Details im Server-Log).",
	"system.toolErrorPrefix": "Fehler: {detail}",
	"system.toolResultTruncated":
		"[... gekürzt: Das Werkzeug-Ergebnis überschreitet die maximale Länge von {max} Zeichen. Nutze Filter oder *_get-Werkzeuge für gezieltere Abfragen. ...]",
	"client.unreachable":
		"Der KI-Endpunkt ({baseUrl}) ist nicht erreichbar. Bitte prüfen Sie die Konfiguration unter Einstellungen → KI-Assistent und ob der Dienst läuft.",
	"client.httpError": "Der KI-Endpunkt meldet HTTP {status}{hint}.",
	"client.httpErrorDetail": " Antwort: {detail}",
	"client.hintAuth": " (API-Schlüssel prüfen)",
	"client.hintNotFound": " (Basis-URL/Modell prüfen)",
	"client.hintTimeout":
		" (Timeout: Der Endpunkt hat die Antwort auch nach mehreren Versuchen nicht rechtzeitig geliefert - bitte erneut versuchen)",
	"client.invalidJson": "Der KI-Endpunkt hat keine gültige JSON-Antwort geliefert.",
	"client.unexpectedFormat": "Der KI-Endpunkt hat ein unerwartetes Antwortformat geliefert (keine choices[0].message).",
	"client.emptyReply": "Das Modell hat eine leere Antwort geliefert. Bitte versuchen Sie es erneut.",
	"attach.processingFailed": "Der Anhang \"{name}\" konnte nicht verarbeitet werden (Details im Server-Log).",
	"attach.markerBegin": "--- Beginn Datei-Anhang \"{name}\" ---",
	"attach.markerEnd": "--- Ende Datei-Anhang \"{name}\" ---",
	"attach.truncatedChars": "[... gekürzt: Der Anhang überschreitet die maximale Textlänge von {max} Zeichen ...]",
	"attach.excelUnreadable":
		"Die Datei \"{name}\" konnte nicht als Excel-Arbeitsmappe gelesen werden. Hinweis: Das alte .xls-Format wird nicht unterstützt - bitte in Excel als .xlsx speichern.",
	"attach.sheetHeader": "Tabellenblatt \"{sheet}\" ({rows} Zeilen{truncation}):",
	"attach.sheetTruncated": ", auf die ersten {max} Zeilen gekürzt",
	"attach.excelNoData": "Die Datei \"{name}\" enthält keine auswertbaren Tabellendaten.",
	"attach.pdfEngineUnavailable":
		"Die PDF-Unterstützung konnte nicht initialisiert werden (Details im Server-Log). Andere Dateitypen und der Chat ohne Anhang funktionieren weiterhin.",
	"attach.pdfOpenFailed": "Die PDF-Datei \"{name}\" konnte nicht geöffnet werden.",
	"attach.pageMarker": "--- Seite {page} ---",
	"attach.pdfNoText":
		"Die PDF-Datei \"{name}\" enthält keinen extrahierbaren Text (vermutlich ein Scan ohne Textebene). Hinweis: Als Workaround die PDF in Bilder umwandeln und diese anhängen.",
	"attach.pdfPagesTruncated": "[... gekürzt: Nur die ersten {max} von {total} Seiten wurden übernommen ...]",
	"attach.pdfPassword": "Die PDF-Datei \"{name}\" ist passwortgeschützt - bitte den Schutz entfernen und erneut anhängen.",
	"attach.pdfReadFailed": "Die PDF-Datei \"{name}\" konnte nicht gelesen werden (beschädigt oder kein gültiges PDF).",
	"attach.officeInvalid": "Die Datei \"{name}\" ist beschädigt oder keine gültige {extension}-Datei.",
	"attach.docxInvalid": "Die Datei \"{name}\" enthält kein word/document.xml - keine gültige DOCX-Datei.",
	"attach.slideMarker": "--- Folie {index} ---",
	"attach.pptxNoText": "Die Datei \"{name}\" enthält keinen extrahierbaren Folientext.",
	"attach.odfInvalid": "Die Datei \"{name}\" enthält kein content.xml - keine gültige OpenDocument-Datei.",
	"attach.officeReadFailed": "Die Datei \"{name}\" konnte nicht gelesen werden (beschädigtes Office-Dokument).",
	"attach.invalidBase64": "Der Anhang \"{name}\" ist beschädigt (ungültige Base64-Kodierung).",
	"attach.empty": "Der Anhang \"{name}\" ist leer.",
	"attach.tooLarge": "Der Anhang \"{name}\" ist zu groß ({size} MB - erlaubt sind höchstens {max} MB).",
	"attach.legacyXls":
		"Das alte .xls-Format (\"{name}\") wird nicht unterstützt - bitte in Excel als .xlsx speichern und erneut anhängen.",
	"attach.legacyOffice":
		"Das alte .{extension}-Format (\"{name}\") wird nicht unterstützt - bitte als .{extension}x speichern und erneut anhängen.",
	"attach.unsupportedType": "Der Dateityp von \"{name}\" wird nicht unterstützt. Erlaubt sind: {types}.",
	"attach.supportedTypesHint":
		"PDF, Word/PowerPoint/OpenDocument (.docx, .pptx, .odt, .ods, .odp), Excel (.xlsx), Bilder (.png, .jpg, .gif, .webp) sowie Text-/Datendateien (.csv, .txt, .md, .json, .xml, .log, Code-Dateien u. a.)",
	"attach.noTextExtracted": "Aus der Datei \"{name}\" konnte kein Text extrahiert werden (leer oder nur nicht-textuelle Inhalte).",
	"budget.warning":
		"System-Hinweis: Dir verbleiben nur noch {remaining} Werkzeug-Runden. Plane effizient: Bündele verbleibende Aufrufe und bringe die Aufgabe zeitnah zum Abschluss. Reicht das Budget erkennbar nicht aus, bereite stattdessen eine Zwischenbilanz vor: Was ist bereits erledigt, was bleibt offen?",
	"budget.exhaustedNote":
		"System-Hinweis: Das Werkzeug-Budget ist erschöpft - dir stehen keine weiteren Werkzeugaufrufe zur Verfügung. Antworte dem Nutzer jetzt abschließend: Fasse knapp zusammen, was du bereits erledigt bzw. herausgefunden hast, benenne konkret, was noch offen ist, und weise darauf hin, dass der Nutzer die Fortsetzung mit \"weiter\" (oder einer konkreten Folgeanweisung) anstoßen kann.",
	"budget.fallbackReply":
		"Das Werkzeug-Budget von {max} Runden ist erschöpft. Es wurden {total} Werkzeugaufrufe ausgeführt (davon {failed} fehlgeschlagen). Schreiben Sie \"weiter\", damit der Assistent fortfährt - oder formulieren Sie die Anfrage konkreter.",
};
