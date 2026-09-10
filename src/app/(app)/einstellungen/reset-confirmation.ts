/**
 * Tipp-Bestätigungen für die beiden Zurücksetzen-Varianten in den
 * Einstellungen (Sicherheit-Tab, siehe reset-app-card.tsx). Bewusst in
 * einer eigenen Datei ohne "use server": Die Server Actions (actions.ts)
 * validieren damit, und die Client-Komponente kann dieselben Werte für
 * die Eingabeprüfung importieren - "use server"-Dateien dürfen nur async
 * Funktionen exportieren.
 *
 * Zwei bewusst unterschiedliche Phrasen: Wer versehentlich im falschen
 * Dialog landet, stolpert spätestens über die abweichende Eingabe-
 * Aufforderung und merkt den Fehler, bevor bestätigt wird.
 */

/** Vollständiger Reset: Inhalte und Einstellungen (Auslieferungszustand). */
export const RESET_CONFIRMATION_PHRASE = "ZURÜCKSETZEN";

/** Inhalts-Reset: Fachdaten und Dateien (Konten/Einstellungen bleiben). */
export const RESET_CONTENT_CONFIRMATION_PHRASE = "INHALTE";