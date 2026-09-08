import { AlertTriangle, Wallet } from "lucide-react";

import {
	countHousingChargesForUnits,
	listHousingChargesForUnitsPage,
	listHoasSortedByName,
	listOpenHousingChargeArrearAmounts,
	listOwnersSortedByLastName,
	listUnitsForProperties,
} from "@/data/housing-charges";
import { SiteHeader } from "@/components/layout/site-header";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { PaginationBar } from "@/components/ui/pagination-bar";
import { ConfirmDeleteButton } from "@/components/confirm-delete-button";
import { HousingChargeFormDialog } from "@/components/weg/housing-charge-form-dialog";
import { MarkHousingChargePaidButton } from "@/components/weg/mark-housing-charge-paid-button";
import { HoaFilter } from "@/components/weg/hoa-filter";
import { formatCurrency, formatDate } from "@/lib/format";
import { resolvePagination } from "@/lib/pagination";

import { deleteHousingChargeAction } from "./actions";

export const dynamic = "force-dynamic";

const statusLabels: Record<string, string> = {
	OPEN: "Fällig",
	PAID: "Bezahlt",
	OVERDUE: "Überfällig",
	CANCELLED: "Storniert",
};

const statusStyles: Record<string, string> = {
	OPEN: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
	PAID: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400",
	OVERDUE: "bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400",
	CANCELLED: "bg-muted text-muted-foreground",
};

export default async function HausgeldPage({ searchParams }: { searchParams: Promise<{ hoaId?: string; page?: string }> }) {
	const { hoaId, page: pageParam } = await searchParams;

	const hoaList = listHoasSortedByName();

	if (hoaList.length === 0) {
		return (
			<div className="flex flex-1 flex-col">
				<SiteHeader title="Hausgeld" description="Hausgeld-Sollstellungen je WEG und Eigentümer." />
				<div className="flex-1 p-4 sm:p-6">
					<p className="text-sm text-muted-foreground">Legen Sie zuerst unter „WEG-Verwaltung“ eine WEG an.</p>
				</div>
			</div>
		);
	}

	const selectedHoa = hoaId ? hoaList.find((h) => h.id === hoaId) : undefined;
	const relevantHoas = selectedHoa ? [selectedHoa] : hoaList;

	const units = listUnitsForProperties(relevantHoas.map((h) => h.propertyId));
	const ownerList = listOwnersSortedByLastName();
	const unitIds = units.map((u) => u.id);

	// Paginierte Sollstellungs-Liste (wächst unbegrenzt, eine Seite = 50 Einträge).
	const chargePagination = resolvePagination(pageParam, countHousingChargesForUnits(unitIds));
	const chargeList = listHousingChargesForUnitsPage(unitIds, chargePagination);

	// Rückstände über ALLE Sollstellungen (unabhängig von der angezeigten Seite).
	const now = new Date();
	const arrears = listOpenHousingChargeArrearAmounts(unitIds, now).reduce((sum, amount) => sum + Number(amount), 0);

	return (
		<div className="flex flex-1 flex-col">
			<SiteHeader title="Hausgeld" description="Hausgeld-Sollstellungen je WEG und Eigentümer." actions={selectedHoa ? <HousingChargeFormDialog hoaId={selectedHoa.id} units={units} owners={ownerList} /> : undefined} />

			<div className="flex-1 space-y-4 p-4 sm:p-6">
				<HoaFilter hoas={hoaList} value={hoaId} basePath="/weg/hausgeld" />

				{arrears > 0 ? (
					<Card className="border-red-200 dark:border-red-900">
						<CardContent className="flex items-center gap-3 py-4">
							<AlertTriangle className="size-5 text-red-600" />
							<p className="text-sm">
								<span className="font-semibold">{formatCurrency(arrears)}</span> an Hausgeld-Rückständen (fällige/überfällige Sollstellungen).
							</p>
						</CardContent>
					</Card>
				) : null}

				<Card>
					<CardContent className="p-0">
						{chargeList.length === 0 ? (
							<div className="flex flex-col items-center justify-center gap-2 py-16 text-center text-muted-foreground">
								<Wallet className="size-8" />
								<p>Noch keine Hausgeld-Sollstellungen erfasst.</p>
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										{!selectedHoa ? <TableHead>WEG</TableHead> : null}
										<TableHead>Eigentümer / Einheit</TableHead>
										<TableHead>Verwendungszweck</TableHead>
										<TableHead>Fällig am</TableHead>
										<TableHead className="text-right">Betrag</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className="w-[120px] text-right">Aktionen</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{chargeList.map((charge) => {
										const chargeHoa = charge.hoa;
										return (
											<TableRow key={charge.id}>
												{!selectedHoa ? <TableCell className="text-muted-foreground">{chargeHoa?.name ?? "–"}</TableCell> : null}
												<TableCell className="font-medium">
													{charge.owner.firstName} {charge.owner.lastName}
													<span className="block text-xs text-muted-foreground">{charge.unit.label}</span>
												</TableCell>
												<TableCell className="text-muted-foreground">{charge.purpose ?? "–"}</TableCell>
												<TableCell className="text-muted-foreground">{formatDate(charge.dueDate)}</TableCell>
												<TableCell className="text-right">{formatCurrency(charge.amount)}</TableCell>
												<TableCell>
													<span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[charge.status]}`}>{statusLabels[charge.status]}</span>
												</TableCell>
												<TableCell>
													<div className="flex items-center justify-end gap-1">
														{charge.status !== "PAID" && chargeHoa ? <MarkHousingChargePaidButton housingChargeId={charge.id} hoaId={chargeHoa.id} /> : null}
														{chargeHoa ? <HousingChargeFormDialog hoaId={chargeHoa.id} units={units} owners={ownerList} housingCharge={charge} /> : null}
														{chargeHoa ? <ConfirmDeleteButton action={deleteHousingChargeAction.bind(null, charge.id, chargeHoa.id)} confirmMessage="Diese Hausgeld-Sollstellung wirklich löschen?" /> : null}
													</div>
												</TableCell>
											</TableRow>
										);
									})}
								</TableBody>
							</Table>
						)}
					</CardContent>
				</Card>

				<PaginationBar basePath="/weg/hausgeld" pagination={chargePagination} params={{ hoaId }} />
			</div>
		</div>
	);
}
