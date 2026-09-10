"use client";

import { useActionState, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { useI18n } from "@/lib/i18n/provider";

import { generateDueTransactionsAction } from "@/app/(app)/finanzen/actions";

function currentMonthValue(): string {
	const now = new Date();
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function GenerateDueTransactionsDialog() {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(generateDueTransactionsAction, initialActionState);
	const defaultMonth = currentMonthValue();

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button type="button" variant="outline">
					<CalendarClock />
					{t("finances.generate.trigger")}
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				{state.success ? (
					<>
						<DialogHeader>
							<DialogTitle>{t("finances.generate.successTitle")}</DialogTitle>
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
							<DialogTitle>{t("finances.generate.title")}</DialogTitle>
							<DialogDescription>{t("finances.generate.description")}</DialogDescription>
						</DialogHeader>

						<div className="grid gap-4 py-4">
							<div className="grid grid-cols-2 gap-4">
								<div className="grid gap-2">
									<Label htmlFor="fromMonth">{t("finances.generate.fromMonth")} *</Label>
									<Input id="fromMonth" name="fromMonth" type="month" defaultValue={defaultMonth} required />
								</div>
								<div className="grid gap-2">
									<Label htmlFor="toMonth">{t("finances.generate.toMonth")} *</Label>
									<Input id="toMonth" name="toMonth" type="month" defaultValue={defaultMonth} required />
								</div>
							</div>

							<div className="grid gap-2">
								<Label htmlFor="dueDay">{t("finances.generate.dueDay")} *</Label>
								<Input id="dueDay" name="dueDay" type="number" min="1" max="28" defaultValue="3" required />
								<p className="text-xs text-muted-foreground">{t("finances.generate.dueDayHint")}</p>
							</div>

							{state.error ? <p className="text-sm text-destructive">{state.error}</p> : null}
						</div>

						<DialogFooter>
							<Button type="button" variant="outline" onClick={() => setOpen(false)}>
								{t("common.cancel")}
							</Button>
							<Button type="submit" disabled={isPending}>
								{isPending ? <Loader2 className="animate-spin" /> : null}
								{t("finances.generate.submit")}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
