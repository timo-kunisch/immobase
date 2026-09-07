import {
	createPostalShipment,
	getDocumentPdfFile,
	getGeneratedDocumentPdfFile,
	getHoaAnnualStatementPdfFile,
	getLatestPostalShipmentForSource,
	getOwnerMeetingInvitationPdfFile,
	getOwnerMeetingMinutesPdfFile,
	getTenantStatementPdfFile,
} from "@/data/postal-shipments";
import type { PostalShipment, PostalShipmentSourceType, PostalShipmentStatus } from "@/data/types";
import { getUploadedFile } from "@/lib/storage";
import { getLetterXpressMode, LetterXpressError, sendPdfByPost } from "@/lib/letterxpress";

/**
 * Generische Postversand-Orchestrierung (LetterXpress API, siehe
 * src/lib/letterxpress.ts) für die PDF-Quellen der App: Abrechnungen
 * (TenantStatement.pdfPath), Vorlagen-Schreiben (GeneratedDocument.filePath),
 * DMS-Uploads (Document.filePath) sowie die WEG-PDFs (Einzelabrechnung der
 * Jahresabrechnung, Einladung/Protokoll einer Eigentümerversammlung).
 * "Polymorph" über sourceType/sourceId statt separater, fast identischer
 * Funktionen je Quelle.
 *
 * Der Datenzugriff liegt im Repository-Layer (src/data/postal-shipments.ts) -
 * diese Datei enthält nur die Orchestrierung (keine SQL). Die eigentlichen
 * Server Actions (in den `actions.ts`-Dateien der Module) rufen
 * ausschließlich `sendPdfByPostForSource()` auf und kümmern sich selbst um
 * `requireUser()`/`revalidatePath()` (Defense-in-Depth-Konvention).
 */

export const postalShipmentStatusLabels: Record<PostalShipmentStatus, string> = {
	PENDING: "Ausstehend",
	REGISTERED: "Übermittelt",
	FAILED: "Fehlgeschlagen",
};

export const postalShipmentStatusStyles: Record<PostalShipmentStatus, string> = {
	PENDING: "bg-muted text-muted-foreground",
	REGISTERED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
	FAILED: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
};

type SourceFile = { filePath: string; fileName: string };

/** Lädt Dateispeicher-Pfad und einen sinnvollen Dateinamen für die jeweilige PDF-Quelle. */
function loadSourceFile(sourceType: PostalShipmentSourceType, sourceId: string): SourceFile | null {
	switch (sourceType) {
		case "TENANT_STATEMENT":
			return getTenantStatementPdfFile(sourceId);
		case "GENERATED_DOCUMENT":
			return getGeneratedDocumentPdfFile(sourceId);
		case "DOCUMENT":
			return getDocumentPdfFile(sourceId);
		case "HOA_ANNUAL_STATEMENT":
			return getHoaAnnualStatementPdfFile(sourceId);
		case "HOA_MEETING_INVITATION":
			return getOwnerMeetingInvitationPdfFile(sourceId);
		case "HOA_MEETING_MINUTES":
			return getOwnerMeetingMinutesPdfFile(sourceId);
	}
}

/** Liest den kompletten Inhalt eines ReadableStream in einen Uint8Array (für die base64-Kodierung). */
async function streamToUint8Array(stream: ReadableStream): Promise<Uint8Array> {
	const buffer = await new Response(stream).arrayBuffer();
	return new Uint8Array(buffer);
}

/**
 * Rückgabetyp analog zum projektweiten `ActionState` (src/lib/action-state.ts),
 * ergänzt um die für die UI-Anzeige benötigten LetterXpress-Rückmeldungen
 * (Auftrags-ID, externer Status, Modus) - ein eigener Typ statt einer
 * Erweiterung von `ActionState`, da hier im Erfolgsfall immer zusätzliche
 * Felder vorhanden sind (nicht optional).
 */
export type PostalShipmentActionState =
	| { success: true; jobId: string; externalStatus: string | null; mode: string }
	| { error: string };

/**
 * Lädt das PDF der angegebenen Quelle aus der Dateiablage, übermittelt es
 * per LetterXpress an die Post und protokolliert das Ergebnis (Erfolg ODER
 * Fehlschlag) als neuen postal_shipments-Datensatz. Wirft nie - Fehler
 * (fehlende Quelle/Datei, HTTP-Fehler, ungültige API-Antwort) werden als
 * `{ error: string }` zurückgegeben, damit der Client-Button sie direkt
 * anzeigen kann.
 */
export async function sendPdfByPostForSource(
	sourceType: PostalShipmentSourceType,
	sourceId: string,
	requestedByUserId: string | null
): Promise<PostalShipmentActionState> {
	const source = loadSourceFile(sourceType, sourceId);
	if (!source) {
		return { error: "Für diese Quelle wurde kein versandfertiges PDF gefunden." };
	}

	const mode = getLetterXpressMode();
	let jobId: string | null = null;
	let externalStatus: string | null = null;
	let errorMessage: string | null = null;
	let status: PostalShipmentStatus = "FAILED";

	try {
		const fileObject = await getUploadedFile(source.filePath);
		if (!fileObject) {
			throw new LetterXpressError("Die PDF-Datei wurde in der Dateiablage nicht gefunden.");
		}
		const pdfBuffer = await streamToUint8Array(fileObject.body);
		const result = await sendPdfByPost({ pdfBuffer, fileName: source.fileName });
		jobId = result.jobId;
		externalStatus = result.status;
		status = "REGISTERED";
	} catch (error) {
		errorMessage = error instanceof LetterXpressError ? error.message : "Der Postversand ist fehlgeschlagen.";
		console.error(`sendPdfByPostForSource (${sourceType}/${sourceId}) failed`, error);
	}

	try {
		createPostalShipment({
			sourceType,
			sourceId,
			externalJobId: jobId,
			externalStatus,
			mode,
			status,
			errorMessage,
			requestedByUserId,
		});
	} catch (dbError) {
		// Der Versand selbst kann bereits erfolgt sein (jobId vorhanden), auch
		// wenn die anschließende Protokollierung fehlschlägt - dennoch ein
		// Fehler an den Nutzer, da ohne DB-Eintrag keine verlässliche Auskunft
		// über den Sendungsstatus mehr möglich ist.
		console.error("sendPdfByPostForSource: Speichern des Sendungsprotokolls fehlgeschlagen", dbError);
		return { error: "Der Sendungsstatus konnte nicht gespeichert werden. Bitte prüfen Sie ggf. das LetterXpress-Postfach." };
	}

	if (status === "FAILED") {
		return { error: errorMessage ?? "Der Postversand ist fehlgeschlagen." };
	}

	return { success: true, jobId: jobId!, externalStatus, mode };
}

/** Letzter Versandversuch für eine PDF-Quelle (für die Anzeige in der jeweiligen Ansicht). */
export function getLatestShipmentForSource(sourceType: PostalShipmentSourceType, sourceId: string): PostalShipment | null {
	return getLatestPostalShipmentForSource(sourceType, sourceId);
}
