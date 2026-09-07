"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { markTransactionPaidAction } from "@/app/(app)/finanzen/actions";

export function MarkPaidButton({ transactionId }: { transactionId: string }) {
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function handleClick() {
		setError(null);
		startTransition(async () => {
			const result = await markTransactionPaidAction(transactionId);
			if (result?.error) {
				setError(result.error);
			}
		});
	}

	return (
		<div className="flex items-center gap-2">
			<Button type="button" variant="ghost" size="icon-sm" onClick={handleClick} disabled={isPending} aria-label="Als bezahlt markieren" title="Als bezahlt markieren">
				{isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4 text-emerald-600" />}
			</Button>
			{error ? <span className="text-xs text-destructive">{error}</span> : null}
		</div>
	);
}
