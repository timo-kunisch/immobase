"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { initialActionState } from "@/lib/action-state";
import { toDateInputValue } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { saveUnitOwnershipAction } from "@/app/(app)/weg/eigentumsverhaeltnisse/actions";
import type { Owner, Unit, UnitOwnership } from "@/data/types";

/**
 * Formular zum Erfassen eines Eigentumsverhältnisses - dient sowohl dem
 * Erst-Eintrag (Einheit erhält erstmals einen Eigentümer) als auch dem
 * Erfassen eines Eigentümerwechsels (neue Zeile mit späterem startDate,
 * die vorherige laufende Zeile wird serverseitig automatisch beendet,
 * siehe saveUnitOwnershipAction). Beim Bearbeiten (isEdit) wird
 * ausschließlich die bestehende Zeile aktualisiert, kein automatisches
 * Beenden einer anderen Zeile.
 */
export function UnitOwnershipFormDialog({ units, owners, ownership, defaultUnitId }: { units: Unit[]; owners: Owner[]; ownership?: UnitOwnership; defaultUnitId?: string }) {
	const { t } = useI18n();
	const isEdit = Boolean(ownership);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveUnitOwnershipAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				{isEdit ? (
					<Button variant="ghost" size="icon-sm" aria-label={t("common.edit")} title={t("common.edit")}>
						<Pencil className="size-4" />
					</Button>
				) : (
					<Button type="button" size="sm" variant="outline" disabled={units.length === 0 || owners.length === 0}>
						<Plus />
						{t("hoa.ownerships.actions.create")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("hoa.ownerships.dialog.editTitle") : t("hoa.ownerships.dialog.createTitle")}</DialogTitle>
						<DialogDescription>
							{isEdit
								? t("hoa.ownerships.dialog.editDescription")
								: t("hoa.ownerships.dialog.createDescription")}
						</DialogDescription>
					</DialogHeader>

					{isEdit ? <input type="hidden" name="id" value={ownership!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="unitId">{t("common.unit")} *</Label>
							<SearchableSelect
								name="unitId"
								id="unitId"
								options={units.map((unit) => ({ value: unit.id, label: unit.label }))}
								defaultValue={ownership?.unitId ?? defaultUnitId ?? units[0]?.id}
								placeholder={t("hoa.ownerships.placeholder.unit")}
								required
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="ownerId">{t("common.owner")} *</Label>
							<SearchableSelect
								name="ownerId"
								id="ownerId"
								options={owners.map((owner) => ({ value: owner.id, label: `${owner.firstName} ${owner.lastName}` }))}
								defaultValue={ownership?.ownerId}
								placeholder={t("hoa.ownerships.placeholder.owner")}
								required
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="coOwnerId">{t("hoa.ownerships.fields.coOwner")}</Label>
							<SearchableSelect
								name="coOwnerId"
								id="coOwnerId"
								options={[
									{ value: "none", label: t("hoa.ownerships.fields.noCoOwner") },
									...owners.map((owner) => ({ value: owner.id, label: `${owner.firstName} ${owner.lastName}` })),
								]}
								defaultValue={ownership?.coOwnerId ?? "none"}
								placeholder={t("hoa.ownerships.fields.noCoOwner")}
							/>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="startDate">{isEdit ? t("hoa.ownerships.fields.startDate") : t("hoa.ownerships.fields.startDateCreate")} *</Label>
							<Input id="startDate" name="startDate" type="date" defaultValue={toDateInputValue(ownership?.startDate)} required />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" placeholder={t("hoa.ownerships.placeholder.notes")} defaultValue={ownership?.notes ?? ""} />
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
