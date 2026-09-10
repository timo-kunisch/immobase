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
import { initialActionState } from "@/lib/action-state";
import { toDateInputValue } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { saveLeaseAction } from "@/app/(app)/vertraege/actions";
import type { Lease, Property, Tenant, Unit } from "@/data/types";

type UnitWithProperty = Unit & { property: Property };

export function LeaseFormDialog({ lease, units, tenants }: { lease?: Lease; units: UnitWithProperty[]; tenants: Tenant[] }) {
	const { t } = useI18n();
	const isEdit = Boolean(lease);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveLeaseAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state.success]);

	const disabled = units.length === 0 || tenants.length === 0;

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{isEdit ? (
					<Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} title={t("common.edit")}>
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button" disabled={disabled}>
						<Plus />
						{t("leases.dialog.createTitle")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-xl">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("leases.dialog.editTitle") : t("leases.dialog.createTitle")}</DialogTitle>
						<DialogDescription>{t("leases.dialog.description")}</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={lease!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="unitId">{t("leases.fields.unit")} *</Label>
								<Select name="unitId" defaultValue={lease?.unitId ?? units[0]?.id} required>
									<SelectTrigger id="unitId" className="w-full">
										<SelectValue placeholder={t("leases.fields.selectUnit")} />
									</SelectTrigger>
									<SelectContent>
										{units.map((unit) => (
											<SelectItem key={unit.id} value={unit.id}>
												{unit.property.name} – {unit.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
							<div className="grid gap-2">
								<Label htmlFor="tenantId">{t("common.tenant")} *</Label>
								<Select name="tenantId" defaultValue={lease?.tenantId ?? tenants[0]?.id} required>
									<SelectTrigger id="tenantId" className="w-full">
										<SelectValue placeholder={t("leases.fields.selectTenant")} />
									</SelectTrigger>
									<SelectContent>
										{tenants.map((tenant) => (
											<SelectItem key={tenant.id} value={tenant.id}>
												{tenant.firstName} {tenant.lastName}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>

						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="startDate">{t("leases.fields.startDate")} *</Label>
								<Input id="startDate" name="startDate" type="date" defaultValue={toDateInputValue(lease?.startDate)} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="endDate">{t("leases.fields.endDate")}</Label>
								<Input id="endDate" name="endDate" type="date" defaultValue={toDateInputValue(lease?.endDate)} />
							</div>
						</div>

						<div className="grid grid-cols-3 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="coldRent">{t("leases.fields.coldRent")} *</Label>
								<Input id="coldRent" name="coldRent" type="number" step="0.01" min="0" defaultValue={lease?.coldRent} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="serviceCharges">{t("leases.fields.serviceCharges")} *</Label>
								<Input id="serviceCharges" name="serviceCharges" type="number" step="0.01" min="0" defaultValue={lease?.serviceCharges} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="deposit">{t("leases.fields.deposit")}</Label>
								<Input id="deposit" name="deposit" type="number" step="0.01" min="0" defaultValue={lease?.deposit ?? ""} />
							</div>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="numberOfOccupants">{t("leases.fields.numberOfOccupants")} *</Label>
							<Input id="numberOfOccupants" name="numberOfOccupants" type="number" step="1" min="1" defaultValue={lease?.numberOfOccupants ?? 1} required />
							<p className="text-xs text-muted-foreground">{t("leases.fields.numberOfOccupantsHint")}</p>
						</div>

						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" defaultValue={lease?.notes ?? ""} />
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
