/**
 * Namespace "auth" (Deutsch): Anmeldung, Registrierung, E-Mail-
 * Verifizierung, Passwort vergessen/zurücksetzen inkl. der Fehlertexte aus
 * den zugehörigen Server Actions und Token-/Validierungs-Helfern.
 */
export const auth = {
	// Seiten-Titel (Browser-Tab via generateMetadata)
	"meta.login": "Anmelden – ImmoBase",
	"meta.register": "Registrieren – ImmoBase",
	"meta.forgotPassword": "Passwort vergessen – ImmoBase",
	"meta.resetPassword": "Passwort zurücksetzen – ImmoBase",
	"meta.verifyEmail": "E-Mail bestätigen – ImmoBase",
	// Login-Seite: Info-Meldungen nach Registrierung / Passwort-Reset
	"info.firstAdminWithEmail":
		"Konto erstellt! Sie sind der erste Nutzer und wurden automatisch als Administrator freigeschaltet. Bitte bestätigen Sie zunächst Ihre E-Mail-Adresse, um sich anzumelden.",
	"info.firstAdmin":
		"Konto erstellt! Sie sind der erste Nutzer und wurden automatisch als Administrator freigeschaltet. Sie können sich jetzt anmelden.",
	"info.registeredWithEmail":
		"Konto erstellt! Bitte bestätigen Sie Ihre E-Mail-Adresse. Danach muss ein Administrator Ihr Konto noch freischalten.",
	"info.registered": "Konto erstellt! Sobald ein Administrator Ihr Konto freigeschaltet hat, können Sie sich anmelden.",
	"info.passwordReset": "Ihr Passwort wurde erfolgreich geändert. Bitte melden Sie sich mit dem neuen Passwort an.",
	// Login-Formular
	"login.title": "Anmelden",
	"login.description": "Melden Sie sich mit Ihrer E-Mail-Adresse und Ihrem Passwort an.",
	"login.forgotPassword": "Passwort vergessen?",
	"login.resendVerification": "Bestätigungs-E-Mail erneut senden",
	"login.submit": "Anmelden",
	"login.noAccount": "Noch kein Konto?",
	"login.registerNow": "Jetzt registrieren",
	// Registrierung
	"register.title": "Konto erstellen",
	"register.description": "Registrieren Sie sich für ImmoBase. Der erste registrierte Nutzer wird automatisch Administrator.",
	"register.passwordConfirm": "Passwort wiederholen",
	"register.submit": "Registrieren",
	"register.haveAccount": "Bereits ein Konto?",
	"register.loginNow": "Jetzt anmelden",
	// Passwort vergessen
	"forgot.title": "Passwort vergessen",
	"forgot.description": "Geben Sie Ihre E-Mail-Adresse ein, wir senden Ihnen einen Link zum Zurücksetzen des Passworts.",
	"forgot.submit": "Link anfordern",
	"forgot.backToLogin": "Zurück zur Anmeldung",
	// Passwort zurücksetzen
	"reset.title": "Neues Passwort vergeben",
	"reset.description": "Bitte vergeben Sie ein neues Passwort für Ihr Konto.",
	"reset.newPassword": "Neues Passwort",
	"reset.submit": "Passwort speichern",
	"reset.invalidTitle": "Link ungültig",
	"reset.invalidDescription":
		"Dieser Link zum Zurücksetzen des Passworts ist ungültig oder abgelaufen. Fordern Sie bitte einen neuen an.",
	"reset.requestNewLink": "Neuen Link anfordern",
	// E-Mail-Verifizierung
	"verify.successTitle": "E-Mail bestätigt",
	"verify.errorTitle": "Bestätigung fehlgeschlagen",
	"verify.noToken": "Es wurde kein Bestätigungs-Token übergeben. Bitte verwenden Sie den Link aus Ihrer E-Mail.",
	"verify.success":
		"Ihre E-Mail-Adresse wurde erfolgreich bestätigt. Sie können sich nun anmelden – sofern Ihr Konto bereits von einem Administrator freigeschaltet wurde.",
	"verify.toLogin": "Zur Anmeldung",
	// Feldlabels (gemeinsam)
	"fields.email": "E-Mail-Adresse",
	"fields.password": "Passwort",
	// Fehler/Meldungen aus Server Actions und Token-Helfern
	"errors.credentialsRequired": "Bitte geben Sie E-Mail-Adresse und Passwort an.",
	"errors.invalidCredentials": "E-Mail-Adresse oder Passwort ist falsch.",
	"errors.emailNotVerified": "Ihre E-Mail-Adresse wurde noch nicht bestätigt.",
	"errors.notApproved": "Ihr Konto wartet noch auf die Freigabe durch einen Administrator.",
	"errors.invalidEmail": "Bitte geben Sie eine gültige E-Mail-Adresse an.",
	"errors.passwordTooShort": "Das Passwort muss mindestens {min} Zeichen lang sein.",
	"errors.passwordMismatch": "Die Passwörter stimmen nicht überein.",
	"errors.emailTaken": "Für diese E-Mail-Adresse existiert bereits ein Konto.",
	"errors.resetUnavailable":
		"Das Zurücksetzen des Passworts ist nicht verfügbar, weil kein E-Mail-Server konfiguriert ist. Bitte wenden Sie sich an einen Administrator.",
	"errors.tokenMissing": "Ungültiger oder fehlender Token.",
	"errors.noAccountForToken": "Zu diesem Link wurde kein Konto gefunden.",
	"errors.verificationInvalid": "Der Verifizierungslink ist ungültig.",
	"errors.verificationExpired": "Der Verifizierungslink ist abgelaufen. Bitte fordern Sie einen neuen an.",
	"errors.linkInvalid": "Der Link ist ungültig.",
	"errors.linkExpired": "Der Link ist abgelaufen. Bitte fordern Sie einen neuen an.",
	// Erfolgsmeldungen (bewusst generisch gegen Account-Enumeration)
	"messages.forgotGeneric":
		"Falls ein Konto mit dieser E-Mail-Adresse existiert, haben wir einen Link zum Zurücksetzen des Passworts versendet.",
	"messages.resendWithoutSmtp":
		"Falls ein Konto mit dieser E-Mail-Adresse existiert und noch nicht bestätigt war, wurde die Adresse jetzt bestätigt. Sie können sich anmelden.",
	"messages.resendWithSmtp":
		"Falls ein Konto mit dieser E-Mail-Adresse existiert und noch nicht bestätigt wurde, haben wir eine neue Bestätigungs-E-Mail versendet.",
	"messages.emailRequired": "Bitte geben Sie Ihre E-Mail-Adresse an.",
};
