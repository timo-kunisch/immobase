import { RECOMMENDED_AI_MODEL } from "./tested-models";

/**
 * Konstanten für unseren Partner „arbeitskraft.app“, der die KI-Rechenkraft
 * für den KI-Assistenten bereitstellt (OpenAI-kompatible Chat-Completions-
 * API).
 *
 * Der Partner ist der Standard-Weg zur Einrichtung des Assistenten
 * (Einstellungen → Integrationen & KI → KI-Assistent): Es genügt die Eingabe
 * des API-Schlüssels - Endpunkt und Modell stehen fest und werden im
 * Hintergrund gesetzt. Benutzerdefinierte Endpunkte (OpenAI, LM Studio,
 * Ollama, ...) bleiben daneben möglich, sind in der UI aber bewusst in den
 * Hintergrund gestellt (aufklappbarer „Benutzerdefinierter KI-Endpunkt“-
 * Bereich der Einstellungs-Karte).
 *
 * Diese Datei muss client-sicher bleiben (keine Node-/Server-Imports), weil
 * sie direkt von der Client Component der Einstellungs-Karte importiert wird
 * (Muster wie tested-models.ts).
 */

/** Anzeigename des Partners (Marke, bewusst nicht übersetzt). */
export const AI_PARTNER_NAME = "arbeitskraft.app";

/** Öffentliche Website des Partners. */
export const AI_PARTNER_URL = "https://arbeitskraft.app";

/**
 * Basis-URL des Partner-Endpunkts (OpenAI-kompatibel, „/chat/completions“
 * wird wie üblich angehängt). Wird im Partner-Modus nicht hinterlegt, sondern
 * zur Laufzeit aus dieser Konstante gebildet.
 */
export const AI_PARTNER_BASE_URL = "https://arbeitskraft.app/v1";

/**
 * Im Partner-Modus fest genutztes Modell: unsere Cloud-Empfehlung aus der
 * intern getesteten Liste (src/lib/ai/tested-models.ts) - bewusst ohne
 * Modell-Auswahl in der UI, der Partner stellt die Rechenkraft bereit.
 */
export const AI_PARTNER_MODEL = RECOMMENDED_AI_MODEL;

/**
 * Wert des Einstellungsschlüssels „ai.provider“ für den Partner-Modus
 * (siehe src/lib/ai/config.ts).
 */
export const AI_PARTNER_PROVIDER = "arbeitskraft";

/**
 * Mögliche Werte des Einstellungsschlüssels „ai.provider“:
 * - "arbeitskraft": Partner-Modus (nur API-Schlüssel nötig, Endpunkt/Modell
 *   stehen fest)
 * - "custom": benutzerdefinierter OpenAI-kompatibler Endpunkt (ai.base_url +
 *   ai.model). Ältere Installationen ohne provider-Eintrag gelten ebenfalls
 *   als custom (Abwärtskompatibilität).
 * - "": nicht konfiguriert bzw. deaktiviert
 */
export type AiProvider = typeof AI_PARTNER_PROVIDER | "custom" | "";
