"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { isLocale, LOCALE_COOKIE, type Locale } from "./config";

/**
 * Speichert die gewählte App-Sprache im Cookie und verwirft den
 * Render-Cache für alle Seiten (Layout-Ebene), damit sofort in der neuen
 * Sprache gerendert wird. Bewusst OHNE requireUser(): Die Sprachwahl muss
 * auch vor der Anmeldung funktionieren (Login-/Setup-Seiten); sie ändert
 * keine Fachdaten, sondern nur eine reine Darstellungs-Präferenz.
 */
export async function setLocaleAction(locale: Locale): Promise<void> {
	if (!isLocale(locale)) return;
	const store = await cookies();
	store.set(LOCALE_COOKIE, locale, {
		path: "/",
		maxAge: 60 * 60 * 24 * 365,
		sameSite: "lax",
	});
	revalidatePath("/", "layout");
}
