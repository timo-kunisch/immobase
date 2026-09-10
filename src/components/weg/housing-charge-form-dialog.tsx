"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { toDateInputValue } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { saveHousingChargeAction } from "@/app/(app)/weg/hausgeld/actions";
import type { HousingCharge, Owner, Unit } from "@/data/types";

export function HousingChargeFormDialog({ hoaId, units, owners, housingCharge }: { hoaId: string; units: Unit[]; owners: Owner[]; housingCharge?: HousingCharge }) {
	const { t } = useI18n();
	const isEdit = Boolean(housingCharge);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveHousingChargeAction, initialActionState);

	const statusLabels: Record<string, string> = {
		OPEN: t("hoaFinance.charges.status.OPEN"),
		PAID: t("hoaFinance.charges.status.PAID"),
		OVERDUE: t("hoaFinance.charges.status.OVERDUE"),
		CANCELLED: t("hoaFinance.charges.status.CANCELLED"),
	};

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{isEdit ? (
					<Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} title={t("common.edit")}>
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button" disabled={units.length === 0 || owners.length === 0}>
						<Plus />
						{t("hoaFinance.charges.actions.create")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("hoaFinance.charges.dialog.editTitle") : t("hoaFinance.charges.dialog.createTitle")}</DialogTitle>
						<DialogDescription>{t("hoaFinance.charges.dialog.description")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="hoaId" value={hoaId} />
					{isEdit ? <input type="hidden" name="id" value={housingCharge!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="unitId">{t("common.unit")} *</Label>
							<Select name="unitId" defaultValue={housingCharge?.unitId ?? units[0]?.id} required>
								<SelectTrigger id="unitId" className="w-full">
									<SelectValue placeholder={t("hoaFinance.charges.placeholder.unit")} />
								</SelectTrigger>
								<SelectContent>
									{units.map((unit) => (
										<SelectItem key={unit.id} value={unit.id}>
											{unit.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="ownerId">{t("common.owner")} *</Label>
							<Select name="ownerId" defaultValue={housingCharge?.ownerId ?? owners[0]?.id} required>
								<SelectTrigger id="ownerId" className="w-full">
									<SelectValue placeholder={t("hoaFinance.charges.placeholder.owner")} />
								</SelectTrigger>
								<SelectContent>
									{owners.map((owner) => (
										<SelectItem key={owner.id} value={owner.id}>
											{owner.firstName} {owner.lastName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="amount">{t("hoaFinance.charges.fields.amount")} *</Label>
								<Input id="amount" name="amount" type="number" step="0.01" min="0" defaultValue={housingCharge?.amount} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="dueDate">{t("hoaFinance.charges.fields.dueDate")} *</Label>
								<Input id="dueDate" name="dueDate" type="date" defaultValue={toDateInputValue(housingCharge?.dueDate)} required />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="purpose">{t("hoaFinance.charges.fields.purpose")}</Label>
							<Input id="purpose" name="purpose" placeholder={t("hoaFinance.charges.placeholder.purpose")} defaultValue={housingCharge?.purpose ?? ""} />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="status">{t("common.status")}</Label>
							<Select name="status" defaultValue={housingCharge?.status ?? "OPEN"}>
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
