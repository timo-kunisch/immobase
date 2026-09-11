/**
 * Einheitlicher Rückgabetyp für Server Actions, die mit useActionState verwendet werden.
 *
 * Muster für Dialoge, die nach dem Speichern schließen sollen: Den Close-Effekt
 * an `[state]` hängen, NICHT an `[state.success]` - useActionState erzeugt nach
 * jeder abgeschlossenen Action ein neues Objekt, während `state.success` bei
 * Folgespeicherungen dauerhaft true bleibt. Ein Effekt mit deps `[state.success]`
 * feuert beim zweiten erfolgreichen Speichern nicht erneut und der Dialog
 * schließt sich dann nicht.
 */
export type ActionState = {
	error?: string;
	success?: boolean;
	/** Optionale Erfolgs-/Infomeldung, z. B. bei Auth-Flows ("E-Mail wurde versendet"). */
	message?: string;
};

export const initialActionState: ActionState = {};
