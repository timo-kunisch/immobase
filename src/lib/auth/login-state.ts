/**
 * Eigener State-Typ für den Login-Flow (statt des generischen ActionState),
 * da hier zusätzlich ein "unverifiedEmail"-Flag benötigt wird (zeigt einen
 * "Bestätigungsmail erneut senden"-Button).
 *
 * WICHTIG: Bewusst NICHT in der "use server"-Datei (login/actions.ts)
 * definiert – eine solche Datei darf ausschließlich async Funktionen
 * exportieren. Ein zusätzlicher `export const initialLoginState = {}`-
 * Objektexport dort führt zur Laufzeit zum Fehler "A 'use server' file can
 * only export async functions, found object."
 * (siehe https://nextjs.org/docs/messages/invalid-use-server-value).
 */
export type LoginState = {
	error?: string;
	/** Gesetzt, wenn der Login speziell wegen unbestätigter E-Mail fehlschlug
	 *  – die UI zeigt dann einen "Bestätigungsmail erneut senden"-Button. */
	unverifiedEmail?: string;
};

export const initialLoginState: LoginState = {};
