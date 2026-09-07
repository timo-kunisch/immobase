"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { toDateInputValue } from "@/lib/format";
import { getTotalRentForDate } from "@/lib/rent-history";

import { saveTransactionAction } from "@/app/(app)/finanzen/actions";
import type { Lease, Property, RentAdjustment, Tenant, Transaction, Unit } from "@/data/types";

const statusLabels: Record<string, string> = {
	OPEN: "Fällig",
	PAID: "Bezahlt",
	OVERDUE: "Überfällig",
	CANCELLED: "Storniert",
};

type LeaseOption = Lease & {
	tenant: Tenant;
	unit: Unit & { property: Property };
	rentAdjustments: RentAdjustment[];
};

export function TransactionFormDialog({ transaction, leases }: { transaction?: Transaction; leases: LeaseOption[] }) {
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
	}, [state.success]);

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
					<Button variant="ghost" size="icon-sm" aria-label="Bearbeiten" title="Bearbeiten">
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button" disabled={leases.length === 0}>
						<Plus />
						Zahlung erfassen
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Zahlung bearbeiten" : "Zahlung erfassen"}</DialogTitle>
						<DialogDescription>Manuell erfasster Mieteingang bzw. fällige Zahlung.</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={transaction!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="leaseId">Mietvertrag *</Label>
							<Select name="leaseId" value={leaseId} onValueChange={handleLeaseChange} required>
								<SelectTrigger id="leaseId" className="w-full">
									<SelectValue placeholder="Mietvertrag auswählen" />
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
								<p className="text-xs text-muted-foreground">Miete gesamt zum Fälligkeitsdatum (Kalt + NK): {suggestedTotal.toFixed(2)} €</p>
							) : null}
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="amount">Betrag (€) *</Label>
								<Input id="amount" name="amount" type="number" step="0.01" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="dueDate">Fällig am *</Label>
								<Input id="dueDate" name="dueDate" type="date" value={dueDate} onChange={(event) => handleDueDateChange(event.target.value)} required />
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="purpose">Verwendungszweck</Label>
							<Input id="purpose" name="purpose" placeholder="z. B. Miete Januar 2026" defaultValue={transaction?.purpose ?? ""} />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="status">Status</Label>
							<Select name="status" defaultValue={transaction?.status ?? "OPEN"}>
								<SelectTrigger id="status" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(statusLabels).map(([value, label]) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							Abbrechen
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							Speichern
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
