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
	}, [state.success]);

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
							<Select name="unitId" defaultValue={ownership?.unitId ?? defaultUnitId ?? units[0]?.id} required>
								<SelectTrigger id="unitId" className="w-full">
									<SelectValue placeholder={t("hoa.ownerships.placeholder.unit")} />
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
							<Select name="ownerId" defaultValue={ownership?.ownerId} required>
								<SelectTrigger id="ownerId" className="w-full">
									<SelectValue placeholder={t("hoa.ownerships.placeholder.owner")} />
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
						<div className="grid gap-2">
							<Label htmlFor="coOwnerId">{t("hoa.ownerships.fields.coOwner")}</Label>
							<Select name="coOwnerId" defaultValue={ownership?.coOwnerId ?? "none"}>
								<SelectTrigger id="coOwnerId" className="w-full">
									<SelectValue placeholder={t("hoa.ownerships.fields.noCoOwner")} />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="none">{t("hoa.ownerships.fields.noCoOwner")}</SelectItem>
									{owners.map((owner) => (
										<SelectItem key={owner.id} value={owner.id}>
											{owner.firstName} {owner.lastName}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="startDate">{isEdit ? t("hoa.ownerships.fields.startDate") : t("hoa.ownerships.fields.startDateCreate")} *</Label>
							<Input id="startDate" name="startDate" type="date" defaultValue={toDateInputValue(ownership?.startDate)} required />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" placeholder={t("hoa.ownerships.placeholder.notes")} defaultValue={ownership?.notes ?? ""} />
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
