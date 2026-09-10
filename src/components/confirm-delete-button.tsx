"use client";

import { useState, useTransition } from "react";
import { Trash2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";

type ActionResult = { error?: string } | void;

export function ConfirmDeleteButton({
	action,
	confirmMessage,
}: {
	action: () => Promise<ActionResult>;
	/** Optionale, fachlich sprechendere Bestätigungsfrage (sonst Standardtext). */
	confirmMessage?: string;
}) {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function handleClick() {
		if (typeof window !== "undefined" && !window.confirm(confirmMessage ?? t("common.confirmDeleteDefault"))) {
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
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={handleClick}
				disabled={isPending}
				aria-label={t("common.delete")}
				title={t("common.delete")}
			>
				{isPending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4 text-destructive" />}
			</Button>
			{error ? <span className="text-xs text-destructive">{error}</span> : null}
		</div>
	);
}
