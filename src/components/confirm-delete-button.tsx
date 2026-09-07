"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";

type ActionResult = { error?: string } | void;

export function ConfirmDeleteButton({
	action,
	confirmMessage = "Diesen Eintrag wirklich unwiderruflich löschen?",
}: {
	action: () => Promise<ActionResult>;
	confirmMessage?: string;
}) {
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function handleClick() {
		if (typeof window !== "undefined" && !window.confirm(confirmMessage)) {
			return;
		}
		setError(null);
		startTransition(async () => {
			const result = await action();
			if (result?.error) {
				setError(result.error);
			}
		});
	}

	return (
		<div className="flex items-center gap-2">
			<Button type="button" variant="ghost" size="icon-sm" onClick={handleClick} disabled={isPending} aria-label="Löschen" title="Löschen">
				{isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}
			</Button>
			{error ? <span className="text-xs text-destructive">{error}</span> : null}
		</div>
	);
}
