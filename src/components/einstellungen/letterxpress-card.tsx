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

import { saveLetterXpressSettingsAction } from "@/app/(app)/einstellungen/actions";

export interface LetterXpressSettings {
	lxUsername: string;
	lxApiKeySet: boolean;
	lxMode: "test" | "live";
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
 * Einstellungen für den optionalen Postversand von PDFs über die
 * LetterXpress-API. Ohne Zugangsdaten sind die Versand-Schaltflächen
 * deaktiviert.
 *
 * Der gespeicherte API-Schlüssel wird aus Sicherheitsgründen NICHT
 * vorausgefüllt - leeres Feld = unverändert lassen.
 */
export function LetterXpressCard({ settings }: { settings: LetterXpressSettings }) {
	const { t } = useI18n();
	const [state, formAction] = useActionState(saveLetterXpressSettingsAction, initialActionState);

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>{t("settings.cards.letterxpress.title")}</CardTitle>
				<CardDescription>
					{t("settings.cards.letterxpress.description")}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={formAction} className="space-y-4">
					<div className="grid grid-cols-2 gap-4">
						<div className="grid gap-2">
							<Label htmlFor="lxUsername">{t("settings.fields.username")}</Label>
							<Input id="lxUsername" name="lxUsername" defaultValue={settings.lxUsername} autoComplete="off" />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="lxApiKey">{t("settings.cards.letterxpress.apiKey")}</Label>
							<Input
								id="lxApiKey"
								name="lxApiKey"
								type="password"
								placeholder={settings.lxApiKeySet ? t("settings.password.savedPlaceholder") : ""}
								autoComplete="new-password"
							/>
						</div>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="lxMode">{t("settings.cards.letterxpress.mode")}</Label>
						<select id="lxMode" name="lxMode" defaultValue={settings.lxMode} className="h-9 rounded-md border bg-background px-3 text-sm">
							<option value="test">{t("settings.cards.letterxpress.mode.test")}</option>
							<option value="live">{t("settings.cards.letterxpress.mode.live")}</option>
						</select>
					</div>
					<p className="text-xs text-muted-foreground">{t("settings.cards.letterxpress.hint")}</p>

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
