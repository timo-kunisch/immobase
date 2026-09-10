"use client";

/**
 * Client-seitiger Einstieg in die Übersetzungen: Das Root-Layout
 * (src/app/layout.tsx) ermittelt die Sprache serverseitig und übergibt das
 * fertige Dictionary an den I18nProvider. Client Components holen sich
 * `t` und `locale` über useI18n().
 */
import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { Locale } from "./config";
import type { Messages } from "./messages/de";
import { createTranslator, type TranslateFn } from "./translator";

const I18nContext = createContext<{ locale: Locale; t: TranslateFn } | null>(null);

export function I18nProvider({ locale, messages, children }: { locale: Locale; messages: Messages; children: ReactNode }) {
	const t = useMemo(() => createTranslator(messages), [messages]);
	const value = useMemo(() => ({ locale, t }), [locale, t]);
	return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): { locale: Locale; t: TranslateFn } {
	const context = useContext(I18nContext);
	if (!context) {
		throw new Error("useI18n muss innerhalb von <I18nProvider> verwendet werden.");
	}
	return context;
}
