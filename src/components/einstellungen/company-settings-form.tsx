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
import { useI18n } from "@/lib/i18n/provider";
import type { CompanySettings } from "@/data/types";

import { saveCompanySettingsAction } from "@/app/(app)/einstellungen/actions";

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
 * Inline-Formular (kein Dialog, da es nur diesen einen Datensatz gibt) zum
 * Pflegen der Absenderdaten - erscheinen als Briefkopf auf erzeugten PDFs
 * (aktuell: Nebenkostenabrechnungen, siehe src/lib/pdf/billing-statement.ts).
 */
export function CompanySettingsForm({ settings }: { settings: CompanySettings }) {
	const { t } = useI18n();
	const [state, formAction] = useActionState(saveCompanySettingsAction, initialActionState);

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>{t("settings.cards.company.title")}</CardTitle>
				<CardDescription>
					{t("settings.cards.company.description")}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={formAction} className="space-y-4">
					<div className="grid gap-2">
						<Label htmlFor="name">{t("settings.cards.company.name")}</Label>
						<Input id="name" name="name" defaultValue={settings.name} placeholder={t("settings.cards.company.namePlaceholder")} />
					</div>

					<div className="grid gap-2">
						<Label htmlFor="street">{t("settings.cards.company.street")}</Label>
						<Input id="street" name="street" defaultValue={settings.street} placeholder={t("settings.cards.company.streetPlaceholder")} />
					</div>

					<div className="grid grid-cols-3 gap-4">
						<div className="col-span-1 grid gap-2">
							<Label htmlFor="zipCode">{t("settings.cards.company.zipCode")}</Label>
							<Input id="zipCode" name="zipCode" defaultValue={settings.zipCode} placeholder={t("settings.cards.company.zipCodePlaceholder")} />
						</div>
						<div className="col-span-2 grid gap-2">
							<Label htmlFor="city">{t("settings.cards.company.city")}</Label>
							<Input id="city" name="city" defaultValue={settings.city} placeholder={t("settings.cards.company.cityPlaceholder")} />
						</div>
					</div>

					<div className="grid gap-2">
						<Label htmlFor="additional">{t("settings.cards.company.additional")}</Label>
						<Textarea
							id="additional"
							name="additional"
							defaultValue={settings.additional ?? ""}
							placeholder={t("settings.cards.company.additionalPlaceholder")}
							className="min-h-24"
						/>
						<p className="text-xs text-muted-foreground">{t("settings.cards.company.additionalHint")}</p>
					</div>

					{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
					{state.success ? <p className="text-sm text-emerald-600">{t("settings.success.saved")}</p> : null}

					<div className="flex justify-end">
						<SubmitButton />
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
