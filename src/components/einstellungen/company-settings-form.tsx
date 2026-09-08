"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";
import type { CompanySettings } from "@/data/types";

import { saveCompanySettingsAction } from "@/app/(app)/einstellungen/actions";

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
 * Inline-Formular (kein Dialog, da es nur diesen einen Datensatz gibt) zum
 * Pflegen der Absenderdaten - erscheinen als Briefkopf auf erzeugten PDFs
 * (aktuell: Nebenkostenabrechnungen, siehe src/lib/pdf/billing-statement.ts).
 */
export function CompanySettingsForm({ settings }: { settings: CompanySettings }) {
	const [state, formAction] = useActionState(saveCompanySettingsAction, initialActionState);

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>Absenderdaten</CardTitle>
				<CardDescription>
					Diese Angaben erscheinen als Briefkopf auf erzeugten PDFs (aktuell: Nebenkostenabrechnungen).
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={formAction} className="space-y-4">
					<div className="grid gap-2">
						<Label htmlFor="name">Name / Firma</Label>
						<Input id="name" name="name" defaultValue={settings.name} placeholder="Max Mustermann Hausverwaltung" />
					</div>

					<div className="grid gap-2">
						<Label htmlFor="street">Straße und Hausnummer</Label>
						<Input id="street" name="street" defaultValue={settings.street} placeholder="Musterstraße 1" />
					</div>

					<div className="grid grid-cols-3 gap-4">
						<div className="col-span-1 grid gap-2">
							<Label htmlFor="zipCode">PLZ</Label>
							<Input id="zipCode" name="zipCode" defaultValue={settings.zipCode} placeholder="12345" />
						</div>
						<div className="col-span-2 grid gap-2">
							<Label htmlFor="city">Ort</Label>
							<Input id="city" name="city" defaultValue={settings.city} placeholder="Musterstadt" />
						</div>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="additional">Weitere Angaben</Label>
						<Textarea
							id="additional"
							name="additional"
							defaultValue={settings.additional ?? ""}
							placeholder="z. B. Bankverbindung, Steuernummer, Kontaktdaten"
							className="min-h-24"
						/>
						<p className="text-xs text-muted-foreground">Wird unverändert am Ende des Briefkopfs von erzeugten PDFs ausgegeben (aktuell: Nebenkostenabrechnungen).</p>
					</div>

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
