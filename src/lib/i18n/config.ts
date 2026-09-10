/**
 * Zentrale Konfiguration der Mehrsprachigkeit (i18n).
 *
 * ImmoBase verwendet ein bewusst schlankes, eigenes i18n-System (keine
 * externe Bibliothek - passt zum dependency-armen Projektstil und vermeidet
 * Risiken beim Turbopack-Standalone-Tracing). Deutsch ist die
 * Standardsprache, Englisch die Alternative. Die gewählte Sprache liegt in
 * einem Cookie (funktioniert auch vor der Anmeldung, z. B. auf der
 * Login-Seite), NICHT in der URL - die Routen bleiben unverändert.
 *
 * Verwendung:
 * - Server Components / Server Actions: `const t = await getT();` (server.ts)
 * - Client Components: `const { t, locale } = useI18n();` (provider.tsx)
 */

export const SUPPORTED_LOCALES = ["de", "en"] as const;

export type Locale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "de";

/** Anzeigename je Sprache (immer in der Sprache selbst, wie üblich). */
export const LOCALE_LABELS: Record<Locale, string> = {
	de: "Deutsch",
	en: "English",
};

export const LOCALE_COOKIE = "immobase_locale";

export function isLocale(value: string | undefined | null): value is Locale {
	return value === "de" || value === "en";
}
