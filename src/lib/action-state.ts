/** Einheitlicher Rückgabetyp für Server Actions, die mit useActionState verwendet werden. */
export type ActionState = {
	error?: string;
	success?: boolean;
	/** Optionale Erfolgs-/Infomeldung, z. B. bei Auth-Flows ("E-Mail wurde versendet"). */
	message?: string;
};

export const initialActionState: ActionState = {};
