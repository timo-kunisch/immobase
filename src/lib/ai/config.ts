import { getSettingWithEnvFallback } from "@/data/app-settings";

import { AI_PARTNER_BASE_URL, AI_PARTNER_MODEL, AI_PARTNER_PROVIDER, type AiProvider } from "./partner";

/**
 * Konfiguration des KI-Assistenten (Chatbot in der Sidebar, siehe
 * src/components/layout/chatbot-dialog.tsx und src/app/api/chat/route.ts).
 *
 * Es gibt zwei Wege zur Einrichtung (Einstellungen → Integrationen & KI →
 * KI-Assistent):
 *
 * 1. Partner-Modus (Standard, prominent in der UI): „ai.provider“ =
 *    "arbeitskraft" - unser Partner arbeitskraft.app stellt die KI-Rechenkraft
 *    bereit (Konstanten in src/lib/ai/partner.ts). Die Einrichtung verlangt
 *    NUR den API-Schlüssel; Endpunkt (https://arbeitskraft.app/v1) und Modell
 *    (unsere Cloud-Empfehlung) stehen fest und werden erst zur Laufzeit
 *    gebildet, nicht gespeichert. Ohne hinterlegten Schlüssel gilt der
 *    Partner-Modus als nicht konfiguriert (fail-closed).
 *
 * 2. Benutzerdefinierter Endpunkt (bewusst in den Hintergrund gestellt,
 *    aufklappbarer Bereich der Einstellungs-Karte): „ai.provider“ = "custom"
 *    mit „ai.base_url“ + „ai.model“ - ein beliebiger OpenAI-kompatibler
 *    Chat-Completions-Endpunkt (OpenAI, Azure-kompatible Gateways, LM Studio,
 *    Ollama, ...). Installationen ohne provider-Eintrag, aber mit hinterlegter
 *    Basis-URL + Modell (Stand vor dem Partner-Feature) gelten weiterhin als
 *    custom - der Assistent bleibt nach dem Update unverändert nutzbar.
 *
 * In beiden Modi gilt: Es handelt sich um eine optionale Online-Funktion, ohne
 * vollständige Konfiguration ist die Sprechblase in der Sidebar deaktiviert
 * und die Chat-Route antwortet mit einer Fehlermeldung.
 *
 * Einstellungen in app_settings (Fallback: Umgebungsvariablen, Muster wie
 * bei den übrigen Online-Integrationen):
 * - "ai.provider": "arbeitskraft" | "custom" | "" (Klartext; Env-Fallback
 *   AI_PROVIDER)
 * - "ai.base_url": Basis-URL des benutzerdefinierten Endpunkts, z. B.
 *   "https://api.openai.com/v1" (Klartext; "/chat/completions" wird angehängt)
 * - "ai.model": Modellname des benutzerdefinierten Endpunkts, z. B.
 *   "gpt-4o-mini" (Klartext)
 * - "ai.apikey": API-Schlüssel, in beiden Modi derselbe Schlüssel-Speicher
 *   (FELD-VERSCHLÜSSELT, weil in SECRET_SETTING_KEYS in
 *   src/data/app-settings.ts eingetragen). Optional: Lokale Endpunkte
 *   (LM Studio, Ollama) kommen oft ohne Schlüssel aus.
 */

const AI_BASE_URL_KEY = "ai.base_url";
const AI_MODEL_KEY = "ai.model";
const AI_API_KEY_KEY = "ai.apikey";
const AI_PROVIDER_KEY = "ai.provider";

export interface AiConfig {
	/** Basis-URL ohne abschließenden Schrägstrich, z. B. "https://api.openai.com/v1". */
	baseUrl: string;
	model: string;
	/** API-Schlüssel oder null (Endpunkt ohne Authentifizierung, z. B. lokal). */
	apiKey: string | null;
}

/**
 * Liefert die KI-Konfiguration oder null, wenn sie unvollständig ist.
 * Partner-Modus: API-Schlüssel ist Pflicht (Endpunkt/Modell stehen fest).
 * Benutzerdefinierter Endpunkt: Basis-URL und Modell sind Pflicht, der
 * Schlüssel optional.
 */
export function getAiConfig(): AiConfig | null {
	const apiKey = getSettingWithEnvFallback(AI_API_KEY_KEY, "AI_API_KEY").trim() || null;
	const provider = getSettingWithEnvFallback(AI_PROVIDER_KEY, "AI_PROVIDER").trim();
	if (provider === AI_PARTNER_PROVIDER) {
		if (!apiKey) return null;
		return { baseUrl: AI_PARTNER_BASE_URL, model: AI_PARTNER_MODEL, apiKey };
	}
	const baseUrl = getSettingWithEnvFallback(AI_BASE_URL_KEY, "AI_BASE_URL").trim().replace(/\/+$/, "");
	const model = getSettingWithEnvFallback(AI_MODEL_KEY, "AI_MODEL").trim();
	if (!baseUrl || !model) return null;
	return { baseUrl, model, apiKey };
}

/**
 * Aktuell gewählter Anbieter ("arbeitskraft" | "custom" | "") für die
 * Einstellungs-Karte. Bestände ohne provider-Eintrag, aber mit hinterlegter
 * Basis-URL + Modell, gelten als "custom" (Abwärtskompatibilität).
 */
export function getAiProvider(): AiProvider {
	const provider = getSettingWithEnvFallback(AI_PROVIDER_KEY, "AI_PROVIDER").trim();
	if (provider === AI_PARTNER_PROVIDER) return AI_PARTNER_PROVIDER;
	const baseUrl = getSettingWithEnvFallback(AI_BASE_URL_KEY, "AI_BASE_URL").trim();
	const model = getSettingWithEnvFallback(AI_MODEL_KEY, "AI_MODEL").trim();
	if (baseUrl && model) return "custom";
	return "";
}

/** Ist ein KI-Endpunkt vollständig konfiguriert? (Steuert UI-Freigabe und Route.) */
export function isAiConfigured(): boolean {
	return getAiConfig() !== null;
}
