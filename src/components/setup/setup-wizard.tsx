"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Copy, KeyRound, Loader2, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState, type ActionState } from "@/lib/action-state";
import { getDesktopBridge } from "@/lib/desktop-bridge";
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

const STEP_TITLES = [
	"Willkommen",
	"Betriebsmodus",
	"Absenderdaten",
	"Online-Integrationen",
	"Wiederherstellungsschlüssel",
	"Administratorkonto",
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
	return (
		<div className="space-y-2">
			<div className="flex gap-1.5">
				{STEP_TITLES.map((title, index) => (
					<div key={title} className={`h-1.5 flex-1 rounded-full ${index <= step ? "bg-primary" : "bg-border"}`} />
				))}
			</div>
			<p className="text-sm text-muted-foreground">
				Schritt {step + 1} von {STEP_TITLES.length}: {STEP_TITLES[step]}
			</p>
		</div>
	);
}

function WelcomeStep({ onNext }: { onNext: () => void }) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Willkommen bei ImmoBase</CardTitle>
				<CardDescription>
					Die Ersteinrichtung führt Sie in wenigen Schritten durch die Grundeinstellungen der App.
				</CardDescription>
			</CardHeader>
			<CardContent className={`${STEP_CONTENT} space-y-3 text-sm text-muted-foreground`}>
			<p>ImmoBase läuft vollständig offline – alle Daten bleiben auf diesem Rechner.</p>
			<p>Die folgenden Schritte richten die App ein:</p>
			<ul className="list-disc space-y-1 pl-5">
				<li>Betriebsmodus (Lokal/Host/Client – Desktop-App)</li>
				<li>Absenderdaten für erzeugte PDFs (optional)</li>
				<li>Online-Integrationen (Überblick – die Einrichtung erfolgt später unter „Einstellungen“)</li>
				<li>Wiederherstellungsschlüssel der lokalen Datenverschlüsselung sichern (erforderlich)</li>
				<li>Ihr Administratorkonto (erforderlich)</li>
			</ul>
				<p>Optionale Schritte können übersprungen und jederzeit unter „Einstellungen“ nachgeholt werden.</p>
			</CardContent>
			<CardFooter className="justify-end">
				<Button onClick={onNext}>
					Einrichtung starten
					<ChevronRight />
				</Button>
			</CardFooter>
		</Card>
	);
}

type AppMode = "local" | "host" | "client";

const MODE_OPTIONS: { value: AppMode; title: string; description: string }[] = [
	{ value: "local", title: "Lokal (Standard)", description: "Nur dieser Rechner. Alle Daten bleiben hier." },
	{ value: "host", title: "Host", description: "Dieser Rechner stellt die Daten im lokalen Netzwerk bereit." },
	{ value: "client", title: "Client", description: "Mit einem Host im lokalen Netzwerk verbinden (keine lokalen Daten)." },
];

/**
 * Setup-Schritt „Betriebsmodus“ (nur Desktop-App): übernimmt die Wahl per
 * IPC an den Main-Prozess (iv:set-mode). Erststart: Der eingebettete Server
 * läuft bereits im lokalen Modus, daher ist "Lokal" vorausgewählt und ein
 * Neustart entfällt (der Main-Prozess wendet die Wahl idempotent an).
 */
function ModeStep({ onDone, onBack }: { onDone: () => void; onBack: () => void }) {
	const bridge = getDesktopBridge();
	const [selected, setSelected] = useState<AppMode>("local");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

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
		setError(null);
		try {
			const result = await bridge.setMode(selected);
			if (!result.ok) {
				setError(result.error ?? "Der Modus konnte nicht übernommen werden.");
				return;
			}
			// Bei "client" wechselt das Fenster automatisch auf die
			// Verbindungsseite der Shell (Host wählen + Token) – der Wizard
			// endet auf diesem Gerät hier.
			if (selected !== "client") onDone();
		} catch {
			setError("Der Modus konnte nicht übernommen werden.");
		} finally {
			setBusy(false);
		}
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Betriebsmodus</CardTitle>
				<CardDescription>
					Wie möchten Sie ImmoBase nutzen? Die Wahl ist später jederzeit unter „Einstellungen“ → „Verbindung &amp;
					Mehrbenutzer“ änderbar.
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
							<span className="block text-sm font-medium">{option.title}</span>
							<span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
						</button>
					))}
				</div>

				{!bridge ? (
					<p className="text-xs text-muted-foreground">
						Die Modus-Auswahl steht nur in der Desktop-App zur Verfügung – im Browser läuft ImmoBase immer lokal auf
						diesem Rechner.
					</p>
				) : (
					<p className="text-xs text-muted-foreground">
						Die Datenbank liegt immer auf der lokalen Festplatte des Hosts – niemals auf einem Netzlaufwerk
						(SMB/NFS). Clients benötigen die Adresse des Hosts und das Zugangs-Token.
					</p>
				)}

				{bridge && selected === "client" ? (
					<p className="text-xs text-muted-foreground">
						Im Client-Modus werden auf diesem Gerät keine Daten gespeichert. Nach der Auswahl öffnet sich die
						Verbindungsseite, auf der Sie den Host auswählen und das Zugangs-Token eingeben. Die übrigen
						Einrichtungsschritte entfallen auf diesem Gerät – sie werden auf dem Host durchgeführt.
					</p>
				) : null}

				{error ? <p className="text-sm text-destructive">{error}</p> : null}
			</CardContent>
			<CardFooter className="justify-between">
				<Button type="button" variant="ghost" onClick={onBack}>
					<ChevronLeft />
					Zurück
				</Button>
				<Button type="button" onClick={() => void handleNext()} disabled={busy}>
					{busy ? <Loader2 className="animate-spin" /> : null}
					Weiter
					<ChevronRight />
				</Button>
			</CardFooter>
		</Card>
	);
}

function CompanyStep({ initial, onDone, onBack }: { initial: CompanySettings; onDone: () => void; onBack: () => void }) {
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
					<CardTitle>Absenderdaten</CardTitle>
					<CardDescription>
						Diese Angaben erscheinen als Briefkopf auf erzeugten PDFs (z. B. Nebenkostenabrechnungen). Optional –
						jederzeit unter „Einstellungen“ nachpflegbar.
					</CardDescription>
				</CardHeader>
				<CardContent className={`${STEP_CONTENT} space-y-4`}>
					<div className="grid gap-2">
						<Label htmlFor="setup-name">Name / Firma</Label>
						<Input id="setup-name" name="name" defaultValue={initial.name} placeholder="Max Mustermann Hausverwaltung" />
					</div>

					<div className="grid gap-2">
						<Label htmlFor="setup-street">Straße und Hausnummer</Label>
						<Input id="setup-street" name="street" defaultValue={initial.street} placeholder="Musterstraße 1" />
					</div>

					<div className="grid grid-cols-3 gap-4">
						<div className="col-span-1 grid gap-2">
							<Label htmlFor="setup-zipCode">PLZ</Label>
							<Input id="setup-zipCode" name="zipCode" defaultValue={initial.zipCode} placeholder="12345" />
						</div>
						<div className="col-span-2 grid gap-2">
							<Label htmlFor="setup-city">Ort</Label>
							<Input id="setup-city" name="city" defaultValue={initial.city} placeholder="Musterstadt" />
						</div>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="setup-additional">Weitere Angaben</Label>
						<Textarea
							id="setup-additional"
							name="additional"
							defaultValue={initial.additional ?? ""}
							placeholder="z. B. Bankverbindung, Steuernummer, Kontaktdaten"
							className="min-h-24"
						/>
					</div>

					{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
				</CardContent>
				<CardFooter className="justify-between">
					<Button type="button" variant="ghost" onClick={onBack}>
						<ChevronLeft />
						Zurück
					</Button>
					<div className="flex gap-2">
						<Button type="button" variant="outline" onClick={onDone}>
							<SkipForward />
							Überspringen
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							Speichern und weiter
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
	return (
		<Card>
			<CardHeader>
				<CardTitle>Online-Integrationen (optional)</CardTitle>
				<CardDescription>
					ImmoBase läuft vollständig offline – alle Daten bleiben auf diesem Rechner. Die folgenden optionalen
					Dienste richten Sie bei Bedarf nach der Einrichtung unter „Einstellungen“ ein.
				</CardDescription>
			</CardHeader>
			<CardContent className={`${STEP_CONTENT} space-y-4 text-sm`}>
				<div>
					<p className="font-medium">Einstellungen → „Integrationen &amp; KI“</p>
					<ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
						<li>E-Mail-Versand (SMTP) – z. B. für Verifizierungs- und Ticket-E-Mails</li>
						<li>E-Mail-Postfach (IMAP) – eingehende E-Mails im Ticket-System</li>
						<li>Postversand (LetterXpress) – PDFs (z. B. Abrechnungen) als physische Briefe</li>
						<li>KI-Assistent – Chatbot in der Sidebar über einen OpenAI-kompatiblen Endpunkt</li>
						<li>MCP-Server – lesender und schreibender Zugriff externer KI-Clients auf die Fachdaten</li>
					</ul>
				</div>
				<div>
					<p className="font-medium">Einstellungen → „Datensicherung“</p>
					<ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">
						<li>Dropbox-Backup – automatische, optional passwortgeschützte Cloud-Sicherung</li>
					</ul>
				</div>
				<p className="text-xs text-muted-foreground">
					Ohne SMTP-Konfiguration sind alle E-Mail-Funktionen (Verifizierung, Passwort-Reset) deaktiviert – das
					Ticket-System und alle übrigen Funktionen laufen uneingeschränkt offline.
				</p>
			</CardContent>
			<CardFooter className="justify-between">
				<Button type="button" variant="ghost" onClick={onBack}>
					<ChevronLeft />
					Zurück
				</Button>
				<Button type="button" onClick={onDone}>
					Weiter
					<ChevronRight />
				</Button>
			</CardFooter>
		</Card>
	);
}

function RecoveryKeyStep({ active, onDone, onBack }: { active: boolean; onDone: () => void; onBack: () => void }) {
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
					setError(result.error ?? "Der Wiederherstellungsschlüssel konnte nicht gelesen werden.");
				} else {
					setRecoveryKey(result.key);
				}
			})
			.catch(() => {
				if (!cancelled) setError("Der Wiederherstellungsschlüssel konnte nicht gelesen werden.");
			});
		return () => {
			cancelled = true;
		};
	}, [active, recoveryKey]);

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
					Wiederherstellungsschlüssel sichern
				</CardTitle>
				<CardDescription>
					ImmoBase verschlüsselt Ihre Datenbank, abgelegte Dateien und gespeicherte Zugangsdaten auf diesem Gerät
					(AES-256). Der Schlüssel dazu ist an dieses Gerät gebunden.
				</CardDescription>
			</CardHeader>
			<CardContent className={`${STEP_CONTENT} space-y-4 text-sm`}>
				<p className="text-muted-foreground">
					Mit dem folgenden Wiederherstellungsschlüssel können Sie Ihre Daten entschlüsseln, falls der
					Geräteschlüssel verloren geht (z. B. nach einer Neuinstallation des Betriebssystems). Verwahren Sie ihn
					wie ein Passwort an einem sicheren Ort – ohne ihn sind die verschlüsselten Daten in diesem Fall
					unwiederbringlich verloren. Wer den Schlüssel besitzt, kann sämtliche Daten entschlüsseln: zeigen Sie
					ihn niemandem.
				</p>

				{error ? <p className="text-sm text-destructive">{error}</p> : null}
				{recoveryKey === null && !error ? (
					<p className="flex items-center gap-2 text-muted-foreground">
						<Loader2 className="size-4 animate-spin" />
						Schlüssel wird geladen …
					</p>
				) : null}
				{recoveryKey !== null ? (
					<div className="space-y-2">
						<code className="block break-all rounded-md border bg-muted p-3 text-xs select-all">{recoveryKey}</code>
						<Button type="button" variant="outline" size="sm" onClick={handleCopy}>
							{copied ? <Check /> : <Copy />}
							{copied ? "Kopiert" : "In die Zwischenablage kopieren"}
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
					Ich habe den Wiederherstellungsschlüssel sicher außerhalb dieses Geräts verwahrt (z. B. notiert oder in
					einem Passwort-Manager).
				</label>

				<p className="text-xs text-muted-foreground">
					Der Schlüssel ist später jederzeit unter „Einstellungen“ → „Lokale Datenverschlüsselung“ erneut einsehbar.
				</p>
			</CardContent>
			<CardFooter className="justify-between">
				<Button type="button" variant="ghost" onClick={onBack}>
					<ChevronLeft />
					Zurück
				</Button>
				<Button type="button" onClick={onDone} disabled={recoveryKey === null || !confirmed}>
					Weiter
					<ChevronRight />
				</Button>
			</CardFooter>
		</Card>
	);
}

function AccountStep({ onBack }: { onBack: () => void }) {
	// Bei Erfolg leitet die Action selbst weiter ("/" bei direkter Anmeldung
	// bzw. "/login?...&emailSent=1" bei konfiguriertem SMTP).
	const [state, formAction, isPending] = useActionState(setupAccountAction, initialActionState);

	return (
		<Card>
			<form action={formAction}>
				<CardHeader>
					<CardTitle>Administratorkonto anlegen</CardTitle>
					<CardDescription>
						Zum Abschluss wird Ihr Benutzerkonto angelegt. Das erste Konto erhält automatisch Administrator-Rechte.
					</CardDescription>
				</CardHeader>
				<CardContent className={`${STEP_CONTENT} grid gap-4`}>
					<div className="grid gap-2">
						<Label htmlFor="setup-email">E-Mail-Adresse</Label>
						<Input id="setup-email" name="email" type="email" autoComplete="email" required />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="setup-password">Passwort</Label>
						<Input id="setup-password" name="password" type="password" autoComplete="new-password" minLength={8} required />
					</div>
					<div className="grid gap-2">
						<Label htmlFor="setup-passwordConfirm">Passwort wiederholen</Label>
						<Input
							id="setup-passwordConfirm"
							name="passwordConfirm"
							type="password"
							autoComplete="new-password"
							minLength={8}
							required
						/>
					</div>
					{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
				</CardContent>
				<CardFooter className="justify-between">
					<Button type="button" variant="ghost" onClick={onBack}>
						<ChevronLeft />
						Zurück
					</Button>
					<Button type="submit" disabled={isPending}>
						{isPending ? <Loader2 className="animate-spin" /> : null}
						Konto erstellen und Einrichtung abschließen
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
