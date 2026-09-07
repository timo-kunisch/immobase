/**
 * Eigener State-Typ für die Vorschau-Erzeugung einer Vorlage (statt des
 * generischen ActionState), da hier zusätzlich der gerenderte Betreff/Text
 * zurückgegeben werden muss, damit die UI ihn (editierbar) anzeigen kann.
 *
 * WICHTIG: Bewusst NICHT in app/(app)/vorlagen/actions.ts definiert - eine
 * "use server"-Datei darf ausschließlich async Funktionen exportieren, ein
 * zusätzlicher `export const initialPreviewState = {...}`-Objektexport dort
 * würde zur Laufzeit zum Fehler "A 'use server' file can only export async
 * functions, found object." führen (siehe src/lib/auth/login-state.ts für
 * das gleiche, bereits etablierte Muster in diesem Projekt).
 */
export type TemplatePreviewState = {
	error?: string;
	subject?: string | null;
	body?: string;
	leaseId?: string;
};

export const initialPreviewState: TemplatePreviewState = {};
