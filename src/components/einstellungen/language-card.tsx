import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { getT } from "@/lib/i18n/server";

/**
 * Einstellungs-Karte "Sprache": Wahl der App-Sprache (Deutsch/English).
 * Server-Komponente (Texte via getT), der eigentliche Umschalter ist die
 * Client-Komponente LanguageSwitcher.
 */
export async function LanguageCard() {
	const t = await getT();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("settings.language.title")}</CardTitle>
				<CardDescription>{t("settings.language.description")}</CardDescription>
			</CardHeader>
			<CardContent className="max-w-xs">
				<LanguageSwitcher />
			</CardContent>
		</Card>
	);
}
