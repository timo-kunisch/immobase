"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Save, ShieldAlert, Sparkles } from "lucide-react";

import { saveAiSettingsAction } from "@/app/(app)/einstellungen/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";

export interface AiCardState {
	baseUrl: string;
	model: string;
	/** Ist ein API-Schlüssel hinterlegt? (Der Wert selbst wird nie an den Client gegeben.) */
	apiKeySet: boolean;
	configured: boolean;
}

function SubmitButton() {
	const { pending } = useFormStatus();
	return (
		<Button type="submit" disabled={pending}>
			{pending ? <Loader2 className="animate-spin" /> : <Save />}
			Speichern
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
	const [formState, formAction] = useActionState(saveAiSettingsAction, initialActionState);
	// Nach dem Speichern muss die Seite neu geladen werden, damit die Sidebar
	// den (geänderten) Freigabestatus der Sprechblase übernimmt (Muster wie
	// beim MCP-Toggle in mcp-card.tsx).
	const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
					KI-Assistent (OpenAI-kompatibel)
				</CardTitle>
				<CardDescription>
					Verbindet den KI-Assistenten (Sprechblase in der Sidebar) mit einem OpenAI-kompatiblen
					Chat-Endpunkt - z. B. OpenAI, ein kompatibles Gateway oder ein lokaler Server (LM Studio, Ollama). Der
					Assistent kann über die Werkzeuge des MCP-Servers Daten der Anwendung lesen und ändern. Ohne
					Konfiguration ist die Sprechblase deaktiviert.
				</CardDescription>
			</CardHeader>
			<CardContent className="space-y-4">
				<dl className="space-y-1 text-sm">
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">Status</dt>
						<dd>{state.configured ? "Konfiguriert - Assistent freigegeben" : "Nicht konfiguriert - Assistent deaktiviert"}</dd>
					</div>
					<div className="flex justify-between gap-4">
						<dt className="text-muted-foreground">API-Schlüssel</dt>
						<dd>{state.apiKeySet ? "hinterlegt" : "nicht hinterlegt (optional)"}</dd>
					</div>
				</dl>

				<form action={formAction} className="space-y-4">
					<div className="grid gap-2">
						<Label htmlFor="aiBaseUrl">Basis-URL des Endpunkts</Label>
						<Input
							id="aiBaseUrl"
							name="aiBaseUrl"
							defaultValue={state.baseUrl}
							placeholder="https://api.openai.com/v1"
							autoComplete="off"
						/>
						<p className="text-xs text-muted-foreground">
							Ohne Pfad „/chat/completions“ - dieser wird automatisch angehängt. Basis-URL und Modell gemeinsam
							leeren, um den Assistenten zu deaktivieren.
						</p>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="aiModel">Modell</Label>
						<Input id="aiModel" name="aiModel" defaultValue={state.model} placeholder="gpt-4o-mini" autoComplete="off" />
						<p className="text-xs text-muted-foreground">
							Das Modell muss Werkzeug-Aufrufe (Function/Tool-Calling) unterstützen, damit der Assistent auf die
							App-Daten zugreifen kann. Für angehängte Bilder ist zusätzlich ein multimodales („vision“-fähiges)
							Modell nötig.
						</p>
					</div>
					<div className="grid gap-2">
						<Label htmlFor="aiApiKey">API-Schlüssel (optional)</Label>
						<Input
							id="aiApiKey"
							name="aiApiKey"
							type="password"
							placeholder={state.apiKeySet ? "hinterlegt - leer lassen, um ihn beizubehalten" : "sk-..."}
							autoComplete="new-password"
						/>
						<p className="text-xs text-muted-foreground">
							Wird verschlüsselt gespeichert. Lokale Endpunkte (z. B. LM Studio, Ollama) kommen meist ohne
							Schlüssel aus.
						</p>
					</div>

					<div className="flex items-center gap-3">
						<SubmitButton />
						{formState.error ? <p className="text-sm text-destructive">{formState.error}</p> : null}
						{formState.success ? (
							<p className="text-sm text-emerald-600">Gespeichert. Die Seite wird neu geladen.</p>
						) : null}
					</div>
				</form>

				<p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
					<ShieldAlert className="mt-0.5 size-4 shrink-0" />
					<span>
						Der Assistent erhält über die MCP-Werkzeuge vollständigen Lese- UND Schreibzugriff auf alle Daten
						(inkl. Löschen und Finalisieren) - der Chat steht daher nur Administratoren zur Verfügung. Anfragen
						samt anfragbarem Datenbestand werden an den konfigurierten Endpunkt übertragen: Nutzen Sie einen
						Anbieter, dem Sie Ihre Daten anvertrauen wollen (alternativ ein lokales Modell).
					</span>
				</p>
			</CardContent>
		</Card>
	);
}
