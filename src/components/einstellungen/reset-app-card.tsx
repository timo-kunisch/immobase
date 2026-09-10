"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, ShieldCheck, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { resetApplicationAction, resetApplicationContentAction } from "@/app/(app)/einstellungen/actions";
import { RESET_CONFIRMATION_PHRASE, RESET_CONTENT_CONFIRMATION_PHRASE } from "@/app/(app)/einstellungen/reset-confirmation";

/**
 * Karte "Zurücksetzen" (Gefahrenbereich am Ende der Einstellungen) mit
 * zwei Varianten:
 * - "Inhalte zurücksetzen": löscht alle Fachdaten und Dateien, behält
 *   Benutzerkonten und Einstellungen (resetApplicationContentAction) -
 *   die Seite wird danach neu geladen.
 * - "Inhalte und Einstellungen zurücksetzen": vollständiger Factory-Reset
 *   (resetApplicationAction, Details: src/data/reset.ts) mit Weiterleitung
 *   zur Ersteinrichtung.
 * Die Seite ist bereits über das Layout auf Admins beschränkt; die Server
 * Actions prüfen requireAdmin() zusätzlich selbst.
 */
export function ResetAppCard() {
	const { t } = useI18n();
	const [contentOpen, setContentOpen] = useState(false);
	const [fullOpen, setFullOpen] = useState(false);

	return (
		<Card className="max-w-xl border-destructive/50">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-destructive">
					<TriangleAlert className="size-5" />
					{t("settings.cards.reset.title")}
				</CardTitle>
				<CardDescription>{t("settings.cards.reset.description")}</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-wrap gap-2">
				<Dialog open={contentOpen} onOpenChange={setContentOpen}>
					<DialogTrigger asChild>
						<Button type="button" variant="destructive">
							<TriangleAlert />
							{t("settings.cards.reset.content.button")}
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-lg">
						{/* Eigene Komponente für den Inhalt: Radix unmountet beim
						    Schließen - so starten Formular- und Action-State bei jedem
						    Öffnen frisch (Muster: contact-admin-dialog.tsx). */}
						<ResetDialogContent variant="content" />
					</DialogContent>
				</Dialog>
				<Dialog open={fullOpen} onOpenChange={setFullOpen}>
					<DialogTrigger asChild>
						<Button type="button" variant="destructive">
							<TriangleAlert />
							{t("settings.cards.reset.full.button")}
						</Button>
					</DialogTrigger>
					<DialogContent className="sm:max-w-lg">
						<ResetDialogContent variant="full" />
					</DialogContent>
				</Dialog>
			</CardContent>
		</Card>
	);
}

type ResetVariant = "content" | "full";

function ResetDialogContent({ variant }: { variant: ResetVariant }) {
	const { t } = useI18n();
	const isFull = variant === "full";
	const [state, formAction, isPending] = useActionState(
		isFull ? resetApplicationAction : resetApplicationContentAction,
		initialActionState,
	);
	const phrase = isFull ? RESET_CONFIRMATION_PHRASE : RESET_CONTENT_CONFIRMATION_PHRASE;
	const [confirmation, setConfirmation] = useState("");

	const confirmed = confirmation.trim() === phrase;

	// Nach erfolgreichem Reset: vollständiger Seiten-Neuaufruf (kein
	// Router-Navigation, damit auch sämtliche clientseitigen Caches
	// verworfen werden). Beim vollständigen Reset ist das die
	// Ersteinrichtung (die bisherigen Daten existieren nicht mehr), beim
	// Inhalts-Reset die aktuelle Seite (Konten/Einstellungen bestehen
	// weiter, alle Listen müssen neu geladen werden).
	useEffect(() => {
		if (!state.success) return;
		const timer = setTimeout(
			() => {
				if (isFull) window.location.assign("/setup");
				else window.location.reload();
			},
			2000,
		);
		return () => clearTimeout(timer);
	}, [state.success, isFull]);

	if (state.success) {
		return (
			<>
				<DialogHeader>
					<DialogTitle>
						{isFull ? t("settings.cards.reset.full.doneTitle") : t("settings.cards.reset.content.doneTitle")}
					</DialogTitle>
					<DialogDescription>{state.message}</DialogDescription>
				</DialogHeader>
				<p className="flex items-center gap-2 text-sm text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					{isFull ? t("settings.cards.reset.full.redirecting") : t("settings.cards.reset.content.reloading")}
				</p>
			</>
		);
	}

	return (
		<form action={formAction}>
			<DialogHeader>
				<DialogTitle>
					{isFull ? t("settings.cards.reset.full.dialogTitle") : t("settings.cards.reset.content.dialogTitle")}
				</DialogTitle>
				<DialogDescription>{t("settings.cards.reset.dialogDescription")}</DialogDescription>
			</DialogHeader>

			<div className="grid gap-4 py-4">
				<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
					<p className="mb-1 font-medium text-destructive">{t("settings.cards.reset.deletedIntro")}</p>
					<ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
						{isFull ? (
							<>
								<li>{t("settings.cards.reset.full.deletedDatabase")}</li>
								<li>{t("settings.cards.reset.full.deletedAccounts")}</li>
								<li>{t("settings.cards.reset.full.deletedSettings")}</li>
								<li>{t("settings.cards.reset.deletedFiles")}</li>
								<li>{t("settings.cards.reset.full.deletedBackups")}</li>
							</>
						) : (
							<>
								<li>{t("settings.cards.reset.content.deletedData")}</li>
								<li>{t("settings.cards.reset.deletedFiles")}</li>
							</>
						)}
					</ul>
				</div>

				{!isFull && (
					<div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3 text-sm">
						<p className="mb-1 flex items-center gap-1.5 font-medium text-emerald-700 dark:text-emerald-400">
							<ShieldCheck className="size-4" />
							{t("settings.cards.reset.content.keptIntro")}
						</p>
						<ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
							<li>{t("settings.cards.reset.content.keptAccounts")}</li>
							<li>{t("settings.cards.reset.content.keptSettings")}</li>
							<li>{t("settings.cards.reset.content.keptBackups")}</li>
						</ul>
					</div>
				)}

				<div className="grid gap-2">
					<Label htmlFor="reset-confirmation">
						{t("settings.cards.reset.confirmLabel", { phrase })}
					</Label>
					<Input
						id="reset-confirmation"
						name="confirmation"
						value={confirmation}
						onChange={(event) => setConfirmation(event.target.value)}
						placeholder={phrase}
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
					{isFull ? t("settings.cards.reset.full.confirmButton") : t("settings.cards.reset.content.confirmButton")}
				</Button>
			</DialogFooter>
		</form>
	);
}