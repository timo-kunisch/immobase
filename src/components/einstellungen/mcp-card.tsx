"use client";

import { useState } from "react";
import { Bot, Copy, Eye, EyeOff, Loader2, RefreshCw, ShieldAlert } from "lucide-react";

import { getMcpTokenAction, regenerateMcpTokenAction, setMcpEnabledAction } from "@/app/(app)/einstellungen/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/provider";
import { showError } from "@/lib/toast";
import type { McpTokenKind } from "@/lib/mcp/auth";

export interface McpCardState {
	enabled: boolean;
	adminTokenSet: boolean;
	userTokenSet: boolean;
}

/**
 * Karte "MCP-Server (KI-Zugriff)" in den Einstellungen (nur für Admins
 * sichtbar): aktiviert/deaktiviert den MCP-Endpunkt (/api/mcp, siehe
 * src/app/api/mcp/route.ts) und verwaltet die beiden Zugriffs-Token
 * (Anzeige auf Klick, Rotation).
 *
 * Token-Stufen (src/lib/mcp/auth.ts):
 * - Admin-Token: Vollzugriff inkl. Administrations-Werkzeugen
 *   (Nutzerverwaltung, Absenderdaten) - wie ein Administrator-Passwort.
 * - Nutzer-Token: eingeschränkter Zugriff auf die fachlichen Werkzeuge
 *   (entspricht den Rechten eines normalen Nutzers der App).
 *
 * Sicherheits-Hinweise werden bewusst prominent angezeigt: Beide Token
 * gewähren Lese-/Schreibzugriff auf die Fachdaten.
 */
export function McpCard({ state }: { state: McpCardState }) {
	const { t } = useI18n();
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<string | null>(null);

	// Die öffentliche URL ist clientseitig bekannt (gleiche Herkunft wie die App).
	const endpointUrl = typeof window !== "undefined" ? `${window.location.origin}/api/mcp` : "/api/mcp";

	async function handleToggle(): Promise<void> {
		setBusy(true);
		setMessage(null);
		try {
const result = await setMcpEnabledAction(!state.enabled);
		if (result.error) {
			showError(result.error);
		} else {
			setMessage(
				state.enabled
					? t("settings.cards.mcp.disabledSuccess")
					: t("settings.cards.mcp.enabledSuccess")
			);
			setTimeout(() => window.location.reload(), 1200);
		}
	} catch {
		showError(t("settings.cards.mcp.errors.saveFailed"));
	} finally {
			setBusy(false);
		}
	}

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Bot className="size-5" />
					{t("settings.cards.mcp.title")}
				</CardTitle>
				<CardDescription>
					{t("settings.cards.mcp.description")}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<dl className="space-y-1 text-sm">
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">{t("settings.cards.mcp.statusLabel")}</dt>
						<dd>{state.enabled ? t("settings.cards.mcp.status.enabled") : t("settings.cards.mcp.status.disabled")}</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">{t("settings.cards.mcp.endpoint")}</dt>
						<dd>
							<code className="break-all rounded bg-muted px-1 py-0.5 text-xs">{endpointUrl}</code>
						</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">{t("settings.cards.mcp.adminToken")}</dt>
						<dd>{state.adminTokenSet ? t("settings.cards.mcp.tokenSet") : t("settings.cards.mcp.tokenNotSet")}</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">{t("settings.cards.mcp.userToken")}</dt>
						<dd>{state.userTokenSet ? t("settings.cards.mcp.tokenSet") : t("settings.cards.mcp.tokenNotSet")}</dd>
					</div>
				</dl>

				<div className="flex flex-wrap gap-2">
					<Button variant={state.enabled ? "outline" : "default"} onClick={handleToggle} disabled={busy}>
						{busy ? <Loader2 className="animate-spin" /> : <Bot />}
						{state.enabled ? t("settings.cards.mcp.disable") : t("settings.cards.mcp.enable")}
					</Button>
				</div>

				{state.adminTokenSet ? (
					<TokenSection
						kind="ADMIN"
						title={t("settings.cards.mcp.adminToken")}
						description={t("settings.cards.mcp.adminTokenDescription")}
						endpointUrl={endpointUrl}
					/>
				) : null}
				{state.userTokenSet ? (
					<TokenSection
						kind="USER"
						title={t("settings.cards.mcp.userToken")}
						description={t("settings.cards.mcp.userTokenDescription")}
						endpointUrl={endpointUrl}
					/>
				) : null}

{message ? <p className="text-sm text-emerald-600" role="status">{message}</p> : null}

			<p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
					<ShieldAlert className="mt-0.5 size-4 shrink-0" />
					<span>
						{t("settings.cards.mcp.warning")}
					</span>
				</p>
			</CardContent>
		</Card>
	);
}

/** Anzeige-/Rotations-Bereich für ein Zugriffs-Token (Admin- oder Nutzer-Stufe). */
function TokenSection({
	kind,
	title,
	description,
	endpointUrl,
}: {
	kind: McpTokenKind;
	title: string;
	description: string;
	endpointUrl: string;
}) {
	const { t } = useI18n();
	const [busy, setBusy] = useState<"reveal" | "rotate" | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [copied, setCopied] = useState<"token" | "config" | null>(null);

	async function copyToClipboard(text: string, what: "token" | "config"): Promise<void> {
		try {
			await navigator.clipboard.writeText(text);
			setCopied(what);
			setTimeout(() => setCopied(null), 2000);
		} catch {
			showError(t("settings.cards.mcp.token.copyFailed"));
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
const result = await getMcpTokenAction(kind);
		if (result.error || !result.token) {
			showError(result.error ?? t("settings.cards.mcp.token.readFailed"));
		} else {
			setToken(result.token);
		}
	} catch {
		showError(t("settings.cards.mcp.token.readFailed"));
	} finally {
			setBusy(null);
		}
	}

	async function handleRegenerate(): Promise<void> {
		if (
			!window.confirm(
				t("settings.cards.mcp.token.regenerateConfirm")
			)
		) {
			return;
		}
		setBusy("rotate");
		setMessage(null);
		try {
const result = await regenerateMcpTokenAction(kind);
		if (result.error || !result.token) {
			showError(result.error ?? t("settings.cards.mcp.token.regenerateFailed"));
		} else {
			setToken(result.token);
			setMessage(t("settings.cards.mcp.token.regenerated"));
		}
	} catch {
		showError(t("settings.cards.mcp.token.regenerateFailed"));
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
		<div className="space-y-2 rounded-md border p-3">
			<div className="space-y-0.5">
				<p className="text-sm font-medium">{title}</p>
				<p className="text-xs text-muted-foreground">{description}</p>
			</div>
			<div className="flex flex-wrap gap-2">
				<Button variant="ghost" size="sm" onClick={handleToggleToken} disabled={busy !== null}>
					{busy === "reveal" ? <Loader2 className="animate-spin" /> : token !== null ? <EyeOff /> : <Eye />}
					{token !== null ? t("settings.cards.mcp.token.hide") : t("settings.cards.mcp.token.show")}
				</Button>
				<Button variant="ghost" size="sm" onClick={handleRegenerate} disabled={busy !== null}>
					{busy === "rotate" ? <Loader2 className="animate-spin" /> : <RefreshCw />}
					{t("settings.cards.mcp.token.regenerate")}
				</Button>
			</div>

			{token !== null ? (
				<div className="space-y-2">
					<div className="flex items-start gap-2">
						<code className="block flex-1 break-all rounded-md border bg-muted p-2 text-xs select-all">{token}</code>
						<Button variant="outline" size="sm" onClick={() => copyToClipboard(token, "token")}>
							<Copy />
							{copied === "token" ? t("settings.cards.mcp.token.copied") : t("settings.cards.mcp.token.copy")}
						</Button>
					</div>
					<div className="space-y-1">
						<p className="text-xs text-muted-foreground">{t("settings.cards.mcp.token.configExample")}</p>
						<div className="flex items-start gap-2">
							<pre className="flex-1 overflow-x-auto rounded-md border bg-muted p-2 text-xs">{clientConfigExample}</pre>
							<Button
								variant="outline"
								size="sm"
								onClick={() => copyToClipboard(clientConfigExample.replace("Bearer <TOKEN>", `Bearer ${token}`), "config")}
							>
								<Copy />
								{copied === "config" ? t("settings.cards.mcp.token.copied") : t("settings.cards.mcp.token.copy")}
							</Button>
						</div>
					</div>
				</div>
			) : null}

			{message ? <p className="text-sm text-emerald-600" role="status">{message}</p> : null}
		</div>
	);
}
