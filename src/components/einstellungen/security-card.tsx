"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/provider";
import { showError } from "@/lib/toast";
import { encryptExistingFilesAction, getRecoveryKeyAction } from "@/app/(app)/einstellungen/actions";

export interface SecurityStatus {
	/** Herkunft des Master-Schlüssels: OS-Schlüsselbund (Desktop) oder Schlüsseldatei (Dev/Browser). */
	keySource: "system-keychain" | "key-file";
	filesTotal: number;
	filesEncrypted: number;
	filesPlaintext: number;
	secretsSet: number;
	secretsEncrypted: number;
	/** Liegt die Datenbank aktuell als verschlüsselter Container vor (Ruhezustand)? */
	databaseEncrypted: boolean;
}

/**
 * Status-Karte "Lokale Datenverschlüsselung" (Einstellungen). Zeigt an, ob
 * Dateien und gespeicherte Zugangsdaten at rest verschlüsselt sind (siehe
 * src/lib/file-crypto.ts, src/data/app-settings.ts, src/lib/data-key.ts),
 * erlaubt den manuellen Nachlauf der Bestandsmigration und das Einsehen des
 * Wiederherstellungsschlüssels (nur Admins, siehe Layout + Server Actions).
 */
export function SecurityCard({ status }: { status: SecurityStatus }) {
	const { t } = useI18n();
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);
	const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
	const [keyBusy, setKeyBusy] = useState(false);

	async function handleEncryptNow(): Promise<void> {
		setBusy(true);
		setMessage(null);
		try {
const result = await encryptExistingFilesAction();
		if (result.error) {
			showError(result.error);
		} else {
			setMessage(
				(result.encrypted ?? 0) > 0
					? t("settings.cards.security.encryptSuccess", { count: result.encrypted ?? 0 })
					: t("settings.cards.security.encryptNone")
			);
			// Statusanzeige aktualisieren (Server Component neu rendern).
			window.location.reload();
		}
	} catch {
		showError(t("settings.cards.security.encryptRunFailed"));
	} finally {
			setBusy(false);
		}
	}

	async function handleToggleRecoveryKey(): Promise<void> {
		if (recoveryKey !== null) {
			setRecoveryKey(null);
			return;
		}
		setKeyBusy(true);
		try {
const result = await getRecoveryKeyAction();
		if (result.error || !result.key) {
			showError(result.error ?? t("settings.cards.security.recoveryKey.readFailed"));
		} else {
			setRecoveryKey(result.key);
		}
	} catch {
		showError(t("settings.cards.security.recoveryKey.readFailed"));
	} finally {
			setKeyBusy(false);
		}
	}

	const keySourceLabel =
		status.keySource === "system-keychain" ? t("settings.cards.security.keySource.systemKeychain") : t("settings.cards.security.keySource.keyFile");

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<ShieldCheck className="size-5" />
					{t("settings.cards.security.title")}
				</CardTitle>
				<CardDescription>
					{t("settings.cards.security.description", { keySource: keySourceLabel })}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<dl className="space-y-1 text-sm">
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">{t("settings.cards.security.database")}</dt>
						<dd>
							{status.databaseEncrypted
								? t("settings.cards.security.database.encrypted")
								: t("settings.cards.security.database.unlocked")}
						</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">{t("settings.cards.security.files")}</dt>
						<dd>
							{status.filesTotal === 0
								? t("settings.cards.security.files.none")
								: status.filesPlaintext === 0
									? t("settings.cards.security.countEncrypted", { encrypted: status.filesEncrypted, total: status.filesTotal })
									: t("settings.cards.security.countPlain", { plaintext: status.filesPlaintext, total: status.filesTotal })}
						</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">{t("settings.cards.security.secrets")}</dt>
						<dd>
							{status.secretsSet === 0
								? t("settings.cards.security.secrets.none")
								: status.secretsEncrypted === status.secretsSet
									? t("settings.cards.security.countEncrypted", { encrypted: status.secretsEncrypted, total: status.secretsSet })
									: t("settings.cards.security.countPlain", { plaintext: status.secretsSet - status.secretsEncrypted, total: status.secretsSet })}
						</dd>
					</div>
				</dl>

				{status.filesPlaintext > 0 ? (
					<div>
						<Button variant="outline" onClick={handleEncryptNow} disabled={busy}>
							{busy ? <Loader2 className="animate-spin" /> : <Lock />}
							{t("settings.cards.security.encryptNow")}
						</Button>
					</div>
				) : null}

				<div className="space-y-2 border-t pt-4">
					<Button variant="ghost" size="sm" onClick={handleToggleRecoveryKey} disabled={keyBusy}>
						{keyBusy ? <Loader2 className="animate-spin" /> : recoveryKey !== null ? <EyeOff /> : <Eye />}
						{recoveryKey !== null ? t("settings.cards.security.recoveryKey.hide") : t("settings.cards.security.recoveryKey.show")}
					</Button>
					{recoveryKey !== null ? (
						<div className="space-y-1">
							<code className="block break-all rounded-md border bg-muted p-2 text-xs select-all">{recoveryKey}</code>
							<p className="text-xs text-muted-foreground">
								{t("settings.cards.security.recoveryKey.hint")}
							</p>
						</div>
					) : null}
				</div>

{message ? <p className="text-sm text-emerald-600" role="status">{message}</p> : null}

				<p className="text-xs text-muted-foreground">
					{t("settings.cards.security.databaseNote")}
				</p>
			</CardContent>
		</Card>
	);
}
