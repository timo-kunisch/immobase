"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, PlugZap, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";

import { saveImapSettingsAction, testImapConnectionAction } from "@/app/(app)/einstellungen/actions";

export interface ImapSettings {
	imapHost: string;
	imapPort: string;
	imapSecure: boolean;
	imapUser: string;
	imapPassSet: boolean;
	imapMailbox: string;
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

/** Verbindungstest-Button mit eigenem Ergebnis-Zustand (kein Formular nötig). */
function TestConnectionButton() {
	const [isPending, startTransition] = useTransition();
	const [result, setResult] = useState<{ error?: string; message?: string } | null>(null);

	function handleClick() {
		setResult(null);
		startTransition(async () => {
			const state = await testImapConnectionAction();
			setResult({ error: state.error, message: state.message });
		});
	}

	return (
		<div className="flex flex-col gap-1">
			<Button type="button" variant="outline" onClick={handleClick} disabled={isPending}>
				{isPending ? <Loader2 className="animate-spin" /> : <PlugZap />}
				Verbindung testen
			</Button>
			{result?.error ? <p className="text-sm text-destructive">{result.error}</p> : null}
			{result?.message ? <p className="text-sm text-emerald-600">{result.message}</p> : null}
		</div>
	);
}

/**
 * Einstellungen für den optionalen E-Mail-Empfang (IMAP) des Ticket-
 * Postfachs. Ohne Konfiguration bleibt das Ticket-System mit den Basis-
 * Funktionen nutzbar (manuell angelegte Tickets + interne Notizen).
 *
 * Das gespeicherte Passwort wird aus Sicherheitsgründen NICHT vorausgefüllt
 * - leeres Feld = unverändert lassen.
 */
export function ImapCard({ settings }: { settings: ImapSettings }) {
	const [state, formAction] = useActionState(saveImapSettingsAction, initialActionState);

	// Nach dem Speichern neu laden, damit die Sidebar den Postfach-Eintrag
	// ein-/ausblendet (Muster wie AiCard/McpCard).
	const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		if (state.success && !reloadTimer.current) {
			reloadTimer.current = setTimeout(() => window.location.reload(), 1200);
		}
		return () => {
			if (reloadTimer.current) clearTimeout(reloadTimer.current);
		};
	}, [state.success]);

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>E-Mail-Postfach (IMAP, optional)</CardTitle>
				<CardDescription>
					Eingehende E-Mails für das Ticket-System abrufen (Postfach mit Umwandlung in Tickets).
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={formAction} className="space-y-4">
					<div className="grid grid-cols-3 gap-4">
						<div className="col-span-2 grid gap-2">
							<Label htmlFor="imapHost">IMAP-Server</Label>
							<Input id="imapHost" name="imapHost" defaultValue={settings.imapHost} placeholder="imap.example.com" />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="imapPort">Port</Label>
							<Input id="imapPort" name="imapPort" defaultValue={settings.imapPort} placeholder="993" />
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="grid gap-2">
							<Label htmlFor="imapUser">Benutzername</Label>
							<Input id="imapUser" name="imapUser" defaultValue={settings.imapUser} autoComplete="off" />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="imapPass">Passwort</Label>
							<Input
								id="imapPass"
								name="imapPass"
								type="password"
								placeholder={settings.imapPassSet ? "•••••••• (gespeichert, unverändert wenn leer)" : ""}
								autoComplete="new-password"
							/>
						</div>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="imapMailbox">Postfach-Ordner</Label>
						<Input id="imapMailbox" name="imapMailbox" defaultValue={settings.imapMailbox} placeholder="INBOX" />
					</div>
					<label className="flex items-center gap-2 text-sm">
						<input type="checkbox" name="imapSecure" defaultChecked={settings.imapSecure} />
						SSL/TLS (Port 993)
					</label>
					<p className="text-xs text-muted-foreground">
						Ohne IMAP-Konfiguration ist das Postfach deaktiviert - das Ticket-System funktioniert dann weiterhin mit manuell angelegten
						Tickets und internen Notizen.
					</p>

					{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
					{state.success ? <p className="text-sm text-emerald-600">Die Einstellungen wurden gespeichert.</p> : null}

					<div className="flex items-center justify-between gap-2">
						<TestConnectionButton />
						<SubmitButton />
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
