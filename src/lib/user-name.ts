/**
 * Anzeige-Namen für Benutzerkonten (client-sicher, keine Server-Imports):
 * „Vorname Nachname", wenn mindestens ein Name hinterlegt ist, sonst
 * Fallback auf die E-Mail-Adresse (Altkonten ohne Namen).
 */

export interface UserNameSource {
	firstName: string | null;
	lastName: string | null;
	email: string;
}

/**
 * Anzeigename eines Nutzers: „Vorname Nachname" bzw. der jeweils
 * vorhandene Teil davon; ohne jeden Namen die E-Mail-Adresse.
 */
export function userDisplayName(user: UserNameSource): string {
	const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
	return name.length > 0 ? name : user.email;
}
