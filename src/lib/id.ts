/**
 * Erzeugt eine zufällige, URL-sichere ID für Primärschlüssel (Ersatz für
 * Prismas `cuid()` aus dem Vorgänger-Prototyp). Nutzt die auf Cloudflare
 * Workers native Web-Crypto-API (`crypto.randomUUID()`) statt einer
 * zusätzlichen Abhängigkeit (z. B. `cuid2`/`nanoid`).
 */
export function randomId(): string {
	return crypto.randomUUID();
}
