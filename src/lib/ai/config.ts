import { getSettingWithEnvFallback } from "@/data/app-settings";

/**
 * Konfiguration des KI-Assistenten (Chatbot in der Sidebar, siehe
 * src/components/layout/chatbot-dialog.tsx und src/app/api/chat/route.ts).
 *
 * Der Assistent nutzt einen beliebigen OpenAI-kompatiblen Chat-Completions-
 * Endpunkt (OpenAI, Azure-kompatible Gateways, LM Studio, Ollama, ...).
 * Es handelt sich um eine optionale Online-Funktion: Ohne Konfiguration ist
 * die Sprechblase in der Sidebar deaktiviert und die Chat-Route antwortet
 * mit einer Fehlermeldung.
 *
 * Einstellungen in app_settings (Fallback: Umgebungsvariablen, Muster wie
 * bei den übrigen Online-Integrationen):
 * - "ai.base_url": Basis-URL des Endpunkts, z. B. "https://api.openai.com/v1"
 *   (Klartext; "/chat/completions" wird angehängt)
 * - "ai.model": Modellname, z. B. "gpt-4o-mini" (Klartext)
 * - "ai.apikey": API-Schlüssel (FELD-VERSCHLÜSSELT, weil in
 *   SECRET_SETTING_KEYS in src/data/app-settings.ts eingetragen). Optional:
 *   Lokale Endpunkte (LM Studio, Ollama) kommen oft ohne Schlüssel aus.
 */

const AI_BASE_URL_KEY = "ai.base_url";
const AI_MODEL_KEY = "ai.model";
const AI_API_KEY_KEY = "ai.apikey";

export interface AiConfig {
	/** Basis-URL ohne abschließenden Schrägstrich, z. B. "https://api.openai.com/v1". */
	baseUrl: string;
	model: string;
	/** API-Schlüssel oder null (Endpunkt ohne Authentifizierung, z. B. lokal). */
	apiKey: string | null;
}

/**
 * Liefert die KI-Konfiguration oder null, wenn sie unvollständig ist
 * (Basis-URL und Modell sind Pflicht, der Schlüssel optional).
 */
export function getAiConfig(): AiConfig | null {
	const baseUrl = getSettingWithEnvFallback(AI_BASE_URL_KEY, "AI_BASE_URL").trim().replace(/\/+$/, "");
	const model = getSettingWithEnvFallback(AI_MODEL_KEY, "AI_MODEL").trim();
	if (!baseUrl || !model) return null;
	const apiKey = getSettingWithEnvFallback(AI_API_KEY_KEY, "AI_API_KEY").trim() || null;
	return { baseUrl, model, apiKey };
}

/** Ist ein KI-Endpunkt vollständig konfiguriert? (Steuert UI-Freigabe und Route.) */
export function isAiConfigured(): boolean {
	return getAiConfig() !== null;
}
