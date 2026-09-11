"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, KeyRound, Loader2, SkipForward } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { getDesktopBridge } from "@/lib/desktop-bridge";
import { useI18n } from "@/lib/i18n/provider";
import { showError } from "@/lib/toast";
import type { MessageKey } from "@/lib/i18n/translator";
import type { CompanySettings } from "@/data/types";

import { getSetupRecoveryKeyAction, setupAccountAction, setupCompanySettingsAction } from "@/app/(setup)/setup/actions";

/**
 * Setup-Wizard für die Ersteinrichtung (Route /setup, nur erreichbar solange
 * noch kein Benutzerkonto existiert):
 *
 *   1. Willkommen (Einführung)
 *   2. Betriebsmodus wählen (Lokal/Host/Client, Desktop-App)
 *   3. Absenderdaten für erzeugte PDFs (überspringbar)
 *   4. Online-Integrationen (reiner Hinweisschritt ohne Konfiguration – die
 *      optionalen Dienste werden einheitlich in den Einstellungen eingerichtet)
 *   5. Wiederherstellungsschlüssel der lokalen Datenverschlüsselung sichern
 *      (nicht überspringbar, aber ohne Eingabe – Bestätigung per Checkbox)
 *   6. Administratorkonto anlegen (erforderlich, letzter Schritt)
 *
 * Der Modus-Schritt gilt nur für die Desktop-App (Electron-Brücke): Die Wahl
 * wird per IPC an den Main-Prozess übergeben (idempotent, kein Server-
 * Neustart bei unverändertem Modus). Bei "client" wechselt das Fenster auf
 * die Verbindungsseite der Shell (Host wählen + Token) – die übrigen
 * Einrichtungsschritte entfallen auf diesem Gerät, sie wirken ohnehin nur
 * auf dem Host. Ohne Desktop-Brücke (Browser-Entwicklung) ist der Schritt
 * rein informativ (dort läuft die App immer lokal). Die Wahl ist später
 * jederzeit unter Einstellungen → Verbindung & Mehrbenutzer änderbar.
 *
 * Das Konto wird bewusst als LETZTER Schritt angelegt: Die Setup-Actions
 * sind nur zulässig, solange noch kein Benutzer existiert (siehe
 * ensureSetupAllowed in den Actions). Nach dem Anlegen meldet die Action
 * den Nutzer direkt an (Offline-Fall) bzw. leitet zur Login-Seite weiter
 * (mit konfiguriertem SMTP erst nach E-Mail-Bestätigung).
 *
 * Alle Schritte bleiben gemountet und werden per CSS ausgeblendet, damit
 * eingegebene Werte beim Zurückblättern erhalten bleiben.
 */

const STEP_TITLE_KEYS: MessageKey[] = [
	"setup.steps.welcome",
	"setup.steps.mode",
	"setup.steps.company",
	"setup.steps.integrations",
	"setup.steps.recoveryKey",
	"setup.steps.account",
];

/**
 * Die Wizard-Karten haben eine farblich abgesetzte Fußleiste (CardFooter mit
 * bg-muted): Die Card trägt dafür unten keinen eigenen Innenabstand
 * (has-card-footer:pb-0), daher bekommt der Inhalt selbst den Abstand zur
 * Leiste. Ohne ihn würde z. B. die Hinweisliste der Online-Integrationen
 * direkt an die Leiste stoßen.
 */
const STEP_CONTENT = "pb-(--card-spacing)";

function StepProgress({ step }: { step: number }) {
	const { t } = useI18n();
	return (
		<div className="space-y-2">
			<div className="flex gap-1.5">
				{STEP_TITLE_KEYS.map((titleKey, index) => (
					<div key={titleKey} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-primary" : "bg-border"}`} />
				))}
			</div>
			<p className="text-sm text-muted-foreground">
				{t("setup.progress.stepOf", { step: step + 1, total: STEP_TITLE_KEYS.length, title: t(STEP_TITLE_KEYS[step]) })}
			</p>
		</div>
	);
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
	const { t } = useI18n();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("setup.welcome.title")}</CardTitle>
				<CardDescription>
					{t("setup.welcome.description")}
				</CardDescription>
			</CardHeader>
			<CardContent className={`${STEP_CONTENT} space-y-3 text-sm text-muted-foreground`}>
			<p>{t("setup.welcome.offline")}</p>
			<p>{t("setup.welcome.stepsIntro")}</p>
			<ul className="list-disc space-y-1 pl-5">
				<li>{t("setup.welcome.itemMode")}</li>
				<li>{t("setup.welcome.itemCompany")}</li>
				<li>{t("setup.welcome.itemIntegrations")}</li>
				<li>{t("setup.welcome.itemRecoveryKey")}</li>
				<li>{t("setup.welcome.itemAccount")}</li>
			</ul>
				<p>{t("setup.welcome.optionalHint")}</p>
			</CardContent>
			<CardFooter className="justify-end">
				<Button onClick={onNext}>
					{t("setup.welcome.start")}
					<ChevronRight />
				</Button>
			</CardFooter>
		</Card>
	);
}

type AppMode = "local" | "host" | "client";

const MODE_OPTIONS: { value: AppMode; titleKey: MessageKey; descriptionKey: MessageKey }[] = [
	{ value: "local", titleKey: "setup.mode.options.local.title", descriptionKey: "setup.mode.options.local.description" },
	{ value: "host", titleKey: "setup.mode.options.host.title", descriptionKey: "setup.mode.options.host.description" },
	{ value: "client", titleKey: "setup.mode.options.client.title", descriptionKey: "setup.mode.options.client.description" },
];

/**
 * Setup-Schritt „Betriebsmodus“ (nur Desktop-App): übernimmt die Wahl per
 * IPC an den Main-Prozess (iv:set-mode). Erststart: Der eingebettete Server
 * läuft bereits im lokalen Modus, daher ist "Lokal" vorausgewählt und ein
 * Neustart entfällt (der Main-Prozess wendet die Wahl idempotent an).
 */
function ModeStep({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
	const { t } = useI18n();
	const bridge = getDesktopBridge();
	const [selected, setSelected] = useState<AppMode>("local");
	const [busy, setBusy] = useState(false);

	// Aktuell wirksamen Modus als Vorauswahl laden (relevant, wenn der Wizard
	// z. B. auf einem Client im Host-Modus erneut durchlaufen wird).
	useEffect(() => {
		if (!bridge) return;
		let cancelled = false;
		void bridge
			.getConnectionInfo()
			.then((info) => {
				if (cancelled) return;
				if (info.mode === "local" || info.mode === "host" || info.mode === "client") setSelected(info.mode);
			})
			.catch(() => {
				// Vorauswahl bleibt "local".
			});
		return () => {
			cancelled = true;
		};
	}, [bridge]);

	async function handleNext(): Promise<void> {
		// Ohne Desktop-Brücke (Browser-Entwicklung) gibt es keinen Modus zu
		// setzen – die App läuft dort immer lokal.
		if (!bridge) {
			onDone();
			return;
		}
		setBusy(true);
		try {
			const result = await bridge.setMode(selected);
			if (!result.ok) {
				showError(result.error ?? t("setup.errors.modeApply"));
				return;
			}
			// Bei "client" wechselt das Fenster automatisch auf die
			// Verbindungsseite der Shell (Host wählen + Token) – der Wizard
			// endet auf diesem Gerät hier.
			if (selected !== "client") onDone();
		} catch {
			showError(t("setup.errors.modeApply"));
		} finally {
			setBusy(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("setup.steps.mode")}</CardTitle>
				<CardDescription>
					{t("setup.mode.description")}
				</CardDescription>
			</CardHeader>
			<CardContent className={`${STEP_CONTENT} space-y-4`}>
				<div className="grid gap-3 sm:grid-cols-3">
					{MODE_OPTIONS.map((option) => (
						<button
							key={option.value}
							type="button"
							disabled={!bridge}
							onClick={() => setSelected(option.value)}
							className={`rounded-md border p-4 text-left transition-colors ${
								selected === option.value ? "border-primary ring-2 ring-primary" : "hover:border-primary/50"
							}`}
						>
							<span className="block text-sm font-medium">{t(option.titleKey)}</span>
							<span className="mt-1 block text-xs text-muted-foreground">{t(option.descriptionKey)}</span>
						</button>
					))}
				</div>

				{!bridge ? (
					<p className="text-xs text-muted-foreground">
						{t("setup.mode.browserHint")}
					</p>
				) : (
					<p className="text-xs text-muted-foreground">
						{t("setup.mode.hostHint")}
					</p>
				)}

				{bridge && selected === "client" ? (
					<p className="text-xs text-muted-foreground">
						{t("setup.mode.clientHint")}
					</p>
				) : null}
			</CardContent>
			<CardFooter className="justify-between">
				<Button type="button" variant="ghost" onClick={onBack}>
					<ChevronLeft />
					{t("common.back")}
				</Button>
				<Button type="button" onClick={() => void handleNext()} disabled={busy}>
					{busy ? <Loader2 className="animate-spin" /> : null}
					{t("common.next")}
					<ChevronRight />
				</Button>
			</CardFooter>
		</Card>
	);
}

function CompanyStep({ initial, onDone, onBack }: { initial: CompanySettings; onDone: () => void; onBack: () => void }) {
	const { t } = useI18n();
	// Schrittweiterung direkt nach erfolgreichem Speichern (statt useEffect):
	// So wird onDone genau einmal pro Absenden ausgelöst und kann bei späteren
	// Re-Renders nicht erneut feuern.
	const [state, formAction, isPending] = useActionState(
		async (prevState: ActionState, formData: FormData) => {
			const result = await setupCompanySettingsAction(prevState, formData);
			if (result.success) onDone();
			return result;
		},
		initialActionState
	);

	return (
		<Card>
			<form action={formAction}>
				<CardHeader>
					<CardTitle>{t("setup.steps.company")}</CardTitle>
					<CardDescription>
						{t("setup.company.description")}
					</CardDescription>
				</CardHeader>
				<CardContent className={`${STEP_CONTENT} space-y-4`}>
					<div className="grid gap-2">
						<Label htmlFor="setup-name">{t("setup.fields.name")}</Label>
						<Input id="setup-name" name="name" defaultValue={initial.name} placeholder={t("setup.fields.namePlaceholder")} />
					</div>

					<div className="grid gap-2">
						<Label htmlFor="setup-street">{t("setup.fields.street")}</Label>
						<Input id="setup-street" name="street" defaultValue={initial.street} placeholder={t("setup.fields.streetPlaceholder")} />
					</div>

					<div className="grid grid-cols-3 gap-4">
						<div className="col-span-1 grid gap-2">
							<Label htmlFor="setup-zipCode">{t("setup.fields.zipCode")}</Label>
							<Input id="setup-zipCode" name="zipCode" defaultValue={initial.zipCode} placeholder="12345" />
						</div>
						<div className="col-span-2 grid gap-2">
							<Label htmlFor="setup-city">{t("setup.fields.city")}</Label>
							<Input id="setup-city" name="city" defaultValue={initial.city} placeholder={t("setup.fields.cityPlaceholder")} />
						</div>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="setup-additional">{t("setup.fields.additional")}</Label>
						<Textarea
							id="setup-additional"
							name="additional"
							defaultValue={initial.additional ?? ""}
							placeholder={t("setup.fields.additionalPlaceholder")}
							className="min-h-24"
						/>
					</div>

					<ActionErrorToast state={state} />
				</CardContent>
				<CardFooter className="justify-between">
					<Button type="button" variant="ghost" onClick={onBack}>
						<ChevronLeft />
						{t("common.back")}
					</Button>
					<div className="flex gap-2">
						<Button type="button" variant="outline" onClick={onDone}>
							<SkipForward />
							{t("setup.company.skip")}
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							{t("setup.company.saveAndNext")}
						</Button>
					</div>
				</CardFooter>
			</form>
		</Card>
	);
}

/**
 * Setup-Schritt „Online-Integrationen“: reiner Hinweisschritt OHNE
 * Konfigurationsmöglichkeit. Die optionalen Online-Dienste (SMTP, IMAP,
 * LetterXpress, KI-Assistent, MCP-Server, Dropbox-Backup) werden einheitlich
 * erst nach der Einrichtung in den Einstellungen eingerichtet – der Wizard
 * weist hier nur darauf hin, damit die Konfigurationswege nicht an zwei
 * Stellen gepflegt werden müssen.
 */
function IntegrationsStep({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
	const { t } = useI18n();
	return (
		<Card>
			<CardHeader>
				<CardTitle>{t("setup.integrations.title")}</CardTitle>
				<CardDescription>
					{t("setup.integrations.description")}
				</CardDescription>
			</CardHeader>
			<CardContent className={`${STEP_CONTENT} space-y-4 text-sm`}>
				<div>
					<p className="font-medium">{t("setup.integrations.groupIntegrations")}</p>
					<ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
						<li>{t("setup.integrations.itemSmtp")}</li>
						<li>{t("setup.integrations.itemImap")}</li>
						<li>{t("setup.integrations.itemLetterxpress")}</li>
						<li>{t("setup.integrations.itemAi")}</li>
						<li>{t("setup.integrations.itemMcp")}</li>
					</ul>
				</div>
				<div>
					<p className="font-medium">{t("setup.integrations.groupBackup")}</p>
					<ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
						<li>{t("setup.integrations.itemDropbox")}</li>
					</ul>
				</div>
				<p className="text-xs text-muted-foreground">
					{t("setup.integrations.smtpHint")}
				</p>
			</CardContent>
			<CardFooter className="justify-between">
				<Button type="button" variant="ghost" onClick={onBack}>
					<ChevronLeft />
					{t("common.back")}
				</Button>
				<Button type="button" onClick={onDone}>
					{t("common.next")}
					<ChevronRight />
				</Button>
			</CardFooter>
		</Card>
	);
}

function RecoveryKeyStep({ active, onDone, onBack }: { active: boolean; onDone: () => void; onBack: () => void }) {
	const { t } = useI18n();
	const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [copied, setCopied] = useState(false);
	const [confirmed, setConfirmed] = useState(false);

	// Der Schlüssel wird erst abgerufen, wenn der Schritt sichtbar wird (alle
	// Schritte bleiben gemountet) – analog zum expliziten Abruf in den
	// Einstellungen, nicht schon beim Laden der Seite.
	useEffect(() => {
		if (!active || recoveryKey !== null) return;
		let cancelled = false;
		getSetupRecoveryKeyAction()
			.then((result) => {
				if (cancelled) return;
				if (result.error || !result.key) {
					setError(result.error ?? t("setup.errors.recoveryKeyRead"));
				} else {
					setRecoveryKey(result.key);
				}
			})
			.catch(() => {
				if (!cancelled) setError(t("setup.errors.recoveryKeyRead"));
			});
		return () => {
			cancelled = true;
		};
	}, [active, recoveryKey, t]);

	async function handleCopy(): Promise<void> {
		if (!recoveryKey) return;
		try {
			await navigator.clipboard.writeText(recoveryKey);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard-API nicht verfügbar (z. B. kein sicherer Kontext) – der
			// Schlüssel ist markierbar und kann manuell kopiert werden.
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<KeyRound className="size-5" />
					{t("setup.recovery.title")}
				</CardTitle>
				<CardDescription>
					{t("setup.recovery.description")}
				</CardDescription>
			</CardHeader>
			<CardContent className={`${STEP_CONTENT} space-y-4 text-sm`}>
				<p className="text-muted-foreground">
					{t("setup.recovery.explanation")}
				</p>

				{error ? <p className="text-sm text-destructive">{error}</p> : null}
				{recoveryKey === null && !error ? (
					<p className="flex items-center gap-2 text-muted-foreground">
						<Loader2 className="size-4 animate-spin" />
						{t("setup.recovery.loading")}
					</p>
				) : null}
				{recoveryKey !== null ? (
					<div className="space-y-2">
						<code className="block break-all rounded-md border bg-muted p-3 text-xs select-all">{recoveryKey}</code>
						<Button type="button" variant="outline" size="sm" onClick={handleCopy}>
							{copied ? <Check /> : <Copy />}
							{copied ? t("setup.recovery.copied") : t("setup.recovery.copy")}
						</Button>
					</div>
				) : null}

				<label className="flex items-start gap-2 text-sm">
					<input
						type="checkbox"
						className="mt-0.5"
						checked={confirmed}
						onChange={(event) => setConfirmed(event.target.checked)}
					/>
					{t("setup.recovery.confirm")}
				</label>

				<p className="text-xs text-muted-foreground">
					{t("setup.recovery.laterHint")}
				</p>
			</CardContent>
			<CardFooter className="justify-between">
				<Button type="button" variant="ghost" onClick={onBack}>
					<ChevronLeft />
					{t("common.back")}
				</Button>
				<Button type="button" onClick={onDone} disabled={recoveryKey === null || !confirmed}>
					{t("common.next")}
					<ChevronRight />
				</Button>
			</CardFooter>
		</Card>
	);
}

function AccountStep({ onBack }: { onBack: () => void }) {
	const { t } = useI18n();
	// Bei Erfolg leitet die Action selbst weiter ("/" bei direkter Anmeldung
	// bzw. "/login?...&emailSent=1" bei konfiguriertem SMTP).
	const [state, formAction, isPending] = useActionState(setupAccountAction, initialActionState);

	// E-Mail als kontrolliertes Feld führen: React setzt das Formular nach
	// einer Server Action zurück (die Passwort-Felder werden bewusst geleert),
	// die bereits eingegebene E-Mail-Adresse bleibt so erhalten, z. B. bei
	// nicht übereinstimmenden Passwörtern.
	const [email, setEmail] = useState("");

	return (
		<Card>
			<form action={formAction}>
				<CardHeader>
					<CardTitle>{t("setup.account.title")}</CardTitle>
					<CardDescription>
						{t("setup.account.description")}
					</CardDescription>
				</CardHeader>
				<CardContent className={`${STEP_CONTENT} grid gap-4`}>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="grid gap-2">
							<Label htmlFor="setup-firstName">{t("common.firstName")}</Label>
							<Input id="setup-firstName" name="firstName" type="text" autoComplete="given-name" maxLength={100} required />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="setup-lastName">{t("common.lastName")}</Label>
							<Input id="setup-lastName" name="lastName" type="text" autoComplete="family-name" maxLength={100} required />
						</div>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="setup-email">{t("auth.fields.email")}</Label>
						<Input
							id="setup-email"
							name="email"
							type="email"
							autoComplete="email"
							required
							value={email}
							onChange={(event) => setEmail(event.target.value)}
						/>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="setup-password">{t("auth.fields.password")}</Label>
						<Input id="setup-password" name="password" type="password" autoComplete="new-password" minLength={8} required />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="setup-passwordConfirm">{t("auth.register.passwordConfirm")}</Label>
						<Input
							id="setup-passwordConfirm"
							name="passwordConfirm"
							type="password"
							autoComplete="new-password"
							minLength={8}
							required
						/>
					</div>
					<ActionErrorToast state={state} />
				</CardContent>
			<CardFooter className="justify-between">
				<Button type="button" variant="ghost" onClick={onBack}>
					<ChevronLeft />
					{t("common.back")}
				</Button>
				<Button type="submit" disabled={isPending}>
					{isPending ? <Loader2 className="animate-spin" /> : null}
					{t("setup.account.submit")}
				</Button>
			</CardFooter>
			</form>
		</Card>
	);
}

export function SetupWizard({ company }: { company: CompanySettings }) {
	const [step, setStep] = useState(0);

	return (
		<div className="space-y-4">
			<StepProgress step={step} />

			{/* Alle Schritte bleiben gemountet (per CSS ausgeblendet), damit
			    Formularwerte beim Zurückblättern erhalten bleiben. */}
			<div className={step === 0 ? undefined : "hidden"}>
				<WelcomeStep onNext={() => setStep(1)} />
			</div>
			<div className={step === 1 ? undefined : "hidden"}>
				<ModeStep onDone={() => setStep(2)} onBack={() => setStep(0)} />
			</div>
			<div className={step === 2 ? undefined : "hidden"}>
				<CompanyStep initial={company} onDone={() => setStep(3)} onBack={() => setStep(1)} />
			</div>
			<div className={step === 3 ? undefined : "hidden"}>
				<IntegrationsStep onDone={() => setStep(4)} onBack={() => setStep(2)} />
			</div>
			<div className={step === 4 ? undefined : "hidden"}>
				<RecoveryKeyStep active={step === 4} onDone={() => setStep(5)} onBack={() => setStep(3)} />
			</div>
			<div className={step === 5 ? undefined : "hidden"}>
				<AccountStep onBack={() => setStep(4)} />
			</div>
		</div>
	);
}
