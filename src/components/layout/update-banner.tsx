"use client";

import { useEffect, useState } from "react";
import { Download, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getDesktopBridge, type DesktopUpdateState } from "@/lib/desktop-bridge";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Update-Hinweis für die Desktop-App: blendet eine Leiste oberhalb des
 * Seiteninhalts ein, sobald der Auto-Updater (electron/main/updater.ts)
 * ein Update gefunden bzw. heruntergeladen hat. Nach dem Download kann die
 * Installation per Klick sofort ausgelöst werden (ansonsten erfolgt sie
 * automatisch beim nächsten Start).
 *
 * Bewusst OHNE Anzeige bleiben: "kein Update vorhanden", laufende Prüfung
 * und Fehler (offline-first: eine fehlgeschlagene Update-Prüfung ist kein
 * meldenswertes Problem, siehe AGENTS.md). Im Browser-/Dev-Kontext ohne
 * Desktop-Brücke wird ebenfalls nichts angezeigt.
 */
export function UpdateBanner() {
	const bridge = getDesktopBridge();
	const { t } = useI18n();
	const [state, setState] = useState<DesktopUpdateState | null>(null);

	useEffect(() => {
		if (!bridge) return;
		void bridge.getUpdateState().then(setState);
		return bridge.onUpdateState(setState);
	}, [bridge]);

	if (!bridge || !state) return null;
	if (state.status !== "available" && state.status !== "downloading" && state.status !== "downloaded") return null;

	const versionText = state.version ? ` ${state.version}` : "";

	return (
		<div className="flex items-center gap-3 border-b bg-primary/10 px-4 py-2 text-sm sm:px-6">
			<Download className="size-4 shrink-0 text-primary" />
			{state.status === "downloaded" ? (
				<>
					<span className="min-w-0 flex-1">{t("nav.update.downloaded", { version: versionText })}</span>
					<Button size="sm" onClick={() => void bridge.installUpdateNow()}>
						<RefreshCw />
						{t("nav.update.restartNow")}
					</Button>
				</>
			) : (
				<span className="min-w-0 flex-1">
					{t("nav.update.downloading", { version: versionText })}
					{state.status === "downloading" && state.percent !== null ? ` (${state.percent} %)` : t("nav.update.downloadingEllipsis")}
				</span>
			)}
		</div>
	);
}
