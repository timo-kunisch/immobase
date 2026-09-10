"use client";

import { useEffect, useRef } from "react";

import { showError } from "@/lib/toast";

/**
 * Rendert nichts; zeigt den Fehler aus einem useActionState-State stattdessen
 * als Toast an (siehe src/lib/toast.ts). Einsetzen an der Stelle, an der zuvor
 * der Fehler-Text inline stand.
 *
 * Der Vergleich gegen den initialen State (Objekt-Identität statt Text)
 * deckt zwei Fälle ab:
 * - Beim erneuten Öffnen eines Dialogs hängt der alte Fehler noch im State -
 *   der darf beim Mounten keinen Toast auslösen.
 * - Absendet derselbe Fehler erneut, liefert useActionState dennoch ein neues
 *   State-Objekt, der Toast erscheint also wieder.
 */
export function ActionErrorToast({ state }: { state: { error?: string } }) {
	const initialState = useRef(state);

	useEffect(() => {
		if (state !== initialState.current && state.error) {
			showError(state.error);
		}
	}, [state]);

	return null;
}