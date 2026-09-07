/**
 * Erlaubte Dateitypen für den Dokumente-Upload. Aktuell wird bewusst nur PDF
 * unterstützt; das Array ist zentral an einer Stelle gepflegt, damit sowohl
 * der Upload-Dialog (Client, `accept`-Attribut) als auch die Server Action
 * (autoritative Prüfung, siehe actions.ts) denselben Stand verwenden. Sollen
 * später weitere Dateitypen erlaubt werden, reicht es, sie hier zu ergänzen.
 *
 * Bewusst keine "use server"-Direktive in dieser Datei, da sie sowohl von
 * einer Server Action als auch von einer Client-Komponente importiert wird
 * und mehr als nur async Funktionen exportiert (siehe AGENTS.md Abschnitt 3
 * zur "use server"-Falle).
 */
export const ALLOWED_DOCUMENT_MIME_TYPES = ["application/pdf"] as const;
export const ALLOWED_DOCUMENT_EXTENSIONS = [".pdf"] as const;

/** Für das `accept`-Attribut des <input type="file"> im Upload-Dialog. */
export const ALLOWED_DOCUMENT_ACCEPT = ALLOWED_DOCUMENT_EXTENSIONS.join(",");

/** Menschenlesbare Beschreibung der erlaubten Dateitypen für Hinweistexte/Fehlermeldungen. */
export const ALLOWED_DOCUMENT_TYPES_LABEL = "PDF";

/**
 * Prüft, ob eine Datei einem der erlaubten Dateitypen entspricht. Das
 * `accept`-Attribut im Client ist nur eine UX-Hilfe und kann leicht umgangen
 * werden (z. B. über "Alle Dateien" im Betriebssystem-Dateidialog) - diese
 * Funktion wird deshalb zusätzlich serverseitig als autoritative Prüfung
 * verwendet. Da der vom Browser gemeldete `file.type` bei manchen
 * Betriebssystemen/Browsern leer sein kann, wird zusätzlich die
 * Dateiendung geprüft.
 */
export function isAllowedDocumentFile(file: File): boolean {
	const hasAllowedExtension = ALLOWED_DOCUMENT_EXTENSIONS.some((ext) => file.name.toLowerCase().endsWith(ext));
	const hasAllowedMimeType = !file.type || (ALLOWED_DOCUMENT_MIME_TYPES as readonly string[]).includes(file.type);
	return hasAllowedExtension && hasAllowedMimeType;
}
