"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Save, ShieldAlert, Sparkles, TriangleAlert } from "lucide-react";

import { saveAiSettingsAction } from "@/app/(app)/einstellungen/actions";
import { isTestedAiModel, RECOMMENDED_AI_MODEL, RECOMMENDED_LOCAL_AI_MODEL } from "@/lib/ai/tested-models";
import { Guide, GuideStep } from "@/components/einstellungen/guide";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

export interface AiCardState {
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
 * Karte "KI-Assistent (OpenAI-kompatibel)" in den Einstellungen (nur für
 * Admins sichtbar): konfiguriert den Chat-Endpunkt, den der KI-Assistent
 * (Sprechblase in der Sidebar, siehe components/layout/chatbot-dialog.tsx)
 * nutzt. Ohne vollständige Konfiguration (Basis-URL + Modell) ist der
 * Assistent deaktiviert.
 *
 * Der gespeicherte API-Schlüssel wird NICHT vorausgefüllt (Muster wie bei
 * den übrigen Geheimnissen) - leeres Feld = unverändert lassen.
 */
export function AiCard({ state }: { state: AiCardState }) {
	const { t } = useI18n();
	const [formState, formAction] = useActionState(saveAiSettingsAction, initialActionState);
	// Nach dem Speichern muss die Seite neu geladen werden, damit die Sidebar
	// den (geänderten) Freigabestatus der Sprechblase übernimmt (Muster wie
	// beim MCP-Toggle in mcp-card.tsx).
	const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Live-Prüfung des eingetragenen Modells gegen die intern getestete Liste:
	// Nicht getestete Modelle erhalten eine dezente Warnung (keine Sperre).
	const [model, setModel] = useState(state.model);
	const showUntestedModelWarning = model.trim() !== "" && !isTestedAiModel(model);

	useEffect(() => {
		if (formState.success && !reloadTimer.current) {
			reloadTimer.current = setTimeout(() => window.location.reload(), 1200);
		}
		return () => {
			if (reloadTimer.current) clearTimeout(reloadTimer.current);
		};
	}, [formState.success]);

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
						<dd>{state.apiKeySet ? t("settings.cards.ai.apiKeyStatus.set") : t("settings.cards.ai.apiKeyStatus.notSet")}</dd>
					</div>
				</dl>

				<Guide title={t("settings.cards.ai.guide.title")}>
					<GuideStep step={1} title={t("settings.cards.ai.guide.step1.title")}>
						<p>
							{t("settings.cards.ai.guide.step1.body")}
						</p>
					</GuideStep>
					<GuideStep step={2} title={t("settings.cards.ai.guide.step2.title")}>
						<p>
							<strong>OpenAI:</strong> {t("settings.cards.ai.guide.step2.openai.part1")}{" "}
							<code className="rounded bg-muted px-1 py-0.5 text-xs">platform.openai.com</code>{" "}
							{t("settings.cards.ai.guide.step2.openai.part2")}
						</p>
						<p>
							<strong>LM Studio:</strong> {t("settings.cards.ai.guide.step2.lmStudio.part1")}{" "}
							<code className="rounded bg-muted px-1 py-0.5 text-xs">http://localhost:1234/v1</code>
							{t("settings.cards.ai.guide.step2.lmStudio.part2")}
						</p>
					</GuideStep>
					<GuideStep step={3} title={t("settings.cards.ai.guide.step3.title")}>
						<p>
							OpenAI: <code className="rounded bg-muted px-1 py-0.5 text-xs">https://api.openai.com/v1</code>{" "}
							{t("settings.cards.ai.guide.step3.andExample")}{" "}
							<code className="rounded bg-muted px-1 py-0.5 text-xs">gpt-4o-mini</code>
							{t("settings.cards.ai.guide.step3.lmStudio")}{" "}
							<code className="rounded bg-muted px-1 py-0.5 text-xs">http://localhost:1234/v1</code>{" "}
							{t("settings.cards.ai.guide.step3.modelName")}
						</p>
						<p>
							{t("settings.cards.ai.guide.step3.toolCalling")}
						</p>
					</GuideStep>
					<GuideStep step={4} title={t("settings.cards.ai.guide.step4.title")}>
						<p>
							{t("settings.cards.ai.guide.step4.body")}
						</p>
					</GuideStep>
					<GuideStep step={5} title={t("settings.cards.ai.guide.step5.title")}>
						<p>
							{t("settings.cards.ai.guide.step5.body")}
						</p>
					</GuideStep>
				</Guide>

				<form action={formAction} className="space-y-4">
					<div className="grid gap-2">
						<Label htmlFor="aiBaseUrl">{t("settings.cards.ai.baseUrl")}</Label>
						<Input
							id="aiBaseUrl"
							name="aiBaseUrl"
							defaultValue={state.baseUrl}
							placeholder="https://api.openai.com/v1"
							autoComplete="off"
						/>
						<p className="text-xs text-muted-foreground">
							{t("settings.cards.ai.baseUrlHint")}
						</p>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="aiModel">{t("settings.cards.ai.model")}</Label>
						<Input
							id="aiModel"
							name="aiModel"
							value={model}
							onChange={(event) => setModel(event.target.value)}
							placeholder={RECOMMENDED_AI_MODEL}
							autoComplete="off"
						/>
						<p className="text-xs text-muted-foreground">
							{t("settings.cards.ai.modelHint")}
						</p>
						<p className="text-xs text-muted-foreground">
							{t("settings.cards.ai.modelRecommendation", {
								cloudModel: RECOMMENDED_AI_MODEL,
								localModel: RECOMMENDED_LOCAL_AI_MODEL,
							})}
						</p>
						{showUntestedModelWarning ? (
							<p className="flex items-start gap-1.5 text-xs text-amber-600 dark:text-amber-400">
								<TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
								<span>{t("settings.cards.ai.modelUntested")}</span>
							</p>
						) : null}
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
						<p className="text-xs text-muted-foreground">
							{t("settings.cards.ai.apiKeyHint")}
						</p>
					</div>

					<div className="flex items-center gap-3">
						<SubmitButton />
						{formState.error ? <p className="text-sm text-destructive">{formState.error}</p> : null}
						{formState.success ? (
							<p className="text-sm text-emerald-600">{t("settings.cards.ai.savedReload")}</p>
						) : null}
					</div>
				</form>

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
