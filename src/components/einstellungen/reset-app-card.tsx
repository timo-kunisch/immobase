"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { resetApplicationAction } from "@/app/(app)/einstellungen/actions";
import { RESET_CONFIRMATION_PHRASE } from "@/app/(app)/einstellungen/reset-confirmation";

/**
 * Karte "Anwendung zurücksetzen" (Gefahrenbereich am Ende der
 * Einstellungen). Löscht über resetApplicationAction unwiderruflich die
 * gesamte Datenbank, alle abgelegten Dateien und lokalen Sicherungen
 * (Details: src/data/reset.ts) und führt zurück zur Ersteinrichtung. Die
 * Seite ist bereits über das Layout auf Admins beschränkt; die Server
 * Action prüft requireAdmin() zusätzlich selbst.
 */
export function ResetAppCard() {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);

	return (
		<Card className="max-w-xl border-destructive/50">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-destructive">
					<TriangleAlert className="size-5" />
					{t("settings.cards.reset.title")}
				</CardTitle>
				<CardDescription>
					{t("settings.cards.reset.description")}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Dialog open={open} onOpenChange={setOpen}>
					<DialogTrigger asChild>
						<Button type="button" variant="destructive">
							<TriangleAlert />
							{t("settings.cards.reset.button")}
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-lg">
						{/* Eigene Komponente für den Inhalt: Radix unmountet beim
						    Schließen - so starten Formular- und Action-State bei jedem
						    Öffnen frisch (Muster: contact-admin-dialog.tsx). */}
						<ResetAppDialogContent />
					</DialogContent>
				</Dialog>
			</CardContent>
		</Card>
	);
}

function ResetAppDialogContent() {
	const { t } = useI18n();
	const [state, formAction, isPending] = useActionState(resetApplicationAction, initialActionState);
	const [confirmation, setConfirmation] = useState("");

	const confirmed = confirmation.trim() === RESET_CONFIRMATION_PHRASE;

	// Nach erfolgreichem Reset: vollständiger Seiten-Neuaufruf der
	// Ersteinrichtung (kein Router-Navigation, damit auch sämtliche
	// clientseitigen Caches verworfen werden - die bisherigen Daten
	// existieren nicht mehr).
	useEffect(() => {
		if (!state.success) return;
		const timer = setTimeout(() => window.location.assign("/setup"), 2000);
		return () => clearTimeout(timer);
	}, [state.success]);

	if (state.success) {
		return (
			<>
				<DialogHeader>
					<DialogTitle>{t("settings.cards.reset.doneTitle")}</DialogTitle>
					<DialogDescription>{state.message}</DialogDescription>
				</DialogHeader>
				<p className="flex items-center gap-2 text-sm text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					{t("settings.cards.reset.redirecting")}
				</p>
			</>
		);
	}

	return (
		<form action={formAction}>
			<DialogHeader>
				<DialogTitle>{t("settings.cards.reset.dialogTitle")}</DialogTitle>
				<DialogDescription>{t("settings.cards.reset.dialogDescription")}</DialogDescription>
			</DialogHeader>

			<div className="grid gap-4 py-4">
				<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
					<p className="mb-1 font-medium text-destructive">{t("settings.cards.reset.deletedIntro")}</p>
					<ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
						<li>
							{t("settings.cards.reset.deletedDatabase")}
						</li>
						<li>{t("settings.cards.reset.deletedAccounts")}</li>
						<li>{t("settings.cards.reset.deletedSettings")}</li>
						<li>{t("settings.cards.reset.deletedFiles")}</li>
						<li>{t("settings.cards.reset.deletedBackups")}</li>
					</ul>
				</div>

				<div className="grid gap-2">
					<Label htmlFor="reset-confirmation">
						{t("settings.cards.reset.confirmLabel", { phrase: RESET_CONFIRMATION_PHRASE })}
					</Label>
					<Input
						id="reset-confirmation"
						name="confirmation"
						value={confirmation}
						onChange={(event) => setConfirmation(event.target.value)}
						placeholder={RESET_CONFIRMATION_PHRASE}
						autoComplete="off"
						disabled={isPending}
					/>
				</div>

				{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
			</div>

			<DialogFooter>
				<DialogClose asChild>
					<Button type="button" variant="outline" disabled={isPending}>
						{t("common.cancel")}
					</Button>
				</DialogClose>
				<Button type="submit" variant="destructive" disabled={!confirmed || isPending}>
					{isPending ? <Loader2 className="animate-spin" /> : <TriangleAlert />}
					{t("settings.cards.reset.confirmButton")}
				</Button>
			</DialogFooter>
		</form>
	);
}
