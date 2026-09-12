/**
 * Interne Liste der mit dem KI-Assistenten erfolgreich getesteten Modelle
 * (jeweils inkl. Werkzeug-Aufrufe über die MCP-Registry geprüft).
 *
 * Die Liste dient als interne Referenz; die Empfehlungen unten stammen aus
 * ihr (Partner-Modell in src/lib/ai/partner.ts, Modell-Platzhalter des
 * benutzerdefinierten Endpunkts in der Einstellungs-Karte). Der frühere
 * Komfort-Hinweis zu ungetesteten Modellen in den Einstellungen ist
 * entfallen.
 *
 * Diese Datei muss client-sicher bleiben (keine Node-/Server-Imports), weil
 * sie direkt von der Client Component der Einstellungs-Karte importiert wird.
 *
 * Stand: September 2026. Nach neuen Tests die Liste hier ergänzen.
 */
export const TESTED_AI_MODELS: readonly string[] = [
	"anthropic/claude-fable-5.1",
	"anthropic/claude-fable-5",
	"anthropic/claude-opus-5",
	"anthropic/claude-sonnet-5",
	"openai/gpt-6-astra",
	"openai/gpt-5.6-sol",
	"openai/gpt-5.6-terra",
	"google/gemini-3.1-pro-preview",
	"google/gemini-3.8-flash",
	"z-ai/glm-5.3",
	"z-ai/glm-5.3-flash",
	"x-ai/grok-4.6",
	"moonshotai/kimi-k3",
	"ggml-org/Qwen3.8-27B-GGUF:Q8_0",
];

/** Unsere Empfehlung für Cloud-Endpunkte nach derzeitigem Stand. */
export const RECOMMENDED_AI_MODEL = "z-ai/glm-5.3-flash";

/**
 * Unsere Empfehlung für den lokalen Betrieb (z. B. LM Studio/Ollama) -
 * Mindestmodell, kleinere lokale Modelle liefern mit den MCP-Werkzeugen
 * erfahrungsgemäß keine verlässlichen Ergebnisse.
 */
export const RECOMMENDED_LOCAL_AI_MODEL = "ggml-org/Qwen3.8-27B-GGUF:Q8_0";

/** Vorberechnete Vergleichsmenge (normalisiert: getrimmt, kleingeschrieben). */
const TESTED_AI_MODELS_NORMALIZED = new Set(TESTED_AI_MODELS.map((model) => model.trim().toLowerCase()));

/**
 * Ist das Modell in der Liste der getesteten Modelle enthalten?
 * Groß-/Kleinschreibung und umschließende Leerzeichen werden ignoriert.
 */
export function isTestedAiModel(model: string): boolean {
	return TESTED_AI_MODELS_NORMALIZED.has(model.trim().toLowerCase());
}
