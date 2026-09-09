/**
 * Geteilte Grenzwerte für den KI-Chat-Verlauf - client-sicher (kein
 * Node-Import), damit Dialog (src/components/layout/chatbot-dialog.tsx)
 * und Chat-Route (src/app/api/chat/route.ts) denselben Wert nutzen
 * (Muster wie attachment-types.ts).
 */

/**
 * Harte Obergrenze des Chat-Verlaufs (Summe der Nachrichten-Zeichen
 * inkl. der neuen Nachricht): Ab hier lehnt die Chat-Route weitere
 * Nachrichten ab (HTTP 413) und der Dialog sperrt die Eingabe, bis der
 * Verlauf gelöscht wird. Der gesamte Verlauf fließt bei jeder Anfrage in
 * den KI-Kontext (grob ≈ 4 Zeichen pro Token) - 250.000 Zeichen
 * entsprechen rund 62.500 Tokens Mehrverbrauch pro Nachricht. (Die
 * weiche Warn-Schwelle von 100.000 Zeichen ist reine UI-Sache und liegt
 * im Dialog.)
 */
export const CHAT_HISTORY_HARD_LIMIT_CHARS = 250_000;
