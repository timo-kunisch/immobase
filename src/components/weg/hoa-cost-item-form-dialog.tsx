"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { initialActionState } from "@/lib/action-state";
import { hoaAllocationKeyLabels } from "@/lib/hoa-allocation";
import { hoaCostCategoryLabels } from "@/lib/hoa-economic-plan";
import { hoaCostCategoryDefaultApportionable } from "@/lib/hoa-betrkv-bridge";

import type { HoaAllocationKey, HoaCostCategory, HoaCostItem, HoaCustomAllocationKey, Unit } from "@/data/types";

type CustomAllocationKey = HoaCustomAllocationKey;
type ActionResult = { error?: string; success?: boolean; message?: string };

/**
 * Gemeinsamer Kostenpositionen-Dialog für Wirtschaftsplan UND
 * Jahresabrechnung (hoaCostItems mit Diskriminator `context`, siehe
 * Annahme 7 in src/db/schema.ts) - die konkrete Server Action
 * (saveEconomicPlanCostItemAction/saveAnnualStatementCostItemAction) wird
 * als Prop übergeben. Das Feld "Umlagefähig" wird nur bei
 * context = "STATEMENT" angezeigt (siehe showApportionable), da es im
 * Wirtschaftsplan fachlich nicht relevant ist (Annahme 8 in schema.ts).
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
					<Button variant="ghost" size="icon-sm" aria-label="Bearbeiten" title="Bearbeiten">
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button" variant="outline" size="sm">
						<Plus />
						Kostenposition
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? "Kostenposition bearbeiten" : "Neue Kostenposition"}</DialogTitle>
						<DialogDescription>Kostenart und Umlageschlüssel für die WEG-Verwaltung.</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="hoaId" value={hoaId} />
					<input type="hidden" name={parentIdFieldName} value={parentId} />
					{isEdit ? <input type="hidden" name="id" value={costItem!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="label">Bezeichnung *</Label>
							<Input id="label" name="label" placeholder="z. B. Gebäudeversicherung" defaultValue={costItem?.label} required />
						</div>

						<div className="grid gap-2">
							<Label htmlFor="category">Kostenart *</Label>
							<Select name="category" value={category} onValueChange={(value) => handleCategoryChange(value as HoaCostCategory)} required>
								<SelectTrigger id="category" className="w-full">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{Object.entries(hoaCostCategoryLabels).map(([value, label]) => (
										<SelectItem key={value} value={value}>
											{label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="amount">Betrag (€) *</Label>
								<Input id="amount" name="amount" type="number" step="0.01" min="0" defaultValue={costItem?.amount} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="allocationKey">Umlageschlüssel *</Label>
								<Select name="allocationKey" value={allocationKey} onValueChange={(value) => setAllocationKey(value as HoaAllocationKey)} required>
									<SelectTrigger id="allocationKey" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(hoaAllocationKeyLabels)
											.filter(([value]) => value !== "CONSUMPTION" || parentIdFieldName === "annualStatementId")
											.map(([value, label]) => (
												<SelectItem key={value} value={value}>
													{label}
												</SelectItem>
											))}
									</SelectContent>
								</Select>
							</div>
						</div>

						{allocationKey === "DIRECT" ? (
							<div className="grid gap-2">
								<Label htmlFor="directUnitId">Einheit (direkte Zuordnung) *</Label>
								<Select name="directUnitId" defaultValue={costItem?.directUnitId ?? units[0]?.id} required>
									<SelectTrigger id="directUnitId" className="w-full">
										<SelectValue placeholder="Einheit auswählen" />
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
								<Label htmlFor="customAllocationKeyId">Verteilerschlüssel *</Label>
								<Select name="customAllocationKeyId" defaultValue={costItem?.customAllocationKeyId ?? customAllocationKeys[0]?.id} required>
									<SelectTrigger id="customAllocationKeyId" className="w-full">
										<SelectValue placeholder="Verteilerschlüssel auswählen" />
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
									<p className="text-xs text-destructive">Legen Sie zuerst unter „Verteilerschlüssel“ einen frei definierten Schlüssel an.</p>
								) : null}
							</div>
						) : null}

						{allocationKey === "CONSUMPTION" ? (
							<p className="text-xs text-muted-foreground">Die Verbrauchswerte je Einheit können nach dem Speichern über die Tabellenzeile dieser Kostenposition erfasst werden.</p>
						) : null}

						{showApportionable ? (
							<div className="flex items-center gap-2">
								<Switch id="isApportionable" name="isApportionable" checked={isApportionable} onCheckedChange={setIsApportionable} />
								<Label htmlFor="isApportionable">Umlagefähig auf Mieter (BetrKV)</Label>
							</div>
						) : null}

						<div className="grid gap-2">
							<Label htmlFor="notes">Notizen</Label>
							<Textarea id="notes" name="notes" defaultValue={costItem?.notes ?? ""} />
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
