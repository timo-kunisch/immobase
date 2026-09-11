"use client";

import { useActionState, useEffect, useState } from "react";
import { Loader2, Pencil, Plus } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { saveAgendaItemAction } from "@/app/(app)/weg/versammlungen/actions";
import type { OwnerMeetingAgendaItem } from "@/data/types";

export function AgendaItemFormDialog({ hoaId, meetingId, agendaItem, nextPosition }: { hoaId: string; meetingId: string; agendaItem?: OwnerMeetingAgendaItem; nextPosition: number }) {
	const { t } = useI18n();
	const isEdit = Boolean(agendaItem);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveAgendaItemAction, initialActionState);

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
					<Button type="button" variant="outline" size="sm">
						<Plus />
						{t("hoaMeetings.agenda.actions.create")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("hoaMeetings.agenda.dialog.editTitle") : t("hoaMeetings.agenda.dialog.createTitle")}</DialogTitle>
					</DialogHeader>

					<input type="hidden" name="hoaId" value={hoaId} />
					<input type="hidden" name="meetingId" value={meetingId} />
					{isEdit ? <input type="hidden" name="id" value={agendaItem!.id} /> : null}

					<div className="grid gap-4 py-4">
						<div className="grid grid-cols-3 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="position">{t("hoaMeetings.agenda.fields.position")} *</Label>
								<Input id="position" name="position" type="number" min="1" defaultValue={agendaItem?.position ?? nextPosition} required />
							</div>
							<div className="col-span-2 grid gap-2">
								<Label htmlFor="title">{t("hoaMeetings.agenda.fields.title")} *</Label>
								<Input id="title" name="title" defaultValue={agendaItem?.title} required />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="description">{t("common.description")}</Label>
							<Textarea id="description" name="description" defaultValue={agendaItem?.description ?? ""} />
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
