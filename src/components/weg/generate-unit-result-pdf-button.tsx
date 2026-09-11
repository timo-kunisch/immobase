"use client";

import { useTransition } from "react";
import { FileText, Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { generateHoaAnnualStatementPdfAction, sendHoaAnnualStatementByPostAction } from "@/app/(app)/weg/jahresabrechnung/actions";
import { formatFileSize } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { showError } from "@/lib/toast";
import { SendByPostButton } from "@/components/postal-shipments/send-by-post-button";

/**
 * Zeigt je eingefrorener Einzelabrechnung entweder einen "PDF erzeugen"-
 * Button (noch kein PDF vorhanden) oder einen Download-Link + "Neu
 * erzeugen"-Button (bereits vorhanden, z. B. nach Korrektur der
 * Absenderdaten unter /einstellungen) - Muster:
 * GenerateStatementPdfButton der Mietverwaltung.
 */
export function GenerateUnitResultPdfButton({
	unitResultId,
	pdfPath,
	pdfFileSize,
	postalConfigured,
}: {
	unitResultId: string;
	pdfPath: string | null;
	pdfFileSize: number | null;
	/** Ob LetterXpress-Zugangsdaten hinterlegt sind (Einstellungen). */
	postalConfigured: boolean;
}) {
	const { t } = useI18n();
	const [isPending, startTransition] = useTransition();

	function handleClick() {
		startTransition(async () => {
			const result = await generateHoaAnnualStatementPdfAction(unitResultId);
			if (result?.error) {
				showError(result.error);
			}
		});
	}

	if (!pdfPath) {
		return (
			<Button type="button" variant="outline" size="sm" onClick={handleClick} disabled={isPending}>
				{isPending ? <Loader2 className="animate-spin" /> : null}
				<FileText />
				{t("hoaStatement.actions.generatePdf")}
			</Button>
		);
	}

	return (
		<div className="flex items-center gap-1">
			<Button variant="ghost" size="sm" asChild>
				<a href={`/api/uploads/${pdfPath}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5">
					<FileText className="size-4" />
					{t("hoaStatement.actions.viewPdf")}
					<span className="text-xs text-muted-foreground">({formatFileSize(pdfFileSize)})</span>
				</a>
			</Button>
			<Button
				type="button"
				variant="ghost"
				size="icon-sm"
				onClick={handleClick}
				disabled={isPending}
				aria-label={t("hoaStatement.actions.regeneratePdf")}
				title={t("hoaStatement.actions.regeneratePdf")}
			>
				{isPending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
			</Button>
			<SendByPostButton sendAction={() => sendHoaAnnualStatementByPostAction(unitResultId)} disabled={!postalConfigured} disabledReason={t("postal.notConfiguredShort")} />
		</div>
	);
}