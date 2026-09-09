"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";

import { saveLetterXpressSettingsAction } from "@/app/(app)/einstellungen/actions";

export interface LetterXpressSettings {
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
 * Einstellungen für den optionalen Postversand von PDFs über die
 * LetterXpress-API. Ohne Zugangsdaten sind die Versand-Schaltflächen
 * deaktiviert.
 *
 * Der gespeicherte API-Schlüssel wird aus Sicherheitsgründen NICHT
 * vorausgefüllt - leeres Feld = unverändert lassen.
 */
export function LetterXpressCard({ settings }: { settings: LetterXpressSettings }) {
	const [state, formAction] = useActionState(saveLetterXpressSettingsAction, initialActionState);

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>Postversand (LetterXpress, optional)</CardTitle>
				<CardDescription>
					PDF-Dokumente (z. B. Abrechnungen) als physische Briefe über die LetterXpress-API versenden.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={formAction} className="space-y-4">
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
					<p className="text-xs text-muted-foreground">Ohne Zugangsdaten sind die Postversand-Schaltflächen deaktiviert.</p>

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
