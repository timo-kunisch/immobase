"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { finalizeAnnualStatementAction } from "@/app/(app)/weg/jahresabrechnung/actions";

export function FinalizeAnnualStatementButton({ annualStatementId, hoaId }: { annualStatementId: string; hoaId: string }) {
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function handleClick() {
		if (typeof window !== "undefined" && !window.confirm("Diese Jahresabrechnung wirklich finalisieren? Danach können Kostenpositionen, Verbrauchswerte und Zeitraum nicht mehr geändert werden.")) {
			return;
		}
		setError(null);
		startTransition(async () => {
			const result = await finalizeAnnualStatementAction(annualStatementId, hoaId);
			if (result?.error) {
				setError(result.error);
			}
		});
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<Button type="button" onClick={handleClick} disabled={isPending}>
				{isPending ? <Loader2 className="animate-spin" /> : <CheckCircle2 />}
				Jahresabrechnung finalisieren
			</Button>
			{error ? <span className="text-xs text-destructive">{error}</span> : null}
		</div>
	);
}
