"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";
import { hoaCostCategoryDefaultApportionable } from "@/lib/hoa-betrkv-bridge";

import type { HoaAllocationKey, HoaCostCategory, HoaCostItem, HoaCustomAllocationKey, Unit } from "@/data/types";

type CustomAllocationKey = HoaCustomAllocationKey;
type ActionResult = { error?: string; success?: boolean; message?: string };

// Auswahlwerte der Kostenarten/Umlageschlüssel (Beschriftungen kommen aus
// den i18n-Schlüsseln "hoaPlan.category.*" bzw. "hoaPlan.allocationKey.*").
const COST_CATEGORY_VALUES: HoaCostCategory[] = [
	"RESERVE_CONTRIBUTION",
	"ADMINISTRATOR_FEE",
	"INSURANCE",
	"CARETAKER",
	"MAINTENANCE_REPAIR",
	"WATER_DRAINAGE",
	"HEATING",
	"ELECTRICITY_COMMON",
	"CLEANING",
	"GARDEN_MAINTENANCE",
	"ELEVATOR",
	"LEGAL_ADVICE",
	"BANK_FEES",
	"OTHER",
];
const ALLOCATION_KEY_VALUES: HoaAllocationKey[] = ["MEA", "LIVING_SPACE", "UNITS", "CONSUMPTION", "DIRECT", "CUSTOM"];

/**
 * Gemeinsamer Kostenpositionen-Dialog für Wirtschaftsplan UND
 * Jahresabrechnung (hoaCostItems mit Diskriminator `context`, siehe
 * Annahme 7 in AGENTS.md Abschnitt 6.1) - die konkrete Server Action
 * (saveEconomicPlanCostItemAction/saveAnnualStatementCostItemAction) wird
 * als Prop übergeben. Das Feld "Umlagefähig" wird nur bei
 * context = "STATEMENT" angezeigt (siehe showApportionable), da es im
 * Wirtschaftsplan fachlich nicht relevant ist (Annahme 8 in AGENTS.md).
 * UI-Texte: geteilte Schlüssel im Namespace "hoaPlan" (costItem.*).
 */
export function HoaCostItemFormDialog({
	action,
	parentIdFieldName,
	parentId,
	hoaId,
	costItem,
	units,
	customAllocationKeys,
	showApportionable = false,
}: {
	action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
	parentIdFieldName: "economicPlanId" | "annualStatementId";
	parentId: string;
	hoaId: string;
	costItem?: HoaCostItem;
	units: Unit[];
	customAllocationKeys: CustomAllocationKey[];
	showApportionable?: boolean;
}) {
	const { t } = useI18n();
	const isEdit = Boolean(costItem);
	const [open, setOpen] = useState(false);
	const [allocationKey, setAllocationKey] = useState<HoaAllocationKey>(costItem?.allocationKey ?? "MEA");
	const [category, setCategory] = useState<HoaCostCategory>(costItem?.category ?? "OTHER");
	const [isApportionable, setIsApportionable] = useState(costItem?.isApportionable ?? hoaCostCategoryDefaultApportionable[category]);
	const [state, formAction, isPending] = useActionState(action, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	function handleCategoryChange(next: HoaCostCategory) {
		setCategory(next);
		if (!isEdit) {
			// Beim Neuanlegen die Default-Vorbelegung je Kostenart übernehmen
			// (siehe hoaCostCategoryDefaultApportionable) - beim Bearbeiten
			// bleibt eine bereits getroffene Nutzerentscheidung unangetastet.
			setIsApportionable(hoaCostCategoryDefaultApportionable[next]);
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
					<Button type="button" variant="outline" size="sm">
						<Plus />
						{t("hoaPlan.costItem.add")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("hoaPlan.costItem.editTitle") : t("hoaPlan.costItem.createTitle")}</DialogTitle>
						<DialogDescription>{t("hoaPlan.costItem.description")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="hoaId" value={hoaId} />
					<input type="hidden" name={parentIdFieldName} value={parentId} />
					{isEdit ? <input type="hidden" name="id" value={costItem!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="label">{t("hoaPlan.costItem.fieldLabel")} *</Label>
							<Input id="label" name="label" placeholder={t("hoaPlan.costItem.labelPlaceholder")} defaultValue={costItem?.label} required />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="category">{t("hoaPlan.costItem.fieldCategory")} *</Label>
							<Select name="category" value={category} onValueChange={(value) => handleCategoryChange(value as HoaCostCategory)} required>
								<SelectTrigger id="category" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{COST_CATEGORY_VALUES.map((value) => (
										<SelectItem key={value} value={value}>
											{t(`hoaPlan.category.${value}`)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="amount">{t("hoaPlan.costItem.fieldAmount")} *</Label>
								<Input id="amount" name="amount" type="number" step="0.01" min="0" defaultValue={costItem?.amount} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="allocationKey">{t("hoaPlan.costItem.fieldAllocationKey")} *</Label>
								<Select name="allocationKey" value={allocationKey} onValueChange={(value) => setAllocationKey(value as HoaAllocationKey)} required>
									<SelectTrigger id="allocationKey" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{ALLOCATION_KEY_VALUES.filter((value) => value !== "CONSUMPTION" || parentIdFieldName === "annualStatementId").map((value) => (
											<SelectItem key={value} value={value}>
												{t(`hoaPlan.allocationKey.${value}`)}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						{allocationKey === "DIRECT" ? (
							<div className="grid gap-2">
								<Label htmlFor="directUnitId">{t("hoaPlan.costItem.fieldDirectUnit")} *</Label>
								<Select name="directUnitId" defaultValue={costItem?.directUnitId ?? units[0]?.id} required>
									<SelectTrigger id="directUnitId" className="w-full">
										<SelectValue placeholder={t("hoaPlan.costItem.selectUnit")} />
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

						{allocationKey === "CUSTOM" ? (
							<div className="grid gap-2">
								<Label htmlFor="customAllocationKeyId">{t("hoaPlan.costItem.fieldCustomAllocationKey")} *</Label>
								<Select name="customAllocationKeyId" defaultValue={costItem?.customAllocationKeyId ?? customAllocationKeys[0]?.id} required>
									<SelectTrigger id="customAllocationKeyId" className="w-full">
										<SelectValue placeholder={t("hoaPlan.costItem.selectCustomAllocationKey")} />
									</SelectTrigger>
									<SelectContent>
										{customAllocationKeys.map((key) => (
											<SelectItem key={key.id} value={key.id}>
												{key.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								{customAllocationKeys.length === 0 ? (
									<p className="text-xs text-destructive">{t("hoaPlan.costItem.noCustomKeys")}</p>
								) : null}
							</div>
						) : null}

						{allocationKey === "CONSUMPTION" ? (
							<p className="text-xs text-muted-foreground">{t("hoaPlan.costItem.consumptionHint")}</p>
						) : null}

						{showApportionable ? (
							<div className="flex items-center gap-2">
								<Switch id="isApportionable" name="isApportionable" checked={isApportionable} onCheckedChange={setIsApportionable} />
								<Label htmlFor="isApportionable">{t("hoaPlan.costItem.fieldApportionable")}</Label>
							</div>
						) : null}

						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" defaultValue={costItem?.notes ?? ""} />
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
