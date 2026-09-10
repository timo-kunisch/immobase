/**
 * Server-seitiger Einstieg in die Übersetzungen (nur in Server Components,
 * Server Actions und Route Handlern importieren - liest das Locale-Cookie
 * über next/headers; NICHT aus Client Components importierbar).
 *
 * Verwendung: `const t = await getT();` und dann `t("tenants.title")`.
 */
import "server-only";

import { cookies } from "next/headers";

import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from "./config";
import { getMessages } from "./messages";
import { createTranslator, type TranslateFn } from "./translator";

/** Ermittelt die gewählte Sprache aus dem Cookie (Fallback: Deutsch). */
export async function getLocale(): Promise<Locale> {
	const store = await cookies();
	return isLocale(store.get(LOCALE_COOKIE)?.value) ? (store.get(LOCALE_COOKIE)!.value as Locale) : DEFAULT_LOCALE;
}

/** Liefert die t()-Funktion für die aktuell gewählte Sprache. */
export async function getT(): Promise<TranslateFn> {
	return createTranslator(getMessages(await getLocale()));
}
