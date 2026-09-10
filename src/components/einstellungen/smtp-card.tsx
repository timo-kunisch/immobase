"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Save } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { saveSmtpSettingsAction } from "@/app/(app)/einstellungen/actions";

export interface SmtpSettings {
	smtpHost: string;
	smtpPort: string;
	smtpSecure: boolean;
	smtpUser: string;
	smtpPassSet: boolean;
	smtpFrom: string;
}

function SubmitButton() {
	const { pending } = useFormStatus();
	const { t } = useI18n();
	return (
		<Button type="submit" disabled={pending}>
			{pending ? <Loader2 className="animate-spin" /> : <Save />}
			{t("common.save")}
		</Button>
	);
}

/**
 * Einstellungen für den optionalen E-Mail-Versand (SMTP). Ohne Konfiguration
 * bleibt die App vollständig offline nutzbar - alle E-Mail-Funktionen
 * (Verifizierung, Passwort-Reset, Ticket-Antworten) sind dann deaktiviert.
 *
 * Das gespeicherte Passwort wird aus Sicherheitsgründen NICHT vorausgefüllt
 * - leeres Feld = unverändert lassen.
 */
export function SmtpCard({ settings }: { settings: SmtpSettings }) {
	const { t } = useI18n();
	const [state, formAction] = useActionState(saveSmtpSettingsAction, initialActionState);

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>{t("settings.cards.smtp.title")}</CardTitle>
				<CardDescription>
					{t("settings.cards.smtp.description")}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={formAction} className="space-y-4">
					<div className="grid grid-cols-3 gap-4">
						<div className="col-span-2 grid gap-2">
							<Label htmlFor="smtpHost">{t("settings.cards.smtp.host")}</Label>
							<Input id="smtpHost" name="smtpHost" defaultValue={settings.smtpHost} placeholder="smtp.example.com" />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="smtpPort">{t("settings.fields.port")}</Label>
							<Input id="smtpPort" name="smtpPort" defaultValue={settings.smtpPort} placeholder="587" />
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="grid gap-2">
							<Label htmlFor="smtpUser">{t("settings.fields.username")}</Label>
							<Input id="smtpUser" name="smtpUser" defaultValue={settings.smtpUser} autoComplete="off" />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="smtpPass">{t("settings.fields.password")}</Label>
							<Input
								id="smtpPass"
								name="smtpPass"
								type="password"
								placeholder={settings.smtpPassSet ? t("settings.password.savedPlaceholder") : ""}
								autoComplete="new-password"
							/>
						</div>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="smtpFrom">{t("settings.cards.smtp.from")}</Label>
						<Input id="smtpFrom" name="smtpFrom" defaultValue={settings.smtpFrom} placeholder="verwaltung@example.com" />
					</div>
					<label className="flex items-center gap-2 text-sm">
						<input type="checkbox" name="smtpSecure" defaultChecked={settings.smtpSecure} />
						{t("settings.cards.smtp.secure")}
					</label>
					<p className="text-xs text-muted-foreground">
						{t("settings.cards.smtp.hint")}
					</p>

<ActionErrorToast state={state} />
				{state.success ? <p className="text-sm text-emerald-600">{t("settings.success.saved")}</p> : null}

					<div className="flex justify-end">
						<SubmitButton />
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
