"use client";

import { useActionState, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, SkipForward } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState, type ActionState } from "@/lib/action-state";
import type { CompanySettings } from "@/data/types";
import type { IntegrationSettings } from "@/components/einstellungen/integration-settings-form";

import { setupAccountAction, setupCompanySettingsAction, setupIntegrationSettingsAction } from "@/app/(setup)/setup/actions";

/**
 * Setup-Wizard für die Ersteinrichtung (Route /setup, nur erreichbar solange
 * noch kein Benutzerkonto existiert):
 *
 *   1. Willkommen (Einführung)
 *   2. Absenderdaten für erzeugte PDFs (überspringbar)
 *   3. Online-Integrationen SMTP/LetterXpress (überspringbar)
 *   4. Administratorkonto anlegen (erforderlich, letzter Schritt)
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

const STEP_TITLES = ["Willkommen", "Absenderdaten", "Online-Integrationen", "Administratorkonto"];

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
			<CardContent className="space-y-3 text-sm text-muted-foreground">
				<p>ImmoBase läuft vollständig offline – alle Daten bleiben auf diesem Rechner.</p>
				<p>Die folgenden Schritte richten die App ein:</p>
				<ul className="list-disc space-y-1 pl-5">
					<li>Absenderdaten für erzeugte PDFs (optional)</li>
					<li>Online-Integrationen für E-Mail- und Postversand (optional)</li>
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
				<CardContent className="space-y-4">
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

function IntegrationsStep({
	initial,
	onDone,
	onBack,
}: {
	initial: IntegrationSettings;
	onDone: () => void;
	onBack: () => void;
}) {
	const [state, formAction, isPending] = useActionState(
		async (prevState: ActionState, formData: FormData) => {
			const result = await setupIntegrationSettingsAction(prevState, formData);
			if (result.success) onDone();
			return result;
		},
		initialActionState
	);

	return (
		<Card>
			<form action={formAction}>
				<CardHeader>
					<CardTitle>Online-Integrationen</CardTitle>
					<CardDescription>
						Die App läuft vollständig offline. Diese optionalen Dienste aktivieren E-Mail- bzw. Postversand und können
						jederzeit unter „Einstellungen“ eingerichtet werden.
					</CardDescription>
				</CardHeader>
				<CardContent className="space-y-6">
					<fieldset className="space-y-4">
						<legend className="text-sm font-medium">E-Mail-Versand (SMTP)</legend>
						<div className="grid grid-cols-3 gap-4">
							<div className="col-span-2 grid gap-2">
								<Label htmlFor="setup-smtpHost">SMTP-Server</Label>
								<Input id="setup-smtpHost" name="smtpHost" defaultValue={initial.smtpHost} placeholder="smtp.example.com" />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="setup-smtpPort">Port</Label>
								<Input id="setup-smtpPort" name="smtpPort" defaultValue={initial.smtpPort} placeholder="587" />
							</div>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="setup-smtpUser">Benutzername</Label>
								<Input id="setup-smtpUser" name="smtpUser" defaultValue={initial.smtpUser} autoComplete="off" />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="setup-smtpPass">Passwort</Label>
								<Input
									id="setup-smtpPass"
									name="smtpPass"
									type="password"
									placeholder={initial.smtpPassSet ? "•••••••• (gespeichert, unverändert wenn leer)" : ""}
									autoComplete="new-password"
								/>
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="setup-smtpFrom">Absenderadresse</Label>
							<Input id="setup-smtpFrom" name="smtpFrom" defaultValue={initial.smtpFrom} placeholder="verwaltung@example.com" />
						</div>
						<label className="flex items-center gap-2 text-sm">
							<input type="checkbox" name="smtpSecure" defaultChecked={initial.smtpSecure} />
							SSL/TLS (Port 465)
						</label>
						<p className="text-xs text-muted-foreground">
							Ohne SMTP-Konfiguration sind alle E-Mail-Funktionen (Verifizierung, Passwort-Reset) deaktiviert.
						</p>
					</fieldset>

					<fieldset className="space-y-4 border-t pt-4">
						<legend className="text-sm font-medium">Postversand (LetterXpress)</legend>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="setup-lxUsername">Benutzername</Label>
								<Input id="setup-lxUsername" name="lxUsername" defaultValue={initial.lxUsername} autoComplete="off" />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="setup-lxApiKey">API-Schlüssel</Label>
								<Input
									id="setup-lxApiKey"
									name="lxApiKey"
									type="password"
									placeholder={initial.lxApiKeySet ? "•••••••• (gespeichert, unverändert wenn leer)" : ""}
									autoComplete="new-password"
								/>
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="setup-lxMode">Modus</Label>
							<select
								id="setup-lxMode"
								name="lxMode"
								defaultValue={initial.lxMode}
								className="h-9 rounded-md border bg-background px-3 text-sm"
							>
								<option value="test">Test (kein echter Versand, Aufträge landen nur in der LetterXpress-Postbox)</option>
								<option value="live">Live (echter, kostenpflichtiger Versand)</option>
							</select>
						</div>
					</fieldset>

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
				<CardContent className="grid gap-4">
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

export function SetupWizard({ company, integrations }: { company: CompanySettings; integrations: IntegrationSettings }) {
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
				<CompanyStep initial={company} onDone={() => setStep(2)} onBack={() => setStep(0)} />
			</div>
			<div className={step === 2 ? undefined : "hidden"}>
				<IntegrationsStep initial={integrations} onDone={() => setStep(3)} onBack={() => setStep(1)} />
			</div>
			<div className={step === 3 ? undefined : "hidden"}>
				<AccountStep onBack={() => setStep(2)} />
			</div>
		</div>
	);
}
