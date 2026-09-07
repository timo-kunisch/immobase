import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
	title: "Anmelden – ImmoBase",
};

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
	const { registered, firstAdmin, emailSent, email, from, passwordReset } = await searchParams;

	// emailSent=1 signalisiert, dass die Registrierung eine Verifizierungs-
	// E-Mail verschickt hat (nur bei konfiguriertem SMTP). Ohne SMTP ist die
	// Adresse bereits bei der Registrierung bestätigt worden - der Hinweis
	// auf den E-Mail-Schritt entfällt dann.
	let infoMessage: string | undefined;
	if (registered) {
		if (firstAdmin) {
			infoMessage = emailSent
				? "Konto erstellt! Sie sind der erste Nutzer und wurden automatisch als Administrator freigeschaltet. Bitte bestätigen Sie zunächst Ihre E-Mail-Adresse, um sich anzumelden."
				: "Konto erstellt! Sie sind der erste Nutzer und wurden automatisch als Administrator freigeschaltet. Sie können sich jetzt anmelden.";
		} else {
			infoMessage = emailSent
				? "Konto erstellt! Bitte bestätigen Sie Ihre E-Mail-Adresse. Danach muss ein Administrator Ihr Konto noch freischalten."
				: "Konto erstellt! Sobald ein Administrator Ihr Konto freigeschaltet hat, können Sie sich anmelden.";
		}
	} else if (passwordReset) {
		infoMessage = "Ihr Passwort wurde erfolgreich geändert. Bitte melden Sie sich mit dem neuen Passwort an.";
	}

	// Nur relative Pfade als Redirect-Ziel zulassen (kein Open-Redirect auf
	// fremde Domains über einen manipulierten "from"-Parameter).
	const safeFrom = from && from.startsWith("/") && !from.startsWith("//") ? from : undefined;

	return <LoginForm defaultEmail={email} from={safeFrom} infoMessage={infoMessage} />;
}
