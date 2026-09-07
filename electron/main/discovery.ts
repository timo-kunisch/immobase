import Bonjour from "bonjour-service";

import { log } from "./log";

/**
 * mDNS-Discovery für den Mehrbenutzer-Betrieb:
 * - Der HOST publiziert seinen Dienst (_immobase._tcp) mit dem LAN-Port.
 * - CLIENTS browsen nach Hosts im lokalen Netz.
 *
 * Manueller Fallback (IP:Port + Token von Hand eingeben) bleibt immer
 * möglich - mDNS wird in manchen Netzen (Gast-WLAN, VLANs) blockiert.
 */

const SERVICE_TYPE = "immobase";
const PROTOCOL = "tcp";

export interface DiscoveredHost {
	name: string;
	host: string | null;
	port: number;
	addresses: string[];
}

let bonjour: Bonjour | null = null;
let browser: ReturnType<Bonjour["find"]> | null = null;

function getBonjour(): Bonjour {
	if (!bonjour) bonjour = new Bonjour();
	return bonjour;
}

/** Publiziert den Host-Dienst (Modus "host"). Gibt eine unpublish-Funktion zurück. */
export function publishHostService(port: number): () => void {
	try {
		const service = getBonjour().publish({
			name: `ImmoBase (${process.env.COMPUTERNAME ?? process.env.HOSTNAME ?? "Host"})`,
			type: SERVICE_TYPE,
			protocol: PROTOCOL,
			port,
		});
		log.info(`mDNS: Dienst _${SERVICE_TYPE}._${PROTOCOL} auf Port ${port} publiziert.`);
		return () => {
			try {
				service.stop();
			} catch (error) {
				log.error("mDNS: unpublish fehlgeschlagen", error);
			}
		};
	} catch (error) {
		// mDNS darf den Start nicht verhindern (manueller Fallback existiert).
		log.error("mDNS: Dienst konnte nicht publiziert werden", error);
		return () => {};
	}
}

/**
 * Startet das Browsen nach Hosts. Gefundene/verschwundene Dienste werden
 * über die Callbacks gemeldet. Gibt eine Stop-Funktion zurück.
 */
export function startDiscovery(onUp: (host: DiscoveredHost) => void, onDown: (host: DiscoveredHost) => void): () => void {
	stopDiscovery();
	try {
		const toHost = (service: { name: string; port: number; host?: string; addresses?: string[] }): DiscoveredHost => ({
			name: service.name,
			host: service.host ?? null,
			port: service.port,
			addresses: service.addresses ?? [],
		});
		browser = getBonjour().find({ type: SERVICE_TYPE, protocol: PROTOCOL }, (service) => onUp(toHost(service)));
		browser.on("up", (service) => onUp(toHost(service)));
		browser.on("down", (service) => onDown(toHost(service)));
		log.info("mDNS: Discovery gestartet.");
	} catch (error) {
		log.error("mDNS: Discovery konnte nicht gestartet werden", error);
	}
	return stopDiscovery;
}

export function stopDiscovery(): void {
	if (browser) {
		try {
			browser.stop();
		} catch {
			// ignorieren
		}
		browser = null;
	}
}

export function destroyDiscovery(): void {
	stopDiscovery();
	if (bonjour) {
		try {
			bonjour.destroy();
		} catch {
			// ignorieren
		}
		bonjour = null;
	}
}
