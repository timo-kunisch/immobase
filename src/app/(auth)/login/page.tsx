import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { LoginForm } from "@/components/auth/login-form";
import { countUsers } from "@/data/users";
import { getT } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
	const t = await getT();
	return { title: t("auth.meta.login") };
}

// WICHTIG: force-dynamic ist hier aus zwei Gründen Pflicht (siehe auch den
// ausführlichen Kommentar in register/page.tsx):
// 1. Der countUsers()-Check (Weiterleitung zur Ersteinrichtung, solange
//    noch kein Konto existiert) muss bei JEDEM Request live aus der
//    Datenbank kommen - ein statisch prerenderter Build-Zeitstand würde
//    sonst dauerhaft zur /setup-Seite weiterleiten (Redirect-Schleife,
//    weil /setup korrekt dynamisch zurück zu /login leitet).
// 2. Wie bei /register verhindert es veraltete Server-Action-Referenzen
//    und Chunk-Pfade nach einem Deployment.
export const dynamic = "force-dynamic";

export default async function LoginPage({
	searchParams,
}: {
	searchParams: Promise<{
		registered?: string;
		firstAdmin?: string;
		emailSent?: string;
		email?: string;
		from?: string;
		passwordReset?: string;
	}>;
}) {
	// Solange noch kein Benutzerkonto existiert, führt die Ersteinrichtung
	// (Setup-Wizard) durch die Grundeinstellungen und legt das erste
	// (Administrator-)Konto an.
	if (countUsers() === 0) {
		redirect("/setup");
	}

	const t = await getT();
	const { registered, firstAdmin, emailSent, email, from, passwordReset } = await searchParams;

	// emailSent=1 signalisiert, dass die Registrierung eine Verifizierungs-
	// E-Mail verschickt hat (nur bei konfiguriertem SMTP). Ohne SMTP ist die
	// Adresse bereits bei der Registrierung bestätigt worden - der Hinweis
	// auf den E-Mail-Schritt entfällt dann.
	let infoMessage: string | undefined;
	if (registered) {
		if (firstAdmin) {
			infoMessage = emailSent ? t("auth.info.firstAdminWithEmail") : t("auth.info.firstAdmin");
		} else {
			infoMessage = emailSent ? t("auth.info.registeredWithEmail") : t("auth.info.registered");
		}
	} else if (passwordReset) {
		infoMessage = t("auth.info.passwordReset");
	}

	// Nur relative Pfade als Redirect-Ziel zulassen (kein Open-Redirect auf
	// fremde Domains über einen manipulierten "from"-Parameter).
	const safeFrom = from && from.startsWith("/") && !from.startsWith("//") ? from : undefined;

	return <LoginForm defaultEmail={email} from={safeFrom} infoMessage={infoMessage} />;
}
