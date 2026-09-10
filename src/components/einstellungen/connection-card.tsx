"use client";

import { useEffect, useState } from "react";
import { Network } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getDesktopBridge, type DesktopConnectionInfo } from "@/lib/desktop-bridge";
import { useI18n } from "@/lib/i18n/provider";
import type { MessageKey } from "@/lib/i18n/translator";

const MODE_LABEL_KEYS: Record<string, MessageKey> = {
	local: "settings.cards.connection.mode.local",
	host: "settings.cards.connection.mode.host",
	client: "settings.cards.connection.mode.client",
};

/**
 * Verbindungsstatus-Karte für die Einstellungen (nur Desktop-App): zeigt
 * Modus und Verbindungsstatus live an (Reconnect-Status bei Client-Modus)
 * und öffnet den Verbindungs-/Modus-Dialog der Electron-Shell.
 */
export function ConnectionCard() {
	const { t } = useI18n();
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
				<CardTitle>{t("settings.cards.connection.title")}</CardTitle>
				<CardDescription>
					{t("settings.cards.connection.description")}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="flex items-center gap-2 text-sm">
					<span className={`inline-block size-2.5 rounded-full ${connected ? "bg-emerald-500" : "bg-red-500"}`} />
					<span>
						{mode && MODE_LABEL_KEYS[mode] ? t(MODE_LABEL_KEYS[mode]) : t("settings.cards.connection.notConfigured")} –{" "}
						{connected ? t("settings.cards.connection.connected") : t("settings.cards.connection.disconnected")}
					</span>
				</div>
				{info?.localUrl ? <p className="text-xs text-muted-foreground">{t("settings.cards.connection.localServer", { url: info.localUrl })}</p> : null}
				{info?.hostUrl ? <p className="text-xs text-muted-foreground">{t("settings.cards.connection.hostUrl", { url: info.hostUrl })}</p> : null}
				<Button variant="outline" onClick={() => bridge.openConnectionSettings()}>
					<Network />
					{t("settings.cards.connection.openSettings")}
				</Button>
			</CardContent>
		</Card>
	);
}
