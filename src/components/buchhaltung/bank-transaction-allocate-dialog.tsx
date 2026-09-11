"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, ArrowLeftRight } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { saveBankTransactionAllocationsAction } from "@/app/(app)/buchhaltung/actions";
import type { Account } from "@/data/types";

/**
 * Auswahl-Ziel einer Buchungszeile im Zuordnen-Dialog: ein Konto
 * ("account:<id>"), eine offene Miet-Sollstellung ("transaction:<id>") oder
 * eine offene Hausgeld-Sollstellung der WEG-Verwaltung
 * ("housingcharge:<id>").
 */
type AllocationTarget = { accountId: string | null; transactionId: string | null; housingChargeId: string | null };

interface TargetOption {
	value: string;
	label: string;
	group: "account" | "transaction" | "housingcharge";
}

export interface OpenTransactionOption {
	id: string;
	/** Anzeige-Bezeichnung der offenen Sollstellung (Verwendungszweck + Mieter). */
	label: string;
	amount: string;
	dueDate: string;
}

export interface OpenHousingChargeOption {
	id: string;
	/** Anzeige-Bezeichnung der offenen Hausgeld-Sollstellung (Verwendungszweck + Eigentümer). */
	label: string;
	amount: string;
	dueDate: string;
}

/** Bestehende Buchungszeile (für die Vorbelegung beim Öffnen des Dialogs). */
export interface AllocationPreset {
	accountId: string | null;
	transactionId: string | null;
	housingChargeId: string | null;
	amount: string;
}

function parseTarget(value: string): AllocationTarget {
	if (value.startsWith("account:")) return { accountId: value.slice("account:".length) || null, transactionId: null, housingChargeId: null };
	if (value.startsWith("transaction:")) return { accountId: null, transactionId: value.slice("transaction:".length) || null, housingChargeId: null };
	if (value.startsWith("housingcharge:")) return { accountId: null, transactionId: null, housingChargeId: value.slice("housingcharge:".length) || null };
	return { accountId: null, transactionId: null, housingChargeId: null };
}

/**
 * Zuordnen-Dialog einer Banktransaktion: Die Buchungszeilen (Ziel = Konto,
 * offene Miet-Sollstellung, offene Hausgeld-Sollstellung + Teilbetrag)
 * werden hier vollständig ersetzt - gespeichert wird immer der komplette
 * Satz Zeilen (Split-Buchungen sind ausdrücklich erlaubt, die Teilbeträge
 * dürfen die Transaktion insgesamt nicht übersteigen).
 */
export function BankTransactionAllocateDialog({
	bankTransaction,
	accounts,
	openTransactions,
	housingCharges = [],
}: {
	bankTransaction: { id: string; description: string; amount: string; bookingDate: string; allocations?: AllocationPreset[] };
	/** Konten der Liegenschaft. */
	accounts: Account[];
	/** Offene Miet-Sollstellungen der Liegenschaft (Buchungskreis Mietverwaltung). */
	openTransactions: OpenTransactionOption[];
	/** Offene Hausgeld-Sollstellungen der Liegenschaft (Buchungskreis WEG, /weg/buchhaltung). */
	housingCharges?: OpenHousingChargeOption[];
}) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveBankTransactionAllocationsAction, initialActionState);

	const amountCents = Math.round(Math.abs(Number(bankTransaction.amount)) * 100);

	const [rows, setRows] = useState<{ target: string; amount: string }[]>([]);
	const [initialized, setInitialized] = useState(false);

	// Beim Öffnen: bestehende Buchungszeilen (Konto/Miet-/Hausgeld-Sollstellung
	// + Betrag) als Zeilen vorbelegen, sonst eine leere Zeile mit dem Rest-Betrag.
	useEffect(() => {
		if (!open || initialized) return;
		const options = buildOptions();
		const initialRows =
			bankTransaction.allocations && bankTransaction.allocations.length > 0
				? bankTransaction.allocations.map((allocation) => ({
						target:
							allocation.accountId ?
							`account:${allocation.accountId}`
						: allocation.transactionId ?
							`transaction:${allocation.transactionId}`
						: allocation.housingChargeId ?
							`housingcharge:${allocation.housingChargeId}`
						:	"",
						amount: String(Math.abs(Number(allocation.amount))),
					}))
				: [];
		setRows(initialRows.length > 0 ? initialRows : [{ target: options[0]?.value ?? "", amount: (amountCents / 100).toFixed(2) }]);
		setInitialized(true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
			setInitialized(false);
		}
	}, [state.success]);

	function buildOptions(): TargetOption[] {
		return [
			...accounts.map((account) => ({ value: `account:${account.id}`, label: account.label, group: "account" as const })),
			...openTransactions.map((transaction) => ({
				value: `transaction:${transaction.id}`,
				label: `${transaction.label} (${transaction.amount} €, fällig ${transaction.dueDate.slice(0, 10)})`,
				group: "transaction" as const,
			})),
			...housingCharges.map((housingCharge) => ({
				value: `housingcharge:${housingCharge.id}`,
				label: `${housingCharge.label} (${housingCharge.amount} €, fällig ${housingCharge.dueDate.slice(0, 10)})`,
				group: "housingcharge" as const,
			})),
		];
	}

	const options = useMemo(buildOptions, [accounts, openTransactions, housingCharges]);

	const allocatedCents = rows.reduce((sum, row) => sum + Math.round(Number(row.amount.replace(",", ".")) * 100) || 0, 0);
	const remainingCents = amountCents - allocatedCents;

	return (
		<Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setInitialized(false); }}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label={t("banking.allocate.open")} title={t("banking.allocate.open")}>
					<ArrowLeftRight className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-xl">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{t("banking.allocate.title")}</DialogTitle>
						<DialogDescription>
							{t("banking.allocate.description", { description: bankTransaction.description, amount: (amountCents / 100).toFixed(2) })}
						</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="bankTransactionId" value={bankTransaction.id} />

					<div className="grid gap-4 py-4">
						{rows.map((row, index) => {
							const target = parseTarget(row.target);
							const transactionOption = openTransactions.find((transaction) => transaction.id === target.transactionId);
							const housingChargeOption = housingCharges.find((housingCharge) => housingCharge.id === target.housingChargeId);
							// Vorschlag: beim Wechsel auf eine Sollstellung deren offenen Betrag übernehmen.
							return (
								<div key={index} className="grid gap-2 rounded-md border p-3">
									<div className="grid grid-cols-[1fr_auto] items-center gap-2">
										<div className="grid gap-1">
											<Label htmlFor={`target-${index}`}>{t("banking.allocate.target")}</Label>
											<Select
												name={`target-${index}`}
												value={row.target}
												onValueChange={(next) => {
													const nextTarget = parseTarget(next);
													const nextTransaction = openTransactions.find((transaction) => transaction.id === nextTarget.transactionId);
													const nextHousingCharge = housingCharges.find((housingCharge) => housingCharge.id === nextTarget.housingChargeId);
													const suggestedAmount = nextTransaction
														? Math.abs(Number(nextTransaction.amount))
														: nextHousingCharge
															? Math.abs(Number(nextHousingCharge.amount))
															: Math.abs(Number(row.amount.replace(",", ".")) || 0);
													setRows((current) => current.map((r, i) => (i === index ? { target: next, amount: suggestedAmount.toFixed(2) } : r)));
												}}
											>
												<SelectTrigger id={`target-${index}`} className="w-full">
													<SelectValue placeholder={t("banking.allocate.targetPlaceholder")} />
												</SelectTrigger>
												<SelectContent>
													{accounts.length > 0 ? (
														<div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{t("banking.allocate.groupAccounts")}</div>
													) : null}
													{accounts.map((account) => (
														<SelectItem key={`account:${account.id}`} value={`account:${account.id}`}>
															{account.label}
														</SelectItem>
													))}
													{openTransactions.length > 0 ? (
														<div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{t("banking.allocate.groupTransactions")}</div>
													) : null}
													{openTransactions.map((transaction) => (
														<SelectItem key={`transaction:${transaction.id}`} value={`transaction:${transaction.id}`}>
															{transaction.label}
														</SelectItem>
													))}
													{housingCharges.length > 0 ? (
														<div className="px-2 py-1 text-xs font-semibold text-muted-foreground">{t("banking.allocate.groupHousingCharges")}</div>
													) : null}
													{housingCharges.map((housingCharge) => (
														<SelectItem key={`housingcharge:${housingCharge.id}`} value={`housingcharge:${housingCharge.id}`}>
															{housingCharge.label}
														</SelectItem>
													))}
												</SelectContent>
											</Select>
										</div>
										<Button
											type="button"
											variant="ghost"
											size="icon-sm"
											aria-label={t("common.delete")}
											title={t("common.delete")}
											onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
											disabled={rows.length <= 1}
										>
											<Trash2 className="size-4" />
										</Button>
									</div>
									<div className="grid gap-1">
										<Label htmlFor={`amount-${index}`}>{t("banking.allocate.shareAmount")}</Label>
										<Input
											id={`amount-${index}`}
											name={`amount-${index}`}
											type="number"
											step="0.01"
											min="0"
											value={row.amount}
											onChange={(event) => setRows((current) => current.map((r, i) => (i === index ? { ...r, amount: event.target.value } : r)))}
											required
										/>
									</div>
									{transactionOption ? <p className="text-xs text-muted-foreground">{transactionOption.label}</p> : null}
									{housingChargeOption ? <p className="text-xs text-muted-foreground">{housingChargeOption.label}</p> : null}
								</div>
							);
						})}

						<div className="flex items-center justify-between text-sm">
							<Button type="button" variant="outline" size="sm" onClick={() => setRows((current) => [...current, { target: options[0]?.value ?? "", amount: Math.max(remainingCents, 0) === 0 ? "" : (Math.max(remainingCents, 0) / 100).toFixed(2) }])}>
								<Plus />
								{t("banking.allocate.addRow")}
							</Button>
							<span className={remainingCents < 0 ? "font-medium text-destructive" : "text-muted-foreground"}>
								{t("banking.allocate.remaining", { amount: (Math.max(remainingCents, 0) / 100).toFixed(2) })}
							</span>
						</div>

						<ActionErrorToast state={state} />
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							{t("common.cancel")}
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							{t("common.save")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
