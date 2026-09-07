"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { finalizeEconomicPlanAction } from "@/app/(app)/weg/wirtschaftsplan/actions";

export function FinalizeEconomicPlanButton({ economicPlanId, hoaId }: { economicPlanId: string; hoaId: string }) {
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function handleClick() {
		if (typeof window !== "undefined" && !window.confirm("Diesen Wirtschaftsplan wirklich finalisieren? Danach können Kostenpositionen und Zeitraum nicht mehr geändert werden.")) {
			return;
		}
		setError(null);
		startTransition(async () => {
			const result = await finalizeEconomicPlanAction(economicPlanId, hoaId);
			if (result?.error) {
				setError(result.error);
			}
		});
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<Button type="button" onClick={handleClick} disabled={isPending}>
				{isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
				Wirtschaftsplan finalisieren
			</Button>
			{error ? <span className="text-xs text-destructive">{error}</span> : null}
		</div>
	);
}
