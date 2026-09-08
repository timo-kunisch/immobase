"use client";

import { useState } from "react";
import { Eye, EyeOff, Loader2, Lock, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
	const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
	const [keyBusy, setKeyBusy] = useState(false);

	async function handleEncryptNow(): Promise<void> {
		setBusy(true);
		setMessage(null);
		try {
			const result = await encryptExistingFilesAction();
			if (result.error) {
				setMessage({ kind: "error", text: result.error });
			} else {
				setMessage({
					kind: "success",
					text:
						(result.encrypted ?? 0) > 0
							? `${result.encrypted} Datei(en) wurden verschlüsselt.`
							: "Alle Dateien waren bereits verschlüsselt.",
				});
				// Statusanzeige aktualisieren (Server Component neu rendern).
				window.location.reload();
			}
		} catch {
			setMessage({ kind: "error", text: "Die Dateiverschlüsselung konnte nicht ausgeführt werden." });
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
				setMessage({ kind: "error", text: result.error ?? "Der Wiederherstellungsschlüssel konnte nicht gelesen werden." });
			} else {
				setRecoveryKey(result.key);
			}
		} catch {
			setMessage({ kind: "error", text: "Der Wiederherstellungsschlüssel konnte nicht gelesen werden." });
		} finally {
			setKeyBusy(false);
		}
	}

	const keySourceLabel =
		status.keySource === "system-keychain" ? "Schlüsselbund des Betriebssystems (Desktop-App)" : "Schlüsseldatei im Datenverzeichnis (Entwicklung)";

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<ShieldCheck className="size-5" />
					Lokale Datenverschlüsselung
				</CardTitle>
				<CardDescription>
					Dateien und gespeicherte Zugangsdaten (z. B. SMTP-Passwort) werden auf diesem Gerät verschlüsselt
					abgelegt (AES-256). Der Schlüssel ist an dieses Gerät gebunden: {keySourceLabel}.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<dl className="space-y-1 text-sm">
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">Datenbank</dt>
						<dd>
							{status.databaseEncrypted
								? "verschlüsselt abgelegt (Ruhezustand)"
								: "aktiv entsperrt - wird beim Beenden der App verschlüsselt"}
						</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">Dateien in der Ablage</dt>
						<dd>
							{status.filesTotal === 0
								? "keine vorhanden"
								: status.filesPlaintext === 0
									? `${status.filesEncrypted} von ${status.filesTotal} verschlüsselt`
									: `${status.filesPlaintext} von ${status.filesTotal} noch unverschlüsselt`}
						</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">Gespeicherte Zugangsdaten</dt>
						<dd>
							{status.secretsSet === 0
								? "keine konfiguriert"
								: status.secretsEncrypted === status.secretsSet
									? `${status.secretsEncrypted} von ${status.secretsSet} verschlüsselt`
									: `${status.secretsSet - status.secretsEncrypted} von ${status.secretsSet} noch unverschlüsselt`}
						</dd>
					</div>
				</dl>

				{status.filesPlaintext > 0 ? (
					<div>
						<Button variant="outline" onClick={handleEncryptNow} disabled={busy}>
							{busy ? <Loader2 className="animate-spin" /> : <Lock />}
							Bestandsdateien jetzt verschlüsseln
						</Button>
					</div>
				) : null}

				<div className="space-y-2 border-t pt-4">
					<Button variant="ghost" size="sm" onClick={handleToggleRecoveryKey} disabled={keyBusy}>
						{keyBusy ? <Loader2 className="animate-spin" /> : recoveryKey !== null ? <EyeOff /> : <Eye />}
						{recoveryKey !== null ? "Wiederherstellungsschlüssel ausblenden" : "Wiederherstellungsschlüssel anzeigen"}
					</Button>
					{recoveryKey !== null ? (
						<div className="space-y-1">
							<code className="block break-all rounded-md border bg-muted p-2 text-xs select-all">{recoveryKey}</code>
							<p className="text-xs text-muted-foreground">
								Den Schlüssel wie ein Passwort sicher verwahren und niemandem zeigen: Er entschlüsselt sämtliche
								Dateien und gespeicherten Zugangsdaten dieses Geräts. Er wird benötigt, falls der Schlüsselbund des
								Betriebssystems verloren geht (z. B. nach einer Neuinstallation ohne Datensicherung).
							</p>
						</div>
					) : null}
				</div>

				{message ? (
					<p className={`text-sm ${message.kind === "error" ? "text-destructive" : "text-emerald-600"}`} role="status">
						{message.text}
					</p>
				) : null}

				<p className="text-xs text-muted-foreground">
					Hinweis: Die Datenbank liegt nur im beendeten Zustand als verschlüsselter Container vor - während die App
					läuft (und nach einem Absturz ohne sauberes Beenden) ist sie entsperrt. Für vollständigen Schutz in diesen
					Zuständen wird zusätzlich die Festplattenverschlüsselung des Betriebssystems (FileVault/BitLocker/LUKS)
					empfohlen.
				</p>
			</CardContent>
		</Card>
	);
}
