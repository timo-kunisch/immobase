"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { saveCostItemAction } from "@/app/(app)/abrechnung/actions";
import type { AllocationKey, CostCategory, CostItem, Unit } from "@/data/types";

const COST_CATEGORIES: CostCategory[] = [
	"PUBLIC_CHARGES",
	"WATER_SUPPLY",
	"DRAINAGE",
	"HEATING",
	"HOT_WATER",
	"HEATING_HOT_WATER_COMBINED",
	"ELEVATOR",
	"STREET_CLEANING_WASTE",
	"BUILDING_CLEANING_PEST_CONTROL",
	"GARDEN_MAINTENANCE",
	"LIGHTING",
	"CHIMNEY_CLEANING",
	"INSURANCE",
	"CARETAKER",
	"CABLE_ANTENNA",
	"LAUNDRY_FACILITIES",
	"OTHER",
];
const ALLOCATION_KEYS: AllocationKey[] = ["LIVING_SPACE", "OCCUPANTS", "UNITS", "CONSUMPTION", "DIRECT"];

export function CostItemFormDialog({ billingPeriodId, costItem, units }: { billingPeriodId: string; costItem?: CostItem; units: Unit[] }) {
	const { t } = useI18n();
	const isEdit = Boolean(costItem);
	const [open, setOpen] = useState(false);
	const [allocationKey, setAllocationKey] = useState<AllocationKey>(costItem?.allocationKey ?? "LIVING_SPACE");
	const [state, formAction, isPending] = useActionState(saveCostItemAction, initialActionState);

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
					<Button type="button" variant="outline" size="sm">
						<Plus />
						{t("billing.costItemDialog.trigger")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("billing.costItemDialog.editTitle") : t("billing.costItemDialog.createTitle")}</DialogTitle>
						<DialogDescription>{t("billing.costItemDialog.description")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="billingPeriodId" value={billingPeriodId} />
					{isEdit ? <input type="hidden" name="id" value={costItem!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="label">{t("billing.fields.label")} *</Label>
							<Input id="label" name="label" placeholder={t("billing.fields.labelPlaceholder")} defaultValue={costItem?.label} required />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="category">{t("billing.fields.category")} *</Label>
							<Select name="category" defaultValue={costItem?.category ?? "OTHER"} required>
								<SelectTrigger id="category" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{COST_CATEGORIES.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`billing.category.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="amount">{t("billing.fields.totalAmount")} *</Label>
								<Input id="amount" name="amount" type="number" step="0.01" min="0" defaultValue={costItem?.amount} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="allocationKey">{t("billing.fields.allocationKey")} *</Label>
								<Select name="allocationKey" value={allocationKey} onValueChange={(value) => setAllocationKey(value as AllocationKey)} required>
									<SelectTrigger id="allocationKey" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ALLOCATION_KEYS.map((value) => (
											<SelectItem key={value} value={value}>
												{t(`billing.allocationKey.${value}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						{allocationKey === "DIRECT" ? (
							<div className="grid gap-2">
								<Label htmlFor="directUnitId">{t("billing.fields.directUnit")} *</Label>
								<Select name="directUnitId" defaultValue={costItem?.directUnitId ?? units[0]?.id} required>
									<SelectTrigger id="directUnitId" className="w-full">
										<SelectValue placeholder={t("billing.fields.directUnitPlaceholder")} />
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
						) : null}

						{allocationKey === "CONSUMPTION" ? <p className="text-xs text-muted-foreground">{t("billing.costItemDialog.consumptionHint")}</p> : null}

						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" defaultValue={costItem?.notes ?? ""} />
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
