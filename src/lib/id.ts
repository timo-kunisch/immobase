/**
 * Erzeugt eine zufällige, URL-sichere ID für Primärschlüssel. Nutzt die
 * Web-Crypto-API (`crypto.randomUUID()` - in Node.js und Browsern nativ
 * verfügbar) statt einer zusätzlichen Abhängigkeit (z. B. `cuid2`/`nanoid`).
 */
export function randomId(): string {
	return crypto.randomUUID();
}
