"use client";

import { useState } from "react";
import { Download, HardDriveDownload, Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDesktopBridge } from "@/lib/desktop-bridge";

type ImportMode = "replace" | "merge";

/**
 * Karte für die vollständige Datensicherung (Backup-Export/-Import, siehe
 * src/data/backup.ts und src/app/api/backup/).
 *
 * Desktop-App (Electron): Export/Import läuft über den nativen Dateidialog
 * (window.iv, siehe src/lib/desktop-bridge.ts) + serverseitige Verarbeitung
 * über /api/backup/*. Im reinen Browser-Modus (Dev) steht der Export als
 * direkter Download zur Verfügung; der Import benötigt die Desktop-App.
 *
 * Der Route Handler prüft requireAdmin() erneut (Defense-in-Depth) - diese
 * Seite ist zusätzlich bereits über app/(app)/einstellungen/layout.tsx auf
 * Admins beschränkt.
 */
export function DataExportCard() {
	const bridge = getDesktopBridge();
	const [busy, setBusy] = useState<"export" | "import" | null>(null);
	const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
	const [importMode, setImportMode] = useState<ImportMode>("replace");

	async function handleExport(): Promise<void> {
		if (!bridge) return; // Browser-Fallback läuft über den <a href>-Download
		setBusy("export");
		setMessage(null);
		try {
			const stamp = new Date().toISOString().slice(0, 10);
			const targetPath = await bridge.chooseBackupSavePath(`immobase-backup-${stamp}.zip`);
			if (!targetPath) return; // Dialog abgebrochen
			const response = await fetch("/api/backup/export", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ targetPath }),
			});
			const payload = (await response.json()) as { ok?: boolean; fileCount?: number; error?: string };
			if (!response.ok) {
				setMessage({ kind: "error", text: payload.error ?? "Export fehlgeschlagen." });
			} else {
				setMessage({ kind: "success", text: `Backup gespeichert (${payload.fileCount ?? 0} Dateien): ${targetPath}` });
			}
		} catch {
			setMessage({ kind: "error", text: "Export fehlgeschlagen." });
		} finally {
			setBusy(null);
		}
	}

	async function handleImport(): Promise<void> {
		if (!bridge) return;
		setBusy("import");
		setMessage(null);
		try {
			const sourcePath = await bridge.chooseBackupOpenPath();
			if (!sourcePath) return; // Dialog abgebrochen
			const modeLabel = importMode === "replace" ? "ERSETZT" : "ZUSAMMENGEFÜHRT";
			if (!window.confirm(`Sicherung wirklich importieren?\n\n${sourcePath}\n\nDer aktuelle Datenbestand wird ${modeLabel}. Vorher wird automatisch ein Backup des aktuellen Standes angelegt.`)) {
				return;
			}
			const response = await fetch("/api/backup/import", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ path: sourcePath, mode: importMode }),
			});
			const payload = (await response.json()) as { ok?: boolean; backupPath?: string | null; error?: string };
			if (!response.ok) {
				setMessage({ kind: "error", text: payload.error ?? "Import fehlgeschlagen." });
			} else {
				setMessage({
					kind: "success",
					text: `Backup importiert.${payload.backupPath ? ` Sicherung des vorherigen Standes: ${payload.backupPath}` : ""} Die Seite wird neu geladen.`,
				});
				setTimeout(() => window.location.reload(), 1500);
			}
		} catch {
			setMessage({ kind: "error", text: "Import fehlgeschlagen." });
		} finally {
			setBusy(null);
		}
	}

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>Datensicherung</CardTitle>
				<CardDescription>
					Sichert die komplette Anwendung (Datenbank + alle Dateien) als eine ZIP-Datei mit Prüfsummen - geeignet für
					Backups und den Umzug auf ein anderes Gerät.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="flex flex-wrap gap-2">
					{bridge ? (
						<Button onClick={handleExport} disabled={busy !== null}>
							{busy === "export" ? <Loader2 className="animate-spin" /> : <Download />}
							Backup exportieren (.zip)
						</Button>
					) : (
						<Button asChild>
							<a href="/api/backup/export" download>
								<Download />
								Backup herunterladen (.zip)
							</a>
						</Button>
					)}
				</div>

				{bridge ? (
					<div className="space-y-2 border-t pt-4">
						<div className="flex flex-wrap items-center gap-2">
							<select
								className="h-9 rounded-md border bg-background px-3 text-sm"
								value={importMode}
								onChange={(event) => setImportMode(event.target.value as ImportMode)}
								disabled={busy !== null}
							>
								<option value="replace">Ersetzen (Bestand wird überschrieben)</option>
								<option value="merge">Zusammenführen (nur fehlende Einträge ergänzen)</option>
							</select>
							<Button variant="outline" onClick={handleImport} disabled={busy !== null}>
								{busy === "import" ? <Loader2 className="animate-spin" /> : <Upload />}
								Backup importieren
							</Button>
						</div>
						<p className="text-xs text-muted-foreground">
							Vor dem Import wird automatisch eine Sicherung des aktuellen Standes unter „backups/“ im Datenverzeichnis
							abgelegt. „Zusammenführen“ übernimmt nur Einträge, die lokal noch nicht existieren (vorhandene lokale
							Einträge bleiben unverändert).
						</p>
					</div>
				) : (
					<p className="border-t pt-4 text-xs text-muted-foreground">
						Der Import steht in der Desktop-App zur Verfügung (nativer Dateidialog, automatische Vor-Sicherung).
					</p>
				)}

				{message ? (
					<p className={`text-sm ${message.kind === "error" ? "text-destructive" : "text-emerald-600"}`} role="status">
						{message.text}
					</p>
				) : null}

				<p className="flex items-start gap-1.5 text-xs text-muted-foreground">
					<HardDriveDownload className="mt-0.5 size-3.5 shrink-0" />
					Enthält personenbezogene Daten (Mieter, Eigentümer, Nutzer) - Sicherungsdatei sicher verwahren.
				</p>
			</CardContent>
		</Card>
	);
}
