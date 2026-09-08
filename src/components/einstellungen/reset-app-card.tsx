"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";

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
	const [open, setOpen] = useState(false);

	return (
		<Card className="max-w-xl border-destructive/50">
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-destructive">
					<TriangleAlert className="size-5" />
					Anwendung zurücksetzen
				</CardTitle>
				<CardDescription>
					Löscht die komplette Datenbank (inkl. Benutzerkonten und Einstellungen), alle abgelegten Dateien und die
					lokal gespeicherten Sicherungen unwiderruflich und versetzt die Anwendung in den Auslieferungszustand.
					Falls Sie die Daten später noch benötigen, exportieren Sie vorher ein Backup über die Datensicherung.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<Dialog open={open} onOpenChange={setOpen}>
					<DialogTrigger asChild>
						<Button type="button" variant="destructive">
							<TriangleAlert />
							Anwendung zurücksetzen …
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
					<DialogTitle>Anwendung zurückgesetzt</DialogTitle>
					<DialogDescription>{state.message}</DialogDescription>
				</DialogHeader>
				<p className="flex items-center gap-2 text-sm text-muted-foreground">
					<Loader2 className="size-4 animate-spin" />
					Sie werden zur Ersteinrichtung weitergeleitet …
				</p>
			</>
		);
	}

	return (
		<form action={formAction}>
			<DialogHeader>
				<DialogTitle>Anwendung endgültig zurücksetzen?</DialogTitle>
				<DialogDescription>Diese Aktion kann nicht rückgängig gemacht werden.</DialogDescription>
			</DialogHeader>

			<div className="grid gap-4 py-4">
				<div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
					<p className="mb-1 font-medium text-destructive">Folgende Daten werden unwiderruflich gelöscht:</p>
					<ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
						<li>
							die gesamte Datenbank: Liegenschaften, Einheiten, Mieter, Verträge, Tickets, Finanzen, Abrechnungen,
							WEG-Verwaltung, Dokumente, Vorlagen
						</li>
						<li>alle Benutzerkonten, Freigaben und Sitzungen (alle Nutzer werden abgemeldet)</li>
						<li>alle Einstellungen inkl. gespeicherter Zugangsdaten (SMTP, LetterXpress, Dropbox)</li>
						<li>alle abgelegten Dateien (Uploads und erzeugte Dokumente)</li>
						<li>die lokal gespeicherten Sicherungen (backups/)</li>
					</ul>
				</div>

				<div className="grid gap-2">
					<Label htmlFor="reset-confirmation">
						Zur Bestätigung bitte exakt „{RESET_CONFIRMATION_PHRASE}“ eingeben
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
						Abbrechen
					</Button>
				</DialogClose>
				<Button type="submit" variant="destructive" disabled={!confirmed || isPending}>
					{isPending ? <Loader2 className="animate-spin" /> : <TriangleAlert />}
					Endgültig löschen
				</Button>
			</DialogFooter>
		</form>
	);
}
