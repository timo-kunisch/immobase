"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";

import { saveIntegrationSettingsAction } from "@/app/(app)/einstellungen/actions";

export interface IntegrationSettings {
	smtpHost: string;
	smtpPort: string;
	smtpSecure: boolean;
	smtpUser: string;
	smtpPassSet: boolean;
	smtpFrom: string;
	lxUsername: string;
	lxApiKeySet: boolean;
	lxMode: "test" | "live";
}

function SubmitButton() {
	const { pending } = useFormStatus();
	return (
		<Button type="submit" disabled={pending}>
			{pending ? <Loader2 className="animate-spin" /> : <Save />}
			Speichern
		</Button>
	);
}

/**
 * Einstellungen für die optionalen Online-Integrationen (SMTP-E-Mail-Versand,
 * LetterXpress-Postversand). Ohne Konfiguration bleibt die App vollständig
 * offline nutzbar: Alle E-Mail-Funktionen sind dann deaktiviert und die
 * Postversand-Schaltflächen sind gesperrt.
 *
 * Gespeicherte Geheimnisse (SMTP-Passwort, LetterXpress-API-Key) werden aus
 * Sicherheitsgründen NICHT vorausgefüllt - leeres Feld = unverändert lassen.
 */
export function IntegrationSettingsForm({ settings }: { settings: IntegrationSettings }) {
	const [state, formAction] = useActionState(saveIntegrationSettingsAction, initialActionState);

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>Online-Integrationen (optional)</CardTitle>
				<CardDescription>
					Die App läuft vollständig offline. Diese optionalen Dienste aktivieren E-Mail- bzw. Postversand.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={formAction} className="space-y-6">
					<fieldset className="space-y-4">
						<legend className="text-sm font-medium">E-Mail-Versand (SMTP)</legend>
						<div className="grid grid-cols-3 gap-4">
							<div className="col-span-2 grid gap-2">
								<Label htmlFor="smtpHost">SMTP-Server</Label>
								<Input id="smtpHost" name="smtpHost" defaultValue={settings.smtpHost} placeholder="smtp.example.com" />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="smtpPort">Port</Label>
								<Input id="smtpPort" name="smtpPort" defaultValue={settings.smtpPort} placeholder="587" />
							</div>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="smtpUser">Benutzername</Label>
								<Input id="smtpUser" name="smtpUser" defaultValue={settings.smtpUser} autoComplete="off" />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="smtpPass">Passwort</Label>
								<Input
									id="smtpPass"
									name="smtpPass"
									type="password"
									placeholder={settings.smtpPassSet ? "•••••••• (gespeichert, unverändert wenn leer)" : ""}
									autoComplete="new-password"
								/>
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="smtpFrom">Absenderadresse</Label>
							<Input id="smtpFrom" name="smtpFrom" defaultValue={settings.smtpFrom} placeholder="verwaltung@example.com" />
						</div>
						<label className="flex items-center gap-2 text-sm">
							<input type="checkbox" name="smtpSecure" defaultChecked={settings.smtpSecure} />
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
								<Label htmlFor="lxUsername">Benutzername</Label>
								<Input id="lxUsername" name="lxUsername" defaultValue={settings.lxUsername} autoComplete="off" />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="lxApiKey">API-Schlüssel</Label>
								<Input
									id="lxApiKey"
									name="lxApiKey"
									type="password"
									placeholder={settings.lxApiKeySet ? "•••••••• (gespeichert, unverändert wenn leer)" : ""}
									autoComplete="new-password"
								/>
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="lxMode">Modus</Label>
							<select id="lxMode" name="lxMode" defaultValue={settings.lxMode} className="h-9 rounded-md border bg-background px-3 text-sm">
								<option value="test">Test (kein echter Versand, Aufträge landen nur in der LetterXpress-Postbox)</option>
								<option value="live">Live (echter, kostenpflichtiger Versand)</option>
							</select>
						</div>
					</fieldset>

					{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
					{state.success ? <p className="text-sm text-emerald-600">Die Einstellungen wurden gespeichert.</p> : null}

					<div className="flex justify-end">
						<SubmitButton />
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
