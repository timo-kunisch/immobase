import { postal as dePostal } from "../de/postal";

/** Englische Übersetzungen des Namespace "postal" (Parität per Typ erzwungen). */
export const postal: typeof dePostal = {
	sendByPost: "Send by post",
	notConfiguredShort: "Postal delivery not set up (Settings → Integrations & AI)",
	"errors.notConfigured":
		"Postal delivery is not set up. Please store the LetterXpress credentials under Settings → Integrations & AI.",
	"errors.noPdf": "No PDF ready for dispatch was found for this source.",
	"errors.fileMissing": "The PDF file was not found in the file storage.",
	"errors.sendFailed": "The postal dispatch failed.",
	"errors.sendFailedWithReason": "The postal dispatch failed: {reason}",
	"errors.logFailed": "The shipment status could not be saved. Please check the LetterXpress mailbox if necessary.",
	"success.jobSubmitted": "Job {jobId} submitted{testHint}.",
	"success.testModeHint": " (test mode – will not be delivered)",
};
