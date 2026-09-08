"use client";

import { useState } from "react";
import { Bot, Copy, Eye, EyeOff, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

import { getMcpTokenAction, regenerateMcpTokenAction, setMcpEnabledAction } from "@/app/(app)/einstellungen/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export interface McpCardState {
	enabled: boolean;
	tokenSet: boolean;
}

/**
 * Karte "MCP-Server (KI-Zugriff)" in den Einstellungen (nur für Admins
 * sichtbar): aktiviert/deaktiviert den MCP-Endpunkt (/api/mcp, siehe
 * src/app/api/mcp/route.ts), zeigt das Zugriffs-Token auf Klick an und
 * erlaubt dessen Rotation.
 *
 * Sicherheits-Hinweise werden bewusst prominent angezeigt: Das Token
 * gewährt vollständigen Lese-/Schreibzugriff auf alle Fachdaten
 * (faktisch Admin-Rechte).
 */
export function McpCard({ state }: { state: McpCardState }) {
	const [busy, setBusy] = useState<"toggle" | "reveal" | "rotate" | null>(null);
	const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [copied, setCopied] = useState<"token" | "config" | null>(null);

	// Die öffentliche URL ist clientseitig bekannt (gleiche Herkunft wie die App).
	const endpointUrl = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "/api/mcp";

	async function copyToClipboard(text: string, what: "token" | "config"): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(what);
			setTimeout(() => setCopied(null), 2000);
		} catch {
			setMessage({ kind: "error", text: "Kopieren in die Zwischenablage ist fehlgeschlagen." });
		}
	}

	async function handleToggle(): Promise<void> {
		setBusy("toggle");
		setMessage(null);
		try {
			const result = await setMcpEnabledAction(!state.enabled);
			if (result.error) {
				setMessage({ kind: "error", text: result.error });
			} else {
				setMessage({
					kind: "success",
					text: state.enabled
						? "Der MCP-Server wurde deaktiviert. Bestehende Tokens verlieren sofort ihre Wirkung."
						: "Der MCP-Server wurde aktiviert. Die Seite wird neu geladen.",
				});
				setToken(null);
				setTimeout(() => window.location.reload(), 1200);
			}
		} catch {
			setMessage({ kind: "error", text: "Die MCP-Einstellung konnte nicht gespeichert werden." });
		} finally {
			setBusy(null);
		}
	}

	async function handleToggleToken(): Promise<void> {
		if (token !== null) {
			setToken(null);
			return;
		}
		setBusy("reveal");
		setMessage(null);
		try {
			const result = await getMcpTokenAction();
			if (result.error || !result.token) {
				setMessage({ kind: "error", text: result.error ?? "Das MCP-Token konnte nicht gelesen werden." });
			} else {
				setToken(result.token);
			}
		} catch {
			setMessage({ kind: "error", text: "Das MCP-Token konnte nicht gelesen werden." });
		} finally {
			setBusy(null);
		}
	}

	async function handleRegenerate(): Promise<void> {
		if (
			!window.confirm(
				"Neues Zugriffs-Token erzeugen?\n\nDas bisherige Token verliert sofort seine Wirkung - verbundene KI-Clients müssen anschließend mit dem neuen Token konfiguriert werden."
			)
		) {
			return;
		}
		setBusy("rotate");
		setMessage(null);
		try {
			const result = await regenerateMcpTokenAction();
			if (result.error || !result.token) {
				setMessage({ kind: "error", text: result.error ?? "Das MCP-Token konnte nicht neu erzeugt werden." });
			} else {
				setToken(result.token);
				setMessage({ kind: "success", text: "Ein neues Token wurde erzeugt und wird unten angezeigt." });
			}
		} catch {
			setMessage({ kind: "error", text: "Das MCP-Token konnte nicht neu erzeugt werden." });
		} finally {
			setBusy(null);
		}
	}

	const clientConfigExample = JSON.stringify(
		{
			mcpServers: {
				immobase: {
					type: "http",
					url: endpointUrl,
					headers: { Authorization: "Bearer <TOKEN>" },
				},
			},
		},
		null,
		2
	);

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Bot className="size-5" />
					MCP-Server (KI-Zugriff)
				</CardTitle>
				<CardDescription>
					Aktiviert einen MCP-Endpunkt (Model Context Protocol), über den KI-Assistenten (z. B. Claude) sämtliche
					Daten der Anwendung lesen, anlegen, bearbeiten und löschen können. Standardmäßig deaktiviert.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<dl className="space-y-1 text-sm">
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">Status</dt>
						<dd>{state.enabled ? "Aktiviert - Endpunkt erreichbar" : "Deaktiviert"}</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">Endpunkt (URL)</dt>
						<dd>
							<code className="break-all rounded bg-muted px-1 py-0.5 text-xs">{endpointUrl}</code>
						</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">Zugriffs-Token</dt>
						<dd>{state.tokenSet ? "eingerichtet" : "noch nicht erzeugt"}</dd>
					</div>
				</dl>

				<div className="flex flex-wrap gap-2">
					<Button variant={state.enabled ? "outline" : "default"} onClick={handleToggle} disabled={busy !== null}>
						{busy === "toggle" ? <Loader2 className="animate-spin" /> : <Bot />}
						{state.enabled ? "MCP-Server deaktivieren" : "MCP-Server aktivieren"}
					</Button>
					{state.tokenSet ? (
						<>
							<Button variant="ghost" size="sm" onClick={handleToggleToken} disabled={busy !== null}>
								{busy === "reveal" ? <Loader2 className="animate-spin" /> : token !== null ? <EyeOff /> : <Eye />}
								{token !== null ? "Token ausblenden" : "Token anzeigen"}
							</Button>
							<Button variant="ghost" size="sm" onClick={handleRegenerate} disabled={busy !== null}>
								{busy === "rotate" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
								Neues Token erzeugen
							</Button>
						</>
					) : null}
				</div>

				{token !== null ? (
					<div className="space-y-2">
						<div className="flex items-start gap-2">
							<code className="block flex-1 break-all rounded-md border bg-muted p-2 text-xs select-all">{token}</code>
							<Button variant="outline" size="sm" onClick={() => copyToClipboard(token, "token")}>
								<Copy />
								{copied === "token" ? "Kopiert" : "Kopieren"}
							</Button>
						</div>
						<div className="space-y-1">
							<p className="text-xs text-muted-foreground">Beispiel-Konfiguration für MCP-Clients (Token einsetzen):</p>
							<div className="flex items-start gap-2">
								<pre className="flex-1 overflow-x-auto rounded-md border bg-muted p-2 text-xs">{clientConfigExample}</pre>
								<Button variant="outline" size="sm" onClick={() => copyToClipboard(clientConfigExample.replace("Bearer <TOKEN>", `Bearer ${token}`), "config")}>
									<Copy />
									{copied === "config" ? "Kopiert" : "Kopieren"}
								</Button>
							</div>
						</div>
					</div>
				) : null}

				{message ? (
					<p className={`text-sm ${message.kind === "error" ? "text-destructive" : "text-emerald-600"}`} role="status">
						{message.text}
					</p>
				) : null}

				<p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
					<ShieldAlert className="mt-0.5 size-4 shrink-0" />
					<span>
						Das Token gewährt vollständigen Lese- UND Schreibzugriff auf alle Daten (inkl. Löschen und
						Finalisieren von Abrechnungen) - behandeln Sie es wie ein Administrator-Passwort und geben Sie es nur
						an vertrauenswürdige KI-Clients weiter. Der Zugriff erfolgt lokal über diese App (im
						Mehrbenutzer-Betrieb zusätzlich durch das LAN-Zugangs-Token geschützt).
					</span>
				</p>
			</CardContent>
		</Card>
	);
}
