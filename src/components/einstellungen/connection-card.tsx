"use client";

import { useEffect, useState } from "react";
import { Network } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDesktopBridge, type DesktopConnectionInfo } from "@/lib/desktop-bridge";

const MODE_LABELS: Record<string, string> = {
	local: "Lokal (nur dieser Rechner)",
	host: "Host (stellt Daten im Netzwerk bereit)",
	client: "Client (verbunden mit einem Host)",
};

/**
 * Verbindungsstatus-Karte für die Einstellungen (nur Desktop-App): zeigt
 * Modus und Verbindungsstatus live an (Reconnect-Status bei Client-Modus)
 * und öffnet den Verbindungs-/Modus-Dialog der Electron-Shell.
 */
export function ConnectionCard() {
	const bridge = getDesktopBridge();
	const [info, setInfo] = useState<DesktopConnectionInfo | null>(null);

	useEffect(() => {
		if (!bridge) return;
		void bridge.getConnectionInfo().then(setInfo);
		return bridge.onConnectionState((next) => setInfo(next as DesktopConnectionInfo));
	}, [bridge]);

	if (!bridge) return null; // Reiner Browser-Modus (Dev): Karte ausblenden

	const connected = info?.connected ?? false;
	const mode = info?.mode ?? null;

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle>Verbindung &amp; Mehrbenutzer</CardTitle>
				<CardDescription>
					Betriebsmodus der App. Im Modus „Host“ wird die Datenbank anderen Arbeitsplätzen im lokalen Netzwerk
					bereitgestellt; im Modus „Client“ verbindet sich diese Installation mit einem Host (keine lokalen Daten).
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex items-center gap-2 text-sm">
					<span className={`inline-block size-2.5 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`} />
					<span>
						{mode ? MODE_LABELS[mode] : "Nicht konfiguriert"} – {connected ? "verbunden" : "nicht verbunden"}
					</span>
				</div>
				{info?.localUrl ? <p className="text-xs text-muted-foreground">Lokaler Server: {info.localUrl}</p> : null}
				{info?.hostUrl ? <p className="text-xs text-muted-foreground">Host: {info.hostUrl}</p> : null}
				<Button variant="outline" onClick={() => bridge.openConnectionSettings()}>
					<Network />
					Verbindungseinstellungen öffnen
				</Button>
			</CardContent>
		</Card>
	);
}
