/**
 * Tipp-Bestätigung für das vollständige Zurücksetzen der Anwendung
 * (Einstellungen → Anwendung zurücksetzen). Bewusst in einer eigenen Datei
 * ohne "use server": Die Server Action (actions.ts) validiert damit, und
 * die Client-Komponente (reset-app-card.tsx) kann denselben Wert für die
 * Eingabeprüfung importieren - "use server"-Dateien dürfen nur async
 * Funktionen exportieren.
 */
export const RESET_CONFIRMATION_PHRASE = "ZURÜCKSETZEN";
