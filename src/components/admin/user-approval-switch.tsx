"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { toggleUserApprovalAction } from "@/app/(app)/admin/users/actions";

export function UserApprovalSwitch({ userId, initialApproved, disabled }: { userId: string; initialApproved: boolean; disabled?: boolean }) {
	const [checked, setChecked] = useState(initialApproved);
	const [error, setError] = useState<string | null>(null);
	const [message, setMessage] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function handleChange(value: boolean) {
		setError(null);
		setMessage(null);
		startTransition(async () => {
			const result = await toggleUserApprovalAction(userId, value);
			if (result?.error) {
				setError(result.error);
			} else {
				setChecked(value);
				// Z. B. Hinweis, dass ohne SMTP-Konfiguration keine
				// Benachrichtigungs-E-Mail an den Nutzer versendet wurde.
				setMessage(result?.message ?? null);
			}
		});
	}

	return (
		<div className="flex items-center gap-2">
			<Switch checked={checked} onCheckedChange={handleChange} disabled={disabled || isPending} aria-label="Freigabe umschalten" />
			{isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
			{error ? <span className="text-xs text-destructive">{error}</span> : null}
			{message ? <span className="text-xs text-muted-foreground">{message}</span> : null}
		</div>
	);
}
