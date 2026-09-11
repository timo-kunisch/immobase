"use client";

import { useActionState, useEffect, useState } from "react";
import { ArrowRightLeft, Loader2 } from "lucide-react";

import { ActionErrorToast } from "@/components/action-error-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { initialActionState } from "@/lib/action-state";
import { formatDate } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

import { bridgeToBetrKvAction } from "@/app/(app)/weg/jahresabrechnung/actions";

type BillingPeriod = { id: string; periodFrom: string; periodTo: string };

/**
 * "In Nebenkostenabrechnung übernehmen"-Dialog für eine WEG-
 * Einzelabrechnung (annualStatementUnitResults) einer vermieteten Einheit -
 * siehe src/lib/hoa-betrkv-bridge.ts. Bietet nur Entwurfs-
 * Abrechnungsperioden derselben Liegenschaft zur Auswahl an (Filterung
 * erfolgt bereits serverseitig durch den Aufrufer dieser Komponente).
 */
export function BridgeToBetrKvDialog({ unitResultId, hoaId, availableBillingPeriods }: { unitResultId: string; hoaId: string; availableBillingPeriods: BillingPeriod[] }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const [state, formAction, isPending] = useActionState(bridgeToBetrKvAction, initialActionState);

	useEffect(() => {
		if (state.success) {
			setOpen(false);
		}
	}, [state]);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button variant="ghost" size="icon-sm" aria-label={t("hoaStatement.bridge.title")} title={t("hoaStatement.bridge.title")} disabled={availableBillingPeriods.length === 0}>
					<ArrowRightLeft className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-lg">
				<form action={formAction}>
					<DialogHeader>
						<DialogTitle>{t("hoaStatement.bridge.title")}</DialogTitle>
						<DialogDescription>{t("hoaStatement.bridge.description")}</DialogDescription>
					</DialogHeader>

					<input type="hidden" name="unitResultId" value={unitResultId} />
					<input type="hidden" name="hoaId" value={hoaId} />

					<div className="grid gap-4 py-4">
						<div className="grid gap-2">
							<Label htmlFor="billingPeriodId">{t("hoaStatement.bridge.field")} *</Label>
							<Select name="billingPeriodId" defaultValue={availableBillingPeriods[0]?.id} required>
								<SelectTrigger id="billingPeriodId" className="w-full">
									<SelectValue placeholder={t("hoaStatement.bridge.placeholder")} />
								</SelectTrigger>
								<SelectContent>
									{availableBillingPeriods.map((period) => (
										<SelectItem key={period.id} value={period.id}>
											{formatDate(period.periodFrom)} – {formatDate(period.periodTo)}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>
						<ActionErrorToast state={state} />
						{state.success && state.message ? <p className="text-sm text-emerald-600">{state.message}</p> : null}
					</div>

					<DialogFooter>
						<Button type="button" variant="outline" onClick={() => setOpen(false)}>
							{t("common.cancel")}
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? <Loader2 className="animate-spin" /> : null}
							{t("hoaStatement.bridge.submit")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
