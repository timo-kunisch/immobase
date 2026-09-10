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
import { Guide, GuideStep } from "@/components/einstellungen/guide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { formatDateTime } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

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
	const { t } = useI18n();
	return (
		<Button type="submit" disabled={pending}>
			{pending ? <Loader2 className="animate-spin" /> : <Save />}
			{t("common.save")}
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
	const { t } = useI18n();
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
				setMessage({ kind: "error", text: result.error ?? t("settings.cards.dropbox.errors.connectStartFailed") });
			} else {
				window.open(result.url, "_blank", "noopener,noreferrer");
				setConnectStep("awaiting-code");
				setCode("");
				setMessage({
					kind: "success",
					text: t("settings.cards.dropbox.connectStarted"),
				});
			}
		} catch {
			setMessage({ kind: "error", text: t("settings.cards.dropbox.errors.connectStartFailed") });
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
					text: result.email
						? t("settings.cards.dropbox.connectedSuccessAs", { email: result.email })
						: t("settings.cards.dropbox.connectedSuccess"),
				});
				setTimeout(() => window.location.reload(), 1200);
			}
		} catch {
			setMessage({ kind: "error", text: t("settings.cards.dropbox.errors.connectCompleteFailed") });
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
		if (!window.confirm(t("settings.cards.dropbox.disconnectConfirm"))) {
			return;
		}
		setBusy("disconnect");
		setMessage(null);
		try {
			const result = await disconnectDropboxAction();
			if (result.error) {
				setMessage({ kind: "error", text: result.error });
			} else {
				setMessage({ kind: "success", text: t("settings.cards.dropbox.disconnectSuccess") });
				setTimeout(() => window.location.reload(), 1200);
			}
		} catch {
			setMessage({ kind: "error", text: t("settings.cards.dropbox.errors.disconnectFailed") });
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
				setMessage({
					kind: "success",
					text: t("settings.cards.dropbox.backupUploadedReload", { message: result.message ?? t("settings.cards.dropbox.backupUploaded") }),
				});
				setTimeout(() => window.location.reload(), 1500);
			}
		} catch {
			setMessage({ kind: "error", text: t("settings.cards.dropbox.backupRunFailed") });
		} finally {
			setBusy(null);
		}
	}

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Cloud className="size-5" />
					{t("settings.cards.dropbox.title")}
				</CardTitle>
				<CardDescription>
					{t("settings.cards.dropbox.description")}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<dl className="space-y-1 text-sm">
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">{t("settings.cards.dropbox.status.connection")}</dt>
						<dd>
							{state.connected
								? state.accountEmail
									? t("settings.cards.dropbox.status.connectedAs", { email: state.accountEmail })
									: t("settings.cards.dropbox.status.connected")
								: t("settings.cards.dropbox.status.notConnected")}
						</dd>
					</div>
					{state.connected ? (
						<div className="flex justify-between gap-4">
							<dt className="text-muted-foreground">{t("settings.cards.dropbox.status.lastBackup")}</dt>
							<dd>{state.lastBackupAt ? formatDateTime(state.lastBackupAt) : t("settings.cards.dropbox.status.lastBackupNever")}</dd>
						</div>
					) : null}
				</dl>

				{state.lastError ? (
					<p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
						{state.lastErrorAt
							? t("settings.cards.dropbox.lastErrorAt", { at: formatDateTime(state.lastErrorAt), error: state.lastError })
							: t("settings.cards.dropbox.lastError", { error: state.lastError })}
					</p>
				) : null}

				{!state.connected ? (
					<div className="space-y-3">
						<Guide title={t("settings.cards.dropbox.guide.title")}>
							<GuideStep step={1} title={t("settings.cards.dropbox.guide.step1.title")}>
								<p>
									{t("settings.cards.dropbox.guide.step1.part1")}{" "}
									<code className="rounded bg-muted px-1 py-0.5 text-xs">dropbox.com/developers/apps</code>{" "}
									{t("settings.cards.dropbox.guide.step1.part2")}
								</p>
							</GuideStep>
							<GuideStep step={2} title={t("settings.cards.dropbox.guide.step2.title")}>
								<p>
									{t("settings.cards.dropbox.guide.step2.part1")}{" "}
									<code className="rounded bg-muted px-1 py-0.5 text-xs">files.content.write</code>{" "}
									{t("settings.cards.dropbox.guide.step2.part2")}{" "}
									<code className="rounded bg-muted px-1 py-0.5 text-xs">files.content.read</code>{" "}
									{t("settings.cards.dropbox.guide.step2.part3")}
								</p>
							</GuideStep>
							<GuideStep step={3} title={t("settings.cards.dropbox.guide.step3.title")}>
								<p>
									{t("settings.cards.dropbox.guide.step3.body")}
								</p>
							</GuideStep>
							<GuideStep step={4} title={t("settings.cards.dropbox.guide.step4.title")}>
								<p>
									{t("settings.cards.dropbox.guide.step4.body")}
								</p>
							</GuideStep>
							<GuideStep step={5} title={t("settings.cards.dropbox.guide.step5.title")}>
								<p>
									{t("settings.cards.dropbox.guide.step5.body")}
								</p>
							</GuideStep>
						</Guide>

						{state.appKeyFromEnv ? (
							<p className="text-xs text-muted-foreground">
								{t("settings.cards.dropbox.appKeyFromEnv")}
							</p>
						) : (
							<div className="grid gap-2">
								<Label htmlFor="dropboxAppKey">{t("settings.cards.dropbox.appKeyLabel")}</Label>
								<Input
									id="dropboxAppKey"
									value={appKey}
									onChange={(event) => setAppKey(event.target.value)}
									placeholder={t("settings.cards.dropbox.appKeyPlaceholder")}
									autoComplete="off"
									disabled={connectStep === "awaiting-code"}
								/>
							</div>
						)}

						{connectStep === "idle" ? (
							<div>
								<Button onClick={handleStartConnect} disabled={busy !== null}>
									{busy === "connect" ? <Loader2 className="animate-spin" /> : <Link2 />}
									{t("settings.cards.dropbox.connect")}
								</Button>
							</div>
						) : (
							<div className="space-y-3 rounded-md border p-3">
								<p className="text-sm">
									{t("settings.cards.dropbox.codePrompt")}
								</p>
								<div className="flex gap-2">
									<Input
										value={code}
										onChange={(event) => setCode(event.target.value)}
										placeholder={t("settings.cards.dropbox.codePlaceholder")}
										autoComplete="off"
										disabled={busy !== null}
									/>
									<Button onClick={handleCompleteConnect} disabled={busy !== null || !code.trim()}>
										{busy === "complete" ? <Loader2 className="animate-spin" /> : <Link2 />}
										{t("settings.cards.dropbox.link")}
									</Button>
								</div>
								<div className="flex flex-wrap gap-2">
									<Button variant="ghost" size="sm" onClick={handleStartConnect} disabled={busy !== null}>
										{busy === "connect" ? <Loader2 className="animate-spin" /> : <Cloud />}
										{t("settings.cards.dropbox.reopen")}
									</Button>
									<Button variant="ghost" size="sm" onClick={handleCancelConnect} disabled={busy !== null}>
										{t("common.cancel")}
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
								{t("settings.cards.dropbox.enabledLabel")}
							</label>
							<div className="grid gap-4 sm:grid-cols-2">
								<div className="grid gap-2">
									<Label htmlFor="interval">{t("settings.cards.dropbox.intervalLabel")}</Label>
									<select id="interval" name="interval" defaultValue={state.interval} className="h-9 rounded-md border bg-background px-3 text-sm">
										<option value="daily">{t("settings.cards.dropbox.interval.daily")}</option>
										<option value="weekly">{t("settings.cards.dropbox.interval.weekly")}</option>
									</select>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="retention">{t("settings.cards.dropbox.retentionLabel")}</Label>
									<Input id="retention" name="retention" type="number" min={1} max={100} defaultValue={state.retention} />
								</div>
							</div>
							<div className="space-y-2">
								<label className="flex items-center gap-2 text-sm">
									<input type="checkbox" name="encrypt" checked={encrypt} onChange={(event) => setEncrypt(event.target.checked)} />
									{t("settings.password.encryptToggle")}
								</label>
								{encrypt ? (
									<div className="grid gap-2 sm:grid-cols-2">
										<Input
											type="password"
											name="password"
											placeholder={
												state.passwordSet ? t("settings.password.savedPlaceholder") : t("settings.password.placeholderMin", { min: MIN_PASSWORD_LENGTH })
											}
											autoComplete="new-password"
										/>
										<Input type="password" name="passwordConfirm" placeholder={t("settings.password.repeatPlaceholder")} autoComplete="new-password" />
									</div>
								) : null}
								<p className="text-xs text-muted-foreground">
									{t("settings.cards.dropbox.passwordHint")}
								</p>
							</div>

							{formState.error ? <p className="text-sm text-destructive">{formState.error}</p> : null}
							{formState.success ? <p className="text-sm text-emerald-600">{t("settings.success.saved")}</p> : null}

							<div className="flex justify-end">
								<SaveButton />
							</div>
						</form>

						<div className="flex flex-wrap gap-2 border-t pt-4">
							<Button variant="outline" onClick={handleBackupNow} disabled={busy !== null}>
								{busy === "backup" ? <Loader2 className="animate-spin" /> : <CloudUpload />}
								{t("settings.cards.dropbox.backupNow")}
							</Button>
							<Button variant="ghost" onClick={handleDisconnect} disabled={busy !== null}>
								{busy === "disconnect" ? <Loader2 className="animate-spin" /> : <Link2Off />}
								{t("settings.cards.dropbox.disconnect")}
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
					{state.connectedAt
						? t("settings.cards.dropbox.footerHintSince", { since: formatDateTime(state.connectedAt) })
						: t("settings.cards.dropbox.footerHint")}
				</p>
			</CardContent>
		</Card>
	);
}
