"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Pencil } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { toDateInputValue } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import { getTotalRentForDate } from "@/lib/rent-history";

import { saveTransactionAction } from "@/app/(app)/finanzen/actions";
import type { Lease, Property, RentAdjustment, Tenant, Transaction, TransactionStatus, Unit } from "@/data/types";

const TRANSACTION_STATUSES: TransactionStatus[] = ["OPEN", "PAID", "OVERDUE", "CANCELLED"];

type LeaseOption = Lease & {
	tenant: Tenant;
	unit: Unit & { property: Property };
	rentAdjustments: RentAdjustment[];
};

export function TransactionFormDialog({ transaction, leases }: { transaction?: Transaction; leases: LeaseOption[] }) {
	const { t } = useI18n();
	const isEdit = Boolean(transaction);
	const [open, setOpen] = useState(false);
	const [leaseId, setLeaseId] = useState(transaction?.leaseId ?? leases[0]?.id ?? "");
	const [dueDate, setDueDate] = useState(toDateInputValue(transaction?.dueDate) || new Date().toISOString().slice(0, 10));
	const [amount, setAmount] = useState(transaction?.amount ?? "");
	const [state, formAction, isPending] = useActionState(saveTransactionAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state]);

	const selectedLease = useMemo(() => leases.find((lease) => lease.id === leaseId), [leases, leaseId]);

	// Vorschlag für den Betrag: die zum gewählten Fälligkeitsdatum gültige
	// Miete (berücksichtigt spätere Mieterhöhungen/-senkungen), nicht einfach
	// immer der aktuelle Lease-Basiswert.
	const suggestedTotal = useMemo(() => {
		if (!selectedLease) return null;
		const referenceDate = dueDate ? new Date(dueDate) : new Date();
		return getTotalRentForDate(selectedLease, selectedLease.rentAdjustments, referenceDate);
	}, [selectedLease, dueDate]);

	function applySuggestedAmount(lease: LeaseOption, referenceDateValue: string) {
		const referenceDate = referenceDateValue ? new Date(referenceDateValue) : new Date();
		const total = getTotalRentForDate(lease, lease.rentAdjustments, referenceDate);
		setAmount(total.toFixed(2));
	}

	function handleLeaseChange(value: string) {
		setLeaseId(value);
		if (!isEdit) {
			const lease = leases.find((l) => l.id === value);
			if (lease) {
				applySuggestedAmount(lease, dueDate);
			}
		}
	}

	function handleDueDateChange(value: string) {
		setDueDate(value);
		if (!isEdit && selectedLease) {
			applySuggestedAmount(selectedLease, value);
		}
	}

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{isEdit ? (
					<Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} title={t("common.edit")}>
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button" disabled={leases.length === 0}>
						<Plus />
						{t("finances.transactionDialog.createTitle")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("finances.transactionDialog.editTitle") : t("finances.transactionDialog.createTitle")}</DialogTitle>
						<DialogDescription>{t("finances.transactionDialog.description")}</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={transaction!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="leaseId">{t("finances.fields.lease")} *</Label>
							<Select name="leaseId" value={leaseId} onValueChange={handleLeaseChange} required>
								<SelectTrigger id="leaseId" className="w-full">
									<SelectValue placeholder={t("finances.fields.leasePlaceholder")} />
								</SelectTrigger>
								<SelectContent>
									{leases.map((lease) => (
										<SelectItem key={lease.id} value={lease.id}>
											{lease.unit.property.name} – {lease.unit.label} ({lease.tenant.firstName} {lease.tenant.lastName})
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							{selectedLease && suggestedTotal !== null ? (
								<p className="text-xs text-muted-foreground">{t("finances.transactionDialog.suggestedTotal", { total: suggestedTotal.toFixed(2) })}</p>
							) : null}
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="amount">{t("finances.fields.amount")} *</Label>
								<Input id="amount" name="amount" type="number" step="0.01" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="dueDate">{t("finances.fields.dueDate")} *</Label>
								<Input id="dueDate" name="dueDate" type="date" value={dueDate} onChange={(event) => handleDueDateChange(event.target.value)} required />
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="purpose">{t("finances.fields.purpose")}</Label>
							<Input id="purpose" name="purpose" placeholder={t("finances.fields.purposePlaceholder")} defaultValue={transaction?.purpose ?? ""} />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="status">{t("common.status")}</Label>
							<Select name="status" defaultValue={transaction?.status ?? "OPEN"}>
								<SelectTrigger id="status" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{TRANSACTION_STATUSES.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`finances.status.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
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
