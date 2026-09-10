"use client";

import { useTransition } from "react";
import { FileStack, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { showError } from "@/lib/toast";
import { generateAllBillingStatementPdfsAction } from "@/app/(app)/abrechnung/actions";

/**
 * Erzeugt in einem Zug die PDFs für alle Mietverhältnisse einer
 * finalisierten Abrechnungsperiode (z. B. zur Vorbereitung des
 * Massenversands) - siehe generateAllBillingStatementPdfsAction.
 */
export function GenerateAllStatementPdfsButton({ billingPeriodId }: { billingPeriodId: string }) {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();

	function handleClick() {
		startTransition(async () => {
			const result = await generateAllBillingStatementPdfsAction(billingPeriodId);
			if (result?.error) {
				showError(result.error);
			}
		});
	}

	return (
		<Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
			{isPending ? <Loader2 className="animate-spin" /> : <FileStack />}
			{t("billing.actions.generateAllPdfs")}
		</Button>
	);
}
