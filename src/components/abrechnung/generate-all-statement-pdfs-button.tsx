"use client";

import { useState, useTransition } from "react";
import { FileStack, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { generateAllBillingStatementPdfsAction } from "@/app/(app)/abrechnung/actions";

/**
 * Erzeugt in einem Zug die PDFs für alle Mietverhältnisse einer
 * finalisierten Abrechnungsperiode (z. B. zur Vorbereitung des
 * Massenversands) - siehe generateAllBillingStatementPdfsAction.
 */
export function GenerateAllStatementPdfsButton({ billingPeriodId }: { billingPeriodId: string }) {
	const [isPending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);

	function handleClick() {
		setError(null);
		startTransition(async () => {
			const result = await generateAllBillingStatementPdfsAction(billingPeriodId);
			if (result?.error) {
				setError(result.error);
			}
		});
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
				{isPending ? <Loader2 className="animate-spin" /> : <FileStack />}
				Alle PDFs erzeugen
			</Button>
			{error ? <span className="text-xs text-destructive">{error}</span> : null}
		</div>
	);
}
