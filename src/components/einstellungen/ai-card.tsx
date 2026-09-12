"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import {
	ChevronDown,
	ExternalLink,
	Loader2,
	PowerOff,
	Save,
	ServerCog,
	ShieldAlert,
	Sparkles,
	Star,
	TriangleAlert,
	Zap,
} from "lucide-react";

import {
	deactivateAiAction,
	saveAiPartnerSettingsAction,
	saveAiSettingsAction,
} from "@/app/(app)/einstellungen/actions";
import { RECOMMENDED_LOCAL_AI_MODEL } from "@/lib/ai/tested-models";
import {
	AI_PARTNER_NAME,
	AI_PARTNER_URL,
	type AiProvider,
} from "@/lib/ai/partner";
import { ActionErrorToast } from "@/components/action-error-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";
import { showError } from "@/lib/toast";

export interface AiCardState {
	/** Aktuell aktiver Anbieter: Partner arbeitskraft.app, benutzerdefinierter Endpunkt oder leer. */
	provider: AiProvider;
	/** Gespeicherter benutzerdefinierter Endpunkt (nur für das Custom-Formular). */
	baseUrl: string;
	model: string;
	/** Ist ein API-Schlüssel hinterlegt? (Der Wert selbst wird nie an den Client gegeben.) */
	apiKeySet: boolean;
	configured: boolean;
}

function SubmitButton() {
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
 * Karte "KI-Assistent" in den Einstellungen (nur für Admins sichtbar):
 * konfiguriert den Chat-Endpunkt, den der KI-Assistent (Sprechblase in der
 * Sidebar, siehe components/layout/chatbot-dialog.tsx) nutzt.
 *
 * Zwei Wege (siehe src/lib/ai/config.ts):
 * - Partner-Modus (Standard, prominent oben): arbeitskraft.app stellt die
 *   KI-Rechenkraft bereit - die Einrichtung verlangt NUR den API-Schlüssel,
 *   Endpunkt und Modell stehen fest (src/lib/ai/partner.ts).
 * - Benutzerdefinierter Endpunkt (bewusst in den Hintergrund gestellt,
 *   aufklappbarer Bereich mit vorgeschalteter Warnung): beliebiger
 *   OpenAI-kompatibler Endpunkt mit Basis-URL + Modell wie bisher - die
 *   Eingabefelder erscheinen erst, nachdem die Warnung bestätigt wurde,
 *   dass von benutzerdefinierten Endpunkten abgeraten wird.
 *
 * Der gespeicherte API-Schlüssel wird NICHT vorausgefüllt (Muster wie bei
 * den übrigen Geheimnissen) - leeres Feld = unverändert lassen.
 */
export function AiCard({ state }: { state: AiCardState }) {
	const { t } = useI18n();
	const [partnerState, partnerAction] = useActionState(saveAiPartnerSettingsAction, initialActionState);
	const [customState, customAction] = useActionState(saveAiSettingsAction, initialActionState);
	const partnerActive = state.provider === "arbeitskraft";
	// Nach dem Speichern muss die Seite neu geladen werden, damit die Sidebar
	// den (geänderten) Freigabestatus der Sprechblase übernimmt (Muster wie
	// beim MCP-Toggle in mcp-card.tsx).
	const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Deaktivieren läuft außerhalb der Formulare (keine Eingabefelder),
	// Muster wie der Enable/Disable-Toggle in mcp-card.tsx.
	const [deactivateBusy, setDeactivateBusy] = useState(false);
	// Warn-Gate vor dem benutzerdefinierten Endpunkt: Die Eingabefelder werden
	// erst nach ausdrücklicher Bestätigung der Warnung freigegeben (Nutzer
	// sollen stattdessen die Partner-Empfehlung nutzen). Beim Zuklappen des
	// Bereichs wird die Bestätigung zurückgesetzt.
	const [customConfirmed, setCustomConfirmed] = useState(false);

	useEffect(() => {
		if ((partnerState.success || customState.success) && !reloadTimer.current) {
			reloadTimer.current = setTimeout(() => window.location.reload(), 1200);
		}
		return () => {
			if (reloadTimer.current) clearTimeout(reloadTimer.current);
		};
	}, [partnerState.success, customState.success]);

	async function handleDeactivate(): Promise<void> {
		setDeactivateBusy(true);
		try {
			const result = await deactivateAiAction();
			if (result.error) {
				showError(result.error);
				setDeactivateBusy(false);
				return;
			}
			setTimeout(() => window.location.reload(), 1200);
		} catch {
			showError(t("settings.cards.ai.errors.saveFailed"));
			setDeactivateBusy(false);
		}
	}

	return (
		<Card className="max-w-xl">
			<CardHeader>
				<CardTitle className="flex items-center gap-2">
					<Sparkles className="size-5" />
					{t("settings.cards.ai.title")}
				</CardTitle>
				<CardDescription>
					{t("settings.cards.ai.description")}
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<dl className="space-y-1 text-sm">
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">{t("settings.cards.ai.statusLabel")}</dt>
						<dd>{state.configured ? t("settings.cards.ai.status.configured") : t("settings.cards.ai.status.notConfigured")}</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">{t("settings.cards.ai.apiKeyStatus")}</dt>
						<dd>
							{state.apiKeySet
								? t("settings.cards.ai.apiKeyStatus.set")
								: partnerActive
									? t("settings.cards.ai.apiKeyStatus.notSetPlain")
									: t("settings.cards.ai.apiKeyStatus.notSet")}
						</dd>
					</div>
				</dl>

				{/* Partner arbeitskraft.app - der Standard-Weg: nur API-Schlüssel nötig. */}
				<div className="space-y-4 rounded-lg border border-primary/40 bg-primary/5 p-4">
					<div className="flex flex-wrap items-center justify-between gap-2">
						<div className="flex items-center gap-2">
							<Zap className="size-5 text-primary" />
							<p className="font-semibold">{AI_PARTNER_NAME}</p>
							<Badge>
								<Star />
								{t("settings.cards.ai.partner.badge")}
							</Badge>
						</div>
						{partnerActive ? (
							<Badge
								variant="outline"
								className="border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
							>
								{t("settings.cards.ai.partner.active")}
							</Badge>
						) : null}
					</div>
					<p className="text-sm text-muted-foreground">
						{t("settings.cards.ai.partner.description")}{" "}
						<a
							href={AI_PARTNER_URL}
							target="_blank"
							rel="noreferrer"
							className="font-medium text-primary underline-offset-4 hover:underline"
						>
							{AI_PARTNER_URL}
							<ExternalLink className="ml-1 inline size-3" />
						</a>
					</p>
					<form action={partnerAction} className="space-y-3">
						<div className="grid gap-2">
							<Label htmlFor="aiPartnerApiKey">{t("settings.cards.ai.partner.apiKey")}</Label>
							<Input
								id="aiPartnerApiKey"
								name="aiApiKey"
								type="password"
								placeholder={
									state.apiKeySet
										? t("settings.cards.ai.apiKeyPlaceholderSet")
										: t("settings.cards.ai.partner.apiKeyPlaceholder")
								}
								autoComplete="new-password"
							/>
							<p className="text-xs text-muted-foreground">
								{t("settings.cards.ai.partner.apiKeyHint")}
							</p>
						</div>
						<div className="flex flex-wrap items-center gap-3">
							<SubmitButton />
							{partnerActive ? (
								<Button type="button" variant="outline" onClick={handleDeactivate} disabled={deactivateBusy}>
									{deactivateBusy ? <Loader2 className="animate-spin" /> : <PowerOff />}
									{t("settings.cards.ai.partner.deactivate")}
								</Button>
							) : null}
							<ActionErrorToast state={partnerState} />
							{partnerState.success ? (
								<p className="text-sm text-emerald-600">{t("settings.cards.ai.savedReload")}</p>
							) : null}
						</div>
					</form>
				</div>

				{/*
					Benutzerdefinierter Endpunkt - bewusst im Hintergrund (eingeklappt),
					geöffnet dargestellt, wenn er die aktive Konfiguration ist. Vor
					den Eingabefeldern muss die Warnung bestätigt werden, dass von
					benutzerdefinierten Endpunkten abgeraten wird (bewusste Hürde -
					beim Zuklappen wird die Bestätigung zurückgesetzt).
				*/}
				<details
					className="group rounded-md border bg-muted/30 text-sm"
					open={state.provider === "custom"}
					onToggle={(event) => {
						if (!event.currentTarget.open) setCustomConfirmed(false);
					}}
				>
					<summary className="flex cursor-pointer list-none items-center gap-2 rounded-md p-3 font-medium hover:bg-muted/50 [&::-webkit-details-marker]:hidden">
						<ServerCog className="size-4 shrink-0 text-muted-foreground" />
						{t("settings.cards.ai.custom.toggle")}
						<ChevronDown className="ml-auto size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
					</summary>
					<div className="space-y-4 border-t p-4">
						{customConfirmed ? (
							<form action={customAction} className="space-y-4">
								<div className="grid gap-2">
									<Label htmlFor="aiBaseUrl">{t("settings.cards.ai.baseUrl")}</Label>
									<Input
										id="aiBaseUrl"
										name="aiBaseUrl"
										defaultValue={state.baseUrl}
										placeholder="http://localhost:9931/v1"
										autoComplete="off"
									/>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="aiModel">{t("settings.cards.ai.model")}</Label>
									<Input
										id="aiModel"
										name="aiModel"
										defaultValue={state.model}
										placeholder={RECOMMENDED_LOCAL_AI_MODEL}
										autoComplete="off"
									/>
								</div>
								<div className="grid gap-2">
									<Label htmlFor="aiApiKey">{t("settings.cards.ai.apiKey")}</Label>
									<Input
										id="aiApiKey"
										name="aiApiKey"
										type="password"
										placeholder={state.apiKeySet ? t("settings.cards.ai.apiKeyPlaceholderSet") : "sk-..."}
										autoComplete="new-password"
									/>
								</div>

								<div className="flex items-center gap-3">
									<SubmitButton />
									<ActionErrorToast state={customState} />
									{customState.success ? (
										<p className="text-sm text-emerald-600">{t("settings.cards.ai.savedReload")}</p>
									) : null}
								</div>
							</form>
						) : (
							<div className="space-y-3">
								<p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
									<TriangleAlert className="mt-0.5 size-4 shrink-0" />
									<span>{t("settings.cards.ai.custom.discouraged")}</span>
								</p>
								<Button type="button" variant="outline" onClick={() => setCustomConfirmed(true)}>
									{t("settings.cards.ai.custom.proceed")}
								</Button>
							</div>
						)}
					</div>
				</details>

				<p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
					<ShieldAlert className="mt-0.5 size-4 shrink-0" />
					<span>
						{t("settings.cards.ai.warning")}
					</span>
				</p>
			</CardContent>
		</Card>
	);
}
