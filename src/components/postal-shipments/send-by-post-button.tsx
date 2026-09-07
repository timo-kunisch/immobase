"use client";

import { useState, useTransition } from "react";
import { Loader2, Send } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { PostalShipmentActionState } from "@/lib/postal-shipments";

/**
 * Generischer "Per Post versenden"-Button für alle drei PDF-Quellen
 * (Abrechnungen, Vorlagen-Schreiben, DMS-Dokumente) - die konkrete Server
 * Action (sendStatementByPostAction/sendGeneratedDocumentByPostAction/
 * sendDocumentByPostAction) wird als Prop übergeben, damit diese
 * Komponente selbst keine Modul-Grenzen kennen muss.
 *
 * Zeigt nach einem erfolgreichen Versand die von LetterXpress vergebene
 * Auftrags-ID sowie den Modus (Test/Live) direkt unter dem Button an - im
 * Testmodus zusätzlich einen Hinweis, dass der Auftrag nicht tatsächlich
 * zugestellt wird (siehe LetterXpress-API-Dokumentation: Testaufträge
 * landen nur in der Postbox und werden nach 7 Tagen automatisch gelöscht).
 */
export function SendByPostButton({ sendAction, disabled = false, disabledReason }: { sendAction: () => Promise<PostalShipmentActionState>; disabled?: boolean; disabledReason?: string }) {
	const [isPending, startTransition] = useTransition();
	const [result, setResult] = useState<PostalShipmentActionState | null>(null);

	function handleClick() {
		setResult(null);
		startTransition(async () => {
			const response = await sendAction();
			setResult(response);
		});
	}

	return (
		<div className="flex flex-col items-end gap-1">
			<Button type="button" variant="ghost" size="icon-sm" onClick={handleClick} disabled={isPending || disabled} aria-label="Per Post versenden" title={disabled && disabledReason ? disabledReason : "Per Post versenden"}>
				{isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
			</Button>
			{result && "error" in result ? <span className="max-w-[220px] text-right text-xs text-destructive">{result.error}</span> : null}
			{result && "success" in result ? (
				<span className="max-w-[220px] text-right text-xs text-emerald-600">
					Auftrag {result.jobId} übermittelt{result.mode === "test" ? " (Testmodus – wird nicht zugestellt)" : ""}.
				</span>
			) : null}
		</div>
	);
}
