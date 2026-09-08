"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Cloud, CloudUpload, Link2, Link2Off, Loader2, Save } from "lucide-react";

import {
	cancelDropboxConnectAction,
	completeDropboxConnectAction,
	disconnectDropboxAction,
	runDropboxBackupNowAction,
	saveDropboxBackupSettingsAction,
	startDropboxConnectAction,
} from "@/app/(app)/einstellungen/dropbox-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { formatDateTime } from "@/lib/format";

/**
 * Strukturell identisch zu DropboxUiState in src/lib/dropbox-backup.ts -
 * hier lokal definiert, damit die Client-Komponente kein server-only-Modul
 * importieren muss.
 */
export interface DropboxBackupCardState {
	appKey: string;
	appKeyFromEnv: boolean;
	connected: boolean;
	accountEmail: string | null;
	connectedAt: string | null;
	connectPending: boolean;
	enabled: boolean;
	interval: "daily" | "weekly";
	retention: number;
	passwordSet: boolean;
	lastBackupAt: string | null;
	lastError: string | null;
	lastErrorAt: string | null;
}

const MIN_PASSWORD_LENGTH = 8;

function SaveButton() {
	const { pending } = useFormStatus();
	return (
		<Button type="submit" disabled={pending}>
			{pending ? <Loader2 className="animate-spin" /> : <Save />}
			Speichern
		</Button>
	);
}

/**
 * Karte "Dropbox-Backup" (Einstellungen): Verbindet die App per OAuth mit
 * einem Dropbox-Konto (Code-Flow ohne Redirect - der Nutzer öffnet die
 * Dropbox-Seite im System-Browser und fügt den angezeigten Code hier ein)
 * und konfiguriert die regelmäßige automatische Sicherung (Intervall,
 * Aufbewahrung, optionale Passwort-Verschlüsselung wie beim manuellen
 * Export). Server-Logik: src/lib/dropbox-backup.ts / src/lib/dropbox.ts.
 *
 * Das Öffnen der Dropbox-Seite per window.open landet in der Desktop-App
 * über den setWindowOpenHandler des Main-Prozesses im System-Browser (siehe
 * electron/main/index.ts).
 */
export function DropboxBackupCard({ state }: { state: DropboxBackupCardState }) {
	const [appKey, setAppKey] = useState(state.appKey);
	const [connectStep, setConnectStep] = useState<"idle" | "awaiting-code">(state.connectPending ? "awaiting-code" : "idle");
	const [code, setCode] = useState("");
	const [busy, setBusy] = useState<"connect" | "complete" | "disconnect" | "backup" | "cancel" | null>(null);
	const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
	const [encrypt, setEncrypt] = useState(state.passwordSet);
	const [formState, formAction] = useActionState(saveDropboxBackupSettingsAction, initialActionState);

	async function handleStartConnect(): Promise<void> {
		setBusy("connect");
		setMessage(null);
		try {
			const result = await startDropboxConnectAction(appKey);
			if (result.error || !result.url) {
				setMessage({ kind: "error", text: result.error ?? "Der Verbindungsvorgang konnte nicht gestartet werden." });
			} else {
				window.open(result.url, "_blank", "noopener,noreferrer");
				setConnectStep("awaiting-code");
				setCode("");
				setMessage({
					kind: "success",
					text: "Die Dropbox-Seite wurde im Browser geöffnet. Nach der Freigabe wird dort ein Code angezeigt - bitte hier einfügen.",
				});
			}
		} catch {
			setMessage({ kind: "error", text: "Der Verbindungsvorgang konnte nicht gestartet werden." });
		} finally {
			setBusy(null);
		}
	}

	async function handleCompleteConnect(): Promise<void> {
		setBusy("complete");
		setMessage(null);
		try {
			const result = await completeDropboxConnectAction(code);
			if (result.error) {
				setMessage({ kind: "error", text: result.error });
			} else {
				setMessage({
					kind: "success",
					text: `Dropbox ist jetzt verbunden${result.email ? ` als ${result.email}` : ""}. Die Seite wird neu geladen.`,
				});
				setTimeout(() => window.location.reload(), 1200);
			}
		} catch {
			setMessage({ kind: "error", text: "Die Verbindung konnte nicht abgeschlossen werden." });
		} finally {
			setBusy(null);
		}
	}

	async function handleCancelConnect(): Promise<void> {
		setBusy("cancel");
		setMessage(null);
		try {
			await cancelDropboxConnectAction();
		} catch {
			// Abbruch ist lokal ohnehin wirksam - Fehler ignorieren.
		} finally {
			setConnectStep("idle");
			setCode("");
			setBusy(null);
		}
	}

	async function handleDisconnect(): Promise<void> {
		if (!window.confirm("Dropbox-Verbindung wirklich trennen?\n\nEs werden dann keine automatischen Sicherungen mehr hochgeladen. Die Backup-Konfiguration bleibt erhalten.")) {
			return;
		}
		setBusy("disconnect");
		setMessage(null);
		try {
			const result = await disconnectDropboxAction();
			if (result.error) {
				setMessage({ kind: "error", text: result.error });
			} else {
				setMessage({ kind: "success", text: "Die Dropbox-Verbindung wurde getrennt. Die Seite wird neu geladen." });
				setTimeout(() => window.location.reload(), 1200);
			}
		} catch {
			setMessage({ kind: "error", text: "Die Verbindung konnte nicht getrennt werden." });
		} finally {
			setBusy(null);
		}
	}

	async function handleBackupNow(): Promise<void> {
		setBusy("backup");
		setMessage(null);
		try {
			const result = await runDropboxBackupNowAction();
			if (result.error) {
				setMessage({ kind: "error", text: result.error });
			} else {
				setMessage({ kind: "success", text: `${result.message ?? "Die Sicherung wurde hochgeladen."} Die Seite wird neu geladen.` });
				setTimeout(() => window.location.reload(), 1500);
			}
		} catch {
			setMessage({ kind: "error", text: "Das Dropbox-Backup konnte nicht ausgeführt werden." });
		} finally {
			setBusy(null);
		}
	}

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Cloud className="size-5" />
					Dropbox-Backup (Cloud-Sicherung)
				</CardTitle>
				<CardDescription>
					Verbindet die App mit einem Dropbox-Konto und lädt die Datensicherung (Datenbank + alle Dateien)
					regelmäßig automatisch hoch - optional mit Passwort verschlüsselt wie beim manuellen Export.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<dl className="space-y-1 text-sm">
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">Verbindung</dt>
						<dd>
							{state.connected
								? `Verbunden${state.accountEmail ? ` als ${state.accountEmail}` : ""}`
								: "Nicht verbunden"}
						</dd>
					</div>
					{state.connected ? (
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">Letzte erfolgreiche Sicherung</dt>
							<dd>{state.lastBackupAt ? formatDateTime(state.lastBackupAt) : "noch keine"}</dd>
						</div>
					) : null}
				</dl>

				{state.lastError ? (
					<p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
						Letzte Sicherung fehlgeschlagen{state.lastErrorAt ? ` (${formatDateTime(state.lastErrorAt)})` : ""}: {state.lastError}
					</p>
				) : null}

				{!state.connected ? (
					<div className="space-y-3">
						{state.appKeyFromEnv ? (
							<p className="text-xs text-muted-foreground">
								Der Dropbox-App-Schlüssel ist per Umgebungsvariable (DROPBOX_APP_KEY) vorgegeben.
							</p>
						) : (
							<div className="grid gap-2">
								<Label htmlFor="dropboxAppKey">Dropbox-App-Schlüssel</Label>
								<Input
									id="dropboxAppKey"
									value={appKey}
									onChange={(event) => setAppKey(event.target.value)}
									placeholder="App-Schlüssel der eigenen Dropbox-App"
									autoComplete="off"
									disabled={connectStep === "awaiting-code"}
								/>
								<p className="text-xs text-muted-foreground">
									Einmalig eine eigene App unter dropbox.com/developers/apps anlegen („Scoped access“, „App
									folder“, Berechtigungen files.content.write und files.content.read) und deren App-Schlüssel hier
									eintragen.
								</p>
							</div>
						)}

						{connectStep === "idle" ? (
							<div>
								<Button onClick={handleStartConnect} disabled={busy !== null}>
									{busy === "connect" ? <Loader2 className="animate-spin" /> : <Link2 />}
									Mit Dropbox verbinden
								</Button>
							</div>
						) : (
							<div className="space-y-3 rounded-md border p-3">
								<p className="text-sm">
									1. Auf der geöffneten Dropbox-Seite den Zugriff erlauben. 2. Den dort angezeigten Code hier
									einfügen:
								</p>
								<div className="flex gap-2">
									<Input
										value={code}
										onChange={(event) => setCode(event.target.value)}
										placeholder="Autorisierungscode"
										autoComplete="off"
										disabled={busy !== null}
									/>
									<Button onClick={handleCompleteConnect} disabled={busy !== null || !code.trim()}>
										{busy === "complete" ? <Loader2 className="animate-spin" /> : <Link2 />}
										Verknüpfen
									</Button>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button variant="ghost" size="sm" onClick={handleStartConnect} disabled={busy !== null}>
										{busy === "connect" ? <Loader2 className="animate-spin" /> : <Cloud />}
										Dropbox-Seite erneut öffnen
									</Button>
									<Button variant="ghost" size="sm" onClick={handleCancelConnect} disabled={busy !== null}>
										Abbrechen
									</Button>
								</div>
							</div>
						)}
					</div>
				) : (
					<>
						<form action={formAction} className="space-y-4">
							<label className="flex items-center gap-2 text-sm">
								<input type="checkbox" name="enabled" defaultChecked={state.enabled} />
								Automatische Sicherung aktiviert (läuft, solange die App geöffnet ist)
							</label>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="grid gap-2">
									<Label htmlFor="interval">Intervall</Label>
									<select id="interval" name="interval" defaultValue={state.interval} className="h-9 rounded-md border bg-background px-3 text-sm">
										<option value="daily">Täglich</option>
										<option value="weekly">Wöchentlich</option>
									</select>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="retention">Aufbewahrung (Anzahl Sicherungen)</Label>
									<Input id="retention" name="retention" type="number" min={1} max={100} defaultValue={state.retention} />
								</div>
							</div>
							<div className="space-y-2">
								<label className="flex items-center gap-2 text-sm">
									<input type="checkbox" name="encrypt" checked={encrypt} onChange={(event) => setEncrypt(event.target.checked)} />
									Mit Passwort verschlüsseln (.imbak)
								</label>
								{encrypt ? (
									<div className="grid gap-2 sm:grid-cols-2">
										<Input
											type="password"
											name="password"
											placeholder={
												state.passwordSet ? "•••••••• (gespeichert, unverändert wenn leer)" : `Passwort (min. ${MIN_PASSWORD_LENGTH} Zeichen)`
											}
											autoComplete="new-password"
										/>
										<Input type="password" name="passwordConfirm" placeholder="Passwort wiederholen" autoComplete="new-password" />
									</div>
								) : null}
								<p className="text-xs text-muted-foreground">
									Ein vergessenes Passwort kann nicht wiederhergestellt werden - ohne Passwort lässt sich die
									Sicherung nicht einspielen.
								</p>
							</div>

							{formState.error ? <p className="text-sm text-destructive">{formState.error}</p> : null}
							{formState.success ? <p className="text-sm text-emerald-600">Die Einstellungen wurden gespeichert.</p> : null}

							<div className="flex justify-end">
								<SaveButton />
							</div>
						</form>

						<div className="flex flex-wrap gap-2 border-t pt-4">
							<Button variant="outline" onClick={handleBackupNow} disabled={busy !== null}>
								{busy === "backup" ? <Loader2 className="animate-spin" /> : <CloudUpload />}
								Jetzt sichern
							</Button>
							<Button variant="ghost" onClick={handleDisconnect} disabled={busy !== null}>
								{busy === "disconnect" ? <Loader2 className="animate-spin" /> : <Link2Off />}
								Verbindung trennen
							</Button>
						</div>
					</>
				)}

				{message ? (
					<p className={`text-sm ${message.kind === "error" ? "text-destructive" : "text-emerald-600"}`} role="status">
						{message.text}
					</p>
				) : null}

				<p className="text-xs text-muted-foreground">
					Die Sicherung enthält personenbezogene Daten (Mieter, Eigentümer, Nutzer) - sie liegt zusätzlich zur
					lokalen Datei in der Dropbox des verbundenen Kontos. Verbindung{state.connectedAt ? ` seit ${formatDateTime(state.connectedAt)}` : ""}{" "}
					und Upload laufen über die offizielle Dropbox-API; ohne Internetverbindung werden Sicherungen beim
					nächsten Start nachgeholt.
				</p>
			</CardContent>
		</Card>
	);
}
