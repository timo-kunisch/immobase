/**
 * Namespace "postal" (Deutsch): Postversand über LetterXpress
 * (SendByPostButton + src/lib/postal-shipments.ts). Die detaillierten
 * LetterXpress-Fehlergründe (technische Meldungen aus letterxpress.ts bzw.
 * der API) bleiben bewusst deutsch und werden nur als {reason}-Parameter
 * eingeblendet bzw. im Sendungsprotokoll (DB) gespeichert.
 */
export const postal = {
	sendByPost: "Per Post versenden",
	notConfiguredShort: "Postversand nicht eingerichtet (Einstellungen → Integrationen & KI)",
	"errors.notConfigured":
		"Der Postversand ist nicht eingerichtet. Bitte hinterlegen Sie die LetterXpress-Zugangsdaten unter Einstellungen → Integrationen & KI.",
	"errors.noPdf": "Für diese Quelle wurde kein versandfertiges PDF gefunden.",
	"errors.fileMissing": "Die PDF-Datei wurde in der Dateiablage nicht gefunden.",
	"errors.sendFailed": "Der Postversand ist fehlgeschlagen.",
	"errors.sendFailedWithReason": "Der Postversand ist fehlgeschlagen: {reason}",
	"errors.logFailed":
		"Der Sendungsstatus konnte nicht gespeichert werden. Bitte prüfen Sie ggf. das LetterXpress-Postfach.",
	"success.jobSubmitted": "Auftrag {jobId} übermittelt{testHint}.",
	"success.testModeHint": " (Testmodus – wird nicht zugestellt)",
};
