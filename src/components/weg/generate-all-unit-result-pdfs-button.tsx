"use client";

import { useTransition } from "react";
import { FileStack, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n/provider";
import { showError } from "@/lib/toast";
import { generateAllHoaAnnualStatementPdfsAction } from "@/app/(app)/weg/jahresabrechnung/actions";

/**
 * Erzeugt in einem Zug die PDFs für alle Eigentümer-Einzelabrechnungen
 * einer finalisierten WEG-Jahresabrechnung (z. B. zur Vorbereitung des
 * Massenversands) - siehe generateAllHoaAnnualStatementPdfsAction. Muster:
 * GenerateAllStatementPdfsButton der Mietverwaltung.
 */
export function GenerateAllUnitResultPdfsButton({ annualStatementId }: { annualStatementId: string }) {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();

	function handleClick() {
		startTransition(async () => {
			const result = await generateAllHoaAnnualStatementPdfsAction(annualStatementId);
			if (result?.error) {
				showError(result.error);
			}
		});
	}

	return (
		<Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
			{isPending ? <Loader2 className="animate-spin" /> : null}
			<FileStack />
			{t("hoaStatement.actions.generateAllPdfs")}
		</Button>
	);
}