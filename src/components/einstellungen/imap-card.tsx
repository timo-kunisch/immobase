"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, PlugZap, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

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
	const { t } = useI18n();
	return (
		<Button type="submit" disabled={pending}>
			{pending ? <Loader2 className="animate-spin" /> : <Save />}
			{t("common.save")}
		</Button>
	);
}

/** Verbindungstest-Button mit eigenem Ergebnis-Zustand (kein Formular nötig). */
function TestConnectionButton() {
	const { t } = useI18n();
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
				{t("settings.cards.imap.testConnection")}
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
	const { t } = useI18n();
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
				<CardTitle>{t("settings.cards.imap.title")}</CardTitle>
				<CardDescription>
					{t("settings.cards.imap.description")}
				</CardDescription>
			</CardHeader>
			<CardContent>
				<form action={formAction} className="space-y-4">
					<div className="grid grid-cols-3 gap-4">
						<div className="col-span-2 grid gap-2">
							<Label htmlFor="imapHost">{t("settings.cards.imap.host")}</Label>
							<Input id="imapHost" name="imapHost" defaultValue={settings.imapHost} placeholder="imap.example.com" />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="imapPort">{t("settings.fields.port")}</Label>
							<Input id="imapPort" name="imapPort" defaultValue={settings.imapPort} placeholder="993" />
						</div>
					</div>
					<div className="grid grid-cols-2 gap-4">
						<div className="grid gap-2">
							<Label htmlFor="imapUser">{t("settings.fields.username")}</Label>
							<Input id="imapUser" name="imapUser" defaultValue={settings.imapUser} autoComplete="off" />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="imapPass">{t("settings.fields.password")}</Label>
							<Input
								id="imapPass"
								name="imapPass"
								type="password"
								placeholder={settings.imapPassSet ? t("settings.password.savedPlaceholder") : ""}
								autoComplete="new-password"
							/>
						</div>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="imapMailbox">{t("settings.cards.imap.mailbox")}</Label>
						<Input id="imapMailbox" name="imapMailbox" defaultValue={settings.imapMailbox} placeholder="INBOX" />
					</div>
					<label className="flex items-center gap-2 text-sm">
						<input type="checkbox" name="imapSecure" defaultChecked={settings.imapSecure} />
						{t("settings.cards.imap.secure")}
					</label>
					<p className="text-xs text-muted-foreground">
						{t("settings.cards.imap.hint")}
					</p>

					{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
					{state.success ? <p className="text-sm text-emerald-600">{t("settings.success.saved")}</p> : null}

					<div className="flex items-center justify-between gap-2">
						<TestConnectionButton />
						<SubmitButton />
					</div>
				</form>
			</CardContent>
		</Card>
	);
}
