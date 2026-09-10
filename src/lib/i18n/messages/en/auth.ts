import { auth as deAuth } from "../de/auth";

/** Englische Übersetzungen des Namespace "auth" (Parität per Typ erzwungen). */
export const auth: typeof deAuth = {
	// Page titles (browser tab via generateMetadata)
	"meta.login": "Sign in – ImmoBase",
	"meta.register": "Register – ImmoBase",
	"meta.forgotPassword": "Forgot password – ImmoBase",
	"meta.resetPassword": "Reset password – ImmoBase",
	"meta.verifyEmail": "Confirm email – ImmoBase",
	// Login page: info messages after registration / password reset
	"info.firstAdminWithEmail":
		"Account created! You are the first user and have been automatically approved as administrator. Please confirm your email address first to sign in.",
	"info.firstAdmin":
		"Account created! You are the first user and have been automatically approved as administrator. You can sign in now.",
	"info.registeredWithEmail":
		"Account created! Please confirm your email address. Afterwards an administrator still has to approve your account.",
	"info.registered": "Account created! As soon as an administrator has approved your account, you can sign in.",
	"info.passwordReset": "Your password has been changed successfully. Please sign in with the new password.",
	// Login form
	"login.title": "Sign in",
	"login.description": "Sign in with your email address and password.",
	"login.forgotPassword": "Forgot password?",
	"login.resendVerification": "Resend confirmation email",
	"login.submit": "Sign in",
	"login.noAccount": "No account yet?",
	"login.registerNow": "Register now",
	// Registration
	"register.title": "Create account",
	"register.description": "Register for ImmoBase. The first registered user automatically becomes administrator.",
	"register.passwordConfirm": "Repeat password",
	"register.submit": "Register",
	"register.haveAccount": "Already have an account?",
	"register.loginNow": "Sign in now",
	// Forgot password
	"forgot.title": "Forgot password",
	"forgot.description": "Enter your email address and we will send you a link to reset your password.",
	"forgot.submit": "Request link",
	"forgot.backToLogin": "Back to sign in",
	// Reset password
	"reset.title": "Set new password",
	"reset.description": "Please set a new password for your account.",
	"reset.newPassword": "New password",
	"reset.submit": "Save password",
	"reset.invalidTitle": "Invalid link",
	"reset.invalidDescription": "This password reset link is invalid or has expired. Please request a new one.",
	"reset.requestNewLink": "Request new link",
	// Email verification
	"verify.successTitle": "Email confirmed",
	"verify.errorTitle": "Confirmation failed",
	"verify.noToken": "No confirmation token was provided. Please use the link from your email.",
	"verify.success":
		"Your email address has been confirmed successfully. You can now sign in – provided your account has already been approved by an administrator.",
	"verify.toLogin": "To sign in",
	// Field labels (shared)
	"fields.email": "Email address",
	"fields.password": "Password",
	// Errors/messages from server actions and token helpers
	"errors.credentialsRequired": "Please enter your email address and password.",
	"errors.invalidCredentials": "Email address or password is incorrect.",
	"errors.emailNotVerified": "Your email address has not been confirmed yet.",
	"errors.notApproved": "Your account is still waiting for approval by an administrator.",
	"errors.invalidEmail": "Please enter a valid email address.",
	"errors.passwordTooShort": "The password must be at least {min} characters long.",
	"errors.passwordMismatch": "The passwords do not match.",
	"errors.emailTaken": "An account already exists for this email address.",
	"errors.resetUnavailable":
		"Resetting the password is not available because no email server is configured. Please contact an administrator.",
	"errors.tokenMissing": "Invalid or missing token.",
	"errors.noAccountForToken": "No account was found for this link.",
	"errors.verificationInvalid": "The verification link is invalid.",
	"errors.verificationExpired": "The verification link has expired. Please request a new one.",
	"errors.linkInvalid": "The link is invalid.",
	"errors.linkExpired": "The link has expired. Please request a new one.",
	// Success messages (deliberately generic against account enumeration)
	"messages.forgotGeneric": "If an account with this email address exists, we have sent a link to reset the password.",
	"messages.resendWithoutSmtp":
		"If an account with this email address exists and was not confirmed yet, the address has now been confirmed. You can sign in.",
	"messages.resendWithSmtp":
		"If an account with this email address exists and has not been confirmed yet, we have sent a new confirmation email.",
	"messages.emailRequired": "Please enter your email address.",
};
