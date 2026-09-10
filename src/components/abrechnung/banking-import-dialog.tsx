"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { initialActionState } from "@/lib/action-state";
import { formatCurrency } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { importCostItemsFromBankingAction } from "@/app/(app)/abrechnung/actions";

/** Uniforme Umlageschlüssel für den Sammel-Import (DIRECT/CUSTOM erfordern Einzelentscheidungen je Position). */
const IMPORT_KEYS = ["LIVING_SPACE", "OCCUPANTS", "UNITS", "CONSUMPTION"] as const;

/**
 * Nettosumme der Buchungszeilen eines Kontos im Abrechnungszeitraum
 * (structuralkompatibel zu AccountBookingSum aus src/data/accounts.ts -
 * bewusst lokal definiert, damit die Client-Komponente nichts aus dem
 * Repository-Layer importiert).
 */
export type BankingImportAccountSum = {
	id: string;
	label: string;
	/** Signed in Cent: negativ = Aufwand, positiv = Erstattungsüberschuss. */
	totalCents: number;
	bookingCount: number;
};

/**
 * "Aus Buchhaltung übernehmen"-Dialog einer Abrechnungsperiode: zeigt die
 * Konto-Bewegungssummen des Abrechnungszeitraums als Vorschau und legt je
 * Konto eine Kostenposition an (siehe importCostItemsFromBankingAction).
 * Ohne Kontobewegungen im Zeitraum bleibt der Trigger deaktiviert.
 */
export function BankingImportDialog({ billingPeriodId, accountSums }: { billingPeriodId: string; accountSums: BankingImportAccountSum[] }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(importCostItemsFromBankingAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	const hasSums = accountSums.length > 0;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={!hasSums}
					title={hasSums ? undefined : t("billing.bankingImport.emptyTrigger")}
				>
					<ArrowRightLeft />
					{t("billing.bankingImport.trigger")}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{t("billing.bankingImport.title")}</DialogTitle>
						<DialogDescription>{t("billing.bankingImport.description")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="billingPeriodId" value={billingPeriodId} />

					<div className="grid gap-4 py-4">
						<div className="max-h-64 overflow-y-auto rounded-md border">
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("billing.bankingImport.table.account")}</TableHead>
										<TableHead className="text-right">{t("billing.bankingImport.table.bookings")}</TableHead>
										<TableHead className="text-right">{t("billing.bankingImport.table.costItem")}</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{accountSums.map((sum) => (
										<TableRow key={sum.id}>
											<TableCell className="font-medium">{sum.label}</TableCell>
											<TableCell className="text-right text-muted-foreground">{sum.bookingCount}</TableCell>
											<TableCell className="text-right">{formatCurrency(-sum.totalCents / 100)}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="bankingImportAllocationKey">{t("billing.fields.allocationKey")} *</Label>
							<Select name="allocationKey" defaultValue="LIVING_SPACE" required>
								<SelectTrigger id="bankingImportAllocationKey" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{IMPORT_KEYS.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`billing.allocationKey.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="text-xs text-muted-foreground">{t("billing.bankingImport.hint.editable")}</p>
						</div>

						<ActionErrorToast state={state} />
						{state.success && state.message ? <p className="text-sm text-emerald-600">{state.message}</p> : null}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							{t("common.cancel")}
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							{t("billing.bankingImport.submit")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}