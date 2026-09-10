"use client";

import { useTransition } from "react";
import { Languages } from "lucide-react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { setLocaleAction } from "@/lib/i18n/actions";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/**
 * Sprachumschalter (Deutsch/English). Schreibt die Wahl über die Server
 * Action setLocaleAction in das Locale-Cookie; die anschließende
 * Revalidierung auf Layout-Ebene rendert alle Seiten direkt in der neuen
 * Sprache. Wird in den Einstellungen (LanguageCard) und im Layout der
 * öffentlichen Auth-Seiten verwendet.
 */
export function LanguageSwitcher({ className }: { className?: string }) {
	const { locale, t } = useI18n();
	const [isPending, startTransition] = useTransition();

	return (
		<Select
			value={locale}
			disabled={isPending}
			onValueChange={(value) => {
				startTransition(async () => {
					await setLocaleAction(value as Locale);
				});
			}}
		>
			<SelectTrigger className={cn("w-full", className)} aria-label={t("settings.language.label")}>
				<Languages className="size-4 text-muted-foreground" />
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{SUPPORTED_LOCALES.map((supportedLocale) => (
					<SelectItem key={supportedLocale} value={supportedLocale}>
						{LOCALE_LABELS[supportedLocale]}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
