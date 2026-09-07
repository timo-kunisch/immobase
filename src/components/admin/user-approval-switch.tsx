"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";

import { Switch } from "@/components/ui/switch";
import { toggleUserApprovalAction } from "@/app/(app)/admin/users/actions";

export function UserApprovalSwitch({ userId, initialApproved, disabled }: { userId: string; initialApproved: boolean; disabled?: boolean }) {
	const [checked, setChecked] = useState(initialApproved);
	const [error, setError] = useState<string | null>(null);
	const [isPending, startTransition] = useTransition();

	function handleChange(value: boolean) {
		setError(null);
		startTransition(async () => {
			const result = await toggleUserApprovalAction(userId, value);
			if (result?.error) {
				setError(result.error);
			} else {
				setChecked(value);
			}
		});
	}

	return (
		<div className="flex items-center gap-2">
			<Switch checked={checked} onCheckedChange={handleChange} disabled={disabled || isPending} aria-label="Freigabe umschalten" />
			{isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
			{error ? <span className="text-xs text-destructive">{error}</span> : null}
		</div>
	);
}
