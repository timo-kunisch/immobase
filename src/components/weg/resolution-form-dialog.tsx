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

import { saveResolutionAction } from "@/app/(app)/weg/versammlungen/actions";
import type { OwnerMeetingAgendaItem, OwnerResolution } from "@/data/types";

export function ResolutionFormDialog({
	hoaId,
	meetingId,
	agendaItems,
	resolution,
	defaultResolvedAt,
}: {
	hoaId: string;
	meetingId: string;
	agendaItems: OwnerMeetingAgendaItem[];
	resolution?: OwnerResolution;
	defaultResolvedAt?: string;
}) {
	const { t } = useI18n();
	const isEdit = Boolean(resolution);
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(saveResolutionAction, initialActionState);

	const votingResultLabels: Record<string, string> = {
		ACCEPTED: t("hoaMeetings.votingResult.ACCEPTED"),
		REJECTED: t("hoaMeetings.votingResult.REJECTED"),
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
					<Button type="button" variant="outline" size="sm">
						<Plus />
						{t("hoaMeetings.resolutions.actions.create")}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{isEdit ? t("hoaMeetings.resolutions.dialog.editTitle") : t("hoaMeetings.resolutions.dialog.createTitle")}</DialogTitle>
						<DialogDescription>{t("hoaMeetings.resolutions.dialog.description")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="hoaId" value={hoaId} />
					<input type="hidden" name="meetingId" value={meetingId} />
					{isEdit ? <input type="hidden" name="id" value={resolution!.id} /> : null}

					<div className="grid gap-4 py-4">
						{agendaItems.length > 0 ? (
							<div className="grid gap-2">
								<Label htmlFor="agendaItemId">{t("hoaMeetings.resolutions.fields.agendaItem")}</Label>
								<Select name="agendaItemId" defaultValue={resolution?.agendaItemId ?? "none"}>
									<SelectTrigger id="agendaItemId" className="w-full">
										<SelectValue placeholder={t("hoaMeetings.resolutions.agendaItemNone")} />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="none">{t("hoaMeetings.resolutions.agendaItemNone")}</SelectItem>
										{agendaItems.map((item) => (
											<SelectItem key={item.id} value={item.id}>
												{item.position}. {item.title}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						) : null}
						<div className="grid gap-2">
							<Label htmlFor="title">{t("hoaMeetings.resolutions.fields.title")} *</Label>
							<Input id="title" name="title" defaultValue={resolution?.title} required />
						</div>
						<div className="grid gap-2">
							<Label htmlFor="content">{t("hoaMeetings.resolutions.fields.content")} *</Label>
							<Textarea id="content" name="content" className="min-h-32" defaultValue={resolution?.content} required />
						</div>
						<div className="grid grid-cols-2 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="resolvedAt">{t("hoaMeetings.resolutions.fields.resolvedAt")} *</Label>
								<Input id="resolvedAt" name="resolvedAt" type="date" defaultValue={toDateInputValue(resolution?.resolvedAt) || defaultResolvedAt} required />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="votingResult">{t("hoaMeetings.resolutions.fields.votingResult")} *</Label>
								<Select name="votingResult" defaultValue={resolution?.votingResult ?? "ACCEPTED"} required>
									<SelectTrigger id="votingResult" className="w-full">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{Object.entries(votingResultLabels).map(([value, label]) => (
											<SelectItem key={value} value={value}>
												{label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
						<div className="grid grid-cols-3 gap-4">
							<div className="grid gap-2">
								<Label htmlFor="votesFor">{t("hoaMeetings.resolutions.fields.votesFor")}</Label>
								<Input id="votesFor" name="votesFor" type="number" step="0.01" min="0" defaultValue={resolution?.votesFor ?? ""} />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="votesAgainst">{t("hoaMeetings.resolutions.fields.votesAgainst")}</Label>
								<Input id="votesAgainst" name="votesAgainst" type="number" step="0.01" min="0" defaultValue={resolution?.votesAgainst ?? ""} />
							</div>
							<div className="grid gap-2">
								<Label htmlFor="votesAbstained">{t("hoaMeetings.resolutions.fields.votesAbstained")}</Label>
								<Input id="votesAbstained" name="votesAbstained" type="number" step="0.01" min="0" defaultValue={resolution?.votesAbstained ?? ""} />
							</div>
						</div>
						<div className="grid gap-2">
							<Label htmlFor="notes">{t("common.notes")}</Label>
							<Textarea id="notes" name="notes" defaultValue={resolution?.notes ?? ""} />
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
