"use client";

import { useActionState, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { generateHousingChargesAction } from "@/app/(app)/weg/wirtschaftsplan/actions";

export function GenerateHousingChargesDialog({ economicPlanId, hoaId }: { economicPlanId: string; hoaId: string }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(generateHousingChargesAction, initialActionState);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button type="button" variant="outline">
					<CalendarClock />
					{t("hoaFinance.charges.actions.generate")}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				{state.success ? (
					<>
						<DialogHeader>
							<DialogTitle>{t("hoaFinance.charges.dialog.generatedTitle")}</DialogTitle>
							<DialogDescription>{state.message}</DialogDescription>
						</DialogHeader>
						<DialogFooter>
							<Button type="button" onClick={() => setOpen(false)}>
								{t("common.close")}
							</Button>
						</DialogFooter>
					</>
				) : (
					<form action={formAction}>
						<DialogHeader>
							<DialogTitle>{t("hoaFinance.charges.dialog.generateTitle")}</DialogTitle>
							<DialogDescription>{t("hoaFinance.charges.dialog.generateDescription")}</DialogDescription>
						</DialogHeader>

						<input type="hidden" name="economicPlanId" value={economicPlanId} />
						<input type="hidden" name="hoaId" value={hoaId} />

						<div className="grid gap-4 py-4">
							<div className="grid gap-2">
								<Label htmlFor="dueDay">{t("hoaFinance.charges.fields.dueDay")} *</Label>
								<Input id="dueDay" name="dueDay" type="number" min="1" max="28" defaultValue="3" required />
								<p className="text-xs text-muted-foreground">{t("hoaFinance.charges.fields.dueDayHint")}</p>
							</div>
							<ActionErrorToast state={state} />
						</div>

						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setOpen(false)}>
								{t("common.cancel")}
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending ? <Loader2 className="animate-spin" /> : null}
								{t("hoaFinance.charges.actions.makeDue")}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
