"use client";

import { useState } from "react";
import { History } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { RentAdjustmentFormDialog } from "@/components/vertraege/rent-adjustment-form-dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import { buildRentHistory } from "@/lib/rent-history";
import { useI18n } from "@/lib/i18n/provider";

import { deleteRentAdjustmentAction } from "@/app/(app)/vertraege/actions";
import type { Lease, RentAdjustment } from "@/data/types";

type LeaseRentFields = Pick<Lease, "id" | "startDate" | "coldRent" | "serviceCharges">;

export function RentHistoryDialog({ lease, adjustments, hasAdjustments }: { lease: LeaseRentFields; adjustments: RentAdjustment[]; hasAdjustments: boolean }) {
	const { t } = useI18n();
	const [open, setOpen] = useState(false);
	const history = buildRentHistory(lease, adjustments);

	return (
		<Dialog open={open} onOpenChange={setOpen}>
			<DialogTrigger asChild>
				<Button
					variant="ghost"
					size="icon-sm"
					aria-label={t("leases.history.triggerHistory")}
					title={hasAdjustments ? t("leases.history.triggerHistory") : t("leases.history.triggerAdd")}
					className={hasAdjustments ? "text-primary" : undefined}
				>
					<History className="size-4" />
				</Button>
			</DialogTrigger>
			<DialogContent className="sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>{t("leases.history.title")}</DialogTitle>
					<DialogDescription>{t("leases.history.description")}</DialogDescription>
				</DialogHeader>

				<div className="max-h-[50vh] overflow-y-auto rounded-lg border">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>{t("leases.adjustment.fields.validFrom")}</TableHead>
								<TableHead>{t("leases.history.table.validUntil")}</TableHead>
								<TableHead className="text-right">{t("leases.history.table.coldRent")}</TableHead>
								<TableHead className="text-right">{t("leases.history.table.serviceCharges")}</TableHead>
								<TableHead>{t("leases.history.table.note")}</TableHead>
								<TableHead className="w-[80px] text-right">{t("common.actions")}</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{history.map((period) => {
								const adjustment = adjustments.find((a) => a.id === period.adjustmentId);
								return (
									<TableRow key={period.adjustmentId ?? "initial"}>
										<TableCell className="whitespace-nowrap">{formatDate(period.validFrom)}</TableCell>
										<TableCell className="whitespace-nowrap text-muted-foreground">{period.validUntil ? formatDate(period.validUntil) : t("leases.history.ongoing")}</TableCell>
										<TableCell className="text-right">{formatCurrency(period.coldRent)}</TableCell>
										<TableCell className="text-right">{formatCurrency(period.serviceCharges)}</TableCell>
										<TableCell className="text-muted-foreground">{period.notes ?? (period.adjustmentId ? "–" : t("leases.history.initialAmount"))}</TableCell>
										<TableCell>
											{adjustment ? (
												<div className="flex items-center justify-end gap-1">
													<RentAdjustmentFormDialog leaseId={lease.id} adjustment={adjustment} />
													<ConfirmDeleteButton
														action={deleteRentAdjustmentAction.bind(null, adjustment.id)}
														confirmMessage={t("leases.confirm.deleteAdjustment")}
													/>
												</div>
											) : null}
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</div>

				<DialogFooter className="items-center sm:justify-between">
					<RentAdjustmentFormDialog leaseId={lease.id} />
					<Button type="button" variant="outline" onClick={() => setOpen(false)}>
						{t("common.close")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
